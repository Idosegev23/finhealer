/**
 * GoalService - Centralized goal management
 *
 * All goal CRUD operations, progress tracking, and summary calculations.
 * Used by both WhatsApp (phi-router) and dashboard (API routes).
 */

import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export type GoalStatus = 'active' | 'completed' | 'cancelled';
export type GoalType = 'emergency_fund' | 'debt_payoff' | 'savings_goal' | 'general_improvement';

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  goal_type: GoalType;
  target_amount: number;
  current_amount: number;
  monthly_allocation: number;
  deadline: string | null;
  priority: number;
  status: GoalStatus;
  child_name?: string;
  created_at: string;
}

export interface GoalSummary {
  activeGoals: number;
  totalTarget: number;
  totalSaved: number;
  totalMonthlyAllocation: number;
  overallProgress: number; // 0-100
}

export interface GoalProgress {
  goal: Goal;
  progress: number; // 0-100
  monthsLeft: number | null;
  monthlyNeeded: number | null;
  onTrack: boolean;
}

// ============================================================================
// CRUD
// ============================================================================

/**
 * Get all active goals for a user
 */
export async function getActiveGoals(userId: string): Promise<Goal[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('priority', { ascending: false });

  return (data || []) as Goal[];
}

/**
 * Get a single goal by ID
 */
export async function getGoal(goalId: string): Promise<Goal | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .single();

  return data as Goal | null;
}

/**
 * Create a new goal
 */
export async function createGoal(
  userId: string,
  data: {
    name: string;
    goal_type: GoalType;
    target_amount: number;
    monthly_allocation?: number;
    deadline?: string;
    priority?: number;
    child_name?: string;
  }
): Promise<Goal> {
  const supabase = createServiceClient();

  // Get existing goals count for default priority
  const existing = await getActiveGoals(userId);
  const defaultPriority = existing.length + 1;

  const { data: goal, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      name: data.name,
      goal_type: data.goal_type,
      target_amount: data.target_amount,
      current_amount: 0,
      monthly_allocation: data.monthly_allocation || 0,
      deadline: data.deadline || null,
      priority: data.priority || defaultPriority,
      status: 'active',
      child_name: data.child_name || null,
    })
    .select()
    .single();

  if (error) throw error;
  return goal as Goal;
}

/**
 * Update goal progress (add deposit)
 */
export async function addDeposit(goalId: string, amount: number): Promise<Goal> {
  const supabase = createServiceClient();

  const goal = await getGoal(goalId);
  if (!goal) throw new Error('Goal not found');

  const newAmount = goal.current_amount + amount;
  const isCompleted = newAmount >= goal.target_amount;

  const { data: updated, error } = await supabase
    .from('goals')
    .update({
      current_amount: newAmount,
      status: isCompleted ? 'completed' : 'active',
    })
    .eq('id', goalId)
    .select()
    .single();

  if (error) throw error;
  return updated as Goal;
}

/**
 * Cancel a goal
 */
export async function cancelGoal(goalId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('goals')
    .update({ status: 'cancelled' })
    .eq('id', goalId);
}

/**
 * Update monthly allocation
 */
export async function setAllocation(goalId: string, amount: number): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('goals')
    .update({ monthly_allocation: amount })
    .eq('id', goalId);
}

// ============================================================================
// Summaries & Progress
// ============================================================================

/**
 * Get summary of all active goals
 */
export async function getSummary(userId: string): Promise<GoalSummary> {
  const goals = await getActiveGoals(userId);

  const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);
  const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0);
  const totalMonthlyAllocation = goals.reduce((sum, g) => sum + (g.monthly_allocation || 0), 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return {
    activeGoals: goals.length,
    totalTarget,
    totalSaved,
    totalMonthlyAllocation,
    overallProgress,
  };
}

/**
 * Get detailed progress for each goal
 */
export async function getGoalProgress(userId: string): Promise<GoalProgress[]> {
  const goals = await getActiveGoals(userId);

  return goals.map(goal => {
    const progress = goal.target_amount > 0
      ? Math.round((goal.current_amount / goal.target_amount) * 100)
      : 0;

    let monthsLeft: number | null = null;
    let monthlyNeeded: number | null = null;
    let onTrack = true;

    if (goal.deadline) {
      const deadline = new Date(goal.deadline);
      const now = new Date();
      monthsLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));

      const remaining = goal.target_amount - goal.current_amount;
      monthlyNeeded = monthsLeft > 0 ? Math.round(remaining / monthsLeft) : remaining;
      onTrack = goal.monthly_allocation >= monthlyNeeded;
    }

    return { goal, progress, monthsLeft, monthlyNeeded, onTrack };
  });
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create text-based progress bar
 */
export function createProgressBar(percent: number): string {
  const filled = Math.round(Math.min(100, Math.max(0, percent)) / 10);
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}

/**
 * Format goal list as Hebrew text (for WhatsApp)
 */
export function formatGoalList(goals: Goal[]): string {
  if (goals.length === 0) {
    return `📋 *היעדים שלך:*\n\nאין עדיין יעדים מוגדרים.\n\nכתוב *"יעד חדש"* להתחיל!`;
  }

  let message = `📋 *היעדים שלך:*\n\n`;

  for (let i = 0; i < goals.length; i++) {
    const goal = goals[i];
    const progress = goal.target_amount > 0
      ? Math.round((goal.current_amount / goal.target_amount) * 100)
      : 0;
    const bar = createProgressBar(progress);

    message += `${i + 1}. *${goal.name}*\n`;
    message += `   ${bar} ${progress}%\n`;
    message += `   ${goal.current_amount.toLocaleString('he-IL')}/${goal.target_amount.toLocaleString('he-IL')} ₪\n`;

    if (goal.deadline) {
      const deadline = new Date(goal.deadline);
      const now = new Date();
      const monthsLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
      message += `   📅 נשארו ${monthsLeft} חודשים\n`;
    }

    message += `\n`;
  }

  message += `*סה"כ: ${goals.length} יעדים*`;
  return message;
}
