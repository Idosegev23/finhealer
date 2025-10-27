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

    for (const tx of transactions) {
      try {
        // המרת expense_frequency ל-DB enum אם צריך
        const expenseFrequency = tx.expense_frequency || 'one_time'

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
            payment_method: tx.payment_method || 'cash',
            source: 'ocr',
            status: auto_create ? 'confirmed' : 'proposed',
            notes: tx.description || '',
            original_description: tx.description || '',
            auto_categorized: true,
            confidence_score: tx.confidence || 0.5,
            currency: 'ILS',
          })
          .select()
          .single()

        if (txError) {
          console.error('❌ Error creating transaction:', txError)
          errors.push({ transaction: tx, error: txError.message })
          continue
        }

        // עדכן את הקבלה לקשר לטרנזקציה
        if (receipt_id && transaction) {
          await supabase
            .from('receipts')
            .update({ transaction_id: transaction.id })
            .eq('id', receipt_id)
        }

        createdTransactions.push(transaction)
      } catch (err: any) {
        console.error('❌ Error processing transaction:', err)
        errors.push({ transaction: tx, error: err.message })
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

