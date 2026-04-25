'use client';

/**
 * useRealtimeUserData — single hook that gives the whole picture, kept fresh.
 *
 * Subscribes to: transactions, budgets, goals, uploaded_statements, behavior_insights.
 * Re-fetches the relevant slice when anything changes; debounces multiple
 * near-simultaneous events so we don't thrash the DB.
 *
 * For dashboard pages that need to reflect WhatsApp brain mutations in real time
 * (a transaction the user just logged via WA, a goal milestone, a budget update).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  subscribeToTransactions,
  subscribeToBudgets,
  subscribeToGoals,
  subscribeToUploadedStatements,
  subscribeToBehaviorInsights,
} from '@/lib/supabase/realtime';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeUserSnapshot {
  budget: {
    total_budget: number;
    total_spent: number;
    remaining: number;
    status: string;
    month: string;
  } | null;
  goals: Array<{
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    progress: number;
    status: string;
    deadline: string | null;
  }>;
  pendingTransactionsCount: number;
  recentDocumentsCount: number;
  monthlyIncome: number;
  monthlyExpenses: number;
}

export interface RealtimeUserDataResult {
  snapshot: RealtimeUserSnapshot | null;
  isLoading: boolean;
  error: Error | null;
  lastUpdate: Date | null;
  refetch: () => Promise<void>;
}

const REFETCH_DEBOUNCE_MS = 400;

export function useRealtimeUserData(userId: string | null): RealtimeUserDataResult {
  const [snapshot, setSnapshot] = useState<RealtimeUserSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const channelsRef = useRef<RealtimeChannel[]>([]);
  const refetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = createClient();
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthStart = `${currentMonth}-01`;

      const [
        { data: budget },
        { data: goals },
        { count: pendingCount },
        { count: docsCount },
        { data: monthlyTx },
      ] = await Promise.all([
        supabase
          .from('budgets')
          .select('total_budget, total_spent, status, month')
          .eq('user_id', userId)
          .eq('month', currentMonth)
          .in('status', ['active', 'warning', 'exceeded'])
          .limit(1)
          .maybeSingle(),
        supabase
          .from('goals')
          .select('id, name, target_amount, current_amount, status, deadline')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('priority', { ascending: true })
          .limit(20),
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'pending'),
        supabase
          .from('uploaded_statements')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('transactions')
          .select('amount, type')
          .eq('user_id', userId)
          .eq('status', 'confirmed')
          .gte('tx_date', monthStart),
      ]);

      const totalIncome = (monthlyTx || [])
        .filter(t => t.type === 'income')
        .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
      const totalExpenses = (monthlyTx || [])
        .filter(t => t.type === 'expense')
        .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

      const budgetSnap = budget
        ? {
            total_budget: Number(budget.total_budget) || 0,
            total_spent: Number(budget.total_spent) || 0,
            remaining: (Number(budget.total_budget) || 0) - (Number(budget.total_spent) || 0),
            status: budget.status || 'active',
            month: budget.month,
          }
        : null;

      const goalsSnap = (goals || []).map(g => {
        const target = Number(g.target_amount) || 0;
        const current = Number(g.current_amount) || 0;
        return {
          id: g.id,
          name: g.name,
          target_amount: target,
          current_amount: current,
          progress: target > 0 ? Math.round((current / target) * 100) : 0,
          status: g.status,
          deadline: g.deadline,
        };
      });

      setSnapshot({
        budget: budgetSnap,
        goals: goalsSnap,
        pendingTransactionsCount: pendingCount || 0,
        recentDocumentsCount: docsCount || 0,
        monthlyIncome: Math.round(totalIncome),
        monthlyExpenses: Math.round(totalExpenses),
      });
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch user snapshot'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Debounced refetch — when many events fire close together (e.g. a batch of
  // transaction inserts from a document upload), we only want one refetch.
  const debouncedRefetch = useCallback(() => {
    if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
    refetchTimeoutRef.current = setTimeout(() => {
      fetchSnapshot();
    }, REFETCH_DEBOUNCE_MS);
  }, [fetchSnapshot]);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    fetchSnapshot();

    const channels: RealtimeChannel[] = [
      subscribeToTransactions(userId, { onChange: debouncedRefetch }),
      subscribeToBudgets(userId, debouncedRefetch),
      subscribeToGoals(userId, debouncedRefetch),
      subscribeToUploadedStatements(userId, debouncedRefetch),
      subscribeToBehaviorInsights(userId, debouncedRefetch),
    ];
    channelsRef.current = channels;

    return () => {
      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
      const supabase = createClient();
      for (const ch of channels) supabase.removeChannel(ch);
    };
  }, [userId, fetchSnapshot, debouncedRefetch]);

  return { snapshot, isLoading, error, lastUpdate, refetch: fetchSnapshot };
}
