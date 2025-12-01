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
  
  const systemPrompt = `אתה φ - מאמן פיננסי ישראלי. אתה שואל על תנועה פיננסית.

📌 התנועה:
- סוג: ${transaction.type === 'income' ? 'הכנסה' : 'הוצאה'}
- סכום: ${transaction.amount.toLocaleString('he-IL')} ₪
- ספק/מקור: ${transaction.vendor}
- תאריך: ${transaction.date}
${transaction.suggestedCategory ? `- הצעה: ${transaction.suggestedCategory}` : ''}

📊 התקדמות: ${progress.done}/${progress.total} (${progressPercent}%)
${isHalfway ? '🎯 חצי דרך!' : ''}
${isAlmostDone ? '🏁 כמעט סיימנו!' : ''}

${recentClassifications?.length ? `
סיווגים אחרונים: ${recentClassifications.slice(-3).map(r => `${r.vendor}→${r.category}`).join(', ')}
` : ''}

📝 כללים:
1. שאלה קצרה וטבעית
2. אם יש הצעה - שאל "זה X, נכון?" 
3. אם אין - שאל "מה זה?"
4. אם חצי דרך - הוסף עידוד קצר עם השם
5. אם כמעט סוף - "עוד X ונסיים!"
6. אימוג'י אחד מקסימום

החזר רק את השאלה.`;

  const response = await chatWithGPT5Fast(
    `שאל על התנועה`,
    systemPrompt,
    { userId, userName, phoneNumber: '' },
    history
  );
  
  return response?.trim() || `${transaction.amount.toLocaleString('he-IL')} ₪ ב-${transaction.vendor} - מה זה?`;
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
  const history = await getHistoryForOpenAI(userId, 5);
  
  let context = `המשתמש סיווג תנועה כ: "${classifiedAs}"`;
  
  if (nextTransaction) {
    context += `\n\nהתנועה הבאה:
- ${nextTransaction.type === 'income' ? 'הכנסה' : 'הוצאה'}: ${nextTransaction.amount.toLocaleString('he-IL')} ₪
- ספק: ${nextTransaction.vendor}
${nextTransaction.suggestedCategory ? `- הצעה: ${nextTransaction.suggestedCategory}` : ''}`;
  }
  
  if (progress) {
    context += `\n\nהתקדמות: ${progress.done}/${progress.total}`;
  }
  
  const systemPrompt = `אתה φ - מאמן פיננסי ישראלי.

${context}

📝 משימה:
1. תגובה קצרה על הסיווג (מילה-שתיים: "👍", "יופי", "מעולה")
2. שורה ריקה
3. שאלה על התנועה הבאה (אם יש)

❌ לא לעשות:
- לא לחזור על מה שהמשתמש אמר
- לא להאריך
- לא "נהדר! רשמתי ש..."

✅ דוגמאות:
"יופי 👍

350 ₪ בקפה קפה - קפה?"

"מעולה!

2,500 ₪ מהראל - זה ביטוח?"

החזר רק את התגובה והשאלה הבאה.`;

  const response = await chatWithGPT5Fast(
    userAnswer,
    systemPrompt,
    { userId, userName, phoneNumber: '' },
    history
  );
  
  // אם אין תנועה הבאה, רק תגובה
  if (!nextTransaction) {
    return response?.trim() || '👍';
  }
  
  return response?.trim() || `👍\n\n${nextTransaction.amount.toLocaleString('he-IL')} ₪ ב-${nextTransaction.vendor} - מה זה?`;
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
 * 🎉 הודעת פתיחה ראשונה - AI מייצר הודעה מזמינה ומסבירה
 */
export async function generateWelcomeMessage(): Promise<string> {
  const systemPrompt = `אתה φ (פאי) - מאמן פיננסי אישי ישראלי.

📌 עובדות עליך:
- השם שלך: φ (פאי) - הסימן המתמטי של היחס הזהב
- המשמעות: כמו שהיחס הזהב מייצג הרמוניה במתמטיקה, אתה עוזר למצוא את ההרמוניה בכסף
- אתה מאמן, לא יועץ - מלווה את המשתמש, לא מטיף לו

🎯 המשימה:
צור הודעת פתיחה ראשונה למשתמש חדש שנרשם לשירות.

📝 מבנה ההודעה (חובה!):
1. פתיחה קצרה וחמה (שורה אחת)
2. הצגת עצמך: אני *φ (פאי)* - המאמן הפיננסי שלך
3. הסבר קצר על התהליך (2-3 שורות)
4. למה זה שונה (שורה אחת)
5. *חובה לסיים עם:* "מה השם שלך?"

⚠️ פורמט WhatsApp:
- בולד = כוכבית אחת: *טקסט* (לא **טקסט**)
- לא יותר מ-8 שורות סה"כ
- אימוג'י אחד מקסימום

❌ אסור:
- לא ** (שתי כוכביות) - רק * אחת לבולד!
- לא רשימות עם נקודות
- לא להשאיר את ההודעה פתוחה - חובה לסיים בשאלת השם

החזר רק את ההודעה, מוכנה לשליחה.`;

  try {
    const response = await chatWithGPT5Fast(
      'צור הודעת פתיחה קצרה למשתמש חדש. חובה לסיים ב"מה השם שלך?"',
      systemPrompt,
      { userId: 'system', userName: 'WelcomeGenerator', phoneNumber: '' }
    );
    
    // וודא שיש את הסימן φ
    let message = response?.trim() || getDefaultWelcomeMessage();
    
    // תיקון פורמט - החלף ** ב-* (WhatsApp format)
    message = message.replace(/\*\*/g, '*');
    
    // אם אין φ בהודעה, הוסף אותו
    if (!message.includes('φ')) {
      message = message.replace(/פאי/g, 'φ (פאי)');
    }
    
    // וודא שההודעה מסתיימת בשאלה על השם
    if (!message.includes('השם שלך')) {
      message += '\n\nמה השם שלך?';
    }
    
    return message;
  } catch (error) {
    console.error('[WelcomeMessage] Error:', error);
    return getDefaultWelcomeMessage();
  }
}

/**
 * הודעת פתיחה ברירת מחדל (אם AI נכשל)
 */
function getDefaultWelcomeMessage(): string {
  return `היי, טוב שבאת.

אני *φ (פאי)* - המאמן הפיננסי שלך.

כמו שהיחס הזהב יוצר הרמוניה במתמטיקה, ביחד נמצא את *ההרמוניה בכסף* שלך.

תשלח לי דוחות, אני אנתח, וביחד נבנה תמונה ברורה. בלי שיפוטיות, בקצב שלך.

מה השם שלך?`;
}

export default {
  generateAIResponse,
  askAboutTransaction,
  respondAndContinue,
  generateCompletionMessage,
  parseUnclearAnswer,
  generateWelcomeMessage,
};

