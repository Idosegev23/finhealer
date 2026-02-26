/**
 * מטפל מתקדם ליצירת יעדים - תומך בכל סוגי היעדים והשדות החדשים
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { chatWithGeminiFlashMinimal } from '@/lib/ai/gemini-client';
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
 * 🆕 ניסיון פרסור חכם של טקסט חופשי ליעד
 * מחלץ: שם, סוג, סכום, מועד מתוך משפט טבעי
 */
async function trySmartGoalParse(msg: string): Promise<{
  goalType: GoalType;
  goalName: string;
  goalGroup?: string;
  targetAmount?: number;
  deadline?: string;
} | null> {
  // 1. Rule-based extraction first (fast)
  const msgLower = msg.toLowerCase().trim();

  // Extract amount from text
  let amount: number | undefined;
  const amountMatch = msg.match(/(\d[\d,]*\.?\d*)\s*(אלף|k|שקל|ש״ח|₪)?/i);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (amountMatch[2] && (amountMatch[2] === 'אלף' || amountMatch[2].toLowerCase() === 'k')) {
      amount *= 1000;
    }
  }

  // Extract deadline from text
  let deadline: string | undefined;
  const deadlineMatch = msg.match(/(?:עוד|בעוד|תוך)\s+(\d+)\s*(חודשים?|שנים?|שנה)/);
  if (deadlineMatch) {
    const num = parseInt(deadlineMatch[1]);
    const unit = deadlineMatch[2];
    const d = new Date();
    if (unit.includes('שנ')) {
      d.setFullYear(d.getFullYear() + num);
    } else {
      d.setMonth(d.getMonth() + num);
    }
    deadline = d.toISOString().split('T')[0];
  }

  // Try to match goal type from keywords
  const typeMatches: Array<{ keywords: RegExp; type: GoalType; name: string; group?: string }> = [
    { keywords: /קרן חירום|חירום/, type: 'emergency_fund', name: 'קרן חירום' },
    { keywords: /חובות|הלוואה|debt/, type: 'debt_payoff', name: 'סגירת חובות' },
    { keywords: /שיפוץ|שדרוג דירה/, type: 'renovation', name: 'שיפוץ דירה', group: 'נדל״ן' },
    { keywords: /נכס|דירה להשקעה/, type: 'real_estate_investment', name: 'נכס להשקעה', group: 'נדל״ן' },
    { keywords: /רכב|אוטו|מכונית|car/, type: 'vehicle', name: 'רכב', group: 'רכבים' },
    { keywords: /חופשה|טיול|vacation/, type: 'vacation', name: 'חופשה', group: 'בילויים' },
    { keywords: /חיסכון לילד|לילד/, type: 'child_savings', name: 'חיסכון לילד', group: 'ילדים' },
    { keywords: /משפחתי|משפחה/, type: 'family_savings', name: 'חיסכון משפחתי', group: 'משפחה' },
    { keywords: /חתונה|wedding/, type: 'wedding', name: 'חתונה', group: 'אירועים' },
    { keywords: /לימודים|education|קורס|תואר/, type: 'education', name: 'לימודים', group: 'חינוך' },
    { keywords: /פנסיה|pension|פרישה/, type: 'pension_increase', name: 'הגדלת פנסיה', group: 'פנסיה וחיסכון' },
  ];

  for (const tm of typeMatches) {
    if (tm.keywords.test(msgLower)) {
      return {
        goalType: tm.type,
        goalName: tm.name,
        goalGroup: tm.group,
        targetAmount: amount,
        deadline,
      };
    }
  }

  // 2. If rule-based didn't match a type but has amount, try AI (with 3s timeout)
  if (msg.length > 5) {
    try {
      const aiPromise = chatWithGeminiFlashMinimal(
        `המשתמש רוצה ליצור יעד חיסכון. הודעתו: "${msg}"\n\nחלץ JSON:\n{"goalName": "שם קצר ליעד", "goalType": "savings_goal|vehicle|vacation|renovation|education|wedding|emergency_fund|debt_payoff", "amount": number|null, "months": number|null}`,
        'אתה מחלץ פרטי יעד חיסכון מטקסט חופשי בעברית. החזר JSON בלבד, ללא markdown.'
      );
      const timeout = new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000));
      const aiResult = await Promise.race([aiPromise, timeout]);

      const parsed = JSON.parse(aiResult.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
      if (parsed.goalName) {
        let deadlineFromAI: string | undefined;
        if (parsed.months && parsed.months > 0) {
          const d = new Date();
          d.setMonth(d.getMonth() + parsed.months);
          deadlineFromAI = d.toISOString().split('T')[0];
        }

        const matchedType = GOAL_TYPES_EXTENDED[parsed.goalType];
        return {
          goalType: matchedType ? parsed.goalType : 'savings_goal',
          goalName: parsed.goalName,
          goalGroup: matchedType?.group,
          targetAmount: parsed.amount || amount,
          deadline: deadlineFromAI || deadline,
        };
      }
    } catch {
      // AI failed, continue to number matching
    }
  }

  return null;
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
  let smartAmount: number | undefined;
  let smartDeadline: string | undefined;

  // 🆕 First try smart parsing from natural language
  const smartResult = await trySmartGoalParse(msg);
  if (smartResult) {
    goalType = smartResult.goalType;
    goalName = smartResult.goalName;
    goalGroup = smartResult.goalGroup || null;
    smartAmount = smartResult.targetAmount;
    smartDeadline = smartResult.deadline;
    requiresChild = goalType === 'child_savings';
  }

  // Fallback: number-based selection
  if (!goalType) {
    const msgLower = msg.toLowerCase().trim();
    if (msg === '1') { goalType = 'emergency_fund'; goalName = 'קרן חירום'; }
    else if (msg === '2') { goalType = 'debt_payoff'; goalName = 'סגירת חובות'; }
    else if (msg === '3') { goalType = 'renovation'; goalName = 'שיפוץ דירה'; goalGroup = 'נדל״ן'; }
    else if (msg === '4') { goalType = 'real_estate_investment'; goalName = 'נכס להשקעה'; goalGroup = 'נדל״ן'; }
    else if (msg === '5') { goalType = 'vehicle'; goalName = 'רכב חדש'; goalGroup = 'רכבים'; }
    else if (msg === '6') { goalType = 'vacation'; goalName = 'חופשה משפחתית'; goalGroup = 'בילויים'; }
    else if (msg === '7') { goalType = 'child_savings'; goalName = 'חיסכון לילד'; goalGroup = 'ילדים'; requiresChild = true; }
    else if (msg === '8') { goalType = 'family_savings'; goalName = 'חיסכון משפחתי'; goalGroup = 'משפחה'; }
    else if (msg === '9') { goalType = 'wedding'; goalName = 'חתונה'; goalGroup = 'אירועים'; }
    else if (msg === '10') { goalType = 'education'; goalName = 'לימודים'; goalGroup = 'חינוך'; }
    else if (msg === '11') { goalType = 'pension_increase'; goalName = 'הגדלת פנסיה'; goalGroup = 'פנסיה וחיסכון'; }
    else if (msg === '12') { goalType = 'savings_goal'; goalName = 'חיסכון למטרה'; }
    else if (msg === '13') { goalType = 'general_improvement'; goalName = 'שיפור תקציבי'; }
    else {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `❌ לא הבנתי.\n\nתוכל לכתוב בחופשיות, למשל:\n` +
          `• *"חופשה 10000 שקל"*\n` +
          `• *"רכב בעוד שנה"*\n` +
          `• *"חיסכון לילדים 50000"*\n\n` +
          `או לבחור מספר (1-13).`,
      });
      return false;
    }
  }

  // 🆕 If smart parse got amount+deadline, skip straight to confirm
  if (smartAmount && smartAmount > 0 && !requiresChild) {
    const ctx: AdvancedGoalContext = {
      step: 'confirm',
      goalType: goalType!,
      goalName: goalName!,
      goalGroup: goalGroup || undefined,
      targetAmount: smartAmount,
      deadline: smartDeadline,
    };

    await mergeClassificationContext(userId, { advancedGoalCreation: ctx });
    await confirmAndCreateGoal(userId, phone, ctx);
    return true;
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

  // 🔧 Validate required fields before insert
  const goalName = context.goalName || context.goalType || 'יעד חדש';
  const targetAmount = context.targetAmount || 0;

  if (!goalName || targetAmount <= 0) {
    console.error('[Advanced Goals] Missing required fields:', { goalName, targetAmount, context });
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❌ חסרים פרטים ליעד.\n\n` +
        (!goalName ? `• שם היעד חסר\n` : '') +
        (targetAmount <= 0 ? `• סכום היעד חסר\n` : '') +
        `\nכתוב *"יעד חדש"* להתחיל שוב.`,
    });
    // Clean context
    await cleanAdvancedGoalContext(userId);
    return;
  }

  // Build insert payload with only defined fields
  const insertPayload: Record<string, any> = {
    user_id: userId,
    name: goalName,
    target_amount: targetAmount,
    current_amount: 0,
    priority: context.priority || 5,
    status: 'active',
    is_flexible: true,
    min_allocation: 0,
    monthly_allocation: 0,
    auto_adjust: true,
  };

  // Add optional fields only if defined
  if (context.goalType) insertPayload.goal_type = context.goalType;
  if (context.deadline) insertPayload.deadline = context.deadline;
  if (context.budgetSource) insertPayload.budget_source = context.budgetSource;
  if (context.fundingNotes) insertPayload.funding_notes = context.fundingNotes;
  if (context.childId) insertPayload.child_id = context.childId;
  if (context.goalGroup) insertPayload.goal_group = context.goalGroup;

  console.log('[Advanced Goals] Inserting goal:', JSON.stringify(insertPayload));

  const { error } = await supabase
    .from('goals')
    .insert(insertPayload);

  if (error) {
    console.error('[Advanced Goals] Error creating goal:', error, 'payload:', JSON.stringify(insertPayload));
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❌ שגיאה בשמירת היעד.\n\n` +
        `פרטים: ${error.message || 'שגיאת מסד נתונים'}\n\n` +
        `כתוב *"יעד חדש"* לנסות שוב.`,
    });
    await cleanAdvancedGoalContext(userId);
    return;
  }

  await cleanAdvancedGoalContext(userId);

  const emoji = GOAL_TYPES_EXTENDED[context.goalType!]?.emoji || '🎯';

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `✅ *נוצר בהצלחה!*\n\n` +
      `${emoji} *${goalName}*\n` +
      `💰 ${targetAmount.toLocaleString('he-IL')} ₪\n\n` +
      `φ תחשב הקצאה אוטומטית בקרוב!\n\n` +
      `• כתוב *"יעד חדש"* להוסיף עוד\n` +
      `• כתוב *"יעדים"* לראות הקצאות\n` +
      `• כתוב *"סיימתי"* להמשיך`,
  });
}

/**
 * ניקוי context של יצירת יעד
 */
async function cleanAdvancedGoalContext(userId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: existingUser } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const existingCtx = existingUser?.classification_context || {};
  const { advancedGoalCreation: _removed, ...restCtx } = existingCtx as any;

  await supabase
    .from('users')
    .update({
      classification_context: Object.keys(restCtx).length > 0 ? restCtx : null
    })
    .eq('id', userId);
}
