'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import Link from 'next/link';
import TransactionDetailsView from '@/components/dashboard/TransactionDetailsView';
import { PageWrapper, PageHeader, Card as DSCard, EmptyState } from '@/components/ui/design-system';

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
    <PageWrapper>
        <PageHeader
          title="הוצאות"
          subtitle="מעקב והיסטוריה של כל ההוצאות שלך"
          action={
            <Link
              href="/dashboard/data/expenses"
              className="bg-phi-dark hover:bg-phi-slate text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              + הוסף הוצאה
            </Link>
          }
        />

        {/* Monthly trend chart — phi palette only */}
        <DSCard padding="lg">
          <h2 className="text-base font-semibold mb-4 text-gray-900">מגמת הוצאות חודשית</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="monthName" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => `₪${value.toLocaleString('he-IL')}`}
                  labelStyle={{ textAlign: 'right' }}
                />
                <Legend />
                <Bar dataKey="fixed" name="קבועות" fill="#074259" />
                <Bar dataKey="variable" name="משתנות" fill="#1C8C63" />
                <Bar dataKey="special" name="מיוחדות" fill="#F2C166" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="mx-auto h-10 w-10 mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">אין נתונים להצגה</p>
              <p className="text-xs text-gray-400 mt-1">התחל להוסיף הוצאות כדי לראות את הגרף</p>
            </div>
          )}
        </DSCard>

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
            <EmptyState
              icon={DollarSign}
              title="אין הוצאות עדיין"
              description="התחל להוסיף הוצאות כדי לראות אותן כאן"
              action={{ label: 'הוסף הוצאה ראשונה', href: '/dashboard/data/expenses' }}
            />
          )}
        </div>
    </PageWrapper>
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
    <DSCard padding="sm" className="overflow-hidden">
      {/* כותרת - ניתן ללחיצה */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{monthName}</h3>
            <p className="text-sm text-phi-slate">{data.count} תנועות</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-end">
            <p className="text-2xl font-bold text-gray-900">₪{data.total.toLocaleString('he-IL')}</p>
            <p className="text-sm text-phi-slate">סה&quot;כ הוצאות</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-6 w-6 text-phi-slate" />
          ) : (
            <ChevronDown className="h-6 w-6 text-phi-slate" />
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
    </DSCard>
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
    blue:   'bg-sky-50 border-sky-200 text-phi-dark',
    green:  'bg-emerald-50 border-emerald-200 text-phi-mint',
    yellow: 'bg-amber-50 border-amber-200 text-phi-coral',
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
                    <ChevronUp className="h-5 w-5 text-phi-slate" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-phi-slate" />
                  )}
                  <div className="text-right">
                <p className="font-medium text-gray-900">{category}</p>
                <p className="text-sm text-phi-slate">{items.length} תנועות</p>
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
                          <p className="text-sm text-phi-slate">
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
  // Check expense_type first (set by OCR/AI classification)
  if (tx.expense_type === 'fixed') return 'fixed';
  if (tx.expense_type === 'variable') return 'variable';
  if (tx.expense_type === 'special') return 'special';

  // Fallback to expense_frequency (set by manual entry)
  if (tx.expense_frequency === 'fixed') return 'fixed';
  if (tx.expense_frequency === 'special') return 'special';
  if (tx.expense_frequency === 'temporary' || tx.expense_frequency === 'one_time') return 'variable';

  // Last resort: try to infer from expense_category via known fixed categories
  const fixedCategories = new Set([
    'שכירות', 'משכנתא', 'ביטוח בריאות', 'ביטוח רכב', 'ביטוח דירה', 'ביטוח חיים',
    'חשמל', 'מים', 'גז', 'ארנונה', 'ועד בית', 'אינטרנט', 'סלולר', 'טלפון',
    'גן ילדים', 'צהרון', 'שכר לימוד', 'חוגים', 'הלוואה', 'החזר הלוואה',
    'ביטוח לאומי', 'מס הכנסה', 'קופת גמל', 'קרן פנסיה', 'קרן השתלמות',
  ]);
  const cat = tx.expense_category || tx.category || '';
  if (fixedCategories.has(cat)) return 'fixed';

  return 'variable';
}
