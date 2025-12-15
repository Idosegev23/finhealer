/**
 * Recurring Detector - זיהוי הוצאות קבועות אוטומטי
 * 
 * זיהוי:
 * - אותו סכום (+/- 5%)
 * - אותו vendor
 * - מופיע 2+ חודשים ברצף
 */

import { createServiceClient } from '@/lib/supabase/server';
import { normalizeVendorName } from './learning-engine';

// ============================================================================
// Types
// ============================================================================

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  vendor?: string;
  type: 'income' | 'expense';
  tx_date: string;
  is_recurring?: boolean;
}

export interface RecurringCandidate {
  vendorName: string;
  normalizedVendor: string;
  averageAmount: number;
  occurrences: number;
  months: string[];  // ['2025-10', '2025-11']
  transactions: Transaction[];
  type: 'income' | 'expense';
  confidence: number;
  frequency: 'monthly' | 'bi-monthly' | 'quarterly';
}

export interface RecurringDetectionResult {
  detected: RecurringCandidate[];
  alreadyMarked: Transaction[];
  total: number;
}

// ============================================================================
// Constants
// ============================================================================

const AMOUNT_TOLERANCE = 0.05;  // 5% סטיית סכום מותרת
const MIN_OCCURRENCES = 2;       // מינימום 2 הופעות
const HIGH_CONFIDENCE_OCCURRENCES = 3;  // 3+ = confidence גבוה

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * זיהוי הוצאות קבועות מתוך רשימת תנועות
 */
export function detectRecurringTransactions(
  transactions: Transaction[]
): RecurringCandidate[] {
  // קבץ לפי vendor
  const vendorGroups = new Map<string, Transaction[]>();
  
  for (const tx of transactions) {
    if (!tx.vendor) continue;
    
    const key = normalizeVendorName(tx.vendor);
    if (!key) continue;
    
    const existing = vendorGroups.get(key) || [];
    existing.push(tx);
    vendorGroups.set(key, existing);
  }
  
  const candidates: RecurringCandidate[] = [];
  
  for (const [normalizedVendor, txs] of Array.from(vendorGroups.entries())) {
    // צריך לפחות 2 תנועות
    if (txs.length < MIN_OCCURRENCES) continue;
    
    // בדוק אם הסכומים דומים
    const amounts = txs.map((tx: Transaction) => tx.amount);
    const avgAmount = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
    
    // כל הסכומים צריכים להיות בטווח של 5% מהממוצע
    const allSimilar = amounts.every((amt: number) => 
      Math.abs(amt - avgAmount) / avgAmount <= AMOUNT_TOLERANCE
    );
    
    if (!allSimilar) continue;
    
    // בדוק באילו חודשים מופיע
    const months = new Set<string>();
    for (const tx of txs) {
      const date = new Date(tx.tx_date);
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    
    // צריך לפחות 2 חודשים שונים
    if (months.size < MIN_OCCURRENCES) continue;
    
    // חשב תדירות
    const frequency = detectFrequency(Array.from(months).sort());
    
    // חשב confidence
    const confidence = calculateRecurringConfidence(months.size, allSimilar);
    
    candidates.push({
      vendorName: txs[0].vendor!,
      normalizedVendor,
      averageAmount: Math.round(avgAmount * 100) / 100,
      occurrences: months.size,
      months: Array.from(months).sort(),
      transactions: txs,
      type: txs[0].type,
      confidence,
      frequency,
    });
  }
  
  // מיון לפי confidence (יורד)
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * זיהוי תדירות
 */
function detectFrequency(sortedMonths: string[]): 'monthly' | 'bi-monthly' | 'quarterly' {
  if (sortedMonths.length < 2) return 'monthly';
  
  // חשב הפרשים בין חודשים
  const gaps: number[] = [];
  for (let i = 1; i < sortedMonths.length; i++) {
    const [y1, m1] = sortedMonths[i - 1].split('-').map(Number);
    const [y2, m2] = sortedMonths[i].split('-').map(Number);
    const monthsDiff = (y2 - y1) * 12 + (m2 - m1);
    gaps.push(monthsDiff);
  }
  
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  
  if (avgGap <= 1.5) return 'monthly';
  if (avgGap <= 2.5) return 'bi-monthly';
  return 'quarterly';
}

/**
 * חישוב confidence
 */
function calculateRecurringConfidence(
  occurrences: number,
  amountsSimilar: boolean
): number {
  let confidence = 0.5;  // בסיס
  
  if (amountsSimilar) confidence += 0.2;
  
  if (occurrences >= HIGH_CONFIDENCE_OCCURRENCES) {
    confidence += 0.25;
  } else if (occurrences >= MIN_OCCURRENCES) {
    confidence += 0.15;
  }
  
  return Math.min(0.95, confidence);
}

// ============================================================================
// Database Functions
// ============================================================================

/**
 * זיהוי הוצאות קבועות למשתמש
 */
export async function detectUserRecurringExpenses(
  userId: string
): Promise<RecurringDetectionResult> {
  const supabase = createServiceClient();
  
  // שלוף תנועות מ-3 חודשים אחרונים
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, user_id, amount, vendor, type, tx_date, is_recurring')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .gte('tx_date', threeMonthsAgo.toISOString().split('T')[0])
    .order('tx_date', { ascending: false });
  
  if (error) {
    console.error('Error fetching transactions:', error);
    return { detected: [], alreadyMarked: [], total: 0 };
  }
  
  const allTxs = transactions as Transaction[];
  const alreadyMarked = allTxs.filter(tx => tx.is_recurring);
  const notMarked = allTxs.filter(tx => !tx.is_recurring);
  
  const detected = detectRecurringTransactions(notMarked);
  
  return {
    detected,
    alreadyMarked,
    total: allTxs.length,
  };
}

/**
 * סימון תנועות כקבועות
 */
export async function markAsRecurring(
  userId: string,
  transactionIds: string[]
): Promise<{ success: boolean; count: number }> {
  const supabase = createServiceClient();
  
  const { error } = await supabase
    .from('transactions')
    .update({ 
      is_recurring: true,
      updated_at: new Date().toISOString(),
    })
    .in('id', transactionIds)
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error marking as recurring:', error);
    return { success: false, count: 0 };
  }
  
  return { success: true, count: transactionIds.length };
}

/**
 * ביטול סימון כהוצאה קבועה
 */
export async function unmarkAsRecurring(
  userId: string,
  transactionIds: string[]
): Promise<{ success: boolean; count: number }> {
  const supabase = createServiceClient();
  
  const { error } = await supabase
    .from('transactions')
    .update({ 
      is_recurring: false,
      updated_at: new Date().toISOString(),
    })
    .in('id', transactionIds)
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error unmarking as recurring:', error);
    return { success: false, count: 0 };
  }
  
  return { success: true, count: transactionIds.length };
}

// ============================================================================
// Message Formatting
// ============================================================================

/**
 * יצירת הודעה על הוצאות קבועות שזוהו
 */
export function formatRecurringDetectionMessage(
  candidates: RecurringCandidate[]
): string {
  if (candidates.length === 0) {
    return '';
  }
  
  const lines: string[] = ['🔄 *זיהיתי הוצאות שנראות קבועות:*\n'];
  
  for (const candidate of candidates.slice(0, 5)) {
    const amountStr = candidate.averageAmount.toLocaleString('he-IL');
    const freqText = 
      candidate.frequency === 'monthly' ? 'חודשי' :
      candidate.frequency === 'bi-monthly' ? 'דו-חודשי' : 'רבעוני';
    
    lines.push(
      `• *${candidate.vendorName}* - ${amountStr} ₪/${freqText}\n` +
      `  (${candidate.occurrences} הופעות, ${Math.round(candidate.confidence * 100)}% ביטחון)`
    );
  }
  
  if (candidates.length > 5) {
    lines.push(`\n...ועוד ${candidates.length - 5}`);
  }
  
  lines.push('\nלסמן כהוצאות קבועות? כתוב "כן" או "לא"');
  
  return lines.join('\n');
}

/**
 * הודעה קצרה על הוצאה קבועה בודדת
 */
export function formatSingleRecurringQuestion(
  candidate: RecurringCandidate
): string {
  const amountStr = candidate.averageAmount.toLocaleString('he-IL');
  
  return (
    `🔄 שמתי לב ש*${candidate.vendorName}* (${amountStr} ₪) מופיעה כל חודש.\n` +
    `לסמן כהוצאה קבועה? כן/לא`
  );
}

