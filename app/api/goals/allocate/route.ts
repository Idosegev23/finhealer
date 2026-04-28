import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { allocateDeposit, type GoalForAllocation } from '@/lib/goals/deposit-allocator';

export const dynamic = 'force-dynamic';

/**
 * GET — preview using saved monthly_savings_target.
 * POST — preview with a custom amount: { amount: number }.
 */

async function fetchContext(supabase: any, userId: string) {
  const [{ data: profile }, { data: goals }, { data: savings }] = await Promise.all([
    supabase
      .from('user_financial_profile')
      .select('monthly_savings_target, current_savings, total_monthly_income, total_fixed_expenses')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('goals')
      .select('id, name, priority, deadline, target_amount, current_amount, min_allocation, is_flexible, status')
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase
      .from('savings_accounts')
      .select('current_balance, monthly_deposit, account_type')
      .eq('user_id', userId)
      .eq('active', true),
  ]);

  const goalsList = ((goals as any[]) || []) as GoalForAllocation[];
  const savingsRows = (savings as any[]) || [];

  // Real savings balance from accounts the user actually owns. Falls
  // back to user_financial_profile.current_savings (manual entry) only
  // if no accounts exist yet.
  const savingsBalance = savingsRows.reduce(
    (s, a) => s + (Number(a.current_balance) || 0),
    0,
  );
  const accountsMonthlyDeposit = savingsRows.reduce(
    (s, a) => s + (Number(a.monthly_deposit) || 0),
    0,
  );
  const profileSavings = Number((profile as any)?.current_savings || 0);

  // Roll-up goal totals so the UI can show "saved vs target" as the
  // headline KPI without re-aggregating client-side.
  const totalCurrent = goalsList.reduce((s, g) => s + (Number(g.current_amount) || 0), 0);
  const totalTarget = goalsList.reduce((s, g) => s + (Number(g.target_amount) || 0), 0);
  const remainingToGoals = Math.max(0, totalTarget - totalCurrent);

  return {
    monthlyTarget: Number((profile as any)?.monthly_savings_target || 0),
    goals: goalsList,
    summary: {
      // Across-goals totals
      total_current: totalCurrent,
      total_target: totalTarget,
      remaining_to_goals: remainingToGoals,
      progress_percent: totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0,
      // The user's actual savings pool (if any)
      savings_account_count: savingsRows.length,
      savings_balance: savingsBalance > 0 ? savingsBalance : profileSavings,
      savings_balance_source: savingsBalance > 0
        ? ('savings_accounts' as const)
        : profileSavings > 0
          ? ('profile_manual' as const)
          : ('none' as const),
      accounts_monthly_deposit: accountsMonthlyDeposit,
      // Income context — affordability ceiling for the deposit
      monthly_income: Number((profile as any)?.total_monthly_income || 0),
      monthly_fixed_expenses: Number((profile as any)?.total_fixed_expenses || 0),
    },
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { monthlyTarget, goals, summary } = await fetchContext(supabase, user.id);
    const result = allocateDeposit({ goals, depositAmount: monthlyTarget });

    return NextResponse.json({
      ...result,
      monthly_savings_target: monthlyTarget,
      context: summary,
    });
  } catch (error: any) {
    console.error('GET /api/goals/allocate error:', error);
    return NextResponse.json({ error: error?.message || 'שגיאה' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const customAmount = Number(body?.amount);

    const { monthlyTarget, goals, summary } = await fetchContext(supabase, user.id);
    const amount = Number.isFinite(customAmount) && customAmount >= 0 ? customAmount : monthlyTarget;
    const result = allocateDeposit({ goals, depositAmount: amount });

    return NextResponse.json({
      ...result,
      monthly_savings_target: monthlyTarget,
      context: summary,
    });
  } catch (error: any) {
    console.error('POST /api/goals/allocate error:', error);
    return NextResponse.json({ error: error?.message || 'שגיאה' }, { status: 500 });
  }
}
