import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    // החודש הנוכחי
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // רמה 1: פילוח לפי קבועות/משתנות
    if (level === '1') {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('expense_type, amount')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('status', 'confirmed')
        .gte('date', `${currentMonth}-01`)
        .lte('date', `${currentMonth}-31`)
        .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true'); // כולל תנועות parent + מזומן

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

      return NextResponse.json(result);
    }

    // רמה 2: פילוח לפי קטגוריות הוצאות (expense_category)
    if (level === '2' && expenseType) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('expense_category, amount, vendor')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('status', 'confirmed')
        .eq('expense_type', expenseType)
        .gte('date', `${currentMonth}-01`)
        .lte('date', `${currentMonth}-31`)
        .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true'); // כולל תנועות parent + מזומן

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

      return NextResponse.json(result);
    }

    // רמה 3: תנועות ספציפיות לפי קטגוריית הוצאה
    if (level === '3' && expenseType && expenseCategory) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('vendor, amount, date, notes, expense_category')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('status', 'confirmed')
        .eq('expense_type', expenseType)
        .eq('expense_category', expenseCategory)
        .gte('date', `${currentMonth}-01`)
        .lte('date', `${currentMonth}-31`)
        .or('has_details.is.null,has_details.eq.false')
        .order('date', { ascending: false });

      const result = (transactions || []).map((tx: any, index: number) => {
        const date = new Date(tx.date).toLocaleDateString('he-IL');
        const desc = tx.vendor || tx.notes || `תנועה ${index + 1}`;
        return {
          name: `${desc} (${date})`,
          value: Math.round(Number(tx.amount) || 0),
          description: tx.notes || null
        };
      });

      return NextResponse.json(result);
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




