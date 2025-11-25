import { ConversationContext } from "@/types/conversation";
import { isUserTired, isUserBusy } from "@/lib/ai/prompts/conversation-rules";

/**
 * Engagement Manager - Don't Overwhelm Logic
 * Ensures we don't tire or annoy the user
 */

export interface EngagementMetrics {
  questionsAskedToday: number;
  lastQuestionTime: Date;
  consecutiveQuestions: number;
  userResponseSpeed: number; // seconds
  userMood: "engaged" | "tired" | "busy";
  shouldTakeBreak: boolean;
}

// Constants
const MAX_QUESTIONS_PER_DAY = 50;
const MAX_CONSECUTIVE_QUESTIONS = 3;
const MAX_TRANSACTIONS_PER_SESSION = 50;
const MIN_BREAK_DURATION_MINUTES = 60;

/**
 * Check if we should ask more questions
 */
export async function shouldAskMoreQuestions(
  userId: string,
  context: ConversationContext
): Promise<{
  allowed: boolean;
  reason?: string;
  breakDuration?: number;
}> {
  const metrics = await getEngagementMetrics(userId);

  // Check user mood
  if (metrics.userMood === "tired") {
    return {
      allowed: false,
      reason: "user_tired",
      breakDuration: 24 * 60, // 24 hours
    };
  }

  if (metrics.userMood === "busy") {
    return {
      allowed: false,
      reason: "user_busy",
      breakDuration: 60, // 1 hour
    };
  }

  // Check daily limit
  if (metrics.questionsAskedToday >= MAX_QUESTIONS_PER_DAY) {
    return {
      allowed: false,
      reason: "daily_limit_reached",
      breakDuration: 12 * 60, // 12 hours
    };
  }

  // Check consecutive questions
  if (metrics.consecutiveQuestions >= MAX_CONSECUTIVE_QUESTIONS) {
    return {
      allowed: false,
      reason: "too_many_consecutive",
      breakDuration: 5, // 5 minutes
    };
  }

  // Check if user is responding slowly
  if (metrics.userResponseSpeed > 300) {
    // More than 5 minutes
    return {
      allowed: false,
      reason: "slow_responses",
      breakDuration: 60, // 1 hour
    };
  }

  return { allowed: true };
}

/**
 * Get engagement metrics for user
 */
async function getEngagementMetrics(
  userId: string
): Promise<EngagementMetrics> {
  // TODO: Get from database
  // For now, return defaults

  return {
    questionsAskedToday: 0,
    lastQuestionTime: new Date(),
    consecutiveQuestions: 0,
    userResponseSpeed: 30,
    userMood: "engaged",
    shouldTakeBreak: false,
  };
}

/**
 * Determine if we should offer a break
 */
export function shouldOfferBreak(
  questionsAsked: number,
  userMood: "engaged" | "tired" | "busy"
): boolean {
  // Always offer break if user seems tired or busy
  if (userMood === "tired" || userMood === "busy") {
    return true;
  }

  // Offer break every 3 questions for engaged users
  return questionsAsked > 0 && questionsAsked % MAX_CONSECUTIVE_QUESTIONS === 0;
}

/**
 * Generate appropriate break offer message
 */
export function generateBreakOfferMessage(
  remainingQuestions: number,
  userMood: "engaged" | "tired" | "busy"
): string {
  if (userMood === "tired") {
    return "נראה שאתה קצת עייף 😊\nבוא נעצור לעכשיו ונמשיך מחר?";
  }

  if (userMood === "busy") {
    return "נראה שאתה עסוק 😊\nמתי יהיה לך נוח להמשיך?";
  }

  if (remainingQuestions > 20) {
    return `יש לי עוד ${remainingQuestions} שאלות.\nזה הרבה... רוצה הפסקה? 😅`;
  }

  if (remainingQuestions > 10) {
    return `עוד ${remainingQuestions} נשארו.\nממשיכים או עושים הפסקה? ☕`;
  }

  return `יש לי עוד ${remainingQuestions} שאלות.\nבא לך להמשיך או לדחות?`;
}

/**
 * Batch transactions into manageable chunks
 */
export function batchTransactions(
  transactions: any[],
  maxPerSession: number = MAX_TRANSACTIONS_PER_SESSION
): any[][] {
  const batches: any[][] = [];

  for (let i = 0; i < transactions.length; i += maxPerSession) {
    batches.push(transactions.slice(i, i + maxPerSession));
  }

  return batches;
}

/**
 * Generate message for transaction batching
 */
export function generateBatchingMessage(
  totalTransactions: number,
  batchSize: number
): string {
  const batches = Math.ceil(totalTransactions / batchSize);

  if (batches === 1) {
    return `מצאתי ${totalTransactions} תנועות. יש לי כמה שאלות. בא לך?`;
  }

  return `וואו! מצאתי ${totalTransactions} תנועות! 😮
זה הרבה, אז בוא נעשה את זה בנוח.
נתחיל עם ${batchSize} הראשונות. אוקיי?`;
}

/**
 * Track question asked
 */
export async function trackQuestionAsked(
  userId: string,
  questionType: string
): Promise<void> {
  // TODO: Implement tracking in database
  console.log(`Question asked to ${userId}: ${questionType}`);
}

/**
 * Reset consecutive questions counter
 */
export async function resetConsecutiveQuestions(userId: string): Promise<void> {
  // TODO: Implement in database
  console.log(`Reset consecutive questions for ${userId}`);
}

/**
 * Check if it's appropriate time to send message
 */
export function isAppropriateTime(): boolean {
  const hour = new Date().getHours();

  // Don't send messages between 22:00 and 8:00
  if (hour >= 22 || hour < 8) {
    return false;
  }

  return true;
}

/**
 * Get next appropriate time to send message
 */
export function getNextAppropriateTime(): Date {
  const now = new Date();
  const hour = now.getHours();

  if (hour >= 22) {
    // After 22:00 - send tomorrow at 9:00
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  }

  if (hour < 8) {
    // Before 8:00 - send today at 9:00
    const today = new Date(now);
    today.setHours(9, 0, 0, 0);
    return today;
  }

  // During appropriate hours - send now
  return now;
}

/**
 * Detect if user is getting frustrated
 */
export function detectFrustration(messages: string[]): boolean {
  const recentMessages = messages.slice(-5); // Last 5 messages

  const frustrationIndicators = [
    "די",
    "נמאס",
    "מספיק",
    "תפסיק",
    "לא רוצה",
    "למה",
    "כבר אמרתי",
  ];

  let frustrationCount = 0;

  for (const message of recentMessages) {
    const lowerMessage = message.toLowerCase();
    
    for (const indicator of frustrationIndicators) {
      if (lowerMessage.includes(indicator)) {
        frustrationCount++;
        break;
      }
    }
  }

  // If 2 or more frustrated messages in last 5 - user is frustrated
  return frustrationCount >= 2;
}

/**
 * Generate apology message when user is frustrated
 */
export function generateApologyMessage(): string {
  const messages = [
    "סליחה! לא התכוונתי להטריד 😅\nאני פה כשתצטרך משהו.",
    "אופס! סליחה שהפריעתי 🙏\nתגיד לי מתי נוח לך.",
    "אוקיי אוקיי, אני מפסיק! 😊\nפשוט כתוב לי כשתרצה עזרה.",
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Calculate optimal session duration based on user behavior
 */
export function calculateOptimalSessionDuration(
  averageResponseTime: number,
  historicalCompletionRate: number
): number {
  // Base duration: 10 minutes
  let duration = 10;

  // Adjust based on response time
  if (averageResponseTime > 60) {
    // Slow responder - shorter sessions
    duration = 5;
  } else if (averageResponseTime < 20) {
    // Fast responder - longer sessions ok
    duration = 15;
  }

  // Adjust based on completion rate
  if (historicalCompletionRate < 0.5) {
    // Low completion rate - shorter sessions
    duration = Math.max(5, duration - 3);
  }

  return duration;
}

export default {
  shouldAskMoreQuestions,
  shouldOfferBreak,
  generateBreakOfferMessage,
  batchTransactions,
  generateBatchingMessage,
  trackQuestionAsked,
  resetConsecutiveQuestions,
  isAppropriateTime,
  getNextAppropriateTime,
  detectFrustration,
  generateApologyMessage,
  calculateOptimalSessionDuration,
};

