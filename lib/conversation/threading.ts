/**
 * Conversation threading helpers.
 *
 * Threads are computed by a DB trigger on wa_messages — each insert is grouped
 * with the prior message if the gap is < 4h, else a new conversation_id is minted.
 * App code reads threads via these helpers; it never assigns conversation_id directly.
 */

import { createServiceClient } from '@/lib/supabase/server';

export interface ThreadMessage {
  id: string;
  direction: 'incoming' | 'outgoing';
  body: string;
  created_at: string;
}

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * Pull a wa_messages.payload's human-readable body out, regardless of which
 * shape it was stored in (sendPhiMessage uses { body }, GreenAPI raw incoming
 * uses { messageData.textMessageData.textMessage }).
 */
function extractBody(payload: any): string {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload.body === 'string') return payload.body;
  const md = payload.messageData;
  if (md) {
    if (md.textMessageData?.textMessage) return md.textMessageData.textMessage;
    if (md.extendedTextMessageData?.text) return md.extendedTextMessageData.text;
  }
  return '';
}

/**
 * Get the open conversation thread for a user — i.e., the conversation_id of
 * the latest message AND a flag for whether it's still active (last message < 4h ago).
 */
export async function getActiveThread(userId: string): Promise<{
  conversationId: string | null;
  isActive: boolean;
  lastMessageAt: string | null;
}> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('wa_messages')
    .select('conversation_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { conversationId: null, isActive: false, lastMessageAt: null };
  }

  const ageMs = Date.now() - new Date(data.created_at).getTime();
  return {
    conversationId: data.conversation_id || null,
    isActive: ageMs < FOUR_HOURS_MS,
    lastMessageAt: data.created_at,
  };
}

/**
 * Load all messages for a given conversation_id, oldest first.
 * Returns an empty array if conversation_id is null.
 */
export async function getThreadMessages(
  userId: string,
  conversationId: string | null,
  opts: { limit?: number } = {}
): Promise<ThreadMessage[]> {
  if (!conversationId) return [];
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('wa_messages')
    .select('id, direction, payload, created_at')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(opts.limit || 200);

  return (data || []).map((m: any) => ({
    id: m.id,
    direction: m.direction as 'incoming' | 'outgoing',
    body: extractBody(m.payload),
    created_at: m.created_at,
  })).filter(m => m.body.length > 0);
}

/**
 * Find conversations that have ended (no message in last `gapMinutes` minutes)
 * and have not yet been summarized into the user's phi_profile.
 *
 * Returns one row per (user_id, conversation_id) pair.
 */
export async function findClosedUnsummarizedConversations(opts: {
  gapMinutes?: number;
  limit?: number;
} = {}): Promise<Array<{ userId: string; conversationId: string; messageCount: number; startedAt: string; endedAt: string }>> {
  const supabase = createServiceClient();
  const gap = opts.gapMinutes ?? 240; // 4h default
  const cutoff = new Date(Date.now() - gap * 60 * 1000).toISOString();

  // Conversations whose latest message is older than cutoff = closed
  const { data, error } = await supabase.rpc('find_closed_conversations', {
    p_cutoff: cutoff,
    p_limit: opts.limit || 50,
  });

  if (error) {
    // Fallback: do it client-side if the RPC doesn't exist yet
    const { data: closed } = await supabase
      .from('wa_messages')
      .select('user_id, conversation_id, created_at')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (!closed) return [];

    const groups = new Map<string, { userId: string; conversationId: string; messages: string[] }>();
    for (const m of closed) {
      if (!m.conversation_id || !m.user_id) continue;
      const key = `${m.user_id}|${m.conversation_id}`;
      const existing = groups.get(key);
      if (existing) existing.messages.push(m.created_at);
      else groups.set(key, { userId: m.user_id, conversationId: m.conversation_id, messages: [m.created_at] });
    }

    return Array.from(groups.values()).map(g => ({
      userId: g.userId,
      conversationId: g.conversationId,
      messageCount: g.messages.length,
      startedAt: g.messages[g.messages.length - 1],
      endedAt: g.messages[0],
    }));
  }

  return (data || []).map((r: any) => ({
    userId: r.user_id,
    conversationId: r.conversation_id,
    messageCount: r.message_count,
    startedAt: r.started_at,
    endedAt: r.ended_at,
  }));
}
