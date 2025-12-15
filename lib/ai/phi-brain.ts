/**
 * φ Brain - המוח של הבוט
 * 
 * AI-First Architecture:
 * - System Prompt אחד מקיף
 * - Tools שה-AI יכול להפעיל
 * - Context עשיר
 * - החלטות חכמות
 */

import OpenAI from 'openai';
import { createServiceClient } from '@/lib/supabase/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// Types
// ============================================================================

export interface PhiContext {
  // משתמש
  userId: string;
  userName: string;
  phone: string;
  
  // שלב נוכחי
  currentPhase: 'onboarding' | 'document_upload' | 'classification' | 'behavior' | 'budget' | 'goals' | 'monitoring';
  
  // נתונים פיננסיים
  financial?: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    pendingTransactions: number;
    classifiedTransactions: number;
  };
  
  // תנועה נוכחית (אם בסיווג)
  currentTransaction?: {
    id: string;
    vendor: string;
    amount: number;
    date: string;
    type: 'income' | 'expense';
    suggestedCategory?: string;
    confidence?: number;
  };
  
  // תנועות ממתינות
  pendingTransactions?: Array<{
    id: string;
    vendor: string;
    amount: number;
    type: 'income' | 'expense';
  }>;
  
  // היסטוריית שיחה
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  
  // patterns שנלמדו
  learnedPatterns?: Map<string, string>;
  
  // מצב ספציפי
  classificationProgress?: {
    done: number;
    total: number;
    highConfidenceCount: number;
    lowConfidenceCount: number;
  };
  
  // מסמכים
  documentsReceived?: number;
  missingDocuments?: string[];
}

export interface PhiAction {
  type: 
    | 'send_message'      // שלח הודעה למשתמש
    | 'classify_transaction'  // סווג תנועה
    | 'bulk_approve'      // אשר תנועות בבת אחת
    | 'ask_classification' // שאל על סיווג
    | 'save_pattern'      // שמור pattern למידה
    | 'move_to_phase'     // עבור לשלב הבא
    | 'request_document'  // בקש מסמך
    | 'complete_session'; // סיום
  
  data?: Record<string, unknown>;
  message?: string;
}

export interface PhiResponse {
  message: string;
  actions: PhiAction[];
  shouldWaitForResponse: boolean;
  internalThoughts?: string; // לדיבאג
}

// ============================================================================
// System Prompt - הלב של הבוט
// ============================================================================

const PHI_SYSTEM_PROMPT = `אתה *φ (פאי)* - מאמן פיננסי אישי ישראלי.

## 🎯 מי אתה
- שמך: φ (פאי) - כמו היחס הזהב במתמטיקה
- תפקידך: לעזור לאנשים למצוא את ה*הרמוניה* בכסף שלהם
- אתה מאמן, לא יועץ - מלווה, לא מטיף
- אתה חבר שמבין בכסף, לא בנקאי בחליפה

## 🎨 סגנון התקשורת שלך

### WhatsApp Style
- קצר וטבעי - כמו הודעה לחבר
- בולד = כוכבית אחת: *טקסט* (לא **)
- אימוג'ים במידה - מקסימום 1-2 להודעה
- לא פורמלי - בלי "משתמש יקר" או "בהתאם לבקשתך"

### דוגמאות טובות ✅
- "300 ₪ ב*רמי לוי* - זה *סופר*?"
- "יופי 👍 עוד קצת ונסיים"
- "שמתי לב שיש הרבה קפה החודש... ☕"
- "מעולה! חצי דרך 🎯"

### דוגמאות רעות ❌
- "נא לאשר את הסיווג הבא"
- "האם תרצה להמשיך בתהליך הסיווג?"
- "התנועה מסווגת בהצלחה, משתמש יקר"

## 📋 השלבים במסע

### 1. Onboarding (הכרות)
- לשאול את השם
- להכיר קצת (גיל, מצב משפחתי - אופציונלי)
- להסביר איך זה עובד
- לבקש מסמכים

### 2. Document Upload (קבלת מסמכים)
- לקבל דוחות בנק/אשראי
- לנתח אותם
- להסביר מה זיהינו

### 3. Classification (סיווג תנועות)
- לסווג תנועות בצורה חכמה
- לקבץ תנועות דומות
- ללמוד מהמשתמש
- לשאול רק על מה שלא ברור

### 4. Behavior → Budget → Goals → Monitoring
- שלבים הבאים אחרי הסיווג

## 🧠 איך לחשוב

### בסיווג תנועות
1. **תנועות בטוחות (confidence > 90%)**: לא לשאול! להציג סיכום ולבקש אישור כללי
2. **תנועות עם הצעה (70-90%)**: להציע ולשאול "נכון?"
3. **תנועות לא ברורות (<70%)**: לשאול "מה זה?"

### קיבוץ חכם
- אם יש 5 תנועות ברמי לוי - לא לשאול 5 שאלות!
- להציג: "5x *רמי לוי* → סופר. נכון?"

### למידה
- כשמשתמש מאשר "רמי לוי = סופר" - לזכור!
- בפעם הבאה לסווג אוטומטית

## 🎯 כללי זהב

1. **קצר** - מקסימום 3-4 שורות להודעה רגילה
2. **ברור** - המשתמש תמיד יודע מה עליו לעשות
3. **חיובי** - גם בטעות, להישאר חיובי
4. **אנושי** - לא רובוט
5. **מתקדם** - לזכור מה אמרנו, לא לחזור על עצמנו

## 🔧 הפעולות שלך

אתה יכול לבצע את הפעולות הבאות (דרך function calling):

- \`send_message\`: שלח הודעה למשתמש
- \`classify_transaction\`: סווג תנועה לקטגוריה
- \`bulk_approve\`: אשר מספר תנועות בבת אחת
- \`save_pattern\`: שמור pattern (vendor → category)
- \`move_to_phase\`: עבור לשלב הבא
- \`request_document\`: בקש מסמך מהמשתמש

## ⚠️ חוקים קריטיים

1. **תמיד בעברית** - לא אנגלית
2. **בולד = * אחת** - לא **
3. **לא להמציא מידע** - אם לא יודע, לשאול
4. **לא לחזור על עצמך** - כל הודעה שונה
5. **לשמור על flow** - לא לקפוץ בין נושאים`;

// ============================================================================
// Tools Definition
// ============================================================================

const PHI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'send_message',
      description: 'שלח הודעה למשתמש ב-WhatsApp',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'תוכן ההודעה (בעברית, עם * לבולד)',
          },
          wait_for_response: {
            type: 'boolean',
            description: 'האם לחכות לתשובה מהמשתמש',
          },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'classify_transaction',
      description: 'סווג תנועה לקטגוריה',
      parameters: {
        type: 'object',
        properties: {
          transaction_id: {
            type: 'string',
            description: 'מזהה התנועה',
          },
          category: {
            type: 'string',
            description: 'שם הקטגוריה',
          },
          is_confirmed: {
            type: 'boolean',
            description: 'האם זה אישור של המשתמש או הצעה',
          },
        },
        required: ['transaction_id', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bulk_approve',
      description: 'אשר מספר תנועות בבת אחת',
      parameters: {
        type: 'object',
        properties: {
          transaction_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'רשימת מזהי תנועות לאישור',
          },
        },
        required: ['transaction_ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_pattern',
      description: 'שמור pattern למידה (vendor → category)',
      parameters: {
        type: 'object',
        properties: {
          vendor: {
            type: 'string',
            description: 'שם הספק/עסק',
          },
          category: {
            type: 'string',
            description: 'הקטגוריה שנלמדה',
          },
        },
        required: ['vendor', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_classification',
      description: 'שאל את המשתמש על סיווג תנועה',
      parameters: {
        type: 'object',
        properties: {
          transaction_id: {
            type: 'string',
            description: 'מזהה התנועה',
          },
          vendor: {
            type: 'string',
            description: 'שם הספק',
          },
          amount: {
            type: 'number',
            description: 'סכום',
          },
          suggested_category: {
            type: 'string',
            description: 'קטגוריה מוצעת (אם יש)',
          },
          question_style: {
            type: 'string',
            enum: ['confirm', 'ask', 'suggest'],
            description: 'סגנון השאלה',
          },
        },
        required: ['transaction_id', 'vendor', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_to_phase',
      description: 'עבור לשלב הבא במסע',
      parameters: {
        type: 'object',
        properties: {
          phase: {
            type: 'string',
            enum: ['onboarding', 'document_upload', 'classification', 'behavior', 'budget', 'goals', 'monitoring'],
            description: 'השלב החדש',
          },
        },
        required: ['phase'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_document',
      description: 'בקש מסמך מהמשתמש',
      parameters: {
        type: 'object',
        properties: {
          document_type: {
            type: 'string',
            enum: ['bank_statement', 'credit_card', 'payslip', 'loan'],
            description: 'סוג המסמך',
          },
          reason: {
            type: 'string',
            description: 'למה צריך את המסמך',
          },
        },
        required: ['document_type'],
      },
    },
  },
];

// ============================================================================
// Main Brain Function
// ============================================================================

/**
 * 🧠 המוח של φ - מקבל context ומחזיר החלטה
 */
export async function thinkAndRespond(
  userMessage: string,
  context: PhiContext
): Promise<PhiResponse> {
  console.log('[φ Brain] Thinking...', { 
    phase: context.currentPhase, 
    message: userMessage.substring(0, 50) 
  });

  // בניית ההודעות
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: PHI_SYSTEM_PROMPT },
    { role: 'system', content: buildContextMessage(context) },
    ...context.conversationHistory.slice(-10).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools: PHI_TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000,
    });

    const choice = response.choices[0];
    
    // פרסור התשובה
    return parsePhiResponse(choice, context);
  } catch (error) {
    console.error('[φ Brain] Error:', error);
    return {
      message: 'אופס, משהו קרה. בוא ננסה שוב?',
      actions: [],
      shouldWaitForResponse: true,
    };
  }
}

// ============================================================================
// Context Builder
// ============================================================================

function buildContextMessage(context: PhiContext): string {
  let contextMsg = `## 📊 מצב נוכחי

**משתמש:** ${context.userName || 'לא ידוע'}
**שלב:** ${getPhaseHebrew(context.currentPhase)}
`;

  if (context.financial) {
    contextMsg += `
**נתונים פיננסיים:**
- הכנסות: ${context.financial.totalIncome.toLocaleString('he-IL')} ₪
- הוצאות: ${context.financial.totalExpenses.toLocaleString('he-IL')} ₪
- יתרה: ${context.financial.balance.toLocaleString('he-IL')} ₪
- ממתינות לסיווג: ${context.financial.pendingTransactions}
- מסווגות: ${context.financial.classifiedTransactions}
`;
  }

  if (context.currentTransaction) {
    const tx = context.currentTransaction;
    contextMsg += `
**תנועה נוכחית:**
- ID: ${tx.id}
- ספק: ${tx.vendor}
- סכום: ${tx.amount.toLocaleString('he-IL')} ₪
- סוג: ${tx.type === 'income' ? 'הכנסה' : 'הוצאה'}
- תאריך: ${tx.date}
${tx.suggestedCategory ? `- הצעה: ${tx.suggestedCategory} (${Math.round((tx.confidence || 0) * 100)}%)` : ''}
`;
  }

  if (context.classificationProgress) {
    const prog = context.classificationProgress;
    const percent = Math.round((prog.done / prog.total) * 100);
    contextMsg += `
**התקדמות סיווג:**
- סווגו: ${prog.done}/${prog.total} (${percent}%)
- בטוחות: ${prog.highConfidenceCount}
- צריכות שאלה: ${prog.lowConfidenceCount}
`;
  }

  if (context.pendingTransactions && context.pendingTransactions.length > 0) {
    contextMsg += `
**תנועות ממתינות (עד 10):**
`;
    for (const tx of context.pendingTransactions.slice(0, 10)) {
      contextMsg += `- ${tx.amount.toLocaleString('he-IL')} ₪ ${tx.type === 'income' ? 'מ' : 'ב'}${tx.vendor}\n`;
    }
    
    if (context.pendingTransactions.length > 10) {
      contextMsg += `... ועוד ${context.pendingTransactions.length - 10}\n`;
    }
  }

  if (context.missingDocuments && context.missingDocuments.length > 0) {
    contextMsg += `
**מסמכים חסרים:** ${context.missingDocuments.join(', ')}
`;
  }

  return contextMsg;
}

function getPhaseHebrew(phase: string): string {
  const phases: Record<string, string> = {
    onboarding: 'הכרות',
    document_upload: 'העלאת מסמכים',
    classification: 'סיווג תנועות',
    behavior: 'ניתוח התנהגות',
    budget: 'בניית תקציב',
    goals: 'הגדרת יעדים',
    monitoring: 'מעקב שוטף',
  };
  return phases[phase] || phase;
}

// ============================================================================
// Response Parser
// ============================================================================

function parsePhiResponse(
  choice: OpenAI.Chat.Completions.ChatCompletion.Choice,
  context: PhiContext
): PhiResponse {
  const actions: PhiAction[] = [];
  let message = '';
  let shouldWaitForResponse = true;

  // אם יש tool calls
  if (choice.message.tool_calls) {
    for (const toolCall of choice.message.tool_calls) {
      // Type guard for function tool calls
      if (toolCall.type !== 'function') continue;
      
      const funcCall = toolCall as { type: 'function'; function: { name: string; arguments: string } };
      const args = JSON.parse(funcCall.function.arguments);
      
      switch (funcCall.function.name) {
        case 'send_message':
          message = args.message;
          shouldWaitForResponse = args.wait_for_response !== false;
          actions.push({
            type: 'send_message',
            message: args.message,
            data: { wait: args.wait_for_response },
          });
          break;
          
        case 'classify_transaction':
          actions.push({
            type: 'classify_transaction',
            data: {
              transactionId: args.transaction_id,
              category: args.category,
              isConfirmed: args.is_confirmed,
            },
          });
          break;
          
        case 'bulk_approve':
          actions.push({
            type: 'bulk_approve',
            data: { transactionIds: args.transaction_ids },
          });
          break;
          
        case 'save_pattern':
          actions.push({
            type: 'save_pattern',
            data: {
              vendor: args.vendor,
              category: args.category,
            },
          });
          break;
          
        case 'ask_classification':
          actions.push({
            type: 'ask_classification',
            data: {
              transactionId: args.transaction_id,
              vendor: args.vendor,
              amount: args.amount,
              suggestedCategory: args.suggested_category,
              questionStyle: args.question_style,
            },
          });
          break;
          
        case 'move_to_phase':
          actions.push({
            type: 'move_to_phase',
            data: { phase: args.phase },
          });
          break;
          
        case 'request_document':
          actions.push({
            type: 'request_document',
            data: {
              documentType: args.document_type,
              reason: args.reason,
            },
          });
          break;
      }
    }
  }

  // אם יש גם תוכן טקסט
  if (choice.message.content) {
    message = choice.message.content;
  }

  // תיקון פורמט WhatsApp
  message = message.replace(/\*\*/g, '*');

  return {
    message,
    actions,
    shouldWaitForResponse,
    internalThoughts: choice.message.content || undefined,
  };
}

// ============================================================================
// Action Executors
// ============================================================================

/**
 * מבצע את הפעולות שה-AI החליט עליהן
 */
export async function executeActions(
  actions: PhiAction[],
  context: PhiContext
): Promise<void> {
  const supabase = createServiceClient();

  for (const action of actions) {
    console.log('[φ Brain] Executing action:', action.type);

    switch (action.type) {
      case 'classify_transaction':
        if (action.data) {
          await supabase
            .from('transactions')
            .update({
              status: action.data.isConfirmed ? 'confirmed' : 'proposed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', action.data.transactionId)
            .eq('user_id', context.userId);
        }
        break;

      case 'bulk_approve':
        if (action.data?.transactionIds) {
          const ids = action.data.transactionIds as string[];
          await supabase
            .from('transactions')
            .update({
              status: 'confirmed',
              updated_at: new Date().toISOString(),
            })
            .in('id', ids)
            .eq('user_id', context.userId);
        }
        break;

      case 'save_pattern':
        if (action.data) {
          const vendorKey = (action.data.vendor as string).toLowerCase().trim();
          await supabase
            .from('user_patterns')
            .upsert({
              user_id: context.userId,
              pattern_type: 'vendor_category',
              pattern_key: vendorKey,
              pattern_value: { category: action.data.category },
              confidence_score: 0.8,
              learned_from_count: 1,
              last_seen: new Date().toISOString(),
            }, {
              onConflict: 'user_id,pattern_type,pattern_key',
            });
        }
        break;

      case 'move_to_phase':
        if (action.data?.phase) {
          await supabase
            .from('users')
            .update({
              current_phase: action.data.phase,
              phase_updated_at: new Date().toISOString(),
            })
            .eq('id', context.userId);
        }
        break;
    }
  }
}

// ============================================================================
// Context Loader
// ============================================================================

/**
 * טוען את כל ה-context הנדרש ל-AI
 */
export async function loadPhiContext(userId: string): Promise<PhiContext> {
  const supabase = createServiceClient();

  // טען פרטי משתמש
  const { data: user } = await supabase
    .from('users')
    .select('id, phone, full_name, current_phase')
    .eq('id', userId)
    .single();

  // טען היסטוריית שיחה
  const { data: messages } = await supabase
    .from('wa_messages')
    .select('direction, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  const conversationHistory = (messages || [])
    .reverse()
    .map(msg => ({
      role: (msg.direction === 'outgoing' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: msg.content,
    }));

  // טען תנועות pending
  const { data: pendingTx } = await supabase
    .from('transactions')
    .select('id, vendor, amount, type, tx_date, status')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('tx_date', { ascending: false })
    .limit(50);

  // טען סטטיסטיקות
  const { data: stats } = await supabase
    .from('transactions')
    .select('amount, type, status')
    .eq('user_id', userId);

  let financial;
  if (stats && stats.length > 0) {
    const totalIncome = stats
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = stats
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const pendingCount = stats.filter(t => t.status === 'pending').length;
    const confirmedCount = stats.filter(t => t.status === 'confirmed').length;

    financial = {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      pendingTransactions: pendingCount,
      classifiedTransactions: confirmedCount,
    };
  }

  return {
    userId,
    userName: user?.full_name || '',
    phone: user?.phone || '',
    currentPhase: (user?.current_phase || 'onboarding') as PhiContext['currentPhase'],
    financial,
    conversationHistory,
    pendingTransactions: (pendingTx || []).map(tx => ({
      id: tx.id,
      vendor: tx.vendor || '',
      amount: tx.amount,
      type: tx.type as 'income' | 'expense',
    })),
  };
}

export default {
  thinkAndRespond,
  executeActions,
  loadPhiContext,
};

