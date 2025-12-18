/**
 * Conversation AI - הבינה המלאכותית מנהלת את השיחה
 * 
 * במקום קוד קשיח עם if/else - ה-AI מקבל החלטות:
 * - מה לשאול
 * - איך להגיב
 * - מתי לעבור שלב
 * - מתי לתת טיפ
 * - איך להיות אנושי
 */

import { chatWithGPT5Fast } from './gpt5-client';
import { getHistoryForOpenAI } from '../conversation/history-manager';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface ConversationContext {
  userId: string;
  userName: string;
  currentPhase: string;
  
  // נתוני סיווג
  classification?: {
    totalTransactions: number;
    classifiedCount: number;
    remainingCount: number;
    currentTransaction?: {
      vendor: string;
      amount: number;
      date: string;
      suggestedCategory?: string;
      type: 'income' | 'expense';
    };
    recentlyClassified?: Array<{
      vendor: string;
      category: string;
    }>;
    patterns?: {
      topCategory?: string;
      topCategoryCount?: number;
    };
  };
  
  // נתוני משתמש
  userProfile?: {
    age?: number;
    maritalStatus?: string;
    childrenCount?: number;
    employmentType?: string;
  };
  
  // מצב רגשי
  userMood?: 'engaged' | 'tired' | 'confused' | 'excited';
  
  // היסטוריה
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AIResponse {
  message: string;
  action?: 'ask_question' | 'confirm' | 'move_to_next' | 'give_tip' | 'summarize' | 'encourage' | 'done';
  data?: any;
}

// ============================================================================
// Main AI Function
// ============================================================================

/**
 * 🧠 הבינה המלאכותית מנהלת את השיחה
 * מקבלת את כל הקונטקסט ומחליטה מה לעשות
 */
export async function generateAIResponse(
  userMessage: string,
  context: ConversationContext
): Promise<AIResponse> {
  
  // טעינת היסטוריית שיחה
  const history = await getHistoryForOpenAI(context.userId, 8);
  
  // בניית ה-system prompt העשיר
  const systemPrompt = buildConversationSystemPrompt(context);
  
  // בניית ההודעה למשתמש
  const userPrompt = buildUserPrompt(userMessage, context);
  
  try {
    const response = await chatWithGPT5Fast(
      userPrompt,
      systemPrompt,
      { userId: context.userId, userName: context.userName, phoneNumber: '' },
      history
    );
    
    // פרסור התשובה
    return parseAIResponse(response, context);
  } catch (error) {
    console.error('[ConversationAI] Error:', error);
    return {
      message: 'אופס, משהו קרה. בוא ננסה שוב?',
      action: 'ask_question',
    };
  }
}

// ============================================================================
// System Prompt Builder
// ============================================================================

function buildConversationSystemPrompt(context: ConversationContext): string {
  return `אתה φ (פי) - מאמן פיננסי אישי ישראלי.

🎯 המטרה שלך: לעזור למשתמש לסווג תנועות פיננסיות בצורה טבעית, כמו שיחה בין חברים.

👤 על המשתמש:
- שם: ${context.userName || 'לא ידוע'}
${context.userProfile?.age ? `- גיל: ${context.userProfile.age}` : ''}
${context.userProfile?.maritalStatus ? `- מצב משפחתי: ${context.userProfile.maritalStatus}` : ''}
${context.userProfile?.childrenCount ? `- ילדים: ${context.userProfile.childrenCount}` : ''}
${context.userMood ? `- מצב רוח: ${context.userMood === 'tired' ? 'עייף, תהיה קצר' : context.userMood === 'confused' ? 'מבולבל, תסביר' : 'מעורב'}` : ''}

📊 מצב הסיווג:
${context.classification ? `
- סה"כ תנועות: ${context.classification.totalTransactions}
- סווגו: ${context.classification.classifiedCount}
- נשארו: ${context.classification.remainingCount}
${context.classification.currentTransaction ? `
- תנועה נוכחית:
  • ${context.classification.currentTransaction.type === 'income' ? 'הכנסה' : 'הוצאה'}: ${context.classification.currentTransaction.amount.toLocaleString('he-IL')} ₪
  • ספק: ${context.classification.currentTransaction.vendor}
  • תאריך: ${context.classification.currentTransaction.date}
  ${context.classification.currentTransaction.suggestedCategory ? `• הצעה: ${context.classification.currentTransaction.suggestedCategory}` : ''}
` : ''}
${context.classification.recentlyClassified?.length ? `
- סיווגים אחרונים: ${context.classification.recentlyClassified.map(r => `${r.vendor}→${r.category}`).join(', ')}
` : ''}
${context.classification.patterns?.topCategory ? `
- דפוס: הרבה הוצאות על ${context.classification.patterns.topCategory}
` : ''}
` : 'אין נתוני סיווג'}

🎨 סגנון התקשורת שלך:
1. קצר וטבעי - כמו וואטסאפ בין חברים
2. לא פורמלי - בלי "משתמש יקר"
3. אימוג'ים במידה - לא יותר מ-1-2 בהודעה
4. שימוש בשם - רק באבני דרך או עידוד
5. הומור קל - כשרלוונטי (למשל "הרבה קפה החודש 😅")
6. עידוד - "יופי!", "מעולה!", "כל הכבוד!"

📝 כללי התנהגות:
- אם יש תנועה נוכחית - שאל עליה בצורה טבעית
- אם המשתמש אישר - תגובה קצרה ("👍", "יופי") ותעבור הלאה
- אם המשתמש תיקן - קבל בחיוב ולמד
- אם 50% או יותר - ציין את ההתקדמות
- אם נשארו 3 או פחות - עודד "כמעט סיימנו!"
- אם יש דפוס מעניין - העיר בקצרה
- אם המשתמש נראה עייף - הצע הפסקה

❌ מה לא לעשות:
- לא לחזור על מה שהמשתמש אמר
- לא להאריך - קצר וממוקד
- לא להיות רובוטי או פורמלי
- לא לשאול שאלות סגורות עם "האם..."

✅ דוגמאות טובות:
- "300 ₪ ברמי לוי - זה סופר, נכון?"
- "יופי! עוד קצת ונסיים 💪"
- "שמתי לב שיש פה הרבה קפה... ☕ אוהב קפוצ'ינו?"
- "${context.userName}, חצי דרך! 🎯"

החזר רק את ההודעה, בלי הסברים או מטא-טקסט.`;
}

// ============================================================================
// User Prompt Builder
// ============================================================================

function buildUserPrompt(userMessage: string, context: ConversationContext): string {
  let prompt = `הודעת המשתמש: "${userMessage}"

`;

  // הוסף הקשר ספציפי לפי המצב
  if (context.classification?.currentTransaction) {
    const tx = context.classification.currentTransaction;
    prompt += `התנועה הנוכחית: ${tx.amount.toLocaleString('he-IL')} ₪ ${tx.type === 'income' ? 'מ' : 'ב'}-${tx.vendor}
`;
    if (tx.suggestedCategory) {
      prompt += `הצעת סיווג: ${tx.suggestedCategory}
`;
    }
  }

  if (context.classification) {
    const progress = Math.round((context.classification.classifiedCount / context.classification.totalTransactions) * 100);
    prompt += `התקדמות: ${progress}% (${context.classification.classifiedCount}/${context.classification.totalTransactions})
`;
  }

  prompt += `
צור תשובה טבעית ואנושית.`;

  return prompt;
}

// ============================================================================
// Response Parser
// ============================================================================

function parseAIResponse(response: string, context: ConversationContext): AIResponse {
  // ניקוי התשובה
  let message = response.trim();
  
  // הסר מטא-טקסט אם יש
  message = message.replace(/^\[.*?\]\s*/g, '');
  message = message.replace(/```[\s\S]*?```/g, '');
  
  // זיהוי פעולה מההודעה
  let action: AIResponse['action'] = 'ask_question';
  
  if (context.classification?.remainingCount === 0) {
    action = 'done';
  } else if (message.includes('סיימנו') || message.includes('כל הכבוד')) {
    action = 'summarize';
  } else if (message.includes('טיפ') || message.includes('שים לב')) {
    action = 'give_tip';
  }
  
  return {
    message,
    action,
  };
}

// ============================================================================
// Specialized AI Functions
// ============================================================================

/**
 * 🎯 AI שואל על תנועה
 */
export async function askAboutTransaction(
  userId: string,
  userName: string,
  transaction: {
    vendor: string;
    amount: number;
    date: string;
    type: 'income' | 'expense';
    suggestedCategory?: string;
  },
  progress: { done: number; total: number },
  recentClassifications?: Array<{ vendor: string; category: string }>
): Promise<string> {
  const history = await getHistoryForOpenAI(userId, 5);
  
  const progressPercent = Math.round((progress.done / progress.total) * 100);
  const isHalfway = progressPercent >= 45 && progressPercent <= 55;
  const isAlmostDone = progress.total - progress.done <= 3;
  const remaining = progress.total - progress.done;
  
  const amountStr = transaction.amount.toLocaleString('he-IL');
  const prefix = transaction.type === 'income' ? 'מ' : 'ב';
  
  // 🆕 בחירת סגנון אקראי לגיוון
  const styles = [
    { opener: '', closer: '?' },
    { opener: 'מה לגבי ', closer: '?' },
    { opener: '', closer: ' - יודע/ת?' },
    { opener: 'ו', closer: '?' },
  ];
  const style = styles[Math.floor(Math.random() * styles.length)];
  
  const systemPrompt = `אתה φ - מאמן פיננסי ישראלי. שאל על תנועה פיננסית.

⚠️ חובה! השאלה חייבת לכלול:
- הסכום: ${amountStr} ₪
- הספק: ${transaction.vendor}
- התאריך: ${transaction.date}

${transaction.suggestedCategory ? `יש הצעת סיווג: ${transaction.suggestedCategory}` : 'אין הצעת סיווג'}

📊 התקדמות: ${progress.done}/${progress.total} (${progressPercent}%)
${isHalfway ? '- חצי דרך!' : ''}
${isAlmostDone ? `- נשארו ${remaining}!` : ''}

🎨 סגנון לשאלה הזו: ${style.opener}..${style.closer}

📝 פורמט השאלה - גוון!:
בסיסי: "${amountStr} ₪ ${prefix}*${transaction.vendor}* (${transaction.date})"
אם יש הצעה, הוסף: "זה *${transaction.suggestedCategory || 'X'}*?"
אם אין הצעה, שאל: "מה זה?"

🎲 וריאציות אפשריות (בחר אחת!):
- "${amountStr} ₪ ${prefix}*${transaction.vendor}* - ${transaction.suggestedCategory || 'מה זה'}?"
- "*${transaction.vendor}*, ${amountStr} ₪ (${transaction.date}) - ${transaction.suggestedCategory ? transaction.suggestedCategory + '?' : 'מה זה?'}"
- "${style.opener}${amountStr} ₪ ${prefix}*${transaction.vendor}*${style.closer}"
${isHalfway ? `- "${userName}, חצי דרך! 🎯 ${amountStr} ₪ ${prefix}*${transaction.vendor}* - מה זה?"` : ''}
${isAlmostDone ? `- "עוד ${remaining}! ${amountStr} ₪ ${prefix}*${transaction.vendor}*?"` : ''}

❌ אסור:
- לחזור על אותו ניסוח מההודעות האחרונות
- להשתמש ב-** (שתי כוכביות) - רק * אחת

החזר רק את השאלה (שורה-שתיים מקסימום).`;

  const response = await chatWithGPT5Fast(
    `צור שאלה על: ${amountStr} ₪ ${prefix}${transaction.vendor}`,
    systemPrompt,
    { userId, userName, phoneNumber: '' },
    history
  );
  
  // וודא שהתשובה מכילה את הסכום - אם לא, השתמש ב-fallback
  const result = response?.trim();
  if (result && result.includes(transaction.vendor)) {
    return result;
  }
  
  // Fallback ברור
  if (transaction.suggestedCategory) {
    return `${amountStr} ₪ ${prefix}*${transaction.vendor}* (${transaction.date})\nזה *${transaction.suggestedCategory}*?`;
  }
  return `${amountStr} ₪ ${prefix}*${transaction.vendor}* (${transaction.date})\nמה זה?`;
}

/**
 * 💬 AI מגיב לתשובה ושואל הלאה
 */
export async function respondAndContinue(
  userId: string,
  userName: string,
  userAnswer: string,
  classifiedAs: string,
  nextTransaction?: {
    vendor: string;
    amount: number;
    date: string;
    type: 'income' | 'expense';
    suggestedCategory?: string;
  },
  progress?: { done: number; total: number }
): Promise<string> {
  // 🆕 תגובות מגוונות יותר
  const quickPositive = ['👍', 'יופי!', 'מעולה!', 'סבבה', '✓', 'תודה!', 'רשמתי!', '👌'];
  const quickEmoji = ['👍', '✓', '👌', '💪'];
  
  // אם אין תנועה הבאה, רק תגובה קצרה
  if (!nextTransaction) {
    return quickPositive[Math.floor(Math.random() * quickPositive.length)];
  }
  
  const history = await getHistoryForOpenAI(userId, 5);
  
  const amountStr = nextTransaction.amount.toLocaleString('he-IL');
  const prefix = nextTransaction.type === 'income' ? 'מ' : 'ב';
  const remaining = progress ? progress.total - progress.done : 0;
  
  // 🆕 בחירת סגנון תגובה
  const responseEmoji = quickEmoji[Math.floor(Math.random() * quickEmoji.length)];
  
  const systemPrompt = `אתה φ - מאמן פיננסי ישראלי.

המשתמש סיווג תנועה כ: "${classifiedAs}"

📝 משימה:
1. תגובה קצרה וטבעית (לא יותר מ-2 מילים!)
2. שורה ריקה
3. שאלה על התנועה הבאה

🎨 תגובות אפשריות (בחר אחת!):
- "${responseEmoji}"
- "יופי ${responseEmoji}"
- "סבבה"
- "רשמתי"
- "אוקי"

⚠️ השאלה הבאה חייבת לכלול:
- סכום: ${amountStr} ₪
- ספק: ${nextTransaction.vendor}  
- תאריך: ${nextTransaction.date}
${nextTransaction.suggestedCategory ? `- הצעה: ${nextTransaction.suggestedCategory}` : ''}

${progress ? `התקדמות: ${progress.done}/${progress.total}` : ''}
${remaining <= 3 && remaining > 0 ? `נשארו רק ${remaining}!` : ''}

📝 פורמט לדוגמה:
${responseEmoji}

${amountStr} ₪ ${prefix}*${nextTransaction.vendor}* (${nextTransaction.date})
${nextTransaction.suggestedCategory ? `*${nextTransaction.suggestedCategory}*?` : 'מה זה?'}

❌ אסור:
- לחזור על אותו ניסוח
- להשתמש ב-** (שתי כוכביות)
- להיות ארוך מדי

החזר רק את התגובה והשאלה.`;

  const response = await chatWithGPT5Fast(
    `תגובה + שאלה על: ${amountStr} ₪ ${prefix}${nextTransaction.vendor}`,
    systemPrompt,
    { userId, userName, phoneNumber: '' },
    history
  );
  
  // וודא שהתשובה מכילה את פרטי התנועה
  const result = response?.trim();
  if (result && result.includes(nextTransaction.vendor)) {
    return result;
  }
  
  // Fallback ברור
  const quickResponse = ['👍', 'יופי!', 'מעולה!'][Math.floor(Math.random() * 3)];
  if (nextTransaction.suggestedCategory) {
    return `${quickResponse}\n\n${amountStr} ₪ ${prefix}*${nextTransaction.vendor}* (${nextTransaction.date})\nזה *${nextTransaction.suggestedCategory}*?`;
  }
  return `${quickResponse}\n\n${amountStr} ₪ ${prefix}*${nextTransaction.vendor}* (${nextTransaction.date})\nמה זה?`;
}

/**
 * 🎉 AI מסכם בסיום
 */
export async function generateCompletionMessage(
  userId: string,
  userName: string,
  stats: {
    totalClassified: number;
    totalIncome: number;
    totalExpenses: number;
    topCategories: Array<{ name: string; count: number; total: number }>;
  }
): Promise<string> {
  const history = await getHistoryForOpenAI(userId, 3);
  
  const balance = stats.totalIncome - stats.totalExpenses;
  
  const systemPrompt = `אתה φ - מאמן פיננסי ישראלי.

המשתמש ${userName} סיים לסווג תנועות!

📊 סיכום:
- סה"כ תנועות: ${stats.totalClassified}
- הכנסות: ${stats.totalIncome.toLocaleString('he-IL')} ₪
- הוצאות: ${stats.totalExpenses.toLocaleString('he-IL')} ₪
- מאזן: ${balance >= 0 ? '+' : ''}${balance.toLocaleString('he-IL')} ₪

📈 קטגוריות מובילות:
${stats.topCategories.slice(0, 5).map(c => `- ${c.name}: ${c.count} תנועות (${c.total.toLocaleString('he-IL')} ₪)`).join('\n')}

📝 משימה:
צור הודעת סיום חמה ואישית:
1. פתיחה עם השם ומחמאה
2. סיכום קצר (2-3 שורות)
3. תובנה אחת מעניינת מהנתונים
4. סיום חיובי

אל תהיה ארוך מדי - 5-6 שורות מקסימום.`;

  const response = await chatWithGPT5Fast(
    'סכם',
    systemPrompt,
    { userId, userName, phoneNumber: '' },
    history
  );
  
  return response?.trim() || `🎉 כל הכבוד ${userName}!\n\nעברנו על ${stats.totalClassified} תנועות.\nעכשיו יש לי תמונה מלאה!`;
}

/**
 * 🤔 AI מפרסר תשובה לא ברורה
 */
export async function parseUnclearAnswer(
  userId: string,
  userMessage: string,
  transactionContext: {
    vendor: string;
    amount: number;
    suggestedCategory?: string;
  }
): Promise<{
  understood: boolean;
  category?: string;
  isConfirmation?: boolean;
  isRejection?: boolean;
  needsClarification?: boolean;
}> {
  const systemPrompt = `אתה מפרסר תשובות של משתמש לגבי סיווג תנועה.

התנועה: ${transactionContext.amount} ₪ ב-${transactionContext.vendor}
${transactionContext.suggestedCategory ? `הצעה: ${transactionContext.suggestedCategory}` : ''}

תשובת המשתמש: "${userMessage}"

החזר JSON בלבד:
{
  "understood": true/false,
  "category": "שם הקטגוריה" או null,
  "isConfirmation": true/false (אם המשתמש אישר את ההצעה),
  "isRejection": true/false (אם המשתמש דוחה/רוצה לדלג),
  "needsClarification": true/false
}

דוגמאות:
"כן" → {"understood": true, "isConfirmation": true}
"קפה" → {"understood": true, "category": "קפה"}
"לא יודע" → {"understood": true, "needsClarification": true}
"דלג" → {"understood": true, "isRejection": true}
"אממממ" → {"understood": false, "needsClarification": true}`;

  try {
    const response = await chatWithGPT5Fast(
      userMessage,
      systemPrompt,
      { userId, userName: '', phoneNumber: '' }
    );
    
    const jsonMatch = response?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[AI Parser] Error:', error);
  }
  
  return {
    understood: false,
    needsClarification: true,
  };
}

/**
 * 🎉 הודעת פתיחה ראשונה - הסברית, משדרת ביטחון
 */
export async function generateWelcomeMessage(): Promise<string> {
  // הודעה קבועה ומדויקת - לא מייצרים עם AI כי רוצים שליטה מלאה
  return `היי! 👋

אני *φ (פאי)* - המאמן הפיננסי האישי שלך.

*מה נעשה ביחד?*
נבנה תמונה ברורה של הכסף שלך - בלי לחץ, בלי שיפוטיות. רק אתה והמספרים.

*איך זה עובד?*
1️⃣ תשלח לי דוחות בנק (PDF)
2️⃣ אני אנתח ואסווג את התנועות
3️⃣ ביחד נבין לאן הכסף הולך
4️⃣ נבנה תוכנית שעובדת *בשבילך*

*למה אני שונה?*
אני לא אגיד לך "אל תקנה קפה" - אני אעזור לך להבין את ההרגלים שלך ולקבל החלטות מתוך מודעות.

בוא נתחיל - מה השם שלך?`;
}

export default {
  generateAIResponse,
  askAboutTransaction,
  respondAndContinue,
  generateCompletionMessage,
  parseUnclearAnswer,
  generateWelcomeMessage,
};

