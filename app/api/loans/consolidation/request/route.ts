/**
 * POST /api/loans/consolidation/request
 * יצירת בקשת איחוד הלוואות חדשה
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClientServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { loan_ids, total_monthly_payment, total_balance } = body;
    
    if (!loan_ids || !Array.isArray(loan_ids) || loan_ids.length === 0) {
      return NextResponse.json(
        { error: 'loan_ids is required and must be a non-empty array' },
        { status: 400 }
      );
    }
    
    // בדוק שכל ההלוואות שייכות למשתמש
    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select('id')
      .in('id', loan_ids)
      .eq('user_id', user.id);
    
    if (loansError || !loans || loans.length !== loan_ids.length) {
      return NextResponse.json(
        { error: 'Invalid loan_ids' },
        { status: 400 }
      );
    }
    
    // צור בקשה
    const { data: request, error: createError } = await supabase
      .from('loan_consolidation_requests')
      .insert({
        user_id: user.id,
        loan_ids,
        loans_count: loan_ids.length,
        total_monthly_payment,
        total_balance,
        documents_needed: loan_ids.length,
        status: 'pending_documents',
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Failed to create consolidation request:', createError);
      return NextResponse.json(
        { error: 'Failed to create request' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ data: request }, { status: 201 });
    
  } catch (error) {
    console.error('Error in POST /api/loans/consolidation/request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
