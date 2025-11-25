/**
 * Goals Management Flow - ניהול יעדים פיננסיים
 * 
 * שלב 4 בתוכנית ההבראה:
 * - הגדרת יעדים ברורים
 * - חישוב חיסכון נדרש
 * - התאמת תקציב
 * - מעקב התקדמות
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

interface GoalsFlowContext {
  userId: string;
  currentStep: 'start' | 'type' | 'amount' | 'deadline' | 'review' | 'adjust' | 'complete';
  goalData?: {
    name?: string;
    type?: string;
    targetAmount?: number;
    deadline?: Date;
    monthlyRequired?: number;
    priority?: number;
  };
  existingGoals?: Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    deadline: Date;
    monthlyRequired: number;
  }>;
  availableSavings?: number;
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleGoalsManagement(
  context: GoalsFlowContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  // אתחול context אם צריך
  if (!context.existingGoals) {
    context.existingGoals = await getExistingGoals(context.userId);
  }
  if (!context.availableSavings) {
    context.availableSavings = await getAvailableSavings(context.userId);
  }
  
  switch (context.currentStep) {
    case 'start':
      return await handleStartStep(context, message);
    case 'type':
      return await handleTypeStep(context, message);
    case 'amount':
      return await handleAmountStep(context, message);
    case 'deadline':
      return await handleDeadlineStep(context, message);
    case 'review':
      return await handleReviewStep(context, message);
    case 'adjust':
      return await handleAdjustStep(context, message);
    default:
      return await handleStartStep(context, message);
  }
}

// ============================================================================
// שלב 1: התחלה
// ============================================================================

async function handleStartStep(
  context: GoalsFlowContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  // בדוק אם יש יעדים קיימים
  if (context.existingGoals && context.existingGoals.length > 0) {
    let msg = `יש לך ${context.existingGoals.length} יעדים פעילים:\n\n`;
    
    for (const goal of context.existingGoals) {
      const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100);
      msg += `🎯 ${goal.name}\n`;
      msg += `   ${formatCurrency(goal.currentAmount)} / ${formatCurrency(goal.targetAmount)} (${progress}%)\n`;
      msg += `   עד: ${formatDate(goal.deadline)}\n\n`;
    }
    
    msg += `מה תרצה לעשות?\n• להוסיף יעד חדש\n• לראות התקדמות\n• לעדכן יעד קיים`;
    
    return {
      response: msg,
      completed: false,
      requiresAction: {
        type: 'set_context',
        data: { currentStep: 'type' },
      },
    };
  }
  
  // אין יעדים - התחל מאפס
  return {
    response: `בוא נגדיר יעד! 🎯\n\nלמה אתה רוצה לחסוך?\n\n💡 רעיונות:\n• רכב חדש 🚗\n• טיול/חופשה ✈️\n• דירה/דמי עצמי 🏠\n• חתונה 💒\n• קרן חירום 🛡️\n• לימודים 📚\n• השקעה 📈\n• אחר`,
    completed: false,
    requiresAction: {
      type: 'set_context',
      data: { currentStep: 'type', goalData: {} },
    },
  };
}

// ============================================================================
// שלב 2: סוג היעד
// ============================================================================

async function handleTypeStep(
  context: GoalsFlowContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  const lowerMessage = message.toLowerCase();
  
  // בדיקה אם רוצה לראות התקדמות או לעדכן
  if (lowerMessage.includes('התקדמות')) {
    return {
      response: formatProgressSummary(context.existingGoals!),
      completed: false,
    };
  }
  
  if (lowerMessage.includes('עדכן')) {
    return {
      response: `איזה יעד תרצה לעדכן?\n\n${context.existingGoals!.map((g, i) => `${i + 1}. ${g.name}`).join('\n')}`,
      completed: false,
      requiresAction: {
        type: 'set_context',
        data: { currentStep: 'adjust' },
      },
    };
  }
  
  // זיהוי סוג היעד
  const goalType = identifyGoalType(message);
  
  if (!goalType) {
    return {
      response: `לא הבנתי... מה היעד שלך?\n\n(תוכל לכתוב בחופשיות, למשל: "רכב", "חופשה באיטליה", "דירה")`,
      completed: false,
    };
  }
  
  context.goalData = {
    name: goalType.name,
    type: goalType.type,
  };
  
  return {
    response: `${goalType.emoji} מעולה! ${goalType.name}\n\nכמה כסף צריך?`,
    completed: false,
    requiresAction: {
      type: 'set_context',
      data: { currentStep: 'amount' },
    },
  };
}

// ============================================================================
// שלב 3: סכום
// ============================================================================

async function handleAmountStep(
  context: GoalsFlowContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  const amount = extractAmount(message);
  
  if (!amount || amount <= 0) {
    return {
      response: `לא הבנתי את הסכום...\nכמה צריך? (מספר בלבד)`,
      completed: false,
    };
  }
  
  context.goalData!.targetAmount = amount;
  
  return {
    response: `${formatCurrency(amount)} 💰\n\nמתי תרצה להגיע ליעד?\n\nלדוגמה:\n• "בעוד שנה"\n• "בעוד 6 חודשים"\n• "עד דצמבר 2026"`,
    completed: false,
    requiresAction: {
      type: 'set_context',
      data: { currentStep: 'deadline' },
    },
  };
}

// ============================================================================
// שלב 4: תאריך יעד
// ============================================================================

async function handleDeadlineStep(
  context: GoalsFlowContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  const deadline = parseDeadline(message);
  
  if (!deadline) {
    return {
      response: `לא הבנתי את הזמן...\n\nתוכל לכתוב:\n• "בעוד X חודשים"\n• "בעוד X שנים"\n• "עד חודש/שנה"`,
      completed: false,
    };
  }
  
  context.goalData!.deadline = deadline;
  
  // חישוב חיסכון חודשי נדרש
  const monthsUntil = Math.max(1, Math.ceil((deadline.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)));
  const monthlyRequired = Math.ceil(context.goalData!.targetAmount! / monthsUntil);
  context.goalData!.monthlyRequired = monthlyRequired;
  
  // הצג סיכום ובדוק כדאיות
  let response = `📊 סיכום היעד:\n\n`;
  response += `🎯 ${context.goalData!.name}\n`;
  response += `💰 ${formatCurrency(context.goalData!.targetAmount!)}\n`;
  response += `📅 עד ${formatDate(deadline)} (${monthsUntil} חודשים)\n`;
  response += `💵 צריך לחסוך: ${formatCurrency(monthlyRequired)}/חודש\n\n`;
  
  // בדוק אם ריאלי
  const availableSavings = context.availableSavings || 0;
  const totalRequiredWithExisting = calculateTotalRequired(context.existingGoals || []) + monthlyRequired;
  
  if (monthlyRequired > availableSavings) {
    response += `⚠️ שים לב:\n`;
    response += `החיסכון הנוכחי שלך: ${formatCurrency(availableSavings)}/חודש\n`;
    response += `נדרש: ${formatCurrency(monthlyRequired)}/חודש\n\n`;
    response += `💡 אפשרויות:\n`;
    response += `1️⃣ להאריך ל-${Math.ceil(context.goalData!.targetAmount! / availableSavings)} חודשים\n`;
    response += `2️⃣ להגדיל חיסכון ב-${formatCurrency(monthlyRequired - availableSavings)}\n`;
    response += `3️⃣ להקטין את היעד\n\n`;
    response += `מה מתאים לך?`;
    
    return {
      response,
      completed: false,
      requiresAction: {
        type: 'set_context',
        data: { currentStep: 'review' },
      },
    };
  }
  
  response += `✅ זה ריאלי! החיסכון הנוכחי שלך מספיק.\n\nלאשר?`;
  
  return {
    response,
    completed: false,
    requiresAction: {
      type: 'set_context',
      data: { currentStep: 'review' },
    },
  };
}

// ============================================================================
// שלב 5: סקירה ואישור
// ============================================================================

async function handleReviewStep(
  context: GoalsFlowContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  const lowerMessage = message.toLowerCase();
  
  // אפשרות 1 - להאריך
  if (lowerMessage.includes('להאריך') || lowerMessage.includes('1') || lowerMessage.includes('אפשרות 1')) {
    const availableSavings = context.availableSavings || 1000;
    const newMonths = Math.ceil(context.goalData!.targetAmount! / availableSavings);
    const newDeadline = new Date();
    newDeadline.setMonth(newDeadline.getMonth() + newMonths);
    
    context.goalData!.deadline = newDeadline;
    context.goalData!.monthlyRequired = availableSavings;
    
    return {
      response: `עדכנתי! 📅\n\nתאריך יעד חדש: ${formatDate(newDeadline)}\nחיסכון חודשי: ${formatCurrency(availableSavings)}\n\nמתאים?`,
      completed: false,
    };
  }
  
  // אפשרות 2 - להגדיל חיסכון
  if (lowerMessage.includes('להגדיל') || lowerMessage.includes('2') || lowerMessage.includes('אפשרות 2')) {
    return {
      response: `כדי להגדיל חיסכון, צריך לשנות את התקציב.\n\nרוצה שאציע לך איפה אפשר לצמצם?`,
      completed: false,
      requiresAction: {
        type: 'redirect_to_budget',
        data: { reason: 'increase_savings', amount: context.goalData!.monthlyRequired },
      },
    };
  }
  
  // אפשרות 3 - להקטין יעד
  if (lowerMessage.includes('להקטין') || lowerMessage.includes('3') || lowerMessage.includes('אפשרות 3')) {
    return {
      response: `כמה תרצה להקטין את היעד?`,
      completed: false,
      requiresAction: {
        type: 'set_context',
        data: { currentStep: 'amount' },
      },
    };
  }
  
  // אישור
  if (isApproval(message)) {
    const success = await saveGoal(context.userId, context.goalData!);
    
    if (success) {
      return {
        response: `🎉 היעד נשמר!\n\n🎯 ${context.goalData!.name}\n💰 ${formatCurrency(context.goalData!.targetAmount!)}\n📅 עד ${formatDate(context.goalData!.deadline!)}\n💵 ${formatCurrency(context.goalData!.monthlyRequired!)}/חודש\n\nאני אעקוב ואעדכן אותך כל חודש על ההתקדמות! 📊`,
        completed: true,
        requiresAction: {
          type: 'goal_created',
          data: context.goalData,
        },
      };
    } else {
      return {
        response: `סליחה, משהו השתבש בשמירה 😕\nתוכל לנסות שוב?`,
        completed: false,
      };
    }
  }
  
  // ברירת מחדל
  return {
    response: `מה אתה מחליט?\n\n• "מאשר" - לשמור את היעד\n• "לשנות" - לעשות שינויים`,
    completed: false,
  };
}

// ============================================================================
// שלב 6: עדכון יעד קיים
// ============================================================================

async function handleAdjustStep(
  context: GoalsFlowContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  // זהה איזה יעד לעדכן
  const goalIndex = parseInt(message) - 1;
  
  if (!isNaN(goalIndex) && context.existingGoals && context.existingGoals[goalIndex]) {
    const goal = context.existingGoals[goalIndex];
    
    return {
      response: `מה תרצה לעשות עם "${goal.name}"?\n\n• להפקיד כסף (הגעתי ליעד!)\n• לשנות סכום יעד\n• לשנות תאריך\n• למחוק יעד`,
      completed: false,
      requiresAction: {
        type: 'set_context',
        data: { 
          currentStep: 'adjust',
          goalData: {
            id: goal.id,
            name: goal.name,
            targetAmount: goal.targetAmount,
            deadline: goal.deadline,
          }
        },
      },
    };
  }
  
  // חפש בטקסט
  for (const goal of context.existingGoals || []) {
    if (message.toLowerCase().includes(goal.name.toLowerCase())) {
      return {
        response: `מה תרצה לעשות עם "${goal.name}"?\n\n• להפקיד כסף\n• לשנות סכום יעד\n• לשנות תאריך\n• למחוק יעד`,
        completed: false,
        requiresAction: {
          type: 'set_context',
          data: { 
            currentStep: 'adjust',
            goalData: {
              id: goal.id,
              name: goal.name,
              targetAmount: goal.targetAmount,
              deadline: goal.deadline,
            }
          },
        },
      };
    }
  }
  
  return {
    response: `לא הבנתי איזה יעד...\n\n${context.existingGoals!.map((g, i) => `${i + 1}. ${g.name}`).join('\n')}\n\nכתוב את המספר או השם`,
    completed: false,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL')}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

function isApproval(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('מאשר') || lower.includes('כן') || lower.includes('אוקיי') || 
         lower.includes('מסכים') || lower.includes('מתאים') || lower.includes('בסדר');
}

function extractAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, '');
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

interface GoalType {
  name: string;
  type: string;
  emoji: string;
}

function identifyGoalType(message: string): GoalType | null {
  const lower = message.toLowerCase();
  
  const types: Record<string, GoalType> = {
    'רכב': { name: 'רכב חדש', type: 'car', emoji: '🚗' },
    'מכונית': { name: 'רכב חדש', type: 'car', emoji: '🚗' },
    'אוטו': { name: 'רכב חדש', type: 'car', emoji: '🚗' },
    'חופשה': { name: 'חופשה', type: 'vacation', emoji: '✈️' },
    'טיול': { name: 'טיול', type: 'vacation', emoji: '✈️' },
    'דירה': { name: 'דירה', type: 'apartment', emoji: '🏠' },
    'בית': { name: 'בית', type: 'apartment', emoji: '🏠' },
    'דמי עצמי': { name: 'דמי עצמי לדירה', type: 'apartment', emoji: '🏠' },
    'חתונה': { name: 'חתונה', type: 'wedding', emoji: '💒' },
    'קרן חירום': { name: 'קרן חירום', type: 'emergency', emoji: '🛡️' },
    'לימודים': { name: 'לימודים', type: 'education', emoji: '📚' },
    'השקעה': { name: 'השקעה', type: 'investment', emoji: '📈' },
  };
  
  for (const [keyword, goalType] of Object.entries(types)) {
    if (lower.includes(keyword)) {
      return goalType;
    }
  }
  
  // אם לא זיהינו - השתמש בטקסט כשם
  if (message.length > 2 && message.length < 50) {
    return { name: message.trim(), type: 'custom', emoji: '🎯' };
  }
  
  return null;
}

function parseDeadline(message: string): Date | null {
  const lower = message.toLowerCase();
  const now = new Date();
  
  // חפש "בעוד X חודשים/שנים"
  const monthsMatch = lower.match(/בעוד\s*(\d+)\s*(חודש|חודשים)/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1]);
    const deadline = new Date(now);
    deadline.setMonth(deadline.getMonth() + months);
    return deadline;
  }
  
  const yearsMatch = lower.match(/בעוד\s*(\d+)\s*(שנה|שנים)/);
  if (yearsMatch) {
    const years = parseInt(yearsMatch[1]);
    const deadline = new Date(now);
    deadline.setFullYear(deadline.getFullYear() + years);
    return deadline;
  }
  
  // חפש "עד [חודש] [שנה]"
  const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
                        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  
  for (let i = 0; i < hebrewMonths.length; i++) {
    if (lower.includes(hebrewMonths[i])) {
      const yearMatch = message.match(/20\d\d/);
      const year = yearMatch ? parseInt(yearMatch[0]) : now.getFullYear() + 1;
      return new Date(year, i, 1);
    }
  }
  
  // מספר בלבד - מניחים חודשים
  const numberMatch = message.match(/\d+/);
  if (numberMatch) {
    const num = parseInt(numberMatch[0]);
    if (num > 0 && num <= 120) {
      const deadline = new Date(now);
      deadline.setMonth(deadline.getMonth() + num);
      return deadline;
    }
  }
  
  return null;
}

function calculateTotalRequired(goals: Array<{ monthlyRequired: number }>): number {
  return goals.reduce((sum, g) => sum + g.monthlyRequired, 0);
}

function formatProgressSummary(goals: Array<{ name: string; targetAmount: number; currentAmount: number; deadline: Date }>): string {
  let msg = `📊 **התקדמות יעדים:**\n\n`;
  
  for (const goal of goals) {
    const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100);
    const remaining = goal.targetAmount - goal.currentAmount;
    
    msg += `🎯 **${goal.name}**\n`;
    msg += `   ${createProgressBar(progress)}\n`;
    msg += `   ${formatCurrency(goal.currentAmount)} / ${formatCurrency(goal.targetAmount)} (${progress}%)\n`;
    msg += `   נשאר: ${formatCurrency(remaining)}\n`;
    msg += `   עד: ${formatDate(goal.deadline)}\n\n`;
  }
  
  return msg;
}

function createProgressBar(percentage: number): string {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

// ============================================================================
// Database Operations
// ============================================================================

async function getExistingGoals(userId: string): Promise<Array<any>> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('priority', { ascending: true });
  
  return (data || []).map(g => ({
    id: g.id,
    name: g.name,
    targetAmount: g.target_amount,
    currentAmount: g.current_amount || 0,
    deadline: new Date(g.deadline || g.target_date),
    monthlyRequired: g.monthly_required || 0,
  }));
}

async function getAvailableSavings(userId: string): Promise<number> {
  const supabase = await createClient();
  
  // Get from current budget
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  const { data: budget } = await supabase
    .from('budgets')
    .select('savings_goal')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .single();
  
  if (budget?.savings_goal) {
    return budget.savings_goal;
  }
  
  // Fallback: estimate from income - expenses
  const { data: profile } = await supabase
    .from('user_financial_profile')
    .select('monthly_income, rent_mortgage, insurance, pension_funds, education, other_fixed')
    .eq('user_id', userId)
    .single();
  
  if (profile) {
    const income = profile.monthly_income || 0;
    const fixed = (profile.rent_mortgage || 0) + (profile.insurance || 0) + 
                  (profile.pension_funds || 0) + (profile.education || 0) + 
                  (profile.other_fixed || 0);
    return Math.max(0, Math.round((income - fixed) * 0.2)); // 20% of available
  }
  
  return 0;
}

async function saveGoal(userId: string, goalData: any): Promise<boolean> {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        name: goalData.name,
        target_amount: goalData.targetAmount,
        current_amount: 0,
        deadline: goalData.deadline.toISOString(),
        target_date: goalData.deadline.toISOString(),
        monthly_required: goalData.monthlyRequired,
        status: 'active',
        priority: goalData.priority || 1,
        created_at: new Date().toISOString(),
      });
    
    if (error) throw error;
    
    // Update user phase if first goal
    await supabase
      .from('users')
      .update({ phase: 'goals' })
      .eq('id', userId);
    
    return true;
  } catch (error) {
    console.error('Failed to save goal:', error);
    return false;
  }
}

export default {
  handleGoalsManagement,
};

