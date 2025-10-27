import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statementId = searchParams.get('statementId');

    if (!statementId) {
      return NextResponse.json({ error: 'Missing statementId' }, { status: 400 });
    }

    const supabase = await createClient();

    // קבלת פרטי המשתמש
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // בדיקת סטטוס ה-statement
    const { data: statement, error } = await supabase
      .from('uploaded_statements')
      .select('id, status, transactions_extracted, error_message, processed_at')
      .eq('id', statementId)
      .eq('user_id', user.id)
      .single();

    if (error || !statement) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
    }

    // אם הסתיים, לשלוף גם את התנועות
    if (statement.status === 'completed') {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('source', 'ocr')
        .gte('created_at', statement.processed_at || new Date(Date.now() - 3600000).toISOString())
        .order('created_at', { ascending: false })
        .limit(statement.transactions_extracted || 100);

      return NextResponse.json({
        status: statement.status,
        transactions_extracted: statement.transactions_extracted,
        transactions: transactions || [],
        processed_at: statement.processed_at,
      });
    }

    // במקרה של עיבוד או שגיאה
    return NextResponse.json({
      status: statement.status,
      error_message: statement.error_message,
      transactions_extracted: statement.transactions_extracted,
    });

  } catch (error: any) {
    console.error('Check status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

