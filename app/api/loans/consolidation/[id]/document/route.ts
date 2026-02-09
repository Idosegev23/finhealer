/**
 * POST /api/loans/consolidation/[id]/document
 * העלאת מסמך להלוואה
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientServerClient } from '@/lib/supabase/server';
import type { LoanDocument } from '@/types/loans';

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
    
    const { id } = params;
    const body = await req.json();
    const { filename, url, loan_id } = body;
    
    if (!filename || !url) {
      return NextResponse.json(
        { error: 'filename and url are required' },
        { status: 400 }
      );
    }
    
    // שלוף את הבקשה
    const { data: request, error: fetchError } = await supabase
      .from('loan_consolidation_requests')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    
    if (fetchError || !request) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }
    
    if (request.status !== 'pending_documents') {
      return NextResponse.json(
        { error: 'Request is not accepting documents' },
        { status: 400 }
      );
    }
    
    // הוסף מסמך
    const documents = (request.loan_documents as LoanDocument[]) || [];
    const newDocument: LoanDocument = {
      filename,
      url,
      loan_id: loan_id || '',
      uploaded_at: new Date().toISOString(),
    };
    
    documents.push(newDocument);
    
    const documentsReceived = documents.length;
    const newStatus = documentsReceived >= request.documents_needed 
      ? 'documents_received' 
      : 'pending_documents';
    
    // עדכן בקשה
    const { data: updated, error: updateError } = await supabase
      .from('loan_consolidation_requests')
      .update({
        loan_documents: documents,
        documents_received: documentsReceived,
        status: newStatus,
      })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Failed to update request:', updateError);
      return NextResponse.json(
        { error: 'Failed to add document' },
        { status: 500 }
      );
    }
    
    // אם התקבלו כל המסמכים, שלח ליד לגדי
    if (newStatus === 'documents_received') {
      // Import dynamically to avoid circular dependency
      const { sendLeadToAdvisor } = await import('@/lib/loans/lead-generator');
      await sendLeadToAdvisor(id);
    }
    
    return NextResponse.json({
      data: updated,
      all_documents_received: newStatus === 'documents_received',
    });
    
  } catch (error) {
    console.error('Error in POST /api/loans/consolidation/[id]/document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
