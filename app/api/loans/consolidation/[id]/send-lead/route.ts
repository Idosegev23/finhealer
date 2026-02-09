/**
 * POST /api/loans/consolidation/[id]/send-lead
 * שליחת ליד לגדי ידנית (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientServerClient } from '@/lib/supabase/server';
import { sendLeadToAdvisor } from '@/lib/loans/lead-generator';

export async function POST(
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
    
    // בדוק שהמשתמש הוא admin
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single();
    
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Forbidden - Admin only' },
        { status: 403 }
      );
    }
    
    const { id } = params;
    
    // בדוק שהבקשה קיימת ובסטטוס מתאים
    const { data: request, error: fetchError } = await supabase
      .from('loan_consolidation_requests')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !request) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }
    
    if (request.status !== 'documents_received' && request.status !== 'sent_to_advisor') {
      return NextResponse.json(
        { error: 'Request must be in documents_received or sent_to_advisor status' },
        { status: 400 }
      );
    }
    
    // שלח ליד
    const success = await sendLeadToAdvisor(id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send lead' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Lead sent successfully to advisor',
    });
    
  } catch (error) {
    console.error('Error in POST /api/loans/consolidation/[id]/send-lead:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
