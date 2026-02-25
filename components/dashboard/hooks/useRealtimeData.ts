'use client';

/**
 * Real-time Data Hooks for Dashboard
 * מאפשר עדכון אוטומטי של הדשבורד כשיש שינויים
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  subscribeToTransactions, 
  subscribeToBehaviorInsights,
  subscribeToUserPatterns,
  type TransactionChangePayload 
} from '@/lib/supabase/realtime';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  vendor?: string;
  category_id?: string;
  tx_date: string;
  type: 'income' | 'expense';
  status: 'pending' | 'confirmed';
  source?: string;
  created_at: string;
}

interface BehaviorInsight {
  id: string;
  user_id: string;
  insight_type: string;
  insight_data: Record<string, unknown>;
  created_at: string;
}

interface UseRealtimeDataResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  lastUpdate: Date | null;
}

// ============================================================================
// useRealtimeTransactions
// ============================================================================

export function useRealtimeTransactions(userId: string | null): UseRealtimeDataResult<Transaction> {
  const [data, setData] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      const supabase = createClient();
      
      const { data: transactions, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('tx_date', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;
      
      setData(transactions || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch transactions'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchTransactions();

    // Subscribe to realtime changes
    channelRef.current = subscribeToTransactions(userId, {
      onInsert: (payload) => {
        const newTx = payload.new as Transaction;
        setData(prev => [newTx, ...prev]);
        setLastUpdate(new Date());
      },
      onUpdate: (payload) => {
        const updatedTx = payload.new as Transaction;
        setData(prev => prev.map(tx => 
          tx.id === updatedTx.id ? updatedTx : tx
        ));
        setLastUpdate(new Date());
      },
      onDelete: (payload) => {
        const deletedTx = payload.old as { id: string };
        setData(prev => prev.filter(tx => tx.id !== deletedTx.id));
        setLastUpdate(new Date());
      },
    });

    return () => {
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, fetchTransactions]);

  return { data, isLoading, error, refetch: fetchTransactions, lastUpdate };
}

// ============================================================================
// useRealtimePendingTransactions
// ============================================================================

export function useRealtimePendingTransactions(userId: string | null) {
  const { data, isLoading, error, refetch, lastUpdate } = useRealtimeTransactions(userId);
  
  const pendingTransactions = data.filter(tx => 
    tx.status === 'pending'
  );
  
  const confirmedTransactions = data.filter(tx => 
    tx.status === 'confirmed'
  );

  return {
    pending: pendingTransactions,
    confirmed: confirmedTransactions,
    pendingCount: pendingTransactions.length,
    isLoading,
    error,
    refetch,
    lastUpdate,
  };
}

// ============================================================================
// useRealtimeBehaviorInsights
// ============================================================================

export function useRealtimeBehaviorInsights(userId: string | null): UseRealtimeDataResult<BehaviorInsight> {
  const [data, setData] = useState<BehaviorInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchInsights = useCallback(async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      const supabase = createClient();
      
      const { data: insights, error: fetchError } = await supabase
        .from('behavior_insights')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;
      
      setData(insights || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch insights'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    fetchInsights();

    channelRef.current = subscribeToBehaviorInsights(userId, () => {
      fetchInsights();
    });

    return () => {
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, fetchInsights]);

  return { data, isLoading, error, refetch: fetchInsights, lastUpdate };
}

// ============================================================================
// useRealtimeUserPatterns
// ============================================================================

interface UserPattern {
  id: string;
  user_id: string;
  vendor_name: string;
  category_id: string;
  confidence: number;
  times_used: number;
  created_at: string;
  updated_at: string;
}

export function useRealtimeUserPatterns(userId: string | null): UseRealtimeDataResult<UserPattern> {
  const [data, setData] = useState<UserPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchPatterns = useCallback(async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      const supabase = createClient();
      
      const { data: patterns, error: fetchError } = await supabase
        .from('user_patterns')
        .select('*')
        .eq('user_id', userId)
        .order('confidence', { ascending: false });

      if (fetchError) throw fetchError;
      
      setData(patterns || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch patterns'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    fetchPatterns();

    channelRef.current = subscribeToUserPatterns(userId, () => {
      fetchPatterns();
    });

    return () => {
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, fetchPatterns]);

  return { data, isLoading, error, refetch: fetchPatterns, lastUpdate };
}

// ============================================================================
// useRealtimeDashboardStats
// ============================================================================

interface DashboardStats {
  totalIncome: number;
  totalExpenses: number;
  pendingCount: number;
  confirmedCount: number;
  balance: number;
}

export function useRealtimeDashboardStats(userId: string | null) {
  const { data: transactions, isLoading, error, lastUpdate } = useRealtimeTransactions(userId);
  
  const stats: DashboardStats = {
    totalIncome: 0,
    totalExpenses: 0,
    pendingCount: 0,
    confirmedCount: 0,
    balance: 0,
  };

  // Calculate stats from transactions
  for (const tx of transactions) {
    if (tx.status === 'pending') {
      stats.pendingCount++;
    } else if (tx.status === 'confirmed') {
      stats.confirmedCount++;
      if (tx.type === 'income') {
        stats.totalIncome += tx.amount;
      } else {
        stats.totalExpenses += tx.amount;
      }
    }
  }

  stats.balance = stats.totalIncome - stats.totalExpenses;

  return { stats, isLoading, error, lastUpdate };
}

// ============================================================================
// useRealtimeNotifications
// ============================================================================

interface Notification {
  id: string;
  type: 'new_transaction' | 'classification_done' | 'alert' | 'insight';
  message: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, unknown>;
}

export function useRealtimeNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to transaction changes for notifications
    channelRef.current = subscribeToTransactions(userId, {
      onInsert: (payload) => {
        const newTx = payload.new as Transaction;
        const notification: Notification = {
          id: `tx-${newTx.id}`,
          type: 'new_transaction',
          message: `תנועה חדשה: ${newTx.amount.toLocaleString('he-IL')} ₪ ${newTx.vendor ? `ב-${newTx.vendor}` : ''}`,
          timestamp: new Date(),
          read: false,
          data: { transactionId: newTx.id },
        };
        setNotifications(prev => [notification, ...prev].slice(0, 20));
      },
      onUpdate: (payload) => {
        const updatedTx = payload.new as Transaction;
        const oldTx = payload.old as { status?: string };
        
        // Notify only when status changes to confirmed
        if (oldTx.status !== 'confirmed' && updatedTx.status === 'confirmed') {
          const notification: Notification = {
            id: `classified-${updatedTx.id}`,
            type: 'classification_done',
            message: `תנועה סווגה: ${updatedTx.amount.toLocaleString('he-IL')} ₪`,
            timestamp: new Date(),
            read: false,
            data: { transactionId: updatedTx.id },
          };
          setNotifications(prev => [notification, ...prev].slice(0, 20));
        }
      },
    });

    return () => {
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}

