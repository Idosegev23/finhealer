// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { isQuietTime } from '@/lib/utils/quiet-hours';

/**
 * Cron: דוח שבועי (Monday 09:00)
 * 
 * מה זה עושה:
 * 1. מחשב סיכום השבוע (7 ימים אחרונים)
 * 2. משווה לשבוע שעבר
 * 3. שולח דוח מפורט ב-WhatsApp
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
      console.log(`[Cron] Skipped — ${quietCheck.description}`);
      return NextResponse.json({ skipped: true, reason: quietCheck.description });
    }

    const supabase = await createClient();
    const greenAPI = getGreenAPIClient();

    const { data: users } = await supabase
      .from('users')
      .select('id, name, phone')
      .eq('wa_opt_in', true)
      .in('subscription_status', ['active', 'trial'])
      .not('phone', 'is', null);

    const results = [];
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(today.getDate() - 14);

    for (const user of users || []) {
      try {
        // השבוע הזה (7 ימים אחרונים) - parent transactions + cash expenses
        const { data: thisWeek } = await supabase
          .from('transactions')
          .select('amount, type, category')
          .eq('user_id', user.id)
          .or('is_summary.is.null,is_summary.eq.false')
          .gte('tx_date', sevenDaysAgo.toISOString().split('T')[0])
          .lte('tx_date', today.toISOString().split('T')[0]);

        // השבוע שעבר (14-7 ימים אחרונים)
        const { data: lastWeek } = await supabase
          .from('transactions')
          .select('amount, type')
          .eq('user_id', user.id)
          .or('is_summary.is.null,is_summary.eq.false')
          .gte('tx_date', fourteenDaysAgo.toISOString().split('T')[0])
          .lt('tx_date', sevenDaysAgo.toISOString().split('T')[0]);

        const thisWeekExpenses = thisWeek
          ?.filter((tx) => tx.type === 'expense')
          .reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

        const lastWeekExpenses = lastWeek
          ?.filter((tx) => tx.type === 'expense')
          .reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

        const thisWeekIncome = thisWeek
          ?.filter((tx) => tx.type === 'income')
          .reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

        const difference = thisWeekExpenses - lastWeekExpenses;
        const percentChange = lastWeekExpenses > 0 ? (difference / lastWeekExpenses) * 100 : 0;

        // קטגוריות מובילות
        const categoryBreakdown = thisWeek
          ?.filter((tx) => tx.type === 'expense')
          .reduce((acc: any, tx) => {
            const cat = tx.category || 'אחר';
            acc[cat] = (acc[cat] || 0) + Number(tx.amount);
            return acc;
          }, {});

        const topCategories = Object.entries(categoryBreakdown || {})
          .sort(([, a]: any, [, b]: any) => b - a)
          .slice(0, 3)
          .map(([cat, amount]: any) => `• ${cat}: ₪${amount.toFixed(0)}`)
          .join('\n');

        let trendEmoji = '➡️';
        let trendText = 'דומה לשבוע שעבר';
        if (percentChange > 10) {
          trendEmoji = '📈';
          trendText = `עלייה של ${percentChange.toFixed(0)}% ⚠️`;
        } else if (percentChange < -10) {
          trendEmoji = '📉';
          trendText = `ירידה של ${Math.abs(percentChange).toFixed(0)}% 🎉`;
        }

        const message = `🗓️ ${user.name || 'היי'}, דוח השבוע!\n\n💸 הוצאות השבוע: ₪${thisWeekExpenses.toFixed(0)}\n${trendEmoji} ${trendText}\n\n📊 קטגוריות מובילות:\n${topCategories}\n\n${thisWeekIncome > 0 ? `💰 הכנסות: ₪${thisWeekIncome.toFixed(0)}\n\n` : ''}שבוע טוב! 💪`;

        if (user.phone) {
          await greenAPI.sendMessage({
            phoneNumber: user.phone,
            message,
          });

          await supabase.from('alerts').insert({
            user_id: user.id,
            type: 'weekly_report',
            message,
            status: 'sent',
          });

          results.push({ user_id: user.id, success: true, spent: thisWeekExpenses });
        }
      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
        results.push({ user_id: user.id, success: false, error: String(userError) });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Weekly report cron error:', error);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}

