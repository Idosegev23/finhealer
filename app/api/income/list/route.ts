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
    const month = searchParams.get('month') // YYYY-MM

    // שליפת הכנסות מפרופיל פיננסי
    const { data: profile } = await supabase
      .from('user_financial_profile')
      .select('total_monthly_income')
      .eq('user_id', user.id)
      .single()

    // אם יש חודש ספציפי - שלוף גם תנועות הכנסה
    let incomeTransactions = []
    if (month) {
      const startOfMonth = `${month}-01`
      const endOfMonth = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0)
        .toISOString()
        .split('T')[0]

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .gte('tx_date', startOfMonth)
        .lte('tx_date', endOfMonth)
        .or('has_details.is.null,has_details.eq.false')

      incomeTransactions = transactions || []
    }

    const totalFromTransactions = incomeTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0)
    const totalIncome = profile?.total_monthly_income || 0
    const combinedTotal = totalFromTransactions || totalIncome

    return NextResponse.json({
      success: true,
      summary: {
        total: combinedTotal,
        fromProfile: totalIncome,
        fromTransactions: totalFromTransactions,
        count: incomeTransactions.length,
      },
      transactions: incomeTransactions,
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

