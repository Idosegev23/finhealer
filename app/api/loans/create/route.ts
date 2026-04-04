import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkApiRateLimit } from '@/lib/utils/api-rate-limiter';

/**
 * API Route: /api/loans/create
 * מטרה: יצירת הלוואה חדשה
 */
export async function POST(request: NextRequest) {
  try {
    const limited = checkApiRateLimit(request, 20, 60_000);
    if (limited) return limited;
    const supabase = await createClient();

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const {
      lender_name,
      loan_type,
      original_amount,
      current_balance,
      monthly_payment,
      interest_rate,
      active,
    } = body;

    // Validate
    if (!lender_name || !loan_type || !original_amount || !current_balance || !monthly_payment) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (Number(original_amount) > 50_000_000 || Number(current_balance) > 50_000_000 || Number(monthly_payment) > 1_000_000) {
      return NextResponse.json({ error: 'סכום גבוה מדי' }, { status: 400 });
    }

    // Insert
    const { data, error } = await (supabase as any)
      .from('loans')
      .insert({
        user_id: user.id,
        lender_name,
        loan_type,
        original_amount,
        current_balance,
        monthly_payment,
        interest_rate,
        active: active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to create loan' }, { status: 500 });
    }

    return NextResponse.json({ success: true, loan: data });
  } catch (error) {
    console.error('Create loan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

