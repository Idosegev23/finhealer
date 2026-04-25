/**
 * Supabase Realtime Subscriptions
 * מאפשר עדכונים בזמן אמת לדשבורד
 */

import { createClient } from './client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Types
export type TransactionChangePayload = RealtimePostgresChangesPayload<{
  [key: string]: unknown;
}>;

export type ChangeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeCallbacks {
  onInsert?: (payload: TransactionChangePayload) => void;
  onUpdate?: (payload: TransactionChangePayload) => void;
  onDelete?: (payload: TransactionChangePayload) => void;
  onChange?: (payload: TransactionChangePayload) => void;
}

/**
 * Subscribe to transactions changes for a specific user
 */
export function subscribeToTransactions(
  userId: string,
  callbacks: RealtimeCallbacks
): RealtimeChannel {
  const supabase = createClient();
  
  const channel = supabase
    .channel(`transactions:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${userId}`,
      },
      (payload: TransactionChangePayload) => {
        // Call specific callback based on event type
        switch (payload.eventType) {
          case 'INSERT':
            callbacks.onInsert?.(payload);
            break;
          case 'UPDATE':
            callbacks.onUpdate?.(payload);
            break;
          case 'DELETE':
            callbacks.onDelete?.(payload);
            break;
        }
        // Always call onChange if provided
        callbacks.onChange?.(payload);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to behavior_insights changes
 */
export function subscribeToBehaviorInsights(
  userId: string,
  onChange: (payload: TransactionChangePayload) => void
): RealtimeChannel {
  const supabase = createClient();
  
  return supabase
    .channel(`insights:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'behavior_insights',
        filter: `user_id=eq.${userId}`,
      },
      onChange
    )
    .subscribe();
}

/**
 * Subscribe to user_patterns changes (for learning engine)
 */
export function subscribeToUserPatterns(
  userId: string,
  onChange: (payload: TransactionChangePayload) => void
): RealtimeChannel {
  const supabase = createClient();
  
  return supabase
    .channel(`patterns:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_patterns',
        filter: `user_id=eq.${userId}`,
      },
      onChange
    )
    .subscribe();
}

/**
 * Subscribe to budgets changes (active month / category updates)
 */
export function subscribeToBudgets(
  userId: string,
  onChange: (payload: TransactionChangePayload) => void
): RealtimeChannel {
  const supabase = createClient();
  return supabase
    .channel(`budgets:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${userId}` },
      onChange
    )
    .subscribe();
}

/**
 * Subscribe to goals changes (progress, status, milestones)
 */
export function subscribeToGoals(
  userId: string,
  onChange: (payload: TransactionChangePayload) => void
): RealtimeChannel {
  const supabase = createClient();
  return supabase
    .channel(`goals:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${userId}` },
      onChange
    )
    .subscribe();
}

/**
 * Subscribe to uploaded_statements changes (so dashboard knows a new doc landed
 * or finished processing).
 */
export function subscribeToUploadedStatements(
  userId: string,
  onChange: (payload: TransactionChangePayload) => void
): RealtimeChannel {
  const supabase = createClient();
  return supabase
    .channel(`uploaded:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'uploaded_statements', filter: `user_id=eq.${userId}` },
      onChange
    )
    .subscribe();
}

/**
 * Subscribe to multiple tables at once.
 *
 * Useful for "anything changed → invalidate all" patterns. For granular UIs that
 * only re-render specific cards, use the per-table subscribe* helpers instead.
 */
export function subscribeToAllUserData(
  userId: string,
  onAnyChange: () => void
): RealtimeChannel[] {
  return [
    subscribeToTransactions(userId, { onChange: onAnyChange }),
    subscribeToBehaviorInsights(userId, onAnyChange),
    subscribeToBudgets(userId, onAnyChange),
    subscribeToGoals(userId, onAnyChange),
    subscribeToUploadedStatements(userId, onAnyChange),
  ];
}

/**
 * Unsubscribe from all channels
 */
export async function unsubscribeAll(channels: RealtimeChannel[]): Promise<void> {
  const supabase = createClient();
  
  for (const channel of channels) {
    await supabase.removeChannel(channel);
  }
}

