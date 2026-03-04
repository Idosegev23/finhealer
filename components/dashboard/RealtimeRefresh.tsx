'use client';

/**
 * RealtimeRefresh - Lightweight client component that subscribes to
 * Supabase real-time changes and triggers a Next.js server re-render
 * via router.refresh(). Drop this into any server-rendered page to
 * get automatic updates when the WhatsApp bot processes documents.
 */

import { useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeToTransactions } from '@/lib/supabase/realtime';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeRefreshProps {
  /** The authenticated user's ID to scope the subscription */
  userId: string;
  /**
   * Additional tables to listen to beyond 'transactions'.
   * Each entry creates a separate channel subscription.
   */
  tables?: string[];
}

export function RealtimeRefresh({ userId, tables = [] }: RealtimeRefreshProps) {
  const router = useRouter();
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Stabilize tables array to avoid re-subscribing on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableTables = useMemo(() => tables, [JSON.stringify(tables)]);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Debounced refresh: batch rapid changes into a single refresh
    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        router.refresh();
      }, 1000); // wait 1s after last change before refreshing
    };

    // 1. Subscribe to transactions (the primary table)
    const txChannel = subscribeToTransactions(userId, {
      onChange: triggerRefresh,
    });
    channelsRef.current.push(txChannel);

    // 2. Subscribe to any additional tables
    for (const table of stableTables) {
      const channel = supabase
        .channel(`rt-${table}:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: `user_id=eq.${userId}`,
          },
          triggerRefresh
        )
        .subscribe();
      channelsRef.current.push(channel);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      for (const channel of channelsRef.current) {
        supabase.removeChannel(channel);
      }
      channelsRef.current = [];
    };
  }, [userId, router, stableTables]);

  // This component renders nothing — it only subscribes
  return null;
}
