/**
 * PhaseService - Centralized phase management
 *
 * Consolidates all phase logic:
 * - Phase calculation based on data span
 * - Phase transitions (upgrade/set)
 * - State management (onboarding_state)
 * - Hebrew labels and progress
 */

import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export type Phase = 'data_collection' | 'behavior' | 'budget' | 'goals' | 'monitoring';

export type OnboardingState =
  | 'start'
  | 'waiting_for_name'
  | 'waiting_for_document'
  | 'classification'
  | 'classification_income'
  | 'classification_expense'
  | 'behavior'
  | 'goals'
  | 'goals_setup'
  | 'budget'
  | 'monitoring'
  | 'loan_consolidation_offer'
  | 'waiting_for_loan_docs';

export interface PhaseInfo {
  phase: Phase;
  number: number;
  name: string;
  daysOfData: number;
  daysUntilNext: number;
  progress: number; // 0-100
}

// ============================================================================
// Constants
// ============================================================================

// Canonical phase order — Goals BEFORE Budget (per Gadi's PHI_PHASES_CORRECT_FLOW.md):
// "יעדים לפני תקציב! צריך לדעת את היעדים כדי לבנות תקציב שתומך בהם."
const PHASE_ORDER: Phase[] = ['data_collection', 'behavior', 'goals', 'budget', 'monitoring'];

// Gating combines BOTH data-gating (enough transactions / statements) AND time-gating
// (enough calendar time elapsed since signup). A user must satisfy both to advance.
// Time prevents an "all 6 months uploaded on day 1" user from skipping the emotional
// arc; data prevents a user with thin data from getting budget recommendations from noise.
const PHASE_THRESHOLDS: Record<Phase, { minDays: number; minDaysSinceSignup: number; minTx: number }> = {
  data_collection: { minDays: 0, minDaysSinceSignup: 0, minTx: 0 },
  behavior:        { minDays: 14, minDaysSinceSignup: 14, minTx: 60 },
  goals:           { minDays: 60, minDaysSinceSignup: 30, minTx: 100 },  // 2+ months of data + 30 days of using the bot
  budget:          { minDays: 60, minDaysSinceSignup: 30, minTx: 100 },  // gate is "has at least 1 goal" — see calculatePhase
  monitoring:      { minDays: 60, minDaysSinceSignup: 30, minTx: 100 },  // gate is "has active budget" — see calculatePhase
};

const PHASE_NAMES: Record<Phase, string> = {
  data_collection: 'איסוף נתונים',
  behavior: 'ניתוח דפוסים',
  goals: 'הגדרת יעדים',
  budget: 'תקציב מבוסס יעדים',
  monitoring: 'מעקב רציף',
};

const STATE_LABELS: Record<string, string> = {
  start: 'התחלה',
  waiting_for_name: 'המתנה לשם',
  waiting_for_document: 'המתנה למסמך',
  classification: 'סיווג תנועות',
  classification_income: 'סיווג הכנסות',
  classification_expense: 'סיווג הוצאות',
  goals_setup: 'הגדרת יעדים',
  behavior: 'ניתוח התנהגות',
  goals: 'ניהול יעדים',
  budget: 'תקציב',
  monitoring: 'ניטור',
  loan_consolidation_offer: 'איחוד הלוואות',
  waiting_for_loan_docs: 'המתנה למסמכי הלוואה',
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get number of days covered by user's confirmed transaction data (span, not count)
 */
export async function getDaysOfData(userId: string): Promise<number> {
  const supabase = createServiceClient();

  const { data: transactions } = await supabase
    .from('transactions')
    .select('tx_date')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .order('tx_date', { ascending: false });

  if (!transactions || transactions.length === 0) return 0;

  const uniqueDates = new Set(transactions.map(t => t.tx_date));
  const dates = Array.from(uniqueDates).sort();
  const oldest = new Date(dates[0]);
  const newest = new Date(dates[dates.length - 1]);
  const diffDays = Math.ceil(Math.abs(newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24));

  return diffDays + 1;
}

/**
 * Number of days since the user signed up.
 */
async function getDaysSinceSignup(userId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('created_at')
    .eq('id', userId)
    .single();
  if (!user?.created_at) return 0;
  const ms = Date.now() - new Date(user.created_at).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Calculate the appropriate phase for a user. Combined data-gating + time-gating.
 *
 * Order: data_collection → behavior → goals → budget → monitoring (Goals BEFORE Budget per Gadi).
 *
 * Gates (BOTH conditions must hold to advance):
 *  - data_collection → behavior:  ≥14 days of data AND ≥14 days since signup AND ≥60 transactions
 *  - behavior → goals:            ≥60 days of data AND ≥30 days since signup AND ≥100 transactions
 *  - goals → budget:              all of the above AND ≥1 active goal
 *  - budget → monitoring:         active budget exists
 */
export async function calculatePhase(userId: string): Promise<Phase> {
  const supabase = createServiceClient();

  const [days, signupDays, txCountResult, budgetCountResult, goalCountResult] = await Promise.all([
    getDaysOfData(userId),
    getDaysSinceSignup(userId),
    supabase.from('transactions').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'confirmed'),
    supabase.from('budgets').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).in('status', ['active', 'warning', 'exceeded']),
    supabase.from('goals').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'active'),
  ]);

  const txCount = txCountResult.count || 0;
  const budgetCount = budgetCountResult.count || 0;
  const goalCount = goalCountResult.count || 0;

  const beh = PHASE_THRESHOLDS.behavior;
  const tgt = PHASE_THRESHOLDS.goals;

  // Data + time floor for behavior analysis
  if (days < beh.minDays || signupDays < beh.minDaysSinceSignup || txCount < beh.minTx) {
    return 'data_collection';
  }

  // monitoring trumps the rest — once a budget is active we're past goals/budget setup
  if (budgetCount > 0) return 'monitoring';

  // Behavior → Goals gate
  if (days < tgt.minDays || signupDays < tgt.minDaysSinceSignup || txCount < tgt.minTx) {
    return 'behavior';
  }

  // Goals → Budget gate: at least one active goal must exist
  if (goalCount === 0) return 'goals';

  // Budget setup phase (no active budget yet, but has goals)
  return 'budget';
}

/**
 * Get full phase info for a user
 */
export async function getPhaseInfo(userId: string): Promise<PhaseInfo> {
  const supabase = createServiceClient();
  const daysOfData = await getDaysOfData(userId);

  const { data: user } = await supabase
    .from('users')
    .select('phase')
    .eq('id', userId)
    .single();

  // Coerce legacy 'reflection' to data_collection
  const rawPhase = (user?.phase as string) || 'data_collection';
  const phase: Phase = (rawPhase === 'reflection' ? 'data_collection' : rawPhase) as Phase;
  const number = getPhaseNumber(phase);
  const name = getPhaseName(phase);

  // Calculate days until next phase based on the days-of-data threshold
  const nextPhase = getNextPhase(phase);
  const nextThresh = nextPhase ? PHASE_THRESHOLDS[nextPhase] : null;
  const daysUntilNext = nextThresh ? Math.max(0, nextThresh.minDays - daysOfData) : 0;

  // Progress within current phase (rough — based on days-of-data toward next threshold)
  const currentThresh = PHASE_THRESHOLDS[phase];
  const phaseRange = nextThresh ? nextThresh.minDays - currentThresh.minDays : 30;
  const daysInPhase = Math.max(0, daysOfData - currentThresh.minDays);
  const progress = nextPhase ? Math.min(100, Math.round((daysInPhase / Math.max(phaseRange, 1)) * 100)) : 100;

  return { phase, number, name, daysOfData, daysUntilNext, progress };
}

// ============================================================================
// Phase Transitions
// ============================================================================

/**
 * Set user phase explicitly (with timestamp)
 */
export async function setPhase(userId: string, phase: Phase): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('users')
    .update({ phase, phase_updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    throw new Error(`[PhaseService] setPhase failed for ${userId.substring(0,8)}: ${error.message}`);
  }
}

/**
 * Set onboarding state (conversation state)
 */
export async function setState(userId: string, state: OnboardingState): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('users')
    .update({ onboarding_state: state })
    .eq('id', userId);

  if (error) {
    throw new Error(`[PhaseService] setState failed for ${userId.substring(0,8)}: ${error.message}`);
  }
}

/**
 * Set both phase and state at once
 */
export async function setPhaseAndState(
  userId: string,
  phase: Phase,
  state: OnboardingState
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('users')
    .update({
      phase,
      onboarding_state: state,
      phase_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`[PhaseService] setPhaseAndState failed for ${userId.substring(0,8)}: ${error.message}`);
  }
}

/**
 * Check if user should upgrade phase, and upgrade if so.
 * Returns the new phase if upgraded, null otherwise.
 */
export async function tryUpgradePhase(userId: string): Promise<Phase | null> {
  const supabase = createServiceClient();

  const { data: user } = await supabase
    .from('users')
    .select('phase')
    .eq('id', userId)
    .single();

  if (!user) return null;

  const currentPhase = (user.phase as Phase) || 'data_collection';
  const calculatedPhase = await calculatePhase(userId);

  if (getPhaseNumber(calculatedPhase) > getPhaseNumber(currentPhase)) {
    await setPhase(userId, calculatedPhase);
    return calculatedPhase;
  }

  return null;
}

// ============================================================================
// Helpers
// ============================================================================

export function getPhaseName(phase: Phase): string {
  return PHASE_NAMES[phase] || phase;
}

export function getPhaseNumber(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase) + 1;
}

export function getNextPhase(phase: Phase): Phase | null {
  const idx = PHASE_ORDER.indexOf(phase);
  return idx >= 0 && idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null;
}

export function getStateLabel(state: string): string {
  return STATE_LABELS[state] || state;
}

export function isValidPhase(value: string): value is Phase {
  return PHASE_ORDER.includes(value as Phase);
}
