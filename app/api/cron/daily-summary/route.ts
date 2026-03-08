import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { analyzeBehavior, checkReadyForBudget, transitionToBudget } from '@/lib/analysis/behavior-analyzer';
import { forecastIncome, saveForecastsToDatabase } from '@/lib/goals/income-forecaster';
import { isQuietTime } from '@/lib/utils/quiet-hours';

// Daily challenges/questions pool - rotates for variety
const DAILY_CHALLENGES = [
  (spent: number) => spent > 0 ? `💪 *אתגר מחר:* נסה להוציא פחות מ-${Math.round(spent * 0.8).toLocaleString('he-IL')} ₪` : null,
  () => `🤔 *שאלה:* מה ההוצאה הכי גדולה שאפשר היה להימנע ממנה היום?`,
  () => `💡 *טיפ:* לפני כל קנייה שאל - "אני צריך את זה, או רוצה את זה?"`,
  (spent: number) => spent === 0 ? `🎯 *אתגר:* האם תצליח גם מחר ללא הוצאות?` : `📊 *מה דעתך?* כתוב *"סיכום"* לראות את התמונה המלאה`,
  () => `🏆 *שאלה:* מ-1 עד 5, כמה מרוצה אתה מההוצאות שלך היום?`,
];

/**
 * Cron: סיכום יומי + ניתוח התנהגות (20:30)
 * 
 * Schedule: 30 20 * * * (כל יום ב-20:30)
 * 
 * מה זה עושה:
 * 1. מוצא משתמשים פעילים
 * 2. מריץ ניתוח התנהגות (analyzeBehavior)
 * 3. שולח סיכום יומי + תובנות ב-WhatsApp
 * 4. בודק אם המשתמש מוכן לשלב הבא (Budget)
 */

export async function GET(request: NextRequest) {
  try {
    // אימות שזה באמת Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quietCheck = isQuietTime();
    if (quietCheck.isQuiet) {
      console.log(`[Cron] Skipped — ${quietCheck.description}`);
      return NextResponse.json({ skipped: true, reason: quietCheck.description });
    }

    console.log('[Cron] Starting daily summary + behavior analysis...');
    const startTime = Date.now();
    
    const supabase = createServiceClient();
    const greenAPI = getGreenAPIClient();

    // מצא משתמשים פעילים עם WhatsApp
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, full_name, phone, wa_opt_in, phase')
      .eq('wa_opt_in', true)
      .in('subscription_status', ['active', 'trial'])
      .not('phone', 'is', null);

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
    }

    const results = [];
    const today = new Date().toISOString().split('T')[0];

    // 🚀 Batch load: all today's expense transactions for all users upfront
    const userIds = (users || []).map(u => u.id);
    const { data: allTodayTx } = await supabase
      .from('transactions')
      .select('user_id, amount, expense_category, vendor')
      .lt('amount', 0)
      .eq('tx_date', today)
      .in('user_id', userIds);

    // Group by user_id in memory
    const txByUser = new Map<string, typeof allTodayTx>();
    for (const tx of allTodayTx || []) {
      if (!txByUser.has(tx.user_id)) txByUser.set(tx.user_id, []);
      txByUser.get(tx.user_id)!.push(tx);
    }

    // 🚀 Batch load: active goals for spending-to-goal connection
    const { data: allGoals } = await supabase
      .from('goals')
      .select('user_id, name, target_amount, current_amount, monthly_target')
      .eq('status', 'active')
      .in('user_id', userIds);

    const goalsByUser = new Map<string, typeof allGoals>();
    for (const g of allGoals || []) {
      if (!goalsByUser.has(g.user_id)) goalsByUser.set(g.user_id, []);
      goalsByUser.get(g.user_id)!.push(g);
    }

    for (const user of users || []) {
      try {
        // 1. בדוק הוצאות היום (from pre-loaded batch)
        const todayTransactions = txByUser.get(user.id) || [];

        const totalSpent = Math.abs(todayTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0));
        const transactionCount = todayTransactions.length;

        // 2. ניתוח התנהגות (רק למי שבשלב behavior או יותר)
        let behaviorInsight: string | null = null;
        let shouldTransition = false;
        
        if (user.phase && ['behavior', 'budget', 'goals', 'monitoring'].includes(user.phase)) {
          try {
            const analysis = await analyzeBehavior(user.id);
            
            // אם יש תובנה חשובה - הוסף להודעה
            if (analysis.shouldNotify && analysis.notificationMessage) {
              behaviorInsight = analysis.notificationMessage;
            }
            
            // בדוק אם מוכן לשלב Budget
            if (user.phase === 'behavior') {
              const readyCheck = await checkReadyForBudget(user.id);
              if (readyCheck.ready) {
                shouldTransition = await transitionToBudget(user.id);
              }
            }
          } catch (analysisError) {
            console.error(`Analysis error for user ${user.id}:`, analysisError);
          }
        }

        // 2.5. עדכון תחזית הכנסה (לשימוש בתזרים מזומנים)
        try {
          const forecasts = await forecastIncome(user.id);
          if (forecasts.length > 0) {
            await saveForecastsToDatabase(forecasts);
          }
        } catch (forecastError) {
          console.error(`Income forecast error for user ${user.id}:`, forecastError);
        }

        // 3. בניית הודעה
        let message = '';
        const userName = (user.name || user.full_name)?.split(' ')[0] || 'היי';

        if (transactionCount === 0) {
          message = `🎉 ${userName}!\n\nיום ללא הוצאות! זה מעולה! 💪\n\nהמשך ככה - אתה שולט! 🌟`;
        } else {
          const topExpenses = [...todayTransactions]
            .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
            .slice(0, 3)
            .map((tx) => `• ${tx.vendor || tx.expense_category || 'אחר'}: ${Math.abs(Number(tx.amount)).toLocaleString('he-IL')} ₪`)
            .join('\n');

          message = `📊 ${userName}, סיכום היום:\n\n💸 סה״כ הוצאות: ${totalSpent.toLocaleString('he-IL')} ₪\n📝 ${transactionCount} תנועות\n\nההוצאות הגדולות:\n${topExpenses}`;
        }

        // 4. הוסף תובנה אם יש
        if (behaviorInsight) {
          message += `\n\n---\n${behaviorInsight}`;
        }
        
        // 5. הודעה על מעבר שלב
        if (shouldTransition) {
          message += `\n\n🎯 *חדשות טובות!*\nאתה מוכן לשלב הבא - בניית תקציב!\nכתוב "בוא נבנה תקציב" להתחיל.`;
        }

        // 5.5. Spending-to-goal connection (Feature C)
        const userGoals = goalsByUser.get(user.id) || [];
        if (totalSpent > 0 && userGoals.length > 0) {
          // Pick the goal with the smallest monthly target for relatable comparison
          const relatable = userGoals.reduce((best: any, g: any) => {
            const mt = Number(g.monthly_target) || (Number(g.target_amount) - Number(g.current_amount)) / 12;
            const bestMt = Number(best.monthly_target) || (Number(best.target_amount) - Number(best.current_amount)) / 12;
            return mt > 0 && mt < bestMt ? g : best;
          });
          const dailyGoalRate = (Number(relatable.monthly_target) || (Number(relatable.target_amount) - Number(relatable.current_amount)) / 12) / 30;
          if (dailyGoalRate > 0) {
            const daysWorth = Math.round(totalSpent / dailyGoalRate);
            if (daysWorth >= 1) {
              message += `\n\n🎯 *תובנה:* ההוצאות היום (${totalSpent.toLocaleString('he-IL')} ₪) שוות ${daysWorth} ימי חיסכון ליעד *"${relatable.name}"*`;
            }
          }
        }

        // 6. Daily challenge/question (Feature B) - replaces generic "לילה טוב"
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        const challengeIdx = dayOfYear % DAILY_CHALLENGES.length;
        const challenge = DAILY_CHALLENGES[challengeIdx](totalSpent);
        message += `\n\n${challenge || '📊 כתוב *"סיכום"* לראות את התמונה המלאה'}`;

        // 6. שלח ב-WhatsApp
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

          results.push({ 
            user_id: user.id, 
            success: true, 
            spent: totalSpent,
            hadInsight: !!behaviorInsight,
            transitioned: shouldTransition,
          });
        }
      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
        results.push({ user_id: user.id, success: false, error: String(userError) });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Cron] Daily summary complete: ${results.length} users, ${duration}ms`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Daily summary cron error:', error);
    return NextResponse.json(
      { error: 'שגיאה פנימית' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

