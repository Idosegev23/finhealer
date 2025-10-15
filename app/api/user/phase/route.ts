import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { phase } = await request.json();

    // Validate phase
    const validPhases = ['reflection', 'data_collection', 'behavior', 'budget', 'goals', 'monitoring'];
    if (!validPhases.includes(phase)) {
      return NextResponse.json(
        { error: 'Invalid phase' },
        { status: 400 }
      );
    }

    // Update user phase
    const { error } = await supabase
      .from('users')
      .update({ phase })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating phase:', error);
      return NextResponse.json(
        { error: 'Failed to update phase' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, phase });

  } catch (error) {
    console.error('Phase update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

