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

    const { loans } = await request.json();

    // Delete existing loans
    await (supabase as any)
      .from('loans')
      .delete()
      .eq('user_id', user.id);

    // Insert new loans
    if (loans && loans.length > 0) {
      const loansToInsert = loans.map((loan: any) => ({
        user_id: user.id,
        lender_name: loan.lender_name,
        loan_number: loan.loan_number || null,
        loan_type: loan.loan_type,
        original_amount: loan.original_amount || 0,
        current_balance: loan.current_balance || 0,
        monthly_payment: loan.monthly_payment || 0,
        interest_rate: loan.interest_rate || null,
        start_date: loan.start_date || null,
        end_date: loan.end_date || null,
        remaining_payments: loan.remaining_payments || null,
        notes: loan.notes || null,
        active: true
      }));

      const { error } = await (supabase as any)
        .from('loans')
        .insert(loansToInsert);

      if (error) {
        console.error('Error inserting loans:', error);
        return NextResponse.json(
          { error: 'Failed to save loans' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Loans API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
