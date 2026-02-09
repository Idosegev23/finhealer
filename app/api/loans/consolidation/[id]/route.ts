/**
 * GET /api/loans/consolidation/[id]
 * קבלת פרטי בקשת איחוד
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientServerClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    const { id } = params;
    
    // שלוף בקשה
    const { data: request, error } = await supabase
      .from('loan_consolidation_requests')
      .select(`
        *,
        user:users(full_name, email, phone)
      `)
      .eq('id', id)
      .single();
    
    if (error || !request) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }
    
    // בדוק הרשאות - רק בעל הבקשה או admin
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single();
    
    const isAdmin = !!adminCheck;
    const isOwner = request.user_id === user.id;
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    // שלוף את ההלוואות
    const { data: loans } = await supabase
      .from('loans')
      .select('*')
      .in('id', request.loan_ids);
    
    return NextResponse.json({
      data: {
        ...request,
        loans: loans || [],
      }
    });
    
  } catch (error) {
    console.error('Error in GET /api/loans/consolidation/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
