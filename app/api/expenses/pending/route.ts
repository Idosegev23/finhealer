import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API Route: GET /api/expenses/pending
 * מטרה: שליפת תנועות ממתינות לאישור (הכנסות + הוצאות)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    // בדיקת אימות
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // שליפת כל התנועות הממתינות (הכנסות + הוצאות)
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'proposed')
      .eq('source', 'ocr')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending transactions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // הפרדה לפי סוג
    const income = (transactions as any[] || []).filter((t: any) => t.type === 'income');
    const expenses = (transactions as any[] || []).filter((t: any) => t.type === 'expense');

    return NextResponse.json({
      success: true,
      expenses: transactions || [], // Keep 'expenses' for backward compatibility
      income,
      transactions: transactions || [],
      count: transactions?.length || 0,
      incomeCount: income.length,
      expensesCount: expenses.length,
    });
  } catch (error: any) {
    console.error('Pending transactions error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

