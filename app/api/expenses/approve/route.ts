import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API Route: POST /api/expenses/approve
 * מטרה: אישור הוצאה
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
    const { expenseId } = body;

    if (!expenseId) {
      return NextResponse.json(
        { error: 'Missing expenseId' },
        { status: 400 }
      );
    }

    // עדכון סטטוס להוצאה מאושרת
    const { data: expense, error } = await (supabase as any)
      .from('transactions')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', expenseId)
      .eq('user_id', user.id) // וידוא שזה של המשתמש הנוכחי
      .select()
      .single();

    if (error) {
      console.error('Error approving expense:', error);
      return NextResponse.json(
        { error: 'Failed to approve expense' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      expense,
      message: 'Expense approved successfully',
    });
  } catch (error: any) {
    console.error('Approve expense error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

