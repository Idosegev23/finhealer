/**
 * GPT-5.2 Client - Responses API
 * 
 * שימוש ב-Responses API החדש במקום Chat Completions
 * כל ההחלטות דינאמיות - אין קוד קשיח!
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// הגדרת המודל
const MODEL = 'gpt-5.2'; // או 'gpt-4o' כ-fallback

// ============================================================================
// Types
// ============================================================================

export interface PhiContext {
  userId: string;
  userName: string;
  phone: string;
  currentPhase: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  financialData?: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    pendingTransactions: number;
    categories: Record<string, number>;
    monthlyTrends: Array<{ month: string; income: number; expenses: number }>;
  };
  pendingTransactions?: Array<{
    id: string;
    vendor: string;
    amount: number;
    type: 'income' | 'expense';
    date: string;
    category?: string;
  }>;
  learnedPatterns?: Record<string, string>; // vendor -> category
  
  // 🆕 מסמכים חסרים וכיסוי תקופות
  missingDocuments?: Array<{
    type: string; // credit, payslip, mortgage, loan, insurance, pension
    description: string;
    priority: string;
    card_last_4?: string;
    period_start?: string;
    period_end?: string;
    expected_amount?: number;
  }>;
  periodCoverage?: {
    totalMonths: number;
    targetMonths: number;
    coveredMonths: string[];
    missingMonths: string[];
    oldestDate?: string;
    newestDate?: string;
  };
}

export interface PhiResponse {
  message: string;
  actions: PhiAction[];
  shouldWaitForResponse: boolean;
  imageToSend?: {
    base64: string;
    filename: string;
    description?: string;
  };
}

export interface PhiAction {
  type: string; // דינאמי לחלוטין!
  data?: Record<string, unknown>;
}

// ============================================================================
// System Prompts - פרומפט קצר לכל שלב (Hybrid Architecture)
// ============================================================================

/**
 * בארכיטקטורה החדשה:
 * - Onboarding = State Machine קשיח (AI רק מנסח)
 * - אחרי Onboarding = AI גמיש (Full AI)
 * 
 * לכן יש שני סוגי prompts:
 * 1. SIMPLE_PROMPTS - לשלבי Onboarding (AI רק מנסח את הטקסט)
 * 2. FULL_PROMPT - לאחרי Onboarding (AI מחליט הכל)
 */

// Prompts פשוטים לשלבי Onboarding - AI רק מנסח, לא מחליט
export const SIMPLE_PROMPTS = {
  // ברכת שם - אחרי שהמשתמש נתן שם
  greet_name: `אתה φ (פי) - מאמן פיננסי ישראלי חם ואנושי.
המשתמש זה עתה אמר לך את שמו: {{NAME}}
משימתך: כתוב הודעת ברכה חמה והדרכה לשלב הבא.

הודעתך חייבת לכלול:
1. ברכה אישית עם השם
2. הסבר שהצעד הראשון הוא לשלוח דוח עו״ש מהבנק (PDF)
3. עידוד קצר

דוגמה:
"נעים מאוד *{{NAME}}*! 😊

מעולה, אז בוא נתחיל.

*הצעד הראשון:* שלח לי דוח עו״ש מהבנק שלך (PDF) של 3 חודשים אחרונים.
אני אנתח את התנועות ונבנה את התמונה הפיננסית שלך 📊"

כללים:
- עברית טבעית וחמה
- מקסימום 4-5 שורות
- אימוג'י במידה
- בולד = כוכבית אחת: *כך*`,

  // בקשת מסמך - כשצריך לבקש מסמך
  request_document: `אתה φ (פי) - מאמן פיננסי ישראלי.
משימתך: בקש מהמשתמש {{DOCUMENT_TYPE}}.

אם זה דוח בנק ראשון:
"בוא נתחיל! 📊
שלח לי דוח עו״ש מהבנק (PDF) של 3 חודשים אחרונים.
זה יעזור לי להבין את התמונה הפיננסית שלך."

אם זה דוח אשראי:
"כדי לקבל תמונה מלאה, אני צריך גם את דוח האשראי שלך.
שלח לי PDF של דוח כרטיס האשראי האחרון 💳"

כללים:
- קצר וברור
- עידוד קל
- לא ללחוץ`,

  // אישור קבלת מסמך
  document_received: `אתה φ (פי) - מאמן פיננסי ישראלי.
קיבלת מסמך מהמשתמש {{NAME}}.
{{DOCUMENT_INFO}}

משימתך: כתוב הודעה קצרה שמאשרת קבלה ומעדכנת שאתה מנתח.

דוגמה:
"קיבלתי! 📄
אני מנתח את הדוח... זה ייקח כמה שניות ⏳"

כללים:
- קצר מאוד (שורה-שתיים)
- אימוג'י רלוונטי`,

  // תחילת סיווג
  start_classification: `אתה φ (פי) - מאמן פיננסי ישראלי.
יש {{COUNT}} תנועות לסיווג עבור {{NAME}}.

משימתך: הצג את התנועה הראשונה ושאל איך לסווג.

דוגמה:
"מצאתי {{COUNT}} תנועות! 🔍

*התנועה הראשונה:*
{{AMOUNT}} ₪ ב-*{{VENDOR}}*
({{DATE}})

זה *{{SUGGESTED_CATEGORY}}*?"

כללים:
- תנועה אחת בכל פעם
- הצע קטגוריה אם אפשר
- קצר וברור`,
};

// הפרומפט המלא - לאחרי Onboarding (AI גמיש)
const PHI_SYSTEM_PROMPT = `אתה φ (פי) - מאמן פיננסי אישי ישראלי.

## מי אתה
- שמך φ (פי) - כמו היחס הזהב במתמטיקה
- אתה חם, אנושי, תומך ולא שיפוטי
- אתה מדבר בעברית טבעית עם קצת אימוג'ים
- אתה זוכר את השיחה ומתייחס להקשר

## 📖 מידע על השירות (אם המשתמש שואל)

### איך זה עובד?
1. המשתמש שולח לך דוחות בנק/אשראי (PDF)
2. אתה מנתח את התנועות אוטומטית
3. ביחד מסווגים את התנועות לקטגוריות
4. בונים תמונה ברורה של הכנסות, הוצאות וחיסכון
5. מקבלים תובנות והמלצות

### למה זה שונה?
- אתה מאמן, לא יועץ - מלווה, לא מטיף
- בלי שיפוטיות - אין "טוב" או "רע", רק נתונים
- בקצב של המשתמש - לא לוחצים
- פרטיות מלאה - הנתונים שלו

### מה המשתמש מקבל?
- תמונה ברורה של הכסף שלו
- הבנה לאן הכסף הולך
- יכולת לתכנן קדימה
- שליטה ובטחון בהחלטות פיננסיות
- ציון φ - מדד הבריאות הפיננסית

### מחירים
- מנוי בסיסי: 49₪/חודש
- מנוי פרימיום: 119₪/חודש
- המשתמש כבר משלם (נרשם באתר)

### אם המשתמש שואל שאלות על התהליך:
- ענה בצורה ברורה וקצרה
- תן ביטחון
- אל תמהר - תן לו להבין
- בסוף, חזור לתהליך (שאל את השם או בקש מסמך)

## ⚠️⚠️⚠️ הכלל הקריטי ביותר - תמיד להחזיר הודעה!
**גם כשאתה קורא ל-function/tool - חייב לכתוב הודעת טקסט למשתמש!**
לעולם אל תקרא ל-tool בלי להחזיר גם הודעה ברורה.

## ⚠️ CONTEXT FIRST!
**לפני כל תגובה, קרא את ה-CONTEXT שמקבל ותגיב רק למה שרלוונטי!**

- אם המשתמש שאל שאלה → ענה על השאלה
- אם המשתמש שלח מסמך → דבר על המסמך
- אם יש תנועות ממתינות → עזור לסווג אותן
- אם אין נתונים → בקש מסמך ראשון
- אם הכל מסווג → תן תובנות ותהיה זמין לשאלות

**🚫 אל תשאל שאלות שלא קשורות להקשר הנוכחי!**
**🚫 אל תתחיל לסווג תנועות אם המשתמש שאל משהו אחר!**
**🚫 אל תחזור על עצמך - קרא את ההיסטוריה!**

## הכללים שלך
1. **תמיד בעברית** - גם בחשיבה
2. **קצר ותמציתי** - מקסימום 3-4 שורות להודעה רגילה
3. **בולד = כוכבית אחת** - *כך* ולא **כך**
4. **לא להמציא** - אם לא יודע, להגיד שלא יודע
5. **לא לחזור על עצמך** - כל הודעה שונה
6. **תגיב למה שהמשתמש אמר** - לא למה שאתה רוצה להגיד

## היכולות שלך (דרך function calling)
יש לך גישה לכלים הבאים. השתמש בהם *רק כשרלוונטי*:

1. **save_user_name** - 🆕 שמור את שם המשתמש (חשוב! כשהוא אומר את שמו)
2. **save_transaction** - שמור תנועה חדשה או עדכן קיימת
3. **classify_transaction** - סווג תנועה לקטגוריה
4. **bulk_classify** - סווג מספר תנועות בבת אחת
5. **save_pattern** - למד pattern חדש (vendor → category)
6. **generate_chart** - צור גרף/תמונה - תאר מה אתה רוצה ו-Gemini ייצר
7. **get_financial_summary** - קבל סיכום פיננסי
8. **set_budget** - הגדר תקציב לקטגוריה
9. **set_goal** - הגדר יעד חיסכון
10. **move_to_phase** - העבר את המשתמש לשלב הבא
11. **request_document** - בקש מסמך מהמשתמש

## 🎯 תהליך ה-Onboarding (שלב: onboarding)

**חשוב:** המשתמש כבר נרשם באתר וכבר קיבל הודעת פתיחה מפורטת שמסבירה איך זה עובד ושואלת "מה השם שלך?"
ההודעה הראשונה שלו היא כנראה **תשובה לשאלה על השם**.

### ⚠️ אחרי שמקבלים שם - להדריך, לא לשאול!
כשהמשתמש שולח שם (מילה אחת/שתיים, או "אני X", "קוראים לי X", או סתם שם):
1. **קרא ל-save_user_name** עם השם
2. **וגם** החזר הודעה שמדריכה לשלב הבא:

דוגמה:
"נעים מאוד *גדי*! 😊

מעולה, אז בוא נתחיל.

*הצעד הראשון:*
שלח לי דוח עו״ש מהבנק שלך (PDF) של 3 חודשים אחרונים.

אני אנתח את התנועות ונתחיל לבנות את התמונה הפיננסית שלך 📊"

### 🚫 מה לא לעשות אחרי קבלת שם:
- ❌ לא לשאול "איך אפשר לעזור?"
- ❌ לא לשאול "במה תרצה להתחיל?"
- ❌ לא לחכות - להדריך!

### כשהשם כבר ידוע ואין מסמכים:
- הדרך לשלב הבא: "עכשיו בוא נתחיל - שלח לי דוח עו״ש מהבנק (PDF) של 3 חודשים אחרונים 📊"

### אם המשתמש שואל שאלה במקום לתת שם:
- ענה על השאלה
- בסוף התשובה, חזור לבקש את השם: "אגב, איך קוראים לך?"

## איך להתנהג לפי CONTEXT

### אם זה משתמש חדש (שם לא ידוע):
- ברך בחום, הצג את עצמך כ-φ
- שאל את שם המשתמש
- *רק אחרי שהמשתמש עונה עם שם - שמור אותו!*

### אם יש שם אבל אין מסמכים:
- הסבר בקצרה מה תעשו יחד
- בקש מסמך ראשון (דוח בנק)

### אם יש תנועות ממתינות לסיווג:
- עזור לסווג אותן
- תנועות ברורות (סופר, דלק) → סווג אוטומטית
- תנועות לא ברורות → שאל בצורה קצרה
- *אבל רק אם המשתמש רוצה לסווג עכשיו!*

### אם המשתמש שאל שאלה:
- ענה על השאלה מתוך הנתונים שיש לך
- אם אין לך תשובה, אמור שאתה צריך יותר מידע
- *אל תתחיל לסווג תנועות אם שאלו שאלה!*

### אם המשתמש רוצה גרף:
- השתמש ב-generate_chart
- תאר בדיוק מה לייצר
- *אל תשאל שאלות נוספות - פשוט ייצר!*

## דוגמאות

### ✅ נכון - אחרי קבלת שם, מדריך לשלב הבא:
משתמש: "גדי"
[קורא ל-save_user_name("גדי")]
תגובה: "נעים מאוד *גדי*! 😊

מעולה, אז בוא נתחיל.

*הצעד הראשון:*
שלח לי דוח עו״ש מהבנק שלך (PDF) של 3 חודשים אחרונים.

אני אנתח את התנועות ונתחיל לבנות את התמונה שלך 📊"

### ❌ לא נכון - שואל במקום להדריך:
משתמש: "גדי"
תגובה: "נעים להכיר גדי! איך אפשר לעזור?"
(זה לא נכון! צריך להדריך, לא לשאול)

### ❌ לא נכון - שואל שאלות לא רלוונטיות:
משתמש: "היי"
תגובה: "מה הקטגוריה של 250 ₪ בשופרסל?"

### ✅ נכון - תגובה מותאמת להקשר:
משתמש: "היי"
(אם השם לא ידוע) תגובה: "היי! 😊 טוב שחזרת. מה השם שלך?"
(אם השם ידוע) תגובה: "היי *גדי*! 😊 מה קורה?"

## זכור
- **תמיד תמיד תמיד להחזיר הודעת טקסט** - גם כשקוראים ל-tool
- **CONTEXT FIRST** - תמיד קרא את המידע שמקבל ותגיב בהתאם
- אתה לא רובוט, אתה מאמן אישי
- תן ערך בכל הודעה
- עודד ותמוך, גם כשיש חריגות`;

// ============================================================================
// Tools Definition - כלים דינאמיים (Responses API format)
// ============================================================================

const PHI_TOOLS: OpenAI.Responses.Tool[] = [
  // 🆕 שמירת שם המשתמש - חשוב ל-onboarding!
  {
    type: 'function',
    name: 'save_user_name',
    description: 'שמור את שם המשתמש. השתמש כשהמשתמש אומר את שמו בפעם הראשונה',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'השם שהמשתמש מסר' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'save_transaction',
    description: 'שמור תנועה חדשה או עדכן קיימת',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        transaction_id: { type: ['string', 'null'], description: 'מזהה התנועה (לעדכון)' },
        vendor: { type: 'string', description: 'שם בית העסק' },
        amount: { type: 'number', description: 'הסכום' },
        tx_type: { type: 'string', enum: ['income', 'expense'], description: 'סוג התנועה' },
        category: { type: ['string', 'null'], description: 'קטגוריה' },
        date: { type: ['string', 'null'], description: 'תאריך בפורמט YYYY-MM-DD' },
        notes: { type: ['string', 'null'], description: 'הערות' },
      },
      required: ['transaction_id', 'vendor', 'amount', 'tx_type', 'category', 'date', 'notes'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'classify_transaction',
    description: 'סווג תנועה לקטגוריה',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        transaction_id: { type: 'string', description: 'מזהה התנועה' },
        category: { type: 'string', description: 'שם הקטגוריה' },
        is_confirmed: { type: ['boolean', 'null'], description: 'האם מאושר על ידי המשתמש' },
      },
      required: ['transaction_id', 'category', 'is_confirmed'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'bulk_classify',
    description: 'סווג מספר תנועות בבת אחת לאותה קטגוריה',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        transaction_ids: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'מזהי התנועות' 
        },
        category: { type: 'string', description: 'שם הקטגוריה' },
      },
      required: ['transaction_ids', 'category'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'save_pattern',
    description: 'שמור pattern למידה - כשמשתמש מאשר שvendor מסוים שייך לקטגוריה',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        vendor: { type: 'string', description: 'שם בית העסק' },
        category: { type: 'string', description: 'הקטגוריה שלמדנו' },
      },
      required: ['vendor', 'category'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'generate_chart',
    description: 'צור גרף או תמונה ויזואלית. תאר מה אתה רוצה לראות והמערכת תייצר.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        chart_description: { type: 'string', description: 'תיאור מפורט של הגרף הרצוי בעברית - מה להציג, איזה סוג גרף, מה להדגיש' },
        title: { type: ['string', 'null'], description: 'כותרת הגרף' },
      },
      required: ['chart_description', 'title'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'get_financial_summary',
    description: 'קבל סיכום פיננסי של המשתמש',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        period: { 
          type: 'string', 
          enum: ['this_month', 'last_month', 'last_3_months', 'this_year'],
          description: 'התקופה לסיכום' 
        },
      },
      required: ['period'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'set_budget',
    description: 'הגדר תקציב חודשי לקטגוריה',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'שם הקטגוריה' },
        amount: { type: 'number', description: 'סכום התקציב החודשי' },
      },
      required: ['category', 'amount'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'set_goal',
    description: 'הגדר יעד חיסכון',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        goal_name: { type: 'string', description: 'שם היעד' },
        target_amount: { type: 'number', description: 'סכום היעד' },
        deadline: { type: ['string', 'null'], description: 'תאריך יעד בפורמט YYYY-MM-DD' },
      },
      required: ['goal_name', 'target_amount', 'deadline'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'move_to_phase',
    description: 'העבר את המשתמש לשלב הבא בתהליך',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        phase: { 
          type: 'string', 
          enum: ['onboarding', 'document_upload', 'classification', 'behavior', 'budget', 'goals', 'monitoring'],
          description: 'השלב החדש' 
        },
        reason: { type: ['string', 'null'], description: 'הסיבה למעבר' },
      },
      required: ['phase', 'reason'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'request_document',
    description: 'בקש מהמשתמש לשלוח מסמך',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        document_type: { 
          type: 'string', 
          description: 'סוג המסמך הנדרש (דוח בנק, כרטיס אשראי, תלוש שכר, וכו)' 
        },
        reason: { type: ['string', 'null'], description: 'למה צריך את המסמך' },
      },
      required: ['document_type', 'reason'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'calculate_phi_score',
    description: 'חשב את ציון φ של המשתמש - מדד הבריאות הפיננסית',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
];

// ============================================================================
// Main Function - שיחה עם GPT-5.2
// ============================================================================

export async function thinkWithPhi(
  userMessage: string,
  context: PhiContext
): Promise<PhiResponse> {
  console.log('[GPT-5.2] Starting conversation...');
  console.log('[GPT-5.2] User:', userMessage.substring(0, 50) + '...');
  
  // בניית ההקשר להודעה
  const contextMessage = buildContextMessage(context);
  
  // בניית היסטוריית השיחה
  const input: OpenAI.Responses.ResponseInput = [
    ...context.conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    {
      role: 'user' as const,
      content: `${contextMessage}\n\nהודעת המשתמש: ${userMessage}`,
    },
  ];

  try {
    // קריאה ל-Responses API
    const response = await openai.responses.create({
      model: MODEL,
      instructions: PHI_SYSTEM_PROMPT,
      input,
      tools: PHI_TOOLS,
      store: true, // שמירת היסטוריה
    });

    console.log('[GPT-5.2] Response received');
    
    // עיבוד התגובה
    return processResponse(response, context);
    
  } catch (error) {
    console.error('[GPT-5.2] Error:', error);
    
    // Fallback ל-gpt-4o אם gpt-5.2 לא זמין
    if ((error as Error).message?.includes('model')) {
      console.log('[GPT-5.2] Falling back to gpt-4o...');
      return thinkWithPhiFallback(userMessage, context);
    }
    
    return {
      message: 'אופס, משהו השתבש 😅 נסה שוב בבקשה',
      actions: [],
      shouldWaitForResponse: true,
    };
  }
}

// ============================================================================
// Fallback - שימוש ב-gpt-4o אם 5.2 לא זמין
// ============================================================================

async function thinkWithPhiFallback(
  userMessage: string,
  context: PhiContext
): Promise<PhiResponse> {
  console.log('[GPT-5.2 Fallback] Conversation history length:', context.conversationHistory?.length || 0);
  
  const contextMessage = buildContextMessage(context);
  
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: PHI_SYSTEM_PROMPT },
    ...(context.conversationHistory || []).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    {
      role: 'user',
      content: `${contextMessage}\n\nהודעת המשתמש: ${userMessage}`,
    },
  ];

  // Convert Responses API tools to Chat Completions format
  const chatTools = PHI_TOOLS
    .filter(tool => tool.type === 'function')
    .map(tool => {
      const funcTool = tool as OpenAI.Responses.FunctionTool;
      return {
        type: 'function' as const,
        function: {
          name: funcTool.name,
          description: funcTool.description || '',
          parameters: funcTool.parameters as Record<string, unknown> || { type: 'object' },
        },
      };
    });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    tools: chatTools,
  });

  return processCompletionResponse(completion, context);
}

// ============================================================================
// Response Processing
// ============================================================================

function processResponse(
  response: OpenAI.Responses.Response,
  context: PhiContext
): PhiResponse {
  const actions: PhiAction[] = [];
  let message = '';
  let imageToSend: PhiResponse['imageToSend'] | undefined;

  // עיבור ה-output
  for (const item of response.output || []) {
    if (item.type === 'message') {
      // הודעת טקסט
      for (const content of item.content || []) {
        if (content.type === 'output_text') {
          message += content.text;
        }
      }
    } else if (item.type === 'function_call') {
      // קריאה לפונקציה
      const toolCall = item as OpenAI.Responses.ResponseFunctionToolCall;
      const args = JSON.parse(toolCall.arguments || '{}');
      
      actions.push({
        type: toolCall.name,
        data: args,
      });
      
      console.log('[GPT-5.2] Tool call:', toolCall.name, args);
    }
  }

  // בדיקה אם יש בקשה ליצירת גרף
  const chartAction = actions.find(a => a.type === 'generate_chart');
  if (chartAction) {
    // סימון שצריך לייצר גרף - יטופל ב-handler
    console.log('[GPT-5.2] Chart generation requested:', chartAction.data);
  }

  return {
    message,
    actions,
    shouldWaitForResponse: true,
    imageToSend,
  };
}

function processCompletionResponse(
  completion: OpenAI.Chat.Completions.ChatCompletion,
  context: PhiContext
): PhiResponse {
  const choice = completion.choices[0];
  const actions: PhiAction[] = [];
  
  // עיבוד tool calls - רק function calls
  if (choice.message.tool_calls) {
    for (const toolCall of choice.message.tool_calls) {
      // Type guard for function tool calls
      if (toolCall.type === 'function' && 'function' in toolCall) {
        const funcCall = toolCall as { function: { name: string; arguments: string } };
        const args = JSON.parse(funcCall.function.arguments || '{}');
        actions.push({
          type: funcCall.function.name,
          data: args,
        });
      }
    }
  }

  return {
    message: choice.message.content || '',
    actions,
    shouldWaitForResponse: true,
  };
}

// ============================================================================
// Context Builder
// ============================================================================

function buildContextMessage(context: PhiContext): string {
  const parts: string[] = [];
  
  // מידע על המשתמש
  parts.push(`## מידע על המשתמש
- שם: ${context.userName || 'לא ידוע'}
- שלב נוכחי: ${context.currentPhase}
- טלפון: ${context.phone}`);

  // נתונים פיננסיים
  if (context.financialData) {
    const fd = context.financialData;
    parts.push(`
## נתונים פיננסיים
- הכנסות: ${fd.totalIncome.toLocaleString('he-IL')} ₪
- הוצאות: ${fd.totalExpenses.toLocaleString('he-IL')} ₪
- יתרה: ${fd.balance.toLocaleString('he-IL')} ₪
- תנועות ממתינות: ${fd.pendingTransactions}`);

    if (Object.keys(fd.categories).length > 0) {
      parts.push(`
### התפלגות הוצאות לפי קטגוריה:`);
      Object.entries(fd.categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([cat, amount]) => {
          parts.push(`- ${cat}: ${amount.toLocaleString('he-IL')} ₪`);
        });
    }
  }

  // תנועות ממתינות
  if (context.pendingTransactions && context.pendingTransactions.length > 0) {
    parts.push(`
## תנועות ממתינות לסיווג (${context.pendingTransactions.length}):`);
    context.pendingTransactions.slice(0, 10).forEach(tx => {
      parts.push(`- ${tx.amount.toLocaleString('he-IL')} ₪ | ${tx.vendor} | ${tx.date} | ${tx.category || 'לא מסווג'}`);
    });
  }

  // patterns שנלמדו
  if (context.learnedPatterns && Object.keys(context.learnedPatterns).length > 0) {
    parts.push(`
## Patterns שנלמדו (vendor → category):`);
    Object.entries(context.learnedPatterns).slice(0, 10).forEach(([vendor, category]) => {
      parts.push(`- ${vendor} → ${category}`);
    });
  }

  // 🆕 כיסוי תקופות - מידע קריטי!
  if (context.periodCoverage) {
    const pc = context.periodCoverage;
    parts.push(`
## כיסוי תקופות
- יש לי נתונים של: ${pc.totalMonths} חודשים מתוך ${pc.targetMonths} נדרשים
- תקופה: ${pc.oldestDate || 'לא ידוע'} עד ${pc.newestDate || 'לא ידוע'}
- חודשים שמכוסים: ${pc.coveredMonths.join(', ') || 'אין'}
- *חודשים חסרים*: ${pc.missingMonths.join(', ') || 'אין - הכל מכוסה!'}`);
  }

  // 🆕 מסמכים חסרים - חשוב מאוד!
  if (context.missingDocuments && context.missingDocuments.length > 0) {
    parts.push(`
## מסמכים חסרים (צריך לבקש מהמשתמש):`);
    context.missingDocuments.forEach(doc => {
      let docDesc = `- *${doc.type}*: ${doc.description}`;
      if (doc.card_last_4) docDesc += ` (כרטיס ****${doc.card_last_4})`;
      if (doc.period_start && doc.period_end) docDesc += ` לתקופה ${doc.period_start} - ${doc.period_end}`;
      if (doc.expected_amount) docDesc += ` (סכום: ${doc.expected_amount.toLocaleString('he-IL')} ₪)`;
      docDesc += ` [${doc.priority}]`;
      parts.push(docDesc);
    });
    
    parts.push(`
**⚠️ חשוב:** בקש מהמשתמש את המסמכים החסרים כדי לקבל תמונה פיננסית מלאה!`);
  }

  return parts.join('\n');
}

// ============================================================================
// Simple Prompt Function - לשלבי Onboarding
// ============================================================================

/**
 * פונקציה פשוטה לניסוח הודעות בשלבי Onboarding
 * AI רק מנסח את הטקסט - לא מחליט!
 */
export async function generateSimpleMessage(
  promptKey: keyof typeof SIMPLE_PROMPTS,
  variables: Record<string, string>
): Promise<string> {
  let prompt = SIMPLE_PROMPTS[promptKey];
  
  // החלפת משתנים
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // מודל קל וזול לניסוח
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'כתוב את ההודעה' },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });
    
    return completion.choices[0].message.content || '';
  } catch (error) {
    console.error('[Simple Prompt] Error:', error);
    // Fallback - טקסט קבוע
    return getFallbackMessage(promptKey, variables);
  }
}

/**
 * הודעות fallback קבועות במקרה של שגיאה
 */
function getFallbackMessage(
  promptKey: keyof typeof SIMPLE_PROMPTS,
  variables: Record<string, string>
): string {
  switch (promptKey) {
    case 'greet_name':
      return `נעים מאוד *${variables.NAME}*! 😊\n\n*הצעד הראשון:* שלח לי דוח עו״ש מהבנק (PDF) של 3 חודשים אחרונים 📊`;
    case 'request_document':
      return `בוא נתחיל! 📊\nשלח לי ${variables.DOCUMENT_TYPE} בבקשה.`;
    case 'document_received':
      return `קיבלתי! 📄 אני מנתח את המסמך...`;
    case 'start_classification':
      return `מצאתי ${variables.COUNT} תנועות! 🔍\n\nבוא נסווג אותן יחד.`;
    default:
      return 'היי! איך אפשר לעזור? 😊';
  }
}

// ============================================================================
// Context Loader - נפגש מ-phi-brain.ts
// ============================================================================

/**
 * טוען את כל ה-context הנדרש ל-AI
 */
export async function loadPhiContext(userId: string): Promise<PhiContext> {
  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();

  // טען פרטי משתמש
  const { data: user } = await supabase
    .from('users')
    .select('id, phone, full_name, current_phase')
    .eq('id', userId)
    .single();

  // טען היסטוריית שיחה - payload מכיל את התוכן
  const { data: messages, error: messagesError } = await supabase
    .from('wa_messages')
    .select('direction, payload, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (messagesError) {
    console.error('[φ Context] Error loading messages:', messagesError);
  } else {
    console.log('[φ Context] Messages loaded:', messages?.length || 0, 'messages');
  }

  const conversationHistory = (messages || [])
    .reverse()
    .map(msg => {
      const payload = msg.payload as Record<string, unknown>;
      // תמיכה בפורמטים שונים של payload
      let content = '';
      if (payload?.message) {
        // הודעה יוצאת מ-wa/send
        content = payload.message as string;
      } else if (payload?.text) {
        // הודעה נכנסת עם text
        content = payload.text as string;
      } else if (payload?.messageData) {
        // הודעה נכנסת מ-GreenAPI webhook
        const messageData = payload.messageData as Record<string, unknown>;
        content = (messageData.textMessage as string) || 
                  ((messageData.fileMessageData as Record<string, unknown>)?.caption as string) || '';
      }
      return {
        role: (msg.direction === 'outgoing' ? 'assistant' : 'user') as 'user' | 'assistant',
        content,
      };
    })
    .filter(msg => msg.content); // סנן הודעות ריקות

  // טען תנועות ממתינות לאישור (proposed = pending)
  const { data: pendingTx } = await supabase
    .from('transactions')
    .select('id, vendor, amount, type, tx_date, status, category')
    .eq('user_id', userId)
    .eq('status', 'proposed')
    .order('tx_date', { ascending: false })
    .limit(50);

  // טען סטטיסטיקות
  const { data: stats } = await supabase
    .from('transactions')
    .select('amount, type, status')
    .eq('user_id', userId);

  let financialData: PhiContext['financialData'];
  if (stats && stats.length > 0) {
    const totalIncome = stats
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = stats
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const pendingCount = stats.filter(t => t.status === 'proposed').length;

    // קיבוץ לפי קטגוריה
    const categories: Record<string, number> = {};
    stats
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const cat = (t as unknown as { category?: string }).category || 'אחר';
        categories[cat] = (categories[cat] || 0) + Number(t.amount);
      });

    financialData = {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      pendingTransactions: pendingCount,
      categories,
      monthlyTrends: [], // ימולא בהמשך
    };
  }

  // 🆕 טען מסמכים חסרים
  const { data: missingDocs } = await supabase
    .from('missing_documents')
    .select('document_type, description, priority, card_last_4, period_start, period_end, expected_amount')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .limit(10);

  // 🆕 חשב כיסוי תקופות מהתנועות
  const { data: dateRange } = await supabase
    .from('transactions')
    .select('tx_date')
    .eq('user_id', userId)
    .order('tx_date', { ascending: true });

  let periodCoverage: PhiContext['periodCoverage'];
  if (dateRange && dateRange.length > 0) {
    const dates = dateRange.map(d => d.tx_date).filter(Boolean);
    const oldestDate = dates[0];
    const newestDate = dates[dates.length - 1];
    
    // חשב חודשים מכוסים
    const coveredMonthsSet = new Set<string>();
    dates.forEach(d => {
      const date = new Date(d);
      coveredMonthsSet.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    });
    
    // חשב חודשים חסרים (3 חודשים אחרונים)
    const targetMonths = 3;
    const now = new Date();
    const allTargetMonths: string[] = [];
    for (let i = 0; i < targetMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      allTargetMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    
    const coveredMonths = Array.from(coveredMonthsSet);
    const missingMonths = allTargetMonths.filter(m => !coveredMonthsSet.has(m));
    
    periodCoverage = {
      totalMonths: coveredMonthsSet.size,
      targetMonths,
      coveredMonths,
      missingMonths,
      oldestDate,
      newestDate,
    };
  }

  const context: PhiContext = {
    userId,
    userName: user?.full_name || '',
    phone: user?.phone || '',
    currentPhase: user?.current_phase || 'onboarding',
    conversationHistory,
    financialData,
    pendingTransactions: (pendingTx || []).map(tx => ({
      id: tx.id,
      vendor: tx.vendor || '',
      amount: tx.amount,
      type: tx.type as 'income' | 'expense',
      date: tx.tx_date || new Date().toISOString(),
      category: tx.category,
    })),
    // 🆕 מידע על מסמכים חסרים וכיסוי תקופות
    missingDocuments: (missingDocs || []).map(doc => ({
      type: doc.document_type,
      description: doc.description || '',
      priority: doc.priority === 10 ? 'high' : doc.priority >= 5 ? 'medium' : 'low',
      card_last_4: doc.card_last_4,
      period_start: doc.period_start,
      period_end: doc.period_end,
      expected_amount: doc.expected_amount,
    })),
    periodCoverage,
  };
  
  console.log('[φ Context] Context loaded:', {
    userName: context.userName,
    phase: context.currentPhase,
    historyLength: context.conversationHistory?.length || 0,
    pendingTx: context.pendingTransactions?.length || 0,
    financial: context.financialData ? 'loaded' : 'none',
    missingDocs: context.missingDocuments?.length || 0,
    periodCoverage: context.periodCoverage ? `${context.periodCoverage.totalMonths}/${context.periodCoverage.targetMonths} months` : 'none',
  });
  
  return context;
}

// ============================================================================
// Export
// ============================================================================

export default {
  thinkWithPhi,
  generateSimpleMessage,
  loadPhiContext,
  SIMPLE_PROMPTS,
};

