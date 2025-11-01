import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API לשליפת סיכום הוצאות חודשי
 * מחזיר נתונים לגרף + פירוט מלא לכל חודש
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '6'); // כמה חודשים אחורה

    const supabase = await createClient();

    // בדיקת אימות
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // חישוב תאריך התחלה (X חודשים אחורה)
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startDateStr = startDate.toISOString().split('T')[0];

    // שליפת כל ההוצאות מתאריך ההתחלה (רק parent transactions)
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .in('status', ['confirmed', 'proposed']) // מאושרות (confirmed) וממתינות (proposed)
      .or('has_details.is.null,has_details.eq.false')
      .gte('date', startDateStr)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // קיבוץ לפי חודש
    const monthlyData = groupByMonth(transactions || []);

    // הכנת נתונים לגרף
    const chartData = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      monthName: formatMonthName(month),
      total: data.total,
      fixed: data.byType.fixed || 0,
      variable: data.byType.variable || 0,
      special: data.byType.special || 0,
    }));

    return NextResponse.json({
      success: true,
      chartData,
      monthlyDetails: monthlyData,
      totalMonths: Object.keys(monthlyData).length,
    });

  } catch (error: any) {
    console.error('Monthly summary error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * קיבוץ הוצאות לפי חודש
 */
function groupByMonth(transactions: any[]) {
  const grouped: Record<string, any> = {};

  transactions.forEach((tx) => {
    const date = new Date(tx.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        month: monthKey,
        total: 0,
        count: 0,
        byType: {
          fixed: 0,
          variable: 0,
          special: 0,
        },
        byCategory: {} as Record<string, { total: number; count: number; items: any[] }>,
        transactions: [],
      };
    }

    const amount = parseFloat(tx.amount);
    grouped[monthKey].total += amount;
    grouped[monthKey].count += 1;
    grouped[monthKey].transactions.push(tx);

    // קיבוץ לפי expense_type
    const expenseType = getExpenseType(tx);
    if (expenseType && grouped[monthKey].byType[expenseType] !== undefined) {
      grouped[monthKey].byType[expenseType] += amount;
    }

    // קיבוץ לפי expense_category
    const category = tx.expense_category || tx.category || 'אחר';
    if (!grouped[monthKey].byCategory[category]) {
      grouped[monthKey].byCategory[category] = {
        total: 0,
        count: 0,
        items: [],
      };
    }
    grouped[monthKey].byCategory[category].total += amount;
    grouped[monthKey].byCategory[category].count += 1;
    grouped[monthKey].byCategory[category].items.push(tx);
  });

  return grouped;
}

/**
 * זיהוי סוג הוצאה מהטרנזקציה
 */
function getExpenseType(tx: any): 'fixed' | 'variable' | 'special' | null {
  // אם יש expense_frequency
  if (tx.expense_frequency === 'fixed') return 'fixed';
  if (tx.expense_frequency === 'temporary') return 'variable';
  if (tx.expense_frequency === 'special') return 'special';
  if (tx.expense_frequency === 'one_time') return 'variable';

  // אם אין - ניחוש לפי detailed_category או category
  const category = (tx.expense_category || tx.category || '').toLowerCase();
  
  // קבועות
  if (category.includes('ארנונה') || category.includes('ביטוח') || 
      category.includes('משכנתא') || category.includes('שכירות') ||
      category.includes('אינטרנט') || category.includes('טלפון') ||
      category.includes('חשמל') || category.includes('מים') || category.includes('גז')) {
    return 'fixed';
  }

  // מיוחדות
  if (category.includes('חופש') || category.includes('מחשב') || 
      category.includes('רהיט') || category.includes('אירוע')) {
    return 'special';
  }

  // ברירת מחדל - משתנה
  return 'variable';
}

/**
 * פורמט שם חודש בעברית
 */
function formatMonthName(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}

