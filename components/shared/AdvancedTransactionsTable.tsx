'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  SlidersHorizontal,
  Download,
  ChevronDown,
  ChevronUp,
  Calendar,
  X,
} from 'lucide-react';

// ============================================================================
// טיפוסים
// ============================================================================

interface Transaction {
  id: string;
  date: string;
  vendor?: string;
  description?: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  income_category?: string;
  expense_category?: string;
  payment_method?: string;
}

interface AdvancedTransactionsTableProps {
  transactions: Transaction[];
  title: string;
  type: 'income' | 'expense' | 'all';
  showCategory?: boolean;
  showPaymentMethod?: boolean;
  defaultMonth?: string; // YYYY-MM
}

type SortField = 'date' | 'amount' | 'vendor' | 'category';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// קומפוננטה ראשית
// ============================================================================

export default function AdvancedTransactionsTable({
  transactions,
  title,
  type,
  showCategory = true,
  showPaymentMethod = false,
  defaultMonth,
}: AdvancedTransactionsTableProps) {
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth || '');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // פילטור וסינון
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // סינון לפי סוג
    if (type !== 'all') {
      filtered = filtered.filter((tx) => tx.type === type);
    }

    // חיפוש
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.vendor?.toLowerCase().includes(search) ||
          tx.description?.toLowerCase().includes(search) ||
          tx.category?.toLowerCase().includes(search) ||
          tx.income_category?.toLowerCase().includes(search) ||
          tx.expense_category?.toLowerCase().includes(search)
      );
    }

    // פילטר חודש
    if (selectedMonth) {
      filtered = filtered.filter((tx) => tx.date.startsWith(selectedMonth));
    }

    // פילטר קטגוריה
    if (selectedCategory) {
      filtered = filtered.filter(
        (tx) =>
          tx.category === selectedCategory ||
          tx.income_category === selectedCategory ||
          tx.expense_category === selectedCategory
      );
    }

    // פילטר סכום
    if (minAmount) {
      filtered = filtered.filter((tx) => tx.amount >= Number(minAmount));
    }
    if (maxAmount) {
      filtered = filtered.filter((tx) => tx.amount <= Number(maxAmount));
    }

    // מיון
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'vendor':
          aValue = a.vendor || a.description || '';
          bValue = b.vendor || b.description || '';
          break;
        case 'category':
          aValue = a.category || a.income_category || a.expense_category || '';
          bValue = b.category || b.income_category || b.expense_category || '';
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [
    transactions,
    type,
    searchTerm,
    selectedMonth,
    selectedCategory,
    sortField,
    sortDirection,
    minAmount,
    maxAmount,
  ]);

  // חישוב סה"כ
  const totalAmount = useMemo(
    () => filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    [filteredTransactions]
  );

  // קטגוריות ייחודיות
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    transactions.forEach((tx) => {
      const cat = tx.category || tx.income_category || tx.expense_category;
      if (cat) categories.add(cat);
    });
    return Array.from(categories).sort();
  }, [transactions]);

  // חודשים ייחודיים
  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((tx) => {
      months.add(tx.date.slice(0, 7)); // YYYY-MM
    });
    return Array.from(months).sort().reverse();
  }, [transactions]);

  // פונקציות עזר
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedMonth('');
    setSelectedCategory('');
    setMinAmount('');
    setMaxAmount('');
  };

  const exportToCSV = () => {
    const headers = ['תאריך', 'תיאור', 'סכום', 'קטגוריה', 'אמצעי תשלום'];
    const rows = filteredTransactions.map((tx) => [
      tx.date,
      tx.vendor || tx.description || '',
      tx.amount.toString(),
      tx.category || tx.income_category || tx.expense_category || '',
      tx.payment_method || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline" />
    ) : (
      <ChevronDown className="w-4 h-4 inline" />
    );
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-xl">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {/* חיפוש */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="חפש..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 w-48"
              />
            </div>

            {/* כפתור פילטרים */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-blue-50' : ''}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>

            {/* ייצוא */}
            <Button variant="outline" size="icon" onClick={exportToCSV}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* פאנל פילטרים */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* חודש */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  חודש
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">כל החודשים</option>
                  {uniqueMonths.map((month) => (
                    <option key={month} value={month}>
                      {new Date(month + '-01').toLocaleDateString('he-IL', {
                        year: 'numeric',
                        month: 'long',
                      })}
                    </option>
                  ))}
                </select>
              </div>

              {/* קטגוריה */}
              {showCategory && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    קטגוריה
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">כל הקטגוריות</option>
                    {uniqueCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* סכום מינימלי */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  סכום מינימלי
                </label>
                <Input
                  type="number"
                  placeholder="₪0"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>

              {/* סכום מקסימלי */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  סכום מקסימלי
                </label>
                <Input
                  type="number"
                  placeholder="₪10,000"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                מוצגות {filteredTransactions.length} מתוך {transactions.length} תנועות
              </p>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 ml-1" />
                נקה פילטרים
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">לא נמצאו תנועות</p>
            <p className="text-sm mt-2">נסה לשנות את הפילטרים או החיפוש</p>
          </div>
        ) : (
          <>
            {/* טבלה */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th
                      className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => handleSort('date')}
                    >
                      תאריך <SortIcon field="date" />
                    </th>
                    <th
                      className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => handleSort('vendor')}
                    >
                      תיאור <SortIcon field="vendor" />
                    </th>
                    <th
                      className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => handleSort('amount')}
                    >
                      סכום <SortIcon field="amount" />
                    </th>
                    {showCategory && (
                      <th
                        className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => handleSort('category')}
                      >
                        קטגוריה <SortIcon field="category" />
                      </th>
                    )}
                    {showPaymentMethod && (
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                        אמצעי תשלום
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx, index) => (
                    <tr
                      key={tx.id || index}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                        {new Date(tx.date).toLocaleDateString('he-IL')}
                      </td>
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                        {tx.vendor || tx.description || '-'}
                      </td>
                      <td
                        className={`py-3 px-4 font-bold ${
                          type === 'income' || tx.type === 'income'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {type === 'income' || tx.type === 'income' ? '+' : ''}₪
                        {tx.amount.toLocaleString('he-IL')}
                      </td>
                      {showCategory && (
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {tx.category || tx.income_category || tx.expense_category || 'לא מסווג'}
                        </td>
                      )}
                      {showPaymentMethod && (
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {tx.payment_method || '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <td
                      colSpan={showCategory && showPaymentMethod ? 2 : showCategory ? 1 : 1}
                      className="py-3 px-4 font-bold text-gray-900 dark:text-gray-100"
                    >
                      סה״כ:
                    </td>
                    <td
                      className={`py-3 px-4 font-black text-lg ${
                        type === 'income'
                          ? 'text-green-600 dark:text-green-400'
                          : type === 'expense'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {type === 'income' ? '+' : type === 'expense' ? '' : ''}₪
                      {totalAmount.toLocaleString('he-IL')}
                    </td>
                    {showCategory && <td></td>}
                    {showPaymentMethod && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}




