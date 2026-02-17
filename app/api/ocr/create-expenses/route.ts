// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { transactions, receipt_id, auto_create } = body

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
    }

    console.log('💳 Creating expenses from OCR:', {
      userId: user.id,
      transactionsCount: transactions.length,
      receiptId: receipt_id,
      autoCreate,
    })

    const createdTransactions = []
    const errors = []

    // Helper function to calculate string similarity
    function calculateStringSimilarity(str1: string, str2: string): number {
      const words1 = new Set(str1.split(/\s+/));
      const words2 = new Set(str2.split(/\s+/));
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      return intersection.size / union.size;
    }

    // Get receipt info to determine payment method
    let receiptPaymentMethod: string | null = null;
    let receiptInfo: any = null;
    if (receipt_id) {
      const { data: receipt } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', receipt_id)
        .single();
      
      receiptInfo = receipt;
      receiptPaymentMethod = receipt?.payment_method || null;
    }

    for (const tx of transactions) {
      try {
        const paymentMethod = tx.payment_method || receiptPaymentMethod || 'cash';
        const isCashExpense = paymentMethod === 'cash';
        
        // קבלה במזומן → יוצרת תנועה עם is_cash_expense = true
        // קבלה עם אשראי → מחפשת transaction_details להתחבר אליו
        if (isCashExpense) {
          // Cash expense - create transaction directly
          const expenseFrequency = tx.expense_frequency || 'one_time';

          const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .insert({
              user_id: user.id,
              type: 'expense',
              amount: tx.amount,
              vendor: tx.vendor,
              date: tx.date || new Date().toISOString().split('T')[0],
              tx_date: tx.date || new Date().toISOString().split('T')[0],
              category: tx.category || 'other',
              detailed_category: tx.detailed_category,
              expense_frequency: expenseFrequency,
              payment_method: paymentMethod,
              source: 'ocr',
              status: auto_create ? 'confirmed' : 'proposed',
              notes: tx.description || '',
              original_description: tx.description || '',
              auto_categorized: true,
              confidence_score: tx.confidence || 0.5,
              currency: 'ILS',
              // ⭐ Cash expense fields
              is_cash_expense: true, // לא נראה בדוח בנק אבל חשוב לאומדן הוצאות
              is_source_transaction: false, // לא מדוח בנק
            })
            .select()
            .single();

          if (txError) {
            console.error('❌ Error creating cash transaction:', txError);
            errors.push({ transaction: tx, error: txError.message });
            continue;
          }

          // עדכן את הקבלה לקשר לטרנזקציה
          if (receipt_id && transaction) {
            await supabase
              .from('receipts')
              .update({ 
                transaction_id: transaction.id,
                payment_method: paymentMethod,
                is_cash_expense: true,
              })
              .eq('id', receipt_id);
          }

          createdTransactions.push(transaction);
        } else {
          // Credit card expense - try to match with transaction_details
          // מחפש transaction_details של אשראי להתחבר אליו
          const txDate = tx.date || new Date().toISOString().split('T')[0];
          const txAmount = parseFloat(tx.amount);
          
          // Search for matching transaction_details (credit statement details)
          const { data: matchingDetails } = await supabase
            .from('transaction_details')
            .select('*, parent_transaction_id')
            .eq('user_id', user.id)
            .eq('payment_method', 'credit_card')
            .gte('amount', txAmount * 0.95) // Within 5% tolerance
            .lte('amount', txAmount * 1.05)
            .gte('tx_date', new Date(new Date(txDate).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // ±7 days
            .lte('tx_date', new Date(new Date(txDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .is('receipt_id', null) // Not already linked to a receipt
            .order('tx_date', { ascending: false })
            .limit(5);

          let matchedDetail: any = null;
          if (matchingDetails && matchingDetails.length > 0) {
            // Find best match by vendor similarity
            for (const detail of matchingDetails) {
              const vendorSimilarity = calculateStringSimilarity(
                (tx.vendor || '').toLowerCase(),
                (detail.vendor || '').toLowerCase()
              );
              if (vendorSimilarity > 0.5) {
                matchedDetail = detail;
                break;
              }
            }
            
            // If no vendor match, use first one by amount
            if (!matchedDetail && matchingDetails.length > 0) {
              matchedDetail = matchingDetails[0];
            }
          }

          if (matchedDetail) {
            // Match found - link receipt to transaction_detail
            console.log(`🔗 Linking receipt to transaction_detail: ${matchedDetail.id}`);
            
            await supabase
              .from('receipts')
              .update({ 
                transaction_detail_id: matchedDetail.id,
                transaction_id: matchedDetail.parent_transaction_id, // Also link to parent transaction
                payment_method: paymentMethod,
                is_cash_expense: false,
              })
              .eq('id', receipt_id);

            // Update transaction_detail to link receipt
            await supabase
              .from('transaction_details')
              .update({ receipt_id: receipt_id })
              .eq('id', matchedDetail.id);

            createdTransactions.push({
              id: matchedDetail.id,
              type: 'detail',
              matched: true,
              detail_id: matchedDetail.id,
              transaction_id: matchedDetail.parent_transaction_id,
            });
          } else {
            // No match found - create as cash expense (fallback)
            // או אפשר ליצור transaction_detail חדש שממתין להתאמה
            console.log(`⚠️  No matching credit detail found for receipt, creating as cash expense`);
            
            const expenseFrequency = tx.expense_frequency || 'one_time';

            const { data: transaction, error: txError } = await supabase
              .from('transactions')
              .insert({
                user_id: user.id,
                type: 'expense',
                amount: tx.amount,
                vendor: tx.vendor,
                date: tx.date || new Date().toISOString().split('T')[0],
                tx_date: tx.date || new Date().toISOString().split('T')[0],
                category: tx.category || 'other',
                detailed_category: tx.detailed_category,
                expense_frequency: expenseFrequency,
                payment_method: paymentMethod,
                source: 'ocr',
                status: auto_create ? 'confirmed' : 'proposed',
                notes: tx.description || '',
                original_description: tx.description || '',
                auto_categorized: true,
                confidence_score: tx.confidence || 0.5,
                currency: 'ILS',
                is_cash_expense: false,
                is_source_transaction: false,
              })
              .select()
              .single();

            if (txError) {
              console.error('❌ Error creating transaction:', txError);
              errors.push({ transaction: tx, error: txError.message });
              continue;
            }

            if (receipt_id && transaction) {
              await supabase
                .from('receipts')
                .update({ 
                  transaction_id: transaction.id,
                  payment_method: paymentMethod,
                  is_cash_expense: false,
                  awaiting_bank_statement: true, // ממתין לדוח בנק/אשראי
                })
                .eq('id', receipt_id);
            }

            createdTransactions.push(transaction);
          }
        }
      } catch (err: any) {
        console.error('❌ Error processing transaction:', err);
        errors.push({ transaction: tx, error: err.message });
      }
    }

    console.log('✅ Expenses created:', {
      success: createdTransactions.length,
      failed: errors.length,
    })

    return NextResponse.json({
      success: true,
      created: createdTransactions.length,
      failed: errors.length,
      transactions: createdTransactions,
      errors: errors.length > 0 ? errors : undefined,
      message: `נוצרו ${createdTransactions.length} הוצאות${errors.length > 0 ? `, ${errors.length} נכשלו` : ''}`,
    })

  } catch (error: any) {
    console.error('❌ Create expenses error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create expenses', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}

