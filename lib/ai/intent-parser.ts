import { Intent, IntentType, Entity, EntityType } from "@/types/conversation";
import { chatWithGPT5Fast } from "./gpt5-client";

/**
 * Parse user message to extract intent and entities
 * Uses combination of regex patterns and AI for Hebrew NLU
 */
export async function parseIntent(
  userMessage: string,
  conversationContext?: any
): Promise<Intent> {
  // First try rule-based patterns (fast)
  const ruleBasedIntent = tryRuleBasedParsing(userMessage);
  
  if (ruleBasedIntent && ruleBasedIntent.confidence > 0.8) {
    return ruleBasedIntent;
  }

  // If rule-based fails or low confidence, use AI
  return await aiBasedParsing(userMessage, conversationContext);
}

/**
 * Fast rule-based parsing for common patterns
 */
function tryRuleBasedParsing(message: string): Intent | null {
  const msg = message.trim().toLowerCase();

  // Greeting patterns
  if (/^(שלום|היי|הי|בוקר טוב|ערב טוב|מה קורה)/.test(msg)) {
    return {
      type: "greeting",
      confidence: 0.95,
      entities: [],
    };
  }

  // Yes/Approval patterns
  if (/^(כן|נכון|אישור|יופי|מסכים|אוקיי|אוקי|ok|טוב|בסדר|יאללה)$/.test(msg)) {
    return {
      type: "approval",
      confidence: 0.9,
      entities: [],
    };
  }

  // Skip/Postpone patterns
  if (/^(לא עכשיו|אחר כך|מאוחר יותר|לא|תזכיר לי|דחה|לא רוצה)/.test(msg)) {
    return {
      type: "postpone",
      confidence: 0.9,
      entities: [],
    };
  }

  // Help patterns
  if (/(עזרה|מה אתה יכול|מה את יכולה|איך|הסבר)/i.test(msg)) {
    return {
      type: "help",
      confidence: 0.85,
      entities: [],
    };
  }

  // 🆕 Budget request patterns
  if (/(תקציב|בוא נבנה תקציב|כמה להוציא|כמה לתת ל|תכנון תקציב|להגדיר תקציב)/i.test(msg)) {
    return {
      type: "budget_request",
      confidence: 0.9,
      entities: extractEntitiesFromQuestion(message),
    };
  }

  // 🆕 Goal request patterns
  if (/(יעד|חיסכון|רוצה לחסוך|להגדיר יעד|יש לי מטרה|מטרות פיננסיות|רוצה להגיע ל)/i.test(msg)) {
    return {
      type: "goal_request",
      confidence: 0.9,
      entities: extractGoalEntities(message),
    };
  }

  // 🆕 Loan consolidation patterns
  if (/(הלוואות|איחוד הלוואות|יש לי הלוואות|חובות|משכנתא|לאחד הלוואות|מחזור)/i.test(msg)) {
    return {
      type: "loan_consolidation",
      confidence: 0.9,
      entities: [],
    };
  }

  // 🆕 Document upload patterns
  if (/(שלחתי|מצרף|הנה|דוח|תדפיס|קבלה|צילום)/i.test(msg)) {
    return {
      type: "upload_document",
      confidence: 0.75,
      entities: [],
    };
  }

  // Expense logging patterns
  const expenseMatch = msg.match(
    /(קניתי|הוצאתי|שילמתי|בזבזתי|עלה לי|עלו לי|בילויתי|רכשתי).*?(\d+\.?\d*)\s*(שקל|ש״ח|₪)?/i
  );
  
  if (expenseMatch) {
    const entities = extractEntitiesFromExpense(message);
    return {
      type: "expense_log",
      confidence: 0.85,
      entities,
    };
  }

  // Amount + item pattern (e.g., "50 שקל קפה")
  const amountItemMatch = msg.match(/(\d+\.?\d*)\s*(שקל|ש״ח|₪)?\s+(.+)/);
  if (amountItemMatch) {
    const entities = extractEntitiesFromExpense(message);
    return {
      type: "expense_log",
      confidence: 0.8,
      entities,
    };
  }

  // Question about balance/spending
  if (/(כמה|מה|איזה|תציג|תראה).*(הוצאתי|בילויתי|חיסכתי|יתרה|יתרת|מאזן)/i.test(msg)) {
    return {
      type: "question_spending",
      confidence: 0.85,
      entities: extractEntitiesFromQuestion(message),
    };
  }

  return null;
}

/**
 * AI-based parsing for complex or ambiguous messages
 */
async function aiBasedParsing(
  message: string,
  context?: any
): Promise<Intent> {
  const systemPrompt = `אתה מנתח כוונות (Intent Parser) למערכת φ (Phi) - מאמן פיננסי אישי.
תפקידך: לזהות את הכוונה של המשתמש ולחלץ מידע רלוונטי.

כוונות אפשריות:
- expense_log: רישום הוצאה (כולל סכומים ותיאורים)
- income_log: רישום הכנסה
- question_balance: שאלה על יתרה/מאזן
- question_spending: שאלה על הוצאות
- question_goal: שאלה על יעדים
- approval: אישור/כן (כולל: "נכון", "יופי", "מסכים", "ok")
- correction: תיקון מידע ("זה לא נכון", "תתקן")
- skip: דילוג על שאלה
- postpone: דחייה לאחר כך ("לא עכשיו", "מאוחר יותר")
- greeting: ברכה/שלום
- help: בקשת עזרה
- upload_document: העלאת מסמך/קבלה/דוח
- budget_request: בקשת תקציב/הגדרת תקציב/שאלה על תקציב
- goal_request: הגדרת יעד חיסכון/שאלה על יעדים/רצון לחסוך
- loan_consolidation: שאלה על הלוואות/איחוד הלוואות/מחזור
- unknown: לא ברור

החזר JSON בפורמט הזה:
{
  "intent": "<intent_type>",
  "confidence": <0.0-1.0>,
  "entities": [
    {
      "type": "amount|date|category|merchant|description|goal_name|target_amount",
      "value": "<value>",
      "confidence": <0.0-1.0>
    }
  ]
}`;

  try {
    const response = await chatWithGPT5Fast(
      `נתח את ההודעה: "${message}"`,
      systemPrompt,
      {
        userId: "",
        userName: "",
        phoneNumber: "",
      }
    );

    const parsed = JSON.parse(response);
    
    return {
      type: parsed.intent as IntentType,
      confidence: parsed.confidence,
      entities: parsed.entities.map((e: any) => ({
        type: e.type as EntityType,
        value: e.value,
        confidence: e.confidence,
        rawText: message,
      })),
    };
  } catch (error) {
    console.error("AI parsing error:", error);
    
    // Fallback to unknown with basic entity extraction
    return {
      type: "unknown",
      confidence: 0.3,
      entities: extractBasicEntities(message),
    };
  }
}

/**
 * Extract entities from expense message
 */
function extractEntitiesFromExpense(message: string): Entity[] {
  const entities: Entity[] = [];

  // Extract amount
  const amountMatch = message.match(/(\d+\.?\d*)\s*(שקל|ש״ח|₪)?/);
  if (amountMatch) {
    entities.push({
      type: "amount",
      value: parseFloat(amountMatch[1]),
      confidence: 0.95,
      rawText: amountMatch[0],
    });
  }

  // Extract date (if mentioned)
  const datePatterns = [
    /היום/,
    /אתמול/,
    /שלשום/,
    /ב?(\d{1,2})\/(\d{1,2})/,
  ];

  for (const pattern of datePatterns) {
    const match = message.match(pattern);
    if (match) {
      entities.push({
        type: "date",
        value: parseDateFromText(match[0]),
        confidence: 0.8,
        rawText: match[0],
      });
      break;
    }
  }

  // Extract description (rest of text)
  const descMatch = message.match(
    /(?:קניתי|הוצאתי|שילמתי|רכשתי)\s+(?:\d+\.?\d*\s*(?:שקל|ש״ח|₪)?\s+)?(.+)/i
  );
  
  if (descMatch && descMatch[1]) {
    entities.push({
      type: "description",
      value: descMatch[1].trim(),
      confidence: 0.7,
      rawText: descMatch[1],
    });
  }

  return entities;
}

/**
 * Extract entities from question
 */
function extractEntitiesFromQuestion(message: string): Entity[] {
  const entities: Entity[] = [];

  // Extract time period
  const timePatterns = [
    { pattern: /החודש/i, value: "current_month" },
    { pattern: /השבוע/i, value: "current_week" },
    { pattern: /היום/i, value: "today" },
    { pattern: /השנה/i, value: "current_year" },
  ];

  for (const { pattern, value } of timePatterns) {
    if (pattern.test(message)) {
      entities.push({
        type: "date",
        value: value,
        confidence: 0.9,
        rawText: message.match(pattern)?.[0] || "",
      });
      break;
    }
  }

  // Extract category if mentioned
  const categories = [
    "מזון",
    "בילויים",
    "תחבורה",
    "בריאות",
    "קניות",
    "חשבונות",
  ];

  for (const category of categories) {
    if (message.includes(category)) {
      entities.push({
        type: "category",
        value: category,
        confidence: 0.85,
        rawText: category,
      });
    }
  }

  return entities;
}

/**
 * Extract basic entities (amounts, dates) from any message
 */
function extractBasicEntities(message: string): Entity[] {
  const entities: Entity[] = [];

  // Extract all numbers as potential amounts
  const numbers = message.match(/\d+\.?\d*/g);
  if (numbers && numbers.length > 0) {
    entities.push({
      type: "amount",
      value: parseFloat(numbers[0]),
      confidence: 0.5,
      rawText: numbers[0],
    });
  }

  return entities;
}

/**
 * Extract goal-related entities
 */
function extractGoalEntities(message: string): Entity[] {
  const entities: Entity[] = [];

  // Extract target amount
  const amountMatch = message.match(/(\d+,?\d*\.?\d*)\s*(שקל|ש״ח|₪|אלף|k)?/i);
  if (amountMatch) {
    let amount = parseFloat(amountMatch[1].replace(",", ""));
    // Handle "אלף" or "k" multiplier
    if (amountMatch[2] && (amountMatch[2] === "אלף" || amountMatch[2].toLowerCase() === "k")) {
      amount *= 1000;
    }
    entities.push({
      type: "amount",
      value: amount,
      confidence: 0.85,
      rawText: amountMatch[0],
    });
  }

  // Extract goal name patterns
  const goalPatterns = [
    /רוצה ל(קנות|רכוש|לחסוך ל)\s+(.+?)(?:\s+ב|\s+עד|$)/i,
    /יעד(?:\s+של)?[:\s]+(.+?)(?:\s+ב|\s+עד|$)/i,
    /לחסוך ל(.+?)(?:\s+סכום|\s+של|$)/i,
  ];

  for (const pattern of goalPatterns) {
    const match = message.match(pattern);
    if (match) {
      const goalName = (match[2] || match[1]).trim();
      entities.push({
        type: "description",
        value: goalName,
        confidence: 0.75,
        rawText: match[0],
      });
      break;
    }
  }

  // Extract deadline if mentioned
  const deadlinePatterns = [
    { pattern: /עד\s+(סוף השנה|ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/i, type: "date" },
    { pattern: /בעוד\s+(\d+)\s+(חודשים?|שנים?)/i, type: "date" },
  ];

  for (const { pattern } of deadlinePatterns) {
    const match = message.match(pattern);
    if (match) {
      entities.push({
        type: "date",
        value: match[0],
        confidence: 0.7,
        rawText: match[0],
      });
      break;
    }
  }

  return entities;
}

/**
 * Parse date from Hebrew text
 */
function parseDateFromText(text: string): Date {
  const today = new Date();
  
  if (text.includes("היום")) {
    return today;
  }
  
  if (text.includes("אתמול")) {
    return new Date(today.setDate(today.getDate() - 1));
  }
  
  if (text.includes("שלשום")) {
    return new Date(today.setDate(today.getDate() - 2));
  }

  // Try parsing DD/MM format
  const dmMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (dmMatch) {
    const day = parseInt(dmMatch[1]);
    const month = parseInt(dmMatch[2]) - 1;
    const year = today.getFullYear();
    return new Date(year, month, day);
  }

  return today;
}

/**
 * Detect user mood from message characteristics
 */
export function detectUserMood(
  message: string,
  responseTime?: number
): "engaged" | "tired" | "busy" {
  const msg = message.trim();

  // Very short responses might indicate tiredness or being busy
  if (msg.length < 5) {
    return "busy";
  }

  // Check for frustration keywords
  const frustrationKeywords = [
    "די",
    "נמאס",
    "מספיק",
    "עייף",
    "לא רוצה",
    "תפסיק",
  ];
  
  for (const keyword of frustrationKeywords) {
    if (msg.includes(keyword)) {
      return "tired";
    }
  }

  // Enthusiastic responses (multiple exclamations, emojis)
  if (/[!😊🎉👍💪]/.test(message) || msg.length > 50) {
    return "engaged";
  }

  // Slow response time might indicate busy
  if (responseTime && responseTime > 300000) {
    // 5 minutes
    return "busy";
  }

  return "engaged";
}

