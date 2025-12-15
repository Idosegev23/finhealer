/**
 * φ Handler - מטפל בהודעות WhatsApp עם AI-first approach
 * 
 * כל ההחלטות מתקבלות ע"י AI עם context מלא
 */

import { thinkAndRespond, executeActions, loadPhiContext, type PhiContext, type PhiAction } from './phi-brain';
import { createServiceClient } from '@/lib/supabase/server';

// Feature flag - האם להשתמש ב-AI Orchestrator
const USE_AI_ORCHESTRATOR = process.env.USE_AI_ORCHESTRATOR === 'true';

export interface PhiHandlerResult {
  message: string;
  actions: PhiAction[];
  shouldWaitForResponse: boolean;
}

/**
 * טיפול בהודעת טקסט עם AI Orchestrator
 */
export async function handleWithPhi(
  userId: string,
  userMessage: string,
  phoneNumber: string
): Promise<PhiHandlerResult> {
  console.log('[φ Handler] Processing message with AI Orchestrator');

  // 1. טען context מלא
  const context = await loadPhiContext(userId);
  
  // 2. תן ל-AI לחשוב ולהחליט
  const response = await thinkAndRespond(userMessage, context);
  
  // 3. בצע את הפעולות שה-AI החליט עליהן
  if (response.actions.length > 0) {
    await executeActions(response.actions, context);
  }
  
  // 4. שמור את ההודעה ביומן
  await saveMessage(userId, 'incoming', userMessage);
  if (response.message) {
    await saveMessage(userId, 'outgoing', response.message);
  }
  
  return {
    message: response.message,
    actions: response.actions,
    shouldWaitForResponse: response.shouldWaitForResponse,
  };
}

/**
 * טיפול במסמך (PDF/תמונה) עם AI
 */
export async function handleDocumentWithPhi(
  userId: string,
  documentUrl: string,
  documentType: 'pdf' | 'image',
  phoneNumber: string
): Promise<PhiHandlerResult> {
  console.log('[φ Handler] Processing document with AI Orchestrator');

  // כאן נטפל במסמך
  // לעכשיו נשתמש בלוגיקה הקיימת ורק נשלח הודעת אישור דרך AI
  
  const context = await loadPhiContext(userId);
  
  // הודעה זמנית - נשפר אחר כך
  const response = await thinkAndRespond(
    `המשתמש שלח מסמך מסוג ${documentType}. עדכן אותו שקיבלת ושאתה מנתח.`,
    context
  );
  
  return {
    message: response.message || 'קיבלתי את המסמך! מנתח עכשיו... ⏳',
    actions: response.actions,
    shouldWaitForResponse: false,
  };
}

/**
 * בדיקה האם להשתמש ב-AI Orchestrator
 */
export function shouldUsePhiOrchestrator(): boolean {
  return USE_AI_ORCHESTRATOR;
}

/**
 * שמירת הודעה ביומן
 */
async function saveMessage(
  userId: string,
  direction: 'incoming' | 'outgoing',
  content: string
): Promise<void> {
  const supabase = createServiceClient();
  
  try {
    await supabase
      .from('wa_messages')
      .insert({
        user_id: userId,
        direction,
        content,
        message_type: 'text',
        status: 'delivered',
      });
  } catch (error) {
    console.error('[φ Handler] Error saving message:', error);
  }
}

/**
 * 🔄 המרת context ישן לחדש
 * לשימוש במעבר הדרגתי
 */
export async function migrateToPhiContext(
  userId: string,
  oldContext: Record<string, unknown>
): Promise<PhiContext> {
  const baseContext = await loadPhiContext(userId);
  
  // שילוב מידע מה-context הישן אם יש
  if (oldContext.classificationSession) {
    const session = oldContext.classificationSession as Record<string, unknown>;
    baseContext.classificationProgress = {
      done: (session.totalClassified as number) || 0,
      total: ((session.highConfidenceIncome as unknown[])?.length || 0) + 
             ((session.highConfidenceExpenses as unknown[])?.length || 0) +
             ((session.lowConfidenceIncome as unknown[])?.length || 0) +
             ((session.lowConfidenceExpenses as unknown[])?.length || 0),
      highConfidenceCount: ((session.highConfidenceIncome as unknown[])?.length || 0) +
                           ((session.highConfidenceExpenses as unknown[])?.length || 0),
      lowConfidenceCount: ((session.lowConfidenceIncome as unknown[])?.length || 0) +
                          ((session.lowConfidenceExpenses as unknown[])?.length || 0),
    };
  }
  
  return baseContext;
}

export default {
  handleWithPhi,
  handleDocumentWithPhi,
  shouldUsePhiOrchestrator,
  migrateToPhiContext,
};

