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
    const month = searchParams.get('month') // YYYY-MM או null לכל הזמן
    const category = searchParams.get('category')
    const paymentMethod = searchParams.get('payment_method')
    const expenseFrequency = searchParams.get('expense_frequency')
    const status = searchParams.get('status')
    const accountId = searchParams.get('account_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('📊 Fetching expenses:', {
      userId: user.id,
      month,
      category,
      paymentMethod,
      expenseFrequency,
      status,
      limit,
      offset,
    })

    // בניית query (parent transactions + cash expenses)
    let query = supabase
      .from('transactions')
      .select('id, tx_date, amount, vendor, category, expense_category, expense_type, notes, is_recurring, status, payment_method, expense_frequency, has_details, is_cash_expense', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .or('is_summary.is.null,is_summary.eq.false')
      .order('tx_date', { ascending: false })
      .order('created_at', { ascending: false })

    // פילטרים
    if (month) {
      const startOfMonth = `${month}-01`
      const endOfMonth = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0)
        .toISOString()
        .split('T')[0]
      query = query.gte('tx_date', startOfMonth).lte('tx_date', endOfMonth)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod)
    }

    if (expenseFrequency) {
      query = query.eq('expense_frequency', expenseFrequency)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (accountId) {
      query = query.eq('financial_account_id', accountId)
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: expenses, error: expensesError, count } = await query

    if (expensesError) {
      console.error('❌ Error fetching expenses:', expensesError)
      return NextResponse.json(
        { error: 'Failed to fetch expenses', details: expensesError.message },
        { status: 500 }
      )
    }

    // סיכומים
    const totalAmount = expenses?.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0) || 0

    const byCategory = expenses?.reduce((acc, exp) => {
      const cat = exp.category || 'other'
      if (!acc[cat]) {
        acc[cat] = { count: 0, total: 0 }
      }
      acc[cat].count++
      acc[cat].total += parseFloat(exp.amount || 0)
      return acc
    }, {} as Record<string, { count: number; total: number }>)

    const byPaymentMethod = expenses?.reduce((acc, exp) => {
      const method = exp.payment_method || 'unknown'
      if (!acc[method]) {
        acc[method] = { count: 0, total: 0 }
      }
      acc[method].count++
      acc[method].total += parseFloat(exp.amount || 0)
      return acc
    }, {} as Record<string, { count: number; total: number }>)

    const byFrequency = expenses?.reduce((acc, exp) => {
      const freq = exp.expense_frequency || 'one_time'
      if (!acc[freq]) {
        acc[freq] = { count: 0, total: 0 }
      }
      acc[freq].count++
      acc[freq].total += parseFloat(exp.amount || 0)
      return acc
    }, {} as Record<string, { count: number; total: number }>)

    console.log('✅ Expenses fetched:', {
      count,
      totalAmount,
    })

    return NextResponse.json({
      success: true,
      expenses,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
      summary: {
        total: totalAmount,
        count: expenses?.length || 0,
        byCategory,
        byPaymentMethod,
        byFrequency,
      },
    })

  } catch (error: any) {
    console.error('❌ List expenses error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to list expenses', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}

