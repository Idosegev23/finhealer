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
    // כולל גם 'pending' (מ-WhatsApp) וגם 'proposed' (מ-OCR אחר)
    // כולל גם כל ה-sources (ocr, whatsapp, manual)
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'proposed'])
      .order('created_at', { ascending: false });

    // ⭐ שליפת receipt_number מ-receipts table עבור תנועות עם receipt_id
    const receiptIds = (transactions || [])
      .map((tx: any) => tx.receipt_id)
      .filter((id: string | null) => id !== null && id !== '');

    let receiptsMap: Record<string, string> = {};
    if (receiptIds.length > 0) {
      const { data: receipts } = await supabase
        .from('receipts')
        .select('id, receipt_number')
        .in('id', receiptIds);

      receiptsMap = (receipts || []).reduce((acc: Record<string, string>, r: any) => {
        if (r.receipt_number) {
          acc[r.id] = r.receipt_number;
        }
        return acc;
      }, {});
    }

    if (error) {
      console.error('Error fetching pending transactions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${transactions?.length || 0} pending transactions for user ${user.id}`);

    // ⭐ הוספת receipt_number ובדיקת כפילויות
    const transactionsWithDuplicates = (transactions || []).map((tx: any) => {
      // הוסף receipt_number מ-receipts table או מ-transaction עצמו
      const receiptNumber = tx.receipt_id && receiptsMap[tx.receipt_id] 
        ? receiptsMap[tx.receipt_id] 
        : (tx.receipt_number || null);

      return {
        ...tx,
        receipt_number: receiptNumber,
        receipt_id: tx.receipt_id || null,
        duplicate_warning: false, // יועדכן בהמשך
      };
    });

    // ⭐ בדיקת כפילויות - תנועות מאושרות עם אותו receipt_number
    const receiptNumbers = transactionsWithDuplicates
      .map((tx: any) => tx.receipt_number)
      .filter((num: string | null) => num !== null && num !== '');

    if (receiptNumbers.length > 0) {
      const { data: duplicateTransactions } = await supabase
        .from('transactions')
        .select('receipt_number, receipt_id')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .in('receipt_number', receiptNumbers);

      // הוסף אזהרה על כפילויות
      const duplicateNumbers = new Set(
        (duplicateTransactions || []).map((dt: any) => dt.receipt_number || dt.receipt_id)
      );

      transactionsWithDuplicates.forEach((tx: any) => {
        if (tx.receipt_number && duplicateNumbers.has(tx.receipt_number)) {
          tx.duplicate_warning = true;
        }
        // גם בדיקה דרך receipt_id
        if (tx.receipt_id && duplicateNumbers.has(tx.receipt_id)) {
          tx.duplicate_warning = true;
        }
      });
    }

    // הפרדה לפי סוג
    const income = transactionsWithDuplicates.filter((t: any) => t.type === 'income');
    const expenses = transactionsWithDuplicates.filter((t: any) => t.type === 'expense');

    return NextResponse.json({
      success: true,
      expenses: transactionsWithDuplicates, // כולל receipt_number ו-duplicate_warning
      income,
      transactions: transactionsWithDuplicates,
      count: transactionsWithDuplicates?.length || 0,
      incomeCount: income.length,
      expensesCount: expenses.length,
    });
  } catch (error: any) {
    console.error('Pending transactions error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

