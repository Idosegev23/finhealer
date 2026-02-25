/**
 * ClassificationService - Transaction categorization
 *
 * Handles:
 * - User category rules (learn/suggest)
 * - Vendor normalization
 * - Category matching (built-in + learned)
 * - Batch auto-classification
 */

import { createServiceClient } from '@/lib/supabase/server';
import { findBestMatch, findTopMatches } from '@/lib/finance/categories';
import { findBestIncomeMatch, findTopIncomeMatches } from '@/lib/finance/income-categories';

// ============================================================================
// Types
// ============================================================================

export interface CategoryRule {
  id: string;
  user_id: string;
  vendor_pattern: string;
  category: string;
  confidence: number;
  learn_count: number;
  auto_approved: boolean;
  times_used: number;
}

export interface ClassificationSuggestion {
  category: string;
  confidence: number;
  source: 'user_rule' | 'builtin' | 'ai';
}

// ============================================================================
// Vendor Normalization
// ============================================================================

/**
 * Normalize vendor name for rule matching
 */
export function normalizeVendor(vendor: string): string {
  return vendor
    .trim()
    .toLowerCase()
    .replace(/\s*\d+\s*$/, '') // Remove trailing numbers (branch numbers)
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// User Rules (Learning)
// ============================================================================

/**
 * Learn a classification rule from user's manual categorization
 */
export async function learnRule(
  userId: string,
  vendor: string,
  category: string,
  type: 'income' | 'expense'
): Promise<void> {
  const supabase = createServiceClient();
  const vendorPattern = normalizeVendor(vendor);

  if (!vendorPattern || vendorPattern.length < 2) return;

  const { data: existing } = await supabase
    .from('user_category_rules')
    .select('id, category, learn_count, times_used')
    .eq('user_id', userId)
    .eq('vendor_pattern', vendorPattern)
    .single();

  if (existing) {
    const newCount = (existing.learn_count || 1) + 1;
    await supabase
      .from('user_category_rules')
      .update({
        category,
        learn_count: newCount,
        auto_approved: newCount >= 3,
        times_used: (existing.times_used || 0) + 1,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('user_category_rules')
      .insert({
        user_id: userId,
        vendor_pattern: vendorPattern,
        category,
        expense_frequency: type === 'expense' ? 'temporary' : null,
        confidence: 1.0,
        learn_count: 1,
        times_used: 1,
        last_used_at: new Date().toISOString(),
        auto_approved: false,
      });
  }
}

/**
 * Get a suggestion from user's learned rules
 */
export async function getRuleSuggestion(
  userId: string,
  vendor: string
): Promise<string | null> {
  const supabase = createServiceClient();
  const vendorPattern = normalizeVendor(vendor);

  if (!vendorPattern || vendorPattern.length < 2) return null;

  // Exact match first
  const { data: exactRule } = await supabase
    .from('user_category_rules')
    .select('category')
    .eq('user_id', userId)
    .eq('vendor_pattern', vendorPattern)
    .single();

  if (exactRule) return exactRule.category;

  // Similar match (contains)
  const { data: similarRules } = await supabase
    .from('user_category_rules')
    .select('vendor_pattern, category')
    .eq('user_id', userId)
    .order('times_used', { ascending: false })
    .limit(50);

  if (similarRules) {
    for (const rule of similarRules) {
      if (vendorPattern.includes(rule.vendor_pattern) ||
          rule.vendor_pattern.includes(vendorPattern)) {
        return rule.category;
      }
    }
  }

  return null;
}

// ============================================================================
// Category Suggestions
// ============================================================================

/**
 * Get category suggestions for a transaction (combines all sources)
 */
export async function getSuggestions(
  userId: string,
  vendor: string,
  type: 'income' | 'expense'
): Promise<ClassificationSuggestion[]> {
  const suggestions: ClassificationSuggestion[] = [];

  // 1. User learned rules (highest priority)
  const userSuggestion = await getRuleSuggestion(userId, vendor);
  if (userSuggestion) {
    suggestions.push({
      category: userSuggestion,
      confidence: 0.95,
      source: 'user_rule',
    });
  }

  // 2. Built-in category matching
  if (type === 'expense') {
    const matches = findTopMatches(vendor, 3);
    for (const match of matches) {
      if (!suggestions.some(s => s.category === match.name)) {
        suggestions.push({
          category: match.name,
          confidence: 0.7,
          source: 'builtin',
        });
      }
    }
  } else {
    const matches = findTopIncomeMatches(vendor, 3);
    for (const match of matches) {
      if (!suggestions.some(s => s.category === match.name)) {
        suggestions.push({
          category: match.name,
          confidence: 0.7,
          source: 'builtin',
        });
      }
    }
  }

  return suggestions;
}

/**
 * Auto-classify transactions that have auto-approved rules
 * Returns the number of transactions classified
 */
export async function autoClassify(userId: string): Promise<number> {
  const supabase = createServiceClient();

  // Get auto-approved rules
  const { data: rules } = await supabase
    .from('user_category_rules')
    .select('vendor_pattern, category')
    .eq('user_id', userId)
    .eq('auto_approved', true);

  if (!rules || rules.length === 0) return 0;

  // Get pending transactions
  const { data: pending } = await supabase
    .from('transactions')
    .select('id, vendor, type')
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (!pending || pending.length === 0) return 0;

  let classified = 0;

  for (const tx of pending) {
    const txVendor = normalizeVendor(tx.vendor || '');
    if (!txVendor) continue;

    const matchingRule = rules.find(r =>
      txVendor === r.vendor_pattern ||
      txVendor.includes(r.vendor_pattern) ||
      r.vendor_pattern.includes(txVendor)
    );

    if (matchingRule) {
      await supabase
        .from('transactions')
        .update({
          status: 'confirmed',
          category: matchingRule.category,
          expense_category: tx.type === 'expense' ? matchingRule.category : null,
          income_category: tx.type === 'income' ? matchingRule.category : null,
          learned_from_pattern: true,
          classified_at: new Date().toISOString(),
        })
        .eq('id', tx.id);

      classified++;
    }
  }

  return classified;
}

// ============================================================================
// Suggestion Cache (for WhatsApp flow)
// ============================================================================

/**
 * Save suggestions to user context (for numbered selection)
 */
export async function cacheSuggestions(
  userId: string,
  suggestions: string[]
): Promise<void> {
  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const ctx = user?.classification_context || {};
  await supabase
    .from('users')
    .update({ classification_context: { ...ctx, cachedSuggestions: suggestions } })
    .eq('id', userId);
}

/**
 * Get cached suggestions
 */
export async function getCachedSuggestions(userId: string): Promise<string[] | null> {
  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  return user?.classification_context?.cachedSuggestions || null;
}

/**
 * Save current transaction group to context (for batch classification)
 */
export async function cacheCurrentGroup(
  userId: string,
  txIds: string[]
): Promise<void> {
  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const ctx = user?.classification_context || {};
  await supabase
    .from('users')
    .update({ classification_context: { ...ctx, currentGroupTxIds: txIds } })
    .eq('id', userId);
}

/**
 * Get cached current group
 */
export async function getCachedGroup(userId: string): Promise<string[] | null> {
  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  return user?.classification_context?.currentGroupTxIds || null;
}
