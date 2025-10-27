'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  TrendingDown, 
  Calendar, 
  Filter, 
  Download, 
  Search,
  CreditCard,
  Wallet,
  PieChart,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Upload,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ReceiptUploader from '@/components/expenses/ReceiptUploader';

const COLORS = {
  food: '#10b981',
  transport: '#3b82f6',
  shopping: '#8b5cf6',
  health: '#ef4444',
  entertainment: '#f59e0b',
  education: '#06b6d4',
  housing: '#f97316',
  utilities: '#84cc16',
  other: '#6b7280',
};

const FREQUENCY_COLORS = {
  fixed: '#3b82f6',
  temporary: '#f59e0b',
  special: '#8b5cf6',
  one_time: '#6b7280',
};

export default function ExpensesAdvancedPage() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [selectedFrequency, setSelectedFrequency] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // UI State
  const [showFilters, setShowFilters] = useState(false);
  const [showUploader, setShowUploader] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, [selectedMonth, selectedCategory, selectedPaymentMethod, selectedFrequency]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedPaymentMethod) params.append('payment_method', selectedPaymentMethod);
      if (selectedFrequency) params.append('expense_frequency', selectedFrequency);

      const response = await fetch(`/api/expenses/list?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setExpenses(data.expenses || []);
        setSummary(data.summary || null);
        setPagination(data.pagination || null);
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (exp.vendor?.toLowerCase().includes(term)) ||
      (exp.notes?.toLowerCase().includes(term)) ||
      (exp.category?.toLowerCase().includes(term))
    );
  });

  // תכין דאטה לגרפים
  const categoryData = summary?.byCategory ? 
    Object.entries(summary.byCategory).map(([key, val]: [string, any]) => ({
      name: key,
      value: val.total,
      count: val.count,
    })) : [];

  const frequencyData = summary?.byFrequency ?
    Object.entries(summary.byFrequency).map(([key, val]: [string, any]) => ({
      name: key === 'fixed' ? 'קבועה' :
            key === 'temporary' ? 'זמנית' :
            key === 'special' ? 'מיוחדת' : 'חד פעמית',
      value: val.total,
      count: val.count,
    })) : [];

  const paymentMethodData = summary?.byPaymentMethod ?
    Object.entries(summary.byPaymentMethod).map(([key, val]: [string, any]) => ({
      name: key === 'credit' ? 'אשראי' :
            key === 'cash' ? 'מזומן' :
            key === 'debit' ? 'חיוב' :
            key === 'digital_wallet' ? 'ארנק דיגיטלי' : 'אחר',
      value: val.total,
      count: val.count,
    })) : [];

  // היסטוריה חודשית (6 חודשים אחרונים)
  const [monthlyHistory, setMonthlyHistory] = useState<any[]>([]);
  useEffect(() => {
    loadMonthlyHistory();
  }, []);

  const loadMonthlyHistory = async () => {
    try {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.toISOString().substring(0, 7);
        
        const response = await fetch(`/api/expenses/list?month=${month}`);
        const data = await response.json();
        
        if (data.success) {
          months.push({
            month: new Date(month).toLocaleDateString('he-IL', { month: 'short', year: 'numeric' }),
            total: data.summary?.total || 0,
          });
        }
      }
      setMonthlyHistory(months);
    } catch (error) {
      console.error('Error loading monthly history:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">הוצאות מפורטות</h1>
              <p className="text-blue-100 mt-1">ניהול וניתוח הוצאות חכם עם AI</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowUploader(!showUploader)}
                className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition flex items-center gap-2"
              >
                <Upload className="w-5 h-5" />
                העלה קבלה
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Upload Modal */}
        {showUploader && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">העלאת קבלה</h2>
                  <button
                    onClick={() => setShowUploader(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <ReceiptUploader onSuccess={() => { setShowUploader(false); loadExpenses(); }} />
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">סה&quot;כ הוצאות</span>
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ₪{summary?.total?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">{summary?.count || 0} תנועות</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">הוצאות קבועות</span>
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ₪{summary?.byFrequency?.fixed?.total?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {summary?.byFrequency?.fixed?.count || 0} פריטים
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">אשראי</span>
              <CreditCard className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ₪{summary?.byPaymentMethod?.credit?.total?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {summary?.byPaymentMethod?.credit?.count || 0} תנועות
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">מזומן</span>
              <Wallet className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ₪{summary?.byPaymentMethod?.cash?.total?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {summary?.byPaymentMethod?.cash?.count || 0} תנועות
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Trend */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              מגמה חודשית (6 חודשים)
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => `₪${value.toLocaleString()}`} />
                <Bar dataKey="total" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-600" />
              פילוח לפי קטגוריה
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPie>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ₪${entry.value.toLocaleString()}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || COLORS.other} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `₪${value.toLocaleString()}`} />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">סינון וחיפוש</h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'הסתר' : 'הצג'} פילטרים
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חפש לפי ספק, תיאור, או קטגוריה..."
              className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">חודש</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">קטגוריה</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">הכל</option>
                  <option value="food">מזון</option>
                  <option value="transport">תחבורה</option>
                  <option value="shopping">קניות</option>
                  <option value="health">בריאות</option>
                  <option value="entertainment">בילויים</option>
                  <option value="education">חינוך</option>
                  <option value="housing">דיור</option>
                  <option value="utilities">שירותים</option>
                  <option value="other">אחר</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">אמצעי תשלום</label>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">הכל</option>
                  <option value="credit">אשראי</option>
                  <option value="cash">מזומן</option>
                  <option value="debit">חיוב</option>
                  <option value="digital_wallet">ארנק דיגיטלי</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">סוג הוצאה</label>
                <select
                  value={selectedFrequency}
                  onChange={(e) => setSelectedFrequency(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">הכל</option>
                  <option value="fixed">קבועה</option>
                  <option value="temporary">זמנית</option>
                  <option value="special">מיוחדת</option>
                  <option value="one_time">חד פעמית</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Expenses List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              רשימת הוצאות ({filteredExpenses.length})
            </h3>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-2">
              <Download className="w-4 h-4" />
              ייצוא לExcel
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">לא נמצאו הוצאות</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">תאריך</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ספק</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">קטגוריה</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סכום</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">תשלום</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סוג</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סטטוס</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(expense.tx_date || expense.date).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>
                          <p className="font-medium">{expense.vendor || 'לא צוין'}</p>
                          {expense.notes && (
                            <p className="text-xs text-gray-500 mt-1">{expense.notes}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {expense.category || 'אחר'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ₪{parseFloat(expense.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {expense.payment_method === 'credit' ? '💳 אשראי' :
                         expense.payment_method === 'cash' ? '💵 מזומן' :
                         expense.payment_method === 'debit' ? '🏦 חיוב' : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {expense.expense_frequency === 'fixed' ? 'קבועה' :
                         expense.expense_frequency === 'temporary' ? 'זמנית' :
                         expense.expense_frequency === 'special' ? 'מיוחדת' : 'חד פעמית'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {expense.status === 'confirmed' ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

