import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API Route: POST /api/expenses/approve
 * מטרה: אישור הוצאות (תומך בהוצאה בודדת או מערך)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // בדיקת אימות
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    // תמיכה גם ב-expenseId בודד וגם במערך expenseIds
    const expenseIds = body.expenseIds || (body.expenseId ? [body.expenseId] : []);

    if (!expenseIds || expenseIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing expenseId or expenseIds' },
        { status: 400 }
      );
    }

    // ✅ Validation: בדיקה שלכל התנועות יש קטגוריה (בעיקר להוצאות)
    const { data: transactions, error: fetchError } = await (supabase as any)
      .from('transactions')
      .select('id, type, expense_category, expense_category_id')
      .in('id', expenseIds)
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // בדוק שכל ההוצאות מסווגות
    const uncategorizedExpenses = transactions?.filter(
      (tx: any) => tx.type === 'expense' && !tx.expense_category_id && !tx.expense_category
    ) || [];

    if (uncategorizedExpenses.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot approve uncategorized expenses',
          message: 'לא ניתן לאשר הוצאות שלא מסווגות. יש לבחור קטגוריה לפני אישור.',
          uncategorizedIds: uncategorizedExpenses.map((tx: any) => tx.id)
        },
        { status: 400 }
      );
    }

    // עדכון סטטוס להוצאות מאושרות
    const { data: expenses, error } = await (supabase as any)
      .from('transactions')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .in('id', expenseIds)
      .eq('user_id', user.id) // וידוא שזה של המשתמש הנוכחי
      .select();

    if (error) {
      console.error('Error approving expenses:', error);
      return NextResponse.json(
        { error: 'Failed to approve expenses' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      expenses,
      count: expenses?.length || 0,
      message: `${expenses?.length || 0} expenses approved successfully`,
    });
  } catch (error: any) {
    console.error('Approve expense error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

