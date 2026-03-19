import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { isQuietTime } from '@/lib/utils/quiet-hours';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Cron: Morning brief
 * Runs daily at 08:00: 0 8 * * *
 * Sends yesterday's summary + today's budget to each user
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

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const currentMonth = today.toISOString().substring(0, 7);
    const monthStart = `${currentMonth}-01`;
    const todayStr = today.toISOString().split('T')[0];

    // Day names in Hebrew
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const todayName = dayNames[today.getDay()];

    // Get active monitoring users with WhatsApp
    const { data: users } = await supabase
      .from('users')
      .select('id, name, phone')
      .eq('wa_opt_in', true)
      .in('phase', ['monitoring', 'budget', 'goals'])
      .not('phone', 'is', null);

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    // Dedup: check we haven't sent morning brief today
    const { data: alreadySent } = await supabase
      .from('alerts')
      .select('user_id')
      .eq('type', 'morning_brief')
      .gte('created_at', `${todayStr}T00:00:00`);

    const alreadySentIds = new Set((alreadySent || []).map(a => a.user_id));

    let sent = 0;

    // Batch: get all user IDs to query
    const userIds = users.filter(u => !alreadySentIds.has(u.id)).map(u => u.id);
    if (userIds.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: 'all already sent' });
    }

    // Batch query: yesterday's expenses for all users
    const { data: yesterdayTxs } = await supabase
      .from('transactions')
      .select('user_id, amount')
      .in('user_id', userIds)
      .eq('type', 'expense')
      .eq('status', 'confirmed')
      .or('is_summary.is.null,is_summary.eq.false')
      .eq('tx_date', yesterdayStr);

    // Batch query: month-to-date expenses for all users
    const { data: monthTxs } = await supabase
      .from('transactions')
      .select('user_id, amount')
      .in('user_id', userIds)
      .eq('type', 'expense')
      .eq('status', 'confirmed')
      .or('is_summary.is.null,is_summary.eq.false')
      .gte('tx_date', monthStart)
      .lte('tx_date', todayStr);

    // Batch query: active budgets for all users
    const { data: budgets } = await supabase
      .from('budgets')
      .select('user_id, total_budget, total_spent')
      .in('user_id', userIds)
      .eq('month', currentMonth)
      .in('status', ['active', 'warning', 'exceeded']);

    // Index by user_id
    const yesterdayByUser: Record<string, number> = {};
    (yesterdayTxs || []).forEach(tx => {
      yesterdayByUser[tx.user_id] = (yesterdayByUser[tx.user_id] || 0) + Math.abs(Number(tx.amount) || 0);
    });

    const monthByUser: Record<string, number> = {};
    (monthTxs || []).forEach(tx => {
      monthByUser[tx.user_id] = (monthByUser[tx.user_id] || 0) + Math.abs(Number(tx.amount) || 0);
    });

    const budgetByUser: Record<string, { total_budget: number; total_spent: number }> = {};
    (budgets || []).forEach(b => {
      budgetByUser[b.user_id] = { total_budget: b.total_budget, total_spent: b.total_spent };
    });

    // Calculate remaining days in month
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = lastDay - today.getDate() + 1; // Including today

    for (const user of users) {
      if (alreadySentIds.has(user.id)) continue;

      try {
        const name = user.name ? user.name.split(' ')[0] : '';
        const yesterdayTotal = Math.round(yesterdayByUser[user.id] || 0);
        const monthTotal = Math.round(monthByUser[user.id] || 0);
        const budget = budgetByUser[user.id];

        let message = `☀️ בוקר טוב${name ? ` ${name}` : ''}! יום ${todayName}\n\n`;

        // Yesterday summary
        if (yesterdayTotal > 0) {
          message += `📋 *אתמול:* ${yesterdayTotal.toLocaleString('he-IL')} ₪\n`;
        } else {
          message += `📋 *אתמול:* לא נרשמו הוצאות\n`;
        }

        // Budget context
        if (budget && budget.total_budget > 0) {
          const remaining = budget.total_budget - monthTotal;
          const dailyBudget = Math.round(remaining / daysLeft);

          message += `💰 *היום יש לך:* ~${dailyBudget > 0 ? dailyBudget.toLocaleString('he-IL') : 0} ₪\n`;
          message += `📊 *החודש:* ${monthTotal.toLocaleString('he-IL')} / ${budget.total_budget.toLocaleString('he-IL')} ₪\n`;

          if (remaining <= 0) {
            message += `\n⚠️ חרגת מהתקציב החודשי!`;
          } else if (dailyBudget < 50) {
            message += `\n⚡ תקציב צפוף — שים לב להוצאות`;
          }
        } else {
          message += `💰 *החודש:* ${monthTotal.toLocaleString('he-IL')} ₪ (אין תקציב מוגדר)\n`;
        }

        message += `\n💡 כשמוציאים — רשום מיד:\n*"קפה 15"* · *"סופר 200"* · *"דלק 250"*`;

        await greenAPI.sendMessage({ phoneNumber: user.phone, message });

        await supabase.from('alerts').insert({
          user_id: user.id,
          type: 'morning_brief',
          message: `morning brief sent: yesterday=${yesterdayTotal}`,
          status: 'sent',
        });

        sent++;
      } catch (err) {
        console.warn(`[MorningBrief] Error for user ${user.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, sent, total: users.length });
  } catch (error: any) {
    console.error('[MorningBrief] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
