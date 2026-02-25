import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // cache ל-60 שניות

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // שליפת phase
    const { data: userData } = await supabase
      .from('users')
      .select('phase, name')
      .eq('id', user.id)
      .single();
    
    const userInfo = userData as any;

    // תאריך חודש נוכחי
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    // הוצאות/הכנסות החודש - כולל confirmed + pending
    const { data: transactions } = await supabase
      .from('transactions')
      .select('type, amount, status')
      .eq('user_id', user.id)
      .in('status', ['confirmed', 'pending'])
      .gte('tx_date', firstDayOfMonth)
      .lte('tx_date', today)
      .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true');

    const txData = (transactions || []) as any[];
    const confirmedTx = txData.filter(t => t.status === 'confirmed');
    const pendingTx = txData.filter(t => t.status === 'pending');

    const totalExpenses = confirmedTx
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalIncome = confirmedTx
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const pendingExpenses = pendingTx
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const pendingIncome = pendingTx
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // מעקב תקציב חודשי
    const { data: budgetTracking } = await supabase
      .from('monthly_budget_tracking')
      .select('id, category, allocated_amount, spent_amount, month, status')
      .eq('user_id', user.id);
    
    const budgetData = (budgetTracking || []) as any[];

    // יעדים פעילים
    const { data: activeGoals } = await supabase
      .from('goals')
      .select('id, name, target_amount, current_amount, status, priority, deadline, goal_type, monthly_allocation')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('priority', { ascending: true })
      .limit(5);

    // התראות אחרונות
    const { data: recentAlerts } = await supabase
      .from('alerts')
      .select('id, type, message, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // ציון בריאות פיננסית
    const { data: healthData } = await supabase
      .rpc('calculate_financial_health', { user_id: user.id } as any);

    const financialHealth = healthData || 0;

    // baselines (אם יש)
    const { data: baselines } = await supabase
      .from('user_baselines')
      .select('avg_daily_spending, avg_monthly_income, avg_monthly_expenses, month')
      .eq('user_id', user.id);

    // behavior insights אחרונים
    const { data: insights } = await supabase
      .from('behavior_insights')
      .select('id, insight_type, title, description, priority, data, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3);

    return NextResponse.json({
      user: {
        name: userInfo?.name,
        phase: userInfo?.phase
      },
      financial_health: financialHealth,
      monthly: {
        expenses: totalExpenses,
        income: totalIncome,
        balance: totalIncome - totalExpenses,
        pending_expenses: pendingExpenses,
        pending_income: pendingIncome,
        pending_count: pendingTx.length,
      },
      budget_tracking: budgetData,
      active_goals: activeGoals || [],
      recent_alerts: recentAlerts || [],
      baselines: baselines || [],
      insights: insights || []
    });

  } catch (error) {
    console.error('Dashboard summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


