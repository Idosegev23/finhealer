import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendLoansLeadEmail, type LoanRow } from '@/lib/email/advisor-emails';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('name, email, phone')
      .eq('id', user.id)
      .maybeSingle();

    const { data: loans } = await supabase
      .from('loans')
      .select('lender_name, loan_type, loan_number, current_balance, original_amount, monthly_payment, interest_rate, remaining_payments, notes')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('current_balance', { ascending: false });

    if (!loans || loans.length === 0) {
      return NextResponse.json({ error: 'אין הלוואות פעילות בחשבון' }, { status: 400 });
    }

    const result = await sendLoansLeadEmail(
      {
        name: (profile as any)?.name || user.email?.split('@')[0] || '',
        email: (profile as any)?.email || user.email || '',
        phone: (profile as any)?.phone || '',
      },
      loans as LoanRow[],
    );

    if (!result.sent) {
      return NextResponse.json({ error: 'שליחת המייל נכשלה', reason: result.reason }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: loans.length });
  } catch (error: any) {
    console.error('Error in /api/leads/loans:', error);
    return NextResponse.json({ error: error.message || 'שגיאה' }, { status: 500 });
  }
}
