import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: /api/income/list
 * שליפת כל מקורות ההכנסה של המשתמש
 * 
 * Query params:
 * - active: true/false (ברירת מחדל: true)
 * - type: employment_type לסינון
 * - is_primary: true/false
 * - sort: name/amount/created_at (ברירת מחדל: created_at)
 * - order: asc/desc (ברירת מחדל: desc)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // פרמטרים
    const { searchParams } = new URL(request.url);
    const activeFilter = searchParams.get('active');
    const typeFilter = searchParams.get('type');
    const isPrimaryFilter = searchParams.get('is_primary');
    const sortBy = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') || 'desc';

    // שאילתה בסיסית
    let query = (supabase as any)
      .from('income_sources')
      .select('*')
      .eq('user_id', user.id);

    // פילטרים
    if (activeFilter !== null) {
      query = query.eq('active', activeFilter === 'true');
    }

    if (typeFilter) {
      query = query.eq('employment_type', typeFilter);
    }

    if (isPrimaryFilter !== null) {
      query = query.eq('is_primary', isPrimaryFilter === 'true');
    }

    // מיון
    const validSortFields = ['source_name', 'gross_amount', 'actual_bank_amount', 'created_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    query = query.order(sortField, { ascending: order === 'asc' });

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const incomeSources = data || [];

    // ✨ שליפת הכנסות מתנועות (דוחות סרוקים)
    const monthParam = searchParams.get('month');
    let targetMonth = monthParam || new Date().toISOString().slice(0, 7); // YYYY-MM
    let isFallbackMonth = false;

    const monthEndOf = (yyyyMm: string) => {
      const [yStr, mStr] = yyyyMm.split('-');
      const last = new Date(parseInt(yStr), parseInt(mStr), 0).getDate();
      return `${yyyyMm}-${String(last).padStart(2, '0')}`;
    };

    let monthEnd = monthEndOf(targetMonth);
    let { data: transactionIncome, error: txError } = await (supabase as any)
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'income')
      .eq('status', 'confirmed')
      .or('is_summary.is.null,is_summary.eq.false')
      .gte('tx_date', `${targetMonth}-01`)
      .lte('tx_date', monthEnd);

    // Fallback — if requested month empty AND user didn't specify, find latest month with income
    if ((!transactionIncome || transactionIncome.length === 0) && !monthParam) {
      const { data: latest } = await (supabase as any)
        .from('transactions')
        .select('tx_date')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .eq('status', 'confirmed')
        .or('is_summary.is.null,is_summary.eq.false')
        .order('tx_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.tx_date) {
        targetMonth = latest.tx_date.slice(0, 7);
        monthEnd = monthEndOf(targetMonth);
        isFallbackMonth = true;
        const result = await (supabase as any)
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'income')
          .eq('status', 'confirmed')
          .or('is_summary.is.null,is_summary.eq.false')
          .gte('tx_date', `${targetMonth}-01`)
          .lte('tx_date', monthEnd);
        transactionIncome = result.data;
        txError = result.error;
      }
    }

    const monthlyIncomeFromTransactions = (transactionIncome || [])
      .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);

    // חישוב סטטיסטיקות
    const monthlyIncomeFromSources = incomeSources
      .filter((source: any) => source.active && source.payment_frequency === 'monthly')
      .reduce((sum: number, source: any) => sum + (source.actual_bank_amount || 0), 0);

    const stats = {
      total: incomeSources.length,
      totalMonthlyIncome: monthlyIncomeFromSources,
      totalMonthlyIncomeFromTransactions: monthlyIncomeFromTransactions,
      totalCombinedIncome: monthlyIncomeFromSources + monthlyIncomeFromTransactions,
      primaryCount: incomeSources.filter((source: any) => source.is_primary).length,
      typeBreakdown: incomeSources.reduce((acc: any, source: any) => {
        const type = source.employment_type || 'other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}),
      transactionIncomeCount: transactionIncome?.length || 0,
    };

    return NextResponse.json({
      success: true,
      incomeSources,
      transactionIncome: transactionIncome || [],
      stats,
      count: incomeSources.length,
      activeMonth: targetMonth,
      isFallbackMonth,
    });
  } catch (error) {
    console.error('[/api/income/list] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בשליפת מקורות הכנסה' },
      { status: 500 }
    );
  }
}
