/**
 * Goals API
 * GET: Fetch user goals
 * POST: Create a new goal
 * PATCH: Update a goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get optional status filter
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'active';
    
    // Fetch goals
    let query = supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    const { data: goals, error } = await query;
    
    if (error) {
      console.error('Error fetching goals:', error);
      return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
    }
    
    // Calculate stats
    const stats = {
      total: goals?.length || 0,
      totalTargetAmount: goals?.reduce((sum, g) => sum + (g.target_amount || 0), 0) || 0,
      totalCurrentAmount: goals?.reduce((sum, g) => sum + (g.current_amount || 0), 0) || 0,
      completedCount: goals?.filter(g => g.status === 'completed').length || 0,
    };
    
    return NextResponse.json({
      goals: goals || [],
      stats,
    });
  } catch (error) {
    console.error('Goals API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || body.target_amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields: name, target_amount' }, { status: 400 });
    }
    
    // Create goal
    const { data: goal, error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        name: body.name,
        target_amount: body.target_amount,
        current_amount: body.current_amount || 0,
        deadline: body.deadline || null,
        description: body.description || null,
        priority: body.priority || 1,
        status: 'active',
        child_name: body.child_name || null,
        goal_type: body.goal_type || null,
        budget_source: body.budget_source || null,
        funding_notes: body.funding_notes || null,
        child_id: body.child_id || null,
        goal_group: body.goal_group || null,
        is_flexible: body.is_flexible ?? true,
        min_allocation: body.min_allocation || 0,
        monthly_allocation: body.monthly_allocation || 0,
        auto_adjust: body.auto_adjust ?? true,
        depends_on_goal_id: body.depends_on_goal_id || null,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating goal:', error);
      return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
    }
    
    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    console.error('Goals API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json({ error: 'Missing goal id' }, { status: 400 });
    }
    
    // Build update object
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.target_amount !== undefined) updateData.target_amount = body.target_amount;
    if (body.current_amount !== undefined) updateData.current_amount = body.current_amount;
    if (body.deadline !== undefined) updateData.deadline = body.deadline;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.child_name !== undefined) updateData.child_name = body.child_name;
    if (body.goal_type !== undefined) updateData.goal_type = body.goal_type;
    if (body.budget_source !== undefined) updateData.budget_source = body.budget_source;
    if (body.funding_notes !== undefined) updateData.funding_notes = body.funding_notes;
    if (body.child_id !== undefined) updateData.child_id = body.child_id;
    if (body.goal_group !== undefined) updateData.goal_group = body.goal_group;
    if (body.is_flexible !== undefined) updateData.is_flexible = body.is_flexible;
    if (body.min_allocation !== undefined) updateData.min_allocation = body.min_allocation;
    if (body.monthly_allocation !== undefined) updateData.monthly_allocation = body.monthly_allocation;
    if (body.auto_adjust !== undefined) updateData.auto_adjust = body.auto_adjust;
    if (body.depends_on_goal_id !== undefined) updateData.depends_on_goal_id = body.depends_on_goal_id;
    
    updateData.updated_at = new Date().toISOString();
    
    // Update goal
    const { data: goal, error } = await supabase
      .from('goals')
      .update(updateData)
      .eq('id', body.id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating goal:', error);
      return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
    }
    
    return NextResponse.json({ goal });
  } catch (error) {
    console.error('Goals API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Missing goal id' }, { status: 400 });
    }
    
    // Soft delete (set status to cancelled)
    const { error } = await supabase
      .from('goals')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error deleting goal:', error);
      return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Goals API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
