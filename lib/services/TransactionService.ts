/**
 * TransactionService - Centralized transaction operations
 *
 * All transaction queries, status changes, and summary calculations.
 * Single source of truth for transaction business logic.
 */

import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export type TransactionStatus = 'pending' | 'confirmed' | 'needs_credit_detail';
export type TransactionType = 'income' | 'expense';

export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  incomeCount: number;
  expenseCount: number;
}

export interface PendingSummary extends TransactionSummary {
  pendingIncome: number;
  pendingExpenses: number;
  pendingCount: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  income: number;
  expenses: number;
  balance: number;
  transactionCount: number;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get pending transactions for a user, optionally filtered by type
 */
export async function getPending(
  userId: string,
  type?: TransactionType
): Promise<any[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('tx_date', { ascending: true });

  if (type) {
    query = query.eq('type', type);
  }

  const { data } = await query;
  return data || [];
}

/**
 * Get confirmed transactions, optionally filtered by date range and type
 */
export async function getConfirmed(
  userId: string,
  options?: {
    type?: TransactionType;
    fromDate?: string; // YYYY-MM-DD
    toDate?: string;   // YYYY-MM-DD
    limit?: number;
  }
): Promise<any[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .order('tx_date', { ascending: false });

  if (options?.type) query = query.eq('type', options.type);
  if (options?.fromDate) query = query.gte('tx_date', options.fromDate);
  if (options?.toDate) query = query.lte('tx_date', options.toDate);
  if (options?.limit) query = query.limit(options.limit);

  const { data } = await query;
  return data || [];
}

/**
 * Count transactions by status
 */
export async function countByStatus(
  userId: string,
  status: TransactionStatus
): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', status);

  return count || 0;
}

// ============================================================================
// Status Management
// ============================================================================

/**
 * Confirm a single transaction with category
 */
export async function confirmTransaction(
  txId: string,
  category: string,
  options?: {
    expense_category?: string;
    funding_source?: string;
    expense_frequency?: string;
  }
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('transactions')
    .update({
      status: 'confirmed',
      category,
      ...(options?.expense_category && { expense_category: options.expense_category }),
      ...(options?.funding_source && { funding_source: options.funding_source }),
      ...(options?.expense_frequency && { expense_frequency: options.expense_frequency }),
      classified_at: new Date().toISOString(),
    })
    .eq('id', txId);
}

/**
 * Confirm multiple transactions at once with same category
 */
export async function confirmBatch(
  txIds: string[],
  category: string,
  options?: {
    expense_category?: string;
    funding_source?: string;
    expense_frequency?: string;
  }
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('transactions')
    .update({
      status: 'confirmed',
      category,
      ...(options?.expense_category && { expense_category: options.expense_category }),
      ...(options?.funding_source && { funding_source: options.funding_source }),
      ...(options?.expense_frequency && { expense_frequency: options.expense_frequency }),
      classified_at: new Date().toISOString(),
    })
    .in('id', txIds);
}

// ============================================================================
// Summaries
// ============================================================================

/**
 * Get confirmed transaction summary for a date range
 */
export async function getSummary(
  userId: string,
  fromDate?: string,
  toDate?: string
): Promise<TransactionSummary> {
  const transactions = await getConfirmed(userId, { fromDate, toDate });

  const income = transactions.filter(t => t.type === 'income');
  const expenses = transactions.filter(t => t.type === 'expense');

  const totalIncome = income.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    incomeCount: income.length,
    expenseCount: expenses.length,
  };
}

/**
 * Get summary including pending transactions
 */
export async function getSummaryWithPending(
  userId: string,
  fromDate?: string,
  toDate?: string
): Promise<PendingSummary> {
  const supabase = createServiceClient();
  let query = supabase
    .from('transactions')
    .select('type, amount, status')
    .eq('user_id', userId)
    .in('status', ['confirmed', 'pending']);

  if (fromDate) query = query.gte('tx_date', fromDate);
  if (toDate) query = query.lte('tx_date', toDate);

  const { data: transactions } = await query;
  const txData = transactions || [];

  const confirmed = txData.filter(t => t.status === 'confirmed');
  const pending = txData.filter(t => t.status === 'pending');

  const totalIncome = confirmed.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalExpenses = confirmed.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
  const pendingIncome = pending.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
  const pendingExpenses = pending.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    incomeCount: confirmed.filter(t => t.type === 'income').length,
    expenseCount: confirmed.filter(t => t.type === 'expense').length,
    pendingIncome,
    pendingExpenses,
    pendingCount: pending.length,
  };
}

/**
 * Get expense breakdown by category
 */
export async function getCategoryBreakdown(
  userId: string,
  fromDate?: string,
  toDate?: string
): Promise<CategoryBreakdown[]> {
  const expenses = await getConfirmed(userId, { type: 'expense', fromDate, toDate });

  const categoryMap: Record<string, { amount: number; count: number }> = {};
  let total = 0;

  for (const tx of expenses) {
    const cat = tx.category || tx.expense_category || 'אחר';
    if (!categoryMap[cat]) categoryMap[cat] = { amount: 0, count: 0 };
    categoryMap[cat].amount += Math.abs(tx.amount);
    categoryMap[cat].count++;
    total += Math.abs(tx.amount);
  }

  return Object.entries(categoryMap)
    .map(([category, data]) => ({
      category,
      amount: Math.round(data.amount),
      percentage: total > 0 ? Math.round((data.amount / total) * 100) : 0,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Get monthly summaries for the last N months
 */
export async function getMonthlySummaries(
  userId: string,
  months: number = 6
): Promise<MonthlySummary[]> {
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - months);
  const fromStr = fromDate.toISOString().split('T')[0];

  const transactions = await getConfirmed(userId, { fromDate: fromStr });

  const monthMap: Record<string, { income: number; expenses: number; count: number }> = {};

  for (const tx of transactions) {
    const month = tx.tx_date?.substring(0, 7); // YYYY-MM
    if (!month) continue;
    if (!monthMap[month]) monthMap[month] = { income: 0, expenses: 0, count: 0 };

    if (tx.type === 'income') {
      monthMap[month].income += Math.abs(tx.amount);
    } else {
      monthMap[month].expenses += Math.abs(tx.amount);
    }
    monthMap[month].count++;
  }

  return Object.entries(monthMap)
    .map(([month, data]) => ({
      month,
      income: Math.round(data.income),
      expenses: Math.round(data.expenses),
      balance: Math.round(data.income - data.expenses),
      transactionCount: data.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Get the date range (oldest, newest) of user's confirmed transactions
 */
export async function getDateRange(
  userId: string
): Promise<{ oldest: string | null; newest: string | null }> {
  const supabase = createServiceClient();

  const { data: oldest } = await supabase
    .from('transactions')
    .select('tx_date')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .order('tx_date', { ascending: true })
    .limit(1)
    .single();

  const { data: newest } = await supabase
    .from('transactions')
    .select('tx_date')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .order('tx_date', { ascending: false })
    .limit(1)
    .single();

  return {
    oldest: oldest?.tx_date || null,
    newest: newest?.tx_date || null,
  };
}
