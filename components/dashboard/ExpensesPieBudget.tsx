'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import {
  ChevronRight, ArrowRight, Loader2, Wallet,
  TrendingDown, Sparkles, ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';

// ─── Colors ────────────────────────────────────────
const COLORS = [
  '#3A7BD5', '#7ED957', '#F6A623', '#E74C3C', '#9B59B6',
  '#1ABC9C', '#E67E22', '#2ECC71', '#3498DB', '#F39C12',
  '#D35400', '#8E44AD', '#16A085', '#C0392B', '#2980B9',
];

// ─── Types ─────────────────────────────────────────
interface CategoryData {
  name: string;
  value: number;
  count: number;
  expense_type?: string;
}

interface SubCategoryData {
  name: string;
  value: number;
  count: number;
}

interface BudgetRecommendation {
  category: string;
  actual: number;
  recommended: number;
  difference: number;
  tip: string;
}

type ViewMode = 'pie' | 'subcategory' | 'budget';

// ─── Main Component ────────────────────────────────
export function ExpensesPieBudget() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategoryData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<BudgetRecommendation[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('pie');
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetSaved, setBudgetSaved] = useState(false);

  // Fetch main categories
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard/expenses-pie-budget');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
        setTotalIncome(data.totalIncome || 0);
        setRecommendations(data.recommendations || []);
      }
    } catch (err) {
      console.error('Error fetching pie data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // Fetch subcategories when clicking a category
  const handleCategoryClick = async (categoryName: string) => {
    setSelectedCategory(categoryName);
    setViewMode('subcategory');
    setSubLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/expenses-pie-budget?drilldown=${encodeURIComponent(categoryName)}`
      );
      const data = await res.json();
      if (data.success) {
        setSubCategories(data.subCategories || []);
      }
    } catch (err) {
      console.error('Error fetching subcategories:', err);
    } finally {
      setSubLoading(false);
    }
  };

  // Save budget from recommendations
  const handleSaveBudget = async () => {
    setSavingBudget(true);
    try {
      const res = await fetch('/api/budget/create-from-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendations }),
      });
      if (res.ok) {
        setBudgetSaved(true);
        setTimeout(() => setBudgetSaved(false), 3000);
      }
    } catch (err) {
      console.error('Error saving budget:', err);
    } finally {
      setSavingBudget(false);
    }
  };

  const totalExpenses = categories.reduce((s, c) => s + c.value, 0);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (categories.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          {viewMode !== 'pie' && (
            <button
              onClick={() => {
                setViewMode('pie');
                setSelectedCategory(null);
              }}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <ArrowRight className="w-4 h-4 text-gray-500" />
            </button>
          )}
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            {viewMode === 'pie' && 'פילוח הוצאות לפי קטגוריה'}
            {viewMode === 'subcategory' && `${selectedCategory} — פירוט`}
            {viewMode === 'budget' && 'המלצות תקציב'}
          </h3>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => { setViewMode('pie'); setSelectedCategory(null); }}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              viewMode === 'pie' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            גרף
          </button>
          <button
            onClick={() => setViewMode('budget')}
            className={`px-3 py-1 text-xs rounded-lg transition-colors flex items-center gap-1 ${
              viewMode === 'budget' ? 'bg-amber-100 text-amber-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            תקציב
          </button>
        </div>
      </div>

      {/* ── PIE VIEW ── */}
      {viewMode === 'pie' && (
        <div className="px-5 pb-5">
          {/* Total bar */}
          <div className="flex items-center gap-3 mb-4 bg-gray-50 rounded-lg p-3">
            <div className="text-center flex-1">
              <p className="text-xs text-gray-400">סה״כ הוצאות</p>
              <p className="text-lg font-bold text-red-600">₪{totalExpenses.toLocaleString('he-IL')}</p>
            </div>
            {totalIncome > 0 && (
              <>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-400">סה״כ הכנסות</p>
                  <p className="text-lg font-bold text-green-600">₪{totalIncome.toLocaleString('he-IL')}</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-400">יתרה</p>
                  <p className={`text-lg font-bold ${totalIncome - totalExpenses >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    ₪{(totalIncome - totalExpenses).toLocaleString('he-IL')}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Pie chart + legend */}
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <div className="w-full lg:w-1/2" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={50}
                    paddingAngle={2}
                    onClick={(_, idx) => handleCategoryClick(categories[idx].name)}
                    style={{ cursor: 'pointer' }}
                    label={({ name, percent }) =>
                      percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}
                  >
                    {categories.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `₪${value.toLocaleString('he-IL')}`}
                    contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend as clickable list */}
            <div className="w-full lg:w-1/2 max-h-[280px] overflow-y-auto space-y-1">
              {categories.map((cat, idx) => {
                const pct = totalExpenses > 0 ? ((cat.value / totalExpenses) * 100).toFixed(1) : '0';
                return (
                  <button
                    key={cat.name}
                    onClick={() => handleCategoryClick(cat.name)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group text-right"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-sm text-gray-800 truncate">{cat.name}</span>
                      <span className="text-xs text-gray-400">({cat.count})</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium text-gray-900">
                        ₪{cat.value.toLocaleString('he-IL')}
                      </span>
                      <span className="text-xs text-gray-400">{pct}%</span>
                      <ChevronLeft className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CTA for budget */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">לחץ על קטגוריה לפירוט, או בנה תקציב מהנתונים</p>
            <button
              onClick={() => setViewMode('budget')}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium rounded-lg transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              בנה תקציב
            </button>
          </div>
        </div>
      )}

      {/* ── SUBCATEGORY VIEW ── */}
      {viewMode === 'subcategory' && (
        <div className="px-5 pb-5">
          {subLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : subCategories.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">אין נתונים לפירוט</p>
          ) : (
            <>
              {/* Sub-pie */}
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <div className="w-full lg:w-1/2" style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={subCategories}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={35}
                        paddingAngle={2}
                        label={({ name, percent }) =>
                          percent > 0.08 ? `${(percent * 100).toFixed(0)}%` : ''
                        }
                        labelLine={false}
                      >
                        {subCategories.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[(idx + 3) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `₪${value.toLocaleString('he-IL')}`}
                        contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full lg:w-1/2 max-h-[240px] overflow-y-auto space-y-1">
                  {subCategories.map((sub, idx) => {
                    const subTotal = subCategories.reduce((s, c) => s + c.value, 0);
                    const pct = subTotal > 0 ? ((sub.value / subTotal) * 100).toFixed(1) : '0';
                    return (
                      <div
                        key={sub.name}
                        className="flex items-center justify-between p-2 rounded-lg text-right"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[(idx + 3) % COLORS.length] }}
                          />
                          <span className="text-sm text-gray-800 truncate">{sub.name}</span>
                          <span className="text-xs text-gray-400">({sub.count})</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-medium text-gray-900">
                            ₪{sub.value.toLocaleString('he-IL')}
                          </span>
                          <span className="text-xs text-gray-400">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── BUDGET RECOMMENDATIONS VIEW ── */}
      {viewMode === 'budget' && (
        <div className="px-5 pb-5">
          {recommendations.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">אין מספיק נתונים להמלצות תקציב</p>
          ) : (
            <>
              {/* Bar chart: actual vs recommended */}
              <div className="mb-4" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={recommendations.slice(0, 8)}
                    layout="vertical"
                    margin={{ right: 20, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={100}
                      tick={{ fontSize: 11, textAnchor: 'start' }}
                      mirror
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `₪${value.toLocaleString('he-IL')}`,
                        name === 'actual' ? 'בפועל' : 'מומלץ',
                      ]}
                      contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                    />
                    <Legend
                      formatter={(value) => (value === 'actual' ? 'בפועל' : 'מומלץ')}
                    />
                    <Bar dataKey="actual" fill="#E74C3C" name="actual" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="recommended" fill="#3A7BD5" name="recommended" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Recommendations table */}
              <div className="border border-gray-100 rounded-lg overflow-hidden mb-4">
                <div className="grid grid-cols-12 gap-0 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 border-b">
                  <div className="col-span-4">קטגוריה</div>
                  <div className="col-span-2 text-center">בפועל</div>
                  <div className="col-span-2 text-center">מומלץ</div>
                  <div className="col-span-2 text-center">הפרש</div>
                  <div className="col-span-2 text-center">טיפ</div>
                </div>
                <div className="max-h-[240px] overflow-y-auto divide-y divide-gray-50">
                  {recommendations.map((rec) => {
                    const isOver = rec.actual > rec.recommended;
                    return (
                      <div key={rec.category} className="grid grid-cols-12 gap-0 px-3 py-2 text-sm items-center">
                        <div className="col-span-4 font-medium text-gray-900 truncate">{rec.category}</div>
                        <div className="col-span-2 text-center text-red-600">₪{rec.actual.toLocaleString('he-IL')}</div>
                        <div className="col-span-2 text-center text-blue-600">₪{rec.recommended.toLocaleString('he-IL')}</div>
                        <div className={`col-span-2 text-center font-medium ${isOver ? 'text-red-500' : 'text-green-500'}`}>
                          {isOver ? '+' : ''}₪{rec.difference.toLocaleString('he-IL')}
                        </div>
                        <div className="col-span-2 text-center text-xs text-gray-400 truncate" title={rec.tip}>
                          {rec.tip}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Save budget + link */}
              <div className="flex items-center justify-between gap-3">
                <Link
                  href="/dashboard/budget"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  לעמוד תקציב מלא <ChevronLeft className="w-3 h-3" />
                </Link>
                <button
                  onClick={handleSaveBudget}
                  disabled={savingBudget || budgetSaved}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    budgetSaved
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  {savingBudget ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : budgetSaved ? (
                    '✓ התקציב נשמר!'
                  ) : (
                    <>
                      <Wallet className="w-4 h-4" />
                      שמור כתקציב חודשי
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
