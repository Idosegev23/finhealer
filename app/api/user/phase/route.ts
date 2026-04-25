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

    // Canonical order: data_collection → behavior → goals → budget → monitoring (Goals before Budget per Gadi).
    const validPhases = ['data_collection', 'behavior', 'goals', 'budget', 'monitoring'];
    // Coerce legacy `reflection` to `data_collection` rather than rejecting.
    const normalized = phase === 'reflection' ? 'data_collection' : phase;
    if (!validPhases.includes(normalized)) {
      return NextResponse.json(
        { error: 'Invalid phase' },
        { status: 400 }
      );
    }

    // Update user phase
    const { error } = await (supabase as any)
      .from('users')
      .update({ phase: normalized })
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

