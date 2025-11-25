/**
 * Data Collection Flow - איסוף מסמכים פיננסיים
 * 
 * שלב 1: בקשת דוח בנק
 * שלב 2: עיבוד + שאלות חכמות על תנועות
 * שלב 3: בקשת דוח אשראי (אם רלוונטי)
 * שלב 4: בקשת תלוש משכורת
 * שלב 5: סיום + מעבר ל-behavior
 * 
 * עיקרון מפתח:
 * - לא שואלים "כמה אתה מוציא על X"
 * - מבקשים דוחות → AI מנתח → שואלים על תנועות ספציפיות
 */

import { createClient } from '@/lib/supabase/server';

export interface DataCollectionContext {
  userId: string;
  currentStep: 'bank_statement' | 'classification' | 'credit_statement' | 'payslip' | 'summary' | 'complete';
  documentsUploaded: {
    bank_statement?: boolean;
    credit_statement?: boolean;
    payslip?: boolean;
  };
  pendingQuestions: number;
  creditPaymentFound?: {
    amount: number;
    date: string;
  };
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleDataCollectionFlow(
  context: DataCollectionContext,
  message: string
): Promise<{ response: string; nextStep: string; completed: boolean; requestDocument?: string }> {
  switch (context.currentStep) {
    case 'bank_statement':
      return await handleBankStatementStep(context, message);
    case 'classification':
      return await handleClassificationStep(context, message);
    case 'credit_statement':
      return await handleCreditStatementStep(context, message);
    case 'payslip':
      return await handlePayslipStep(context, message);
    case 'summary':
      return await handleSummaryStep(context, message);
    default:
      return {
        response: getWelcomeMessage(),
        nextStep: 'bank_statement',
        completed: false,
        requestDocument: 'bank_statement',
      };
  }
}

// ============================================================================
// שלב 1: דוח בנק
// ============================================================================

async function handleBankStatementStep(
  context: DataCollectionContext,
  message: string
): Promise<{ response: string; nextStep: string; completed: boolean; requestDocument?: string }> {
  const lowerMessage = message.toLowerCase();
  
  // אם המשתמש שואל איך להוריד
  if (lowerMessage.includes('איך') || lowerMessage.includes('מאיפה')) {
    return {
      response: getBankStatementHelpMessage(),
      nextStep: 'bank_statement',
      completed: false,
      requestDocument: 'bank_statement',
    };
  }
  
  // אם המשתמש רוצה לדחות
  if (lowerMessage.includes('אחר כך') || lowerMessage.includes('לא עכשיו')) {
    return {
      response: `בסדר! 😊\nכשתהיה מוכן - פשוט שלח את הדוח.\nאני אזכיר לך מחר.`,
      nextStep: 'bank_statement',
      completed: false,
    };
  }
  
  // ברירת מחדל - מחכה לקובץ
  return {
    response: `אני מחכה לדוח הבנק 📄\n\nאפשר לשלוח PDF, תמונה, או צילום מסך.`,
    nextStep: 'bank_statement',
    completed: false,
    requestDocument: 'bank_statement',
  };
}

// ============================================================================
// שלב 2: סיווג תנועות
// ============================================================================

async function handleClassificationStep(
  context: DataCollectionContext,
  message: string
): Promise<{ response: string; nextStep: string; completed: boolean }> {
  // הלוגיקה של סיווג תנועות נמצאת ב-transaction-classification-flow.ts
  // כאן רק מנהלים את המעבר בין השלבים
  
  if (context.pendingQuestions === 0) {
    // סיימנו לסווג - בדוק אם צריך דוח אשראי
    if (context.creditPaymentFound && !context.documentsUploaded.credit_statement) {
      return {
        response: getCreditStatementRequestMessage(
          context.creditPaymentFound.amount,
          context.creditPaymentFound.date
        ),
        nextStep: 'credit_statement',
        completed: false,
      };
    }
    
    // בדוק אם צריך תלוש משכורת
    if (!context.documentsUploaded.payslip) {
      return {
        response: getPayslipRequestMessage(),
        nextStep: 'payslip',
        completed: false,
      };
    }
    
    // אחרת - עבור לסיכום
    return {
      response: await getSummaryMessage(context.userId),
      nextStep: 'summary',
      completed: false,
    };
  }
  
  // עדיין יש שאלות - ממשיכים לסווג
  return {
    response: `נמשיך? יש לי עוד ${context.pendingQuestions} שאלות.`,
    nextStep: 'classification',
    completed: false,
  };
}

// ============================================================================
// שלב 3: דוח אשראי
// ============================================================================

async function handleCreditStatementStep(
  context: DataCollectionContext,
  message: string
): Promise<{ response: string; nextStep: string; completed: boolean; requestDocument?: string }> {
  const lowerMessage = message.toLowerCase();
  
  // אם המשתמש לא רוצה
  if (lowerMessage.includes('אין לי') || lowerMessage.includes('לא') || lowerMessage.includes('דלג')) {
    return {
      response: `בסדר, נדלג על זה עכשיו.\nתוכל לשלוח אחר כך אם תרצה 😊`,
      nextStep: context.documentsUploaded.payslip ? 'summary' : 'payslip',
      completed: false,
    };
  }
  
  // אם המשתמש צריך עזרה
  if (lowerMessage.includes('איך') || lowerMessage.includes('מאיפה')) {
    return {
      response: getCreditStatementHelpMessage(),
      nextStep: 'credit_statement',
      completed: false,
      requestDocument: 'credit_statement',
    };
  }
  
  // מחכה לקובץ
  return {
    response: `אני מחכה לפירוט האשראי 📄`,
    nextStep: 'credit_statement',
    completed: false,
    requestDocument: 'credit_statement',
  };
}

// ============================================================================
// שלב 4: תלוש משכורת
// ============================================================================

async function handlePayslipStep(
  context: DataCollectionContext,
  message: string
): Promise<{ response: string; nextStep: string; completed: boolean; requestDocument?: string }> {
  const lowerMessage = message.toLowerCase();
  
  // אם המשתמש לא רוצה או עצמאי
  if (lowerMessage.includes('אין לי') || lowerMessage.includes('עצמאי') || lowerMessage.includes('דלג')) {
    return {
      response: await getSummaryMessage(context.userId),
      nextStep: 'summary',
      completed: false,
    };
  }
  
  // מחכה לקובץ
  return {
    response: `אני מחכה לתלוש משכורת 📄\n\n(אם אתה עצמאי - כתוב "עצמאי" ואדלג)`,
    nextStep: 'payslip',
    completed: false,
    requestDocument: 'payslip',
  };
}

// ============================================================================
// שלב 5: סיכום ומעבר לשלב הבא
// ============================================================================

async function handleSummaryStep(
  context: DataCollectionContext,
  message: string
): Promise<{ response: string; nextStep: string; completed: boolean }> {
  const lowerMessage = message.toLowerCase();
  
  // אם המשתמש רוצה להמשיך
  if (isPositiveAnswer(message)) {
    // עדכן phase
    await updateUserPhase(context.userId, 'behavior');
    
    return {
      response: `מעולה! 🎉\n\nעכשיו אני אעקוב אחרי ההרגלים שלך ואשלח לך תובנות.\n\n💡 בינתיים, תוכל:\n• לרשום הוצאות ("קפה 28 שקל")\n• לשאול שאלות ("כמה הוצאתי החודש?")\n• לשלוח עוד דוחות\n\nאני כאן! 😊`,
      nextStep: 'complete',
      completed: true,
    };
  }
  
  // אם המשתמש רוצה לראות עוד מידע
  if (lowerMessage.includes('פירוט') || lowerMessage.includes('עוד')) {
    return {
      response: await getDetailedSummary(context.userId),
      nextStep: 'summary',
      completed: false,
    };
  }
  
  // ברירת מחדל
  return {
    response: `רוצה שאתחיל לעקוב אחרי ההוצאות שלך ולשלוח תובנות? 📊`,
    nextStep: 'summary',
    completed: false,
  };
}

// ============================================================================
// הודעות מוכנות
// ============================================================================

function getWelcomeMessage(): string {
  return `כדי להבין את המצב הפיננסי שלך, אני צריך לראות את הדוחות.\n\n📄 בוא נתחיל - תשלח לי דוח בנק של 3 החודשים האחרונים\n(PDF או תמונה - מה שנוח לך)`;
}

function getBankStatementHelpMessage(): string {
  return `📱 איך להוריד דוח בנק:\n\n1. היכנס לאפליקציית הבנק\n2. חפש "דוחות" או "תנועות"\n3. בחר 3 חודשים אחרונים\n4. הורד כ-PDF\n5. שלח לי פה 📎\n\nאם צריך עזרה - ספר לי איזה בנק!`;
}

function getCreditStatementRequestMessage(amount: number, date: string): string {
  return `מצאתי חיוב אשראי של ${formatCurrency(amount)} ב-${date}.\n\nכדי לפרט את ההוצאות האלה, אני צריך את דוח האשראי.\n\n📄 יש לך את הפירוט?`;
}

function getCreditStatementHelpMessage(): string {
  return `📱 איך להוריד פירוט אשראי:\n\n1. היכנס לאפליקציה של חברת האשראי (ישראכרט/מקס/לאומי קארד)\n2. חפש "פירוט עסקאות"\n3. בחר את החודש הרלוונטי\n4. הורד כ-PDF\n5. שלח לי פה 📎`;
}

function getPayslipRequestMessage(): string {
  return `עוד דבר אחד! 📄\n\nיש לך תלוש משכורת אחרון?\nזה יעזור לי להבין את ההכנסות שלך טוב יותר.\n\n(אם אתה עצמאי - כתוב "עצמאי")`;
}

async function getSummaryMessage(userId: string): Promise<string> {
  const stats = await getFinancialStats(userId);
  
  return `🎉 סיימנו לאסוף את הנתונים!\n\n📊 סיכום מהיר:\n\n💰 הכנסות החודש: ${formatCurrency(stats.totalIncome)}\n💸 הוצאות החודש: ${formatCurrency(stats.totalExpenses)}\n📈 יתרה: ${formatCurrency(stats.balance)}\n\n🔝 הוצאות גדולות:\n${stats.topCategories.map(c => `• ${c.name}: ${formatCurrency(c.amount)}`).join('\n')}\n\nרוצה שאתחיל לעקוב ולשלוח לך תובנות? 📊`;
}

async function getDetailedSummary(userId: string): Promise<string> {
  const stats = await getDetailedFinancialStats(userId);
  
  let message = `📊 פירוט מלא:\n\n`;
  
  message += `💰 **הכנסות:**\n`;
  for (const income of stats.incomeBySource) {
    message += `• ${income.source}: ${formatCurrency(income.amount)}\n`;
  }
  
  message += `\n💸 **הוצאות לפי קטגוריה:**\n`;
  for (const expense of stats.expensesByCategory) {
    message += `• ${expense.category}: ${formatCurrency(expense.amount)}\n`;
  }
  
  message += `\n🔄 **הוצאות קבועות שזיהיתי:**\n`;
  for (const recurring of stats.recurringExpenses) {
    message += `• ${recurring.name}: ${formatCurrency(recurring.amount)}/חודש\n`;
  }
  
  message += `\nרוצה שאתחיל לעקוב? 📊`;
  
  return message;
}

// ============================================================================
// Callback functions - נקראות מה-document handler
// ============================================================================

/**
 * נקרא אחרי שדוח נקלט בהצלחה
 */
export function onDocumentReceived(documentType: string): string {
  return `קיבלתי! ⏳ אני מנתח את הדוח...\n\nזה יכול לקחת כמה שניות.`;
}

/**
 * נקרא אחרי עיבוד מוצלח של דוח בנק
 */
export function onBankStatementProcessed(transactionCount: number, questionsCount: number): string {
  if (transactionCount === 0) {
    return `לא מצאתי תנועות בדוח 🤔\n\nאפשר לשלוח דוח אחר?`;
  }
  
  if (questionsCount === 0) {
    return `מצאתי ${transactionCount} תנועות! 📊\n\nסיווגתי את כולן אוטומטית ✓`;
  }
  
  return `מצאתי ${transactionCount} תנועות! 📊\n\nרוב התנועות זיהיתי אוטומטית.\nיש לי ${questionsCount} שאלות על תנועות שאני לא בטוח לגביהן.\n\nבא לך לעבור עליהן עכשיו?`;
}

/**
 * נקרא אחרי עיבוד מוצלח של דוח אשראי
 */
export function onCreditStatementProcessed(transactionCount: number, linkedCount: number): string {
  return `מצאתי ${transactionCount} עסקאות באשראי! 📊\n\nקישרתי ${linkedCount} תנועות לחיוב בבנק ✓`;
}

/**
 * נקרא אחרי עיבוד מוצלח של תלוש משכורת
 */
export function onPayslipProcessed(salary: number): string {
  return `זיהיתי משכורת של ${formatCurrency(salary)} ✓\n\nעדכנתי את פרופיל ההכנסות שלך.`;
}

/**
 * נקרא כשמזוהה חיוב אשראי בדוח בנק
 */
export function onCreditPaymentDetected(amount: number, date: string): { amount: number; date: string } {
  return { amount, date };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL')}`;
}

function isPositiveAnswer(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('כן') || lower.includes('yes') || lower.includes('בטח') || lower.includes('אוקי');
}

// ============================================================================
// Database Operations
// ============================================================================

async function updateUserPhase(userId: string, phase: string): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from('users')
    .update({
      phase,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

interface FinancialStats {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  topCategories: Array<{ name: string; amount: number }>;
}

async function getFinancialStats(userId: string): Promise<FinancialStats> {
  const supabase = await createClient();
  
  // Get current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  // Get income
  const { data: incomeData } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'income')
    .gte('tx_date', startOfMonth)
    .lte('tx_date', endOfMonth);
  
  const totalIncome = incomeData?.reduce((sum, t) => sum + t.amount, 0) || 0;
  
  // Get expenses
  const { data: expenseData } = await supabase
    .from('transactions')
    .select('amount, expense_category')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('tx_date', startOfMonth)
    .lte('tx_date', endOfMonth);
  
  const totalExpenses = expenseData?.reduce((sum, t) => sum + t.amount, 0) || 0;
  
  // Group by category
  const categoryTotals: Record<string, number> = {};
  expenseData?.forEach(t => {
    const cat = t.expense_category || 'אחר';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
  });
  
  const topCategories = Object.entries(categoryTotals)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  
  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    topCategories,
  };
}

interface DetailedFinancialStats {
  incomeBySource: Array<{ source: string; amount: number }>;
  expensesByCategory: Array<{ category: string; amount: number }>;
  recurringExpenses: Array<{ name: string; amount: number }>;
}

async function getDetailedFinancialStats(userId: string): Promise<DetailedFinancialStats> {
  const supabase = await createClient();
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  // Income by source
  const { data: incomeData } = await supabase
    .from('transactions')
    .select('amount, vendor')
    .eq('user_id', userId)
    .eq('type', 'income')
    .gte('tx_date', startOfMonth)
    .lte('tx_date', endOfMonth);
  
  const incomeBySource: Record<string, number> = {};
  incomeData?.forEach(t => {
    const source = t.vendor || 'אחר';
    incomeBySource[source] = (incomeBySource[source] || 0) + t.amount;
  });
  
  // Expenses by category
  const { data: expenseData } = await supabase
    .from('transactions')
    .select('amount, expense_category')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('tx_date', startOfMonth)
    .lte('tx_date', endOfMonth);
  
  const expensesByCategory: Record<string, number> = {};
  expenseData?.forEach(t => {
    const cat = t.expense_category || 'אחר';
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + t.amount;
  });
  
  // Recurring expenses (from recurring_patterns or subscriptions)
  const { data: recurringData } = await supabase
    .from('transactions')
    .select('vendor, amount')
    .eq('user_id', userId)
    .eq('expense_frequency', 'recurring')
    .eq('type', 'expense');
  
  const recurringExpenses = recurringData?.map(t => ({
    name: t.vendor || 'לא ידוע',
    amount: t.amount,
  })) || [];
  
  return {
    incomeBySource: Object.entries(incomeBySource).map(([source, amount]) => ({ source, amount })),
    expensesByCategory: Object.entries(expensesByCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    recurringExpenses,
  };
}

export default {
  handleDataCollectionFlow,
  onDocumentReceived,
  onBankStatementProcessed,
  onCreditStatementProcessed,
  onPayslipProcessed,
  onCreditPaymentDetected,
};

