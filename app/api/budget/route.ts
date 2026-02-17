import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/budget
 * קבלת תקציב לחודש מסוים + קטגוריות + vendors + missing data
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

    // 1. קבלת פרופיל
    const { data: profile } = await supabase
      .from('user_financial_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // 2. קבלת נתוני משתמש
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // 3. זיהוי נתונים חסרים
    const missingData: { field: string; label: string; importance: 'critical' | 'important' | 'nice_to_have' }[] = [];
    
    // פרופיל בסיסי - קריטי
    if (!profile) {
      missingData.push({ field: 'profile', label: 'שאלון שיקוף לא מולא', importance: 'critical' });
    } else {
      // בדיקת שדות קריטיים בפרופיל
      if (!profile.marital_status) {
        missingData.push({ field: 'marital_status', label: 'מצב משפחתי', importance: 'critical' });
      }
      if (profile.total_monthly_income === null || profile.total_monthly_income === undefined) {
        missingData.push({ field: 'total_monthly_income', label: 'הכנסה חודשית', importance: 'critical' });
      }
      if (profile.owns_home === null || profile.owns_home === undefined) {
        missingData.push({ field: 'owns_home', label: 'סוג מגורים (בעלות/שכירות)', importance: 'important' });
      }
      if (profile.children_count === null || profile.children_count === undefined) {
        missingData.push({ field: 'children_count', label: 'מספר ילדים', importance: 'important' });
      }
      // הוצאות קבועות - חשוב
      if (!profile.rent_mortgage && !profile.owns_home) {
        missingData.push({ field: 'rent_mortgage', label: 'שכירות/משכנתא', importance: 'important' });
      }
      if (!profile.total_fixed_expenses) {
        missingData.push({ field: 'total_fixed_expenses', label: 'סה"כ הוצאות קבועות', importance: 'nice_to_have' });
      }
    }

    // 4. קבלת תקציב ראשי
    const { data: budget } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .single();

    // 5. קבלת קטגוריות תקציב
    let categories: any[] = [];
    if (budget) {
      const { data: cats } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('budget_id', budget.id)
        .order('allocated_amount', { ascending: false });
      categories = cats || [];
    }

    // 6. קבלת תדירויות
    let frequencies: any[] = [];
    if (budget) {
      const { data: freqs } = await supabase
        .from('budget_frequency_types')
        .select('*')
        .eq('budget_id', budget.id);
      frequencies = freqs || [];
    }

    // 7. חישוב נתונים נוספים מתנועות (12 חודשים)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const startDate = twelveMonthsAgo.toISOString().split('T')[0];

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('tx_date', startDate);

    // בדיקה אם אין מספיק תנועות
    if (!transactions || transactions.length < 10) {
      missingData.push({ 
        field: 'transactions', 
        label: `תנועות (${transactions?.length || 0}/10 מינימום)`, 
        importance: 'critical' 
      });
    }

    // 8. ממוצע שורת הוצאה (vendor breakdown)
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

    // 9. פירוט לפי סוג הוצאה
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

    // 10. קבלת ילדים (מטבלה נפרדת אם קיימת)
    const { count: childrenCount } = await supabase
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // 11. חישוב הכנסות מתנועות
    const incomeTransactions = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'income')
      .gte('tx_date', startDate);

    const totalIncome = incomeTransactions.data?.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0;
    const avgMonthlyIncome = Math.round(totalIncome / monthsWithData);

    const totalExpenses = transactions?.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0;
    const avgMonthlyExpenses = Math.round(totalExpenses / monthsWithData);

    // 12. בניית פרופיל קונטקסט - עם ציון מה חסר
    const numPeople = 1 + 
      (profile?.marital_status === 'married' ? 1 : 0) + 
      (profile?.children_count || childrenCount || 0);
    
    const housingType = profile?.owns_home === true 
      ? 'בעלות' 
      : profile?.owns_home === false 
        ? 'שכירות' 
        : null;
    
    // הכנסה - העדפה לפרופיל, fallback לתנועות
    const profileIncome = profile?.total_monthly_income || 
      (profile?.monthly_income || 0) + (profile?.spouse_income || 0) + (profile?.additional_income || 0);
    const effectiveIncome = profileIncome > 0 ? profileIncome : avgMonthlyIncome;
    
    const incomeLevel = effectiveIncome > 20000 
      ? 'גבוהה' 
      : effectiveIncome > 10000 
        ? 'בינונית' 
        : effectiveIncome > 0 
          ? 'נמוכה' 
          : null;

    // 13. קבלת יעדים
    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    // 14. קבלת מסמכים - בודק בשתי הטבלאות
    const { count: statementsCount } = await supabase
      .from('uploaded_statements')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // בודק גם תנועות - אם יש תנועות אז יש מסמכים
    const hasDocuments = (statementsCount && statementsCount > 0) || 
                         (transactions && transactions.length > 0);

    if (!hasDocuments) {
      missingData.push({ field: 'documents', label: 'לא הועלו מסמכים (דוחות בנק/אשראי)', importance: 'critical' });
    }

    // חישוב אחוז מילוי פרופיל
    const totalFields = 8; // שדות קריטיים
    const filledFields = totalFields - missingData.filter(m => m.importance === 'critical').length;
    const profileCompleteness = Math.round((filledFields / totalFields) * 100);

    return NextResponse.json({
      budget,
      categories,
      frequencies,
      vendorBreakdown,
      expenseTypes,
      summary: {
        avgMonthlyIncome: effectiveIncome,
        avgMonthlyExpenses,
        avgMonthlySavings: effectiveIncome - avgMonthlyExpenses,
        monthsAnalyzed: monthsWithData,
        transactionsCount: transactions?.length || 0,
        documentsCount: statementsCount || 0,
        goalsCount: goals?.length || 0
      },
      profileContext: {
        numPeople,
        housingType,
        incomeLevel,
        hasProfile: !!profile,
        profileCompleted: profile?.completed || false
      },
      profile: profile ? {
        maritalStatus: profile.marital_status,
        childrenCount: profile.children_count,
        city: profile.city,
        totalMonthlyIncome: profile.total_monthly_income,
        totalFixedExpenses: profile.total_fixed_expenses,
        ownsHome: profile.owns_home,
        ownsCar: profile.owns_car,
        totalDebt: profile.total_debt,
        currentSavings: profile.current_savings
      } : null,
      goals: goals || [],
      missingData,
      profileCompleteness,
      currentPhase: userData?.current_phase || userData?.onboarding_state || 'unknown'
    });

  } catch (error) {
    console.error('Get budget error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

