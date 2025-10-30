'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Calendar, FileText, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface IncomeData {
  id: string;
  amount: number;
  source: string;
  category: string;
  date: string;
  payment_method: string;
  notes?: string;
  is_recurring: boolean;
}

interface MonthData {
  month: string;
  total: number;
  count: number;
  bySource: Record<string, number>;
}

interface ChartDataPoint {
  month: string;
  monthName: string;
  total: number;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

export default function IncomePage() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [monthlyDetails, setMonthlyDetails] = useState<Record<string, MonthData>>({});
  const [incomeList, setIncomeList] = useState<IncomeData[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [totalIncome, setTotalIncome] = useState(0);
  const [avgMonthly, setAvgMonthly] = useState(0);
  const [recurringTotal, setRecurringTotal] = useState(0);

  useEffect(() => {
    fetchIncome();
  }, []);

  async function fetchIncome() {
    try {
      setLoading(true);
      const response = await fetch('/api/income/list?months=6');
      const data = await response.json();

      if (data.success) {
        const incomes = data.income || [];
        setIncomeList(incomes);

        // Process data for charts
        const monthlyData: Record<string, MonthData> = {};
        
        incomes.forEach((income: IncomeData) => {
          const month = new Date(income.date).toISOString().slice(0, 7); // YYYY-MM
          
          if (!monthlyData[month]) {
            monthlyData[month] = {
              month,
              total: 0,
              count: 0,
              bySource: {},
            };
          }
          
          monthlyData[month].total += parseFloat(income.amount.toString());
          monthlyData[month].count += 1;
          
          const source = income.source || 'אחר';
          monthlyData[month].bySource[source] = (monthlyData[month].bySource[source] || 0) + parseFloat(income.amount.toString());
        });

        setMonthlyDetails(monthlyData);

        // Chart data
        const months = Object.keys(monthlyData).sort();
        const chartPoints = months.map((month) => ({
          month,
          monthName: formatMonthName(month),
          total: monthlyData[month].total,
        }));
        
        setChartData(chartPoints);

        // Calculate stats
        const total = incomes.reduce((sum: number, inc: IncomeData) => sum + parseFloat(inc.amount.toString()), 0);
        setTotalIncome(total);
        
        const recurring = incomes
          .filter((inc: IncomeData) => inc.is_recurring)
          .reduce((sum: number, inc: IncomeData) => sum + parseFloat(inc.amount.toString()), 0);
        setRecurringTotal(recurring);
        
        const avg = chartPoints.length > 0 ? total / chartPoints.length : 0;
        setAvgMonthly(avg);
      }
    } catch (error) {
      console.error('Error fetching income:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleMonth(month: string) {
    setExpandedMonths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(month)) {
        newSet.delete(month);
      } else {
        newSet.add(month);
      }
      return newSet;
    });
  }

  // Pie chart data (by source)
  const sourceData = Object.entries(
    incomeList.reduce((acc, inc) => {
      const source = inc.source || 'אחר';
      acc[source] = (acc[source] || 0) + parseFloat(inc.amount.toString());
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const sortedMonths = Object.keys(monthlyDetails).sort().reverse();

  // Calculate trend
  const trend = chartData.length >= 2
    ? ((chartData[chartData.length - 1].total - chartData[chartData.length - 2].total) / chartData[chartData.length - 2].total) * 100
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600">טוען הכנסות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">הכנסות 💰</h1>
            <p className="text-gray-600 mt-1">מעקב והיסטוריה של כל ההכנסות שלך</p>
          </div>
          <Link
            href="/dashboard/data/income"
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            + הוסף הכנסה
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                סה&quot;כ הכנסות (6 חודשים)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">₪{totalIncome.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                ממוצע חודשי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">₪{avgMonthly.toLocaleString()}</p>
              <div className="flex items-center gap-1 mt-2">
                {trend >= 0 ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600">+{trend.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-600">{trend.toFixed(1)}%</span>
                  </>
                )}
                <span className="text-sm text-gray-500 mr-1">לעומת חודש קודם</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                הכנסות קבועות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">₪{recurringTotal.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-2">
                {((recurringTotal / totalIncome) * 100).toFixed(0)}% מסה&quot;כ
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart */}
          <Card>
            <CardHeader>
              <CardTitle>מגמת הכנסות חודשית</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monthName" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => `₪${value.toLocaleString()}`}
                      labelStyle={{ textAlign: 'right' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="סה&quot;כ הכנסות"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ fill: '#10b981', r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <DollarSign className="mx-auto h-12 w-12 mb-4 text-gray-300" />
                  <p>אין נתונים להצגה</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>התפלגות לפי מקור</CardTitle>
            </CardHeader>
            <CardContent>
              {sourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${((entry.value / totalIncome) * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `₪${value.toLocaleString()}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <DollarSign className="mx-auto h-12 w-12 mb-4 text-gray-300" />
                  <p>אין נתונים להצגה</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Details */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">פירוט חודשי</h2>
          {sortedMonths.length > 0 ? (
            sortedMonths.map((month) => {
              const data = monthlyDetails[month];
              const isExpanded = expandedMonths.has(month);

              return (
                <Card key={month}>
                  <button
                    onClick={() => toggleMonth(month)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {formatMonthName(month)}
                        </h3>
                        <p className="text-sm text-gray-500">{data.count} תנועות</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-left">
                        <p className="text-2xl font-bold text-green-600">
                          ₪{data.total.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500">סה&quot;כ הכנסות</p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-6 w-6 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-200 p-6">
                      <div className="space-y-3">
                        {incomeList
                          .filter((inc) => inc.date.startsWith(month))
                          .map((inc) => (
                            <div
                              key={inc.id}
                              className="flex justify-between items-start p-4 bg-green-50 rounded-lg border-r-4 border-green-500"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{inc.source}</p>
                                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                  <span>{new Date(inc.date).toLocaleDateString('he-IL')}</span>
                                  {inc.payment_method && (
                                    <>
                                      <span className="w-1 h-1 bg-gray-400 rounded-full" />
                                      <span>{inc.payment_method}</span>
                                    </>
                                  )}
                                  {inc.is_recurring && (
                                    <>
                                      <span className="w-1 h-1 bg-gray-400 rounded-full" />
                                      <span className="text-purple-600 font-medium">קבוע</span>
                                    </>
                                  )}
                                </div>
                                {inc.notes && (
                                  <p className="text-sm text-gray-600 mt-1">{inc.notes}</p>
                                )}
                              </div>
                              <p className="text-xl font-bold text-green-600">
                                ₪{parseFloat(inc.amount.toString()).toLocaleString()}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <DollarSign className="mx-auto h-16 w-16 mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">אין הכנסות עדיין</h3>
                <p className="text-gray-500 mb-6">התחל להוסיף הכנסות כדי לראות אותן כאן</p>
                <Link
                  href="/dashboard/data/income"
                  className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  הוסף הכנסה ראשונה
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMonthName(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}
