import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/dashboard/financial-table
 *
 * Returns all confirmed transactions grouped by:
 * - type (income/expense)
 * - expense_frequency (fixed/variable/special)
 * - category
 *
 * Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD&months=3
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '3');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    // Date range
    const now = new Date();
    const fromDate = fromParam || new Date(now.getFullYear(), now.getMonth() - months, 1).toISOString().split('T')[0];
    const toDate = toParam || now.toISOString().split('T')[0];

    // Fetch all confirmed transactions (exclude summaries/double-counting)
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id, type, amount, tx_date, vendor, category, category_group, expense_category, income_category, expense_frequency, payment_method, notes, original_description, status')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .gte('tx_date', fromDate)
      .lte('tx_date', toDate)
      .or('is_summary.is.null,is_summary.eq.false')
      .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true')
      .order('tx_date', { ascending: false });

    if (error) {
      console.error('[financial-table] DB error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    const txs = transactions || [];

    // --- Build grouped summary ---

    // Income breakdown
    const incomeItems = txs.filter(t => t.type === 'income');
    const incomeByCategory = groupByCategory(incomeItems, 'income_category');
    const incomeByFrequency = groupByFrequency(incomeItems);

    // Expense breakdown
    const expenseItems = txs.filter(t => t.type === 'expense');
    const expenseByCategory = groupByCategory(expenseItems, 'expense_category');
    const expenseByFrequency = groupByFrequency(expenseItems);
    const expenseByGroup = groupByCategoryGroup(expenseItems);

    // Totals
    const totalIncome = incomeItems.reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalExpenses = expenseItems.reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalFixed = expenseItems.filter(t => t.expense_frequency === 'fixed').reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalVariable = expenseItems.filter(t => t.expense_frequency === 'variable').reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalSpecial = expenseItems.filter(t => t.expense_frequency === 'special').reduce((s, t) => s + Math.abs(t.amount), 0);

    // Monthly averages
    const monthCount = Math.max(1, months);

    return NextResponse.json({
      period: { from: fromDate, to: toDate, months },
      totals: {
        income: Math.round(totalIncome),
        expenses: Math.round(totalExpenses),
        balance: Math.round(totalIncome - totalExpenses),
        fixed: Math.round(totalFixed),
        variable: Math.round(totalVariable),
        special: Math.round(totalSpecial),
        unclassified: Math.round(totalExpenses - totalFixed - totalVariable - totalSpecial),
      },
      averages: {
        monthlyIncome: Math.round(totalIncome / monthCount),
        monthlyExpenses: Math.round(totalExpenses / monthCount),
        monthlyFixed: Math.round(totalFixed / monthCount),
        monthlyVariable: Math.round(totalVariable / monthCount),
      },
      income: {
        total: Math.round(totalIncome),
        count: incomeItems.length,
        byCategory: incomeByCategory,
        byFrequency: incomeByFrequency,
      },
      expenses: {
        total: Math.round(totalExpenses),
        count: expenseItems.length,
        byCategory: expenseByCategory,
        byFrequency: expenseByFrequency,
        byGroup: expenseByGroup,
      },
      // Raw transactions for drill-down
      transactions: txs.map(t => ({
        id: t.id,
        type: t.type,
        amount: Math.round(Math.abs(t.amount)),
        tx_date: t.tx_date,
        vendor: t.vendor || t.original_description || '-',
        category: t.category || t.expense_category || t.income_category || 'לא מסווג',
        category_group: t.category_group || 'אחר',
        frequency: t.expense_frequency || (t.type === 'income' ? 'income' : 'unclassified'),
        payment_method: t.payment_method || '-',
        notes: t.notes || '',
      })),
    });
  } catch (err: any) {
    console.error('[financial-table] Error:', err.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// --- Helpers ---

function groupByCategory(txs: any[], categoryField: string) {
  const map: Record<string, { amount: number; count: number }> = {};
  for (const t of txs) {
    const cat = t[categoryField] || t.category || 'לא מסווג';
    if (!map[cat]) map[cat] = { amount: 0, count: 0 };
    map[cat].amount += Math.abs(t.amount);
    map[cat].count++;
  }
  return Object.entries(map)
    .map(([name, d]) => ({ name, amount: Math.round(d.amount), count: d.count }))
    .sort((a, b) => b.amount - a.amount);
}

function groupByFrequency(txs: any[]) {
  const map: Record<string, { amount: number; count: number }> = {};
  for (const t of txs) {
    const freq = t.expense_frequency || 'unclassified';
    if (!map[freq]) map[freq] = { amount: 0, count: 0 };
    map[freq].amount += Math.abs(t.amount);
    map[freq].count++;
  }
  return Object.entries(map)
    .map(([name, d]) => ({ name, amount: Math.round(d.amount), count: d.count }))
    .sort((a, b) => b.amount - a.amount);
}

function groupByCategoryGroup(txs: any[]) {
  const map: Record<string, { amount: number; count: number; fixed: number; variable: number; special: number; categories: Record<string, { amount: number; count: number }> }> = {};
  for (const t of txs) {
    const group = t.category_group || 'אחר';
    if (!map[group]) map[group] = { amount: 0, count: 0, fixed: 0, variable: 0, special: 0, categories: {} };
    const amt = Math.abs(t.amount);
    map[group].amount += amt;
    map[group].count++;
    if (t.expense_frequency === 'fixed') map[group].fixed += amt;
    else if (t.expense_frequency === 'variable') map[group].variable += amt;
    else if (t.expense_frequency === 'special') map[group].special += amt;

    const cat = t.expense_category || t.category || 'לא מסווג';
    if (!map[group].categories[cat]) map[group].categories[cat] = { amount: 0, count: 0 };
    map[group].categories[cat].amount += amt;
    map[group].categories[cat].count++;
  }
  return Object.entries(map)
    .map(([name, d]) => ({
      name,
      amount: Math.round(d.amount),
      count: d.count,
      fixed: Math.round(d.fixed),
      variable: Math.round(d.variable),
      special: Math.round(d.special),
      categories: Object.entries(d.categories)
        .map(([cName, cData]) => ({ name: cName, amount: Math.round(cData.amount), count: cData.count }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.amount - a.amount);
}
