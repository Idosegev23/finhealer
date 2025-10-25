import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/budget/analyze-history
 * ניתוח 3 חודשים אחרונים של הוצאות
 * 
 * Response:
 * {
 *   canCreateBudget: boolean,
 *   monthsAnalyzed: number,
 *   analysis: {
 *     avgMonthlyTotal: number,
 *     byCategory: {...},
 *     byFrequency: {...},
 *     trends: {...}
 *   }
 * }
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // תאריך 3 חודשים אחורה
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const fromDate = threeMonthsAgo.toISOString().split('T')[0];

    // שליפת כל ההוצאות מ-3 חודשים אחרונים
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('tx_date', fromDate)
      .eq('status', 'confirmed');

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // בדיקה אם יש מספיק נתונים (לפחות 30 תנועות או 2 חודשים מלאים)
    const canCreateBudget = (transactions?.length || 0) >= 30;
    
    if (!canCreateBudget) {
      return NextResponse.json({
        canCreateBudget: false,
        monthsAnalyzed: 0,
        message: 'נדרשות לפחות 30 תנועות מ-3 חודשים אחרונים כדי ליצור תקציב חכם',
        transactionsFound: transactions?.length || 0
      });
    }

    // ניתוח הנתונים
    const analysis = analyzeTransactions(transactions || []);

    return NextResponse.json({
      canCreateBudget: true,
      monthsAnalyzed: analysis.monthsWithData,
      transactionsAnalyzed: transactions?.length || 0,
      analysis
    });

  } catch (error) {
    console.error('Analyze history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function analyzeTransactions(transactions: any[]) {
  // קיבוץ לפי חודש
  const byMonth: Record<string, { total: number; count: number; transactions: any[] }> = {};
  
  transactions.forEach((t) => {
    const month = t.tx_date.substring(0, 7); // YYYY-MM
    if (!byMonth[month]) {
      byMonth[month] = { total: 0, count: 0, transactions: [] };
    }
    byMonth[month].total += t.amount || 0;
    byMonth[month].count += 1;
    byMonth[month].transactions.push(t);
  });

  // חישוב ממוצעים
  const months = Object.keys(byMonth);
  const monthsWithData = months.length;
  const avgMonthlyTotal = months.reduce((sum, m) => sum + byMonth[m].total, 0) / monthsWithData;

  // ניתוח לפי קטגוריה
  const byCategory: Record<string, { avgMonthly: number; totalTransactions: number; frequency: string }> = {};
  transactions.forEach((t) => {
    const cat = t.detailed_category || t.category || 'other';
    if (!byCategory[cat]) {
      byCategory[cat] = { avgMonthly: 0, totalTransactions: 0, frequency: 'one_time' };
    }
    byCategory[cat].avgMonthly += (t.amount || 0) / monthsWithData;
    byCategory[cat].totalTransactions += 1;
    
    // זיהוי תדירות רווחת
    if (t.expense_frequency) {
      byCategory[cat].frequency = t.expense_frequency;
    }
  });

  // ניתוח לפי תדירות
  const byFrequency: Record<string, { avgMonthly: number; percentage: number; count: number }> = {
    fixed: { avgMonthly: 0, percentage: 0, count: 0 },
    temporary: { avgMonthly: 0, percentage: 0, count: 0 },
    special: { avgMonthly: 0, percentage: 0, count: 0 },
    one_time: { avgMonthly: 0, percentage: 0, count: 0 },
  };

  transactions.forEach((t) => {
    const freq = t.expense_frequency || 'one_time';
    if (byFrequency[freq]) {
      byFrequency[freq].avgMonthly += (t.amount || 0) / monthsWithData;
      byFrequency[freq].count += 1;
    }
  });

  // חישוב אחוזים
  Object.keys(byFrequency).forEach((freq) => {
    byFrequency[freq].percentage = avgMonthlyTotal > 0 
      ? (byFrequency[freq].avgMonthly / avgMonthlyTotal) * 100 
      : 0;
  });

  // מגמות
  const trends = analyzeTrends(byMonth);

  // חישוב תקציב יומי ושבועי מומלץ
  const avgDailySpending = avgMonthlyTotal / 30;
  const avgWeeklySpending = avgMonthlyTotal / 4;

  return {
    monthsWithData,
    avgMonthlyTotal: Math.round(avgMonthlyTotal),
    avgDailySpending: Math.round(avgDailySpending),
    avgWeeklySpending: Math.round(avgWeeklySpending),
    byCategory,
    byFrequency,
    trends,
    totalTransactions: transactions.length
  };
}

function analyzeTrends(byMonth: Record<string, { total: number; count: number; transactions: any[] }>) {
  const months = Object.keys(byMonth).sort();
  if (months.length < 2) {
    return { trend: 'insufficient_data', change: 0 };
  }

  const firstMonth = byMonth[months[0]].total;
  const lastMonth = byMonth[months[months.length - 1]].total;
  
  const change = ((lastMonth - firstMonth) / firstMonth) * 100;
  
  let trend: 'increasing' | 'decreasing' | 'stable';
  if (change > 10) trend = 'increasing';
  else if (change < -10) trend = 'decreasing';
  else trend = 'stable';

  return {
    trend,
    change: Math.round(change * 10) / 10,
    firstMonthTotal: Math.round(firstMonth),
    lastMonthTotal: Math.round(lastMonth)
  };
}

