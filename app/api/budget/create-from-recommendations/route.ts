import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/budget/create-from-recommendations
 * יצירת תקציב חדש מתוך המלצות הפאי צ'ארט
 *
 * Body: { recommendations: Array<{ category, actual, recommended, difference, tip }> }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recommendations } = await request.json();
    if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
      return NextResponse.json({ error: 'Missing recommendations' }, { status: 400 });
    }

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Check if budget already exists for this month
    const { data: existing } = await supabase
      .from('budgets')
      .select('id')
      .eq('user_id', user.id)
      .eq('month', month)
      .single();

    let budgetId: string;

    if (existing) {
      budgetId = existing.id;
      // Delete old categories for this budget
      await supabase
        .from('budget_categories')
        .delete()
        .eq('budget_id', budgetId);
    } else {
      // Create new budget
      const totalBudget = recommendations.reduce(
        (s: number, r: any) => s + (r.recommended || 0), 0
      );
      const { data: newBudget, error: budgetErr } = await supabase
        .from('budgets')
        .insert({
          user_id: user.id,
          month,
          total_budget: totalBudget,
          total_spent: recommendations.reduce(
            (s: number, r: any) => s + (r.actual || 0), 0
          ),
          status: 'active',
          is_auto_generated: true,
          confidence_score: 0.8,
        })
        .select('id')
        .single();

      if (budgetErr || !newBudget) {
        console.error('Failed to create budget:', budgetErr);
        return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
      }
      budgetId = newBudget.id;
    }

    // Insert categories
    const categoryRows = recommendations.map((rec: any, idx: number) => {
      const allocated = rec.recommended || 0;
      const spent = rec.actual || 0;
      const remaining = allocated - spent;
      const pctUsed = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
      let status = 'ok';
      if (pctUsed >= 100) status = 'exceeded';
      else if (pctUsed >= 80) status = 'warning';

      return {
        budget_id: budgetId,
        category_name: rec.category,
        allocated_amount: allocated,
        spent_amount: spent,
        remaining_amount: remaining,
        percentage_used: pctUsed,
        recommended_amount: allocated,
        status,
        priority: idx + 1,
        is_flexible: rec.tip !== 'הוצאה קבועה',
      };
    });

    const { error: catErr } = await supabase
      .from('budget_categories')
      .insert(categoryRows);

    if (catErr) {
      console.error('Failed to insert budget categories:', catErr);
      return NextResponse.json({ error: 'Failed to save categories' }, { status: 500 });
    }

    return NextResponse.json({ success: true, budgetId, month });
  } catch (err) {
    console.error('create-from-recommendations error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
