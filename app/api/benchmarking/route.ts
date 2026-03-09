import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/benchmarking
 * השוואת הוצאות המשתמש לממוצע כלל המשתמשים לפי קטגוריה
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const since = threeMonthsAgo.toISOString().split('T')[0];

    // Get this user's monthly averages by category
    const { data: myTx } = await supabase
      .from('transactions')
      .select('amount, category, tx_date')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .eq('type', 'expense')
      .gte('tx_date', since);

    // Get all users' averages (anonymized)
    const { data: allTx } = await supabase
      .from('transactions')
      .select('amount, category, tx_date, user_id')
      .eq('status', 'confirmed')
      .eq('type', 'expense')
      .gte('tx_date', since);

    if (!myTx || !allTx) {
      return NextResponse.json({ comparisons: [], hasData: false });
    }

    const metaCategories = new Set([
      'חיוב כרטיס אשראי', 'חיוב אשראי', 'העברה יוצאת', 'העברה נכנסת',
      'משיכת מזומן', 'עמלות בנק', 'עמלות כרטיס אשראי', 'הכנסה אחרת',
      'השקעות', 'גמלאות/ביטוח לאומי', 'לא מסווג', 'אחר', 'שונות',
    ]);

    // Calculate my monthly avg per category
    const myMonths = new Set(myTx.map(t => t.tx_date?.substring(0, 7)));
    const myMonthCount = Math.max(myMonths.size, 1);
    const myByCategory: Record<string, number> = {};
    for (const tx of myTx) {
      const cat = tx.category || 'אחר';
      if (metaCategories.has(cat)) continue;
      myByCategory[cat] = (myByCategory[cat] || 0) + Math.abs(tx.amount);
    }

    // Calculate all users monthly avg per category
    const allUsers = new Set(allTx.map(t => t.user_id));
    const userCount = Math.max(allUsers.size, 1);
    const allByCategory: Record<string, number> = {};
    for (const tx of allTx) {
      const cat = tx.category || 'אחר';
      if (metaCategories.has(cat)) continue;
      allByCategory[cat] = (allByCategory[cat] || 0) + Math.abs(tx.amount);
    }

    // Build comparisons for categories that appear in user's data
    const comparisons: any[] = [];
    for (const [cat, total] of Object.entries(myByCategory)) {
      const myMonthlyAvg = Math.round(total / myMonthCount);
      const othersTotal = allByCategory[cat] || 0;
      const othersMonthlyAvg = Math.round(othersTotal / (userCount * myMonthCount));

      if (myMonthlyAvg < 50) continue; // Skip very small categories

      const diff = myMonthlyAvg - othersMonthlyAvg;
      const diffPercent = othersMonthlyAvg > 0
        ? Math.round((diff / othersMonthlyAvg) * 100)
        : 0;

      comparisons.push({
        category: cat,
        myMonthlyAvg,
        othersMonthlyAvg,
        diff,
        diffPercent,
        status: diffPercent > 20 ? 'above' : diffPercent < -20 ? 'below' : 'similar',
      });
    }

    // Sort: biggest overspend first
    comparisons.sort((a, b) => b.diffPercent - a.diffPercent);

    const myTotalMonthly = Object.values(myByCategory).reduce((s, v) => s + v, 0) / myMonthCount;
    const othersTotalMonthly = Object.values(allByCategory).reduce((s, v) => s + v, 0) / (userCount * myMonthCount);

    return NextResponse.json({
      comparisons,
      summary: {
        myTotalMonthly: Math.round(myTotalMonthly),
        othersTotalMonthly: Math.round(othersTotalMonthly),
        userCount,
        monthsAnalyzed: myMonthCount,
      },
      hasData: comparisons.length > 0,
    });
  } catch (error) {
    console.error('Benchmarking error:', error);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}
