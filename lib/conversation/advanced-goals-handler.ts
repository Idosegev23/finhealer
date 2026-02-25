/**
 * מטפל מתקדם ליצירת יעדים - תומך בכל סוגי היעדים והשדות החדשים
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import type { GoalType, BudgetSource, Goal } from '@/types/goals';

/**
 * עדכון classification_context בצורה בטוחה (merge, לא overwrite)
 */
async function mergeClassificationContext(
  userId: string,
  update: Record<string, any>
): Promise<void> {
  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const existing = user?.classification_context || {};

  await supabase
    .from('users')
    .update({
      classification_context: { ...existing, ...update }
    })
    .eq('id', userId);
}

export interface AdvancedGoalContext {
  step: 'type' | 'name' | 'amount' | 'deadline' | 'priority' | 'budget_source' | 'child' | 'confirm';
  goalType?: GoalType;
  goalName?: string;
  targetAmount?: number;
  deadline?: string;
  priority?: number;
  budgetSource?: BudgetSource;
  childId?: string;
  fundingNotes?: string;
  goalGroup?: string;
}

export const GOAL_TYPES_EXTENDED: Record<string, { 
  value: GoalType;
  name: string;
  emoji: string;
  description: string;
  requiresChild?: boolean;
  group?: string;
}> = {
  'emergency_fund': {
    value: 'emergency_fund',
    name: 'קרן חירום',
    emoji: '🛡️',
    description: '3-6 חודשי הוצאות'
  },
  'debt_payoff': {
    value: 'debt_payoff',
    name: 'סגירת חובות',
    emoji: '💳',
    description: 'הפחתת חוב'
  },
  'savings_goal': {
    value: 'savings_goal',
    name: 'חיסכון למטרה',
    emoji: '🎯',
    description: 'מטרה כללית'
  },
  'vehicle': {
    value: 'vehicle',
    name: 'רכב',
    emoji: '🚗',
    description: 'רכישת/החלפת רכב',
    group: 'רכבים'
  },
  'vacation': {
    value: 'vacation',
    name: 'חופשה',
    emoji: '✈️',
    description: 'חופשה משפחתית',
    group: 'בילויים'
  },
  'renovation': {
    value: 'renovation',
    name: 'שיפוץ דירה',
    emoji: '🏠',
    description: 'שיפוץ/שדרוג דירה',
    group: 'נדל״ן'
  },
  'real_estate_investment': {
    value: 'real_estate_investment',
    name: 'נכס להשקעה',
    emoji: '🏘️',
    description: 'רכישת נכס להשקעה',
    group: 'נדל״ן'
  },
  'pension_increase': {
    value: 'pension_increase',
    name: 'הגדלת פנסיה',
    emoji: '📈',
    description: 'חיסכון פנסיוני נוסף',
    group: 'פנסיה וחיסכון'
  },
  'child_savings': {
    value: 'child_savings',
    name: 'חיסכון לילד',
    emoji: '👶',
    description: 'חיסכון עבור ילד',
    requiresChild: true,
    group: 'ילדים'
  },
  'family_savings': {
    value: 'family_savings',
    name: 'חיסכון משפחתי',
    emoji: '👨\u200d👩\u200d👧\u200d👦',
    description: 'חיסכון משפחתי כללי',
    group: 'משפחה'
  },
  'education': {
    value: 'education',
    name: 'לימודים',
    emoji: '📚',
    description: 'לימודים/השכלה',
    group: 'חינוך'
  },
  'wedding': {
    value: 'wedding',
    name: 'חתונה',
    emoji: '💒',
    description: 'חתונה/אירוע משפחתי',
    group: 'אירועים'
  },
  'general_improvement': {
    value: 'general_improvement',
    name: 'שיפור כללי',
    emoji: '⚖️',
    description: 'איזון תקציבי כללי'
  },
};

/**
 * התחל יצירת יעד מתקדם
 */
export async function startAdvancedGoal(
  userId: string,
  phone: string
): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  await mergeClassificationContext(userId, {
    advancedGoalCreation: { step: 'type' as const }
  });

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `🎯 *יעד חדש*\n\n` +
      `בחר סוג יעד:\n\n` +
      `*🛡️ בסיס:*\n` +
      `1️⃣ קרן חירום\n` +
      `2️⃣ סגירת חובות\n\n` +
      `*🏠 נדל״ן:*\n` +
      `3️⃣ שיפוץ דירה\n` +
      `4️⃣ נכס להשקעה\n\n` +
      `*🚗 רכבים:*\n` +
      `5️⃣ רכב חדש\n\n` +
      `*👨\u200d👩\u200d👧 משפחה:*\n` +
      `6️⃣ חופשה\n` +
      `7️⃣ חיסכון לילד\n` +
      `8️⃣ חיסכון משפחתי\n` +
      `9️⃣ חתונה\n\n` +
      `*📚 חינוך:*\n` +
      `🔟 לימודים\n\n` +
      `*📈 פנסיה:*\n` +
      `1️⃣1️⃣ הגדלת פנסיה\n\n` +
      `*אחר:*\n` +
      `1️⃣2️⃣ חיסכון למטרה כללית\n` +
      `1️⃣3️⃣ שיפור תקציבי כללי\n\n` +
      `כתוב מספר או שם היעד:`,
  });
}

/**
 * טיפול בבחירת סוג יעד מתקדם
 */
export async function handleAdvancedGoalTypeSelection(
  userId: string,
  phone: string,
  msg: string
): Promise<boolean> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  let goalType: GoalType | null = null;
  let goalName: string | null = null;
  let goalGroup: string | null = null;
  let requiresChild = false;

  // זיהוי לפי מספר
  const msgLower = msg.toLowerCase().trim();
  if (msg === '1' || msgLower.includes('קרן חירום') || msgLower.includes('חירום')) {
    goalType = 'emergency_fund';
    goalName = 'קרן חירום';
  } else if (msg === '2' || msgLower.includes('חובות') || msgLower.includes('debt')) {
    goalType = 'debt_payoff';
    goalName = 'סגירת חובות';
  } else if (msg === '3' || msgLower.includes('שיפוץ')) {
    goalType = 'renovation';
    goalName = 'שיפוץ דירה';
    goalGroup = 'נדל״ן';
  } else if (msg === '4' || msgLower.includes('נכס') || msgLower.includes('השקעה')) {
    goalType = 'real_estate_investment';
    goalName = 'נכס להשקעה';
    goalGroup = 'נדל״ן';
  } else if (msg === '5' || msgLower.includes('רכב') || msgLower.includes('car')) {
    goalType = 'vehicle';
    goalName = 'רכב חדש';
    goalGroup = 'רכבים';
  } else if (msg === '6' || msgLower.includes('חופשה') || msgLower.includes('vacation')) {
    goalType = 'vacation';
    goalName = 'חופשה משפחתית';
    goalGroup = 'בילויים';
  } else if (msg === '7' || msgLower.includes('חיסכון לילד') || msgLower.includes('לילד')) {
    goalType = 'child_savings';
    goalName = 'חיסכון לילד';
    goalGroup = 'ילדים';
    requiresChild = true;
  } else if (msg === '8' || msgLower.includes('משפחתי')) {
    goalType = 'family_savings';
    goalName = 'חיסכון משפחתי';
    goalGroup = 'משפחה';
  } else if (msg === '9' || msgLower.includes('חתונה') || msgLower.includes('wedding')) {
    goalType = 'wedding';
    goalName = 'חתונה';
    goalGroup = 'אירועים';
  } else if (msg === '10' || msgLower.includes('לימודים') || msgLower.includes('education')) {
    goalType = 'education';
    goalName = 'לימודים';
    goalGroup = 'חינוך';
  } else if (msg === '11' || msgLower.includes('פנסיה') || msgLower.includes('pension')) {
    goalType = 'pension_increase';
    goalName = 'הגדלת פנסיה';
    goalGroup = 'פנסיה וחיסכון';
  } else if (msg === '12' || msgLower.includes('חיסכון')) {
    goalType = 'savings_goal';
    goalName = 'חיסכון למטרה';
  } else if (msg === '13' || msgLower.includes('שיפור') || msgLower.includes('איזון')) {
    goalType = 'general_improvement';
    goalName = 'שיפור תקציבי';
  } else {
    // לא זוהה - נראה אם זה טקסט חופשי
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❌ לא הבנתי.\n\nכתוב מספר (1-13) או שם היעד.`,
    });
    return false;
  }

  // אם צריך לבחור ילד - נבקש
  if (requiresChild) {
    const { data: children } = await supabase
      .from('children')
      .select('id, name, birth_date')
      .eq('user_id', userId);

    if (!children || children.length === 0) {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `👶 *חיסכון לילד*\n\n` +
          `לא רשומים ילדים במערכת.\n\n` +
          `מה שם הילד?`,
      });

      await mergeClassificationContext(userId, {
        advancedGoalCreation: {
          step: 'child',
          goalType,
          goalName,
          goalGroup
        }
      });

      return true;
    } else if (children.length === 1) {
      // ילד אחד - נשתמש בו אוטומטית
      await mergeClassificationContext(userId, {
        advancedGoalCreation: {
          step: 'amount',
          goalType,
          goalName: `חיסכון ל${children[0].name}`,
          goalGroup,
          childId: children[0].id
        }
      });

      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `👶 *חיסכון ל${children[0].name}*\n\n` +
          `כמה תרצה לחסוך?\n(כתוב סכום בשקלים)`,
      });

      return true;
    } else {
      // יותר מילד אחד - נבקש לבחור
      let childrenList = children.map((c, i) => `${i + 1}️⃣ ${c.name}`).join('\n');

      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `👶 *חיסכון לילד*\n\n` +
          `לאיזה ילד?\n\n${childrenList}\n\nכתוב מספר או שם:`,
      });

      await mergeClassificationContext(userId, {
        advancedGoalCreation: {
          step: 'child',
          goalType,
          goalName,
          goalGroup,
          children: children.map(c => ({ id: c.id, name: c.name }))
        }
      });

      return true;
    }
  }

  // המשך לשלב הבא (סכום)
  await mergeClassificationContext(userId, {
    advancedGoalCreation: {
      step: 'amount',
      goalType,
      goalName,
      goalGroup
    }
  });

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `${GOAL_TYPES_EXTENDED[goalType]?.emoji || '🎯'} *${goalName}*\n\n` +
      `כמה כסף צריך ליעד הזה?\n(כתוב סכום בשקלים)`,
  });

  return true;
}

/**
 * טיפול בבחירת ילד
 */
export async function handleChildSelection(
  userId: string,
  phone: string,
  msg: string,
  context: AdvancedGoalContext
): Promise<boolean> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const children = (context as any).children || [];

  let selectedChild: { id: string; name: string } | null = null;

  // נסה לזהות לפי מספר
  const num = parseInt(msg);
  if (!isNaN(num) && num >= 1 && num <= children.length) {
    selectedChild = children[num - 1];
  } else {
    // חיפוש לפי שם
    selectedChild = children.find((c: any) => 
      c.name.toLowerCase().includes(msg.toLowerCase()) ||
      msg.toLowerCase().includes(c.name.toLowerCase())
    );
  }

  if (!selectedChild) {
    // אולי זה שם ילד חדש?
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `לא מצאתי ילד בשם הזה. רוצה ליצור?\n\n• *"כן"* - צור ילד חדש\n• *"לא"* - בחר מהרשימה`,
    });
    return false;
  }

  // עדכן context עם הילד שנבחר
  await mergeClassificationContext(userId, {
    advancedGoalCreation: {
      ...context,
      step: 'amount',
      childId: selectedChild.id,
      goalName: `חיסכון ל${selectedChild.name}`
    }
  });

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `👶 *חיסכון ל${selectedChild.name}*\n\n` +
      `כמה תרצה לחסוך?\n(כתוב סכום בשקלים)`,
  });

  return true;
}

/**
 * שאל על מקור תקציב
 */
export async function askBudgetSource(
  userId: string,
  phone: string,
  context: AdvancedGoalContext
): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  await mergeClassificationContext(userId, {
    advancedGoalCreation: {
      ...context,
      step: 'budget_source'
    }
  });

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `💰 *מקור מימון*\n\n` +
      `מאיפה יגיע הכסף?\n\n` +
      `1️⃣ הכנסה שוטפת (חודשית)\n` +
      `2️⃣ בונוס/פרמיה\n` +
      `3️⃣ מכירת נכס\n` +
      `4️⃣ ירושה\n` +
      `5️⃣ חיסכון מתוכנן\n` +
      `6️⃣ אחר\n\n` +
      `כתוב מספר:`,
  });
}

/**
 * טיפול בבחירת מקור תקציב
 */
export async function handleBudgetSourceSelection(
  userId: string,
  phone: string,
  msg: string,
  context: AdvancedGoalContext
): Promise<boolean> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  let budgetSource: BudgetSource;
  let sourceName: string;

  if (msg === '1' || msg.toLowerCase().includes('הכנסה') || msg.toLowerCase().includes('חודש')) {
    budgetSource = 'income';
    sourceName = 'הכנסה שוטפת';
  } else if (msg === '2' || msg.toLowerCase().includes('בונוס') || msg.toLowerCase().includes('פרמיה')) {
    budgetSource = 'bonus';
    sourceName = 'בונוס';
  } else if (msg === '3' || msg.toLowerCase().includes('מכירה') || msg.toLowerCase().includes('נכס')) {
    budgetSource = 'sale';
    sourceName = 'מכירת נכס';
  } else if (msg === '4' || msg.toLowerCase().includes('ירושה')) {
    budgetSource = 'inheritance';
    sourceName = 'ירושה';
  } else if (msg === '5' || msg.toLowerCase().includes('חיסכון')) {
    budgetSource = 'planned_savings';
    sourceName = 'חיסכון מתוכנן';
  } else if (msg === '6' || msg.toLowerCase().includes('אחר')) {
    budgetSource = 'other';
    sourceName = 'אחר';
  } else {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❌ לא הבנתי. כתוב מספר 1-6.`,
    });
    return false;
  }

  // עדכן context ועבור לאישור סופי
  await mergeClassificationContext(userId, {
    advancedGoalCreation: {
      ...context,
      step: 'confirm',
      budgetSource,
      fundingNotes: sourceName
    }
  });

  await confirmAndCreateGoal(userId, phone, { ...context, budgetSource, fundingNotes: sourceName });

  return true;
}

/**
 * אישור סופי ויצירת יעד
 */
export async function confirmAndCreateGoal(
  userId: string,
  phone: string,
  context: AdvancedGoalContext
): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const emoji = GOAL_TYPES_EXTENDED[context.goalType!]?.emoji || '🎯';

  let summary = `${emoji} *סיכום היעד*\n\n`;
  summary += `📝 *שם:* ${context.goalName}\n`;
  summary += `💰 *סכום:* ${context.targetAmount?.toLocaleString('he-IL')} ₪\n`;
  if (context.deadline) {
    summary += `📅 *מועד:* ${context.deadline}\n`;
  }
  if (context.budgetSource) {
    summary += `💵 *מקור:* ${context.fundingNotes}\n`;
  }
  if (context.childId) {
    const { data: child } = await supabase
      .from('children')
      .select('name')
      .eq('id', context.childId)
      .single();
    if (child) {
      summary += `👶 *עבור:* ${child.name}\n`;
    }
  }
  summary += `\n✅ *אשר* ליצירה\n❌ *ביטול* לביטול`;

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: summary,
  });
}

/**
 * יצירת יעד בפועל
 */
export async function createAdvancedGoal(
  userId: string,
  phone: string,
  context: AdvancedGoalContext
): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // צור את היעד
  const { error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      name: context.goalName!,
      goal_type: context.goalType,
      target_amount: context.targetAmount || 0,
      current_amount: 0,
      deadline: context.deadline || null,
      priority: context.priority || 5,
      status: 'active',
      budget_source: context.budgetSource,
      funding_notes: context.fundingNotes,
      child_id: context.childId,
      goal_group: context.goalGroup,
      is_flexible: true,
      min_allocation: 0,
      monthly_allocation: 0,
      auto_adjust: true,
    });

  if (error) {
    console.error('[Advanced Goals] Error creating goal:', error);
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❌ שגיאה ביצירת היעד. נסה שוב.`,
    });
    return;
  }

  // נקה רק את advancedGoalCreation מה-context
  const { data: existingUser } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const existingCtx = existingUser?.classification_context || {};
  const { advancedGoalCreation, ...restCtx } = existingCtx as any;

  await supabase
    .from('users')
    .update({
      classification_context: Object.keys(restCtx).length > 0 ? restCtx : null
    })
    .eq('id', userId);

  const emoji = GOAL_TYPES_EXTENDED[context.goalType!]?.emoji || '🎯';

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `✅ *נוצר בהצלחה!*\n\n` +
      `${emoji} *${context.goalName}*\n` +
      `💰 ${context.targetAmount?.toLocaleString('he-IL')} ₪\n\n` +
      `φ תחשב הקצאה אוטומטית בקרוב!\n\n` +
      `• כתוב *"יעד חדש"* להוסיף עוד\n` +
      `• כתוב *"יעדים"* לראות הקצאות\n` +
      `• כתוב *"סיימתי"* להמשיך`,
  });
}
