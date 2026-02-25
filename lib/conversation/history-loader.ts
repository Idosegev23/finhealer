/**
 * Conversation History Loader
 *
 * Loads last N messages for a user from wa_messages table
 * for use as Gemini conversation context.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { ConversationMessage } from '@/lib/ai/gemini-client';

/**
 * Load recent WhatsApp conversation history for a user
 *
 * @param userId - User ID
 * @param limit - Max number of messages to load (default 10)
 * @returns Array of messages in chronological order (oldest first)
 */
export async function loadConversationHistory(
  userId: string,
  limit: number = 10
): Promise<ConversationMessage[]> {
  try {
    const supabase = createServiceClient();

    const { data: messages, error } = await supabase
      .from('wa_messages')
      .select('direction, msg_type, payload')
      .eq('user_id', userId)
      .eq('msg_type', 'text')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[HistoryLoader] Error loading history:', error);
      return [];
    }

    if (!messages || messages.length === 0) {
      return [];
    }

    // Map to Gemini format and reverse (oldest first)
    const history: ConversationMessage[] = [];

    for (const msg of messages) {
      const text = extractTextFromPayload(msg.payload);
      if (!text) continue;

      history.push({
        role: msg.direction === 'incoming' ? 'user' : 'model',
        content: text,
      });
    }

    // Reverse: DB gives newest first, Gemini needs oldest first
    history.reverse();

    return history;
  } catch (error) {
    console.error('[HistoryLoader] Unexpected error:', error);
    return [];
  }
}

/**
 * Extract text content from wa_messages payload JSON
 * The payload structure varies by message type
 */
function extractTextFromPayload(payload: any): string | null {
  if (!payload) return null;

  // Direct text field (outgoing messages often have this)
  if (typeof payload.text === 'string' && payload.text) {
    return payload.text;
  }

  // Incoming text message format from GreenAPI
  if (payload.messageData?.textMessageData?.textMessage) {
    return payload.messageData.textMessageData.textMessage;
  }

  // Extended text message (with link preview etc.)
  if (payload.messageData?.extendedTextMessageData?.text) {
    return payload.messageData.extendedTextMessageData.text;
  }

  // Button response
  if (payload.messageData?.interactiveButtonsResponse?.selectedButtonText) {
    return payload.messageData.interactiveButtonsResponse.selectedButtonText;
  }

  // Fallback: try message field
  if (typeof payload.message === 'string' && payload.message) {
    return payload.message;
  }

  return null;
}

/**
 * Load chat_messages history (for dashboard chat, not WhatsApp)
 */
export async function loadChatHistory(
  userId: string,
  limit: number = 10
): Promise<ConversationMessage[]> {
  try {
    const supabase = createServiceClient();

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !messages) return [];

    return messages
      .reverse()
      .map((msg) => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        content: msg.content,
      }));
  } catch (error) {
    console.error('[HistoryLoader] Chat history error:', error);
    return [];
  }
}
