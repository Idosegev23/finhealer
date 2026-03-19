import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { isQuietTime } from '@/lib/utils/quiet-hours';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Cron: Evening expense check-in
 * Runs daily at 20:00: 0 20 * * *
 *
 * Two modes:
 * 1. User logged expenses → show daily summary + budget status
 * 2. User didn't log → gentle reminder to log
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quietCheck = isQuietTime();
    if (quietCheck.isQuiet) {
      return NextResponse.json({ skipped: true, reason: quietCheck.description });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const greenAPI = getGreenAPIClient();
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().substring(0, 7);

    // Get monitoring users with WhatsApp
    const { data: users } = await supabase
      .from('users')
      .select('id, name, phone')
      .eq('wa_opt_in', true)
      .in('phase', ['monitoring', 'budget', 'goals'])
      .not('phone', 'is', null);

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    // Dedup
    const { data: alreadySent } = await supabase
      .from('alerts')
      .select('user_id')
      .eq('type', 'evening_checkin')
      .gte('created_at', `${today}T00:00:00`);

    const alreadySentIds = new Set((alreadySent || []).map(a => a.user_id));
    const userIds = users.filter(u => !alreadySentIds.has(u.id)).map(u => u.id);
    if (userIds.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: 'all already sent' });
    }

    // Batch: today's expenses
    const { data: todayTxs } = await supabase
      .from('transactions')
      .select('user_id, amount, vendor, expense_category, source')
      .in('user_id', userIds)
      .eq('type', 'expense')
      .eq('status', 'confirmed')
      .or('is_summary.is.null,is_summary.eq.false')
      .eq('tx_date', today);

    // Batch: active budgets
    const { data: budgets } = await supabase
      .from('budgets')
      .select('user_id, total_budget, total_spent')
      .in('user_id', userIds)
      .eq('month', currentMonth)
      .in('status', ['active', 'warning', 'exceeded']);

    // Index
    const todayByUser: Record<string, Array<{ amount: number; vendor: string; source: string }>> = {};
    (todayTxs || []).forEach(tx => {
      if (!todayByUser[tx.user_id]) todayByUser[tx.user_id] = [];
      todayByUser[tx.user_id].push({
        amount: Math.abs(Number(tx.amount) || 0),
        vendor: tx.vendor || tx.expense_category || '',
        source: tx.source || '',
      });
    });

    const budgetByUser: Record<string, { total_budget: number; total_spent: number }> = {};
    (budgets || []).forEach(b => {
      budgetByUser[b.user_id] = { total_budget: b.total_budget, total_spent: b.total_spent };
    });

    let sent = 0;

    for (const user of users) {
      if (alreadySentIds.has(user.id)) continue;

      try {
        const name = user.name ? user.name.split(' ')[0] : '';
        const todayExpenses = todayByUser[user.id] || [];
        const budget = budgetByUser[user.id];

        let message: string;

        if (todayExpenses.length > 0) {
          // MODE 1: User logged expenses today — show summary
          const totalToday = todayExpenses.reduce((s, t) => s + t.amount, 0);

          message = `🌙 ${name ? `${name}, ` : ''}סיכום היום:\n\n`;

          // List today's expenses (max 5)
          const shown = todayExpenses.slice(0, 5);
          shown.forEach(tx => {
            message += `• ${tx.vendor || 'הוצאה'}: ${Math.round(tx.amount).toLocaleString('he-IL')} ₪\n`;
          });
          if (todayExpenses.length > 5) {
            message += `• ...ועוד ${todayExpenses.length - 5}\n`;
          }

          message += `\n💰 *סה"כ היום:* ${Math.round(totalToday).toLocaleString('he-IL')} ₪`;

          // Budget context
          if (budget && budget.total_budget > 0) {
            const monthSpent = Number(budget.total_spent) || 0;
            const remaining = budget.total_budget - monthSpent;
            const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
            const daysLeft = lastDay - new Date().getDate();
            const dailyBudget = daysLeft > 0 ? Math.round(remaining / daysLeft) : 0;

            message += `\n📊 *נותר החודש:* ${Math.max(0, remaining).toLocaleString('he-IL')} ₪`;
            if (dailyBudget > 0) {
              message += ` (~${dailyBudget.toLocaleString('he-IL')} ₪/יום)`;
            }
          }

          // Check if there were manual entries that might be missing
          const manualCount = todayExpenses.filter(t => t.source === 'whatsapp' || t.source === 'manual').length;
          const bankCount = todayExpenses.length - manualCount;
          if (bankCount > 0 && manualCount === 0) {
            message += `\n\n💡 ההוצאות מדוח הבנק. היו עוד הוצאות במזומן או בביט?`;
          } else {
            message += `\n\n✨ יפה שרשמת! לילה טוב 😊`;
          }
        } else {
          // MODE 2: No expenses logged today — ask
          message = `🌙 ${name ? `${name}, ` : ''}היו לך הוצאות היום?\n\n`;
          message += `רשום בקצרה:\n*"סופר 200"* · *"קפה 15"* · *"דלק 250"*\n\n`;

          if (budget && budget.total_budget > 0) {
            const remaining = budget.total_budget - (Number(budget.total_spent) || 0);
            message += `📊 נותר החודש: ${Math.max(0, remaining).toLocaleString('he-IL')} ₪`;
          }

          message += `\n\nאם לא היו — מעולה! 💪`;
        }

        await greenAPI.sendMessage({ phoneNumber: user.phone, message });

        await supabase.from('alerts').insert({
          user_id: user.id,
          type: 'evening_checkin',
          message: `evening checkin: ${todayExpenses.length} expenses logged`,
          status: 'sent',
        });

        sent++;
      } catch (err) {
        console.warn(`[EveningCheckin] Error for user ${user.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, sent, total: users.length });
  } catch (error: any) {
    console.error('[EveningCheckin] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
