/**
 * BudgetSyncService — Recalculates budget spending from actual transactions.
 *
 * Call after any transaction change (insert/update/delete) to keep
 * `budgets.total_spent` and `budget_categories.spent_amount` accurate.
 *
 * Uses service client (bypasses RLS) so it can be called from cron jobs,
 * WhatsApp handlers, and API routes alike.
 */

import { createServiceClient } from '@/lib/supabase/server';

// Simple per-user lock to prevent concurrent sync
const syncLocks = new Map<string, Promise<any>>();

// ============================================================================
// Main Sync Function
// ============================================================================

/**
 * Recalculate and update budget spending for a given user+month.
 *
 * @param userId  - The user ID
 * @param month   - Optional month string 'YYYY-MM'. Defaults to current month.
 * @returns       - Summary of what was updated
 */
export async function syncBudgetSpending(
  userId: string,
  month?: string
): Promise<{ synced: boolean; totalSpent: number; categoriesUpdated: number }> {
  const lockKey = `${userId}:${month || 'current'}`;

  // If there's already a sync running for this user+month, wait for it
  const existing = syncLocks.get(lockKey);
  if (existing) {
    return existing;
  }

  const promise = _syncBudgetSpendingImpl(userId, month).finally(() => {
    syncLocks.delete(lockKey);
  });

  syncLocks.set(lockKey, promise);
  return promise;
}

async function _syncBudgetSpendingImpl(
  userId: string,
  month?: string
): Promise<{ synced: boolean; totalSpent: number; categoriesUpdated: number }> {
  const supabase = createServiceClient();
  const targetMonth = month || new Date().toISOString().substring(0, 7);

  // 1. Find the active budget for this month
  const { data: budget } = await supabase
    .from('budgets')
    .select('id, total_budget')
    .eq('user_id', userId)
    .eq('month', targetMonth)
    .in('status', ['active', 'warning', 'exceeded'])
    .single();

  if (!budget) {
    return { synced: false, totalSpent: 0, categoriesUpdated: 0 };
  }

  // 2. Calculate total spending from confirmed transactions this month
  const monthStart = `${targetMonth}-01`;
  const monthEnd = `${targetMonth}-31`; // PostgreSQL handles month overflow

  const { data: expenses } = await supabase
    .from('transactions')
    .select('amount, expense_category, category')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('status', 'confirmed')
    .or('is_summary.is.null,is_summary.eq.false')
    .gte('tx_date', monthStart)
    .lte('tx_date', monthEnd);

  if (!expenses) {
    return { synced: false, totalSpent: 0, categoriesUpdated: 0 };
  }

  // 3. Calculate total
  const totalSpent = expenses.reduce(
    (sum, tx) => sum + Math.abs(Number(tx.amount) || 0),
    0
  );

  // 4. Calculate per-category spending
  const categorySpending: Record<string, number> = {};
  for (const tx of expenses) {
    const cat = tx.expense_category || tx.category || 'כללי';
    categorySpending[cat] = (categorySpending[cat] || 0) + Math.abs(Number(tx.amount) || 0);
  }

  // 5. Update budget total_spent
  const newStatus =
    totalSpent >= budget.total_budget
      ? 'exceeded'
      : totalSpent >= budget.total_budget * 0.9
        ? 'warning'
        : 'active';

  await supabase
    .from('budgets')
    .update({
      total_spent: Math.round(totalSpent),
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', budget.id);

  // 6. Update each budget_category's spent_amount
  const { data: budgetCategories } = await supabase
    .from('budget_categories')
    .select('id, category_name, allocated_amount')
    .eq('budget_id', budget.id);

  let categoriesUpdated = 0;

  if (budgetCategories) {
    for (const bc of budgetCategories) {
      const spent = Math.round(categorySpending[bc.category_name] || 0);
      const remaining = (bc.allocated_amount || 0) - spent;
      const percentUsed =
        bc.allocated_amount > 0
          ? Math.round((spent / bc.allocated_amount) * 100)
          : 0;
      const catStatus =
        percentUsed >= 100 ? 'exceeded' : percentUsed >= 80 ? 'warning' : 'ok';

      await supabase
        .from('budget_categories')
        .update({
          spent_amount: spent,
          remaining_amount: remaining,
          percentage_used: percentUsed,
          status: catStatus,
        })
        .eq('id', bc.id);

      categoriesUpdated++;
    }
  }

  console.log(
    `[BudgetSync] user=${userId} month=${targetMonth} total_spent=${Math.round(totalSpent)} categories=${categoriesUpdated}`
  );

  return {
    synced: true,
    totalSpent: Math.round(totalSpent),
    categoriesUpdated,
  };
}

/**
 * Sync budgets for ALL active users for the current month.
 * Used by cron jobs.
 */
export async function syncAllBudgets(): Promise<{
  processed: number;
  synced: number;
}> {
  const supabase = createServiceClient();
  const currentMonth = new Date().toISOString().substring(0, 7);

  const { data: activeBudgets } = await supabase
    .from('budgets')
    .select('user_id')
    .eq('month', currentMonth)
    .in('status', ['active', 'warning', 'exceeded']);

  if (!activeBudgets || activeBudgets.length === 0) {
    return { processed: 0, synced: 0 };
  }

  let synced = 0;
  for (const b of activeBudgets) {
    const result = await syncBudgetSpending(b.user_id, currentMonth);
    if (result.synced) synced++;
  }

  return { processed: activeBudgets.length, synced };
}
