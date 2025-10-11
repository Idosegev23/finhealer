import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - שליפת יעדים
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching goals:', error);
      return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
    }

    return NextResponse.json({ goals: data || [] });

  } catch (error) {
    console.error('Goals GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - יצירת/עדכון יעד
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      id, 
      name, 
      target_amount, 
      current_amount = 0,
      deadline,
      child_name,
      priority = 0,
      description,
      status = 'active'
    } = body;

    // Validation
    if (!name || !target_amount) {
      return NextResponse.json(
        { error: 'Missing required fields: name, target_amount' },
        { status: 400 }
      );
    }

    if (target_amount <= 0) {
      return NextResponse.json(
        { error: 'Target amount must be positive' },
        { status: 400 }
      );
    }

    // Update או Insert
    if (id) {
      // Update
      const { data, error } = await (supabase as any)
        .from('goals')
        .update({
          name,
          target_amount,
          current_amount,
          deadline,
          child_name,
          priority,
          description,
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating goal:', error);
        return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
      }

      return NextResponse.json({ goal: data });
    } else {
      // Insert
      const { data, error } = await (supabase as any)
        .from('goals')
        .insert({
          user_id: user.id,
          name,
          target_amount,
          current_amount,
          deadline,
          child_name,
          priority,
          description,
          status
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating goal:', error);
        return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
      }

      // בדיקה אם זה היעד הראשון - אם כן, עדכן phase ל-monitoring
      const { data: goalsCount } = await supabase
        .from('goals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { data: userData } = await supabase
        .from('users')
        .select('phase')
        .eq('id', user.id)
        .single();
      
      const userPhase = (userData as any)?.phase;

      if (userPhase === 'goals' && goalsCount && (goalsCount as any).count === 1) {
        // יעד ראשון - מעבר ל-monitoring
        await (supabase as any)
          .from('users')
          .update({ phase: 'monitoring' })
          .eq('id', user.id);

        await (supabase as any)
          .from('alerts')
          .insert({
            user_id: user.id,
            type: 'welcome',
            message: `מדהים! 🌟 הגדרת את היעד הראשון שלך. עברת לשלב האחרון: בקרה רציפה. מעכשיו אני מלווה אותך לאורך זמן עם התראות, דוחות ותובנות!`,
            status: 'sent',
            params: {
              from_phase: 'goals',
              to_phase: 'monitoring',
              first_goal: data.name
            }
          });
      }

      return NextResponse.json({ goal: data }, { status: 201 });
    }

  } catch (error) {
    console.error('Goals POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


