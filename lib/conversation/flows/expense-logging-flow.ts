import { chatWithGPT5, chatWithGPT5Fast } from "@/lib/ai/gpt5-client";
import { parseIntent } from "@/lib/ai/intent-parser";
import { PHI_COACH_SYSTEM_PROMPT } from "@/lib/ai/prompts/phi-coach-system";
import { ConversationContext, UserContext } from "@/types/conversation";
import { recordCorrection } from "@/lib/learning/smart-corrections";
import { matchTransaction } from "@/lib/learning/pattern-detector";

/**
 * Expense Logging Flow
 * Handles the natural conversation flow for logging expenses
 */

export interface ExpenseData {
  amount: number;
  description?: string;
  category?: string;
  merchant?: string;
  date?: Date;
  confidence: number;
}

/**
 * Handle expense logging conversation
 */
export async function handleExpenseLogging(
  userMessage: string,
  userContext: UserContext,
  conversationContext: ConversationContext
): Promise<{
  response: string;
  expenseData?: ExpenseData;
  requiresConfirmation: boolean;
  nextAction?: string;
}> {
  // Parse intent and entities from message
  const intent = await parseIntent(userMessage, conversationContext);

  if (intent.type !== "expense_log") {
    return {
      response: "לא זיהיתי הוצאה בהודעה. תנסה לכתוב משהו כמו: '50 שקל קפה' 😊",
      requiresConfirmation: false,
    };
  }

  // Extract expense data from entities
  const expenseData = extractExpenseData(intent.entities as any);

  if (!expenseData.amount) {
    return {
      response: "לא הבנתי את הסכום. כמה זה עלה? 🤔",
      requiresConfirmation: false,
      nextAction: "wait_for_amount",
    };
  }

  // Try to match with learned patterns
  const match = await matchTransaction(userContext.userId, {
    merchant: expenseData.merchant,
    amount: expenseData.amount,
    description: expenseData.description,
  });

  if (match.category) {
    expenseData.category = match.category;
    expenseData.confidence = match.confidence;
  }

  // Generate confirmation message
  const confirmationMessage = generateConfirmationMessage(expenseData);

  return {
    response: confirmationMessage,
    expenseData,
    requiresConfirmation: expenseData.confidence < 0.95,
    nextAction: "wait_for_confirmation",
  };
}

/**
 * Handle expense correction
 */
export async function handleExpenseCorrection(
  userMessage: string,
  originalExpense: ExpenseData,
  userContext: UserContext
): Promise<{
  response: string;
  correctedExpense: ExpenseData;
}> {
  // Parse the correction
  const intent = await parseIntent(userMessage);
  const entities = intent.entities as any[];

  // Update expense data with corrections
  const correctedExpense = { ...originalExpense };

  for (const entity of entities) {
    if (entity.type === "amount") {
      correctedExpense.amount = entity.value;
      
      // Record correction
      await recordCorrection(
        userContext.userId,
        "amount",
        { amount: originalExpense.amount },
        { amount: entity.value }
      );
    } else if (entity.type === "category") {
      correctedExpense.category = entity.value;
      
      // Record correction
      await recordCorrection(
        userContext.userId,
        "category",
        { category: originalExpense.category, merchant: originalExpense.merchant },
        { category: entity.value, merchant: originalExpense.merchant }
      );
    } else if (entity.type === "merchant" || entity.type === "description") {
      correctedExpense.description = entity.value;
    }
  }

  const response = `אוקיי תיקנתי! ✓\n\n${formatExpenseSummary(correctedExpense)}`;

  return {
    response,
    correctedExpense,
  };
}

/**
 * Extract expense data from entities
 */
function extractExpenseData(entities: any[]): ExpenseData {
  const data: ExpenseData = {
    amount: 0,
    confidence: 0.7,
    date: new Date(),
  };

  for (const entity of entities) {
    switch (entity.type) {
      case "amount":
        data.amount = entity.value;
        break;
      case "merchant":
        data.merchant = entity.value;
        break;
      case "category":
        data.category = entity.value;
        break;
      case "description":
        data.description = entity.value;
        break;
      case "date":
        if (typeof entity.value === "string") {
          data.date = parseDateEntity(entity.value);
        } else {
          data.date = entity.value;
        }
        break;
    }
  }

  return data;
}

/**
 * Parse date entity
 */
function parseDateEntity(value: string): Date {
  const today = new Date();

  switch (value) {
    case "today":
      return today;
    case "yesterday":
      return new Date(today.setDate(today.getDate() - 1));
    case "current_week":
      return today;
    default:
      return today;
  }
}

/**
 * Generate confirmation message
 */
function generateConfirmationMessage(expense: ExpenseData): string {
  const parts: string[] = [];

  if (expense.confidence >= 0.8) {
    parts.push("רשמתי");
  } else {
    parts.push("רגע, רק לוודא:");
  }

  // Amount
  parts.push(`${expense.amount} ₪`);

  // Description/Merchant
  if (expense.merchant) {
    parts.push(`ב${expense.merchant}`);
  } else if (expense.description) {
    parts.push(`על ${expense.description}`);
  }

  // Category
  if (expense.category && expense.confidence >= 0.6) {
    parts.push(`(${expense.category})`);
  }

  const message = parts.join(" ");

  // Add confirmation question if needed
  if (expense.confidence < 0.8) {
    return `${message}\n\nנכון?`;
  }

  return `${message}. נכון?`;
}

/**
 * Format expense summary
 */
function formatExpenseSummary(expense: ExpenseData): string {
  const parts: string[] = [`💰 ${expense.amount} ₪`];

  if (expense.merchant) {
    parts.push(`🏪 ${expense.merchant}`);
  }

  if (expense.category) {
    parts.push(`📂 ${expense.category}`);
  }

  if (expense.date && !isToday(expense.date)) {
    parts.push(`📅 ${expense.date.toLocaleDateString("he-IL")}`);
  }

  return parts.join("\n");
}

/**
 * Check if date is today
 */
function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Generate random confirmation phrase
 */
export function getRandomConfirmation(): string {
  const phrases = [
    "נכון?",
    "זה נכון?",
    "מסכים?",
    "יופי?",
    "אישור?",
    "זה זה?",
    "בסדר?",
  ];

  return phrases[Math.floor(Math.random() * phrases.length)];
}

export default {
  handleExpenseLogging,
  handleExpenseCorrection,
  generateConfirmationMessage,
  formatExpenseSummary,
};

