/**
 * Shared types and utilities for conversation handlers
 */

import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types (exported for all handlers)
// ============================================================================

export type UserState =
  | 'start'
  | 'waiting_for_name'
  | 'waiting_for_document'
  | 'classification'
  | 'classification_income'
  | 'classification_expense'
  | 'smart_classification'
  | 'behavior'
  | 'goals'
  | 'goals_setup'
  | 'budget'
  | 'monitoring'
  | 'loan_consolidation_offer'
  | 'waiting_for_loan_docs';

export interface RouterContext {
  userId: string;
  phone: string;
  state: UserState;
  userName: string | null;
  intent?: { type: string; confidence: number } | null;
}

export interface RouterResult {
  success: boolean;
  newState?: UserState;
}

// ============================================================================
// Classification Context Cache
// ============================================================================

export async function saveSuggestionsToCache(userId: string, suggestions: string[]): Promise<void> {
  await mergeClassificationContext(userId, { suggestions, updated_at: new Date().toISOString() });
}

export async function getSuggestionsFromCache(userId: string): Promise<string[] | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  return data?.classification_context?.suggestions || null;
}

export async function saveCurrentGroupToCache(userId: string, txIds: string[]): Promise<void> {
  await mergeClassificationContext(userId, { group_ids: txIds, updated_at: new Date().toISOString() });
}

export async function getCurrentGroupFromCache(userId: string): Promise<string[] | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  return data?.classification_context?.group_ids || null;
}

// ============================================================================
// Command Detection
// ============================================================================

/**
 * Check if a message matches any of the given commands.
 * Strips emojis/whitespace and does case-insensitive substring matching.
 */
export function isCommand(message: string, commands: string[]): boolean {
  if (!message || commands.length === 0) return false;
  const cleaned = message.replace(/[▶️⬛⬜☑️✅❌⭐️⚡️]/g, '').trim().toLowerCase();
  if (!cleaned) return false;
  return commands.some(cmd => {
    const c = cmd.toLowerCase();
    return cleaned === c || cleaned.includes(c);
  });
}

// ============================================================================
// Progress Bar
// ============================================================================

/**
 * Create a text progress bar (10 chars wide)
 */
export function createProgressBar(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round(clamped / 10);
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}

// ============================================================================
// Vendor Normalization
// ============================================================================

export function normalizeVendor(vendor: string): string {
  return vendor
    .trim()
    .toLowerCase()
    .replace(/\s*\d+\s*$/, '')
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// Classification Context Merge Utility
// ============================================================================

/**
 * Merges an update into the user's classification_context JSONB field.
 * Uses PostgreSQL's native || operator for atomic merge (no read-then-write race).
 * Falls back to fetch-merge-write if RPC fails.
 */
export async function mergeClassificationContext(
  userId: string,
  update: Record<string, any>
): Promise<void> {
  const supabase = createServiceClient();

  // Try atomic JSONB merge via raw SQL (no race condition)
  const { error: rpcError } = await supabase.rpc('merge_classification_context', {
    p_user_id: userId,
    p_update: update,
  });

  if (!rpcError) return;

  // Fallback: fetch-merge-write (race possible under concurrent requests)
  console.warn(`[shared] merge_classification_context RPC unavailable, using fallback:`, rpcError.message);
  const { data } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const existing = data?.classification_context || {};
  await supabase
    .from('users')
    .update({ classification_context: { ...existing, ...update } })
    .eq('id', userId);
}

/**
 * Removes a key from the user's classification_context atomically.
 * Uses PostgreSQL JSONB - operator (no read-then-write race).
 * Falls back to fetch-remove-write if RPC unavailable.
 */
export async function removeClassificationContextKey(
  userId: string,
  key: string
): Promise<void> {
  const supabase = createServiceClient();

  const { error: rpcError } = await supabase.rpc('remove_classification_context_key', {
    p_user_id: userId,
    p_key: key,
  });

  if (!rpcError) return;

  // Fallback: fetch-remove-write
  console.warn(`[shared] remove_classification_context_key RPC unavailable, using fallback:`, rpcError.message);
  const { data } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const ctx = data?.classification_context || {};
  const { [key]: _removed, ...rest } = ctx as any;
  await supabase
    .from('users')
    .update({ classification_context: Object.keys(rest).length > 0 ? rest : null })
    .eq('id', userId);
}

