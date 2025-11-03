"use client"

/**
 * @deprecated Use usePendingExpenses from PendingExpensesContext instead
 * This hook is kept for backward compatibility but uses the shared context
 */
import { usePendingExpenses } from '@/contexts/PendingExpensesContext';

export function usePendingExpensesCount() {
  return usePendingExpenses();
}

