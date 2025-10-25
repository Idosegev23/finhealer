'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, DollarSign, 
  Calendar, PieChart, BarChart3, Activity,
  ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Stats {
  total: number;
  totalTransactions: number;
  byCategory: Record<string, { total: number; count: number; percentage: number }>;
  byFrequency: Record<string, { total: number; count: number; percentage: number }>;
  byMonth: Record<string, { total: number; count: number }>;
  averagePerTransaction: number;
  largestExpense: any;
  smallestExpense: any;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  food_beverages: { label: '🍔 מזון ומשקאות', color: '#FF6384' },
  cellular_communication: { label: '📱 סלולר ותקשורת', color: '#36A2EB' },
  entertainment_leisure: { label: '🎬 בילויים', color: '#FFCE56' },
  transportation_fuel: { label: '⛽ תחבורה', color: '#4BC0C0' },
  housing_maintenance: { label: '🏠 דיור', color: '#9966FF' },
  clothing_footwear: { label: '👕 ביגוד', color: '#FF9F40' },
  health_medical: { label: '💊 בריאות', color: '#FF6384' },
  education: { label: '📚 חינוך', color: '#36A2EB' },
  utilities: { label: '⚡ שירותים', color: '#FFCE56' },
  shopping_general: { label: '🛒 קניות', color: '#4BC0C0' },
  subscriptions: { label: '📺 מנויים', color: '#9966FF' },
  insurance: { label: '🛡️ ביטוחים', color: '#FF9F40' },
  loans_debt: { label: '💳 חובות', color: '#FF6384' },
  other: { label: '📦 אחר', color: '#E7E9ED' },
};

const FREQUENCY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  fixed: { label: 'קבועות', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: '🔄' },
  temporary: { label: 'זמניות', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: '⏱️' },
  special: { label: 'מיוחדות', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: '⭐' },
  one_time: { label: 'חד פעמיות', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', icon: '1️⃣' },
};

export default function ExpensesOverviewPage() {
  const [period, setPeriod] = useState<string>('month');
  const [stats, setStats] = useState<Stats | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/expenses/analytics?period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 py-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">טוען סטטיסטיקות...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">אין נתונים להצגה</h1>
          <p className="text-gray-600 dark:text-gray-400">העלה דוחות או הוסף הוצאות כדי לראות סטטיסטיקות</p>
        </div>
      </div>
    );
  }

  const categoryData = Object.entries(stats.byCategory)
    .map(([key, data]) => ({
      name: CATEGORY_LABELS[key]?.label || key,
      value: data.total,
      count: data.count,
      percentage: data.percentage,
      color: CATEGORY_LABELS[key]?.color || '#E7E9ED',
    }))
    .sort((a, b) => b.value - a.value);

  const frequencyData = Object.entries(stats.byFrequency)
    .map(([key, data]) => ({
      name: FREQUENCY_LABELS[key]?.label || key,
      value: data.total,
      count: data.count,
      percentage: data.percentage,
      color: FREQUENCY_LABELS[key]?.color || '',
      icon: FREQUENCY_LABELS[key]?.icon || '',
    }))
    .sort((a, b) => b.value - a.value);

  const monthData = Object.entries(stats.byMonth)
    .map(([month, data]) => ({
      month,
      total: data.total,
      count: data.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 py-12 px-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-3 flex items-center gap-3">
                <Activity className="w-12 h-12 text-blue-600" />
                סקירת הוצאות
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                מעקב אחר ההוצאות, הרגלים והתקדמות שלך
              </p>
            </div>
            
            {/* Period Selector */}
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-48 h-12 text-lg font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">חודש נוכחי 📅</SelectItem>
                <SelectItem value="quarter">רבעון נוכחי 📊</SelectItem>
                <SelectItem value="year">שנה נוכחית 📈</SelectItem>
                <SelectItem value="all">כל הזמן ⏳</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Expenses */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-8 h-8 text-blue-100" />
                  <ArrowUpRight className="w-5 h-5 text-blue-200" />
                </div>
                <p className="text-blue-100 text-sm font-medium mb-1">סה"כ הוצאות</p>
                <p className="text-4xl font-black text-white">₪{stats.total.toLocaleString()}</p>
                <p className="text-blue-200 text-xs mt-2">{stats.totalTransactions} תנועות</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Average Transaction */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-8 h-8 text-purple-100" />
                  <Activity className="w-5 h-5 text-purple-200" />
                </div>
                <p className="text-purple-100 text-sm font-medium mb-1">ממוצע לתנועה</p>
                <p className="text-4xl font-black text-white">₪{stats.averagePerTransaction.toLocaleString()}</p>
                <p className="text-purple-200 text-xs mt-2">הוצאה טיפוסית</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Largest Expense */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-red-500 to-red-600 border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-8 h-8 text-red-100" />
                  <ArrowUpRight className="w-5 h-5 text-red-200" />
                </div>
                <p className="text-red-100 text-sm font-medium mb-1">הוצאה הגדולה ביותר</p>
                <p className="text-4xl font-black text-white">
                  ₪{stats.largestExpense?.amount?.toLocaleString() || 0}
                </p>
                <p className="text-red-200 text-xs mt-2 truncate">
                  {stats.largestExpense?.notes || stats.largestExpense?.vendor || 'לא זמין'}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Fixed Expenses */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-8 h-8 text-green-100" />
                  <TrendingDown className="w-5 h-5 text-green-200" />
                </div>
                <p className="text-green-100 text-sm font-medium mb-1">הוצאות קבועות</p>
                <p className="text-4xl font-black text-white">
                  ₪{(stats.byFrequency.fixed?.total || 0).toLocaleString()}
                </p>
                <p className="text-green-200 text-xs mt-2">
                  {Math.round(stats.byFrequency.fixed?.percentage || 0)}% מסך ההוצאות
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Category Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <PieChart className="w-6 h-6 text-blue-600" />
                  חלוקה לפי קטגוריות
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryData.slice(0, 8).map((cat, index) => (
                    <motion.div
                      key={cat.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.05 }}
                      className="flex items-center gap-4"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      ></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-900 dark:text-white truncate">
                            {cat.name}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                            {Math.round(cat.percentage)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${cat.percentage}%`,
                              backgroundColor: cat.color,
                            }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {cat.count} תנועות
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            ₪{cat.value.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Frequency Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                  חלוקה לפי תדירות
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {frequencyData.map((freq, index) => (
                    <motion.div
                      key={freq.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{freq.icon}</span>
                          <div>
                            <p className="font-bold text-lg text-gray-900 dark:text-white">
                              {freq.name}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {freq.count} תנועות
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-2xl font-black text-gray-900 dark:text-white">
                            ₪{freq.value.toLocaleString()}
                          </p>
                          <Badge className={`${freq.color} border-0 mt-1`}>
                            {Math.round(freq.percentage)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-purple-600"
                          style={{ width: `${freq.percentage}%` }}
                        ></div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Monthly Trend */}
        {monthData.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mb-8"
          >
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Calendar className="w-6 h-6 text-green-600" />
                  מגמה חודשית
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {monthData.map((month, index) => {
                    const maxTotal = Math.max(...monthData.map((m) => m.total));
                    const percentage = (month.total / maxTotal) * 100;
                    
                    return (
                      <motion.div
                        key={month.month}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.9 + index * 0.05 }}
                        className="flex items-center gap-4"
                      >
                        <div className="w-24 flex-shrink-0">
                          <span className="font-bold text-gray-900 dark:text-white">
                            {new Date(month.month + '-01').toLocaleDateString('he-IL', {
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-8 relative overflow-hidden">
                            <div
                              className="h-8 rounded-full transition-all duration-500 bg-gradient-to-r from-green-500 to-blue-600 flex items-center justify-end px-4"
                              style={{ width: `${percentage}%` }}
                            >
                              <span className="text-white font-bold text-sm">
                                ₪{month.total.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="w-20 text-left">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {month.count} תנועות
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <Card className="shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Activity className="w-6 h-6 text-blue-600" />
                  תנועות אחרונות
                </CardTitle>
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/dashboard/expenses'}
                >
                  צפה בהכל
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.slice(0, 10).map((transaction, index) => (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.1 + index * 0.05 }}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {transaction.notes || transaction.vendor || 'לא מצוין'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(transaction.tx_date).toLocaleDateString('he-IL')}
                        </span>
                        {transaction.expense_frequency && (
                          <Badge className={`${FREQUENCY_LABELS[transaction.expense_frequency]?.color} border-0 text-xs`}>
                            {FREQUENCY_LABELS[transaction.expense_frequency]?.icon}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        ₪{transaction.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {CATEGORY_LABELS[transaction.detailed_category || transaction.category]?.label?.replace(/[^\u0590-\u05FF\s]/g, '').trim() || transaction.category}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

