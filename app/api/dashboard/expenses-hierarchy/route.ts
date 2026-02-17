import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to calculate date range based on period
function getDateRange(period: string): { startDate: string; endDate: string; periodLabel: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let startDate: Date;
  let endDate: Date = new Date(today);
  let periodLabel: string;

  switch (period) {
    case 'current_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
      periodLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      break;
    
    case 'last_3_months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startMonth = startDate.getMonth();
      const endMonth = endDate.getMonth();
      const monthNamesShort = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
      if (startDate.getFullYear() === endDate.getFullYear()) {
        periodLabel = `${monthNamesShort[startMonth]}-${monthNamesShort[endMonth]} ${endDate.getFullYear()}`;
      } else {
        periodLabel = `${monthNamesShort[startMonth]} ${startDate.getFullYear()}-${monthNamesShort[endMonth]} ${endDate.getFullYear()}`;
      }
      break;
    
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      periodLabel = `שנה אחרונה (${now.getFullYear() - 1}-${now.getFullYear()})`;
      break;
    
    case 'all_time':
      startDate = new Date(2000, 0, 1); // Start from year 2000
      endDate = new Date(today);
      periodLabel = 'כל הזמן';
      break;
    
    default:
      // Default to last_3_months
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startMonthDefault = startDate.getMonth();
      const endMonthDefault = endDate.getMonth();
      const monthNamesShortDefault = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
      if (startDate.getFullYear() === endDate.getFullYear()) {
        periodLabel = `${monthNamesShortDefault[startMonthDefault]}-${monthNamesShortDefault[endMonthDefault]} ${endDate.getFullYear()}`;
      } else {
        periodLabel = `${monthNamesShortDefault[startMonthDefault]} ${startDate.getFullYear()}-${monthNamesShortDefault[endMonthDefault]} ${endDate.getFullYear()}`;
      }
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    periodLabel
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // בדיקת אימות
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // קבלת פרמטרים מה-query string
    const searchParams = request.nextUrl.searchParams;
    const level = searchParams.get('level') || '1'; // רמה נוכחית
    const expenseType = searchParams.get('expense_type'); // לרמה 2 (fixed/variable)
    const expenseCategory = searchParams.get('expense_category'); // לרמה 3
    const period = searchParams.get('period') || 'last_3_months'; // ברירת מחדל: 3 חודשים אחרונים

    // חישוב טווח תאריכים לפי תקופה
    const { startDate, endDate, periodLabel } = getDateRange(period);
    
    console.log(`📊 Expenses hierarchy API called:`, {
      userId: user.id,
      level,
      period,
      startDate,
      endDate,
      periodLabel,
      expenseType,
      expenseCategory
    });

    // רמה 1: פילוח לפי קבועות/משתנות
    if (level === '1') {
      const { data: transactions, error: queryError } = await supabase
        .from('transactions')
        .select('expense_type, amount')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('status', 'confirmed')
        .gte('tx_date', startDate)
        .lte('tx_date', endDate)
        .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true'); // כולל תנועות parent + מזומן

      if (queryError) {
        console.error('❌ Error fetching transactions:', queryError);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
      }

      console.log(`✅ Found ${transactions?.length || 0} transactions for period ${periodLabel}`);

      // קיבוץ לפי expense_type
      const grouped = (transactions || []).reduce((acc: any, tx: any) => {
        const type = tx.expense_type || 'לא מוגדר';
        if (!acc[type]) {
          acc[type] = 0;
        }
        acc[type] += Number(tx.amount) || 0;
        return acc;
      }, {});

      const result = Object.entries(grouped).map(([name, value]) => ({
        name: translateExpenseType(name as string),
        value: Math.round(value as number),
        metadata: { expense_type: name }
      }));

      return NextResponse.json({
        data: result,
        period: {
          startDate,
          endDate,
          periodLabel,
          period
        }
      });
    }

    // רמה 2: פילוח לפי קטגוריות הוצאות (expense_category)
    if (level === '2' && expenseType) {
      const { data: transactions, error: queryError } = await supabase
        .from('transactions')
        .select('expense_category, amount, vendor')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('status', 'confirmed')
        .eq('expense_type', expenseType)
        .gte('tx_date', startDate)
        .lte('tx_date', endDate)
        .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true'); // כולל תנועות parent + מזומן

      if (queryError) {
        console.error('❌ Error fetching transactions:', queryError);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
      }

      console.log(`✅ Found ${transactions?.length || 0} transactions for level 2 (${expenseType})`);

      // קיבוץ לפי expense_category
      const grouped = (transactions || []).reduce((acc: any, tx: any) => {
        const cat = tx.expense_category || 'לא מסווג';
        if (!acc[cat]) {
          acc[cat] = 0;
        }
        acc[cat] += Number(tx.amount) || 0;
        return acc;
      }, {});

      const result = Object.entries(grouped).map(([name, value]) => ({
        name: name === 'לא מסווג' ? 'לא מסווג' : name,
        value: Math.round(value as number),
        metadata: { 
          expense_type: expenseType,
          expense_category: name
        }
      }));

      return NextResponse.json({
        data: result,
        period: {
          startDate,
          endDate,
          periodLabel,
          period
        }
      });
    }

    // רמה 3: תנועות ספציפיות לפי קטגוריית הוצאה
    if (level === '3' && expenseType && expenseCategory) {
      const { data: transactions, error: queryError } = await supabase
        .from('transactions')
        .select('vendor, amount, date, notes, expense_category, id') // הוספת id
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('status', 'confirmed')
        .eq('expense_type', expenseType)
        .eq('expense_category', expenseCategory)
        .gte('tx_date', startDate)
        .lte('tx_date', endDate)
        .or('has_details.is.null,has_details.eq.false')
        .order('tx_date', { ascending: false });

      if (queryError) {
        console.error('❌ Error fetching transactions:', queryError);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
      }

      console.log(`✅ Found ${transactions?.length || 0} transactions for level 3 (${expenseType}/${expenseCategory})`);

      const result = (transactions || []).map((tx: any, index: number) => {
        const date = new Date(tx.tx_date || tx.date).toLocaleDateString('he-IL');
        const desc = tx.vendor || tx.notes || `תנועה ${index + 1}`;
        return {
          name: `${desc} (${date})`,
          value: Math.round(Number(tx.amount) || 0),
          description: tx.notes || null,
          transactionId: tx.id || null // הוספת ID של התנועה
        };
      });

      return NextResponse.json({
        data: result,
        period: {
          startDate,
          endDate,
          periodLabel,
          period
        }
      });
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  } catch (error) {
    console.error('Error fetching expenses hierarchy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// פונקציות עזר לתרגום
function translateExpenseType(type: string): string {
  const translations: Record<string, string> = {
    'fixed': 'הוצאות קבועות',
    'variable': 'הוצאות משתנות',
    'לא מוגדר': 'לא מוגדר'
  };
  return translations[type] || type;
}




