import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkApiRateLimit } from '@/lib/utils/api-rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const limited = checkApiRateLimit(request, 20, 60_000);
    if (limited) return limited;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, goal_type, target_amount, monthly_allocation, deadline, funding_notes } = body;

    if (!name || !target_amount) {
      return NextResponse.json({ error: 'name and target_amount are required' }, { status: 400 });
    }

    if (Number(target_amount) > 50_000_000 || (monthly_allocation && Number(monthly_allocation) > 1_000_000)) {
      return NextResponse.json({ error: 'סכום גבוה מדי' }, { status: 400 });
    }

    if (name.length > 200) {
      return NextResponse.json({ error: 'שם יעד ארוך מדי' }, { status: 400 });
    }

    // Get next priority
    const { data: existingGoals } = await supabase
      .from('goals')
      .select('priority')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .limit(1);

    const nextPriority = (existingGoals?.[0]?.priority || 0) + 1;

    const goalData: Record<string, any> = {
      user_id: user.id,
      name,
      goal_type: goal_type || 'savings_goal',
      target_amount,
      current_amount: 0,
      status: 'active',
      priority: Math.min(nextPriority, 10),
      is_flexible: true,
      auto_adjust: true,
      min_allocation: 0,
      monthly_allocation: monthly_allocation || 0,
    };

    if (deadline) goalData.deadline = deadline;
    if (funding_notes) goalData.funding_notes = funding_notes;

    const { data: goal, error } = await supabase
      .from('goals')
      .insert(goalData)
      .select()
      .single();

    if (error) {
      console.error('Error creating goal:', error);
      return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
    }

    // Goals creation is the gate from goals → budget; advance phase
    // right away so the dashboard reflects the new step without a refresh.
    try {
      const { tryUpgradePhase } = await import('@/lib/services/PhaseService');
      await tryUpgradePhase(user.id);
    } catch (err) {
      console.warn('[PhaseService] post-goal-create error:', err);
    }

    return NextResponse.json({ success: true, goal });
  } catch (error: any) {
    console.error('Create goal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
