/**
 * Conversation History Manager
 * 
 * Manages loading and formatting conversation history for AI context.
 * Uses wa_messages table to fetch recent messages.
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

/**
 * Get recent conversation history for a user
 * @param userId - The user's ID
 * @param limit - Maximum number of messages to retrieve (default: 15)
 * @returns Array of messages in chronological order
 */
export async function getRecentHistory(
  userId: string,
  limit: number = 15
): Promise<HistoryMessage[]> {
  try {
    const supabase = createServiceClient();

    const { data: messages, error } = await supabase
      .from('wa_messages')
      .select('direction, payload, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[History Manager] Error fetching history:', error);
      return [];
    }

    if (!messages || messages.length === 0) {
      return [];
    }

    // Convert to HistoryMessage format and reverse to chronological order
    const history: HistoryMessage[] = messages
      .map((msg) => {
        // Extract content from payload
        let content = '';
        if (typeof msg.payload === 'object' && msg.payload !== null) {
          // Try different payload structures
          content = 
            (msg.payload as any).text || 
            (msg.payload as any).body || 
            (msg.payload as any).messageData?.textMessageData?.textMessage ||
            (msg.payload as any).messageData?.extendedTextMessageData?.text ||
            '';
        } else if (typeof msg.payload === 'string') {
          content = msg.payload;
        }

        // Skip empty messages or document messages
        if (!content || content.length === 0) {
          return null;
        }

        return {
          role: msg.direction === 'incoming' ? 'user' : 'assistant',
          content: content,
          timestamp: new Date(msg.created_at),
        } as HistoryMessage;
      })
      .filter((msg): msg is HistoryMessage => msg !== null)
      .reverse(); // Chronological order

    console.log(`[History Manager] Loaded ${history.length} messages for user ${userId}`);
    return history;
  } catch (error) {
    console.error('[History Manager] Exception:', error);
    return [];
  }
}

/**
 * Format history for OpenAI API
 * @param history - Array of HistoryMessage
 * @returns Formatted string for AI context
 */
export function formatHistoryForAI(history: HistoryMessage[]): string {
  if (history.length === 0) {
    return '';
  }

  const formatted = history
    .map((msg) => {
      const role = msg.role === 'user' ? 'משתמש' : 'φ';
      // Truncate very long messages
      const content = msg.content.length > 500 
        ? msg.content.substring(0, 500) + '...' 
        : msg.content;
      return `${role}: ${content}`;
    })
    .join('\n');

  return `=== היסטוריית שיחה אחרונה ===\n${formatted}`;
}

/**
 * Get history formatted for direct use with OpenAI messages array
 * @param userId - The user's ID
 * @param limit - Maximum number of messages
 * @returns Array ready for OpenAI messages parameter
 */
export async function getHistoryForOpenAI(
  userId: string,
  limit: number = 10
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const history = await getRecentHistory(userId, limit);
  
  return history.map((msg) => ({
    role: msg.role,
    content: msg.content.length > 500 
      ? msg.content.substring(0, 500) + '...' 
      : msg.content,
  }));
}

/**
 * Calculate approximate token count for history
 * (Rough estimate: ~4 chars per token for Hebrew)
 */
export function estimateTokenCount(history: HistoryMessage[]): number {
  const totalChars = history.reduce((sum, msg) => sum + msg.content.length, 0);
  return Math.ceil(totalChars / 4);
}

/**
 * Trim history to fit within token budget
 * @param history - Full history
 * @param maxTokens - Maximum tokens allowed for history
 * @returns Trimmed history
 */
export function trimHistoryToTokenBudget(
  history: HistoryMessage[],
  maxTokens: number = 2000
): HistoryMessage[] {
  let totalTokens = 0;
  const trimmed: HistoryMessage[] = [];

  // Start from most recent and work backwards
  for (let i = history.length - 1; i >= 0; i--) {
    const msgTokens = Math.ceil(history[i].content.length / 4);
    if (totalTokens + msgTokens > maxTokens) {
      break;
    }
    totalTokens += msgTokens;
    trimmed.unshift(history[i]);
  }

  return trimmed;
}

export default {
  getRecentHistory,
  formatHistoryForAI,
  getHistoryForOpenAI,
  estimateTokenCount,
  trimHistoryToTokenBudget,
};

