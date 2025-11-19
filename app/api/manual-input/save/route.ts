import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface IncomeSource {
  source_name: string;
  net_amount: number;
  frequency: 'monthly' | 'weekly' | 'biweekly';
}

interface FixedExpense {
  name: string;
  amount: number;
  category: string;
  frequency: 'monthly' | 'weekly' | 'biweekly';
}

interface Loan {
  loan_type: string;
  current_balance: number;
  monthly_payment: number;
  interest_rate: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, incomeSources, fixedExpenses, loans } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Save income sources
    if (incomeSources && incomeSources.length > 0) {
      const incomeData = incomeSources.map((income: IncomeSource) => ({
        user_id: userId,
        source_name: income.source_name,
        employment_type: 'salary', // Default
        net_amount: income.net_amount,
        frequency: income.frequency,
        active: true,
      }));

      const { error: incomeError } = await supabase
        .from('income_sources')
        .insert(incomeData);

      if (incomeError) {
        console.error('Error saving income sources:', incomeError);
        throw new Error('Failed to save income sources');
      }
    }

    // 2. Save fixed expenses as transactions
    if (fixedExpenses && fixedExpenses.length > 0) {
      // Create synthetic transactions for the past 30 days
      const today = new Date();
      const transactions = [];

      for (const expense of fixedExpenses as FixedExpense[]) {
        // Calculate how many times to add based on frequency
        let occurrences = 1;
        if (expense.frequency === 'weekly') {
          occurrences = 4; // 4 weeks
        } else if (expense.frequency === 'biweekly') {
          occurrences = 2; // 2 times
        }

        for (let i = 0; i < occurrences; i++) {
          const daysBack = expense.frequency === 'weekly' ? i * 7 : 
                          expense.frequency === 'biweekly' ? i * 14 : 
                          0;
          
          const transactionDate = new Date(today);
          transactionDate.setDate(transactionDate.getDate() - daysBack);

          transactions.push({
            user_id: userId,
            date: transactionDate.toISOString().split('T')[0],
            vendor: expense.name,
            amount: expense.amount,
            type: 'expense',
            payment_method: 'manual_entry',
            expense_category: expense.category || 'לא מסווג',
            expense_type: 'fixed',
            status: 'confirmed',
            source: 'manual_input',
          });
        }
      }

      const { error: transactionsError } = await supabase
        .from('transactions')
        .insert(transactions);

      if (transactionsError) {
        console.error('Error saving transactions:', transactionsError);
        throw new Error('Failed to save fixed expenses');
      }
    }

    // 3. Save loans
    if (loans && loans.length > 0) {
      const loansData = loans.map((loan: Loan) => ({
        user_id: userId,
        loan_type: loan.loan_type,
        lender: 'Unknown', // Default
        current_balance: loan.current_balance,
        monthly_payment: loan.monthly_payment,
        interest_rate: loan.interest_rate,
        active: true,
      }));

      const { error: loansError } = await supabase
        .from('loans')
        .insert(loansData);

      if (loansError) {
        console.error('Error saving loans:', loansError);
        throw new Error('Failed to save loans');
      }
    }

    // 4. Mark user as having completed manual input
    const { error: userError } = await supabase
      .from('users')
      .update({ 
        manual_input_completed: true,
        manual_input_completed_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (userError) {
      console.error('Error updating user:', userError);
    }

    return NextResponse.json({ 
      success: true,
      message: 'Data saved successfully',
      counts: {
        incomeSources: incomeSources?.length || 0,
        fixedExpenses: fixedExpenses?.length || 0,
        loans: loans?.length || 0,
      }
    });
  } catch (error) {
    console.error('Manual input save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

