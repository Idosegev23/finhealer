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

  // Direct match
  if (commands.some(cmd => lower === cmd || lower.includes(cmd))) {
    return true;
  }

  // Match without emojis
  const textOnly = lower.replace(/[^\u0590-\u05FFa-z0-9\s]/g, '').trim();
  if (textOnly && commands.some(cmd => {
    const cmdTextOnly = cmd.toLowerCase().replace(/[^\u0590-\u05FFa-z0-9\s]/g, '').trim();
    return textOnly === cmdTextOnly || textOnly.includes(cmdTextOnly) || cmdTextOnly.includes(textOnly);
  })) {
    return true;
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
