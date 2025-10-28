import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route: /api/income/create
 * מטרה: יצירת מקור הכנסה חדש
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const {
      source_name,
      employment_type,
      gross_amount,
      net_amount,
      notes,
      is_primary,
      active,
    } = body;

    // Validate
    if (!source_name || !employment_type || !gross_amount || !net_amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert
    const { data, error } = await (supabase as any)
      .from('income_sources')
      .insert({
        user_id: user.id,
        source_name,
        employment_type,
        gross_amount,
        net_amount,
        actual_bank_amount: net_amount, // Default
        notes,
        is_primary: is_primary ?? false,
        active: active ?? true,
        payment_frequency: 'monthly',
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to create income source' }, { status: 500 });
    }

    return NextResponse.json({ success: true, income: data });
  } catch (error) {
    console.error('Create income error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

