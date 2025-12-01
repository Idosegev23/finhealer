import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { analyzeBehavior, checkReadyForBudget, transitionToBudget } from '@/lib/analysis/behavior-analyzer';

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

    console.log('[Cron] Starting daily summary + behavior analysis...');
    const startTime = Date.now();
    
    const supabase = createServiceClient();
    const greenAPI = getGreenAPIClient();

    // מצא משתמשים פעילים עם WhatsApp
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, phone, wa_opt_in, current_phase')
      .eq('wa_opt_in', true)
      .not('phone', 'is', null);

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = [];
    const today = new Date().toISOString().split('T')[0];

    for (const user of users || []) {
      try {
        // 1. בדוק הוצאות היום
        const { data: todayTransactions } = await supabase
          .from('transactions')
          .select('amount, expense_category, vendor')
          .eq('user_id', user.id)
          .lt('amount', 0) // הוצאות בלבד
          .eq('date', today);

        const totalSpent = Math.abs(todayTransactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0);
        const transactionCount = todayTransactions?.length || 0;

        // 2. ניתוח התנהגות (רק למי שבשלב behavior או יותר)
        let behaviorInsight: string | null = null;
        let shouldTransition = false;
        
        if (user.current_phase && ['behavior', 'budget', 'goals', 'monitoring'].includes(user.current_phase)) {
          try {
            const analysis = await analyzeBehavior(user.id);
            
            // אם יש תובנה חשובה - הוסף להודעה
            if (analysis.shouldNotify && analysis.notificationMessage) {
              behaviorInsight = analysis.notificationMessage;
            }
            
            // בדוק אם מוכן לשלב Budget
            if (user.current_phase === 'behavior') {
              const readyCheck = await checkReadyForBudget(user.id);
              if (readyCheck.ready) {
                shouldTransition = await transitionToBudget(user.id);
              }
            }
          } catch (analysisError) {
            console.error(`Analysis error for user ${user.id}:`, analysisError);
          }
        }

        // 3. בניית הודעה
        let message = '';
        const userName = user.full_name?.split(' ')[0] || 'היי';

        if (transactionCount === 0) {
          message = `🎉 ${userName}!\n\nיום ללא הוצאות! זה מעולה! 💪\n\nהמשך ככה - אתה שולט! 🌟`;
        } else {
          const topExpenses = todayTransactions
            ?.sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
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
        
        message += `\n\nלילה טוב! 🌙`;

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
      { error: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

