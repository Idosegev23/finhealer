/**
 * טיפוסים למערכת שקלול יעדים (φ Goals Balancer)
 */

export type GoalType = 
  | 'emergency_fund'           // קרן חירום
  | 'debt_payoff'              // סגירת חובות
  | 'savings_goal'             // חיסכון למטרה
  | 'general_improvement'      // שיפור כללי
  | 'retirement'               // פנסיה
  | 'education'                // לימודים
  | 'home_purchase'            // רכישת דירה
  | 'vehicle'                  // רכב
  | 'vacation'                 // חופשה
  | 'wedding'                  // חתונה
  | 'renovation'               // שיפוץ דירה
  | 'real_estate_investment'   // רכישת נכס להשקעה
  | 'pension_increase'         // הגדלת פנסיה
  | 'child_savings'            // חיסכון לילד
  | 'family_savings'           // חיסכון משפחתי
  | 'other';                   // אחר

export type BudgetSource =
  | 'income'           // הכנסה שוטפת
  | 'bonus'            // בונוס
  | 'sale'             // מכירת נכס
  | 'inheritance'      // ירושה
  | 'planned_savings'  // חיסכון מתוכנן
  | 'other';           // אחר

export type GoalStatus = 'active' | 'completed' | 'cancelled' | 'paused';

export type AllocationReason =
  | 'initial_calculation'
  | 'income_increased'
  | 'income_decreased'
  | 'priority_changed'
  | 'deadline_approaching'
  | 'goal_added'
  | 'goal_removed'
  | 'manual_adjustment'
  | 'rebalance';

export type IncomeForecastBasis =
  | 'historical_average'
  | 'declared'
  | 'seasonal_pattern'
  | 'trending_up'
  | 'trending_down'
  | 'manual_override';

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  goal_type?: GoalType;
  target_amount: number;
  current_amount: number;
  start_date?: Date;
  deadline?: Date;
  priority: number; // 1-10 (1 = הכי חשוב)
  status: GoalStatus;
  description?: string;
  child_name?: string;
  
  // שדות חדשים - מימון ותלויות
  budget_source?: BudgetSource;
  funding_notes?: string;
  child_id?: string; // קישור לטבלת children
  depends_on_goal_id?: string; // תלות ביעד אחר
  goal_group?: string; // קיבוץ לוגי (ילדים, נדל״ן, רכבים)
  milestones?: GoalMilestoneData[]; // אבני דרך שהושגו
  
  // שדות למנוע השקלול
  is_flexible: boolean;
  min_allocation: number;
  monthly_allocation: number;
  auto_adjust: boolean;
  metadata?: GoalMetadata;
  
  created_at: Date;
  updated_at: Date;
}

export interface GoalMetadata {
  calculation_reason?: string;
  dependencies?: string[]; // IDs של יעדים תלויים
  notes?: string;
  category?: string;
  urgency_override?: number;
  max_allocation?: number;
}

export interface GoalMilestoneData {
  percent: number; // 25, 50, 75, 100
  reached_at: string;
  celebrated: boolean;
}

export interface GoalMilestone {
  id: string;
  goal_id: string;
  percent_reached: number;
  amount_reached: number;
  reached_at: Date;
  celebrated: boolean;
  celebration_sent_at?: Date;
  notes?: string;
  created_at: Date;
}

export interface GoalWithDependencies extends Goal {
  depends_on_goal_name?: string;
  depends_on_goal_status?: GoalStatus;
  depends_on_current_amount?: number;
  depends_on_target_amount?: number;
  can_start: boolean;
  milestones_reached: number;
  milestone_history?: GoalMilestoneData[];
}

export interface GoalAllocationInput {
  userId: string;
  goals?: Goal[]; // אם לא מסופק, נשלוף מהDB
  monthlyIncome?: number; // אם רוצים לסמלץ תרחיש
  fixedExpenses?: number;
  minimumLivingBudget?: number;
  safetyMarginPercent?: number; // ברירת מחדל: 10%
}

export interface GoalAllocation {
  goal_id: string;
  goal_name: string;
  target_amount: number;
  current_amount: number;
  remaining_amount: number;
  monthly_allocation: number;
  previous_allocation?: number;
  months_to_complete: number;
  expected_completion_date: Date;
  urgency_score: number;
  allocation_percent: number; // אחוז מכלל ההקצאה ליעדים
  reason: string;
  is_achievable: boolean;
  warnings: string[];
}

export interface GoalAllocationResult {
  allocations: GoalAllocation[];
  summary: AllocationSummary;
  warnings: string[];
  suggestions: Suggestion[];
  safetyCheck: SafetyCheck;
}

export interface AllocationSummary {
  total_income: number;
  fixed_expenses: number;
  minimum_living: number;
  safety_margin: number;
  available_for_goals: number;
  total_allocated: number;
  remaining_budget: number;
  total_goals: number;
  achievable_goals: number;
}

export interface SafetyCheck {
  passed: boolean;
  remaining_for_life: number;
  minimum_required: number;
  comfort_level: 'critical' | 'tight' | 'comfortable' | 'excellent';
  message?: string;
}

export interface UrgencyCalculation {
  goal_id: string;
  priority_score: number;      // 0-1 (מעדיפות)
  time_proximity_score: number; // 0-1 (קרוב לדדליין)
  progress_gap_score: number;   // 0-1 (רחוק מהמטרה)
  urgency_score: number;        // ציון מסכם
}

export type SuggestionType = 'increase_income' | 'reduce_expenses' | 'adjust_deadline' | 'change_priority' | 'remove_goal' | 'add_goal';

export interface Suggestion {
  type: SuggestionType;
  goal_id?: string;
  message: string;
  impact: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AllocationHistory {
  id: string;
  user_id: string;
  goal_id: string;
  calculation_date: Date;
  monthly_allocation: number;
  previous_allocation?: number;
  reason: AllocationReason;
  confidence_score: number;
  metadata?: {
    algorithm_version?: string;
    total_budget?: number;
    competing_goals_count?: number;
  };
  created_at: Date;
}

export interface IncomeForecast {
  id: string;
  user_id: string;
  month: Date;
  forecasted_income: number;
  confidence_score: number;
  based_on: IncomeForecastBasis;
  variance_range?: number;
  metadata?: {
    months_of_data?: number;
    seasonal_factors?: Record<string, number>;
    trend_direction?: 'up' | 'down' | 'stable';
  };
  created_at: Date;
  updated_at: Date;
}

export interface SimulationScenario {
  type: 'income_change' | 'expense_change' | 'new_goal' | 'remove_goal' | 'priority_change';
  income_change?: number; // סכום שינוי בהכנסה (+ או -)
  expense_change?: number;
  new_goal?: Partial<Goal>;
  remove_goal_id?: string;
  priority_changes?: Array<{ goal_id: string; new_priority: number }>;
}

export interface SimulationResult {
  scenario: SimulationScenario;
  before: GoalAllocationResult;
  after: GoalAllocationResult;
  impact_summary: {
    goals_improved: number;
    goals_worsened: number;
    total_time_saved_months: number;
    recommendation: string;
  };
}

