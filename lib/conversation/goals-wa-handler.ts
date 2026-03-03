/**
 * Goals WhatsApp Handler - פונקציות מתקדמות לניהול יעדים ב-WhatsApp
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import {
  calculateOptimalAllocations,
  saveAllocationHistory,
  applyAllocations,
} from '@/lib/goals/goals-balancer';
import { mergeClassificationContext as mergeContext } from './shared';
import type { RouterContext } from './phi-router';
import type { Goal } from '@/types/goals';

/**
 * הצגת יעדים מתקדמת עם הקצאות מחושבות
 */
export async function showGoalsWithAllocations(ctx: RouterContext): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // שלוף יעדים
  const { data: goals, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('status', 'active')
    .order('priority', { ascending: true });
  
  if (error || !goals || goals.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `🎯 *היעדים שלך*\n\n` +
        `אין עדיין יעדים מוגדרים.\n\n` +
        `כתוב *"יעד חדש"* להתחיל`,
    });
    return;
  }
  
  // חשב הקצאות אופטימליות
  const result = await calculateOptimalAllocations({ userId: ctx.userId });
  
  // הכן הודעה מפורטת
  let message = `🎯 *היעדים שלך*\n\n`;
  message += `💰 סה״כ הקצאה: *${result.summary.total_allocated.toLocaleString('he-IL')} ₪/חודש*\n`;
  message += `📊 מתוך הכנסה זמינה: *${result.summary.available_for_goals.toLocaleString('he-IL')} ₪*\n\n`;
  
  // הצג כל יעד
  for (let i = 0; i < goals.length && i < 5; i++) {
    const goal = goals[i] as Goal;
    const allocation = result.allocations.find(a => a.goal_id === goal.id);
    
    const emoji = i === 0 ? '1️⃣' : i === 1 ? '2️⃣' : i === 2 ? '3️⃣' : i === 3 ? '4️⃣' : '5️⃣';
    const priorityEmoji = goal.priority <= 3 ? '🔴' : goal.priority <= 6 ? '🟡' : '🟢';
    
    message += `${emoji} *${goal.name}* ${priorityEmoji}\n`;
    message += `   יעד: ${goal.target_amount.toLocaleString('he-IL')} ₪ | נוכחי: ${goal.current_amount.toLocaleString('he-IL')} ₪\n`;
    
    if (allocation) {
      message += `   הקצאה: *${allocation.monthly_allocation.toLocaleString('he-IL')} ₪/חודש*\n`;
      if (allocation.is_achievable) {
        const completionDate = new Date(allocation.expected_completion_date);
        message += `   ✅ סיום צפוי: ${completionDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}\n`;
      } else {
        message += `   ⚠️ לא ניתן להשלים בזמן עם התקציב הנוכחי\n`;
      }
    } else {
      message += `   ⏸️ אין הקצאה (תקציב לא מספיק)\n`;
    }
    message += `\n`;
  }
  
  if (goals.length > 5) {
    message += `... ועוד ${goals.length - 5} יעדים נוספים\n\n`;
  }
  
  // הוסף המלצות
  if (result.suggestions.length > 0) {
    message += `💡 *המלצה:* ${result.suggestions[0].message}\n\n`;
  }
  
  message += `*פקודות:*\n`;
  message += `• *"יעד חדש"* - הוסף יעד\n`;
  message += `• *"סימולציה"* - מה יקרה אם...\n`;
  message += `• *"אופטימיזציה"* - הצע תכנית אופטימלית`;
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message,
  });
}

/**
 * הרצת סימולציה אינטראקטיבית
 */
export async function runSimulation(ctx: RouterContext): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // בקש מהמשתמש מה לסמלץ
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `📊 *סימולציה - מה יקרה אם...*\n\n` +
      `בחר תרחיש:\n\n` +
      `1️⃣ *הכנסה עולה* - ההכנסה שלי תעלה ב-X ₪\n` +
      `2️⃣ *הכנסה יורדת* - ההכנסה שלי תרד ב-X ₪\n` +
      `3️⃣ *יעד חדש* - אוסיף יעד חדש\n` +
      `4️⃣ *שינוי עדיפות* - אשנה סדר עדיפויות\n\n` +
      `כתוב מספר (1-4)`,
  });
  
  // שמור במצב שמחכה לבחירת סימולציה (merge to preserve other keys)
  await mergeContext(ctx.userId, { simulation: { step: 'choose_scenario' } });
}

/**
 * טיפול בבחירת תרחיש סימולציה
 */
export async function handleSimulationChoice(
  ctx: RouterContext,
  choice: string
): Promise<void> {
  const greenAPI = getGreenAPIClient();
  
  switch (choice) {
    case '1':
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `💰 *סימולציה: הכנסה עולה*\n\n` +
          `כמה ההכנסה תעלה?\n\n` +
          `דוגמאות:\n` +
          `• *"1000"* - עלייה של 1,000 ₪\n` +
          `• *"2500"* - עלייה של 2,500 ₪\n\n` +
          `כתוב סכום בשקלים:`,
      });
      break;
      
    case '2':
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `📉 *סימולציה: הכנסה יורדת*\n\n` +
          `כמה ההכנסה תרד?\n\n` +
          `כתוב סכום בשקלים:`,
      });
      break;
      
    case '3':
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `➕ *סימולציה: יעד חדש*\n\n` +
          `תאר את היעד החדש:\n\n` +
          `דוגמה: *"חופשה 15000 דצמבר 2026"*\n\n` +
          `(שם, סכום, תאריך)`,
      });
      break;
      
    case '4':
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `🔄 *סימולציה: שינוי עדיפות*\n\n` +
          `לא זמין כרגע - בקרוב!`,
      });
      break;
      
    default:
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `❌ בחירה לא תקינה. כתוב מספר בין 1-4`,
      });
  }
}

/**
 * הרצת אופטימיזציה אוטומטית
 */
export async function runOptimization(ctx: RouterContext): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `🔄 *מריץ אופטימיזציה...*\n\n` +
      `אני בודק את היעדים שלך ומחפש את התכנית המיטבית...`,
  });
  
  // חשב הקצאות אופטימליות
  const result = await calculateOptimalAllocations({ userId: ctx.userId });
  
  // בדוק אם יש שינוי משמעותי
  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('status', 'active');
  
  let hasChanges = false;
  let changesMessage = '';
  
  if (goals) {
    for (const allocation of result.allocations) {
      const goal = goals.find((g: any) => g.id === allocation.goal_id);
      if (goal && Math.abs((goal.monthly_allocation || 0) - allocation.monthly_allocation) > 50) {
        hasChanges = true;
        const diff = allocation.monthly_allocation - (goal.monthly_allocation || 0);
        const sign = diff > 0 ? '+' : '';
        changesMessage += `• *${goal.name}*: ${sign}${diff.toLocaleString('he-IL')} ₪\n`;
      }
    }
  }
  
  if (hasChanges) {
    let message = `🎯 *תכנית אופטימלית מוצעת*\n\n`;
    message += `מצאתי שיפור אפשרי בהקצאות!\n\n`;
    message += `*שינויים מוצעים:*\n${changesMessage}\n`;
    message += `💡 *תוצאה:* ${result.suggestions[0]?.message || 'התקדמות מהירה יותר ביעדים'}\n\n`;
    message += `האם לאשר את השינויים?\n\n`;
    message += `כתוב *"אשר"* או *"בטל"*`;
    
    // שמור במצב המתנה לאישור (merge to preserve other keys)
    await mergeContext(ctx.userId, {
      optimization: {
        pending: true,
        allocations: result.allocations,
      }
    });
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message,
    });
  } else {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `✅ *מצוין!*\n\n` +
        `ההקצאות הנוכחיות כבר אופטימליות.\n` +
        `אין צורך בשינויים 👍`,
    });
  }
}

/**
 * אישור אופטימיזציה
 */
export async function confirmOptimization(ctx: RouterContext): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // שלוף הקצאות שממתינות
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', ctx.userId)
    .single();
  
  const optimization = user?.classification_context?.optimization;
  
  if (!optimization?.pending) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ אין אופטימיזציה ממתינה לאישור`,
    });
    return;
  }
  
  // החל שינויים
  const allocations = optimization.allocations;
  await applyAllocations(allocations);
  await saveAllocationHistory(ctx.userId, allocations, 'optimization_applied');
  
  // נקה optimization context בלבד (preserve other keys)
  const { data: ctxUser } = await supabase.from('users').select('classification_context').eq('id', ctx.userId).single();
  const ctxData = ctxUser?.classification_context || {};
  const { optimization: _removed, ...restCtx } = ctxData as any;
  await supabase.from('users').update({ classification_context: Object.keys(restCtx).length > 0 ? restCtx : null }).eq('id', ctx.userId);
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `✅ *האופטימיזציה הוחלה בהצלחה!*\n\n` +
      `היעדים שלך עודכנו עם ההקצאות החדשות.\n\n` +
      `כתוב *"יעדים"* לראות את העדכון`,
  });
}

/**
 * בדיקת מצב יעדים - תזכורת אוטומטית
 */
export async function checkGoalsStatus(userId: string, phone: string): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');
  
  if (!goals || goals.length === 0) return;
  
  // חשב הקצאות
  const result = await calculateOptimalAllocations({ userId });
  
  // בדוק אזהרות
  const criticalWarnings = result.warnings.filter(w => w.includes('⚠️'));
  
  if (criticalWarnings.length > 0) {
    let message = `⚠️ *עדכון יעדים*\n\n`;
    message += criticalWarnings.join('\n') + '\n\n';
    message += `כתוב *"יעדים"* לפרטים נוספים`;
    
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message,
    });
  }
  
  // בדוק יעדים שעומדים להסתיים
  for (const allocation of result.allocations) {
    if (allocation.months_to_complete <= 1 && allocation.months_to_complete > 0) {
      const goal = goals.find((g: any) => g.id === allocation.goal_id);
      if (goal) {
        await greenAPI.sendMessage({
          phoneNumber: phone,
          message: `🎉 *כמעט סיימת!*\n\n` +
            `היעד "${goal.name}" עומד להסתיים!\n` +
            `עוד ${allocation.months_to_complete} חודשים והשגת את המטרה 🎯`,
        });
      }
    }
  }
}

