'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Calendar, Lightbulb, Target, RefreshCw, Minus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

interface BehaviorInsight {
  id: string;
  insight_type: string;
  title: string;
  description?: string;
  pattern?: string;
  insight_text?: string;
  priority: 'high' | 'medium' | 'low';
  suggested_action?: string;
  emoji?: string;
  data?: Record<string, any>;
}

interface DashboardData {
  daysInPhase: number;
  totalTransactions: number;
  totalSpent: number;
  avgDailySpend: number;
  spendingTrend: 'increasing' | 'decreasing' | 'stable';
  topCategories: Array<{ category: string; amount: number; percent: number }>;
  insights: BehaviorInsight[];
  readyForBudget: boolean;
}

/**
 * Dashboard לשלב 2: Behavior (התנהלות והרגלים)
 * מציג נתונים אמיתיים מה-DB
 */
export function BehaviorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      
      // קבל משתמש נוכחי
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // קבל פרטי משתמש
      const { data: userData } = await supabase
        .from('users')
        .select('phase_updated_at, phase')
        .eq('id', user.id)
        .single();

      // חישוב ימים בשלב
      const phaseStart = userData?.phase_updated_at 
        ? new Date(userData.phase_updated_at) 
        : new Date();
      const daysInPhase = Math.floor((Date.now() - phaseStart.getTime()) / (24 * 60 * 60 * 1000));

      // קבל תנועות 30 יום אחרונים
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, expense_category, tx_date, type')
        .eq('user_id', user.id)
        .gte('tx_date', thirtyDaysAgo.toISOString().split('T')[0]);

      const expenses = (transactions || []).filter(t => t.type === 'expense' || t.amount < 0);
      const totalSpent = Math.abs(expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0));
      const avgDailySpend = totalSpent / 30;

      // קטגוריות מובילות
      const categoryTotals: Record<string, number> = {};
      for (const tx of expenses) {
        const cat = tx.expense_category || 'אחר';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(tx.amount);
      }

      const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, amount]) => ({
          category,
          amount,
          percent: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
        }));

      // מגמה (השוואה לשבוע קודם)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      
      const thisWeekExpenses = expenses
        .filter(t => new Date(t.tx_date) >= oneWeekAgo)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const lastWeekExpenses = expenses
        .filter(t => new Date(t.tx_date) >= twoWeeksAgo && new Date(t.tx_date) < oneWeekAgo)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      let spendingTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (lastWeekExpenses > 0) {
        const changePercent = ((thisWeekExpenses - lastWeekExpenses) / lastWeekExpenses) * 100;
        if (changePercent > 15) spendingTrend = 'increasing';
        else if (changePercent < -15) spendingTrend = 'decreasing';
      }

      // תובנות מ-DB
      const { data: insights } = await supabase
        .from('behavior_insights')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // בדיקה אם מוכן לשלב הבא
      const readyForBudget = daysInPhase >= 30 && (transactions?.length || 0) >= 50;

      setData({
        daysInPhase,
        totalTransactions: transactions?.length || 0,
        totalSpent,
        avgDailySpend,
        spendingTrend,
        topCategories,
        insights: insights || [],
        readyForBudget,
      });
    } catch (error) {
      console.error('Error loading behavior dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-200 rounded"></div>)}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500">לא ניתן לטעון נתונים</div>;
  }

  const trendIcon = data.spendingTrend === 'increasing' 
    ? <TrendingUp className="h-5 w-5 text-red-500" />
    : data.spendingTrend === 'decreasing'
    ? <TrendingDown className="h-5 w-5 text-green-500" />
    : <Minus className="h-5 w-5 text-gray-500" />;

  const trendText = data.spendingTrend === 'increasing' 
    ? 'עלייה בהוצאות'
    : data.spendingTrend === 'decreasing'
    ? 'ירידה בהוצאות'
    : 'יציבות';

  const progressPercent = Math.min((data.daysInPhase / 30) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          מעקב התנהלות 📊
        </h1>
        <p className="mt-2 text-gray-600">
          אנחנו עוקבים אחרי ההוצאות שלך ומזהים דפוסים
        </p>
      </div>

      {/* Progress Card */}
      <Card className={`border-2 ${data.readyForBudget ? 'border-green-400 bg-green-50' : 'border-phi-gold/30 bg-phi-frost/50'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {data.readyForBudget ? (
              <Sparkles className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingUp className="h-5 w-5 text-phi-gold" />
            )}
            {data.readyForBudget ? 'מוכנים לשלב הבא! 🎉' : 'שלב 2 מתוך 5: זיהוי דפוסים'}
          </CardTitle>
          <CardDescription>
            {data.readyForBudget 
              ? 'יש לנו מספיק נתונים לבנות תקציב!'
              : 'נאסוף נתונים למשך 30 ימים לפחות'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>ימים של מעקב:</span>
              <span className="font-semibold">{data.daysInPhase} / 30</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${data.readyForBudget ? 'bg-green-500' : 'bg-phi-gold'}`} 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>{data.totalTransactions} תנועות נאספו</span>
              <span>{data.readyForBudget ? '✅ מוכנים!' : `עוד ${Math.max(30 - data.daysInPhase, 0)} ימים`}</span>
            </div>

            {data.readyForBudget && (
              <Link href="/dashboard/budget">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white mt-2">
                  <Target className="h-4 w-4 ml-2" />
                  בנה תקציב עכשיו
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">סה״כ הוצאות (30 יום)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-phi-dark">
              {data.totalSpent.toLocaleString('he-IL')} ₪
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">ממוצע יומי</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-phi-dark">
              {Math.round(data.avgDailySpend).toLocaleString('he-IL')} ₪
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">מגמה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {trendIcon}
              <span className={`text-lg font-semibold ${
                data.spendingTrend === 'increasing' ? 'text-red-600' :
                data.spendingTrend === 'decreasing' ? 'text-green-600' : 'text-gray-600'
              }`}>
                {trendText}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Categories */}
      {data.topCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">קטגוריות מובילות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topCategories.map((cat, index) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24 truncate">{cat.category}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        index === 0 ? 'bg-phi-gold' : 
                        index === 1 ? 'bg-phi-mint' : 'bg-phi-frost'
                      }`}
                      style={{ width: `${cat.percent}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-20 text-left">
                    {cat.amount.toLocaleString('he-IL')} ₪
                  </span>
                  <span className="text-xs text-gray-500 w-10">
                    {cat.percent}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {data.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-phi-gold" />
              תובנות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.insights.map((insight) => (
                <div 
                  key={insight.id}
                  className={`p-3 rounded-lg border-r-4 ${
                    insight.priority === 'high' ? 'bg-red-50 border-red-400' :
                    insight.priority === 'medium' ? 'bg-amber-50 border-amber-400' :
                    'bg-blue-50 border-blue-400'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{insight.emoji || '💡'}</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{insight.title || insight.pattern}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {insight.description || insight.insight_text}
                      </p>
                      {insight.suggested_action && (
                        <button className="text-xs text-phi-gold font-medium mt-2 hover:underline">
                          {insight.suggested_action} →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              רענן ניתוח
            </CardTitle>
            <CardDescription>
              עדכן תובנות ודפוסים
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={loadDashboardData}
            >
              <RefreshCw className="h-4 w-4 ml-2" />
              רענן עכשיו
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              דוחות
            </CardTitle>
            <CardDescription>
              צפה בניתוח מפורט
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/reports">
              <Button variant="outline" className="w-full">צפה בדוחות</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default BehaviorDashboard;
