// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/expenses/custom
 * יצירת הוצאה מותאמת אישית
 * 
 * Body:
 * {
 *   name: string,
 *   expense_type: 'fixed' | 'variable' | 'special',
 *   category_group?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // אימות משתמש
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, expense_type, category_group } = body;

    // ולידציה
    if (!name || !expense_type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, expense_type' },
        { status: 400 }
      );
    }

    if (!['fixed', 'variable', 'special'].includes(expense_type)) {
      return NextResponse.json(
        { error: 'Invalid expense_type. Must be: fixed, variable, or special' },
        { status: 400 }
      );
    }

    // בדיקה שלא קיימת כבר הוצאה עם אותו שם
    const { data: existing } = await (supabase as any)
      .from('user_custom_expenses')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', name)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'הוצאה עם שם זה כבר קיימת' },
        { status: 409 }
      );
    }

    // יצירת ההוצאה המותאמת
    const { data, error } = await (supabase as any)
      .from('user_custom_expenses')
      .insert({
        user_id: user.id,
        name,
        expense_type,
        category_group: category_group || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating custom expense:', error);
      return NextResponse.json(
        { error: 'Failed to create custom expense' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      expense: {
        ...data,
        is_custom: true
      }
    });

  } catch (error) {
    console.error('Custom expense API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/expenses/custom?id=xxx
 * מחיקת הוצאה מותאמת אישית
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing expense id' },
        { status: 400 }
      );
    }

    const { error } = await (supabase as any)
      .from('user_custom_expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting custom expense:', error);
      return NextResponse.json(
        { error: 'Failed to delete custom expense' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete custom expense API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

