/**
 * Document Classification Session
 * שאלות סיווג ידידותיות - כמו חבר, לא כמו מערכת!
 * 
 * הזרימה:
 * 1. אחרי זיהוי תנועות מ-PDF
 * 2. שואלים על הכנסות קודם (2-3 בכל פעם)
 * 3. אח"כ הוצאות
 * 4. אם המשתמש רוצה הפסקה - מזכירים מאוחר יותר
 */

import { updateContext, loadContext } from '../context-manager';
import { scheduleReminder as scheduleFollowUp } from '../follow-up-manager';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Database Categories
// ============================================================================

export interface DbCategory {
  id?: string;
  name: string;
  expense_type: 'fixed' | 'variable' | 'special';
  category_group: string;
}

// Cache לקטגוריות (טעינה חד פעמית)
let categoriesCache: DbCategory[] | null = null;
let categoriesByGroup: Map<string, DbCategory[]> | null = null;

// ============================================================================
// Income Categories (קבוע - לא בDB)
// ============================================================================

export interface IncomeCategory {
  name: string;
  employmentType?: 'employee' | 'freelancer' | 'business_owner';
  allowanceType?: 'unemployment' | 'disability' | 'pension' | 'other';
  keywords: string[];
}

export const INCOME_CATEGORIES: IncomeCategory[] = [
  {
    name: 'משכורת',
    employmentType: 'employee',
    keywords: ['משכורת', 'שכר', 'salary', 'wages', 'תשלום שכר'],
  },
  {
    name: 'עצמאי/פרילנס',
    employmentType: 'freelancer',
    keywords: ['עצמאי', 'פרילנס', 'freelance', 'ייעוץ', 'לקוח', 'פרויקט'],
  },
  {
    name: 'הכנסה מעסק',
    employmentType: 'business_owner',
    keywords: ['עסק', 'רווחים', 'תקבולים', 'business'],
  },
  {
    name: 'קצבת אבטלה',
    allowanceType: 'unemployment',
    keywords: ['אבטלה', 'unemployment', 'דמי אבטלה'],
  },
  {
    name: 'קצבת נכות',
    allowanceType: 'disability',
    keywords: ['נכות', 'disability'],
  },
  {
    name: 'פנסיה/קצבת זקנה',
    allowanceType: 'pension',
    keywords: ['פנסיה', 'זקנה', 'pension', 'גמלה'],
  },
  {
    name: 'החזר מס',
    keywords: ['החזר מס', 'החזר ממס', 'זיכוי מס', 'tax refund'],
  },
  {
    name: 'השקעות',
    keywords: ['דיבידנד', 'ריבית', 'קרן', 'השקעה', 'מניות', 'אג"ח', 'פנסיוני', 'גמל', 'השתלמות'],
  },
  {
    name: 'שכירות',
    keywords: ['שכירות', 'דירה', 'נדל"ן', 'השכרה', 'שוכר'],
  },
  {
    name: 'מתנה/ירושה',
    keywords: ['מתנה', 'ירושה', 'gift', 'inheritance'],
  },
  {
    name: 'העברה פנימית',
    keywords: ['העברה', 'חשבון אחר', 'פנימי', 'בין חשבונות'],
  },
  {
    name: 'אחר',
    keywords: [],
  },
];

/**
 * זיהוי קטגוריית הכנסה לפי vendor/description
 */
export function suggestIncomeCategory(vendor: string): IncomeCategory[] {
  const lower = vendor.toLowerCase();
  const suggestions: IncomeCategory[] = [];
  
  for (const cat of INCOME_CATEGORIES) {
    if (cat.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      suggestions.push(cat);
    }
  }
  
  // אם לא מצאנו - החזר ברירות מחדל
  if (suggestions.length === 0) {
    return [
      INCOME_CATEGORIES.find(c => c.name === 'משכורת')!,
      INCOME_CATEGORIES.find(c => c.name === 'השקעות')!,
      INCOME_CATEGORIES.find(c => c.name === 'העברה פנימית')!,
    ];
  }
  
  return suggestions.slice(0, 3);
}

/**
 * טעינת קטגוריות מהמסד נתונים
 */
export async function loadCategories(): Promise<DbCategory[]> {
  if (categoriesCache) return categoriesCache;
  
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('expense_categories')
    .select('id, name, expense_type, category_group')
    .eq('is_active', true)
    .order('category_group')
    .order('name');
  
  if (error || !data) {
    console.error('Error loading categories:', error);
    return [];
  }
  
  categoriesCache = data as DbCategory[];
  
  // ארגון לפי קבוצה
  categoriesByGroup = new Map();
  for (const cat of categoriesCache) {
    if (!categoriesByGroup.has(cat.category_group)) {
      categoriesByGroup.set(cat.category_group, []);
    }
    categoriesByGroup.get(cat.category_group)!.push(cat);
  }
  
  return categoriesCache;
}

/**
 * קבלת קטגוריות לפי קבוצה
 */
export function getCategoriesByGroup(): Map<string, DbCategory[]> {
  return categoriesByGroup || new Map();
}

/**
 * חיפוש קטגוריה לפי שם (fuzzy match)
 */
export function findCategoryByName(searchText: string): DbCategory | null {
  if (!categoriesCache) return null;
  
  const lower = searchText.toLowerCase().trim();
  
  // חיפוש מדויק
  const exact = categoriesCache.find(c => c.name.toLowerCase() === lower);
  if (exact) return exact;
  
  // חיפוש חלקי
  const partial = categoriesCache.find(c => 
    c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
  );
  if (partial) return partial;
  
  // חיפוש לפי מילות מפתח
  const keywords = lower.split(/\s+/);
  const byKeyword = categoriesCache.find(c => 
    keywords.some(kw => kw.length > 2 && c.name.toLowerCase().includes(kw))
  );
  
  return byKeyword || null;
}

/**
 * הצעת קטגוריות רלוונטיות לפי vendor/description
 */
export function suggestCategories(vendor: string, amount: number): DbCategory[] {
  if (!categoriesCache) return [];
  
  const lower = vendor.toLowerCase();
  const suggestions: DbCategory[] = [];
  
  // מיפוי מילות מפתח לקבוצות
  const keywordToGroup: Record<string, string[]> = {
    'ביטוח': ['ביטוחים'],
    'לאומי': ['מיסים', 'ביטוחים'],
    'מגדל': ['ביטוחים'],
    'הראל': ['ביטוחים'],
    'מנורה': ['ביטוחים'],
    'פנסיה': ['ביטוחים'],
    'קופה': ['ביטוחים', 'בריאות'],
    'חשמל': ['דיור'],
    'מים': ['דיור'],
    'גז': ['דיור'],
    'ארנונה': ['דיור'],
    'ועד': ['דיור'],
    'שכירות': ['דיור'],
    'משכנתא': ['פיננסים'],
    'הלוואה': ['פיננסים'],
    'בנק': ['פיננסים'],
    'עמלה': ['פיננסים'],
    'סופר': ['מזון'],
    'רמי לוי': ['מזון'],
    'שופרסל': ['מזון'],
    'מסעדה': ['מזון'],
    'קפה': ['מזון'],
    'דלק': ['רכב'],
    'סונול': ['רכב'],
    'פז': ['רכב'],
    'דור אלון': ['רכב'],
    'חניה': ['רכב'],
    'כביש': ['רכב'],
    'מוסך': ['רכב'],
    'טסט': ['רכב'],
    'סלקום': ['תקשורת'],
    'פרטנר': ['תקשורת'],
    'הוט': ['תקשורת'],
    'yes': ['תקשורת'],
    'בזק': ['תקשורת'],
    'נטפליקס': ['מנויים'],
    'ספוטיפיי': ['מנויים'],
    'אמזון': ['מנויים'],
    'ילדים': ['חינוך'],
    'גן': ['חינוך'],
    'בית ספר': ['חינוך'],
    'חוג': ['חינוך'],
    'רופא': ['בריאות'],
    'תרופות': ['בריאות'],
    'בית מרקחת': ['בריאות'],
    'מכבי': ['בריאות'],
    'כללית': ['בריאות'],
  };
  
  // חפש התאמות
  for (const [keyword, groups] of Object.entries(keywordToGroup)) {
    if (lower.includes(keyword)) {
      for (const groupName of groups) {
        const groupCats = categoriesByGroup?.get(groupName) || [];
        suggestions.push(...groupCats.slice(0, 3));
      }
      break;
    }
  }
  
  // אם לא מצאנו - הצע קטגוריות פופולריות
  if (suggestions.length === 0) {
    const popularGroups = ['מזון', 'דיור', 'רכב', 'ביטוחים', 'בילויים'];
    for (const group of popularGroups) {
      const cats = categoriesByGroup?.get(group) || [];
      if (cats.length > 0) suggestions.push(cats[0]);
    }
  }
  
  // הסר כפילויות
  const uniqueMap = new Map(suggestions.map(s => [s.name, s]));
  const unique = Array.from(uniqueMap.values());
  return unique.slice(0, 5);
}

// ============================================================================
// Types
// ============================================================================

export interface TransactionToClassify {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  type: 'income' | 'expense';
  currentCategory?: string | null;
  suggestedCategory?: string | null;
}

export interface MissingDocument {
  type: 'credit' | 'payslip' | 'loan' | 'mortgage' | 'pension' | 'insurance';
  description: string;
  cardLast4?: string;
  chargeDate?: string;
  chargeAmount?: number;
  periodStart?: string;
  periodEnd?: string;
}

export interface ClassificationSession {
  userId: string;
  batchId: string;
  incomeToClassify: TransactionToClassify[];
  expensesToClassify: TransactionToClassify[];
  alreadyClassifiedIncome: TransactionToClassify[];  // הכנסות שכבר מסווגות
  alreadyClassifiedExpenses: TransactionToClassify[];  // הוצאות שכבר מסווגות
  currentPhase: 'income' | 'expenses' | 'request_documents' | 'done';
  currentIndex: number;
  questionsAskedInBatch: number;  // מונה שאלות ב-batch הנוכחי (reset אחרי 2-3)
  totalClassified: number;
  totalIncome: number;
  totalExpenses: number;
  pausedAt?: string;  // ISO date string
  reminderScheduled?: string;  // ISO date string
  pendingQuestions: PendingQuestion[];  // השאלות שמחכות לתשובה
  missingDocuments: MissingDocument[];  // דוחות שצריך לבקש
  requestedDocumentIndex: number;  // איזה מסמך חסר כבר ביקשנו
  waitingForDocument?: string;  // סוג המסמך שמחכים לו
}

export interface PendingQuestion {
  transactionId: string;
  questionNumber: number;  // 1, 2, or 3
  vendor: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
}

export interface ClassificationResponse {
  message: string;
  session: ClassificationSession;
  done: boolean;
  waitingForAnswer: boolean;
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * יצירת session חדש אחרי זיהוי PDF
 * 
 * 🔑 חשוב: כל התנועות עוברות אישור מהמשתמש!
 * גם אם AI סיווג - המשתמש צריך לאשר או לתקן.
 */
export async function createClassificationSession(
  userId: string,
  batchId: string,
  transactions: TransactionToClassify[],
  totalIncome: number,
  totalExpenses: number,
  missingDocs?: any[]  // מה-AI response
): Promise<ClassificationSession> {
  // טעינת קטגוריות מהDB
  await loadCategories();
  
  // 🔑 כל ההכנסות צריכות אישור (מהגדול לקטן)
  const incomeToClassify = transactions
    .filter(tx => tx.type === 'income')
    .sort((a, b) => b.amount - a.amount);
  
  // 🔑 כל ההוצאות צריכות אישור (מהגדול לקטן)
  const expensesToClassify = transactions
    .filter(tx => tx.type === 'expense')
    .sort((a, b) => b.amount - a.amount);

  // סטטיסטיקה: כמה כבר יש להן הצעת סיווג מ-AI
  const alreadyClassifiedIncome = transactions
    .filter(tx => tx.type === 'income' && tx.currentCategory);
  
  const alreadyClassifiedExpenses = transactions
    .filter(tx => tx.type === 'expense' && tx.currentCategory);

  // המרת missing_documents לפורמט שלנו
  const missingDocuments = parseMissingDocuments(missingDocs || []);

  return {
    userId,
    batchId,
    incomeToClassify,
    expensesToClassify,
    alreadyClassifiedIncome,  // רק לסטטיסטיקה - כמה יש הצעה
    alreadyClassifiedExpenses,
    currentPhase: incomeToClassify.length > 0 ? 'income' : (expensesToClassify.length > 0 ? 'expenses' : 'done'),
    currentIndex: 0,
    questionsAskedInBatch: 0,
    totalClassified: 0,
    totalIncome,
    totalExpenses,
    pendingQuestions: [],
    missingDocuments,
    requestedDocumentIndex: 0,
  };
}

/**
 * המרת missing_documents מה-AI לפורמט שלנו
 */
function parseMissingDocuments(docs: any[]): MissingDocument[] {
  const result: MissingDocument[] = [];
  const seenCards = new Set<string>();
  
  for (const doc of docs) {
    // סינון כפילויות של כרטיסי אשראי
    if (doc.type === 'credit' && doc.card_last_4) {
      if (seenCards.has(doc.card_last_4)) continue;
      seenCards.add(doc.card_last_4);
      
      result.push({
        type: 'credit',
        description: doc.description || `דוח אשראי לכרטיס ${doc.card_last_4}`,
        cardLast4: doc.card_last_4,
        chargeDate: doc.charge_date,
        chargeAmount: doc.charge_amount,
        periodStart: doc.period_start,
        periodEnd: doc.period_end,
      });
    } else if (doc.type === 'payslip' || doc.type === 'salary') {
      result.push({
        type: 'payslip',
        description: 'תלוש שכר',
      });
    } else if (doc.type === 'loan') {
      result.push({
        type: 'loan',
        description: 'פירוט הלוואות',
      });
    }
  }
  
  return result;
}

/**
 * שמירת session ב-context
 */
export async function saveClassificationSession(
  userId: string,
  session: ClassificationSession
): Promise<void> {
  await updateContext(userId, {
    ongoingTask: {
      taskType: 'classification_questions',
      totalItems: session.incomeToClassify.length + session.expensesToClassify.length,
      completedItems: session.totalClassified,
      data: session,
    },
  } as any);
}

/**
 * טעינת session מ-context
 */
export async function loadClassificationSession(
  userId: string
): Promise<ClassificationSession | null> {
  const context = await loadContext(userId);
  if (context?.ongoingTask?.taskType === 'classification_questions' && context.ongoingTask.data) {
    return context.ongoingTask.data as ClassificationSession;
  }
  return null;
}

/**
 * ניקוי session
 */
export async function clearClassificationSession(userId: string): Promise<void> {
  await updateContext(userId, {
    ongoingTask: undefined,
    taskProgress: undefined,
  } as any);
}

// ============================================================================
// Question Generation
// ============================================================================

/**
 * הודעת פתיחה אחרי זיהוי PDF
 * 
 * 🔑 כל התנועות עוברות אישור! גם אם AI הציע סיווג.
 */
export function getInitialMessage(session: ClassificationSession): string {
  const totalTransactions = session.incomeToClassify.length + session.expensesToClassify.length;
  
  if (totalTransactions === 0) {
    return `לא זיהיתי תנועות בדוח 🤔\n\nאפשר לנסות לשלוח דוח אחר?`;
  }

  // כמה יש להן הצעת סיווג מ-AI
  const withSuggestion = session.alreadyClassifiedIncome.length + session.alreadyClassifiedExpenses.length;
  const withoutSuggestion = totalTransactions - withSuggestion;

  // הצגת סיכום
  let message = `📊 זיהיתי ${totalTransactions} תנועות!\n\n`;
  
  // הכנסות
  message += `💚 הכנסות: ${session.incomeToClassify.length} תנועות (${session.totalIncome.toLocaleString('he-IL')} ₪)\n`;
  
  // הוצאות
  message += `💸 הוצאות: ${session.expensesToClassify.length} תנועות (${session.totalExpenses.toLocaleString('he-IL')} ₪)\n\n`;
  
  // סטטוס הסיווג האוטומטי
  if (withSuggestion > 0) {
    message += `🤖 זיהיתי אוטומטית ${withSuggestion} תנועות - רק צריך לאשר.\n`;
  }
  if (withoutSuggestion > 0) {
    message += `❓ ${withoutSuggestion} תנועות לא הצלחתי לזהות - אשאל עליהן.\n`;
  }
  message += `\n`;
  
  // הסבר על התהליך
  message += `📝 איך זה עובד?\n`;
  message += `• אשאל על תנועה אחת בכל פעם\n`;
  message += `• אם זיהיתי נכון - פשוט כתוב "כן" ✓\n`;
  message += `• אם טעיתי - כתוב "לא, זה X"\n`;
  message += `• תמיד אפשר להגיד "אח"כ" ולהמשיך מחר 😊\n\n`;
  
  message += `נתחיל?`;

  return message;
}

/**
 * קבלת batch הבא של שאלות (2-3 שאלות)
 */
export function getNextQuestionBatch(session: ClassificationSession): {
  message: string;
  questions: PendingQuestion[];
  done: boolean;
  askToContinue: boolean;
  waitingForDocument?: string;
} {
  const QUESTIONS_PER_BATCH = 1;  // שאלה אחת בכל פעם - פחות מבלבל
  
  // אם אנחנו בשלב בקשת מסמכים
  if (session.currentPhase === 'request_documents') {
    return getNextDocumentRequest(session);
  }
  
  // בדיקה אם סיימנו
  const currentList = session.currentPhase === 'income' 
    ? session.incomeToClassify 
    : session.expensesToClassify;
  
  if (session.currentIndex >= currentList.length) {
    // עוברים לשלב הבא
    if (session.currentPhase === 'income' && session.expensesToClassify.length > 0) {
      session.currentPhase = 'expenses';
      session.currentIndex = 0;
      session.questionsAskedInBatch = 0;
      return getNextQuestionBatch(session);  // recursive call
    } else if (session.missingDocuments.length > 0) {
      // יש דוחות חסרים - עוברים לבקש אותם
      session.currentPhase = 'request_documents';
      session.requestedDocumentIndex = 0;
      return getNextDocumentRequest(session);
    } else {
      // סיימנו!
      return {
        message: getCompletionMessage(session),
        questions: [],
        done: true,
        askToContinue: false,
      };
    }
  }

  // בדיקה אם צריך לשאול אם להמשיך (אחרי כל 5 שאלות)
  if (session.questionsAskedInBatch >= 5 && session.currentIndex < currentList.length) {
    const remaining = currentList.length - session.currentIndex;
    const phaseText = session.currentPhase === 'income' ? 'הכנסות' : 'הוצאות';
    
    return {
      message: `נשארו עוד ${remaining} ${phaseText} - נמשיך או מספיק לעכשיו?`,
      questions: [],
      done: false,
      askToContinue: true,
    };
  }

  // יצירת השאלות הבאות
  const questions: PendingQuestion[] = [];
  const messageParts: string[] = [];
  
  // הוספת כותרת אם זו התחלה של phase
  if (session.currentIndex === 0) {
    if (session.currentPhase === 'income') {
      messageParts.push('מעולה! קודם על הכנסות:\n');
    } else {
      messageParts.push('עכשיו נעבור להוצאות:\n');
    }
  }

  // הוספת עד 2 שאלות
  let questionNum = 1;
  while (
    questionNum <= QUESTIONS_PER_BATCH && 
    session.currentIndex + questionNum - 1 < currentList.length
  ) {
    const tx = currentList[session.currentIndex + questionNum - 1];
    const question = formatQuestion(tx, session.totalClassified + questionNum, session.currentPhase);
    
    questions.push({
      transactionId: tx.id,
      questionNumber: questionNum,
      vendor: tx.vendor,
      amount: tx.amount,
      date: tx.date,
      type: tx.type,
    });
    
    messageParts.push(question);
    questionNum++;
  }

  // עדכון ה-session
  session.pendingQuestions = questions;

  return {
    message: messageParts.join('\n'),
    questions,
    done: false,
    askToContinue: false,
  };
}

/**
 * פורמט שאלה בודדת - עם הצעות קטגוריות מהמסד נתונים
 */
function formatQuestion(
  tx: TransactionToClassify,
  globalIndex: number,
  phase: 'income' | 'expenses' | 'request_documents' | 'done'
): string {
  const date = formatHebrewDate(tx.date);
  const amount = tx.amount.toLocaleString('he-IL');
  
  if (phase === 'income') {
    // לגבי הכנסות - הצע מרשימת קטגוריות הכנסה
    if (tx.currentCategory || tx.suggestedCategory) {
      const suggested = tx.currentCategory || tx.suggestedCategory;
      return `${globalIndex}. ${amount} ₪ מ"${tx.vendor}" (${date})\n   → זה **${suggested}**? (כן/לא/תקן)`;
    }
    
    // הצע קטגוריות הכנסה רלוונטיות
    const incomeSuggestions = suggestIncomeCategory(tx.vendor);
    const suggestionList = incomeSuggestions.map(s => s.name).join(' / ');
    return `${globalIndex}. ${amount} ₪ מ"${tx.vendor}" (${date})\n   → מה זה? (${suggestionList})`;
    
  } else {
    // לגבי הוצאות - הצע מהמסד נתונים
    if (tx.currentCategory || tx.suggestedCategory) {
      const suggested = tx.currentCategory || tx.suggestedCategory;
      return `${globalIndex}. ${amount} ₪ ב"${tx.vendor}" (${date})\n   → זה **${suggested}**? (כן/לא/תקן)`;
    }
    
    // הצע קטגוריות רלוונטיות מ-DB
    const suggestions = suggestCategories(tx.vendor, tx.amount);
    if (suggestions.length > 0) {
      const suggestionList = suggestions.slice(0, 3).map(s => s.name).join(' / ');
      return `${globalIndex}. ${amount} ₪ ב"${tx.vendor}" (${date})\n   → לאיזה קטגוריה? (${suggestionList} / אחר)`;
    }
    
    return `${globalIndex}. ${amount} ₪ ב"${tx.vendor}" (${date})\n   → לאיזה קטגוריה?`;
  }
}

/**
 * פורמט תאריך בעברית
 */
function formatHebrewDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * בקשת המסמך הבא
 */
function getNextDocumentRequest(session: ClassificationSession): {
  message: string;
  questions: PendingQuestion[];
  done: boolean;
  askToContinue: boolean;
  waitingForDocument?: string;
} {
  if (session.requestedDocumentIndex >= session.missingDocuments.length) {
    // סיימנו עם כל המסמכים!
    return {
      message: getCompletionMessage(session),
      questions: [],
      done: true,
      askToContinue: false,
    };
  }
  
  const doc = session.missingDocuments[session.requestedDocumentIndex];
  session.waitingForDocument = doc.type;
  
  let message = '';
  
  if (session.requestedDocumentIndex === 0) {
    // הודעת מעבר מסיווג לבקשת מסמכים
    message = `מעולה! סיימנו לסווג את התנועות 🎉\n\n`;
    message += `עכשיו, כדי שתהיה לי תמונה מלאה יותר - `;
  } else {
    message = `מצוין! עכשיו `;
  }
  
  switch (doc.type) {
    case 'credit':
      const cardNum = doc.cardLast4 || 'האשראי';
      message += `אני צריך את **דוח כרטיס האשראי** (${cardNum}) 💳\n\n`;
      if (doc.chargeAmount) {
        message += `ראיתי חיוב של ${doc.chargeAmount.toLocaleString('he-IL')} ₪ - הדוח יעזור לי לפרט את ההוצאות.\n\n`;
      }
      message += `📱 איך להוציא דוח?\n`;
      message += `• היכנס לאפליקציית כאל/מקס/ויזה\n`;
      message += `• חפש "דוח תנועות" או "פירוט עסקאות"\n`;
      message += `• שלח PDF או צילום מסך\n\n`;
      message += `אפשר גם להגיד "אח"כ" ונחזור לזה 😊`;
      break;
      
    case 'payslip':
      message += `אני צריך **תלוש שכר** אחרון 📄\n\n`;
      message += `זה יעזור לי להבין:\n`;
      message += `• מה המשכורת נטו שלך\n`;
      message += `• כמה הולך לפנסיה ולביטוחים\n`;
      message += `• האם יש הפרשות שכדאי לבדוק\n\n`;
      message += `שלח PDF או תמונה של התלוש 📸`;
      break;
      
    case 'loan':
      message += `אני צריך **פירוט הלוואות** 💰\n\n`;
      message += `זה יעזור לי לראות:\n`;
      message += `• כמה אתה משלם כל חודש\n`;
      message += `• מה הריביות\n`;
      message += `• אם יש אפשרות לאחד או למחזר\n\n`;
      message += `תוכל לשלוח את הדוח מהבנק או לצלם את ההסכם`;
      break;
      
    default:
      message += `אני צריך ${doc.description}\n`;
      message += `שלח PDF או תמונה 📸`;
  }
  
  return {
    message,
    questions: [],
    done: false,
    askToContinue: false,
    waitingForDocument: doc.type,
  };
}

/**
 * הודעת סיום
 */
function getCompletionMessage(session: ClassificationSession): string {
  return `🎉 מעולה! סיימנו לסווג את כל התנועות!

📊 סיכום:
💚 הכנסות: ${session.totalIncome.toLocaleString('he-IL')} ₪
💸 הוצאות: ${session.totalExpenses.toLocaleString('he-IL')} ₪
📈 מאזן: ${(session.totalIncome - session.totalExpenses).toLocaleString('he-IL')} ₪

עכשיו יש לי תמונה מלאה של המצב הפיננסי שלך! 
רוצה לראות ניתוח מפורט?`;
}

// ============================================================================
// Response Handling
// ============================================================================

/**
 * עיבוד תשובת המשתמש
 */
export async function handleUserResponse(
  session: ClassificationSession,
  userMessage: string,
  supabase: any
): Promise<ClassificationResponse> {
  // וודא שקטגוריות נטענו
  await loadCategories();
  
  const lowerMessage = userMessage.toLowerCase().trim();

  // אם מחכים למסמך - טיפול מיוחד
  if (session.currentPhase === 'request_documents' && session.waitingForDocument) {
    // אם המשתמש רוצה לדחות את המסמך הזה
    if (isPostponement(lowerMessage) || lowerMessage.includes('אח"כ') || lowerMessage.includes('דלג')) {
      session.requestedDocumentIndex++;
      session.waitingForDocument = undefined;
      const next = getNextDocumentRequest(session);
      await saveClassificationSession(session.userId, session);
      
      return {
        message: `בסדר, נחזור לזה אח"כ 😊\n\n${next.message}`,
        session,
        done: next.done,
        waitingForAnswer: !next.done,
      };
    }
    
    // אם המשתמש שולח אישור/הודעה - אומרים לו לשלוח מסמך
    return {
      message: `מחכה למסמך! 📄\nפשוט שלח PDF או תמונה.\n\nאו כתוב "דלג" אם אין לך עכשיו.`,
      session,
      done: false,
      waitingForAnswer: true,
    };
  }

  // 1. בדיקה אם זה אישור להמשיך
  if (isConfirmation(lowerMessage)) {
    session.questionsAskedInBatch = 0;  // reset counter
    const next = getNextQuestionBatch(session);
    await saveClassificationSession(session.userId, session);
    return {
      message: next.message,
      session,
      done: next.done,
      waitingForAnswer: !next.done && !next.askToContinue,
    };
  }

  // 2. בדיקה אם רוצה לעצור
  if (isPostponement(lowerMessage)) {
    return await handlePostponement(session, userMessage);
  }

  // 3. ניסיון לפרסר תשובות לשאלות
  if (session.pendingQuestions.length > 0) {
    const parseResult = parseAnswers(userMessage, session.pendingQuestions);
    
    if (parseResult.success) {
      // עדכון התנועות בDB
      for (const answer of parseResult.answers) {
        await updateTransactionCategory(supabase, session.userId, answer.transactionId, answer.category, answer.isInternal);
      }
      
      // עדכון ה-session
      session.currentIndex += parseResult.answers.length;
      session.totalClassified += parseResult.answers.length;
      session.questionsAskedInBatch += parseResult.answers.length;
      session.pendingQuestions = [];
      
      // קבלת השאלות הבאות
      const next = getNextQuestionBatch(session);
      await saveClassificationSession(session.userId, session);
      
      // תגובה ידידותית
      const responses = ['רשמתי! ✓', 'מעולה! 👍', 'הבנתי! ✓', 'נחמד! רשום 📝'];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      return {
        message: `${randomResponse}\n\n${next.message}`,
        session,
        done: next.done,
        waitingForAnswer: !next.done && !next.askToContinue,
      };
    }
  }

  // 4. לא הבנתי - ביקוש הבהרה
  return {
    message: `לא הבנתי 😅\n\n${getHelpMessage(session)}`,
    session,
    done: false,
    waitingForAnswer: true,
  };
}

/**
 * טיפול במסמך שהתקבל (נקרא מה-webhook)
 */
export async function handleDocumentReceived(
  session: ClassificationSession,
  documentType: string
): Promise<{ shouldProcess: boolean; nextMessage?: string }> {
  if (session.currentPhase !== 'request_documents' || !session.waitingForDocument) {
    return { shouldProcess: true };  // לא בשלב בקשת מסמכים - לעבד כרגיל
  }
  
  // בדיקה אם זה המסמך שביקשנו
  const expectedType = session.waitingForDocument;
  
  // המרה בין סוגי מסמכים
  const typeMatch = 
    (expectedType === 'credit' && documentType === 'credit') ||
    (expectedType === 'payslip' && documentType === 'payslip') ||
    (expectedType === 'loan' && documentType === 'loan');
  
  if (typeMatch) {
    // המסמך התקבל! נמשיך אחרי העיבוד
    session.requestedDocumentIndex++;
    session.waitingForDocument = undefined;
    await saveClassificationSession(session.userId, session);
    return { shouldProcess: true };
  }
  
  // קיבלנו מסמך אחר - גם בסדר, לעבד
  return { shouldProcess: true };
}

/**
 * בדיקה אם זה אישור
 */
function isConfirmation(message: string): boolean {
  const confirmations = ['כן', 'בטח', 'יאללה', 'נתחיל', 'בוא', 'נמשיך', 'להמשיך', 'כן!', 'ok', 'yes', 'sure'];
  return confirmations.some(c => message.includes(c));
}

/**
 * בדיקה אם רוצה לעצור
 */
function isPostponement(message: string): boolean {
  const postponements = [
    'לא עכשיו', 'אחר כך', 'מאוחר יותר', 'מספיק', 
    'עייף', 'הפסקה', 'לא', 'מחר', 'בערב', 'אח"כ',
    'לא רוצה', 'די', 'stop', 'later'
  ];
  return postponements.some(p => message.includes(p));
}

/**
 * טיפול בבקשה לדחות
 */
async function handlePostponement(
  session: ClassificationSession,
  userMessage: string
): Promise<ClassificationResponse> {
  session.pausedAt = new Date().toISOString();
  
  // בדיקה אם יש זמן ספציפי
  const timeMatch = parseTimeFromMessage(userMessage);
  
  if (timeMatch) {
    session.reminderScheduled = timeMatch.toISOString();
    await saveClassificationSession(session.userId, session);
    
    // תזמון תזכורת
    try {
      await scheduleFollowUp(
        session.userId,
        'classification_continue',
        timeMatch,
        `היי! זמן לסדר את התנועות! 😊\nנמשיך מאיפה שעצרנו?`,
        { batchId: session.batchId }
      );
    } catch (e) {
      console.error('Failed to schedule reminder:', e);
    }
    
    const timeStr = timeMatch.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    return {
      message: `מעולה! אזכיר לך ב-${timeStr} 🔔`,
      session,
      done: false,
      waitingForAnswer: false,
    };
  }
  
  // בדיקה אם שואל מתי
  if (userMessage.includes('מתי') || userMessage.includes('בערב') || userMessage.includes('מחר')) {
    return {
      message: `באיזה שעה יהיה לך נוח?`,
      session,
      done: false,
      waitingForAnswer: true,
    };
  }
  
  // ברירת מחדל - תזכורת מחר
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);  // 10:00 מחר
  
  session.reminderScheduled = tomorrow.toISOString();
  await saveClassificationSession(session.userId, session);
  
  try {
    await scheduleFollowUp(
      session.userId,
      'classification_continue',
      tomorrow,
      `היי! יש לנו עוד כמה שאלות על התנועות.\nבא לך עכשיו?`,
      { batchId: session.batchId }
    );
  } catch (e) {
    console.error('Failed to schedule reminder:', e);
  }
  
  const classified = session.totalClassified;
  return {
    message: `בסדר! ${classified > 0 ? `כבר סיווגנו ${classified} תנועות - ` : ''}נמשיך מחר 😊`,
    session,
    done: false,
    waitingForAnswer: false,
  };
}

/**
 * פרסור זמן מהודעה
 */
function parseTimeFromMessage(message: string): Date | null {
  const now = new Date();
  
  // חיפוש שעה ספציפית
  const hourMatch = message.match(/(\d{1,2})(?::(\d{2}))?/);
  if (hourMatch) {
    let hour = parseInt(hourMatch[1]);
    const minutes = hourMatch[2] ? parseInt(hourMatch[2]) : 0;
    
    // אם השעה קטנה מ-7, כנראה הכוונה לערב
    if (hour < 7 && !message.includes('בוקר')) {
      hour += 12;
    }
    
    // אם "בערב" - ודא שזה PM
    if (message.includes('ערב') && hour < 12) {
      hour += 12;
    }
    
    const result = new Date(now);
    result.setHours(hour, minutes, 0, 0);
    
    // אם הזמן כבר עבר היום, שים למחר
    if (result <= now) {
      result.setDate(result.getDate() + 1);
    }
    
    return result;
  }
  
  // "מחר"
  if (message.includes('מחר')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow;
  }
  
  // "בערב"
  if (message.includes('ערב')) {
    const evening = new Date(now);
    evening.setHours(20, 0, 0, 0);
    if (evening <= now) {
      evening.setDate(evening.getDate() + 1);
    }
    return evening;
  }
  
  return null;
}

/**
 * פרסור תשובות מהמשתמש
 */
interface ParsedAnswer {
  transactionId: string;
  category: string;
  isInternal: boolean;  // האם זו העברה פנימית (לא הכנסה אמיתית)
}

function parseAnswers(
  message: string,
  pendingQuestions: PendingQuestion[]
): { success: boolean; answers: ParsedAnswer[] } {
  const answers: ParsedAnswer[] = [];
  const lower = message.toLowerCase().trim();
  
  // שאלה אחת בלבד - פשוט!
  if (pendingQuestions.length === 1) {
    const q = pendingQuestions[0];
    
    // 1. אישור - "כן", "נכון", "מאשר"
    if (lower === 'כן' || lower === 'נכון' || lower === 'מאשר' || lower === 'אוקי' || lower === 'ok') {
      answers.push({
        transactionId: q.transactionId,
        category: 'CONFIRMED',  // סימן לשמור את הקטגוריה הקיימת
        isInternal: false,
      });
      return { success: true, answers };
    }
    
    // 2. תיקון - "לא, זה X" או "לא זה X"
    const correctionMatch = lower.match(/^לא[,\s]*(?:זה|זו|אלה)?\s*(.+)$/);
    if (correctionMatch) {
      const correctionText = correctionMatch[1].trim();
      const category = categorizeFromText(correctionText, q.type);
      answers.push({
        transactionId: q.transactionId,
        category,
        isInternal: isInternalTransfer(correctionText),
      });
      return { success: true, answers };
    }
    
    // 3. תשובה ישירה - קטגוריה חדשה
    const category = categorizeFromText(message, q.type);
    answers.push({
      transactionId: q.transactionId,
      category,
      isInternal: isInternalTransfer(message),
    });
    return { success: true, answers };
  }
  
  // במקרה שבעתיד נרצה יותר משאלה אחת:
  // ניסיון לזהות תשובות מרובות "1. X 2. Y"
  const numberedPattern = /(\d+)[.\s]+([^0-9]+?)(?=\d+[.\s]|$)/g;
  let match;
  while ((match = numberedPattern.exec(message)) !== null) {
    const num = parseInt(match[1]);
    const answerText = match[2].trim();
    if (num >= 1 && num <= pendingQuestions.length) {
      const q = pendingQuestions[num - 1];
      const isConfirm = /^כן|^נכון|^מאשר/.test(answerText.toLowerCase());
      const category = isConfirm ? 'CONFIRMED' : categorizeFromText(answerText, q.type);
      answers.push({
        transactionId: q.transactionId,
        category,
        isInternal: isInternalTransfer(answerText),
      });
    }
  }
  
  if (answers.length > 0) {
    return { success: true, answers };
  }
  
  return { success: false, answers: [] };
}

/**
 * זיהוי קטגוריה מטקסט חופשי - מחפש במסד נתונים
 */
function categorizeFromText(text: string, type: 'income' | 'expense'): string {
  const lower = text.toLowerCase().trim();
  
  // אם המשתמש אישר - החזר "אושר"
  if (lower === 'כן' || lower === 'נכון' || lower === 'מאשר' || lower === '✓') {
    return 'CONFIRMED';
  }
  
  if (type === 'income') {
    // חפש בקטגוריות הכנסה
    for (const cat of INCOME_CATEGORIES) {
      // התאמה מדויקת לשם
      if (lower === cat.name.toLowerCase()) return cat.name;
      // התאמה לmilלות מפתח
      if (cat.keywords.some(kw => lower.includes(kw.toLowerCase()))) return cat.name;
    }
    
    // התאמות ידניות נוספות
    if (lower.includes('החזר') || lower.includes('זיכוי')) return 'החזר מס';
    if (lower.includes('קרן') || lower.includes('השתלמות')) return 'השקעות';
    
    return text.substring(0, 50);  // אם לא מצאנו - השתמש בטקסט
    
  } else {
    // חפש בקטגוריות הוצאה מהDB
    const dbCategory = findCategoryByName(text);
    if (dbCategory) return dbCategory.name;
    
    // התאמות ידניות
    if (lower.includes('מזון') || lower.includes('סופר') || lower.includes('אוכל')) return 'קניות סופר';
    if (lower.includes('מסעדה') || lower.includes('קפה')) return 'מסעדות';
    if (lower.includes('דלק') || lower.includes('בנזין')) return 'דלק';
    if (lower.includes('תחבורה') || lower.includes('נסיעות') || lower.includes('אוטובוס')) return 'תחבורה ציבורית';
    if (lower.includes('ביגוד') || lower.includes('בגדים')) return 'ביגוד';
    if (lower.includes('בילוי') || lower.includes('פנאי')) return 'בילויים ובידור';
    if (lower.includes('חשמל')) return 'חשמל לבית';
    if (lower.includes('מים')) return 'מים למגורים';
    if (lower.includes('גז')) return 'גז';
    if (lower.includes('ארנונה')) return 'ארנונה למגורים';
    if (lower.includes('שכר טרחה') || lower.includes('עו"ד')) return 'הוצאות משפטיות';
    if (lower.includes('רואה חשבון') || lower.includes('רו"ח')) return 'רואה חשבון';
    if (lower.includes('ביטוח')) return 'ביטוח חיים';
    if (lower.includes('משכנתא')) return 'הלוואת משכנתא למגורים';
    if (lower.includes('הלוואה')) return 'הלוואות בנקאיות';
    if (lower.includes('ילדים') || lower.includes('גן')) return 'גני ילדים פרטיים';
    if (lower.includes('חוג')) return 'חוגים לילדים';
    if (lower.includes('טלפון') || lower.includes('סלולר')) return 'טלפונים ניידים';
    if (lower.includes('אינטרנט')) return 'אינטרנט ביתי';
    if (lower.includes('נטפליקס') || lower.includes('ספוטיפיי')) return 'מנויים דיגיטליים (נטפליקס ספוטיפיי)';
    
    return text.substring(0, 50);
  }
}

/**
 * בדיקה אם זו העברה פנימית
 */
function isInternalTransfer(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('העברה פנימית') || 
         lower.includes('חשבון אחר') || 
         lower.includes('חשבון שלי') ||
         lower.includes('בין חשבונות');
}

/**
 * עדכון קטגוריה בDB
 */
async function updateTransactionCategory(
  supabase: any,
  userId: string,
  transactionId: string,
  category: string,
  isInternal: boolean
): Promise<void> {
  // אם המשתמש אישר - רק נעדכן סטטוס, לא נשנה קטגוריה
  if (category === 'CONFIRMED') {
    await supabase
      .from('transactions')
      .update({ status: 'approved' })
      .eq('id', transactionId)
      .eq('user_id', userId);
    return;
  }
  
  const updates: any = {
    expense_category: isInternal ? 'העברה פנימית' : category,
    status: 'approved',
  };
  
  // אם זו העברה פנימית - לא מחשיבים כהכנסה/הוצאה
  if (isInternal) {
    updates.notes = 'העברה פנימית - לא נספר בסיכומים';
  }
  
  await supabase
    .from('transactions')
    .update(updates)
    .eq('id', transactionId)
    .eq('user_id', userId);
}

/**
 * הודעת עזרה
 */
function getHelpMessage(session: ClassificationSession): string {
  if (session.pendingQuestions.length === 1) {
    const q = session.pendingQuestions[0];
    if (q.type === 'income') {
      return `מה זו ההכנסה של ${q.amount} ₪ מ"${q.vendor}"?\n(משכורת, החזר, מתנה, העברה...)`;
    } else {
      return `לאיזה קטגוריה שייך ${q.amount} ₪ ב"${q.vendor}"?\n(מזון, מסעדות, תחבורה, בילויים...)`;
    }
  } else {
    return `ענה על השאלות, למשל:\n"הראשון זה X והשני זה Y"\nאו פשוט "X"`;
  }
}

// ============================================================================
// Resume Session
// ============================================================================

/**
 * המשך session אחרי תזכורת
 */
export async function resumeClassificationSession(
  userId: string
): Promise<ClassificationResponse | null> {
  const session = await loadClassificationSession(userId);
  if (!session) return null;
  
  session.pausedAt = undefined;
  session.reminderScheduled = undefined;
  session.questionsAskedInBatch = 0;  // reset
  
  const next = getNextQuestionBatch(session);
  await saveClassificationSession(userId, session);
  
  return {
    message: `היי! נמשיך מאיפה שעצרנו 😊\n\n${next.message}`,
    session,
    done: next.done,
    waitingForAnswer: !next.done && !next.askToContinue,
  };
}

export default {
  createClassificationSession,
  saveClassificationSession,
  loadClassificationSession,
  clearClassificationSession,
  getInitialMessage,
  getNextQuestionBatch,
  handleUserResponse,
  resumeClassificationSession,
};

