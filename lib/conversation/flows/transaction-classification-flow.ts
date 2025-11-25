import { chatWithGPT5 } from "@/lib/ai/gpt5-client";
import { PHI_COACH_SYSTEM_PROMPT } from "@/lib/ai/prompts/phi-coach-system";
import { getRandomPhrase } from "@/lib/ai/prompts/conversation-rules";
import { ConversationContext, UserContext } from "@/types/conversation";
import { matchTransaction } from "@/lib/learning/pattern-detector";
import { shouldOfferBreak, generateBreakOfferMessage } from "@/lib/whatsapp/engagement-manager";

/**
 * Transaction Classification Flow
 * שיחה ידידותית לסיווג תנועות - עם הסברים ותמיכה!
 */

export interface ClassificationSession {
  userId: string;
  transactions: any[];
  currentIndex: number;
  classified: number;
  skipped: number;
  startTime: Date;
  pausedAt?: Date;
}

export interface ClassificationResult {
  transactionId: string;
  category: string;
  confidence: number;
  requiresConfirmation: boolean;
}

/**
 * Start classification session - הודעת פתיחה ידידותית
 */
export async function startClassificationSession(
  userId: string,
  transactions: any[],
  userContext: UserContext
): Promise<{
  message: string;
  session: ClassificationSession;
}> {
  const session: ClassificationSession = {
    userId,
    transactions,
    currentIndex: 0,
    classified: 0,
    skipped: 0,
    startTime: new Date(),
  };

  const totalTransactions = transactions.length;
  
  let message: string;
  
  if (totalTransactions === 0) {
    message = `מעולה! 🎉 אין תנועות חדשות לסיווג - הכל מסודר!`;
  } else if (totalTransactions <= 5) {
    message = `מצאתי ${totalTransactions} תנועות שאני צריך עזרה איתן! 📋

אלה תנועות שאני לא בטוח לגביהן - 
אם תעזור לי לסווג אותן, בפעם הבאה אזכור אוטומטית! 🧠

זה ייקח פחות מדקה. בא לך?`;
  } else if (totalTransactions <= 20) {
    message = `מצאתי ${totalTransactions} תנועות חדשות! 📊

רוב התנועות אני מזהה אוטומטית, 
אבל יש כמה שאני צריך עזרה איתן.

💡 טיפ: ככל שתעזור לי יותר, ככה אהיה חכם יותר!
בפעם הבאה אזהה את אותן חנויות לבד 😊

מוכן? בוא נסדר את זה ביחד!`;
  } else {
    message = `וואו! מצאתי ${totalTransactions} תנועות! 📈

זה הרבה מידע - עבודה יפה שאספת הכל!

כדי שלא יהיה מעייף, בוא נתחיל עם 50 הראשונות.
אני אשאל רק על התנועות שאני לא בטוח לגביהן.

🎯 המטרה: שבפעם הבאה - אעשה את זה לבד!

נתחיל?`;
    
    // Limit to first 50
    session.transactions = transactions.slice(0, 50);
  }

  return { message, session };
}

/**
 * Get next question in classification session - שאלות מסבירות
 */
export async function getNextClassificationQuestion(
  session: ClassificationSession,
  userContext: UserContext
): Promise<{
  message: string;
  transaction?: any;
  suggestedCategory?: string;
  confidence?: number;
  done?: boolean;
}> {
  // Check if we should offer a break
  if (shouldOfferBreak(session.currentIndex, (userContext as any).userMood || "engaged")) {
    const remaining = session.transactions.length - session.currentIndex;
    const breakMessage = `נראה שעבדנו די הרבה! 💪

עברנו על ${session.currentIndex} תנועות - כל הכבוד!
נשארו עוד ${remaining}.

רוצה להמשיך או לקחת הפסקה?
(אפשר להמשיך מאוחר יותר - אני אזכור איפה עצרנו 😊)`;
    
    return {
      message: breakMessage,
    };
  }

  // Check if done
  if (session.currentIndex >= session.transactions.length) {
    const completionMessage = generateCompletionMessage(session);
    return {
      message: completionMessage,
      done: true,
    };
  }

  // Get current transaction
  const transaction = session.transactions[session.currentIndex];

  // Try to match with patterns
  const match = await matchTransaction(userContext.userId, {
    merchant: transaction.merchant_name || transaction.description,
    amount: transaction.amount,
    description: transaction.description,
  });

  // If high confidence match, auto-categorize
  if (match.confidence >= 0.9 && match.category) {
    session.classified++;
    session.currentIndex++;

    // Auto-categorize and move to next
    // TODO: Update transaction in database

    // Get next question recursively
    return await getNextClassificationQuestion(session, userContext);
  }

  // Generate question
  const question = generateClassificationQuestion(
    transaction,
    session.currentIndex,
    session.transactions.length,
    match.category,
    match.confidence
  );

  return {
    message: question,
    transaction,
    suggestedCategory: match.category,
    confidence: match.confidence,
  };
}

/**
 * Handle classification answer - תגובות חמות
 */
export async function handleClassificationAnswer(
  session: ClassificationSession,
  answer: string,
  userContext: UserContext
): Promise<{
  response: string;
  nextQuestion?: string;
  done?: boolean;
}> {
  const lowerAnswer = answer.toLowerCase().trim();

  // Check for postponement
  if (
    lowerAnswer.includes("לא עכשיו") ||
    lowerAnswer.includes("אחר כך") ||
    lowerAnswer.includes("מאוחר יותר") ||
    lowerAnswer.includes("הפסקה") ||
    lowerAnswer.includes("עייף")
  ) {
    session.pausedAt = new Date();
    const classified = session.classified;
    
    return {
      response: `בסדר גמור! 😊

${classified > 0 ? `כבר סיווגנו ${classified} תנועות - עבודה יפה!` : ''}

אני אזכור איפה עצרנו ונמשיך כשתהיה מוכן.
אזכיר לך מחר בבוקר, בסדר? ☀️`,
      done: false,
    };
  }

  // Check for skip
  if (
    lowerAnswer.includes("דלג") ||
    lowerAnswer.includes("אין לי מושג") ||
    lowerAnswer.includes("לא יודע") ||
    lowerAnswer.includes("לא זוכר") ||
    lowerAnswer === "?"
  ) {
    session.skipped++;
    session.currentIndex++;

    const next = await getNextClassificationQuestion(session, userContext);
    
    return {
      response: `אין בעיה! נדלג על זה 👍
(אפשר לחזור לזה אחר כך אם תיזכר)`,
      nextQuestion: next.message,
      done: next.done,
    };
  }

  // Parse category from answer
  // TODO: Implement smart category parsing

  session.classified++;
  session.currentIndex++;

  // Get next question
  const next = await getNextClassificationQuestion(session, userContext);

  // תגובות מגוונות ומעודדות
  const responses = [
    "מעולה! תודה 🙏",
    "סבבה! רשמתי ✓",
    "יופי! אזכור לפעם הבאה 🧠",
    "אחלה! למדתי משהו חדש 💡",
    "נחמד! עוד צעד קדימה 👍",
    "מצוין! אתה עוזר לי להיות חכם יותר 🎓",
  ];

  const response = responses[Math.floor(Math.random() * responses.length)];

  return {
    response,
    nextQuestion: next.message,
    done: next.done,
  };
}

/**
 * Generate classification question - שאלות ברורות ומסבירות
 */
function generateClassificationQuestion(
  transaction: any,
  currentIndex: number,
  total: number,
  suggestedCategory?: string,
  confidence?: number
): string {
  const parts: string[] = [];

  // Progress indicator (every 5 questions) - עידוד!
  if (currentIndex > 0 && currentIndex % 5 === 0) {
    const progressPercent = Math.round((currentIndex / total) * 100);
    parts.push(`💪 מעולה! עברנו ${currentIndex}/${total} (${progressPercent}%)\n`);
  } else if (currentIndex === 0) {
    parts.push(`🎯 שאלה ראשונה:\n`);
  }

  // Transaction info - ברור ומובן
  const date = new Date(transaction.date).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
  });

  const amount = Math.abs(transaction.amount);
  const merchant = transaction.merchant_name || transaction.description || "עסק לא מזוהה";

  if (transaction.type === "income") {
    parts.push(`ב-${date} נכנסו לך ${amount} ₪ מ"${merchant}" 💰`);
    parts.push(`\nמה זו ההכנסה הזו?`);
    parts.push(`(משכורת, החזר, מתנה, אחר...)`);
  } else {
    parts.push(`ב-${date} הוצאת ${amount} ₪ ב"${merchant}"`);

    if (suggestedCategory && confidence && confidence >= 0.6) {
      parts.push(`\nזה נראה לי כמו ${suggestedCategory} - נכון?`);
      parts.push(`(או כתוב לי מה זה באמת)`);
    } else {
      parts.push(`\nלאיזה קטגוריה זה שייך?`);
      parts.push(`\n💡 דוגמאות: מזון, מסעדות, ביגוד, תחבורה, בילויים...`);
    }
  }

  return parts.join("\n");
}

/**
 * Generate completion message - חגיגה!
 */
function generateCompletionMessage(session: ClassificationSession): string {
  const duration = Math.round(
    (Date.now() - session.startTime.getTime()) / (1000 * 60)
  );

  let timeText = "";
  if (duration <= 1) {
    timeText = "בפחות מדקה";
  } else if (duration <= 5) {
    timeText = `ב-${duration} דקות בלבד`;
  } else {
    timeText = `ב-${duration} דקות`;
  }

  const classified = session.classified;
  const skipped = session.skipped;
  
  let message = `🎉 סיימנו! כל הכבוד!

📊 סיווגנו ${classified} תנועות ${timeText}!

💡 מה למדתי?
עכשיו אני מכיר את החנויות שלך טוב יותר.
בפעם הבאה - אסווג הרבה מהן אוטומטית!`;

  if (skipped > 0) {
    message += `\n\n📝 (${skipped} תנועות דילגנו עליהן - אפשר לחזור אליהן אחר כך)`;
  }

  message += `\n\n🚀 מה הלאה?
עכשיו יש לי תמונה מלאה של ההוצאות שלך.
רוצה לראות סיכום? 📈`;

  return message;
}

/**
 * Resume paused session - חזרה ידידותית
 */
export async function resumeClassificationSession(
  session: ClassificationSession,
  userContext: UserContext
): Promise<{
  message: string;
  nextQuestion?: string;
}> {
  const remaining = session.transactions.length - session.currentIndex;
  const classified = session.classified;

  let message: string;

  if (session.pausedAt) {
    const hoursPaused = Math.round(
      (Date.now() - session.pausedAt.getTime()) / (1000 * 60 * 60)
    );

    if (hoursPaused > 24) {
      message = `היי! טוב לראות אותך! 😊

מזמן לא המשכנו לסדר את התנועות.
${classified > 0 ? `כבר סיווגנו ${classified} - ` : ''}נשארו עוד ${remaining}.

רוצה להמשיך מאיפה שעצרנו?`;
    } else {
      message = `שמח שחזרת! 👋

${classified > 0 ? `סיווגנו כבר ${classified} תנועות - ` : ''}נשארו ${remaining}.

נמשיך? (או אם רוצה להתחיל מחדש - גם אפשר)`;
    }
  } else {
    message = `בוא נמשיך! 💪

נשארו ${remaining} תנועות.
מוכן?`;
  }

  return { message };
}

export default {
  startClassificationSession,
  getNextClassificationQuestion,
  handleClassificationAnswer,
  resumeClassificationSession,
};
