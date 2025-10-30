// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';

/**
 * Cron: סיכום יומי (20:30)
 * 
 * מה זה עושה:
 * 1. מוצא משתמשים עם wa_opt_in = true
 * 2. בודק אם היו הוצאות היום
 * 3. שולח סיכום יומי ב-WhatsApp:
 *    - אם היו הוצאות → סיכום עם סכום כולל
 *    - אם לא היו הוצאות → הודעת "יום ללא הוצאות" 🎉
 * 4. מעדכן behavior insights
 * 5. בודק אם צריך להעדכן Phase
 */

export async function GET(request: NextRequest) {
  try {
    // אימות שזה באמת Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const greenAPI = getGreenAPIClient();

    // מצא משתמשים פעילים עם WhatsApp
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, phone, wa_opt_in')
      .eq('wa_opt_in', true)
      .eq('subscription_status', 'active')
      .not('phone', 'is', null);

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = [];
    const today = new Date().toISOString().split('T')[0];

    for (const user of users || []) {
      try {
        // בדוק הוצאות היום (רק parent transactions)
        const { data: todayTransactions } = await supabase
          .from('transactions')
          .select('amount, category, vendor')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .eq('tx_date', today)
          .or('has_details.is.null,has_details.eq.false');

        const totalSpent = todayTransactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
        const transactionCount = todayTransactions?.length || 0;

        let message = '';

        if (transactionCount === 0) {
          // יום ללא הוצאות!
          message = `🎉 ${user.name || 'היי'}!\n\nיום ללא הוצאות! זה מעולה! 💪\n\nהמשך ככה - אתה שולט! 🌟`;
        } else {
          // יום עם הוצאות
          const topExpenses = todayTransactions
            ?.sort((a, b) => Number(b.amount) - Number(a.amount))
            .slice(0, 3)
            .map((tx) => `• ${tx.vendor || tx.category}: ₪${Number(tx.amount).toFixed(0)}`)
            .join('\n');

          message = `📊 ${user.name || 'היי'}, סיכום היום:\n\n💸 סה״כ הוצאות: ₪${totalSpent.toFixed(0)}\n📝 ${transactionCount} תנועות\n\nההוצאות הגדולות:\n${topExpenses}\n\nלילה טוב! 🌙`;
        }

        // שלח ב-WhatsApp
        if (user.phone) {
          await greenAPI.sendMessage({
            phoneNumber: user.phone,
            message,
          });

          // שמור התראה
          await supabase.from('alerts').insert({
            user_id: user.id,
            type: 'daily_summary',
            message,
            status: 'sent',
          });

          results.push({ user_id: user.id, success: true, spent: totalSpent });
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
    console.error('Daily summary cron error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

