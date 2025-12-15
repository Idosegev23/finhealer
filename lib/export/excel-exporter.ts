/**
 * Excel Exporter - ייצוא נתונים לאקסל
 */

import * as XLSX from 'xlsx';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface DateRange {
  start: Date;
  end: Date;
}

interface Transaction {
  id: string;
  tx_date: string;
  vendor: string | null;
  description: string | null;
  amount: number;
  type: 'income' | 'expense';
  status: string;
  category_name?: string;
  is_recurring?: boolean;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

// ============================================================================
// Data Fetching
// ============================================================================

async function getTransactionsForExport(
  userId: string,
  dateRange?: DateRange
): Promise<Transaction[]> {
  const supabase = createServiceClient();
  
  let query = supabase
    .from('transactions')
    .select(`
      id,
      tx_date,
      vendor,
      description,
      amount,
      type,
      status,
      is_recurring,
      budget_categories (name)
    `)
    .eq('user_id', userId)
    .order('tx_date', { ascending: false });
  
  if (dateRange) {
    query = query
      .gte('tx_date', dateRange.start.toISOString().split('T')[0])
      .lte('tx_date', dateRange.end.toISOString().split('T')[0]);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((tx: any) => ({
    ...tx,
    category_name: tx.budget_categories?.name || '',
  }));
}

async function getCategoriesForExport(userId: string): Promise<Category[]> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('budget_categories')
    .select('id, name, type')
    .eq('user_id', userId)
    .order('name');
  
  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
  
  return data || [];
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * ייצוא תנועות לאקסל
 */
export async function exportTransactionsToExcel(
  userId: string,
  dateRange?: DateRange
): Promise<Buffer> {
  const transactions = await getTransactionsForExport(userId, dateRange);
  
  // המרה לפורמט אקסל
  const excelData = transactions.map(tx => ({
    'תאריך': tx.tx_date,
    'ספק/תיאור': tx.vendor || tx.description || '',
    'סכום': tx.amount,
    'סוג': tx.type === 'income' ? 'הכנסה' : 'הוצאה',
    'קטגוריה': tx.category_name || '',
    'סטטוס': getStatusHebrew(tx.status),
    'קבוע': tx.is_recurring ? 'כן' : 'לא',
  }));
  
  // יצירת workbook
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: תנועות
  const wsTransactions = XLSX.utils.json_to_sheet(excelData);
  
  // עיצוב עמודות
  wsTransactions['!cols'] = [
    { wch: 12 },  // תאריך
    { wch: 30 },  // ספק
    { wch: 12 },  // סכום
    { wch: 8 },   // סוג
    { wch: 15 },  // קטגוריה
    { wch: 10 },  // סטטוס
    { wch: 6 },   // קבוע
  ];
  
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'תנועות');
  
  // Sheet 2: סיכום
  const summary = calculateSummary(transactions);
  const wsSummary = XLSX.utils.json_to_sheet(summary);
  wsSummary['!cols'] = [
    { wch: 20 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'סיכום');
  
  // המרה ל-buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  return buffer;
}

/**
 * ייצוא דוח חודשי מלא
 */
export async function exportMonthlyReportToExcel(
  userId: string,
  year: number,
  month: number
): Promise<Buffer> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const transactions = await getTransactionsForExport(userId, {
    start: startDate,
    end: endDate,
  });
  
  const categories = await getCategoriesForExport(userId);
  
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: תנועות
  const transactionsData = transactions.map(tx => ({
    'תאריך': tx.tx_date,
    'ספק': tx.vendor || '',
    'תיאור': tx.description || '',
    'סכום': tx.amount,
    'סוג': tx.type === 'income' ? 'הכנסה' : 'הוצאה',
    'קטגוריה': tx.category_name || '',
  }));
  
  const wsTransactions = XLSX.utils.json_to_sheet(transactionsData);
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'תנועות');
  
  // Sheet 2: סיכום לפי קטגוריה
  const categoryBreakdown = calculateCategoryBreakdown(transactions, categories);
  const wsCategories = XLSX.utils.json_to_sheet(categoryBreakdown);
  XLSX.utils.book_append_sheet(wb, wsCategories, 'לפי קטגוריה');
  
  // Sheet 3: סיכום כללי
  const summary = [
    { 'מדד': 'סה"כ הכנסות', 'ערך': sumByType(transactions, 'income') },
    { 'מדד': 'סה"כ הוצאות', 'ערך': sumByType(transactions, 'expense') },
    { 'מדד': 'יתרה', 'ערך': sumByType(transactions, 'income') - sumByType(transactions, 'expense') },
    { 'מדד': 'מספר תנועות', 'ערך': transactions.length },
    { 'מדד': 'תנועות מאושרות', 'ערך': transactions.filter(t => t.status === 'confirmed').length },
    { 'מדד': 'תנועות ממתינות', 'ערך': transactions.filter(t => t.status !== 'confirmed').length },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'סיכום');
  
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusHebrew(status: string): string {
  switch (status) {
    case 'confirmed': return 'מאושר';
    case 'pending': return 'ממתין';
    case 'proposed': return 'מוצע';
    default: return status;
  }
}

function calculateSummary(transactions: Transaction[]): Array<{ מדד: string; ערך: number }> {
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  return [
    { 'מדד': 'סה"כ הכנסות', 'ערך': income },
    { 'מדד': 'סה"כ הוצאות', 'ערך': expenses },
    { 'מדד': 'יתרה', 'ערך': income - expenses },
    { 'מדד': 'מספר תנועות', 'ערך': transactions.length },
  ];
}

function calculateCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[]
): Array<{ קטגוריה: string; סוג: string; סכום: number; אחוז: string }> {
  const totals = new Map<string, number>();
  
  for (const tx of transactions) {
    const key = tx.category_name || 'לא מסווג';
    totals.set(key, (totals.get(key) || 0) + tx.amount);
  }
  
  const totalExpenses = sumByType(transactions, 'expense');
  
  const result = Array.from(totals.entries()).map(([name, amount]) => {
    const category = categories.find(c => c.name === name);
    const percentage = totalExpenses > 0 
      ? ((amount / totalExpenses) * 100).toFixed(1) + '%'
      : '0%';
    
    return {
      'קטגוריה': name,
      'סוג': category?.type === 'income' ? 'הכנסה' : 'הוצאה',
      'סכום': amount,
      'אחוז': percentage,
    };
  });
  
  return result.sort((a, b) => b['סכום'] - a['סכום']);
}

function sumByType(transactions: Transaction[], type: 'income' | 'expense'): number {
  return transactions
    .filter(t => t.type === type)
    .reduce((sum, t) => sum + t.amount, 0);
}

// ============================================================================
// API Route Helper
// ============================================================================

/**
 * יצירת response עם קובץ Excel להורדה
 */
export function createExcelResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

