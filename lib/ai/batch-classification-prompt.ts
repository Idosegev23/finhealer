/**
 * Batch Classification Prompt Builder — v3.1
 *
 * Two functions: buildSystemPrompt() + buildUserPrompt()
 * Used by ai-classifier.ts to classify ALL transactions in one Gemini call.
 *
 * Key design: original_description passes through WITHOUT normalization.
 */

import { CATEGORIES, type CategoryDef } from '@/lib/finance/categories';
import { INCOME_CATEGORIES, type IncomeCategoryDef } from '@/lib/finance/income-categories';

// ============================================================================
// Types
// ============================================================================

export interface TransactionForClassification {
  index: number;
  id: string;
  vendor: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  original_description?: string;
}

export interface UserProfileForPrompt {
  employment?: { value: string; confidence: number };
  has_kids?: { value: boolean; confidence: number };
  has_vehicle?: { value: boolean; confidence: number };
  family_status?: string;
}

export interface ExistingClassification {
  category_name: string;
  vendor: string;
  amount_avg: number;
}

export interface ClassificationResult {
  transaction_index: number;
  category_name: string;
  expense_type?: 'fixed' | 'variable' | 'special';
  is_credit_charge?: boolean;
  is_refund?: boolean;
  confidence: number;
  reasoning: string;
}

// ============================================================================
// System Prompt — Fixed rules for batch classification
// ============================================================================

export function buildSystemPrompt(): string {
  return `אתה מסווג תנועות בנקאיות ישראליות. מקבל batch ומחזיר סיווג לכולן.

כללים:
1. רק קטגוריות מהרשימה שתקבל
2. vendor שמופיע כמה פעמים עם סכומים שונים = אולי מוצרים שונים. "מגדל 189₪" ≠ "מגדל 1200₪"
3. אם כבר יש ביטוח רכב מחברה X, אז אותו vendor בסכום אחר = כנראה מוצר אחר (ביטוח בריאות, פנסיה)
4. זיכוי/סכום שלילי/תיאור עם "זיכוי"/"החזר" → is_refund=true. מקושר לקטגוריה של ה-vendor המקורי (לא "הכנסה אחרת")
5. חיוב אשראי כולל (ויזה/visa/מסטרקארד/mastercard/ישראכרט/כאל/cal/max/לאומי קארד) → is_credit_charge=true
6. "הו"ק" = הוראת קבע = כנראה expense_type: "fixed"
7. original_description חשוב יותר מ-vendor! "הו"ק מגדל חיים ובריאות" = ביטוח בריאות, לא ביטוח חיים
8. USD/EUR/GBP/$,€,£ = עסקת חו"ל. סווג לפי vendor בינלאומי (Amazon=קניות אונליין, Netflix=מנוי, Booking=חופשות)
9. "דמי ביטוח לאומי" = הוצאה (מיסים). "קצבת ביטוח לאומי"/"גמלת ילדים" = הכנסה (קצבאות)
10. "הלוואת רכב"/"הלוואה לרכב" = הלוואה בנקאית או חוץ-בנקאית, לא ביטוח רכב
11. "העברה בין חשבונות"/"העברה פנימית" = סווג כהעברה פנימית, לא הכנסה/הוצאה
12. "העברה ל[שם אדם]" = העברה יוצאת (הוצאה). "העברה מ[שם אדם/חברה]" = העברה נכנסת (הכנסה). שים לב ל-מ/ל!
13. שם של אדם פרטי (שם + שם משפחה) = כנראה העברה, לא רישוי רכב או ביטוח. אל תנחש קטגוריה עסקית לשם של אדם.
14. אם original_description ריק ו-vendor לא מוכר = confidence נמוך (0.5 ומטה). עדיף "אחר" עם confidence 0.4 מאשר ניחוש שגוי עם 0.8.
15. אם vendor = שם של המשתמש עצמו או החברה שלו (ראה פרופיל) = העברה פנימית, לא הוצאה/הכנסה רגילה.
16. החזר JSON בלבד, בלי markdown, בלי backticks`;
}

// ============================================================================
// User Prompt — Dynamic per batch
// ============================================================================

export function buildUserPrompt(params: {
  transactions: TransactionForClassification[];
  userProfile: UserProfileForPrompt;
  existingClassifications: ExistingClassification[];
  expenseCategories?: CategoryDef[];
  incomeCategories?: IncomeCategoryDef[];
}): string {
  const {
    transactions,
    userProfile,
    existingClassifications,
    expenseCategories = CATEGORIES,
    incomeCategories = INCOME_CATEGORIES,
  } = params;

  // Build profile block
  const profileParts: string[] = [];
  if (userProfile.employment) {
    profileParts.push(`תעסוקה: ${userProfile.employment.value} (confidence: ${userProfile.employment.confidence})`);
  }
  if (userProfile.has_kids) {
    profileParts.push(`ילדים: ${userProfile.has_kids.value ? 'כן' : 'לא'} (confidence: ${userProfile.has_kids.confidence})`);
  }
  if (userProfile.has_vehicle) {
    profileParts.push(`רכב: ${userProfile.has_vehicle.value ? 'כן' : 'לא'} (confidence: ${userProfile.has_vehicle.confidence})`);
  }
  if (userProfile.family_status) {
    profileParts.push(`מצב משפחתי: ${userProfile.family_status}`);
  }
  const profileBlock = profileParts.length > 0
    ? `פרופיל: ${profileParts.join(', ')}`
    : 'פרופיל: לא ידוע';

  // Build existing classifications context
  let contextBlock = '';
  if (existingClassifications.length > 0) {
    const lines = existingClassifications
      .slice(0, 20)
      .map(c => `- ${c.category_name}: ${c.vendor} ~${Math.round(c.amount_avg)}₪/חודש`)
      .join('\n');
    contextBlock = `\nכבר מסווג (קונטקסט):\n${lines}`;
  }

  // Build transaction list — original_description passes through as-is!
  const txLines = transactions.map(tx => {
    const desc = tx.original_description ? ` | ${tx.original_description}` : '';
    return `[${tx.index}] ${tx.date} | ${tx.vendor} | ${Math.abs(tx.amount)} ₪${desc}`;
  }).join('\n');

  // Build category lists (compact)
  const expCatList = expenseCategories
    .filter(c => c.name !== 'חיוב כרטיס אשראי')
    .map(c => `${c.id}: ${c.name} (${c.group}, ${c.type})`)
    .join('\n');

  const incCatList = incomeCategories
    .map(c => `${c.id}: ${c.name} (${c.group})`)
    .join('\n');

  return `${profileBlock}
${contextBlock}

לסיווג:
${txLines}

קטגוריות הוצאה:
${expCatList}

קטגוריות הכנסה:
${incCatList}

החזר JSON:
{"classifications":[{"transaction_index":0,"category_name":"שם","expense_type":"fixed|variable|special","is_credit_charge":false,"is_refund":false,"confidence":0.95,"reasoning":"סיבה קצרה"}]}`;
}
