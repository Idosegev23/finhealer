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
    const paymentMethod = searchParams.get('payment_method'); // לרמה 2
    const expenseType = searchParams.get('expense_type'); // לרמה 3 (fixed/variable)
    const category = searchParams.get('category'); // לרמה 4

    // החודש הנוכחי
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // רמה 1: פילוח לפי אמצעי תשלום
    if (level === '1') {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('payment_method, amount')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('status', 'confirmed')
        .gte('date', `${currentMonth}-01`)
        .lte('date', `${currentMonth}-31`)
        .or('has_details.is.null,has_details.eq.false');

      // קיבוץ לפי payment_method
      const grouped = (transactions || []).reduce((acc: any, tx: any) => {
        const method = tx.payment_method || 'לא מוגדר';
        if (!acc[method]) {
          acc[method] = 0;
        }
        acc[method] += Number(tx.amount) || 0;
        return acc;
      }, {});

      const result = Object.entries(grouped).map(([name, value]) => ({
        name: translatePaymentMethod(name as string),
        value: Math.round(value as number),
        metadata: { payment_method: name }
      }));

      return NextResponse.json(result);
    }

    // רמה 2: פילוח לפי קבועות/משתנות
    if (level === '2' && paymentMethod) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('expense_type, amount')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('status', 'confirmed')
        .eq('payment_method', paymentMethod)
        .gte('date', `${currentMonth}-01`)
        .lte('date', `${currentMonth}-31`)
        .or('has_details.is.null,has_details.eq.false');

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
        metadata: { payment_method: paymentMethod, expense_type: name }
      }));

      return NextResponse.json(result);
    }

    // רמה 3: פילוח לפי קטגוריות
    if (level === '3' && paymentMethod && expenseType) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('category, amount')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('status', 'confirmed')
        .eq('payment_method', paymentMethod)
        .eq('expense_type', expenseType)
        .gte('date', `${currentMonth}-01`)
        .lte('date', `${currentMonth}-31`)
        .or('has_details.is.null,has_details.eq.false');

      // קיבוץ לפי category
      const grouped = (transactions || []).reduce((acc: any, tx: any) => {
        const cat = tx.category || 'לא מוגדר';
        if (!acc[cat]) {
          acc[cat] = 0;
        }
        acc[cat] += Number(tx.amount) || 0;
        return acc;
      }, {});

      const result = Object.entries(grouped).map(([name, value]) => ({
        name,
        value: Math.round(value as number),
        metadata: { 
          payment_method: paymentMethod, 
          expense_type: expenseType,
          category: name 
        }
      }));

      return NextResponse.json(result);
    }

    // רמה 4: תנועות ספציפיות
    if (level === '4' && paymentMethod && expenseType && category) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('description, amount, date, merchant')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('status', 'confirmed')
        .eq('payment_method', paymentMethod)
        .eq('expense_type', expenseType)
        .eq('category', category)
        .gte('date', `${currentMonth}-01`)
        .lte('date', `${currentMonth}-31`)
        .or('has_details.is.null,has_details.eq.false')
        .order('date', { ascending: false });

      const result = (transactions || []).map((tx: any, index: number) => {
        const date = new Date(tx.date).toLocaleDateString('he-IL');
        const desc = tx.merchant || tx.description || `תנועה ${index + 1}`;
        return {
          name: `${desc} (${date})`,
          value: Math.round(Number(tx.amount) || 0),
          description: tx.description
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
function translatePaymentMethod(method: string): string {
  const translations: Record<string, string> = {
    'credit_card': 'אשראי',
    'debit_card': 'חיוב מיידי',
    'bank_transfer': 'העברה בנקאית',
    'cash': 'מזומן',
    'check': 'צ׳ק',
    'digital_wallet': 'ארנק דיגיטלי',
    'לא מוגדר': 'לא מוגדר'
  };
  return translations[method] || method;
}

function translateExpenseType(type: string): string {
  const translations: Record<string, string> = {
    'fixed': 'הוצאות קבועות',
    'variable': 'הוצאות משתנות',
    'לא מוגדר': 'לא מוגדר'
  };
  return translations[type] || type;
}



