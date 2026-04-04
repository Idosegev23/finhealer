'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronLeft, Download, Filter, Calendar, TrendingUp, TrendingDown, Wallet, ArrowUpDown } from 'lucide-react';
import { useToast } from '@/components/ui/toaster';

// ============================================================================
// Types
// ============================================================================

interface CategoryItem {
  name: string;
  amount: number;
  count: number;
}

interface GroupItem {
  name: string;
  amount: number;
  count: number;
  fixed: number;
  variable: number;
  special: number;
  categories: CategoryItem[];
}

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  tx_date: string;
  vendor: string;
  category: string;
  category_group: string;
  frequency: string;
  payment_method: string;
  notes: string;
}

interface FinancialData {
  period: { from: string; to: string; months: number };
  totals: {
    income: number;
    expenses: number;
    balance: number;
    fixed: number;
    variable: number;
    special: number;
    unclassified: number;
  };
  averages: {
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlyFixed: number;
    monthlyVariable: number;
  };
  income: {
    total: number;
    count: number;
    byCategory: CategoryItem[];
    byFrequency: CategoryItem[];
  };
  expenses: {
    total: number;
    count: number;
    byCategory: CategoryItem[];
    byFrequency: CategoryItem[];
    byGroup: GroupItem[];
  };
  transactions: Transaction[];
}

type SortField = 'amount' | 'count' | 'name';
type SortDir = 'asc' | 'desc';

// ============================================================================
// Helpers
// ============================================================================

function fmt(n: number): string {
  return n.toLocaleString('he-IL');
}

function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return Math.round((part / total) * 100) + '%';
}

const FREQ_LABELS: Record<string, string> = {
  fixed: 'קבועה',
  variable: 'משתנה',
  special: 'מיוחדת',
  income: 'הכנסה',
  unclassified: 'לא מסווגת',
};

const FREQ_COLORS: Record<string, string> = {
  fixed: 'bg-blue-100 text-blue-700',
  variable: 'bg-amber-100 text-amber-700',
  special: 'bg-purple-100 text-purple-700',
  income: 'bg-green-100 text-green-700',
  unclassified: 'bg-gray-100 text-gray-600',
};

const MONTH_OPTIONS = [
  { value: 1, label: 'חודש אחרון' },
  { value: 3, label: '3 חודשים' },
  { value: 6, label: '6 חודשים' },
  { value: 12, label: 'שנה' },
];

// ============================================================================
// Component
// ============================================================================

export default function FinancialSummaryTable() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(3);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expenses'>('all');
  const [freqFilter, setFreqFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('amount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const { addToast } = useToast();

  // Fetch data
  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/financial-table?months=${months}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => {
        addToast({ title: 'שגיאה בטעינת נתונים', type: 'error' });
        setLoading(false);
      });
  }, [months]);

  // Sort function
  function sortItems<T extends { amount: number; count: number; name: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const mult = sortDir === 'desc' ? -1 : 1;
      if (sortField === 'amount') return (a.amount - b.amount) * mult;
      if (sortField === 'count') return (a.count - b.count) * mult;
      return a.name.localeCompare(b.name, 'he') * mult;
    });
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  }

  function toggleGroup(name: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleCategory(key: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Filtered transactions for drill-down
  function getTxForCategory(category: string, type?: string): Transaction[] {
    if (!data) return [];
    return data.transactions
      .filter(t =>
        t.category === category &&
        (!type || t.type === type) &&
        (!freqFilter || t.frequency === freqFilter) &&
        (!searchTerm || t.vendor.includes(searchTerm) || t.category.includes(searchTerm))
      )
      .sort((a, b) => new Date(b.tx_date).getTime() - new Date(a.tx_date).getTime());
  }

  // CSV Export
  function exportCSV() {
    if (!data) return;
    const header = 'תאריך,סוג,ספק,קטגוריה,קבוצה,תדירות,סכום,אמצעי תשלום,הערות\n';
    const rows = data.transactions.map(t =>
      `${t.tx_date},${t.type === 'income' ? 'הכנסה' : 'הוצאה'},"${t.vendor}","${t.category}","${t.category_group}",${FREQ_LABELS[t.frequency] || t.frequency},${t.amount},${t.payment_method},"${t.notes}"`
    ).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-summary-${data.period.from}-${data.period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ title: 'הקובץ הורד בהצלחה', type: 'success' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#074259]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg">אין נתונים להצגה</p>
        <p className="text-sm mt-2">העלה דוחות בנק כדי לראות את הטבלה</p>
      </div>
    );
  }

  const { totals, averages, income, expenses } = data;

  return (
    <div className="space-y-6">
      {/* ── Header Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          {MONTH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMonths(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${months === opt.value ? 'bg-[#074259] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="חיפוש ספק/קטגוריה..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-lg w-48 focus:outline-none focus:ring-1 focus:ring-[#074259]"
          />
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<TrendingUp className="w-5 h-5 text-green-600" />} label="סה״כ הכנסות" value={totals.income} color="green" sub={`ממוצע: ${fmt(averages.monthlyIncome)}₪/חודש`} />
        <SummaryCard icon={<TrendingDown className="w-5 h-5 text-red-600" />} label="סה״כ הוצאות" value={totals.expenses} color="red" sub={`ממוצע: ${fmt(averages.monthlyExpenses)}₪/חודש`} />
        <SummaryCard icon={<Wallet className="w-5 h-5 text-blue-600" />} label="מאזן" value={totals.balance} color={totals.balance >= 0 ? 'green' : 'red'} sub={`${income.count + expenses.count} תנועות`} />
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <p className="text-xs text-gray-500 font-medium">פילוח הוצאות</p>
          <div className="space-y-1.5">
            <FreqBar label="קבועות" amount={totals.fixed} total={totals.expenses} color="bg-blue-500" />
            <FreqBar label="משתנות" amount={totals.variable} total={totals.expenses} color="bg-amber-500" />
            <FreqBar label="מיוחדות" amount={totals.special} total={totals.expenses} color="bg-purple-500" />
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 border-b">
        {(['all', 'income', 'expenses'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-[#074259] text-[#074259]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'all' ? 'הכל' : tab === 'income' ? `הכנסות (${income.count})` : `הוצאות (${expenses.count})`}
          </button>
        ))}
        <div className="flex-1" />
        {/* Frequency filter */}
        <div className="flex items-center gap-1 pb-1">
          <Filter className="w-4 h-4 text-gray-400" />
          {['fixed', 'variable', 'special'].map(f => (
            <button
              key={f}
              onClick={() => setFreqFilter(freqFilter === f ? null : f)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${freqFilter === f ? FREQ_COLORS[f] + ' ring-1 ring-current' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
            >
              {FREQ_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Income Table ── */}
      {(activeTab === 'all' || activeTab === 'income') && (
        <Section title="הכנסות" total={income.total} count={income.count} color="green">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-green-50/50">
                <th className="text-right py-2 px-3 font-medium text-gray-700 w-8" />
                <SortHeader label="קטגוריה" field="name" current={sortField} dir={sortDir} onSort={toggleSort} />
                <SortHeader label="סכום" field="amount" current={sortField} dir={sortDir} onSort={toggleSort} className="text-left" />
                <SortHeader label="תנועות" field="count" current={sortField} dir={sortDir} onSort={toggleSort} className="text-left" />
                <th className="text-left py-2 px-3 font-medium text-gray-700">אחוז</th>
              </tr>
            </thead>
            <tbody>
              {sortItems(income.byCategory)
                .filter(c => !searchTerm || c.name.includes(searchTerm))
                .map(cat => {
                  const key = `income:${cat.name}`;
                  const expanded = expandedCategories.has(key);
                  const txs = expanded ? getTxForCategory(cat.name, 'income') : [];
                  return (
                    <CategoryRows
                      key={key}
                      cat={cat}
                      total={income.total}
                      expanded={expanded}
                      onToggle={() => toggleCategory(key)}
                      transactions={txs}
                      color="green"
                    />
                  );
                })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-green-200 bg-green-50/30 font-bold">
                <td />
                <td className="py-2 px-3">סה״כ הכנסות</td>
                <td className="py-2 px-3 text-left text-green-700">{fmt(income.total)}₪</td>
                <td className="py-2 px-3 text-left">{income.count}</td>
                <td className="py-2 px-3 text-left">100%</td>
              </tr>
            </tfoot>
          </table>
        </Section>
      )}

      {/* ── Expenses Table (grouped by category_group) ── */}
      {(activeTab === 'all' || activeTab === 'expenses') && (
        <Section title="הוצאות" total={expenses.total} count={expenses.count} color="red">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-red-50/50">
                <th className="text-right py-2 px-3 font-medium text-gray-700 w-8" />
                <SortHeader label="קטגוריה" field="name" current={sortField} dir={sortDir} onSort={toggleSort} />
                <th className="text-left py-2 px-3 font-medium text-gray-700">קבועות</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">משתנות</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">מיוחדות</th>
                <SortHeader label="סה״כ" field="amount" current={sortField} dir={sortDir} onSort={toggleSort} className="text-left" />
                <th className="text-left py-2 px-3 font-medium text-gray-700">אחוז</th>
              </tr>
            </thead>
            <tbody>
              {sortItems(
                expenses.byGroup.filter(g =>
                  (!freqFilter || g[freqFilter as keyof GroupItem] as number > 0) &&
                  (!searchTerm || g.name.includes(searchTerm) || g.categories.some(c => c.name.includes(searchTerm)))
                )
              ).map(group => {
                const isOpen = expandedGroups.has(group.name);
                return (
                  <GroupRows
                    key={group.name}
                    group={group}
                    totalExpenses={expenses.total}
                    isOpen={isOpen}
                    onToggle={() => toggleGroup(group.name)}
                    expandedCategories={expandedCategories}
                    onToggleCategory={toggleCategory}
                    getTxForCategory={(cat) => getTxForCategory(cat, 'expense')}
                    searchTerm={searchTerm}
                  />
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-red-200 bg-red-50/30 font-bold">
                <td />
                <td className="py-2 px-3">סה״כ הוצאות</td>
                <td className="py-2 px-3 text-left text-blue-700">{fmt(totals.fixed)}₪</td>
                <td className="py-2 px-3 text-left text-amber-700">{fmt(totals.variable)}₪</td>
                <td className="py-2 px-3 text-left text-purple-700">{fmt(totals.special)}₪</td>
                <td className="py-2 px-3 text-left text-red-700">{fmt(expenses.total)}₪</td>
                <td className="py-2 px-3 text-left">100%</td>
              </tr>
            </tfoot>
          </table>
        </Section>
      )}

      {/* ── Balance Summary ── */}
      {activeTab === 'all' && (
        <div className={`rounded-xl border-2 p-4 text-center ${totals.balance >= 0 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
          <p className="text-sm text-gray-600">מאזן לתקופה</p>
          <p className={`text-3xl font-bold mt-1 ${totals.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {totals.balance >= 0 ? '+' : ''}{fmt(totals.balance)}₪
          </p>
          <p className="text-xs text-gray-500 mt-1">
            הכנסות {fmt(totals.income)}₪ — הוצאות {fmt(totals.expenses)}₪
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function SummaryCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: number; color: string; sub: string }) {
  const colorClass = color === 'green' ? 'text-green-700' : color === 'red' ? 'text-red-700' : 'text-blue-700';
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold ${colorClass}`}>{fmt(value)}₪</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function FreqBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const width = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 text-gray-500">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${width}%` }} />
      </div>
      <span className="w-16 text-left text-gray-600">{fmt(amount)}₪</span>
    </div>
  );
}

function Section({ title, total, count, color, children }: { title: string; total: number; count: number; color: string; children: React.ReactNode }) {
  const borderColor = color === 'green' ? 'border-green-200' : 'border-red-200';
  return (
    <div className={`bg-white rounded-xl border ${borderColor} overflow-hidden`}>
      <div className="px-4 py-3 border-b bg-gray-50/50 flex items-center justify-between">
        <h3 className="font-bold text-gray-800">{title}</h3>
        <span className="text-sm text-gray-500">{count} תנועות | {fmt(total)}₪</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function SortHeader({ label, field, current, dir, onSort, className = '' }: { label: string; field: SortField; current: SortField; dir: SortDir; onSort: (f: SortField) => void; className?: string }) {
  const active = current === field;
  return (
    <th
      className={`py-2 px-3 font-medium text-gray-700 cursor-pointer hover:text-[#074259] select-none ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <ArrowUpDown className="w-3 h-3" />}
      </span>
    </th>
  );
}

function CategoryRows({ cat, total, expanded, onToggle, transactions, color }: { cat: CategoryItem; total: number; expanded: boolean; onToggle: () => void; transactions: Transaction[]; color: string }) {
  const hoverBg = color === 'green' ? 'hover:bg-green-50/50' : 'hover:bg-red-50/50';
  return (
    <>
      <tr className={`border-b cursor-pointer transition-colors ${hoverBg}`} onClick={onToggle}>
        <td className="py-2 px-3">
          <ChevronLeft className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? '-rotate-90' : ''}`} />
        </td>
        <td className="py-2 px-3 font-medium">{cat.name}</td>
        <td className="py-2 px-3 text-left font-mono">{fmt(cat.amount)}₪</td>
        <td className="py-2 px-3 text-left">{cat.count}</td>
        <td className="py-2 px-3 text-left">{pct(cat.amount, total)}</td>
      </tr>
      {expanded && transactions.map(tx => (
        <tr key={tx.id} className="border-b bg-gray-50/50 text-xs text-gray-600">
          <td />
          <td className="py-1.5 px-3 pr-8">{tx.vendor}</td>
          <td className="py-1.5 px-3 text-left font-mono">{fmt(tx.amount)}₪</td>
          <td className="py-1.5 px-3 text-left">{tx.tx_date}</td>
          <td className="py-1.5 px-3 text-left">
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${FREQ_COLORS[tx.frequency] || FREQ_COLORS.unclassified}`}>
              {FREQ_LABELS[tx.frequency] || tx.frequency}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}

function GroupRows({ group, totalExpenses, isOpen, onToggle, expandedCategories, onToggleCategory, getTxForCategory, searchTerm }: {
  group: GroupItem;
  totalExpenses: number;
  isOpen: boolean;
  onToggle: () => void;
  expandedCategories: Set<string>;
  onToggleCategory: (key: string) => void;
  getTxForCategory: (cat: string) => Transaction[];
  searchTerm: string;
}) {
  return (
    <>
      {/* Group row */}
      <tr className="border-b cursor-pointer hover:bg-red-50/30 transition-colors bg-gray-50/30" onClick={onToggle}>
        <td className="py-2.5 px-3">
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
        </td>
        <td className="py-2.5 px-3 font-bold text-gray-800">{group.name}</td>
        <td className="py-2.5 px-3 text-left font-mono text-blue-600">{group.fixed > 0 ? fmt(group.fixed) + '₪' : '-'}</td>
        <td className="py-2.5 px-3 text-left font-mono text-amber-600">{group.variable > 0 ? fmt(group.variable) + '₪' : '-'}</td>
        <td className="py-2.5 px-3 text-left font-mono text-purple-600">{group.special > 0 ? fmt(group.special) + '₪' : '-'}</td>
        <td className="py-2.5 px-3 text-left font-bold font-mono">{fmt(group.amount)}₪</td>
        <td className="py-2.5 px-3 text-left">{pct(group.amount, totalExpenses)}</td>
      </tr>
      {/* Category sub-rows */}
      {isOpen && group.categories
        .filter(c => !searchTerm || c.name.includes(searchTerm))
        .map(cat => {
          const key = `expense:${group.name}:${cat.name}`;
          const catExpanded = expandedCategories.has(key);
          const txs = catExpanded ? getTxForCategory(cat.name) : [];
          return (
            <CategorySubRows
              key={key}
              cat={cat}
              groupTotal={group.amount}
              expanded={catExpanded}
              onToggle={() => onToggleCategory(key)}
              transactions={txs}
            />
          );
        })}
    </>
  );
}

function CategorySubRows({ cat, groupTotal, expanded, onToggle, transactions }: {
  cat: CategoryItem;
  groupTotal: number;
  expanded: boolean;
  onToggle: () => void;
  transactions: Transaction[];
}) {
  return (
    <>
      <tr className="border-b cursor-pointer hover:bg-red-50/20 transition-colors" onClick={onToggle}>
        <td className="py-1.5 px-3">
          {cat.count > 0 && <ChevronLeft className={`w-3 h-3 text-gray-300 transition-transform ${expanded ? '-rotate-90' : ''}`} />}
        </td>
        <td className="py-1.5 px-3 pr-8 text-gray-700">{cat.name}</td>
        <td colSpan={3} />
        <td className="py-1.5 px-3 text-left font-mono text-gray-700">{fmt(cat.amount)}₪</td>
        <td className="py-1.5 px-3 text-left text-gray-500">{pct(cat.amount, groupTotal)}</td>
      </tr>
      {expanded && transactions.map(tx => (
        <tr key={tx.id} className="border-b bg-gray-50/80 text-xs text-gray-500">
          <td />
          <td className="py-1 px-3 pr-12">{tx.vendor}</td>
          <td className="py-1 px-3 text-left">{tx.tx_date}</td>
          <td className="py-1 px-3 text-left font-mono">{fmt(tx.amount)}₪</td>
          <td className="py-1 px-3 text-left">{tx.payment_method}</td>
          <td colSpan={2} className="py-1 px-3 text-left">
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${FREQ_COLORS[tx.frequency] || FREQ_COLORS.unclassified}`}>
              {FREQ_LABELS[tx.frequency] || tx.frequency}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}
