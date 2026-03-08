'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, TrendingUp, TrendingDown, Activity, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import Link from 'next/link';

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

interface CashFlowData {
  monthlyData: MonthlyData[];
  currentBalance: number;
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
}

export default function CashFlowReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<CashFlowData | null>(null);

  useEffect(() => {
    loadCashFlowData();
  }, []);

  const loadCashFlowData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('לא מחובר');
        return;
      }

      // Get last 6 months of transactions
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .gte('tx_date', sixMonthsAgo.toISOString().split('T')[0])
        .order('tx_date', { ascending: true });

      if (txError) {
        console.error('Error loading transactions:', txError);
        setError('שגיאה בטעינת נתונים');
        return;
      }

      // Get current account balance from user profile
      const { data: profile } = await (supabase as any)
        .from('user_financial_profile')
        .select('current_account_balance')
        .eq('user_id', user.id)
        .single();

      const currentBalance = profile?.current_account_balance || 0;

      // Process transactions by month
      const monthlyMap: Record<string, { income: number; expenses: number }> = {};
      let totalIncome = 0;
      let totalExpenses = 0;

      (transactions as any[] || []).forEach((tx: any) => {
        const date = new Date(tx.tx_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { income: 0, expenses: 0 };
        }

        if (tx.type === 'income') {
          monthlyMap[monthKey].income += tx.amount;
          totalIncome += tx.amount;
        } else if (tx.type === 'expense') {
          monthlyMap[monthKey].expenses += Math.abs(tx.amount);
          totalExpenses += Math.abs(tx.amount);
        }
      });

      // Convert to array and sort
      const monthlyData: MonthlyData[] = Object.entries(monthlyMap)
        .map(([month, values]) => {
          const [year, monthNum] = month.split('-');
          const date = new Date(parseInt(year), parseInt(monthNum) - 1);
          const monthName = date.toLocaleDateString('he-IL', { month: 'short', year: 'numeric' });
          
          return {
            month: monthName,
            income: values.income,
            expenses: values.expenses,
            balance: values.income - values.expenses,
          };
        })
        .sort((a, b) => a.month.localeCompare(b.month));

      setData({
        monthlyData,
        currentBalance,
        totalIncome,
        totalExpenses,
        netFlow: totalIncome - totalExpenses,
      });

    } catch (err: any) {
      console.error('Error loading cash flow:', err);
      setError('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl" dir="rtl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
        <h1 className="text-3xl font-bold text-gray-900">תזרים מזומנים 💹</h1>
        <p className="mt-2 text-gray-600">
            הכנסות מול הוצאות - תזרים חודשי ב-6 החודשים האחרונים
        </p>
        </div>
        <Link href="/dashboard/reports/cash-flow">
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <ArrowRight className="w-4 h-4" />
            עדכן יתרה
          </button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">יתרה נוכחית</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data?.currentBalance || 0)}</p>
              </div>
              <Activity className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">סה״כ הכנסות</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data?.totalIncome || 0)}</p>
              </div>
              <TrendingUp className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">סה״כ הוצאות</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data?.totalExpenses || 0)}</p>
              </div>
              <TrendingDown className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${(data?.netFlow || 0) >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-orange-500 to-orange-600'} text-white`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">תזרים נטו</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data?.netFlow || 0)}</p>
              </div>
              <Activity className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart - Income vs Expenses */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            הכנסות מול הוצאות - פירוט חודשי
          </CardTitle>
          <CardDescription>
            השוואה חודשית בין הכנסות להוצאות
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data?.monthlyData || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelStyle={{ direction: 'rtl' }}
              />
              <Legend />
              <Bar dataKey="income" fill="#10b981" name="הכנסות" />
              <Bar dataKey="expenses" fill="#ef4444" name="הוצאות" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Line Chart - Monthly Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            מאזן חודשי
          </CardTitle>
          <CardDescription>
            הפרש בין הכנסות להוצאות לפי חודש
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data?.monthlyData || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelStyle={{ direction: 'rtl' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="balance" 
                stroke="#3b82f6" 
                strokeWidth={3}
                name="מאזן" 
                dot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>פירוט חודשי מלא</CardTitle>
          <CardDescription>
            נתונים מפורטים לכל חודש
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b">
                  <th className="p-3 font-semibold">חודש</th>
                  <th className="p-3 font-semibold text-green-600">הכנסות</th>
                  <th className="p-3 font-semibold text-red-600">הוצאות</th>
                  <th className="p-3 font-semibold text-blue-600">מאזן</th>
                </tr>
              </thead>
              <tbody>
                {data?.monthlyData.map((month, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-3">{month.month}</td>
                    <td className="p-3 text-green-600 font-medium">{formatCurrency(month.income)}</td>
                    <td className="p-3 text-red-600 font-medium">{formatCurrency(month.expenses)}</td>
                    <td className={`p-3 font-bold ${month.balance >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {formatCurrency(month.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
