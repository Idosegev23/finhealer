import { ConversationContext, ConversationState, OngoingTask } from "@/types/conversation";
import { createClient } from "@/lib/supabase/server";

/**
 * Context Manager for conversation state persistence
 * Uses Supabase for persistent storage
 */

export interface StoredContext {
  user_id: string;
  current_state: ConversationState;
  ongoing_task?: OngoingTask;
  task_progress?: number;
  last_interaction: string;
  user_mood?: string;
  pending_questions: any[];
  waiting_for_document?: string;
  previous_response_id?: string;
  metadata?: any;
}

/**
 * Save conversation context to database
 */
export async function saveContext(context: ConversationContext): Promise<void> {
  try {
    const supabase = await createClient();

    const stored: StoredContext = {
      user_id: context.userId,
      current_state: context.currentState,
      ongoing_task: context.ongoingTask,
      task_progress: context.taskProgress,
      last_interaction: context.lastInteraction.toISOString(),
      user_mood: context.userMood,
      pending_questions: context.pendingQuestions,
      waiting_for_document: context.waitingForDocument,
      previous_response_id: context.previousResponseId,
      metadata: (context as any).metadata, // 🆕 שמירת metadata (כולל collectedData)
    };

    // Upsert to conversation_context table
    const { error } = await supabase
      .from("conversation_context")
      .upsert(stored, {
        onConflict: "user_id",
      });

    if (error) {
      console.error("Error saving context:", error);
      throw error;
    }
  } catch (error) {
    console.error("Failed to save context:", error);
    // Don't throw - we want conversation to continue even if save fails
  }
}

/**
 * Load conversation context from database
 */
export async function loadContext(userId: string): Promise<ConversationContext | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("conversation_context")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return null;
    }

    const stored = data as StoredContext;

    const context: ConversationContext & { metadata?: any } = {
      userId: stored.user_id,
      currentState: stored.current_state,
      ongoingTask: stored.ongoing_task,
      taskProgress: stored.task_progress,
      lastInteraction: new Date(stored.last_interaction),
      userMood: stored.user_mood as any,
      pendingQuestions: stored.pending_questions || [],
      waitingForDocument: stored.waiting_for_document as any,
      previousResponseId: stored.previous_response_id,
      metadata: stored.metadata, // 🆕 קריאת metadata (כולל collectedData)
    };

    return context as ConversationContext;
  } catch (error) {
    console.error("Failed to load context:", error);
    return null;
  }
}

/**
 * Create new conversation context for user
 */
export async function createContext(userId: string): Promise<ConversationContext> {
  const context: ConversationContext = {
    userId,
    currentState: "idle",
    lastInteraction: new Date(),
    pendingQuestions: [],
  };

  await saveContext(context);
  return context;
}

/**
 * Update context with partial updates
 */
export async function updateContext(
  userId: string,
  updates: Partial<ConversationContext>
): Promise<ConversationContext> {
  const existing = await loadContext(userId);
  
  // 🔧 תיקון: גם אם אין context קיים, יישם את ה-updates
  const base: ConversationContext = existing || {
    userId,
    currentState: "idle",
    lastInteraction: new Date(),
    pendingQuestions: [],
  };

  const updated: ConversationContext = {
    ...base,
    ...updates,
    lastInteraction: new Date(),
  };

  // 🆕 העתק גם metadata אם יש
  if ((updates as any).metadata) {
    (updated as any).metadata = {
      ...(base as any).metadata,
      ...(updates as any).metadata,
    };
  }

  await saveContext(updated);
  return updated;
}

/**
 * Clear context (reset conversation)
 */
export async function clearContext(userId: string): Promise<void> {
  try {
    const supabase = await createClient();

    await supabase
      .from("conversation_context")
      .delete()
      .eq("user_id", userId);
  } catch (error) {
    console.error("Failed to clear context:", error);
  }
}

/**
 * Get or create context for user
 */
export async function getOrCreateContext(userId: string): Promise<ConversationContext> {
  let context = await loadContext(userId);
  
  if (!context) {
    context = await createContext(userId);
  }

  return context;
}

/**
 * Check if context is stale (no interaction for too long)
 */
export function isContextStale(context: ConversationContext): boolean {
  const hoursSinceLastInteraction =
    (Date.now() - context.lastInteraction.getTime()) / (1000 * 60 * 60);
  
  // Consider stale if no interaction for 24 hours
  return hoursSinceLastInteraction > 24;
}

/**
 * Resume stale context with a friendly message
 */
export async function resumeStaleContext(
  userId: string
): Promise<{ context: ConversationContext; message: string }> {
  const context = await loadContext(userId);
  
  if (!context) {
    const newContext = await createContext(userId);
    return {
      context: newContext,
      message: "היי! שמח לראות אותך 👋 מה נשמע?",
    };
  }

  const hoursSince =
    (Date.now() - context.lastInteraction.getTime()) / (1000 * 60 * 60);
  
  let message = "ברוכים השבים! 😊";
  
  if (hoursSince > 168) {
    // More than a week
    message = "וואו! מזמן לא דיברנו! מה חדש? 😊";
  } else if (hoursSince > 48) {
    // More than 2 days
    message = "היי! שמח שחזרת 👋 איך היה?";
  }

  // Resume ongoing task if exists
  if (context.ongoingTask) {
    const remaining = 
      context.ongoingTask.totalItems - context.ongoingTask.completedItems;
    
    message += `\n\nיש לנו ${remaining} תנועות שהשארנו באמצע. רוצה להמשיך?`;
  }

  // Update last interaction
  await updateContext(userId, { lastInteraction: new Date() });

  return { context, message };
}

/**
 * Track consecutive postponements
 */
export async function trackPostponement(userId: string): Promise<number> {
  try {
    const supabase = await createClient();

    // Get current count
    const { data } = await supabase
      .from("conversation_context")
      .select("metadata")
      .eq("user_id", userId)
      .single();

    const currentCount = data?.metadata?.consecutive_postponements || 0;
    const newCount = currentCount + 1;

    // Update count
    await supabase
      .from("conversation_context")
      .update({
        metadata: {
          ...data?.metadata,
          consecutive_postponements: newCount,
          last_postponement: new Date().toISOString(),
        },
      })
      .eq("user_id", userId);

    return newCount;
  } catch (error) {
    console.error("Failed to track postponement:", error);
    return 0;
  }
}

/**
 * Reset postponement counter
 */
export async function resetPostponementCounter(userId: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { data } = await supabase
      .from("conversation_context")
      .select("metadata")
      .eq("user_id", userId)
      .single();

    await supabase
      .from("conversation_context")
      .update({
        metadata: {
          ...data?.metadata,
          consecutive_postponements: 0,
        },
      })
      .eq("user_id", userId);
  } catch (error) {
    console.error("Failed to reset postponement counter:", error);
  }
}

/**
 * Get conversation statistics for user
 */
export async function getConversationStats(userId: string): Promise<{
  totalMessages: number;
  lastActive: Date;
  averageResponseTime: number;
  completedTasks: number;
}> {
  try {
    const supabase = await createClient();

    const { data: messages } = await supabase
      .from("conversation_history")
      .select("timestamp, role")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false });

    if (!messages || messages.length === 0) {
      return {
        totalMessages: 0,
        lastActive: new Date(),
        averageResponseTime: 0,
        completedTasks: 0,
      };
    }

    // Calculate average response time
    let totalResponseTime = 0;
    let responseCount = 0;

    for (let i = 1; i < messages.length; i++) {
      if (messages[i].role === "user" && messages[i - 1].role === "assistant") {
        const userTime = new Date(messages[i].timestamp).getTime();
        const assistantTime = new Date(messages[i - 1].timestamp).getTime();
        totalResponseTime += userTime - assistantTime;
        responseCount++;
      }
    }

    const averageResponseTime =
      responseCount > 0 ? totalResponseTime / responseCount / 1000 : 0; // in seconds

    return {
      totalMessages: messages.length,
      lastActive: new Date(messages[0].timestamp),
      averageResponseTime,
      completedTasks: 0, // TODO: Track completed tasks
    };
  } catch (error) {
    console.error("Failed to get conversation stats:", error);
    return {
      totalMessages: 0,
      lastActive: new Date(),
      averageResponseTime: 0,
      completedTasks: 0,
    };
  }
}

export default {
  saveContext,
  loadContext,
  createContext,
  updateContext,
  clearContext,
  getOrCreateContext,
  isContextStale,
  resumeStaleContext,
  trackPostponement,
  resetPostponementCounter,
  getConversationStats,
};

