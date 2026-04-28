import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { allocateDeposit, type GoalForAllocation } from '@/lib/goals/deposit-allocator';

export const dynamic = 'force-dynamic';

/**
 * GET — preview using saved monthly_savings_target.
 * POST — preview with a custom amount: { amount: number }.
 */

async function fetchContext(supabase: any, userId: string) {
  const [{ data: profile }, { data: goals }] = await Promise.all([
    supabase
      .from('user_financial_profile')
      .select('monthly_savings_target')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('goals')
      .select('id, name, priority, deadline, target_amount, current_amount, min_allocation, is_flexible, status')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ]);
  return {
    monthlyTarget: Number((profile as any)?.monthly_savings_target || 0),
    goals: ((goals as any[]) || []) as GoalForAllocation[],
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { monthlyTarget, goals } = await fetchContext(supabase, user.id);
    const result = allocateDeposit({ goals, depositAmount: monthlyTarget });

    return NextResponse.json({ ...result, monthly_savings_target: monthlyTarget });
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

    const { monthlyTarget, goals } = await fetchContext(supabase, user.id);
    const amount = Number.isFinite(customAmount) && customAmount >= 0 ? customAmount : monthlyTarget;
    const result = allocateDeposit({ goals, depositAmount: amount });

    return NextResponse.json({ ...result, monthly_savings_target: monthlyTarget });
  } catch (error: any) {
    console.error('POST /api/goals/allocate error:', error);
    return NextResponse.json({ error: error?.message || 'שגיאה' }, { status: 500 });
  }
}
