import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route: POST /api/transactions/link
 * מטרה: קישור תנועה parent (בנק) עם details (אשראי)
 * 
 * Body: {
 *   parentTransactionId: string - התנועה הראשית (מדוח בנק)
 *   detailTransactionIds: string[] - התנועות המפורטות (מדוח אשראי)
 *   documentId?: string - המסמך שממנו הגיע הפירוט
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // בדיקת אימות
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { parentTransactionId, detailTransactionIds, documentId } = body;

    // ולידציה
    if (!parentTransactionId) {
      return NextResponse.json(
        { error: 'Missing parentTransactionId' },
        { status: 400 }
      );
    }

    if (!detailTransactionIds || !Array.isArray(detailTransactionIds) || detailTransactionIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid detailTransactionIds' },
        { status: 400 }
      );
    }

    // 1. שלוף את התנועה הראשית
    const { data: parentTx, error: parentError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', parentTransactionId)
      .eq('user_id', user.id)
      .single();

    if (parentError || !parentTx) {
      return NextResponse.json(
        { error: 'Parent transaction not found' },
        { status: 404 }
      );
    }

    // 2. שלוף את התנועות המפורטות
    const { data: detailTxs, error: detailError } = await supabase
      .from('transactions')
      .select('*')
      .in('id', detailTransactionIds)
      .eq('user_id', user.id);

    if (detailError || !detailTxs || detailTxs.length === 0) {
      return NextResponse.json(
        { error: 'Detail transactions not found' },
        { status: 404 }
      );
    }

    // 3. חישוב סה"כ פירוט
    const detailsTotal = detailTxs.reduce((sum: number, tx: any) => {
      return sum + parseFloat(tx.amount || 0);
    }, 0);

    // 4. העתק את התנועות המפורטות ל-transaction_details
    const detailsToInsert = detailTxs.map((tx: any) => ({
      parent_transaction_id: parentTransactionId,
      user_id: user.id,
      amount: tx.amount,
      vendor: tx.vendor,
      date: tx.tx_date || tx.date,
      notes: tx.notes,
      category: tx.category,
      expense_category: tx.expense_category,
      expense_type: tx.expense_type,
      payment_method: tx.payment_method,
      confidence_score: tx.confidence_score,
    }));

    const { error: insertError } = await supabase
      .from('transaction_details')
      .insert(detailsToInsert as any);

    if (insertError) {
      console.error('Failed to insert details:', insertError);
      return NextResponse.json(
        { error: 'Failed to create transaction details' },
        { status: 500 }
      );
    }

    // 5. עדכן את התנועה הראשית
    const { error: updateParentError } = await supabase
      .from('transactions')
      .update({
        has_details: true,
        is_summary: true,
        linked_document_id: documentId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parentTransactionId);

    if (updateParentError) {
      console.error('Failed to update parent transaction:', updateParentError);
      return NextResponse.json(
        { error: 'Failed to update parent transaction' },
        { status: 500 }
      );
    }

    // 6. מחק את התנועות המפורטות המקוריות (כעת הן ב-transaction_details)
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .in('id', detailTransactionIds);

    if (deleteError) {
      console.error('Failed to delete detail transactions:', deleteError);
      // לא נכשל כאן - הקישור עצמו הצליח
    }

    // 7. שלוף את התנועה המעודכנת + פירוט
    const { data: updatedParent } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', parentTransactionId)
      .single();

    const { data: linkedDetails } = await supabase
      .from('transaction_details')
      .select('*')
      .eq('parent_transaction_id', parentTransactionId);

    return NextResponse.json({
      success: true,
      message: 'התנועות קושרו בהצלחה',
      parentTransaction: updatedParent,
      details: linkedDetails || [],
      detailsCount: linkedDetails?.length || 0,
      detailsTotal: detailsTotal.toFixed(2),
    });
  } catch (error: any) {
    console.error('Link transactions error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * API Route: DELETE /api/transactions/link
 * מטרה: ניתוק קישור (unlink) - החזרת הפירוט לתנועות נפרדות
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // בדיקת אימות
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parentTransactionId = searchParams.get('parentId');

    if (!parentTransactionId) {
      return NextResponse.json(
        { error: 'Missing parentId parameter' },
        { status: 400 }
      );
    }

    // 1. שלוף את הפירוט
    const { data: details, error: detailsError } = await supabase
      .from('transaction_details')
      .select('*')
      .eq('parent_transaction_id', parentTransactionId)
      .eq('user_id', user.id);

    if (detailsError || !details || details.length === 0) {
      return NextResponse.json(
        { error: 'No details found for this transaction' },
        { status: 404 }
      );
    }

    // 2. המר את הפירוט חזרה לתנועות רגילות
    const transactionsToRestore = details.map((detail: any) => ({
      user_id: user.id,
      type: 'expense',
      amount: detail.amount,
      vendor: detail.vendor,
      date: detail.date,
      category: detail.category,
      expense_category: detail.expense_category,
      expense_type: detail.expense_type,
      payment_method: detail.payment_method,
      notes: detail.notes,
      source: 'ocr',
      status: 'proposed', // מחזיר אותן למצב המתנה לאישור
      confidence_score: detail.confidence_score,
    }));

    const { error: restoreError } = await supabase
      .from('transactions')
      .insert(transactionsToRestore as any);

    if (restoreError) {
      console.error('Failed to restore transactions:', restoreError);
      return NextResponse.json(
        { error: 'Failed to restore detail transactions' },
        { status: 500 }
      );
    }

    // 3. מחק את הפירוט
    const { error: deleteDetailsError } = await supabase
      .from('transaction_details')
      .delete()
      .eq('parent_transaction_id', parentTransactionId);

    if (deleteDetailsError) {
      console.error('Failed to delete details:', deleteDetailsError);
    }

    // 4. עדכן את התנועה הראשית
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        has_details: false,
        linked_document_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parentTransactionId);

    if (updateError) {
      console.error('Failed to update parent:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: 'הקישור נותק והפירוט הוחזר לתנועות נפרדות',
      restoredCount: transactionsToRestore.length,
    });
  } catch (error: any) {
    console.error('Unlink transactions error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

