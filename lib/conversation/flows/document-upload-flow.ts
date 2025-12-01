/**
 * Document Upload Flow - ניהול שיחה טבעית לאחר העלאת מסמך
 * 
 * Flow טבעי:
 * 1. משתמש שולח מסמך
 * 2. בוט מנתח ומוצא תנועות
 * 3. בוט בודק: כמה חודשים יש? מה חסר?
 * 4. בוט שולח הודעה ברורה עם הצעד הבא
 * 5. משתמש יכול: לשלוח עוד מסמך / לכתוב "נמשיך" / לשאול שאלה
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getUserPeriodCoverage, PeriodCoverage } from '@/lib/documents/period-tracker';

// ============================================================================
// Types
// ============================================================================

export interface DocumentAnalysisResult {
  totalTransactions: number;
  incomeCount: number;
  expenseCount: number;
  totalIncome: number;
  totalExpenses: number;
  periodStart: string | null;
  periodEnd: string | null;
  missingDocuments: MissingDocument[];
  documentType: string;
}

export interface MissingDocument {
  type: 'credit' | 'payslip' | 'mortgage' | 'loan' | 'insurance' | 'pension';
  description: string;
  priority: 'high' | 'medium' | 'low';
  details?: {
    card_last_4?: string;
    employer?: string;
    provider?: string;
    amount?: number;
  };
}

export interface UploadFlowState {
  userId: string;
  hasMinimumCoverage: boolean;
  totalMonths: number;
  missingMonths: string[];
  pendingClassification: number;
  missingDocuments: MissingDocument[];
}

// ============================================================================
// Hebrew Month Names
// ============================================================================

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

function formatMonthHebrew(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const monthIndex = parseInt(month) - 1;
  return `${HEBREW_MONTHS[monthIndex]} ${year}`;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return 'תקופה לא ידועה';
  
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  const startMonth = HEBREW_MONTHS[startDate.getMonth()];
  const endMonth = HEBREW_MONTHS[endDate.getMonth()];
  
  if (startDate.getFullYear() === endDate.getFullYear()) {
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startMonth} ${startDate.getFullYear()}`;
    }
    return `${startMonth} - ${endMonth} ${startDate.getFullYear()}`;
  }
  
  return `${startMonth} ${startDate.getFullYear()} - ${endMonth} ${endDate.getFullYear()}`;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * יצירת הודעה טבעית אחרי ניתוח מסמך
 */
export function buildDocumentAnalysisMessage(
  analysis: DocumentAnalysisResult,
  coverage: PeriodCoverage,
  isFirstDocument: boolean
): string {
  const parts: string[] = [];
  
  // === חלק 1: מה מצאתי ===
  const dateRange = formatDateRange(analysis.periodStart, analysis.periodEnd);
  const docTypeName = getDocumentTypeName(analysis.documentType);
  
  if (isFirstDocument) {
    parts.push(`📊 *קיבלתי ${docTypeName}!*`);
  } else {
    parts.push(`📊 *עוד ${docTypeName} התקבל!*`);
  }
  
  parts.push(``);
  
  // הצג את התקופה שזוהתה בצורה ברורה
  if (analysis.periodStart && analysis.periodEnd) {
    parts.push(`📅 *תקופה שזיהיתי:* ${dateRange}`);
  } else {
    parts.push(`📅 תקופה: לא הצלחתי לזהות - אשתמש בתאריכי התנועות`);
  }
  
  parts.push(`📝 ${analysis.totalTransactions} תנועות`);
  
  if (analysis.incomeCount > 0) {
    parts.push(`   💚 ${analysis.incomeCount} הכנסות (${analysis.totalIncome.toLocaleString('he-IL')} ₪)`);
  }
  if (analysis.expenseCount > 0) {
    parts.push(`   💸 ${analysis.expenseCount} הוצאות (${analysis.totalExpenses.toLocaleString('he-IL')} ₪)`);
  }
  
  parts.push(``);
  
  // === חלק 2: סטטוס כיסוי ===
  if (coverage.hasMinimumCoverage) {
    parts.push(`✅ יש לי ${coverage.totalMonths} חודשים של נתונים - מעולה!`);
  } else {
    parts.push(`⏳ יש לי ${coverage.totalMonths} ${coverage.totalMonths === 1 ? 'חודש' : 'חודשים'} מתוך 3 שצריך.`);
    
    if (coverage.missingMonths.length > 0 && coverage.missingMonths.length <= 3) {
      const missingText = coverage.missingMonths.map(formatMonthHebrew).join(', ');
      parts.push(`   חסר: ${missingText}`);
    }
  }
  
  // === חלק 3: מסמכים משלימים (אם יש) ===
  if (analysis.missingDocuments.length > 0) {
    parts.push(``);
    parts.push(`📋 *זיהיתי דברים שיעזרו לי להבין את התמונה:*`);
    
    const highPriority = analysis.missingDocuments.filter(d => d.priority === 'high');
    const mediumPriority = analysis.missingDocuments.filter(d => d.priority === 'medium');
    
    // הצג רק high priority אם יש הרבה
    const docsToShow = highPriority.length > 0 ? highPriority.slice(0, 3) : mediumPriority.slice(0, 2);
    
    for (const doc of docsToShow) {
      const icon = getDocumentIcon(doc.type);
      let line = `${icon} ${getDocumentName(doc.type)}`;
      
      if (doc.details?.card_last_4) {
        line += ` (****${doc.details.card_last_4})`;
      }
      if (doc.details?.employer) {
        line += ` - ${doc.details.employer}`;
      }
      
      parts.push(line);
    }
    
    if (analysis.missingDocuments.length > docsToShow.length) {
      parts.push(`   ועוד ${analysis.missingDocuments.length - docsToShow.length}...`);
    }
  }
  
  // === חלק 4: מה עכשיו? ===
  parts.push(``);
  parts.push(`---`);
  parts.push(``);
  
  if (!coverage.hasMinimumCoverage) {
    // עדיין צריך עוד חודשים
    parts.push(`💡 *מה עכשיו?*`);
    parts.push(`שלח לי עוד דוח שמכסה חודשים נוספים,`);
    parts.push(`או כתוב *"נמשיך"* אם אין לך כרגע.`);
  } else if (analysis.missingDocuments.length > 0) {
    // יש 3 חודשים, אבל יש מסמכים שיעזרו
    parts.push(`💡 *מה עכשיו?*`);
    parts.push(`אפשר לשלוח מסמכים נוספים לתמונה מדויקת יותר,`);
    parts.push(`או כתוב *"נמשיך"* ונתחיל לסווג את התנועות.`);
  } else {
    // הכל מוכן!
    parts.push(`🎯 *מוכנים להתחיל!*`);
    parts.push(`כתוב *"יאללה"* ונתחיל לסווג את התנועות.`);
  }
  
  return parts.join('\n');
}

/**
 * טיפול בהודעת "נמשיך" / "יאללה"
 */
export async function handleContinueRequest(
  userId: string
): Promise<{ shouldStartClassification: boolean; message: string }> {
  const supabase = createServiceClient();
  
  // בדוק כיסוי
  const coverage = await getUserPeriodCoverage(userId);
  
  // בדוק כמה תנועות pending יש
  const { count: pendingCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending');
  
  if (!pendingCount || pendingCount === 0) {
    return {
      shouldStartClassification: false,
      message: `אין לי תנועות לסיווג 🤔\n\nשלח לי דוח בנק או דוח אשראי ונתחיל!`,
    };
  }
  
  if (!coverage.hasMinimumCoverage) {
    // אין 3 חודשים - אזהרה אבל ממשיכים
    const monthsText = coverage.totalMonths === 1 ? 'חודש אחד' : `${coverage.totalMonths} חודשים`;
    
    return {
      shouldStartClassification: true,
      message: `⚠️ שים לב: יש לי רק ${monthsText} של נתונים.\nהתמונה תהיה חלקית, אבל בוא נתחיל!\n\n📊 יש ${pendingCount} תנועות לסיווג.\nנתחיל?`,
    };
  }
  
  // הכל מוכן
  return {
    shouldStartClassification: true,
    message: `מעולה! 🎯\n\nיש לי ${coverage.totalMonths} חודשים של נתונים ו-${pendingCount} תנועות לסיווג.\n\nבוא נתחיל - אני אשאל שאלה אחת בכל פעם 😊`,
  };
}

/**
 * בדיקה אם ההודעה היא בקשה להמשיך
 */
export function isContinueRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  const continueWords = [
    'נמשיך',
    'יאללה',
    'להמשיך',
    'בוא נמשיך',
    'המשך',
    'נתחיל',
    'בוא נתחיל',
    'התחל',
    'start',
    'continue',
    'go',
    'כן',
    'בטח',
    'אין לי עכשיו',
    'אין לי כרגע',
    'זה מה שיש',
    'זהו',
  ];
  
  return continueWords.some(word => lowerMessage.includes(word));
}

/**
 * קבלת סטטוס נוכחי למשתמש
 */
export async function getUploadFlowState(userId: string): Promise<UploadFlowState> {
  const supabase = createServiceClient();
  
  // כיסוי תקופות
  const coverage = await getUserPeriodCoverage(userId);
  
  // תנועות pending
  const { count: pendingCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending');
  
  // מסמכים חסרים
  const { data: missingDocs } = await supabase
    .from('missing_documents')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .limit(10);
  
  const missingDocuments: MissingDocument[] = (missingDocs || []).map(doc => ({
    type: doc.document_type,
    description: doc.description || '',
    priority: doc.priority >= 8 ? 'high' : doc.priority >= 5 ? 'medium' : 'low',
    details: {
      card_last_4: doc.card_last_4,
      employer: doc.employer,
      provider: doc.provider,
      amount: doc.expected_amount,
    },
  }));
  
  return {
    userId,
    hasMinimumCoverage: coverage.hasMinimumCoverage,
    totalMonths: coverage.totalMonths,
    missingMonths: coverage.missingMonths,
    pendingClassification: pendingCount || 0,
    missingDocuments,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDocumentIcon(type: string): string {
  const icons: Record<string, string> = {
    credit: '💳',
    payslip: '💼',
    mortgage: '🏠',
    loan: '🏦',
    insurance: '🛡️',
    pension: '👴',
    savings: '💰',
    investment: '📈',
    bank: '🏦',
  };
  return icons[type] || '📄';
}

function getDocumentName(type: string): string {
  const names: Record<string, string> = {
    credit: 'פירוט כרטיס אשראי',
    payslip: 'תלוש משכורת',
    mortgage: 'דוח משכנתא',
    loan: 'דוח הלוואות',
    insurance: 'פוליסת ביטוח',
    pension: 'דוח פנסיה',
    savings: 'דוח חיסכון',
    investment: 'דוח השקעות',
    bank: 'דוח בנק',
  };
  return names[type] || type;
}

function getDocumentTypeName(type: string): string {
  const names: Record<string, string> = {
    credit: 'דוח אשראי',
    payslip: 'תלוש משכורת',
    mortgage: 'דוח משכנתא',
    loan: 'דוח הלוואות',
    insurance: 'דוח ביטוח',
    pension: 'דוח פנסיה',
    pension_clearing: 'דוח מסלקה פנסיונית',
    har_bituach: 'דוח הר הביטוח',
    savings: 'דוח חיסכון',
    investment: 'דוח השקעות',
    bank: 'דוח בנק',
  };
  return names[type] || 'את הדוח';
}

// ============================================================================
// Export
// ============================================================================

export default {
  buildDocumentAnalysisMessage,
  handleContinueRequest,
  isContinueRequest,
  getUploadFlowState,
};

