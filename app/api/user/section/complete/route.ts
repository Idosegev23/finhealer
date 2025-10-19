import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// API endpoint to mark a data section as completed
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subsection } = await request.json();
    
    if (!subsection) {
      return NextResponse.json({ error: 'subsection is required' }, { status: 400 });
    }

    // Check if section exists
    const { data: existing } = await supabase
      .from('user_data_sections')
      .select('id')
      .eq('user_id', user.id)
      .eq('subsection', subsection)
      .single();

    if (existing) {
      // Update existing
      const { error } = await (supabase as any)
        .from('user_data_sections')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('subsection', subsection);

      if (error) {
        console.error('Error updating section:', error);
        return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
      }
    } else {
      // Create new
      const { error } = await (supabase as any)
        .from('user_data_sections')
        .insert({
          user_id: user.id,
          section_type: 'financial_info',
          subsection: subsection,
          completed: true,
          completed_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error creating section:', error);
        return NextResponse.json({ error: 'Failed to create section' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Section complete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

