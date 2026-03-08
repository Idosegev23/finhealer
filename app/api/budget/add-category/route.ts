import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/budget/add-category
 * הוספת קטגוריה חדשה לתקציב קיים
 *
 * Body:
 * {
 *   budgetId: string,
 *   categoryName: string,
 *   amount: number,
 *   type: 'fixed' | 'variable' | 'special'
 * }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { budgetId, categoryName, amount, type } = body;

    if (!budgetId || !categoryName || amount === undefined) {
      return NextResponse.json(
        { error: 'חסרים שדות: budgetId, categoryName, amount' },
        { status: 400 }
      );
    }

    // Verify budget belongs to user
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .select('id, total_budget')
      .eq('id', budgetId)
      .eq('user_id', user.id)
      .single();

    if (budgetError || !budget) {
      return NextResponse.json({ error: 'תקציב לא נמצא' }, { status: 404 });
    }

    // Check if category already exists
    const { data: existing } = await supabase
      .from('budget_categories')
      .select('id')
      .eq('budget_id', budgetId)
      .eq('category_name', categoryName)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'קטגוריה זו כבר קיימת בתקציב' },
        { status: 409 }
      );
    }

    // Insert new category
    const { data: category, error: catError } = await supabase
      .from('budget_categories')
      .insert({
        budget_id: budgetId,
        category_name: categoryName,
        detailed_category: categoryName,
        allocated_amount: amount,
        recommended_amount: amount,
        spent_amount: 0,
        remaining_amount: amount,
        percentage_used: 0,
        status: 'ok',
        is_flexible: type !== 'fixed',
        priority: type === 'fixed' ? 1 : type === 'variable' ? 2 : 3,
      })
      .select()
      .single();

    if (catError) {
      console.error('Error adding budget category:', catError);
      return NextResponse.json({ error: 'שגיאה בהוספת הקטגוריה' }, { status: 500 });
    }

    // Update budget total
    const newTotal = Number(budget.total_budget) + amount;
    await supabase
      .from('budgets')
      .update({
        total_budget: newTotal,
        available_for_spending: newTotal,
        daily_budget: Math.round(newTotal / 30),
        weekly_budget: Math.round(newTotal / 4),
      })
      .eq('id', budgetId);

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error('Add budget category error:', error);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}
