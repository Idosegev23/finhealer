/**
 * מעקב אחר שינויים בהכנסה - להרצה ב-Cron
 * בודק פעם ביום אם יש שינויים משמעותיים בהכנסה
 */

import { createServiceClient } from '@/lib/supabase/server';
import { detectIncomeChangeAndPropose } from './auto-adjust-handler';

/**
 * פונקציה ראשית - בודקת את כל המשתמשים הפעילים
 */
export async function monitorIncomeChanges(): Promise<void> {
  const supabase = createServiceClient();

  try {
    console.log('[Income Monitor] Starting income change monitoring...');

    // שלוף משתמשים עם יעדים פעילים ו-auto_adjust מופעל
    const { data: usersWithAutoAdjust, error } = await supabase
      .from('users')
      .select('id, phone_number, monthly_income')
      .eq('onboarding_phase', 'completed');

    if (error) {
      console.error('[Income Monitor] Error fetching users:', error);
      return;
    }

    if (!usersWithAutoAdjust || usersWithAutoAdjust.length === 0) {
      console.log('[Income Monitor] No users with auto-adjust enabled');
      return;
    }

    console.log(`[Income Monitor] Checking ${usersWithAutoAdjust.length} users...`);

    // בדוק כל משתמש
    for (const user of usersWithAutoAdjust) {
      // בדוק אם יש לו יעדים עם auto_adjust
      const { data: goalsWithAutoAdjust } = await supabase
        .from('goals')
        .select('id')
        .eq('user_id', user.id)
        .eq('auto_adjust', true)
        .eq('status', 'active')
        .limit(1);

      if (!goalsWithAutoAdjust || goalsWithAutoAdjust.length === 0) {
        continue; // דלג על משתמשים ללא יעדים עם auto-adjust
      }

      // בדוק שינוי בהכנסה
      await detectIncomeChangeAndPropose(user.id, user.phone_number);
    }

    console.log('[Income Monitor] Completed income change monitoring');
  } catch (error) {
    console.error('[Income Monitor] Error:', error);
  }
}

/**
 * פונקציה יעילה יותר - בודקת רק משתמשים עם תנועות חדשות מהיום האחרון
 */
export async function monitorRecentIncomeChanges(): Promise<void> {
  const supabase = createServiceClient();

  try {
    console.log('[Income Monitor] Starting recent income change monitoring...');

    // שלוף משתמשים עם תנועות הכנסה מהיום האחרון
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('user_id')
      .eq('type', 'income')
      .gte('tx_date', yesterday.toISOString().split('T')[0])
      .limit(100);

    if (!recentTransactions || recentTransactions.length === 0) {
      console.log('[Income Monitor] No recent income transactions');
      return;
    }

    // קבל משתמשים ייחודיים
    const uniqueUserIds = Array.from(new Set(recentTransactions.map(t => t.user_id)));
    console.log(`[Income Monitor] Found ${uniqueUserIds.length} users with recent income`);

    for (const userId of uniqueUserIds) {
      // שלוף פרטי משתמש
      const { data: user } = await supabase
        .from('users')
        .select('id, phone_number')
        .eq('id', userId)
        .single();

      if (!user) continue;

      // בדוק שינוי בהכנסה
      await detectIncomeChangeAndPropose(user.id, user.phone_number);
    }

    console.log('[Income Monitor] Completed recent income change monitoring');
  } catch (error) {
    console.error('[Income Monitor] Error:', error);
  }
}
