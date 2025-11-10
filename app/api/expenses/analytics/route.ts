// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/expenses/analytics
 * סטטיסטיקות מפורטות על הוצאות
 * 
 * Query params:
 * - period: 'month' | 'quarter' | 'year' | 'all'
 * - startDate: YYYY-MM-DD (optional)
 * - endDate: YYYY-MM-DD (optional)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // חישוב תאריכי התחלה וסיום
    let fromDate: string;
    let toDate: string = new Date().toISOString().split('T')[0];

    if (startDate && endDate) {
      fromDate = startDate;
      toDate = endDate;
    } else {
      const now = new Date();
      switch (period) {
        case 'month':
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          break;
        case 'quarter':
          const quarterStart = Math.floor(now.getMonth() / 3) * 3;
          fromDate = new Date(now.getFullYear(), quarterStart, 1).toISOString().split('T')[0];
          break;
        case 'year':
          fromDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
          break;
        case 'all':
          fromDate = '2020-01-01';
          break;
        default:
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      }
    }

    // שליפת כל ההוצאות בתקופה (parent transactions + cash expenses)
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('tx_date', fromDate)
      .lte('tx_date', toDate)
      .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true') // כולל תנועות parent + מזומן
      .order('tx_date', { ascending: true });

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // חישוב סטטיסטיקות
    const stats = calculateStats(transactions || []);

    return NextResponse.json({
      period,
      fromDate,
      toDate,
      stats,
      transactions: transactions || [],
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function calculateStats(transactions: any[]) {
  if (!transactions || transactions.length === 0) {
    return {
      total: 0,
      totalTransactions: 0,
      byCategory: {},
      byFrequency: {},
      byMonth: {},
      averagePerTransaction: 0,
      largestExpense: null,
      smallestExpense: null,
    };
  }

  const total = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  
  // חלוקה לפי קטגוריה
  const byCategory: Record<string, { total: number; count: number; percentage: number }> = {};
  transactions.forEach((t) => {
    const cat = t.detailed_category || t.category || 'other';
    if (!byCategory[cat]) {
      byCategory[cat] = { total: 0, count: 0, percentage: 0 };
    }
    byCategory[cat].total += t.amount || 0;
    byCategory[cat].count += 1;
  });

  // חישוב אחוזים
  Object.keys(byCategory).forEach((cat) => {
    byCategory[cat].percentage = total > 0 ? (byCategory[cat].total / total) * 100 : 0;
  });

  // חלוקה לפי תדירות
  const byFrequency: Record<string, { total: number; count: number; percentage: number }> = {};
  transactions.forEach((t) => {
    const freq = t.expense_frequency || 'one_time';
    if (!byFrequency[freq]) {
      byFrequency[freq] = { total: 0, count: 0, percentage: 0 };
    }
    byFrequency[freq].total += t.amount || 0;
    byFrequency[freq].count += 1;
  });

  Object.keys(byFrequency).forEach((freq) => {
    byFrequency[freq].percentage = total > 0 ? (byFrequency[freq].total / total) * 100 : 0;
  });

  // חלוקה לפי חודש
  const byMonth: Record<string, { total: number; count: number }> = {};
  transactions.forEach((t) => {
    const month = t.tx_date.substring(0, 7); // YYYY-MM
    if (!byMonth[month]) {
      byMonth[month] = { total: 0, count: 0 };
    }
    byMonth[month].total += t.amount || 0;
    byMonth[month].count += 1;
  });

  // מיון לפי סכום
  const sortedByAmount = [...transactions].sort((a, b) => (b.amount || 0) - (a.amount || 0));

  return {
    total: Math.round(total * 100) / 100,
    totalTransactions: transactions.length,
    byCategory,
    byFrequency,
    byMonth,
    averagePerTransaction: transactions.length > 0 ? Math.round((total / transactions.length) * 100) / 100 : 0,
    largestExpense: sortedByAmount[0] || null,
    smallestExpense: sortedByAmount[sortedByAmount.length - 1] || null,
  };
}

