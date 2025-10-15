import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching loans:', error);
      return NextResponse.json({ error: 'Failed to fetch loans' }, { status: 500 });
    }

    // Transform to camelCase for frontend
    const loans = (data || []).map((loan: any) => ({
      id: loan.id,
      lenderName: loan.lender_name,
      loanNumber: loan.loan_number,
      loanType: loan.loan_type,
      originalAmount: loan.original_amount,
      currentBalance: loan.current_balance,
      monthlyPayment: loan.monthly_payment,
      interestRate: loan.interest_rate,
      startDate: loan.start_date,
      endDate: loan.end_date,
      remainingPayments: loan.remaining_payments,
      notes: loan.notes,
      statementUrl: loan.statement_url,
      active: loan.active,
      createdAt: loan.created_at,
      updatedAt: loan.updated_at,
    }));

    return NextResponse.json({ loans });

  } catch (error) {
    console.error('Loans fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { loans } = await request.json();

    if (!loans || !Array.isArray(loans)) {
      return NextResponse.json({ error: 'Invalid loans data' }, { status: 400 });
    }

    // First, mark all existing loans as inactive
    await (supabase as any)
      .from('loans')
      .update({ active: false })
      .eq('user_id', user.id);

    // Then insert new loans
    const loansToInsert = loans.map((loan: any) => ({
      user_id: user.id,
      lender_name: loan.lenderName,
      loan_number: loan.loanNumber,
      loan_type: loan.loanType,
      original_amount: loan.originalAmount || 0,
      current_balance: loan.currentBalance || 0,
      monthly_payment: loan.monthlyPayment || 0,
      interest_rate: loan.interestRate,
      start_date: loan.startDate,
      end_date: loan.endDate,
      remaining_payments: loan.remainingPayments,
      notes: loan.notes,
      active: true,
    }));

    const { data, error } = await (supabase as any)
      .from('loans')
      .insert(loansToInsert)
      .select();

    if (error) {
      console.error('Error saving loans:', error);
      return NextResponse.json({ error: 'Failed to save loans' }, { status: 500 });
    }

    // Update user_data_sections to mark loans as completed
    await (supabase as any)
      .from('user_data_sections')
      .update({ 
        completed: true,
        completed_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('section_type', 'financial_info')
      .eq('subsection', 'loans');

    return NextResponse.json({ 
      success: true, 
      loans: data 
    });

  } catch (error) {
    console.error('Loans save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

