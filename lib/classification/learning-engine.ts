/**
 * Learning Engine v3.1 — מנוע למידה אוטומטית לסיווג תנועות
 *
 * לוגיקה:
 * - confidence >= 70% → סיווג אוטומטי (לא שואלים)
 * - confidence 50-69% → מציעים + שואלים
 * - confidence < 50% → שואלים בלי הצעה
 *
 * כל אישור מעלה את ה-confidence ב-10%
 * תיקון ידני = confidence 85% (המשתמש אמר מפורש מה זה)
 * AI classification ראשוני = 75%
 *
 * Financial Signature: vendor + amount range כמפתח
 * "מגדל|small" (189₪) ≠ "מגדל|xlarge" (1,200₪)
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

const AUTO_CLASSIFY_THRESHOLD = 0.70;  // 70% - סיווג אוטומטי (was 90%)
const SUGGEST_THRESHOLD = 0.50;         // 50% - הצעה (was 70%)
const CONFIDENCE_INCREMENT = 0.10;      // +10% לכל אישור
const CONFIDENCE_ON_CORRECTION = 0.85;  // 85% אחרי תיקון ידני (was 50% — user explicitly said what it is!)
const CONFIDENCE_ON_FIRST_CLASSIFY = 0.75; // 75% כשAI סיווג בפעם הראשונה
const MIN_COUNT_FOR_AUTO = 1;           // מינימום 1 אישור לסיווג אוטומטי (was 3)

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
      : CONFIDENCE_ON_CORRECTION;  // תיקון ידני = 85% (המשתמש אמר מפורש)
    
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
        confidence_score: CONFIDENCE_ON_FIRST_CLASSIFY,  // 75% — AI classified
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

// ============================================================================
// v3.1: Financial Signature
// ============================================================================

/**
 * Creates a financial signature: vendor + amount range.
 * "מגדל|small" (189₪ = ביטוח בריאות) ≠ "מגדל|xlarge" (1,200₪ = פנסיה)
 */
export function getAmountRange(amount: number): string {
  const abs = Math.abs(amount);
  if (abs <= 50) return 'micro';
  if (abs <= 200) return 'small';
  if (abs <= 500) return 'medium';
  if (abs <= 1000) return 'large';
  if (abs <= 3000) return 'xlarge';
  return 'jumbo';
}

export function getFinancialSignature(vendor: string, amount: number): string {
  return `${normalizeVendorName(vendor)}|${getAmountRange(amount)}`;
}

// ============================================================================
// v3.1: Financial DNA
// ============================================================================

export interface FinancialDNAEntry {
  category: string;
  vendor: string | string[];
  amount: number;       // average
  amount_min: number;
  amount_max: number;
  day: number | number[]; // typical day(s) of month
  frequency: 'monthly' | 'weekly' | 'quarterly' | 'irregular';
  occurrences: number;
}

export type FinancialDNA = Record<string, FinancialDNAEntry>;

/**
 * Build Financial DNA from 3+ months of confirmed transactions.
 * Returns a template of recurring financial patterns.
 */
export async function buildFinancialDNA(userId: string): Promise<FinancialDNA> {
  const supabase = createServiceClient();

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const { data: transactions } = await supabase
    .from('transactions')
    .select('vendor, amount, tx_date, expense_category, income_category, category, type')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .or('is_summary.is.null,is_summary.eq.false')
    .gte('tx_date', threeMonthsAgo.toISOString().split('T')[0])
    .order('tx_date', { ascending: false });

  if (!transactions || transactions.length < 10) return {};

  // Group by vendor (normalized)
  const groups = new Map<string, Array<{ amount: number; day: number; month: string; category: string }>>();

  for (const tx of transactions) {
    if (!tx.vendor) continue;
    const key = normalizeVendorName(tx.vendor);
    if (!key) continue;

    const date = new Date(tx.tx_date);
    const entry = {
      amount: Math.abs(Number(tx.amount)),
      day: date.getDate(),
      month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      category: tx.expense_category || tx.income_category || tx.category || '',
    };

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  const dna: FinancialDNA = {};

  for (const [vendorKey, entries] of Array.from(groups.entries())) {
    // Need at least 2 occurrences across different months
    const uniqueMonths = new Set(entries.map(e => e.month));
    if (uniqueMonths.size < 2) continue;

    // Check amount consistency (within 20%)
    const amounts = entries.map(e => e.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const allSimilar = amounts.every(a => Math.abs(a - avgAmount) / avgAmount <= 0.20);

    if (!allSimilar && amounts.length < 3) continue; // inconsistent and not enough data

    const days = entries.map(e => e.day);
    const category = entries[0].category;
    const originalVendor = transactions.find(t => normalizeVendorName(t.vendor || '') === vendorKey)?.vendor || vendorKey;

    // Determine frequency
    let frequency: 'monthly' | 'weekly' | 'quarterly' | 'irregular' = 'irregular';
    if (uniqueMonths.size >= 2 && uniqueMonths.size >= entries.length * 0.7) {
      frequency = 'monthly';
    }

    const dnaKey = category || vendorKey;
    dna[dnaKey] = {
      category,
      vendor: originalVendor,
      amount: Math.round(avgAmount),
      amount_min: Math.round(Math.min(...amounts)),
      amount_max: Math.round(Math.max(...amounts)),
      day: days.length <= 3 ? days : [Math.round(days.reduce((a, b) => a + b, 0) / days.length)],
      frequency,
      occurrences: entries.length,
    };
  }

  // Save to user profile
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const ctx = user?.classification_context || {};
  await supabase
    .from('users')
    .update({ classification_context: { ...ctx, financial_dna: dna } })
    .eq('id', userId);

  return dna;
}

/**
 * Match a transaction against Financial DNA.
 * Returns category + high confidence if match found.
 */
export function matchAgainstDNA(
  tx: { vendor?: string; amount?: number },
  dna: FinancialDNA
): { matched: boolean; category?: string; confidence?: number } {
  if (!tx.vendor || !tx.amount || Object.keys(dna).length === 0) {
    return { matched: false };
  }

  const vendorNorm = normalizeVendorName(tx.vendor);
  const amount = Math.abs(Number(tx.amount));

  for (const [, entry] of Object.entries(dna)) {
    // Match vendor (fuzzy)
    const dnaVendors = Array.isArray(entry.vendor) ? entry.vendor : [entry.vendor];
    const vendorMatch = dnaVendors.some(v => {
      const vNorm = normalizeVendorName(v);
      return vNorm === vendorNorm || vNorm.includes(vendorNorm) || vendorNorm.includes(vNorm);
    });

    if (!vendorMatch) continue;

    // Match amount (within ±20%)
    const tolerance = entry.amount * 0.20;
    if (amount >= entry.amount_min - tolerance && amount <= entry.amount_max + tolerance) {
      return {
        matched: true,
        category: entry.category,
        confidence: 0.95,
      };
    }
  }

  return { matched: false };
}

// ============================================================================
// v3.1: Batch Learning
// ============================================================================

/**
 * Learn from a batch of AI classifications.
 * Uses financial signature as pattern key.
 */
export async function learnFromBatchClassification(
  userId: string,
  classifications: Array<{
    vendor: string;
    amount: number;
    category_name: string;
    source: 'dna' | 'rules' | 'hard_rule' | 'personal' | 'ai';
  }>
): Promise<void> {
  const supabase = createServiceClient();

  for (const c of classifications) {
    if (!c.vendor || c.category_name === 'אחר') continue;

    const signature = getFinancialSignature(c.vendor, c.amount);
    const confidence = c.source === 'ai' ? CONFIDENCE_ON_FIRST_CLASSIFY : 0.95;

    // Upsert using financial signature
    await supabase
      .from('user_category_rules')
      .upsert(
        {
          user_id: userId,
          vendor_pattern: signature,
          category: c.category_name,
          confidence,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,vendor_pattern' }
      )
      .select();

    // Also upsert plain vendor name (for backward compat)
    const vendorKey = normalizeVendorName(c.vendor);
    if (vendorKey && vendorKey !== signature) {
      await supabase
        .from('user_category_rules')
        .upsert(
          {
            user_id: userId,
            vendor_pattern: vendorKey,
            category: c.category_name,
            confidence: Math.max(confidence - 0.05, 0.5),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,vendor_pattern' }
        )
        .select();
    }

    // Bug fix #3: Sync to user_patterns for backward compatibility (old flow fallback)
    if (vendorKey) {
      await supabase
        .from('user_patterns')
        .upsert(
          {
            user_id: userId,
            pattern_type: 'vendor_category',
            pattern_key: vendorKey,
            pattern_value: { category_name: c.category_name },
            confidence_score: confidence,
            learned_from_count: 1,
            auto_apply: confidence >= AUTO_CLASSIFY_THRESHOLD,
            last_seen: new Date().toISOString(),
          },
          { onConflict: 'user_id,pattern_type,pattern_key' }
        )
        .select();
    }
  }
}

/**
 * Learn from user correction — high confidence.
 */
export async function learnFromCorrectionV2(
  userId: string,
  vendor: string,
  amount: number,
  oldCategory: string,
  newCategory: string
): Promise<void> {
  const supabase = createServiceClient();
  const signature = getFinancialSignature(vendor, amount);
  const vendorKey = normalizeVendorName(vendor);

  // Old rule: lower confidence
  if (oldCategory && oldCategory !== newCategory) {
    await supabase
      .from('user_category_rules')
      .update({ confidence: 0.50, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('vendor_pattern', signature);
  }

  // New rule: high confidence (user explicitly said)
  await supabase
    .from('user_category_rules')
    .upsert(
      {
        user_id: userId,
        vendor_pattern: signature,
        category: newCategory,
        confidence: CONFIDENCE_ON_CORRECTION,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,vendor_pattern' }
    )
    .select();

  // Also update plain vendor key
  if (vendorKey && vendorKey !== signature) {
    await supabase
      .from('user_category_rules')
      .upsert(
        {
          user_id: userId,
          vendor_pattern: vendorKey,
          category: newCategory,
          confidence: CONFIDENCE_ON_CORRECTION - 0.05,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,vendor_pattern' }
      )
      .select();
  }

  // Bug fix #3: Sync to user_patterns for backward compatibility
  if (vendorKey) {
    await supabase
      .from('user_patterns')
      .upsert(
        {
          user_id: userId,
          pattern_type: 'vendor_category',
          pattern_key: vendorKey,
          pattern_value: { category_name: newCategory },
          confidence_score: CONFIDENCE_ON_CORRECTION,
          learned_from_count: 1,
          auto_apply: true,
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'user_id,pattern_type,pattern_key' }
      )
      .select();
  }
}

