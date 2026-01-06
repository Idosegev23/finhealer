import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/budget
 * קבלת תקציב לחודש מסוים + קטגוריות + vendors
 * Query params: month=YYYY-MM
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().substring(0, 7);

    // 1. קבלת תקציב ראשי
    const { data: budget } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .single();

    // 2. קבלת קטגוריות תקציב
    let categories: any[] = [];
    if (budget) {
      const { data: cats } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('budget_id', budget.id)
        .order('allocated_amount', { ascending: false });
      categories = cats || [];
    }

    // 3. קבלת תדירויות
    let frequencies: any[] = [];
    if (budget) {
      const { data: freqs } = await supabase
        .from('budget_frequency_types')
        .select('*')
        .eq('budget_id', budget.id);
      frequencies = freqs || [];
    }

    // 4. חישוב נתונים נוספים מתנועות (12 חודשים)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const startDate = twelveMonthsAgo.toISOString().split('T')[0];

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', startDate);

    // 5. ממוצע שורת הוצאה (vendor breakdown)
    const vendorMap: Record<string, { total: number; count: number; category: string }> = {};
    const monthsWithData = new Set(transactions?.map(t => t.date?.substring(0, 7))).size || 1;
    
    transactions?.forEach(t => {
      const vendor = t.vendor || t.original_description || 'לא ידוע';
      if (!vendorMap[vendor]) {
        vendorMap[vendor] = { total: 0, count: 0, category: t.category || t.expense_category || 'אחר' };
      }
      vendorMap[vendor].total += Math.abs(t.amount || 0);
      vendorMap[vendor].count++;
    });

    const vendorBreakdown = Object.entries(vendorMap)
      .map(([vendor, data]) => ({
        vendor,
        avgMonthly: Math.round(data.total / monthsWithData),
        totalCount: data.count,
        monthlyCount: Math.round(data.count / monthsWithData * 10) / 10,
        category: data.category
      }))
      .sort((a, b) => b.avgMonthly - a.avgMonthly)
      .slice(0, 30);

    // 6. פירוט לפי סוג הוצאה
    const expenseTypes = {
      fixed: { total: 0, count: 0, categories: [] as string[] },
      variable: { total: 0, count: 0, categories: [] as string[] },
      special: { total: 0, count: 0, categories: [] as string[] }
    };

    transactions?.forEach(t => {
      const expType = t.expense_frequency || t.expense_type || 'variable';
      const cat = t.category || t.expense_category || 'אחר';
      
      if (expType === 'fixed') {
        expenseTypes.fixed.total += Math.abs(t.amount || 0);
        expenseTypes.fixed.count++;
        if (!expenseTypes.fixed.categories.includes(cat)) {
          expenseTypes.fixed.categories.push(cat);
        }
      } else if (expType === 'special' || expType === 'one_time') {
        expenseTypes.special.total += Math.abs(t.amount || 0);
        expenseTypes.special.count++;
        if (!expenseTypes.special.categories.includes(cat)) {
          expenseTypes.special.categories.push(cat);
        }
      } else {
        expenseTypes.variable.total += Math.abs(t.amount || 0);
        expenseTypes.variable.count++;
        if (!expenseTypes.variable.categories.includes(cat)) {
          expenseTypes.variable.categories.push(cat);
        }
      }
    });

    // חישוב ממוצעים חודשיים
    Object.keys(expenseTypes).forEach(key => {
      const k = key as keyof typeof expenseTypes;
      (expenseTypes[k] as any).avgMonthly = Math.round(expenseTypes[k].total / monthsWithData);
    });

    // 7. קבלת פרופיל
    const { data: profile } = await supabase
      .from('user_financial_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // 8. קבלת ילדים
    const { count: childrenCount } = await supabase
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // חישוב הכנסות מתנועות
    const incomeTransactions = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'income')
      .gte('date', startDate);

    const totalIncome = incomeTransactions.data?.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0;
    const avgMonthlyIncome = Math.round(totalIncome / monthsWithData);

    const totalExpenses = transactions?.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0;
    const avgMonthlyExpenses = Math.round(totalExpenses / monthsWithData);

    // פרופיל קונטקסט
    const numPeople = 1 + (profile?.marital_status === 'married' ? 1 : 0) + (childrenCount || 0);
    const housingType = profile?.owns_home ? 'בעלות' : 'שכירות';
    const incomeLevel = avgMonthlyIncome > 20000 ? 'גבוהה' : avgMonthlyIncome > 10000 ? 'בינונית' : 'נמוכה';

    return NextResponse.json({
      budget,
      categories,
      frequencies,
      vendorBreakdown,
      expenseTypes,
      summary: {
        avgMonthlyIncome,
        avgMonthlyExpenses,
        avgMonthlySavings: avgMonthlyIncome - avgMonthlyExpenses,
        monthsAnalyzed: monthsWithData,
        transactionsCount: transactions?.length || 0
      },
      profileContext: {
        numPeople,
        housingType,
        incomeLevel
      }
    });

  } catch (error) {
    console.error('Get budget error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

