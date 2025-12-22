/**
 * Message Composer - AI מנסח הודעות
 * 
 * הלוגיקה קשיחה (Router קובע מה לעשות)
 * AI רק מנסח את הטקסט בצורה מגוונת
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// Types
// ============================================================================

export interface ComposedMessage {
  message: string;
  buttons?: Array<{
    id: string;
    text: string;
  }>;
}

export interface ComposeContext {
  userName?: string;
  transactionCount?: number;
  incomeCount?: number;
  expenseCount?: number;
  totalIncome?: number;
  totalExpenses?: number;
  periodStart?: string;
  periodEnd?: string;
  missingDocuments?: string[];
  currentTransaction?: {
    amount: number;
    vendor: string;
    date: string;
    type: 'income' | 'expense';
    suggestedCategory?: string;
  };
  remainingCount?: number;
  categoryTotals?: Record<string, number>;
}

// ============================================================================
// Message Types - מה Router רוצה להציג
// ============================================================================

export type MessageType = 
  | 'welcome'                    // הודעת פתיחה
  | 'ask_name'                   // בקשת שם
  | 'name_received'              // קיבלנו שם, בקש מסמך
  | 'document_received'          // מסמך התקבל, הצע אפשרויות
  | 'show_transaction'           // הצג תנועה לסיווג
  | 'transaction_classified'     // תנועה סווגה
  | 'transaction_skipped'        // תנועה דולגה
  | 'classification_complete'    // סיום סיווג
  | 'summary'                    // סיכום
  | 'error';                     // שגיאה

// ============================================================================
// Compose Function - קריאה ל-AI לניסוח
// ============================================================================

export async function composeMessage(
  type: MessageType,
  context: ComposeContext
): Promise<ComposedMessage> {
  
  const prompt = buildPrompt(type, context);
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // מהיר וזול לניסוח
      messages: [
        {
          role: 'system',
          content: `אתה מנסח הודעות WhatsApp עבור φ (פאי) - מאמן פיננסי.
          
כללים:
- עברית טבעית וחמה
- קצר - מקסימום 4-5 שורות
- אימוג'ים במידה (1-2 לכל הודעה)
- *bold* לדגשים
- לא להטיף, לא לשפוט

החזר JSON בפורמט:
{
  "message": "הטקסט של ההודעה",
  "buttons": [
    {"id": "button_id", "text": "טקסט הכפתור"}
  ]
}

אם אין כפתורים, החזר buttons כמערך ריק.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8, // גיוון בניסוח
      max_tokens: 300,
    });
    
    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    
    return {
      message: parsed.message || getFallbackMessage(type, context),
      buttons: parsed.buttons || [],
    };
    
  } catch (error) {
    console.error('[Composer] AI error, using fallback:', error);
    return getFallback(type, context);
  }
}

// ============================================================================
// Prompt Builder - בניית prompt לכל סוג הודעה
// ============================================================================

function buildPrompt(type: MessageType, ctx: ComposeContext): string {
  switch (type) {
    case 'welcome':
      return `נסח הודעת פתיחה ל-φ (פאי) - מאמן פיננסי.
הסבר בקצרה מה עושים ובקש את השם.`;

    case 'ask_name':
      return `בקש מהמשתמש את השם שלו בצורה ידידותית.`;

    case 'name_received':
      return `המשתמש אמר שקוראים לו "${ctx.userName}".
ברך אותו ובקש ממנו לשלוח דוח בנק (PDF).
כפתורים: לא צריך.`;

    case 'document_received':
      return `קיבלנו דוח בנק ונתחנו אותו.
נתונים:
- ${ctx.transactionCount} תנועות
- ${ctx.incomeCount} הכנסות (${ctx.totalIncome?.toLocaleString('he-IL')} ₪)
- ${ctx.expenseCount} הוצאות (${ctx.totalExpenses?.toLocaleString('he-IL')} ₪)
- תקופה: ${ctx.periodStart} עד ${ctx.periodEnd}
${ctx.missingDocuments?.length ? `- חסרים: ${ctx.missingDocuments.join(', ')}` : ''}

נסח הודעת סיכום קצרה.
כפתורים (חובה 3):
1. id: "add_bank", text: קצר - יש עוד דוח בנק
2. id: "add_credit", text: קצר - יש דוח אשראי  
3. id: "start_classify", text: קצר - נתחיל לסווג`;

    case 'show_transaction':
      const tx = ctx.currentTransaction!;
      const emoji = tx.type === 'income' ? '💚' : '💸';
      return `הצג תנועה לסיווג:
${emoji} ${tx.amount.toLocaleString('he-IL')} ₪ | ${tx.vendor} | ${tx.date}
${tx.suggestedCategory ? `הצעה: ${tx.suggestedCategory}` : ''}
נשארו: ${ctx.remainingCount}

נסח שאלה קצרה.
כפתורים (חובה 3): 
- 2-3 קטגוריות מתאימות (id: cat_CATEGORY)
- כפתור דילוג (id: skip)`;

    case 'transaction_classified':
      return `התנועה סווגה בהצלחה.
נשארו עוד ${ctx.remainingCount} תנועות.
נסח אישור קצר (מילה-שתיים).
כפתורים: לא צריך (התנועה הבאה תוצג אוטומטית).`;

    case 'transaction_skipped':
      return `המשתמש דילג על תנועה.
נשארו עוד ${ctx.remainingCount} תנועות.
נסח אישור קצר.
כפתורים: לא צריך.`;

    case 'classification_complete':
      return `סיימנו לסווג את כל התנועות!
סיכום:
- הכנסות: ${ctx.totalIncome?.toLocaleString('he-IL')} ₪
- הוצאות: ${ctx.totalExpenses?.toLocaleString('he-IL')} ₪
- יתרה: ${((ctx.totalIncome || 0) - (ctx.totalExpenses || 0)).toLocaleString('he-IL')} ₪

נסח הודעת סיום מעודדת.
כפתורים:
1. id: "add_doc", text: להוסיף מסמך
2. id: "summary", text: לראות סיכום
3. id: "ask_question", text: לשאול שאלה`;

    case 'summary':
      const topCats = ctx.categoryTotals 
        ? Object.entries(ctx.categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([cat, amt]) => `${cat}: ${amt.toLocaleString('he-IL')} ₪`)
            .join('\n')
        : '';
      return `הצג סיכום פיננסי:
- הכנסות: ${ctx.totalIncome?.toLocaleString('he-IL')} ₪
- הוצאות: ${ctx.totalExpenses?.toLocaleString('he-IL')} ₪
- יתרה: ${((ctx.totalIncome || 0) - (ctx.totalExpenses || 0)).toLocaleString('he-IL')} ₪
${topCats ? `\nקטגוריות גדולות:\n${topCats}` : ''}

נסח הודעת סיכום ברורה.
כפתורים: לא צריך.`;

    case 'error':
      return `משהו השתבש.
נסח הודעת שגיאה קצרה ומעודדת - "נסה שוב".
כפתורים: לא צריך.`;

    default:
      return `נסח הודעה כללית.`;
  }
}

// ============================================================================
// Fallback Messages - אם AI נכשל
// ============================================================================

function getFallback(type: MessageType, ctx: ComposeContext): ComposedMessage {
  return {
    message: getFallbackMessage(type, ctx),
    buttons: getFallbackButtons(type),
  };
}

function getFallbackMessage(type: MessageType, ctx: ComposeContext): string {
  switch (type) {
    case 'welcome':
      return `👋 היי! אני *φ (פאי)* - המאמן הפיננסי שלך.\n\nמה השם שלך?`;
    
    case 'name_received':
      return `שלום ${ctx.userName}! 👋\n\n📄 שלח לי דוח בנק (PDF) ונתחיל.`;
    
    case 'document_received':
      return `📊 *קיבלתי!*\n\n` +
        `${ctx.transactionCount} תנועות\n` +
        `💚 ${ctx.totalIncome?.toLocaleString('he-IL')} ₪ הכנסות\n` +
        `💸 ${ctx.totalExpenses?.toLocaleString('he-IL')} ₪ הוצאות`;
    
    case 'show_transaction':
      const tx = ctx.currentTransaction!;
      return `${tx.type === 'income' ? '💚' : '💸'} *${tx.amount.toLocaleString('he-IL')} ₪* | ${tx.vendor}\n` +
        `📅 ${tx.date}\n\n` +
        `מה הקטגוריה?`;
    
    case 'transaction_classified':
      return `✅ נשמר! (נשארו ${ctx.remainingCount})`;
    
    case 'classification_complete':
      return `🎉 *סיימנו!*\n\n` +
        `💚 ${ctx.totalIncome?.toLocaleString('he-IL')} ₪\n` +
        `💸 ${ctx.totalExpenses?.toLocaleString('he-IL')} ₪`;
    
    case 'error':
      return `😅 משהו השתבש. נסה שוב?`;
    
    default:
      return `איך אפשר לעזור?`;
  }
}

function getFallbackButtons(type: MessageType): Array<{id: string; text: string}> {
  switch (type) {
    case 'document_received':
      return [
        { id: 'add_bank', text: '📄 עוד דוח בנק' },
        { id: 'add_credit', text: '💳 דוח אשראי' },
        { id: 'start_classify', text: '▶️ נתחיל!' },
      ];
    
    case 'show_transaction':
      return [
        { id: 'cat_מזון_וסופר', text: '🍎 מזון' },
        { id: 'cat_בילויים', text: '🎬 בילויים' },
        { id: 'skip', text: '⏭️ דלג' },
      ];
    
    case 'classification_complete':
      return [
        { id: 'add_doc', text: '📄 הוסף מסמך' },
        { id: 'summary', text: '📊 סיכום' },
      ];
    
    default:
      return [];
  }
}

// ============================================================================
// Quick Compose - ניסוח מהיר בלי AI (לאישורים קצרים)
// ============================================================================

const QUICK_CONFIRMATIONS = [
  '✅',
  '👍',
  '✅ נשמר!',
  '✔️ מעולה!',
  '👌',
  '✅ קיבלתי!',
];

const QUICK_SKIPS = [
  '⏭️',
  '⏭️ דילגנו!',
  '👍 הבא!',
  '⏩',
];

export function quickConfirm(): string {
  return QUICK_CONFIRMATIONS[Math.floor(Math.random() * QUICK_CONFIRMATIONS.length)];
}

export function quickSkip(): string {
  return QUICK_SKIPS[Math.floor(Math.random() * QUICK_SKIPS.length)];
}

