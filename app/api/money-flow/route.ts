import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateMoneyFlow, canIAfford, compareToLastMonth } from '@/lib/finance/money-flow';

export const dynamic = 'force-dynamic';

/**
 * GET /api/money-flow?month=YYYY-MM
 * Returns unified money flow for the month
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const month = request.nextUrl.searchParams.get('month') || undefined;
    const flow = await calculateMoneyFlow(user.id, month);

    return NextResponse.json({ success: true, flow });
  } catch (error: any) {
    console.error('[MoneyFlow] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/money-flow
 * Actions: afford_check, compare_months
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    if (action === 'afford_check') {
      const { amount, description } = body;
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: 'Amount required' }, { status: 400 });
      }
      const result = await canIAfford(user.id, amount, description);
      return NextResponse.json({ success: true, result });
    }

    if (action === 'compare_months') {
      const result = await compareToLastMonth(user.id);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[MoneyFlow] POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
