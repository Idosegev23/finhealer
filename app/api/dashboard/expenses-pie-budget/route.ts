import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/dashboard/expenses-pie-budget
 *
 * ללא drilldown → מחזיר:
 *   categories[]    — פילוח הוצאות לפי expense_category (3 חודשים אחרונים)
 *   totalIncome     — סה״כ הכנסות באותה תקופה
 *   recommendations — המלצות תקציב לכל קטגוריה
 *
 * עם drilldown=<category> → מחזיר:
 *   subCategories[] — פירוט לפי vendor בתוך הקטגוריה
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const drilldown = request.nextUrl.searchParams.get('drilldown');

    // Date range: last 3 months
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const startDate = threeMonthsAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    const monthsInRange = 3;

    // ── DRILLDOWN: vendor breakdown inside a category ──
    if (drilldown) {
      const { data: txs, error } = await supabase
        .from('transactions')
        .select('vendor, amount')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('status', 'confirmed')
        .eq('expense_category', drilldown)
        .or('is_summary.is.null,is_summary.eq.false')
        .gte('tx_date', startDate)
        .lte('tx_date', endDate);

      if (error) {
        console.error('Drilldown error:', error);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
      }

      const vendorMap: Record<string, { value: number; count: number }> = {};
      (txs || []).forEach((tx: any) => {
        const vendor = tx.vendor || 'לא צוין';
        if (!vendorMap[vendor]) vendorMap[vendor] = { value: 0, count: 0 };
        vendorMap[vendor].value += Math.round(Number(tx.amount) || 0);
        vendorMap[vendor].count += 1;
      });

      const subCategories = Object.entries(vendorMap)
        .map(([name, d]) => ({ name, value: d.value, count: d.count }))
        .sort((a, b) => b.value - a.value);

      return NextResponse.json({ success: true, subCategories });
    }

    // ── MAIN: category pie + income + recommendations ──
    const [
      { data: expenses, error: expErr },
      { data: incomes, error: incErr },
    ] = await Promise.all([
      supabase
        .from('transactions')
        .select('expense_category, expense_type, amount')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('status', 'confirmed')
        .or('is_summary.is.null,is_summary.eq.false')
        .gte('tx_date', startDate)
        .lte('tx_date', endDate),
      supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .eq('status', 'confirmed')
        .or('is_summary.is.null,is_summary.eq.false')
        .gte('tx_date', startDate)
        .lte('tx_date', endDate),
    ]);

    if (expErr) {
      console.error('Expenses error:', expErr);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    // Meta-categories to exclude: banking operations, not real expense categories
    const metaCategories = new Set([
      'חיוב כרטיס אשראי',
      'חיוב אשראי',
      'חיוב כרטיס',
      'העברה יוצאת',
      'העברה נכנסת',
      'משיכת מזומן',
      'עמלות בנק',
      'עמלות כרטיס אשראי',
      'הכנסה אחרת',
      'השקעות',
      'גמלאות/ביטוח לאומי',
    ]);

    // Aggregate by category (skip meta-categories)
    const catMap: Record<string, { value: number; count: number; expense_type: string }> = {};
    (expenses || []).forEach((tx: any) => {
      const cat = tx.expense_category || 'לא מסווג';
      if (metaCategories.has(cat)) return; // skip banking operations
      if (!catMap[cat]) catMap[cat] = { value: 0, count: 0, expense_type: tx.expense_type || 'variable' };
      catMap[cat].value += Math.round(Number(tx.amount) || 0);
      catMap[cat].count += 1;
    });

    const categories = Object.entries(catMap)
      .map(([name, d]) => ({
        name,
        value: d.value,
        count: d.count,
        expense_type: d.expense_type,
      }))
      .sort((a, b) => b.value - a.value);

    // Total income in period
    const totalIncome = (incomes || []).reduce(
      (s: number, tx: any) => s + Math.round(Number(tx.amount) || 0), 0
    );
    const monthlyIncome = Math.round(totalIncome / monthsInRange);

    // ── Budget recommendations ──
    const recommendations = buildRecommendations(categories, monthlyIncome, monthsInRange);

    return NextResponse.json({
      success: true,
      categories,
      totalIncome,
      recommendations,
    });
  } catch (err) {
    console.error('expenses-pie-budget error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ─── Budget recommendation logic ───────────────────
function buildRecommendations(
  categories: { name: string; value: number; count: number; expense_type: string }[],
  monthlyIncome: number,
  months: number,
): Array<{
  category: string;
  actual: number;
  recommended: number;
  difference: number;
  tip: string;
}> {
  if (categories.length === 0 || monthlyIncome <= 0) return [];

  // Monthly average per category
  const monthlyCategories = categories.map((c) => ({
    ...c,
    monthlyActual: Math.round(c.value / months),
  }));

  const totalMonthlyExpenses = monthlyCategories.reduce((s, c) => s + c.monthlyActual, 0);

  return monthlyCategories.map((cat) => {
    const pctOfIncome = cat.monthlyActual / monthlyIncome;
    let recommended = cat.monthlyActual; // default: keep as-is
    let tip = '';

    if (cat.expense_type === 'fixed') {
      // Fixed expenses: recommend actual (hard to change)
      recommended = cat.monthlyActual;
      tip = 'הוצאה קבועה';
    } else {
      // Variable/special: suggest optimization
      if (pctOfIncome > 0.20) {
        // Category takes >20% of income — suggest 15% reduction
        recommended = Math.round(cat.monthlyActual * 0.85);
        tip = 'גבוה — צמצם 15%';
      } else if (pctOfIncome > 0.10) {
        // 10-20% — suggest 10% reduction
        recommended = Math.round(cat.monthlyActual * 0.90);
        tip = 'שווה לבדוק';
      } else {
        // <10% — keep
        recommended = cat.monthlyActual;
        tip = 'בסדר';
      }
    }

    // If total expenses > 80% of income, push harder on variable
    if (totalMonthlyExpenses > monthlyIncome * 0.8 && cat.expense_type !== 'fixed') {
      const overRatio = totalMonthlyExpenses / monthlyIncome;
      recommended = Math.round(cat.monthlyActual / overRatio);
      tip = 'חיוני לצמצם';
    }

    return {
      category: cat.name,
      actual: cat.monthlyActual,
      recommended,
      difference: cat.monthlyActual - recommended,
      tip,
    };
  }).filter(r => r.actual > 0);
}
