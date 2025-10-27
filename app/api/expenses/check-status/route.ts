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

    // Type assertion כי Supabase לא מזהה את הטיפוסים אוטומטית
    const statementData = statement as any;

    // אם הסתיים, לשלוף גם את התנועות
    if (statementData.status === 'completed') {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('source', 'ocr')
        .gte('created_at', statementData.processed_at || new Date(Date.now() - 3600000).toISOString())
        .order('created_at', { ascending: false })
        .limit(statementData.transactions_extracted || 100);

      return NextResponse.json({
        status: statementData.status,
        transactions_extracted: statementData.transactions_extracted,
        transactions: transactions || [],
        processed_at: statementData.processed_at,
      });
    }

    // במקרה של עיבוד או שגיאה
    return NextResponse.json({
      status: statementData.status,
      error_message: statementData.error_message,
      transactions_extracted: statementData.transactions_extracted,
    });

  } catch (error: any) {
    console.error('Check status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

