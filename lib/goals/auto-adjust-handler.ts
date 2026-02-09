/**
 * מטפל ב-Auto Adjust - שינויים אוטומטיים בהקצאות כשההכנסה משתנה
 * כולל שאלות למשתמש לפני ביצוע שינויים
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import type { Goal, GoalAllocationResult } from '@/types/goals';
import { calculateOptimalAllocations } from './goals-balancer';

interface IncomeChange {
  userId: string;
  oldIncome: number;
  newIncome: number;
  changePercent: number;
  changeReason?: 'salary_increase' | 'salary_decrease' | 'bonus' | 'job_loss' | 'other';
}

interface AdjustmentProposal {
  goalId: string;
  goalName: string;
  currentAllocation: number;
  proposedAllocation: number;
  changeAmount: number;
  changePercent: number;
  reason: string;
}

interface AdjustmentPlan {
  totalCurrentAllocation: number;
  totalProposedAllocation: number;
  adjustments: AdjustmentProposal[];
  warnings: string[];
  summary: string;
}

/**
 * זיהוי שינוי בהכנסה ויצירת הצעת התאמה
 */
export async function detectIncomeChangeAndPropose(
  userId: string,
  phone: string
): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  try {
    // שלוף הכנסה נוכחית מהDB
    const { data: userData } = await supabase
      .from('users')
      .select('monthly_income')
      .eq('id', userId)
      .single();

    if (!userData) return;

    // חשב הכנסה ממוצעת מ-3 חודשים אחרונים
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'income')
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('date', { ascending: false });

    if (!recentTransactions || recentTransactions.length === 0) return;

    const avgIncome = recentTransactions.reduce((sum, t) => sum + t.amount, 0) / 3;
    const currentIncome = userData.monthly_income || avgIncome;
    const changePercent = ((avgIncome - currentIncome) / currentIncome) * 100;

    // אם השינוי משמעותי (מעל 10%)
    if (Math.abs(changePercent) >= 10) {
      const incomeChange: IncomeChange = {
        userId,
        oldIncome: currentIncome,
        newIncome: avgIncome,
        changePercent,
        changeReason: changePercent > 0 ? 'salary_increase' : 'salary_decrease',
      };

      // צור תוכנית התאמה
      const plan = await createAdjustmentPlan(incomeChange);

      // שמור בהקשר
      await supabase
        .from('users')
        .update({
          classification_context: {
            autoAdjust: {
              plan,
              incomeChange,
              pending: true,
              createdAt: new Date().toISOString(),
            },
          },
        })
        .eq('id', userId);

      // שלח הודעה למשתמש עם ההצעה
      await sendAdjustmentProposal(phone, plan, incomeChange);
    }
  } catch (error) {
    console.error('Error detecting income change:', error);
  }
}

/**
 * יצירת תוכנית התאמה מפורטת
 */
async function createAdjustmentPlan(
  incomeChange: IncomeChange
): Promise<AdjustmentPlan> {
  const supabase = createServiceClient();

  // שלוף יעדים פעילים
  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', incomeChange.userId)
    .eq('status', 'active')
    .eq('auto_adjust', true);

  if (!goals || goals.length === 0) {
    return {
      totalCurrentAllocation: 0,
      totalProposedAllocation: 0,
      adjustments: [],
      warnings: ['אין יעדים עם auto-adjust מופעל'],
      summary: 'לא נדרשת התאמה',
    };
  }

  // חשב הקצאות נוכחיות
  const currentAllocations = await calculateOptimalAllocations({
    userId: incomeChange.userId,
    monthlyIncome: incomeChange.oldIncome,
  });

  // חשב הקצאות מוצעות
  const proposedAllocations = await calculateOptimalAllocations({
    userId: incomeChange.userId,
    monthlyIncome: incomeChange.newIncome,
  });

  // צור רשימת התאמות
  const adjustments: AdjustmentProposal[] = [];
  let totalCurrentAllocation = 0;
  let totalProposedAllocation = 0;

  for (const goal of goals) {
    const current = currentAllocations.allocations.find(a => a.goal_id === goal.id);
    const proposed = proposedAllocations.allocations.find(a => a.goal_id === goal.id);

    if (current && proposed) {
      const changeAmount = proposed.monthly_allocation - current.monthly_allocation;
      const changePercent = (changeAmount / current.monthly_allocation) * 100;

      totalCurrentAllocation += current.monthly_allocation;
      totalProposedAllocation += proposed.monthly_allocation;

      adjustments.push({
        goalId: goal.id,
        goalName: goal.name,
        currentAllocation: current.monthly_allocation,
        proposedAllocation: proposed.monthly_allocation,
        changeAmount,
        changePercent,
        reason: changeAmount > 0 ? 'הגדלה בעקבות עלייה בהכנסה' : 'הקטנה בעקבות ירידה בהכנסה',
      });
    }
  }

  // צור warnings
  const warnings: string[] = [];
  if (incomeChange.changePercent < 0) {
    warnings.push('⚠️ הכנסה ירדה - יעדים עשויים להתעכב');
  }
  if (proposedAllocations.warnings) {
    warnings.push(...proposedAllocations.warnings);
  }

  // צור סיכום
  const summary = incomeChange.changePercent > 0
    ? `ההכנסה עלתה ב-${Math.abs(incomeChange.changePercent).toFixed(1)}%! מציע להגדיל הקצאות ב-${totalProposedAllocation - totalCurrentAllocation} ₪/חודש`
    : `ההכנסה ירדה ב-${Math.abs(incomeChange.changePercent).toFixed(1)}%. מציע להקטין הקצאות ב-${Math.abs(totalProposedAllocation - totalCurrentAllocation)} ₪/חודש`;

  return {
    totalCurrentAllocation,
    totalProposedAllocation,
    adjustments,
    warnings,
    summary,
  };
}

/**
 * שליחת הצעת התאמה ל-WhatsApp
 */
async function sendAdjustmentProposal(
  phone: string,
  plan: AdjustmentPlan,
  incomeChange: IncomeChange
): Promise<void> {
  const greenAPI = getGreenAPIClient();

  const changeIcon = incomeChange.changePercent > 0 ? '📈' : '📉';
  const changeText = incomeChange.changePercent > 0 ? 'עלתה' : 'ירדה';

  let message = `${changeIcon} *שינוי בהכנסה זוהה!*\n\n`;
  message += `ההכנסה החודשית שלך ${changeText} מ-${incomeChange.oldIncome.toLocaleString('he-IL')} ₪ `;
  message += `ל-${incomeChange.newIncome.toLocaleString('he-IL')} ₪ `;
  message += `(${Math.abs(incomeChange.changePercent).toFixed(1)}%)\n\n`;

  message += `💡 *φ ממליץ על התאמת היעדים:*\n\n`;

  for (const adj of plan.adjustments) {
    const arrow = adj.changeAmount > 0 ? '⬆️' : '⬇️';
    message += `${arrow} *${adj.goalName}*\n`;
    message += `   מ-${adj.currentAllocation.toLocaleString('he-IL')} ₪ `;
    message += `ל-${adj.proposedAllocation.toLocaleString('he-IL')} ₪ `;
    message += `(${adj.changeAmount > 0 ? '+' : ''}${adj.changeAmount.toLocaleString('he-IL')} ₪)\n\n`;
  }

  message += `📊 *סיכום:*\n`;
  message += `${plan.summary}\n\n`;

  if (plan.warnings.length > 0) {
    message += `⚠️ *שים לב:*\n`;
    for (const warning of plan.warnings) {
      message += `• ${warning}\n`;
    }
    message += `\n`;
  }

  message += `*האם לאשר את ההתאמות?*\n`;
  message += `• כתוב *"אשר"* ליישום השינויים\n`;
  message += `• כתוב *"לא"* לביטול\n`;
  message += `• כתוב *"פרטים"* למידע נוסף\n\n`;
  message += `φ *Phi - היחס הזהב של הכסף שלך*`;

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message,
  });
}

/**
 * אישור והחלת התאמות
 */
export async function confirmAndApplyAdjustments(
  userId: string,
  phone: string
): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  try {
    // שלוף תוכנית ההתאמה
    const { data: userData } = await supabase
      .from('users')
      .select('classification_context')
      .eq('id', userId)
      .single();

    const autoAdjustContext = userData?.classification_context?.autoAdjust;

    if (!autoAdjustContext || !autoAdjustContext.pending) {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: '❌ לא נמצאה תוכנית התאמה ממתינה.',
      });
      return;
    }

    const plan: AdjustmentPlan = autoAdjustContext.plan;

    // החל התאמות
    for (const adj of plan.adjustments) {
      await supabase
        .from('goals')
        .update({ monthly_allocation: adj.proposedAllocation })
        .eq('id', adj.goalId);
    }

    // עדכן הכנסה
    const incomeChange: IncomeChange = autoAdjustContext.incomeChange;
    await supabase
      .from('users')
      .update({ monthly_income: incomeChange.newIncome })
      .eq('id', userId);

    // נקה context
    await supabase
      .from('users')
      .update({
        classification_context: {
          autoAdjust: null,
        },
      })
      .eq('id', userId);

    // שלח אישור
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `✅ *ההתאמות בוצעו בהצלחה!*\n\n` +
        `עדכנתי את היעדים שלך בהתאם להכנסה החדשה.\n` +
        `כתוב *"יעדים"* לראות את ההקצאות המעודכנות.\n\n` +
        `φ *Phi - מתאים את עצמו לך*`,
    });
  } catch (error) {
    console.error('Error applying adjustments:', error);
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: '❌ שגיאה בביצוע ההתאמות. נסה שוב מאוחר יותר.',
    });
  }
}

/**
 * ביטול התאמות
 */
export async function cancelAdjustments(
  userId: string,
  phone: string
): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  await supabase
    .from('users')
    .update({
      classification_context: {
        autoAdjust: null,
      },
    })
    .eq('id', userId);

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `✅ ההתאמות בוטלו.\n\n` +
      `ההקצאות יישארו כפי שהיו. תוכל תמיד לעדכן ידנית דרך *"עריכת יעד"*.\n\n` +
      `φ *Phi - כאן בשבילך*`,
  });
}
