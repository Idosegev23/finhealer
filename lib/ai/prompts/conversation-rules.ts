/**
 * Conversation rules and behavioral guidelines for Phi AI
 */

export const CONVERSATION_RULES = {
  // Maximum questions before checking with user
  MAX_QUESTIONS_IN_ROW: 3,

  // Maximum transactions to process per session
  MAX_TRANSACTIONS_PER_SESSION: 50,

  // Time thresholds
  RESPONSE_TIMEOUT_MINUTES: 60, // Consider user busy after 1 hour
  PAUSE_DURATION_HOURS: 24, // Pause reminders for 24h after 3 "אחר כך"
  REMINDER_DELAY_MINUTES: 60, // Wait 1 hour before sending reminder

  // User mood indicators
  TIRED_INDICATORS: [
    "די",
    "נמאס",
    "מספיק",
    "עייף",
    "לא רוצה",
    "תפסיק",
    "לא מעניין",
    "כבר",
  ],

  BUSY_INDICATORS: ["אחר כך", "לא עכשיו", "מאוחר יותר", "בוא נדבר אחרי"],

  ENGAGED_INDICATORS: [
    "!",
    "😊",
    "🎉",
    "👍",
    "💪",
    "מעולה",
    "סבבה",
    "בטח",
    "כן כן",
  ],

  // Response variations to avoid repetition
  CONFIRMATION_PHRASES: [
    "נכון?",
    "זה נכון?",
    "מסכים?",
    "יופי?",
    "אישור?",
    "זה זה?",
    "בסדר?",
  ],

  CONTINUE_PHRASES: [
    "נמשיך?",
    "יאללה הלאה?",
    "בא לך עוד אחד?",
    "ממשיכים?",
    "עוד אחת?",
    "הלאה?",
  ],

  APPROVAL_PHRASES: [
    "מעולה",
    "סבבה",
    "יופי",
    "נחמד",
    "אש",
    "מצוין",
    "כל הכבוד",
  ],

  // Casual Hebrew alternatives
  YES_VARIATIONS: ["כן", "בטח", "אוקיי", "יופי", "סבבה", "ok"],

  NO_VARIATIONS: ["לא", "לא לא", "ממש לא"],

  // Rate limiting
  MAX_MESSAGES_PER_DAY: 100,
  MAX_DOCUMENTS_PER_DAY: 10,

  // Gamification limits (don't overwhelm)
  MAX_CELEBRATION_MESSAGES_PER_WEEK: 2,
  MAX_INSIGHTS_PER_WEEK: 3,
};

/**
 * Get random phrase from array to add variety
 */
export function getRandomPhrase(phrases: string[]): string {
  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Check if message indicates user is tired
 */
export function isUserTired(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return CONVERSATION_RULES.TIRED_INDICATORS.some((indicator) =>
    lowerMessage.includes(indicator)
  );
}

/**
 * Check if message indicates user is busy
 */
export function isUserBusy(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return CONVERSATION_RULES.BUSY_INDICATORS.some((indicator) =>
    lowerMessage.includes(indicator)
  );
}

/**
 * Check if message indicates user is engaged
 */
export function isUserEngaged(message: string): boolean {
  return CONVERSATION_RULES.ENGAGED_INDICATORS.some((indicator) =>
    message.includes(indicator)
  );
}

/**
 * Determine if we should back off based on consecutive postponements
 */
export function shouldBackOff(consecutivePostpones: number): boolean {
  return consecutivePostpones >= 3;
}

/**
 * Determine if we should pause the conversation
 */
export function shouldPauseConversation(
  questionCount: number,
  userMood: "engaged" | "tired" | "busy"
): boolean {
  // If user is tired or busy - pause immediately
  if (userMood === "tired" || userMood === "busy") {
    return true;
  }

  // If we've asked too many questions - check with user
  if (questionCount >= CONVERSATION_RULES.MAX_QUESTIONS_IN_ROW) {
    return true;
  }

  return false;
}

/**
 * Generate break offer message
 */
export function generateBreakOfferMessage(
  questionsRemaining: number
): string {
  const phrases = [
    `יש לי עוד ${questionsRemaining} שאלות. רוצה הפסקה?`,
    `עוד ${questionsRemaining} נשארו. ממשיכים או עושים הפסקה?`,
    `נשארו ${questionsRemaining} תנועות. בא לך להמשיך?`,
    `עוד ${questionsRemaining}... נמשיך או נדחה למחר?`,
  ];

  return getRandomPhrase(phrases);
}

/**
 * Generate postponement confirmation message
 */
export function generatePostponementMessage(whenToRemind?: string): string {
  if (whenToRemind === "מחר") {
    return "בסדר גמור! אזכיר לך מחר בבוקר 😊";
  }

  if (whenToRemind === "ערב") {
    return "סבבה! אזכיר לך הערב 👍";
  }

  return "בסדר! תגיד לי מתי נוח לך ואני אזכיר 😊";
}

/**
 * Generate excessive use warning
 */
export function generateRateLimitMessage(limitType: "messages" | "documents"): string {
  if (limitType === "messages") {
    return "וואו, היית ממש פעיל היום! 😅\nבוא נקח הפסקה ונמשיך מחר?";
  }

  return "זה הרבה מסמכים להיום! 📄\nבוא נעבד על אלה ונמשיך מחר?";
}

export default CONVERSATION_RULES;

