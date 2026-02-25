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

const PHASE_ORDER: Phase[] = ['data_collection', 'behavior', 'budget', 'goals', 'monitoring'];

const PHASE_THRESHOLDS: Record<Phase, number> = {
  data_collection: 0,
  behavior: 30,
  budget: 60,
  goals: 90,
  monitoring: 120,
};

const PHASE_NAMES: Record<Phase, string> = {
  data_collection: 'איסוף נתונים',
  behavior: 'ניתוח הרגלים',
  budget: 'תקציב חכם',
  goals: 'הגדרת יעדים',
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
 * Calculate the appropriate phase for a user based on their data span
 */
export async function calculatePhase(userId: string): Promise<Phase> {
  const days = await getDaysOfData(userId);

  if (days < 30) return 'data_collection';
  if (days < 60) return 'behavior';
  if (days < 90) return 'budget';
  if (days < 120) return 'goals';
  return 'monitoring';
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

  const phase = (user?.phase as Phase) || 'data_collection';
  const number = getPhaseNumber(phase);
  const name = getPhaseName(phase);

  // Calculate days until next phase
  let daysUntilNext = 0;
  if (daysOfData < 30) daysUntilNext = 30 - daysOfData;
  else if (daysOfData < 60) daysUntilNext = 60 - daysOfData;
  else if (daysOfData < 90) daysUntilNext = 90 - daysOfData;
  else if (daysOfData < 120) daysUntilNext = 120 - daysOfData;

  // Calculate progress within current phase
  const currentThreshold = PHASE_THRESHOLDS[phase];
  const nextPhase = getNextPhase(phase);
  const nextThreshold = nextPhase ? PHASE_THRESHOLDS[nextPhase] : currentThreshold + 30;
  const phaseRange = nextThreshold - currentThreshold;
  const daysInPhase = Math.max(0, daysOfData - currentThreshold);
  const progress = nextPhase ? Math.min(100, Math.round((daysInPhase / phaseRange) * 100)) : 100;

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
  await supabase
    .from('users')
    .update({ phase, phase_updated_at: new Date().toISOString() })
    .eq('id', userId);
}

/**
 * Set onboarding state (conversation state)
 */
export async function setState(userId: string, state: OnboardingState): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('users')
    .update({ onboarding_state: state })
    .eq('id', userId);
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
  await supabase
    .from('users')
    .update({
      phase,
      onboarding_state: state,
      phase_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
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
