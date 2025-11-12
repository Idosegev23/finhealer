'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeTransactionsOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  enabled?: boolean;
}

/**
 * Hook להאזנה לשינויים בזמן אמת בטבלת transactions
 * עובד עם RLS - רואה רק את הנתונים שהמשתמש מורשה לראות
 */
export function useRealtimeTransactions({
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeTransactionsOptions = {}) {
  const channelRef = useRef<any>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // יצירת channel חדש
    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          console.log('🟢 Transaction INSERT:', payload);
          onInsert?.(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          console.log('🟡 Transaction UPDATE:', payload);
          onUpdate?.(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          console.log('🔴 Transaction DELETE:', payload);
          onDelete?.(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    channelRef.current = channel;

    // ניקוי בעת unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, onInsert, onUpdate, onDelete, supabase]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [supabase]);

  return { unsubscribe };
}


