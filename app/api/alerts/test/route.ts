import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST - סימולציה לחוק התראה
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rule_type, params } = body;

    if (!rule_type) {
      return NextResponse.json(
        { error: 'Missing rule_type' },
        { status: 400 }
      );
    }

    // סימולציה לפי סוג החוק
    let simulationResult: any = {
      rule_type,
      would_trigger: false,
      message: '',
      data: {}
    };

    switch (rule_type) {
      case 'over_threshold':
        // בדיקת חריגת תקציב
        const category = params?.category;
        const threshold = params?.threshold || 80; // אחוזים

        if (!category) {
          return NextResponse.json(
            { error: 'Missing category for over_threshold rule' },
            { status: 400 }
          );
        }

        const { data: budgetData, error: budgetError } = await supabase
          .from('monthly_budget_tracking')
          .select('*')
          .eq('user_id', user.id)
          .eq('category_name', category)
          .maybeSingle();

        if (budgetData && !budgetError) {
          const usagePercent = (budgetData.usage_percentage as number) || 0;
          simulationResult.would_trigger = usagePercent >= threshold;
          simulationResult.message = simulationResult.would_trigger
            ? `🚨 התראה! חרגת ${usagePercent.toFixed(0)}% מהתקציב ב${category}`
            : `✅ הכל תקין. השתמשת ב-${usagePercent.toFixed(0)}% מהתקציב ב${category}`;
          simulationResult.data = {
            usage_percentage: usagePercent,
            threshold,
            category,
            spent: (budgetData.current_spent as number) || 0,
            cap: (budgetData.monthly_cap as number) || 0
          };
        }
        break;

      case 'no_spend':
        // בדיקה אם היום לא היו הוצאות
        const today = new Date().toISOString().split('T')[0];
        
        const { data: todayTransactions } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('tx_date', today)
          .eq('type', 'expense');

        simulationResult.would_trigger = !todayTransactions || todayTransactions.length === 0;
        simulationResult.message = simulationResult.would_trigger
          ? `😊 מעולה! לא היו הוצאות היום`
          : `יש לך ${todayTransactions?.length || 0} הוצאות היום`;
        simulationResult.data = {
          date: today,
          transactions_count: todayTransactions?.length || 0
        };
        break;

      case 'savings_found':
        // בדיקת עודפים בקטגוריות
        const { data: budgetTracking } = await supabase
          .from('monthly_budget_tracking')
          .select('*')
          .eq('user_id', user.id);

        const surplus = budgetTracking?.filter(b => (b.remaining as number) > 0) || [];
        const totalSurplus = surplus.reduce((sum, b) => sum + ((b.remaining as number) || 0), 0);

        simulationResult.would_trigger = totalSurplus > 100; // סף מינימום 100 ₪
        simulationResult.message = simulationResult.would_trigger
          ? `💰 מצאתי ${totalSurplus.toFixed(0)} ₪ עודף! רוצה להעביר לחיסכון?`
          : `אין עודפים משמעותיים החודש`;
        simulationResult.data = {
          total_surplus: totalSurplus,
          categories_with_surplus: surplus.length,
          surplus_details: surplus.map(s => ({
            category: (s.category_name as string) || '',
            remaining: (s.remaining as number) || 0
          }))
        };
        break;

      case 'stale':
        // בדיקה למשתמשים לא פעילים
        const daysInactive = params?.days || 7;
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - daysInactive);

        const { data: recentActivity } = await supabase
          .from('transactions')
          .select('created_at')
          .eq('user_id', user.id)
          .gte('created_at', dateThreshold.toISOString())
          .limit(1);

        simulationResult.would_trigger = !recentActivity || recentActivity.length === 0;
        simulationResult.message = simulationResult.would_trigger
          ? `⏰ לא רשמת הוצאות כבר ${daysInactive} ימים. הכל בסדר?`
          : `✅ אתה פעיל - רשמת תנועות לאחרונה`;
        simulationResult.data = {
          days_inactive: daysInactive,
          has_recent_activity: (recentActivity?.length || 0) > 0
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Unknown rule_type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      simulation: simulationResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Alert test error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


