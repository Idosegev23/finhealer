// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '6') // כמה חודשים אחורה

    // חישוב תאריך התחלה (X חודשים אחורה)
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    const startDateStr = startDate.toISOString().split('T')[0]

    // שליפת כל תנועות ההכנסה מתאריך ההתחלה
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'income')
      .in('status', ['confirmed', 'proposed']) // מאושרות (confirmed) וממתינות (proposed)
      .or('has_details.is.null,has_details.eq.false')
      .gte('date', startDateStr)
      .order('date', { ascending: false })

    if (txError) {
      console.error('Error fetching income transactions:', txError)
      return NextResponse.json({ error: 'Failed to fetch income' }, { status: 500 })
    }

    const incomeTransactions = transactions || []

    // מפה כל transaction לפורמט הצפוי
    const formattedIncome = incomeTransactions.map((tx: any) => ({
      id: tx.id,
      amount: parseFloat(tx.amount || 0),
      source: tx.vendor || tx.category || 'לא צוין',
      category: tx.category || 'אחר',
      date: tx.date || tx.tx_date,
      payment_method: tx.payment_method || 'bank_transfer',
      notes: tx.notes,
      is_recurring: tx.is_recurring || false,
    }))

    return NextResponse.json({
      success: true,
      income: formattedIncome,
      total: incomeTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0),
      count: incomeTransactions.length,
    })

  } catch (error: any) {
    console.error('❌ List income error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to list income', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}

