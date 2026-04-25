/**
 * Current Focus — φ's "theory" about what's the current coaching priority for this user.
 *
 * Without this, every conversation is independent decision-making from scratch. With it,
 * φ holds a stable mental model: "this user is currently working on closing the credit
 * card debt", "this user just set a vacation goal", "this user is in denial about their
 * subscription bloat".
 *
 * Stored in `users.classification_context.phi_profile.current_focus`. Updated by the
 * conversation summarizer (when patterns repeat) and by deterministic events
 * (goal created, milestone hit, statement uploaded showing big change).
 */

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

export const FocusThemeEnum = z.enum([
  'data_collection_in_progress',     // Still gathering documents
  'pattern_discovery',                // Behavior phase: surfacing patterns
  'subscription_audit',               // Found suspicious recurring charges
  'overspending_category',            // One category eats outsize share
  'debt_reduction',                   // High debt load, planning consolidation/payoff
  'goal_setup',                       // Defining goals
  'goal_progress_tracking',           // Goals defined, watching progress
  'budget_calibration',               // Building / tuning budget
  'income_change_adaptation',         // Salary changed, replanning
  'milestone_celebration',            // Hit 25/50/75/100% on a goal
  'no_specific_focus',                // Default — just monitoring
]);
export type FocusTheme = z.infer<typeof FocusThemeEnum>;

export const CurrentFocusSchema = z.object({
  theme: FocusThemeEnum,
  /** Plain Hebrew sentence summarizing what we're currently coaching on. */
  summary: z.string(),
  /** Evidence supporting this theme (e.g. transaction patterns, user statements). */
  evidence: z.array(z.string()).default([]),
  /** Where in the coaching arc we are. */
  stage: z.enum(['exploration', 'commitment', 'action', 'maintenance']).default('exploration'),
  /** ISO timestamp until which we should not switch focus (give the current coaching time to land). */
  locked_until: z.string().nullable().default(null),
  /** When this focus was set / last updated. */
  updated_at: z.string(),
});
export type CurrentFocus = z.infer<typeof CurrentFocusSchema>;

// ============================================================================
// Public API
// ============================================================================

const FOCUS_LOCK_DAYS = 7;

export async function getCurrentFocus(userId: string): Promise<CurrentFocus | null> {
  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const raw = (user?.classification_context as any)?.phi_profile?.current_focus;
  if (!raw) return null;
  try {
    return CurrentFocusSchema.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Set the current focus (stored under classification_context.phi_profile.current_focus).
 * Optionally locks the focus for `lockDays` days so the brain stops second-guessing it.
 */
export async function setCurrentFocus(
  userId: string,
  focus: Omit<CurrentFocus, 'updated_at' | 'locked_until'> & { lockDays?: number }
): Promise<void> {
  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const ctx = (user?.classification_context || {}) as any;
  const profile = (ctx.phi_profile || {}) as any;

  const lockDays = focus.lockDays ?? FOCUS_LOCK_DAYS;
  const lockedUntil = lockDays > 0
    ? new Date(Date.now() + lockDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const stored: CurrentFocus = {
    theme: focus.theme,
    summary: focus.summary,
    evidence: focus.evidence || [],
    stage: focus.stage || 'exploration',
    locked_until: lockedUntil,
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from('users')
    .update({
      classification_context: { ...ctx, phi_profile: { ...profile, current_focus: stored } },
    })
    .eq('id', userId);
}

/**
 * Auto-derive a current focus from the user's state if none is set, so the
 * brain always has SOMETHING to anchor on.
 *
 * Called on every brain context load. Cheap — no AI call, just reads state.
 */
export async function deriveAndStoreFocusIfMissing(userId: string, phase: string, hasGoals: boolean, hasBudget: boolean, pendingCount: number): Promise<CurrentFocus | null> {
  const existing = await getCurrentFocus(userId);

  // If a focus is locked and still valid, don't override
  if (existing && existing.locked_until && new Date(existing.locked_until) > new Date()) {
    return existing;
  }

  let theme: FocusTheme = 'no_specific_focus';
  let summary = 'אין פוקוס מוגדר.';
  const evidence: string[] = [];

  if (phase === 'data_collection') {
    theme = 'data_collection_in_progress';
    summary = pendingCount > 0
      ? `המשתמש בעיצומו של איסוף נתונים — ${pendingCount} תנועות ממתינות לסיווג.`
      : 'המשתמש מתחיל את התהליך — צריך עוד דוחות.';
    if (pendingCount > 0) evidence.push(`${pendingCount} תנועות לא מסווגות`);
  } else if (phase === 'behavior') {
    theme = 'pattern_discovery';
    summary = 'יש מספיק דאטה. מנתחים דפוסי הוצאה ומחפשים הזדמנויות לחיסכון.';
  } else if (phase === 'goals') {
    theme = hasGoals ? 'goal_progress_tracking' : 'goal_setup';
    summary = hasGoals
      ? 'יעדים מוגדרים. עוקבים אחרי התקדמות.'
      : 'הגיע הזמן להגדיר יעדים — מה החלום הפיננסי?';
  } else if (phase === 'budget') {
    theme = 'budget_calibration';
    summary = hasBudget
      ? 'תקציב פעיל. מסייעים בכיוונון לפי המציאות.'
      : 'בונים תקציב מבוסס יעדים שתומך במה שהמשתמש רוצה להשיג.';
  } else if (phase === 'monitoring') {
    theme = 'no_specific_focus';
    summary = 'במעקב שוטף. מחפשים סטיות, הזדמנויות, אבני דרך ביעדים.';
  }

  const newFocus: CurrentFocus = {
    theme,
    summary,
    evidence,
    stage: 'exploration',
    locked_until: null,
    updated_at: new Date().toISOString(),
  };

  await setCurrentFocus(userId, { ...newFocus, lockDays: 0 });
  return newFocus;
}

/**
 * Render the current focus as a short block to inject into the system prompt.
 */
export function renderFocusForPrompt(focus: CurrentFocus | null): string {
  if (!focus) return 'אין פוקוס נוכחי מוגדר.';
  const ev = focus.evidence.length > 0 ? `\n   ראיות: ${focus.evidence.join('; ')}` : '';
  return `פוקוס נוכחי: ${focus.theme} (${focus.stage})\n   ${focus.summary}${ev}`;
}
