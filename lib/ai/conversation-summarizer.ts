/**
 * Conversation Summarizer
 *
 * Compresses a closed conversation thread into a structured summary kept in
 * `users.classification_context.phi_profile.recent_conversations[]` (rolling 10).
 *
 * The summary is what the brain reads on the *next* conversation to recall
 * "what we talked about last time" without replaying the full transcript.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { chatStructured } from './gemini-client';
import { createServiceClient } from '@/lib/supabase/server';
import { getThreadMessages } from '@/lib/conversation/threading';

// ============================================================================
// Schema — what Gemini must return
// ============================================================================

const MoodEnum = z.enum(['positive', 'neutral', 'concerned', 'anxious', 'frustrated', 'unclear']);

export const ConversationSummarySchema = z.object({
  topics: z.array(z.string()).describe('2-5 high-level topics discussed (Hebrew). Examples: "תקציב", "הלוואות", "חרדה כלכלית", "תכנון יעדים".'),
  user_mood: MoodEnum.describe('Overall mood inferred from the user side of the conversation.'),
  key_facts: z.array(z.string()).describe('1-7 short factual statements about the user that are worth remembering. Each in Hebrew, third person. Example: "יש 3 הלוואות פעילות", "מתכננת לסגור הלוואה הכי גדולה ראשונה".'),
  open_threads: z.array(z.string()).describe('Things left unresolved that the bot should follow up on next time. In Hebrew. Empty array if none.'),
  outcome: z.string().describe('One short Hebrew sentence summarizing how the conversation ended: did the user act, ask, vent, ignore?'),
  confidence: z.number().min(0).max(1).describe('How confident the summary is. < 0.4 means the conversation was too short or unclear to summarize meaningfully.'),
});

export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export interface StoredSummary extends ConversationSummary {
  conversation_id: string;
  started_at: string;
  ended_at: string;
  message_count: number;
  summarized_at: string;
}

const RECENT_CONVERSATIONS_LIMIT = 10;

// ============================================================================
// Public API
// ============================================================================

/**
 * Summarize a single conversation thread and append it to the user's
 * phi_profile.recent_conversations (rolling cap of 10).
 *
 * Returns the stored summary, or null if the thread was too thin to summarize
 * (< 4 useful turns) or summarizer confidence was too low.
 */
export async function summarizeAndStore(
  userId: string,
  conversationId: string
): Promise<StoredSummary | null> {
  const messages = await getThreadMessages(userId, conversationId, { limit: 300 });

  // Skip threads that don't have enough material — likely a single notification
  // burst, button click, or one-shot command.
  const userTurns = messages.filter(m => m.direction === 'incoming').length;
  if (messages.length < 4 || userTurns < 1) {
    return null;
  }

  const transcript = messages
    .map(m => `${m.direction === 'incoming' ? 'משתמש' : 'φ'}: ${m.body.replace(/\s+/g, ' ').trim()}`)
    .join('\n');

  const schema = zodToJsonSchema(ConversationSummarySchema, { target: 'jsonSchema7' });

  let summary: ConversationSummary;
  try {
    summary = await chatStructured<ConversationSummary>(
      transcript,
      [
        'אתה עוזר שמסכם שיחות וואטסאפ בין משתמש לבין φ — מאמן פיננסי אישי.',
        'המטרה: לכתוב סיכום קצר שאפשר להזרים בשיחה הבאה כדי לשמר רציפות ואישיות.',
        'כתוב בעברית. שמור על דיוק עובדתי — אם משהו לא נאמר במפורש, אל תמציא.',
        'אם השיחה קצרה או לא ברורה, תן confidence נמוך.',
      ].join('\n'),
      schema as any,
      { thinkingLevel: 'low', maxOutputTokens: 1200 }
    );

    // Validate via Zod (guards against schema drift even if API claimed success)
    summary = ConversationSummarySchema.parse(summary);
  } catch (err) {
    console.error('[ConversationSummarizer] failed:', err);
    return null;
  }

  if (summary.confidence < 0.4) {
    console.log(`[ConversationSummarizer] low confidence (${summary.confidence}) for conv ${conversationId} — skipping store`);
    return null;
  }

  const stored: StoredSummary = {
    ...summary,
    conversation_id: conversationId,
    started_at: messages[0]?.created_at || new Date().toISOString(),
    ended_at: messages[messages.length - 1]?.created_at || new Date().toISOString(),
    message_count: messages.length,
    summarized_at: new Date().toISOString(),
  };

  await appendToRecentConversations(userId, stored);
  return stored;
}

/**
 * Read the user's recent conversation summaries (oldest first, cap RECENT_CONVERSATIONS_LIMIT).
 */
export async function getRecentSummaries(userId: string): Promise<StoredSummary[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();
  const list = (data?.classification_context?.phi_profile?.recent_conversations || []) as StoredSummary[];
  return Array.isArray(list) ? list : [];
}

// ============================================================================
// Storage — append + rotate
// ============================================================================

async function appendToRecentConversations(userId: string, summary: StoredSummary): Promise<void> {
  const supabase = createServiceClient();

  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const ctx = (user?.classification_context || {}) as any;
  const profile = (ctx.phi_profile || {}) as any;
  const existing: StoredSummary[] = Array.isArray(profile.recent_conversations) ? profile.recent_conversations : [];

  // Avoid duplicates if we re-summarize the same conversation
  const filtered = existing.filter(s => s.conversation_id !== summary.conversation_id);
  filtered.push(summary);

  // Keep only the most recent N
  const trimmed = filtered.slice(-RECENT_CONVERSATIONS_LIMIT);

  const updatedProfile = { ...profile, recent_conversations: trimmed };
  const updatedCtx = { ...ctx, phi_profile: updatedProfile };

  await supabase
    .from('users')
    .update({ classification_context: updatedCtx })
    .eq('id', userId);
}
