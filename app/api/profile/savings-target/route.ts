import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const amount = Number(body?.monthly_savings_target);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'סכום לא תקין' }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from('user_financial_profile')
      .upsert(
        {
          user_id: user.id,
          monthly_savings_target: amount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (error) {
      console.error('savings-target PATCH error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, monthly_savings_target: amount });
  } catch (error: any) {
    console.error('PATCH /api/profile/savings-target error:', error);
    return NextResponse.json({ error: error?.message || 'שגיאה' }, { status: 500 });
  }
}
