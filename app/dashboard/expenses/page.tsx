'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import Link from 'next/link';
import WhatsAppBanner from '@/components/dashboard/WhatsAppBanner';
import TransactionDetailsView from '@/components/dashboard/TransactionDetailsView';

interface MonthData {
  month: string;
  total: number;
  count: number;
  byType: {
    fixed: number;
    variable: number;
    special: number;
  };
  byCategory: Record<string, {
    total: number;
    count: number;
    items: any[];
  }>;
  transactions: any[];
}

interface ChartDataPoint {
  month: string;
  monthName: string;
  total: number;
  fixed: number;
  variable: number;
  special: number;
}

export default function ExpensesPage() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [monthlyDetails, setMonthlyDetails] = useState<Record<string, MonthData>>({});
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    try {
      setLoading(true);
      const response = await fetch('/api/expenses/monthly-summary?months=6');
      const data = await response.json();

      if (data.success) {
        setChartData(data.chartData.reverse()); // מהישן לחדש
        setMonthlyDetails(data.monthlyDetails);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">טוען הוצאות...</p>
        </div>
      </div>
    );
  }

  const sortedMonths = Object.keys(monthlyDetails).sort().reverse(); // מהחדש לישן

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <WhatsAppBanner message="רוצה לרשום הוצאה חדשה? פשוט תכתוב לבוט! 📝" />
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">הוצאות</h1>
            <p className="text-gray-600 mt-1">מעקב והיסטוריה של כל ההוצאות שלך</p>
          </div>
          <Link
            href="/dashboard/data/expenses"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            + הוסף הוצאה
          </Link>
        </div>

        {/* Mini Dashboard - גרף חודשי */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-6">מגמת הוצאות חודשית</h2>
          
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthName" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => `₪${value.toLocaleString('he-IL')}`}
                  labelStyle={{ textAlign: 'right' }}
                />
                <Legend />
                <Bar dataKey="fixed" name="קבועות" fill="#3b82f6" />
                <Bar dataKey="variable" name="משתנות" fill="#10b981" />
                <Bar dataKey="special" name="מיוחדות" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="mx-auto h-12 w-12 mb-4 text-gray-300" />
              <p>אין נתונים להצגה</p>
              <p className="text-sm mt-2">התחל להוסיף הוצאות כדי לראות את הגרף</p>
            </div>
          )}
        </div>

        {/* פירוט חודשי */}
        <div className="space-y-4">
          {sortedMonths.length > 0 ? (
            sortedMonths.map((month) => {
              const data = monthlyDetails[month];
              const isExpanded = expandedMonths.has(month);

              return (
                <MonthCard
                  key={month}
                  month={month}
                  data={data}
                  isExpanded={isExpanded}
                  onToggle={() => toggleMonth(month)}
                  onRefresh={fetchExpenses}
                />
              );
            })
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <DollarSign className="mx-auto h-16 w-16 mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">אין הוצאות עדיין</h3>
              <p className="text-gray-500 mb-6">התחל להוסיף הוצאות כדי לראות אותן כאן</p>
              <Link
                href="/dashboard/data/expenses"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                הוסף הוצאה ראשונה
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== קומפוננטת כרטיס חודש ==========
interface MonthCardProps {
  month: string;
  data: MonthData;
  isExpanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}

function MonthCard({ month, data, isExpanded, onToggle, onRefresh }: MonthCardProps) {
  const monthName = formatMonthName(month);

  // חישוב אחוזים
  const fixedPercent = data.total > 0 ? (data.byType.fixed / data.total) * 100 : 0;
  const variablePercent = data.total > 0 ? (data.byType.variable / data.total) * 100 : 0;
  const specialPercent = data.total > 0 ? (data.byType.special / data.total) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* כותרת - ניתן ללחיצה */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{monthName}</h3>
            <p className="text-sm text-gray-500">{data.count} תנועות</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-left">
            <p className="text-2xl font-bold text-gray-900">₪{data.total.toLocaleString('he-IL')}</p>
            <p className="text-sm text-gray-500">סה&quot;כ הוצאות</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-6 w-6 text-gray-400" />
          ) : (
            <ChevronDown className="h-6 w-6 text-gray-400" />
          )}
        </div>
      </button>

      {/* תוכן מפורט */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-6 space-y-6">
          {/* פירוק לפי סוג */}
          <div className="grid grid-cols-3 gap-4">
            <ExpenseTypeCard
              title="📌 קבועות"
              amount={data.byType.fixed}
              percent={fixedPercent}
              color="blue"
            />
            <ExpenseTypeCard
              title="🔄 משתנות"
              amount={data.byType.variable}
              percent={variablePercent}
              color="green"
            />
            <ExpenseTypeCard
              title="⭐ מיוחדות"
              amount={data.byType.special}
              percent={specialPercent}
              color="yellow"
            />
          </div>

          {/* פירוט לפי קטגוריות */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">פירוט לפי קטגוריות:</h4>
            
            {/* הוצאות קבועות */}
            {data.byType.fixed > 0 && (
              <CategoryGroup
                title="הוצאות קבועות"
                categories={data.byCategory}
                transactions={data.transactions}
                type="fixed"
                onRefresh={onRefresh}
              />
            )}

            {/* הוצאות משתנות */}
            {data.byType.variable > 0 && (
              <CategoryGroup
                title="הוצאות משתנות"
                categories={data.byCategory}
                transactions={data.transactions}
                type="variable"
                onRefresh={onRefresh}
              />
            )}

            {/* הוצאות מיוחדות */}
            {data.byType.special > 0 && (
              <CategoryGroup
                title="הוצאות מיוחדות"
                categories={data.byCategory}
                transactions={data.transactions}
                type="special"
                onRefresh={onRefresh}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ========== כרטיס סוג הוצאה ==========
interface ExpenseTypeCardProps {
  title: string;
  amount: number;
  percent: number;
  color: 'blue' | 'green' | 'yellow';
}

function ExpenseTypeCard({ title, amount, percent, color }: ExpenseTypeCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <p className="text-sm font-medium mb-2">{title}</p>
      <p className="text-2xl font-bold">₪{amount.toLocaleString('he-IL')}</p>
      <p className="text-sm mt-1">{percent.toFixed(1)}% מהסה&quot;כ</p>
    </div>
  );
}

// ========== קבוצת קטגוריות ==========
interface CategoryGroupProps {
  title: string;
  categories: Record<string, any>;
  transactions: any[];
  type: 'fixed' | 'variable' | 'special';
  onRefresh: () => void;
}

function CategoryGroup({ title, categories, transactions, type, onRefresh }: CategoryGroupProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // סינון טרנזקציות לפי סוג
  const relevantTransactions = transactions.filter((tx) => {
    const txType = getExpenseTypeFromTransaction(tx);
    return txType === type;
  });

  // קיבוץ לפי קטגוריה
  const grouped: Record<string, any[]> = {};
  relevantTransactions.forEach((tx) => {
    const category = tx.expense_category || tx.category || 'אחר';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(tx);
  });

  if (Object.keys(grouped).length === 0) return null;

  function toggleCategory(category: string) {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }

  async function handleUnlink(transactionId: string) {
    try {
      const response = await fetch('/api/transactions/link', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentTransactionId: transactionId }),
      });

      if (response.ok) {
        // Re-fetch data instead of hard reload
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to unlink transaction:', error);
    }
  }

  return (
    <div className="mb-6">
      <h5 className="font-medium text-gray-700 mb-3">{title}</h5>
      <div className="space-y-2">
        {Object.entries(grouped).map(([category, items]) => {
          const total = items.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
          const isExpanded = expandedCategories.has(category);
          
          return (
            <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                  <div className="text-right">
                <p className="font-medium text-gray-900">{category}</p>
                <p className="text-sm text-gray-500">{items.length} תנועות</p>
                  </div>
              </div>
              <p className="font-semibold text-gray-900">₪{total.toLocaleString('he-IL')}</p>
              </button>

              {isExpanded && (
                <div className="p-3 bg-white space-y-2">
                  {items.map((tx) => (
                    <div key={tx.id} className="border-r-4 border-blue-400 pr-3">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="font-medium text-gray-900">{tx.vendor || 'לא צוין'}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(tx.tx_date).toLocaleDateString('he-IL')}
                            {tx.payment_method && ` • ${tx.payment_method}`}
                          </p>
                        </div>
                        <p className="text-lg font-semibold text-gray-900">₪{parseFloat(tx.amount).toLocaleString('he-IL')}</p>
                      </div>
                      
                      {/* Show Details if transaction has details */}
                      {tx.has_details && (
                        <TransactionDetailsView
                          transactionId={tx.id}
                          amount={parseFloat(tx.amount)}
                          vendor={tx.vendor || 'לא צוין'}
                          onUnlink={() => handleUnlink(tx.id)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== פונקציות עזר ==========
function formatMonthName(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}

function getExpenseTypeFromTransaction(tx: any): 'fixed' | 'variable' | 'special' {
  if (tx.expense_frequency === 'fixed') return 'fixed';
  if (tx.expense_frequency === 'special') return 'special';
  if (tx.expense_frequency === 'temporary' || tx.expense_frequency === 'one_time') return 'variable';
  
  // ברירת מחדל
  return 'variable';
}
