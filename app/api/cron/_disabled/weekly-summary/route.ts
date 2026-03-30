import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { isQuietTime } from '@/lib/utils/quiet-hours';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Cron: Weekly spending summary
 * Runs every Sunday at 10:00: 0 10 * * 0
 * Sends a WhatsApp message with the week's spending breakdown
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

    // Calculate last week's date range (Sunday to Saturday)
    const today = new Date();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - 7);
    const lastSaturday = new Date(today);
    lastSaturday.setDate(today.getDate() - 1);

    const weekStart = lastSunday.toISOString().split('T')[0];
    const weekEnd = lastSaturday.toISOString().split('T')[0];

    // Get users in monitoring phase with WhatsApp
    const { data: users } = await supabase
      .from('users')
      .select('id, name, phone')
      .eq('wa_opt_in', true)
      .eq('phase', 'monitoring')
      .not('phone', 'is', null);

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    let sent = 0;

    for (const user of users) {
      try {
        // Get this week's expenses
        const { data: weekExpenses } = await supabase
          .from('transactions')
          .select('amount, expense_category, category, vendor')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .eq('status', 'confirmed')
          .or('is_summary.is.null,is_summary.eq.false')
          .gte('tx_date', weekStart)
          .lte('tx_date', weekEnd);

        if (!weekExpenses || weekExpenses.length === 0) continue;

        const weekTotal = weekExpenses.reduce(
          (sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0
        );

        // Top categories
        const catMap: Record<string, number> = {};
        weekExpenses.forEach(tx => {
          const cat = tx.expense_category || tx.category || 'אחר';
          catMap[cat] = (catMap[cat] || 0) + Math.abs(Number(tx.amount) || 0);
        });

        const topCats = Object.entries(catMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        // Get monthly budget for context
        const currentMonth = today.toISOString().substring(0, 7);
        const { data: budget } = await supabase
          .from('budgets')
          .select('total_budget, total_spent')
          .eq('user_id', user.id)
          .eq('month', currentMonth)
          .single();

        // Build message
        const name = user.name ? user.name.split(' ')[0] : '';
        const greeting = name ? `${name}, ` : '';

        let message = `📊 *${greeting}סיכום שבועי*\n\n`;
        message += `💰 סה"כ הוצאות השבוע: *${weekTotal.toLocaleString('he-IL')} ₪*\n`;
        message += `📋 ${weekExpenses.length} תנועות\n\n`;

        if (topCats.length > 0) {
          message += `*🏷️ לאן הלך הכסף:*\n`;
          topCats.forEach(([cat, amount]) => {
            const percent = Math.round((amount / weekTotal) * 100);
            message += `• ${cat}: ${amount.toLocaleString('he-IL')} ₪ (${percent}%)\n`;
          });
        }

        if (budget) {
          const monthlySpent = Number(budget.total_spent) || 0;
          const monthlyBudget = Number(budget.total_budget) || 0;
          if (monthlyBudget > 0) {
            const monthPercent = Math.round((monthlySpent / monthlyBudget) * 100);
            const remaining = monthlyBudget - monthlySpent;
            message += `\n📈 *חודשי:* ${monthlySpent.toLocaleString('he-IL')} / ${monthlyBudget.toLocaleString('he-IL')} ₪ (${monthPercent}%)`;
            if (remaining > 0) {
              message += `\n✅ נותר: ${remaining.toLocaleString('he-IL')} ₪`;
            } else {
              message += `\n⚠️ חריגה: ${Math.abs(remaining).toLocaleString('he-IL')} ₪`;
            }
          }
        }

        message += `\n\nשבוע מוצלח! 💪`;

        await greenAPI.sendMessage({ phoneNumber: user.phone, message });
        sent++;
      } catch (err) {
        console.warn(`[WeeklySummary] Error for user ${user.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, sent, total: users.length });
  } catch (error: any) {
    console.error('[WeeklySummary] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
