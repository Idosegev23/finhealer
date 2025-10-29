import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API Route: PUT /api/expenses/update
 * מטרה: עדכון פרטי הוצאה
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    
    // בדיקת אימות
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      expenseId,
      amount,
      vendor,
      date,
      expense_category,
      expense_category_id,
      expense_type,
      notes,
      payment_method,
    } = body;

    if (!expenseId) {
      return NextResponse.json(
        { error: 'Missing expenseId' },
        { status: 400 }
      );
    }

    // בניית object לעדכון (רק שדות שסופקו)
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (vendor !== undefined) updateData.vendor = vendor;
    if (date !== undefined) {
      updateData.date = date;
      updateData.tx_date = date;
    }
    if (expense_category !== undefined) updateData.expense_category = expense_category;
    if (expense_category_id !== undefined) updateData.expense_category_id = expense_category_id;
    if (expense_type !== undefined) updateData.expense_type = expense_type;
    if (notes !== undefined) updateData.notes = notes;
    if (payment_method !== undefined) updateData.payment_method = payment_method;

    // עדכון ההוצאה
    const { data: expense, error } = await (supabase as any)
      .from('transactions')
      .update(updateData)
      .eq('id', expenseId)
      .eq('user_id', user.id) // וידוא שזה של המשתמש הנוכחי
      .select()
      .single();

    if (error) {
      console.error('Error updating expense:', error);
      return NextResponse.json(
        { error: 'Failed to update expense' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      expense,
      message: 'Expense updated successfully',
    });
  } catch (error: any) {
    console.error('Update expense error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

