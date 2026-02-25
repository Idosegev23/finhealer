/**
 * Period Tracker - מעקב אחרי תקופות שנסרקו
 * 
 * מוודא שיש לנו לפחות 3 חודשים של נתונים
 * תומך בקבלת מספר קבצים (1, 2 או 3)
 */

import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface DocumentPeriod {
  start: Date;
  end: Date;
  source: 'bank' | 'credit' | 'payslip' | 'other';
  documentType: string;
  fileName?: string;
  uploadedAt: Date;
}

export interface PeriodCoverage {
  totalMonths: number;
  coveredMonths: string[];  // ["2024-09", "2024-10", "2024-11"]
  missingMonths: string[];
  hasMinimumCoverage: boolean;  // true if >= 3 months
  periods: DocumentPeriod[];
  gaps: Array<{ from: string; to: string }>;
}

export interface UploadedDocument {
  id: string;
  userId: string;
  documentType: string;
  fileName: string;
  periodStart: Date;
  periodEnd: Date;
  transactionsCount: number;
  uploadedAt: Date;
}

// ============================================================================
// Period Extraction from OCR Data
// ============================================================================

/**
 * חילוץ תקופה מתוצאות ה-OCR
 * 
 * שלבי זיהוי:
 * 1. מנסה לקחת מ-report_info (ה-AI חילץ מכותרת הדוח)
 * 2. אם אין - מחשב מהתנועות עצמן (תאריך ראשון עד אחרון)
 */
export function extractPeriodFromOCR(ocrData: any): { start: Date | null; end: Date | null } {
  try {
    const reportInfo = ocrData.report_info || ocrData.reportInfo || {};
    
    // נסה למצוא תקופה מ-report_info (מכותרת הדוח)
    let start = reportInfo.period_start || reportInfo.periodStart;
    let end = reportInfo.period_end || reportInfo.periodEnd;
    let source = 'report_info';
    
    // אם אין - נסה לחשב מהתנועות
    if (!start || !end) {
      source = 'transactions';
      const transactions = getAllTransactions(ocrData);
      
      if (transactions.length > 0) {
        const dates = transactions
          .map(tx => tx.date)
          .filter(d => d)
          .map(d => new Date(d))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());
        
        if (dates.length > 0) {
          start = dates[0].toISOString().split('T')[0];
          end = dates[dates.length - 1].toISOString().split('T')[0];
        }
      }
    }
    
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    
    console.log(`[PeriodTracker] 📅 Period extracted from ${source}:`, {
      start: startDate?.toISOString().split('T')[0] || 'none',
      end: endDate?.toISOString().split('T')[0] || 'none',
    });
    
    return { start: startDate, end: endDate };
  } catch (error) {
    console.error('[PeriodTracker] Error extracting period:', error);
    return { start: null, end: null };
  }
}

/**
 * קבלת כל התנועות מהOCR
 */
function getAllTransactions(ocrData: any): any[] {
  // מבנה דוח בנק
  if (ocrData.transactions?.income || ocrData.transactions?.expenses) {
    return [
      ...(ocrData.transactions.income || []),
      ...(ocrData.transactions.expenses || []),
      ...(ocrData.transactions.loan_payments || []),
      ...(ocrData.transactions.savings_transfers || []),
    ];
  }
  
  // מבנה דוח אשראי (array ישיר)
  if (Array.isArray(ocrData.transactions)) {
    return ocrData.transactions;
  }
  
  return [];
}

// ============================================================================
// Coverage Calculation
// ============================================================================

/**
 * חישוב כיסוי תקופות
 */
export function calculateCoverage(periods: DocumentPeriod[]): PeriodCoverage {
  if (periods.length === 0) {
    return {
      totalMonths: 0,
      coveredMonths: [],
      missingMonths: getLastNMonths(3),
      hasMinimumCoverage: false,
      periods: [],
      gaps: [],
    };
  }
  
  // מצא את כל החודשים המכוסים
  const coveredSet = new Set<string>();
  
  for (const period of periods) {
    const months = getMonthsBetween(period.start, period.end);
    months.forEach(m => coveredSet.add(m));
  }
  
  const coveredMonths = Array.from(coveredSet).sort();
  
  // בדוק אילו חודשים חסרים מ-3 החודשים האחרונים
  const lastThreeMonths = getLastNMonths(3);
  const missingMonths = lastThreeMonths.filter(m => !coveredSet.has(m));
  
  // מצא פערים
  const gaps = findGaps(coveredMonths);
  
  return {
    totalMonths: coveredMonths.length,
    coveredMonths,
    missingMonths,
    hasMinimumCoverage: coveredMonths.length >= 3,
    periods,
    gaps,
  };
}

/**
 * קבלת N החודשים האחרונים בפורמט YYYY-MM
 */
function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  
  return months.reverse();
}

/**
 * קבלת כל החודשים בין שתי תאריכים
 */
function getMonthsBetween(start: Date, end: Date): string[] {
  const months: string[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  
  while (current <= endMonth) {
    months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
}

/**
 * מציאת פערים בין חודשים
 */
function findGaps(sortedMonths: string[]): Array<{ from: string; to: string }> {
  const gaps: Array<{ from: string; to: string }> = [];
  
  for (let i = 1; i < sortedMonths.length; i++) {
    const prev = new Date(sortedMonths[i - 1] + '-01');
    const curr = new Date(sortedMonths[i] + '-01');
    
    // אם יש יותר מחודש אחד הפרש
    const monthDiff = (curr.getFullYear() - prev.getFullYear()) * 12 + 
                      (curr.getMonth() - prev.getMonth());
    
    if (monthDiff > 1) {
      gaps.push({
        from: sortedMonths[i - 1],
        to: sortedMonths[i],
      });
    }
  }
  
  return gaps;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * שמירת/עדכון תקופה למסמך קיים ב-uploaded_statements
 */
export async function updateDocumentPeriod(
  documentId: string,
  periodStart: Date,
  periodEnd: Date,
  transactionsCount: number
): Promise<boolean> {
  const supabase = createServiceClient();
  
  const { error } = await supabase
    .from('uploaded_statements')
    .update({
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      transactions_extracted: transactionsCount,
    })
    .eq('id', documentId);
  
  if (error) {
    console.error('[PeriodTracker] Error updating document period:', error);
    return false;
  }
  
  return true;
}

/**
 * קבלת כל המסמכים שהועלו למשתמש (מ-uploaded_statements)
 */
export async function getUserUploadedDocuments(userId: string): Promise<UploadedDocument[]> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('uploaded_statements')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['completed', 'processed'])
    .not('period_start', 'is', null)
    .not('period_end', 'is', null)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[PeriodTracker] Error getting documents:', error);
    return [];
  }
  
  return (data || []).map(d => ({
    id: d.id,
    userId: d.user_id,
    documentType: d.document_type || d.file_type || 'bank',
    fileName: d.file_name,
    periodStart: new Date(d.period_start),
    periodEnd: new Date(d.period_end),
    transactionsCount: d.transactions_extracted || 0,
    uploadedAt: new Date(d.created_at),
  }));
}

/**
 * קבלת כיסוי התקופות למשתמש
 */
export async function getUserPeriodCoverage(userId: string): Promise<PeriodCoverage> {
  const documents = await getUserUploadedDocuments(userId);
  
  const periods: DocumentPeriod[] = documents.map(d => ({
    start: d.periodStart,
    end: d.periodEnd,
    source: d.documentType.includes('credit') ? 'credit' : 
            d.documentType.includes('payslip') ? 'payslip' : 'bank',
    documentType: d.documentType,
    fileName: d.fileName,
    uploadedAt: d.uploadedAt,
  }));
  
  return calculateCoverage(periods);
}

// ============================================================================
// User-Friendly Messages
// ============================================================================

/**
 * יצירת הודעה על הכיסוי
 */
export function getCoverageMessage(coverage: PeriodCoverage): string {
  if (coverage.hasMinimumCoverage) {
    return `✅ יש לי ${coverage.totalMonths} חודשים של נתונים - מעולה!

📅 תקופה: ${formatMonth(coverage.coveredMonths[0])} עד ${formatMonth(coverage.coveredMonths[coverage.coveredMonths.length - 1])}`;
  }
  
  const missing = coverage.missingMonths.length;
  const missingText = coverage.missingMonths.map(formatMonth).join(', ');
  
  return `📊 יש לי ${coverage.totalMonths} חודש${coverage.totalMonths !== 1 ? 'ים' : ''} של נתונים.

⚠️ לתמונה מלאה אני צריך לפחות 3 חודשים.

📅 חסר: ${missingText}

💡 שלח לי דוח נוסף שמכסה את התקופה החסרה.`;
}

/**
 * יצירת בקשה למסמך חסר
 */
export function getMissingDocumentRequest(coverage: PeriodCoverage, documentType: string): string {
  if (coverage.missingMonths.length === 0) {
    return '';
  }
  
  const typeHebrew = {
    bank: 'דוח עו"ש',
    credit: 'פירוט כרטיס אשראי',
    payslip: 'תלוש משכורת',
  }[documentType] || 'מסמך';
  
  const missingText = coverage.missingMonths.map(formatMonth).join(', ');
  
  return `📄 כדי להשלים את התמונה, אני צריך ${typeHebrew} של: ${missingText}

יש לך?`;
}

/**
 * פורמט חודש לעברית
 */
function formatMonth(monthStr: string): string {
  const hebrewMonths = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  
  const [year, month] = monthStr.split('-');
  const monthIndex = parseInt(month) - 1;
  
  return `${hebrewMonths[monthIndex]} ${year}`;
}

// ============================================================================
// Duplicate Detection
// ============================================================================

export interface DuplicateCheckResult {
  isDuplicate: boolean;           // true if >80% overlap
  hasPartialOverlap: boolean;     // true if 30-80% overlap
  overlapPercent: number;
  overlappingPeriod?: string;
  overlappingTransactions: number;
}

/**
 * בדיקת כפילויות - האם תנועות אלו כבר קיימות במערכת?
 */
export async function checkForDuplicateTransactions(
  userId: string,
  newTransactions: any[]
): Promise<DuplicateCheckResult> {
  const supabase = createServiceClient();
  
  if (!newTransactions || newTransactions.length === 0) {
    return {
      isDuplicate: false,
      hasPartialOverlap: false,
      overlapPercent: 0,
      overlappingTransactions: 0,
    };
  }
  
  // יצירת hashes לתנועות החדשות
  const newHashes = newTransactions.map(tx => generateTransactionHash(tx));
  
  // חילוץ תקופה מהתנועות החדשות
  const dates = newTransactions
    .map(tx => tx.date)
    .filter(d => d)
    .sort();
  
  const periodStart = dates[0];
  const periodEnd = dates[dates.length - 1];
  
  // חיפוש תנועות קיימות באותה תקופה
  const { data: existingTransactions } = await supabase
    .from('transactions')
    .select('id, tx_date, amount, vendor, original_description')
    .eq('user_id', userId)
    .gte('tx_date', periodStart)
    .lte('tx_date', periodEnd)
    .limit(500);
  
  if (!existingTransactions || existingTransactions.length === 0) {
    return {
      isDuplicate: false,
      hasPartialOverlap: false,
      overlapPercent: 0,
      overlappingTransactions: 0,
    };
  }
  
  // יצירת hashes לתנועות קיימות
  const existingHashes = existingTransactions.map(tx => 
    generateTransactionHash({
      date: tx.tx_date,
      amount: tx.amount,
      vendor: tx.vendor,
      description: tx.original_description,
    })
  );
  
  // חישוב חפיפה
  const overlapping = newHashes.filter(hash => existingHashes.includes(hash));
  const overlapPercent = Math.round((overlapping.length / newHashes.length) * 100);
  
  console.log(`[DuplicateCheck] Found ${overlapping.length}/${newHashes.length} overlapping transactions (${overlapPercent}%)`);
  
  return {
    isDuplicate: overlapPercent > 80,
    hasPartialOverlap: overlapPercent >= 30 && overlapPercent <= 80,
    overlapPercent,
    overlappingPeriod: periodStart && periodEnd ? `${formatDateShort(periodStart)} - ${formatDateShort(periodEnd)}` : undefined,
    overlappingTransactions: overlapping.length,
  };
}

/**
 * יצירת hash לתנועה (לזיהוי כפילויות)
 */
function generateTransactionHash(tx: any): string {
  const date = tx.date || '';
  const amount = Math.abs(tx.amount || 0).toFixed(2);
  const vendor = (tx.vendor || '').toLowerCase().trim();
  const desc = (tx.description || tx.original_description || '').toLowerCase().trim().substring(0, 30);
  
  return `${date}|${amount}|${vendor}|${desc}`;
}

/**
 * פורמט תאריך קצר
 */
function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  extractPeriodFromOCR,
  calculateCoverage,
  updateDocumentPeriod,
  getUserUploadedDocuments,
  getUserPeriodCoverage,
  getCoverageMessage,
  getMissingDocumentRequest,
  checkForDuplicateTransactions,
};

