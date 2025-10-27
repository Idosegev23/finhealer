'use client';

import { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';

export default function IncomeVsExpensesChart() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // טען 12 חודשים אחרונים
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toISOString().substring(0, 7);
        
        // שליפת הוצאות
        const expensesRes = await fetch(`/api/expenses/list?month=${monthStr}`);
        const expensesData = await expensesRes.json();

        // שליפת הכנסות (נניח API דומה)
        const incomeRes = await fetch(`/api/income/list?month=${monthStr}`);
        const incomeData = await incomeRes.json();

        months.push({
          month: date.toLocaleDateString('he-IL', { month: 'short', year: 'numeric' }),
          income: incomeData.success ? incomeData.summary?.total || 0 : 0,
          expenses: expensesData.success ? expensesData.summary?.total || 0 : 0,
          balance: (incomeData.summary?.total || 0) - (expensesData.summary?.total || 0),
        });
      }

      setData(months);

      // חישוב סיכומים
      const totalIncome = months.reduce((sum, m) => sum + m.income, 0);
      const totalExpenses = months.reduce((sum, m) => sum + m.expenses, 0);
      const avgIncome = totalIncome / months.length;
      const avgExpenses = totalExpenses / months.length;
      const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

      setSummary({
        totalIncome,
        totalExpenses,
        avgIncome,
        avgExpenses,
        totalBalance: totalIncome - totalExpenses,
        savingsRate,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-100 text-sm font-medium">סה"כ הכנסות</span>
            <TrendingUp className="w-5 h-5 text-green-100" />
          </div>
          <p className="text-3xl font-bold">₪{summary?.totalIncome?.toLocaleString() || 0}</p>
          <p className="text-sm text-green-100 mt-2">
            ממוצע: ₪{summary?.avgIncome?.toLocaleString() || 0}/חודש
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-100 text-sm font-medium">סה"כ הוצאות</span>
            <TrendingDown className="w-5 h-5 text-red-100" />
          </div>
          <p className="text-3xl font-bold">₪{summary?.totalExpenses?.toLocaleString() || 0}</p>
          <p className="text-sm text-red-100 mt-2">
            ממוצע: ₪{summary?.avgExpenses?.toLocaleString() || 0}/חודש
          </p>
        </div>

        <div className={`${summary?.totalBalance >= 0 ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-orange-500 to-orange-600'} text-white rounded-xl shadow-lg p-6`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/80 text-sm font-medium">מאזן</span>
            <DollarSign className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-3xl font-bold">₪{summary?.totalBalance?.toLocaleString() || 0}</p>
          <p className="text-sm text-white/80 mt-2">
            {summary?.totalBalance >= 0 ? 'עודף' : 'גירעון'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-100 text-sm font-medium">שיעור חיסכון</span>
            {summary?.savingsRate >= 10 ? (
              <CheckCircle className="w-5 h-5 text-purple-100" />
            ) : (
              <AlertCircle className="w-5 h-5 text-purple-100" />
            )}
          </div>
          <p className="text-3xl font-bold">{summary?.savingsRate?.toFixed(1) || 0}%</p>
          <p className="text-sm text-purple-100 mt-2">
            {summary?.savingsRate >= 20 ? 'מצוין!' : summary?.savingsRate >= 10 ? 'טוב' : 'ניתן לשפר'}
          </p>
        </div>
      </div>

      {/* Main Chart - Income vs Expenses */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6">הכנסות לעומת הוצאות - 12 חודשים</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              formatter={(value: any) => `₪${value.toLocaleString()}`}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
            />
            <Legend />
            <Bar dataKey="income" name="הכנסות" fill="#10b981" radius={[8, 8, 0, 0]} />
            <Bar dataKey="expenses" name="הוצאות" fill="#ef4444" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Balance Trend */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6">מגמת מאזן חודשי</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              formatter={(value: any) => `₪${value.toLocaleString()}`}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
            />
            <Area 
              type="monotone" 
              dataKey="balance" 
              name="מאזן"
              stroke="#3b82f6" 
              fillOpacity={1} 
              fill="url(#colorBalance)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Line Chart - Trends */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6">מגמות לאורך זמן</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              formatter={(value: any) => `₪${value.toLocaleString()}`}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="income" 
              name="הכנסות"
              stroke="#10b981" 
              strokeWidth={3}
              dot={{ fill: '#10b981', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="expenses" 
              name="הוצאות"
              stroke="#ef4444" 
              strokeWidth={3}
              dot={{ fill: '#ef4444', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <h4 className="text-lg font-bold text-blue-900 mb-3">💡 תובנות</h4>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>
                {summary?.savingsRate >= 20 
                  ? 'מצוין! אתה חוסך מעל 20% מההכנסות שלך.' 
                  : summary?.savingsRate >= 10
                  ? 'טוב! אתה חוסך כ-10-20% מההכנסות. נסה להגיע ל-20%.'
                  : 'שיעור החיסכון נמוך. נסה להפחית הוצאות או להגדיל הכנסות.'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>
                הממוצע החודשי שלך: ₪{summary?.avgExpenses?.toLocaleString() || 0} הוצאות.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>
                {summary?.totalBalance >= 0 
                  ? `יש לך עודף של ₪${summary?.totalBalance?.toLocaleString()} ב-12 חודשים האחרונים!`
                  : `יש לך גירעון של ₪${Math.abs(summary?.totalBalance || 0).toLocaleString()}. זמן לאיזון.`}
              </span>
            </li>
          </ul>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <h4 className="text-lg font-bold text-green-900 mb-3">🎯 המלצות</h4>
          <ul className="space-y-2 text-sm text-green-800">
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>
                {summary?.savingsRate < 10 
                  ? 'התחל בהפחתת הוצאות משתנות כמו בילויים וקניות.'
                  : 'המשך לשמור על שיעור החיסכון הנוכחי!'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>בדוק את ההוצאות הקבועות - אולי ניתן לחסוך שם?</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>הגדר יעד חיסכון חודשי ועקוב אחריו בדשבורד.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

