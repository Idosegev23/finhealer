/**
 * Learning Engine - מנוע למידה אוטומטית לסיווג תנועות
 * 
 * לוגיקה:
 * - confidence >= 90% → סיווג אוטומטי (לא שואלים)
 * - confidence 70-89% → מציעים + שואלים
 * - confidence < 70% → שואלים בלי הצעה
 * 
 * כל אישור מעלה את ה-confidence ב-10%
 * כל תיקון מוריד ל-50%
 */

import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface UserPattern {
  id: string;
  user_id: string;
  pattern_type: string;
  pattern_key: string;  // e.g., vendor name normalized
  pattern_value: {
    category_id?: string;
    category_name?: string;
    is_recurring?: boolean;
    typical_amount?: number;
  };
  confidence_score: number;
  learned_from_count: number;
  last_seen: string;
  auto_apply: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassificationSuggestion {
  vendorKey: string;
  categoryId: string;
  categoryName: string;
  confidence: number;
  shouldAutoApply: boolean;
  learnedCount: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  description?: string;
  vendor?: string;
  category_id?: string;
  type: 'income' | 'expense';
  status: string;
}

// ============================================================================
// Constants
// ============================================================================

const AUTO_CLASSIFY_THRESHOLD = 0.90;  // 90% - סיווג אוטומטי
const SUGGEST_THRESHOLD = 0.70;         // 70% - הצעה
const CONFIDENCE_INCREMENT = 0.10;      // +10% לכל אישור
const CONFIDENCE_ON_CORRECTION = 0.50;  // 50% אחרי תיקון
const MIN_COUNT_FOR_AUTO = 3;           // מינימום 3 אישורים לסיווג אוטומטי

// ============================================================================
// Vendor Normalization
// ============================================================================

/**
 * נרמול שם ספק לצורך התאמה
 * מסיר רווחים מיותרים, מעביר ל-lowercase, מסיר מספרים וכו'
 */
export function normalizeVendorName(vendor: string): string {
  if (!vendor) return '';
  
  return vendor
    .toLowerCase()
    .trim()
    // הסר מספרים בסוף (כמו "רמי לוי 123")
    .replace(/\s*\d+\s*$/, '')
    // הסר סימנים מיוחדים
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, '')
    // רווחים כפולים
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// Pattern Lookup
// ============================================================================

/**
 * חיפוש pattern קיים לספק
 */
export async function findPatternForVendor(
  userId: string,
  vendor: string
): Promise<UserPattern | null> {
  const supabase = createServiceClient();
  const normalizedVendor = normalizeVendorName(vendor);
  
  if (!normalizedVendor) return null;
  
  const { data, error } = await supabase
    .from('user_patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('pattern_type', 'vendor_category')
    .eq('pattern_key', normalizedVendor)
    .single();
  
  if (error || !data) return null;
  
  return data as UserPattern;
}

/**
 * קבלת הצעת סיווג לספק
 */
export async function getSuggestionForVendor(
  userId: string,
  vendor: string
): Promise<ClassificationSuggestion | null> {
  const pattern = await findPatternForVendor(userId, vendor);
  
  if (!pattern) return null;
  
  const shouldAutoApply = 
    pattern.confidence_score >= AUTO_CLASSIFY_THRESHOLD &&
    pattern.learned_from_count >= MIN_COUNT_FOR_AUTO &&
    pattern.auto_apply;
  
  return {
    vendorKey: pattern.pattern_key,
    categoryId: pattern.pattern_value.category_id || '',
    categoryName: pattern.pattern_value.category_name || '',
    confidence: pattern.confidence_score,
    shouldAutoApply,
    learnedCount: pattern.learned_from_count,
  };
}

/**
 * קבלת כל הדפוסים של משתמש
 */
export async function getAllUserPatterns(userId: string): Promise<UserPattern[]> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('user_patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('pattern_type', 'vendor_category')
    .order('confidence_score', { ascending: false });
  
  if (error) {
    console.error('Error fetching patterns:', error);
    return [];
  }
  
  return data as UserPattern[];
}

// ============================================================================
// Learning Functions
// ============================================================================

/**
 * למידה מאישור סיווג
 * נקרא כשמשתמש מאשר סיווג (גם הצעה וגם חדש)
 */
export async function learnFromConfirmation(
  userId: string,
  vendor: string,
  categoryId: string,
  categoryName: string
): Promise<void> {
  const supabase = createServiceClient();
  const normalizedVendor = normalizeVendorName(vendor);
  
  if (!normalizedVendor || !categoryId) return;
  
  // בדוק אם יש pattern קיים
  const existingPattern = await findPatternForVendor(userId, vendor);
  
  if (existingPattern) {
    // עדכון pattern קיים
    const isSameCategory = existingPattern.pattern_value.category_id === categoryId;
    
    const newConfidence = isSameCategory
      ? Math.min(1.0, existingPattern.confidence_score + CONFIDENCE_INCREMENT)
      : CONFIDENCE_ON_CORRECTION;  // תיקון - הורדה ל-50%
    
    const newCount = isSameCategory
      ? existingPattern.learned_from_count + 1
      : 1;  // תיקון - התחלה מחדש
    
    // כאשר confidence מספיק גבוה וcount מספיק, הפעל auto_apply
    const shouldAutoApply = 
      newConfidence >= AUTO_CLASSIFY_THRESHOLD && 
      newCount >= MIN_COUNT_FOR_AUTO;
    
    await supabase
      .from('user_patterns')
      .update({
        pattern_value: {
          category_id: categoryId,
          category_name: categoryName,
        },
        confidence_score: newConfidence,
        learned_from_count: newCount,
        auto_apply: shouldAutoApply,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingPattern.id);
  } else {
    // יצירת pattern חדש
    await supabase
      .from('user_patterns')
      .insert({
        user_id: userId,
        pattern_type: 'vendor_category',
        pattern_key: normalizedVendor,
        pattern_value: {
          category_id: categoryId,
          category_name: categoryName,
        },
        confidence_score: 0.60,  // מתחילים ב-60%
        learned_from_count: 1,
        auto_apply: false,  // עדיין לא אוטומטי
        last_seen: new Date().toISOString(),
      });
  }
}

/**
 * למידה מתיקון (המשתמש אמר שהסיווג שגוי)
 */
export async function learnFromCorrection(
  userId: string,
  vendor: string,
  correctCategoryId: string,
  correctCategoryName: string
): Promise<void> {
  const supabase = createServiceClient();
  const normalizedVendor = normalizeVendorName(vendor);
  
  if (!normalizedVendor || !correctCategoryId) return;
  
  const existingPattern = await findPatternForVendor(userId, vendor);
  
  if (existingPattern) {
    // תיקון - נרסט את ה-confidence ל-50%
    await supabase
      .from('user_patterns')
      .update({
        pattern_value: {
          category_id: correctCategoryId,
          category_name: correctCategoryName,
        },
        confidence_score: CONFIDENCE_ON_CORRECTION,
        learned_from_count: 1,
        auto_apply: false,  // ביטול סיווג אוטומטי
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingPattern.id);
  } else {
    // יצירת pattern חדש עם ה-category הנכון
    await learnFromConfirmation(userId, vendor, correctCategoryId, correctCategoryName);
  }
}

/**
 * מחיקת pattern (לבקשת משתמש)
 */
export async function deletePattern(
  userId: string,
  vendor: string
): Promise<boolean> {
  const supabase = createServiceClient();
  const normalizedVendor = normalizeVendorName(vendor);
  
  const { error } = await supabase
    .from('user_patterns')
    .delete()
    .eq('user_id', userId)
    .eq('pattern_type', 'vendor_category')
    .eq('pattern_key', normalizedVendor);
  
  return !error;
}

// ============================================================================
// Auto-Classification
// ============================================================================

/**
 * סיווג אוטומטי של תנועות
 * מחזיר את התנועות שסווגו אוטומטית
 */
export async function autoClassifyTransactions(
  userId: string,
  transactions: Transaction[]
): Promise<{
  autoClassified: Array<{
    transaction: Transaction;
    categoryId: string;
    categoryName: string;
    confidence: number;
  }>;
  needsClassification: Transaction[];
  suggestions: Map<string, ClassificationSuggestion>;
}> {
  const autoClassified: Array<{
    transaction: Transaction;
    categoryId: string;
    categoryName: string;
    confidence: number;
  }> = [];
  
  const needsClassification: Transaction[] = [];
  const suggestions = new Map<string, ClassificationSuggestion>();
  
  // טען את כל ה-patterns של המשתמש מראש
  const patterns = await getAllUserPatterns(userId);
  const patternMap = new Map<string, UserPattern>();
  for (const p of patterns) {
    patternMap.set(p.pattern_key, p);
  }
  
  for (const tx of transactions) {
    if (!tx.vendor) {
      needsClassification.push(tx);
      continue;
    }
    
    const normalizedVendor = normalizeVendorName(tx.vendor);
    const pattern = patternMap.get(normalizedVendor);
    
    if (!pattern) {
      // אין pattern - צריך לשאול
      needsClassification.push(tx);
      continue;
    }
    
    const suggestion: ClassificationSuggestion = {
      vendorKey: pattern.pattern_key,
      categoryId: pattern.pattern_value.category_id || '',
      categoryName: pattern.pattern_value.category_name || '',
      confidence: pattern.confidence_score,
      shouldAutoApply: 
        pattern.confidence_score >= AUTO_CLASSIFY_THRESHOLD &&
        pattern.learned_from_count >= MIN_COUNT_FOR_AUTO &&
        pattern.auto_apply,
      learnedCount: pattern.learned_from_count,
    };
    
    suggestions.set(tx.id, suggestion);
    
    if (suggestion.shouldAutoApply) {
      // סיווג אוטומטי!
      autoClassified.push({
        transaction: tx,
        categoryId: suggestion.categoryId,
        categoryName: suggestion.categoryName,
        confidence: suggestion.confidence,
      });
    } else {
      // יש הצעה אבל צריך לשאול
      needsClassification.push(tx);
    }
  }
  
  return { autoClassified, needsClassification, suggestions };
}

/**
 * החלת סיווגים אוטומטיים בפועל
 */
export async function applyAutoClassifications(
  userId: string,
  classifications: Array<{
    transactionId: string;
    categoryId: string;
  }>
): Promise<number> {
  const supabase = createServiceClient();
  let successCount = 0;
  
  for (const { transactionId, categoryId } of classifications) {
    const { error } = await supabase
      .from('transactions')
      .update({
        category_id: categoryId,
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId)
      .eq('user_id', userId);
    
    if (!error) successCount++;
  }
  
  return successCount;
}

// ============================================================================
// Bulk Classification Summary
// ============================================================================

/**
 * קבלת סיכום לסיווג מרוכז
 * מקבץ תנועות לפי vendor עם confidence גבוה
 */
export async function getBulkClassificationSummary(
  userId: string,
  transactions: Transaction[]
): Promise<{
  bulkGroups: Array<{
    vendor: string;
    categoryName: string;
    categoryId: string;
    transactions: Transaction[];
    count: number;
    totalAmount: number;
    confidence: number;
  }>;
  individualTransactions: Transaction[];
}> {
  const { autoClassified, needsClassification, suggestions } = 
    await autoClassifyTransactions(userId, transactions);
  
  // קבץ את ה-auto-classified לפי vendor
  const vendorGroups = new Map<string, {
    vendor: string;
    categoryName: string;
    categoryId: string;
    transactions: Transaction[];
    totalAmount: number;
    confidence: number;
  }>();
  
  for (const item of autoClassified) {
    const key = normalizeVendorName(item.transaction.vendor || '');
    const existing = vendorGroups.get(key);
    
    if (existing) {
      existing.transactions.push(item.transaction);
      existing.totalAmount += item.transaction.amount;
    } else {
      vendorGroups.set(key, {
        vendor: item.transaction.vendor || '',
        categoryName: item.categoryName,
        categoryId: item.categoryId,
        transactions: [item.transaction],
        totalAmount: item.transaction.amount,
        confidence: item.confidence,
      });
    }
  }
  
  // המר לרשימה עם count
  const bulkGroups = Array.from(vendorGroups.values())
    .map(g => ({
      ...g,
      count: g.transactions.length,
    }))
    .filter(g => g.count >= 1)  // לפחות תנועה אחת
    .sort((a, b) => b.count - a.count);
  
  return {
    bulkGroups,
    individualTransactions: needsClassification,
  };
}

// ============================================================================
// Format Messages
// ============================================================================

/**
 * יצירת הודעת סיכום סיווג אוטומטי
 */
export function formatAutoClassificationMessage(
  bulkGroups: Array<{
    vendor: string;
    categoryName: string;
    count: number;
    totalAmount: number;
  }>
): string {
  if (bulkGroups.length === 0) return '';
  
  const lines: string[] = ['✅ *סיווגתי אוטומטית:*\n'];
  
  for (const group of bulkGroups) {
    const amountStr = group.totalAmount.toLocaleString('he-IL');
    lines.push(`• ${group.count} תנועות ב*${group.vendor}* (${amountStr} ₪) → *${group.categoryName}*`);
  }
  
  lines.push('\nרוצה לשנות משהו? כתוב "תקן [שם ספק]"');
  
  return lines.join('\n');
}

