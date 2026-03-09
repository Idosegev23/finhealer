import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/recurring
 * מחזיר רשימת הוצאות/הכנסות חוזרות שזוהו אוטומטית
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch last 6 months of confirmed transactions
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, vendor, amount, tx_date, type, category, is_recurring')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .gte('tx_date', sixMonthsAgo.toISOString().split('T')[0])
      .order('tx_date', { ascending: false });

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ recurring: [], totalMonthly: 0 });
    }

    // Group by normalized vendor name
    const vendorGroups: Record<string, typeof transactions> = {};
    for (const tx of transactions) {
      const key = normalizeVendor(tx.vendor || 'לא ידוע');
      if (!vendorGroups[key]) vendorGroups[key] = [];
      vendorGroups[key].push(tx);
    }

    const recurring: any[] = [];

    for (const [vendor, txs] of Object.entries(vendorGroups)) {
      // Get distinct months
      const months = new Set(txs.map(t => t.tx_date?.substring(0, 7)));
      if (months.size < 2) continue;

      // Check amount consistency (within 10% of average)
      const amounts = txs.map(t => Math.abs(t.amount));
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const isConsistent = amounts.every(a => Math.abs(a - avg) / avg < 0.10);

      if (!isConsistent && months.size < 3) continue;

      // Calculate frequency
      const sortedMonths = Array.from(months).sort();
      const gaps: number[] = [];
      for (let i = 1; i < sortedMonths.length; i++) {
        const [y1, m1] = sortedMonths[i - 1].split('-').map(Number);
        const [y2, m2] = sortedMonths[i].split('-').map(Number);
        gaps.push((y2 - y1) * 12 + (m2 - m1));
      }
      const avgGap = gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 1;
      const frequency = avgGap <= 1.2 ? 'חודשי' : avgGap <= 2.5 ? 'דו-חודשי' : 'רבעוני';

      const lastTx = txs[0];
      const confidence = Math.min(0.95, 0.5 + (months.size * 0.1) + (isConsistent ? 0.15 : 0));

      recurring.push({
        vendor: lastTx.vendor || vendor,
        normalizedVendor: vendor,
        category: lastTx.category || 'לא מסווג',
        type: lastTx.type || 'expense',
        averageAmount: Math.round(avg),
        frequency,
        occurrences: months.size,
        months: sortedMonths,
        lastDate: lastTx.tx_date,
        confidence,
        isMarkedRecurring: txs.some(t => t.is_recurring),
        transactionIds: txs.map(t => t.id),
      });
    }

    // Sort by amount descending
    recurring.sort((a, b) => b.averageAmount - a.averageAmount);

    const totalMonthlyExpenses = recurring
      .filter(r => r.type === 'expense')
      .reduce((s, r) => {
        const multiplier = r.frequency === 'חודשי' ? 1 : r.frequency === 'דו-חודשי' ? 0.5 : 0.33;
        return s + r.averageAmount * multiplier;
      }, 0);

    const totalMonthlyIncome = recurring
      .filter(r => r.type === 'income')
      .reduce((s, r) => s + r.averageAmount, 0);

    return NextResponse.json({
      recurring,
      totalMonthlyExpenses: Math.round(totalMonthlyExpenses),
      totalMonthlyIncome: Math.round(totalMonthlyIncome),
      count: recurring.length,
    });
  } catch (error) {
    console.error('Recurring API error:', error);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}

function normalizeVendor(vendor: string): string {
  return vendor
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[0-9]{2,}/g, '')
    .replace(/\s*-\s*/g, ' ')
    .trim()
    .toLowerCase();
}
