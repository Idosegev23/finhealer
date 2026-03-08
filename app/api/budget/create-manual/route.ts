import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/budget/create-manual
 * יצירת תקציב ידני עם קטגוריות וסכומים שהמשתמש בוחר
 *
 * Body:
 * {
 *   month: 'YYYY-MM',
 *   totalBudget: number,
 *   categories: Array<{ name: string; amount: number; type: 'fixed' | 'variable' | 'special' }>
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
    const { month, totalBudget, categories } = body;

    if (!month || !categories || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json(
        { error: 'חסרים שדות: month, categories (מערך עם לפחות קטגוריה אחת)' },
        { status: 400 }
      );
    }

    // Check if budget already exists for this month
    const { data: existing } = await supabase
      .from('budgets')
      .select('id')
      .eq('user_id', user.id)
      .eq('month', month)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'כבר קיים תקציב לחודש זה. ניתן לערוך את התקציב הקיים או למחוק אותו.' },
        { status: 409 }
      );
    }

    // Calculate totals by type
    const fixedTotal = categories
      .filter((c: any) => c.type === 'fixed')
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
    const variableTotal = categories
      .filter((c: any) => c.type === 'variable')
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
    const specialTotal = categories
      .filter((c: any) => c.type === 'special')
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0);

    const calculatedTotal = totalBudget || (fixedTotal + variableTotal + specialTotal);

    // Create budget
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .insert({
        user_id: user.id,
        month,
        total_budget: calculatedTotal,
        fixed_budget: fixedTotal,
        temporary_budget: variableTotal,
        special_budget: specialTotal,
        one_time_budget: 0,
        daily_budget: Math.round(calculatedTotal / 30),
        weekly_budget: Math.round(calculatedTotal / 4),
        available_for_spending: calculatedTotal,
        is_auto_generated: false,
        status: 'active',
      })
      .select()
      .single();

    if (budgetError) {
      console.error('Error creating manual budget:', budgetError);
      return NextResponse.json({ error: 'שגיאה ביצירת התקציב' }, { status: 500 });
    }

    // Insert categories
    const categoryInserts = categories.map((cat: any) => ({
      budget_id: budget.id,
      category_name: cat.name,
      detailed_category: cat.name,
      allocated_amount: cat.amount || 0,
      recommended_amount: cat.amount || 0,
      spent_amount: 0,
      remaining_amount: cat.amount || 0,
      percentage_used: 0,
      status: 'ok',
      is_flexible: cat.type !== 'fixed',
      priority: cat.type === 'fixed' ? 1 : cat.type === 'variable' ? 2 : 3,
    }));

    const { error: catError } = await supabase
      .from('budget_categories')
      .insert(categoryInserts);

    if (catError) {
      console.error('Error inserting budget categories:', catError);
      // Clean up the budget if categories failed
      await supabase.from('budgets').delete().eq('id', budget.id);
      return NextResponse.json({ error: 'שגיאה בשמירת הקטגוריות' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      budget,
      categoriesCount: categories.length,
    });
  } catch (error) {
    console.error('Create manual budget error:', error);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}
