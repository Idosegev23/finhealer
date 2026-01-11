/**
 * φ Goals Balancer - מנוע שקלול יעדים חכם
 * 
 * מחשב הקצאות תקציב אופטימליות ליעדים מרובים
 * תוך שמירה על "אוכל בצלחת" ושקיפות מלאה
 */

import { createServiceClient } from '@/lib/supabase/server';
import type {
  Goal,
  GoalAllocationInput,
  GoalAllocationResult,
  GoalAllocation,
  AllocationSummary,
  SafetyCheck,
  UrgencyCalculation,
  Suggestion,
  AllocationHistory,
} from '@/types/goals';

const ALGORITHM_VERSION = '1.0.0';
const DEFAULT_SAFETY_MARGIN_PERCENT = 10; // 10% מרווח ביטחון
const MINIMUM_COMFORT_PERCENT = 30; // 30% מההכנסה לאחר הוצאות קבועות
const MAX_GOAL_ALLOCATION_PERCENT = 40; // יעד בודד לא יכול לקבל יותר מ-40%

/**
 * פונקציה ראשית - מחשבת הקצאות אופטימליות
 */
export async function calculateOptimalAllocations(
  input: GoalAllocationInput
): Promise<GoalAllocationResult> {
  const supabase = createServiceClient();
  
  // שלב 1: שלוף או השתמש בנתונים שסופקו
  const userId = input.userId;
  let goals = input.goals;
  
  if (!goals) {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('priority', { ascending: true });
    
    if (error) throw new Error(`Failed to fetch goals: ${error.message}`);
    goals = data as Goal[];
  }
  
  if (!goals || goals.length === 0) {
    return {
      allocations: [],
      summary: createEmptySummary(),
      warnings: ['אין יעדים פעילים'],
      suggestions: [{
        type: 'add_goal',
        message: 'הוסף יעד חדש כדי להתחיל לחסוך',
        impact: 'תתחיל לעבוד על עתיד פיננסי מאורגן',
        priority: 'medium',
      }],
      safetyCheck: { passed: true, remaining_for_life: 0, minimum_required: 0, comfort_level: 'excellent' },
    };
  }
  
  // שלב 2: חשב הכנסות והוצאות
  const financialData = await calculateFinancialData(userId, input);
  
  // שלב 3: בדוק אם יש תקציב ליעדים
  if (financialData.available_for_goals <= 0) {
    return {
      allocations: [],
      summary: financialData,
      warnings: ['⚠️ אין תקציב זמין ליעדים - כל ההכנסה מוקצית להוצאות קבועות ומינימום מחיה'],
      suggestions: [
        {
          type: 'increase_income',
          message: 'שקול להגדיל הכנסות',
          impact: 'תוכל להתחיל לעבוד על יעדים פיננסיים',
          priority: 'high',
        },
        {
          type: 'reduce_expenses',
          message: 'בדוק אילו הוצאות ניתן להפחית',
          impact: 'כל ₪ שתחסוך יעזור לך להתחיל לצבור',
          priority: 'high',
        },
        {
          type: 'adjust_deadline',
          message: 'דחה יעדים לתקופה עתידית',
          impact: 'תפחית לחץ ותתקדם בהדרגה',
          priority: 'medium',
        },
      ],
      safetyCheck: {
        passed: false,
        remaining_for_life: financialData.remaining_budget,
        minimum_required: financialData.minimum_living,
        comfort_level: 'critical',
        message: 'אין תקציב זמין ליעדים',
      },
    };
  }
  
  // שלב 4: חשב urgency לכל יעד
  const urgencyScores = goals.map(goal => calculateUrgencyScore(goal));
  
  // שלב 5: הרץ אלגוריתם הקצאה אופטימלי
  const allocations = allocateOptimally(
    goals,
    urgencyScores,
    financialData.available_for_goals
  );
  
  // שלב 6: בדוק שנשאר "אוכל בצלחת"
  const totalAllocated = allocations.reduce((sum, a) => sum + a.monthly_allocation, 0);
  const safetyCheck = performSafetyCheck(
    financialData.total_income,
    financialData.fixed_expenses,
    totalAllocated,
    financialData.minimum_living
  );
  
  // שלב 7: צור המלצות
  const suggestions = generateSuggestions(goals, allocations, financialData, safetyCheck);
  
  // שלב 8: צור אזהרות
  const warnings = generateWarnings(allocations, safetyCheck);
  
  // סיכום
  const summary: AllocationSummary = {
    ...financialData,
    total_allocated: totalAllocated,
    remaining_budget: financialData.available_for_goals - totalAllocated,
    total_goals: goals.length,
    achievable_goals: allocations.filter(a => a.is_achievable).length,
  };
  
  return {
    allocations,
    summary,
    warnings,
    suggestions,
    safetyCheck,
  };
}

/**
 * חישוב נתונים פיננסיים
 */
async function calculateFinancialData(
  userId: string,
  input: GoalAllocationInput
): Promise<AllocationSummary> {
  const supabase = createServiceClient();
  
  // אם סופקו ערכים - השתמש בהם (למשל לסימולציה)
  if (input.monthlyIncome !== undefined && input.fixedExpenses !== undefined) {
    const total_income = input.monthlyIncome;
    const fixed_expenses = input.fixedExpenses;
    const minimum_living = input.minimumLivingBudget || total_income * 0.3;
    const safety_margin = total_income * ((input.safetyMarginPercent || DEFAULT_SAFETY_MARGIN_PERCENT) / 100);
    const available_for_goals = Math.max(0, total_income - fixed_expenses - minimum_living - safety_margin);
    
    return {
      total_income,
      fixed_expenses,
      minimum_living,
      safety_margin,
      available_for_goals,
      total_allocated: 0,
      remaining_budget: available_for_goals,
      total_goals: 0,
      achievable_goals: 0,
    };
  }
  
  // שלוף נתונים מהDB
  const { data: profile } = await supabase
    .from('user_financial_profile')
    .select('total_monthly_income, total_fixed_expenses')
    .eq('user_id', userId)
    .single();
  
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('user_id', userId)
    .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  
  // חשב ממוצעים
  let total_income = profile?.total_monthly_income || 0;
  let fixed_expenses = profile?.total_fixed_expenses || 0;
  
  // אם אין בפרופיל, חשב מתנועות
  if (total_income === 0 && transactions) {
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    
    total_income = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0) / 3; // ממוצע 3 חודשים
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0) / 3;
    fixed_expenses = totalExpenses * 0.6; // הערכה: 60% מההוצאות הן קבועות
  }
  
  const minimum_living = total_income * 0.3; // 30% מההכנסה
  const safety_margin = total_income * (DEFAULT_SAFETY_MARGIN_PERCENT / 100);
  const available_for_goals = Math.max(0, total_income - fixed_expenses - minimum_living - safety_margin);
  
  return {
    total_income,
    fixed_expenses,
    minimum_living,
    safety_margin,
    available_for_goals,
    total_allocated: 0,
    remaining_budget: available_for_goals,
    total_goals: 0,
    achievable_goals: 0,
  };
}

/**
 * חישוב ציון דחיפות (Urgency Score)
 * 
 * נוסחה: urgency = (priority × 0.4) + (timeProximity × 0.4) + (progressGap × 0.2)
 */
export function calculateUrgencyScore(goal: Goal): UrgencyCalculation {
  // Priority Score: 1-10 → 1-0 (1=urgent, 10=not urgent)
  const priority_score = 1 - ((goal.priority - 1) / 9);
  
  // Time Proximity: כמה קרוב לדדליין
  let time_proximity_score = 0.5; // ברירת מחדל אם אין deadline
  
  if (goal.deadline) {
    const now = new Date();
    const deadline = new Date(goal.deadline);
    const start = goal.start_date ? new Date(goal.start_date) : now;
    
    const totalTime = deadline.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const remaining = deadline.getTime() - now.getTime();
    
    if (remaining <= 0) {
      time_proximity_score = 1; // עבר הזמן!
    } else if (totalTime > 0) {
      time_proximity_score = elapsed / totalTime; // 0-1, ככל שקרוב יותר לסוף
    }
  }
  
  // Progress Gap: כמה רחוק מהמטרה
  const remaining_amount = goal.target_amount - goal.current_amount;
  const progress_gap_score = remaining_amount > 0 
    ? Math.min(1, remaining_amount / goal.target_amount)
    : 0;
  
  // חישוב מסכם
  const urgency_score = 
    (priority_score * 0.4) + 
    (time_proximity_score * 0.4) + 
    (progress_gap_score * 0.2);
  
  return {
    goal_id: goal.id,
    priority_score,
    time_proximity_score,
    progress_gap_score,
    urgency_score,
  };
}

/**
 * אלגוריתם הקצאה אופטימלי
 * Weighted Proportional Allocation with Minimum Guarantees
 */
function allocateOptimally(
  goals: Goal[],
  urgencyScores: UrgencyCalculation[],
  totalBudget: number
): GoalAllocation[] {
  const allocations: GoalAllocation[] = [];
  let remainingBudget = totalBudget;
  
  // סיבוב 1: הקצה מינימום מובטח
  for (const goal of goals) {
    if (goal.min_allocation > 0 && remainingBudget >= goal.min_allocation) {
      const allocation = Math.min(goal.min_allocation, remainingBudget);
      remainingBudget -= allocation;
      
      allocations.push(createAllocation(goal, allocation, urgencyScores));
    } else if (goal.min_allocation > 0) {
      // אין מספיק תקציב למינימום
      allocations.push(createAllocation(goal, 0, urgencyScores, false, ['תקציב לא מספיק למינימום מובטח']));
    }
  }
  
  // סיבוב 2: חלוקה לפי משקל urgency
  const goalsNeedingMore = goals.filter(g => {
    const existing = allocations.find(a => a.goal_id === g.id);
    const allocated = existing?.monthly_allocation || 0;
    const remaining = g.target_amount - g.current_amount;
    const monthsToDeadline = g.deadline 
      ? Math.max(1, Math.ceil((new Date(g.deadline).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)))
      : 12;
    const idealMonthly = remaining / monthsToDeadline;
    
    return allocated < idealMonthly && allocated < g.target_amount;
  });
  
  if (goalsNeedingMore.length > 0 && remainingBudget > 0) {
    const totalWeight = goalsNeedingMore.reduce((sum, g) => {
      const urgency = urgencyScores.find(u => u.goal_id === g.id)!;
      const flexibility = g.is_flexible ? 1 : 1.5; // יעדים לא גמישים מקבלים משקל גבוה יותר
      return sum + (urgency.urgency_score * flexibility);
    }, 0);
    
    for (const goal of goalsNeedingMore) {
      const urgency = urgencyScores.find(u => u.goal_id === goal.id)!;
      const flexibility = goal.is_flexible ? 1 : 1.5;
      const weight = (urgency.urgency_score * flexibility) / totalWeight;
      
      let additionalAllocation = weight * remainingBudget;
      
      // ודא שלא חורג מהנדרש
      const existing = allocations.find(a => a.goal_id === goal.id);
      const currentAllocation = existing?.monthly_allocation || 0;
      const remaining = goal.target_amount - goal.current_amount;
      const monthsToDeadline = goal.deadline
        ? Math.max(1, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)))
        : 12;
      const maxNeeded = remaining / monthsToDeadline;
      additionalAllocation = Math.min(additionalAllocation, maxNeeded - currentAllocation);
      
      // ודא שלא חורג מ-40% מכלל התקציב
      const maxAllowed = totalBudget * (MAX_GOAL_ALLOCATION_PERCENT / 100);
      additionalAllocation = Math.min(additionalAllocation, maxAllowed - currentAllocation);
      
      if (existing) {
        existing.monthly_allocation += additionalAllocation;
        updateAllocationMetrics(existing, goal);
      } else {
        allocations.push(createAllocation(goal, additionalAllocation, urgencyScores));
      }
    }
  }
  
  // טיפול ביעדים שלא קיבלו הקצאה
  for (const goal of goals) {
    if (!allocations.find(a => a.goal_id === goal.id)) {
      allocations.push(createAllocation(goal, 0, urgencyScores, false, ['אין תקציב זמין']));
    }
  }
  
  return allocations.sort((a, b) => b.urgency_score - a.urgency_score);
}

/**
 * יצירת אובייקט הקצאה
 */
function createAllocation(
  goal: Goal,
  monthly_allocation: number,
  urgencyScores: UrgencyCalculation[],
  is_achievable: boolean = true,
  warnings: string[] = []
): GoalAllocation {
  const urgency = urgencyScores.find(u => u.goal_id === goal.id)!;
  const remaining_amount = Math.max(0, goal.target_amount - goal.current_amount);
  const months_to_complete = monthly_allocation > 0 
    ? Math.ceil(remaining_amount / monthly_allocation)
    : Infinity;
  
  const expected_completion_date = monthly_allocation > 0
    ? new Date(Date.now() + months_to_complete * 30 * 24 * 60 * 60 * 1000)
    : new Date('2099-12-31');
  
  // בדוק אם ניתן להשיג בזמן
  if (goal.deadline && expected_completion_date > new Date(goal.deadline)) {
    is_achievable = false;
    warnings.push('לא ניתן להשלים בזמן עם ההקצאה הנוכחית');
  }
  
  return {
    goal_id: goal.id,
    goal_name: goal.name,
    target_amount: goal.target_amount,
    current_amount: goal.current_amount,
    remaining_amount,
    monthly_allocation,
    previous_allocation: goal.monthly_allocation,
    months_to_complete: isFinite(months_to_complete) ? months_to_complete : 0,
    expected_completion_date,
    urgency_score: urgency.urgency_score,
    allocation_percent: 0, // יעודכן אחר כך
    reason: monthly_allocation > (goal.monthly_allocation || 0) ? 'הקצאה גדלה' : 'הקצאה ראשונית',
    is_achievable,
    warnings,
  };
}

/**
 * עדכון מטריקות הקצאה
 */
function updateAllocationMetrics(allocation: GoalAllocation, goal: Goal): void {
  allocation.remaining_amount = Math.max(0, goal.target_amount - goal.current_amount);
  allocation.months_to_complete = allocation.monthly_allocation > 0
    ? Math.ceil(allocation.remaining_amount / allocation.monthly_allocation)
    : 0;
  allocation.expected_completion_date = allocation.monthly_allocation > 0
    ? new Date(Date.now() + allocation.months_to_complete * 30 * 24 * 60 * 60 * 1000)
    : new Date('2099-12-31');
  
  // בדוק achievability
  if (goal.deadline && allocation.expected_completion_date > new Date(goal.deadline)) {
    allocation.is_achievable = false;
    if (!allocation.warnings.includes('לא ניתן להשלים בזמן עם ההקצאה הנוכחית')) {
      allocation.warnings.push('לא ניתן להשלים בזמן עם ההקצאה הנוכחית');
    }
  }
}

/**
 * בדיקת "אוכל בצלחת"
 */
function performSafetyCheck(
  totalIncome: number,
  fixedExpenses: number,
  totalGoalAllocations: number,
  minimumLiving: number
): SafetyCheck {
  const remaining_for_life = totalIncome - fixedExpenses - totalGoalAllocations;
  const minimum_required = minimumLiving;
  
  let passed = false;
  let comfort_level: 'critical' | 'tight' | 'comfortable' | 'excellent' = 'critical';
  let message: string | undefined;
  
  const ratio = remaining_for_life / totalIncome;
  
  if (remaining_for_life < minimum_required * 0.5) {
    comfort_level = 'critical';
    message = '⚠️ אזהרה: נשאר מעט מדי כסף למחיה יומיומית!';
  } else if (remaining_for_life < minimum_required) {
    comfort_level = 'tight';
    message = '⚡ תקציב צמוד - שקול להפחית יעדים';
  } else if (ratio >= 0.3) {
    comfort_level = 'comfortable';
    passed = true;
  } else if (ratio >= 0.4) {
    comfort_level = 'excellent';
    passed = true;
  } else {
    comfort_level = 'tight';
    passed = true;
    message = 'תקציב מספיק אך צמוד';
  }
  
  return {
    passed,
    remaining_for_life,
    minimum_required,
    comfort_level,
    message,
  };
}

/**
 * ייצור המלצות
 */
function generateSuggestions(
  goals: Goal[],
  allocations: GoalAllocation[],
  financialData: AllocationSummary,
  safetyCheck: SafetyCheck
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  
  // המלצה להגדלת הכנסה
  const unachievableGoals = allocations.filter(a => !a.is_achievable);
  if (unachievableGoals.length > 0) {
    const totalNeeded = unachievableGoals.reduce((sum, a) => {
      const months = a.months_to_complete > 0 ? a.months_to_complete : 12;
      const needed = a.remaining_amount / months;
      return sum + (needed - a.monthly_allocation);
    }, 0);
    
    suggestions.push({
      type: 'increase_income',
      message: `אם תגדיל הכנסה ב-${Math.ceil(totalNeeded).toLocaleString('he-IL')} ₪, תוכל להשלים את כל היעדים בזמן`,
      impact: `${unachievableGoals.length} יעדים ייושלמו בזמן`,
      priority: 'high',
    });
  }
  
  // המלצה לתעדוף מחדש
  if (goals.length > 3 && safetyCheck.comfort_level === 'tight') {
    suggestions.push({
      type: 'change_priority',
      message: 'שקול להתמקד ב-2-3 יעדים עיקריים ולדחות את השאר',
      impact: 'תקדם מהר יותר ביעדים החשובים',
      priority: 'medium',
    });
  }
  
  // המלצה לדחיית תאריכים
  const urgentGoals = allocations.filter(a => a.urgency_score > 0.8 && !a.is_achievable);
  if (urgentGoals.length > 0) {
    for (const allocation of urgentGoals) {
      const goal = goals.find(g => g.id === allocation.goal_id);
      if (goal?.deadline) {
        const newDeadline = new Date(allocation.expected_completion_date);
        suggestions.push({
          type: 'adjust_deadline',
          goal_id: goal.id,
          message: `דחה את "${goal.name}" ל-${newDeadline.toLocaleDateString('he-IL')} כדי להפחית לחץ`,
          impact: 'יאפשר הקצאה נוחה יותר ליעדים אחרים',
          priority: 'medium',
        });
      }
    }
  }
  
  return suggestions;
}

/**
 * ייצור אזהרות
 */
function generateWarnings(
  allocations: GoalAllocation[],
  safetyCheck: SafetyCheck
): string[] {
  const warnings: string[] = [];
  
  if (!safetyCheck.passed) {
    warnings.push(safetyCheck.message || 'בעיית תקציב - נשאר מעט מדי למחיה');
  }
  
  const zeroAllocations = allocations.filter(a => a.monthly_allocation === 0);
  if (zeroAllocations.length > 0) {
    warnings.push(`${zeroAllocations.length} יעדים לא קיבלו הקצאה`);
  }
  
  const unachievable = allocations.filter(a => !a.is_achievable);
  if (unachievable.length > 0) {
    warnings.push(`⚠️ ${unachievable.length} יעדים לא ניתנים להשגה בתאריך היעד`);
  }
  
  return warnings;
}

/**
 * המלצות לשינוי עדיפויות
 */
export function suggestPriorityAdjustments(goals: Goal[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  
  // המלץ להעלות עדיפות לקרן חירום
  const emergencyFund = goals.find(g => g.goal_type === 'emergency_fund');
  if (emergencyFund && emergencyFund.priority > 2) {
    suggestions.push({
      type: 'change_priority',
      goal_id: emergencyFund.id,
      message: 'המלצה: העלה את קרן החירום לעדיפות 1 - זה הבסיס הפיננסי',
      impact: 'תבנה ביטחון פיננסי לפני השקעה ביעדים אחרים',
      priority: 'high',
    });
  }
  
  // המלץ להוריד עדיפות ליעדים ארוכי טווח
  const longTermGoals = goals.filter(g => {
    if (!g.deadline) return false;
    const months = (new Date(g.deadline).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000);
    return months > 24 && g.priority <= 3;
  });
  
  if (longTermGoals.length > 0) {
    suggestions.push({
      type: 'change_priority',
      message: `יש לך ${longTermGoals.length} יעדים ארוכי טווח בעדיפות גבוהה - שקול להוריד עדיפות`,
      impact: 'תאפשר התקדמות מהירה יותר ביעדים קצרי טווח',
      priority: 'medium',
    });
  }
  
  return suggestions;
}

/**
 * שמירת היסטוריית הקצאות
 */
export async function saveAllocationHistory(
  userId: string,
  allocations: GoalAllocation[],
  reason: string
): Promise<void> {
  const supabase = createServiceClient();
  
  const historyRecords: Partial<AllocationHistory>[] = allocations.map(allocation => ({
    user_id: userId,
    goal_id: allocation.goal_id,
    calculation_date: new Date(),
    monthly_allocation: allocation.monthly_allocation,
    previous_allocation: allocation.previous_allocation,
    reason: reason as any,
    confidence_score: 0.85, // יכול להיות מחושב
    metadata: {
      algorithm_version: ALGORITHM_VERSION,
      urgency_score: allocation.urgency_score,
    },
  }));
  
  const { error } = await supabase
    .from('goal_allocations_history')
    .insert(historyRecords);
  
  if (error) {
    console.error('Failed to save allocation history:', error);
  }
}

/**
 * עדכון הקצאות בטבלת goals
 */
export async function applyAllocations(allocations: GoalAllocation[]): Promise<void> {
  const supabase = createServiceClient();
  
  for (const allocation of allocations) {
    const { error } = await supabase
      .from('goals')
      .update({
        monthly_allocation: allocation.monthly_allocation,
        metadata: {
          last_calculation: new Date().toISOString(),
          urgency_score: allocation.urgency_score,
          is_achievable: allocation.is_achievable,
        },
      })
      .eq('id', allocation.goal_id);
    
    if (error) {
      console.error(`Failed to update goal ${allocation.goal_id}:`, error);
    }
  }
}

/**
 * סיכום ריק
 */
function createEmptySummary(): AllocationSummary {
  return {
    total_income: 0,
    fixed_expenses: 0,
    minimum_living: 0,
    safety_margin: 0,
    available_for_goals: 0,
    total_allocated: 0,
    remaining_budget: 0,
    total_goals: 0,
    achievable_goals: 0,
  };
}

