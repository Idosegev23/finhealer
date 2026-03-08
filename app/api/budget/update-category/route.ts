import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/budget/update-category
 * עדכון סכום מוקצה לקטגוריה בתקציב
 *
 * Body:
 * {
 *   budgetId: string,
 *   categoryName: string,
 *   newAmount: number
 * }
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { budgetId, categoryName, newAmount } = body;

    if (!budgetId || !categoryName || newAmount === undefined || newAmount === null) {
      return NextResponse.json(
        { error: 'Missing required fields: budgetId, categoryName, newAmount' },
        { status: 400 }
      );
    }

    if (typeof newAmount !== 'number' || newAmount < 0) {
      return NextResponse.json(
        { error: 'newAmount must be a non-negative number' },
        { status: 400 }
      );
    }

    // Verify the budget belongs to the authenticated user
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .select('id')
      .eq('id', budgetId)
      .eq('user_id', user.id)
      .single();

    if (budgetError || !budget) {
      return NextResponse.json(
        { error: 'Budget not found or access denied' },
        { status: 404 }
      );
    }

    // Fetch the current category to get spent_amount
    const { data: category, error: categoryError } = await supabase
      .from('budget_categories')
      .select('*')
      .eq('budget_id', budgetId)
      .eq('category_name', categoryName)
      .single();

    if (categoryError || !category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    const spentAmount = category.spent_amount || 0;
    const remainingAmount = newAmount - spentAmount;
    const percentageUsed = newAmount > 0
      ? Math.round((spentAmount / newAmount) * 100)
      : 0;

    // Determine status based on percentage used
    let status = 'ok';
    if (percentageUsed >= 100) {
      status = 'exceeded';
    } else if (percentageUsed >= 80) {
      status = 'warning';
    }

    // Update the category
    const { data: updated, error: updateError } = await supabase
      .from('budget_categories')
      .update({
        allocated_amount: newAmount,
        remaining_amount: remainingAmount,
        percentage_used: percentageUsed,
        status,
      })
      .eq('budget_id', budgetId)
      .eq('category_name', categoryName)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to update budget category:', updateError);
      return NextResponse.json(
        { error: 'Failed to update category' },
        { status: 500 }
      );
    }

    return NextResponse.json({ category: updated });
  } catch (error) {
    console.error('Error in PATCH /api/budget/update-category:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
