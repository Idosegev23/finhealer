import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route: /api/documents/status
 * מטרה: בדיקת סטטוס עיבוד מסמך
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get statement ID from query
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing statement ID' }, { status: 400 });
    }

    // Fetch statement
    const { data: statement, error: fetchError } = await supabase
      .from('uploaded_statements')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !statement) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
    }

    // Type assertion for statement
    const statementData = statement as any;

    // If completed, fetch extracted transactions
    let transactions = null;
    if (statementData.status === 'completed') {
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('source', 'ocr')
        .order('tx_date', { ascending: false })
        .limit(100);

      transactions = txData || [];
    }

    return NextResponse.json({
      id: statementData.id,
      status: statementData.status,
      document_type: statementData.document_type,
      file_name: statementData.file_name,
      transactions_extracted: statementData.transactions_extracted || 0,
      processed_at: statementData.processed_at,
      error_message: statementData.error_message,
      transactions: transactions,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

