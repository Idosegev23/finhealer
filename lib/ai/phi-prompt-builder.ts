/**
 * Phi Prompt Builder
 * 
 * בונה את ה-prompt המלא לשליחה ל-GPT.
 * כולל system prompt, context, והודעת המשתמש.
 */

import { PhiFullContext, getCurrentState, formatCurrency } from './phi-context-loader';
import { getSystemPromptForState } from './phi-system-prompt';

// ============================================================================
// Types
// ============================================================================

export interface BuiltPrompt {
  systemPrompt: string;
  userMessage: string;
  contextJson: string;
}

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * בונה את ה-prompt המלא לשליחה ל-AI
 */
export function buildPrompt(
  context: PhiFullContext,
  userMessage: string
): BuiltPrompt {
  const currentState = getCurrentState(context);
  const systemPrompt = getSystemPromptForState(currentState);
  
  // Build context JSON
  const contextJson = buildContextJson(context, currentState);
  
  // Build user message with context
  const fullUserMessage = buildUserMessage(context, userMessage, currentState);
  
  return {
    systemPrompt,
    userMessage: fullUserMessage,
    contextJson,
  };
}

// ============================================================================
// Context JSON Builder
// ============================================================================

function buildContextJson(context: PhiFullContext, currentState: string): string {
  const contextObj: Record<string, unknown> = {
    state: currentState,
    user: {
      name: context.user.name || null,
    },
  };
  
  // Add classification context if relevant
  if (currentState === 'classification' && context.classification.currentTransaction) {
    const tx = context.classification.currentTransaction;
    contextObj.current_transaction = {
      id: tx.id,
      amount: tx.amount,
      vendor: tx.vendor,
      date: tx.date,
      type: tx.type,
      suggested_category: tx.suggestedCategory,
    };
    contextObj.remaining_transactions = context.classification.remainingCount;
    
    // Add next transaction preview if available
    if (context.pendingTransactions.length > 1) {
      const nextTx = context.pendingTransactions[1];
      contextObj.next_transaction = {
        amount: nextTx.amount,
        vendor: nextTx.vendor,
        date: nextTx.date,
        type: nextTx.type,
      };
    }
  }
  
  // Add financial summary if available
  if (context.financialSummary) {
    contextObj.financial_summary = {
      total_income: context.financialSummary.totalIncome,
      total_expenses: context.financialSummary.totalExpenses,
      balance: context.financialSummary.balance,
    };
  }
  
  // Add learned patterns (for auto-suggest)
  if (Object.keys(context.learnedPatterns).length > 0) {
    contextObj.learned_patterns = context.learnedPatterns;
  }
  
  // Add recently skipped transactions (for memory)
  if (context.recentlySkipped && context.recentlySkipped.length > 0) {
    contextObj.recently_skipped = context.recentlySkipped;
    contextObj.skip_count = context.recentlySkipped.length;
  }
  
  // Add last bot message (for understanding "כן" = same as before)
  if (context.lastBotMessage) {
    contextObj.last_bot_message = context.lastBotMessage.substring(0, 300);
  }
  
  // Add recent messages (last 10 for context)
  if (context.recentMessages.length > 0) {
    contextObj.recent_messages = context.recentMessages.slice(-10).map(m => ({
      role: m.role,
      content: m.content.substring(0, 200), // Truncate long messages
    }));
  }
  
  return JSON.stringify(contextObj, null, 2);
}

// ============================================================================
// User Message Builder
// ============================================================================

function buildUserMessage(
  context: PhiFullContext,
  userMessage: string,
  currentState: string
): string {
  let message = '';
  
  // Add context header
  message += '## Context (JSON)\n```json\n';
  message += buildContextJson(context, currentState);
  message += '\n```\n\n';
  
  // Add state-specific instructions
  message += getStateSpecificHeader(context, currentState);
  
  // Add user message
  message += `## הודעת המשתמש\n"${userMessage}"\n\n`;
  
  // Add reminder
  message += '## תזכורת\nהחזר JSON תקף בלבד עם message, actions, new_state.';
  
  return message;
}

// ============================================================================
// State-Specific Headers
// ============================================================================

function getStateSpecificHeader(context: PhiFullContext, state: string): string {
  switch (state) {
    case 'waiting_for_name':
      return `## מה לעשות
אם ההודעה נראית כמו שם (מילה או שתיים באותיות עברית/אנגלית) - קבל אותו ובקש מסמך.
אחרת - שאל שוב מה השם בנימוס.

`;
    
    case 'waiting_for_document':
      return `## מה לעשות
${context.user.name ? `המשתמש הוא ${context.user.name}. ` : ''}
אנחנו מחכים שישלח דוח בנק או אשראי (PDF).
עודד אותו לשלוח. אם הוא שואל משהו - ענה וחזור לבקשה.

`;
    
    case 'classification':
      if (!context.classification.currentTransaction) {
        return `## מה לעשות
אין יותר תנועות לסיווג! הודע למשתמש שסיימנו ועבור ל-monitoring.

`;
      }
      
      const tx = context.classification.currentTransaction;
      const remaining = context.classification.remainingCount;
      
      return `## מה לעשות
סווג את התנועה הנוכחית לפי תשובת המשתמש.
התנועה הנוכחית: ${formatCurrency(tx.amount)} | ${tx.vendor} | ${tx.date} | ${tx.type === 'income' ? 'הכנסה' : 'הוצאה'}
נשארו: ${remaining} תנועות

אם המשתמש מאשר/מסווג - שמור ועבור לבאה.
אם לא ברור - שאל שאלת הבהרה קצרה.
אם מבקש לדלג - דלג ועבור לבאה.

`;
    
    case 'monitoring':
    default:
      return `## מה לעשות
${context.user.name ? `המשתמש הוא ${context.user.name}. ` : ''}
ענה על השאלה או הבקשה שלו.
אם הוא רוצה סיכום - תן סיכום קצר.
אם הוא שואל על משהו ספציפי - ענה.

`;
  }
}

// ============================================================================
// Response Parsing
// ============================================================================

export interface PhiAIResponse {
  message: string;
  actions: Array<{
    type: string;
    data?: Record<string, unknown>;
    id?: string;
    category?: string;
    vendor?: string;
    reason?: string;
    doc_type?: string;
    state?: string;
  }>;
  new_state: string | null;
}

/**
 * מפרש את תשובת ה-AI מ-JSON
 */
export function parseAIResponse(responseText: string): PhiAIResponse {
  try {
    // נסה לחלץ JSON מהתשובה
    let jsonStr = responseText.trim();
    
    // אם יש ```json ... ``` - חלץ את התוכן
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    // אם מתחיל ב-{ - נסה לפרש
    if (!jsonStr.startsWith('{')) {
      const firstBrace = jsonStr.indexOf('{');
      if (firstBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace);
      }
    }
    
    const parsed = JSON.parse(jsonStr);
    
    // Validate required fields
    if (!parsed.message || typeof parsed.message !== 'string') {
      throw new Error('Missing or invalid message field');
    }
    
    return {
      message: parsed.message,
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      new_state: parsed.new_state || null,
    };
  } catch (error) {
    console.error('[PromptBuilder] Failed to parse AI response:', error);
    console.error('[PromptBuilder] Raw response:', responseText.substring(0, 500));
    
    // Return a safe fallback
    return {
      message: responseText.includes('"message"') 
        ? 'סליחה, משהו השתבש. נסה שוב? 🤔'
        : responseText.substring(0, 500), // Maybe it's just plain text
      actions: [],
      new_state: null,
    };
  }
}

export default { buildPrompt, parseAIResponse };

