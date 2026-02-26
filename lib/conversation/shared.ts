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
}

export interface RouterResult {
  success: boolean;
  newState?: UserState;
}

// ============================================================================
// Command Matching
// ============================================================================

export function isCommand(msg: string, commands: string[]): boolean {
  const lower = msg.toLowerCase().trim();

  for (const cmd of commands) {
    const cmdLower = cmd.toLowerCase().trim();

    // Exact match
    if (lower === cmdLower) return true;

    // Single-word command: require whole-word match (prevents "כנ" matching inside "הכנס")
    if (!cmdLower.includes(' ')) {
      const msgWords = lower.split(/\s+/);
      if (msgWords.includes(cmdLower)) return true;
    } else {
      // Multi-word command: substring match is OK
      if (lower.includes(cmdLower)) return true;
    }
  }

  // Match without emojis/special chars
  const textOnly = lower.replace(/[^\u0590-\u05FFa-z0-9\s]/g, '').trim();
  if (textOnly) {
    const textWords = textOnly.split(/\s+/);
    for (const cmd of commands) {
      const cmdTextOnly = cmd.toLowerCase().replace(/[^\u0590-\u05FFa-z0-9\s]/g, '').trim();
      if (!cmdTextOnly) continue;

      if (textOnly === cmdTextOnly) return true;

      if (!cmdTextOnly.includes(' ')) {
        if (textWords.includes(cmdTextOnly)) return true;
      } else {
        if (textOnly.includes(cmdTextOnly)) return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Classification Context Cache
// ============================================================================

export async function saveSuggestionsToCache(userId: string, suggestions: string[]): Promise<void> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  await supabase
    .from('users')
    .update({
      classification_context: {
        ...existing?.classification_context,
        suggestions,
        updated_at: new Date().toISOString()
      }
    })
    .eq('id', userId);
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
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  await supabase
    .from('users')
    .update({
      classification_context: {
        ...existing?.classification_context,
        group_ids: txIds,
        updated_at: new Date().toISOString()
      }
    })
    .eq('id', userId);
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
// Progress Bar
// ============================================================================

export function createProgressBar(percent: number): string {
  const filled = Math.round(Math.min(100, Math.max(0, percent)) / 10);
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}

// ============================================================================
// Goal Context Merge
// ============================================================================

export async function mergeGoalCreationContext(userId: string, goalCreation: Record<string, any>): Promise<void> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  await supabase
    .from('users')
    .update({
      classification_context: { ...existing?.classification_context, goalCreation }
    })
    .eq('id', userId);
}
