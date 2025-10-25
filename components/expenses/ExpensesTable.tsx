'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Filter, ChevronDown, ChevronUp, 
  Edit2, Trash2, TrendingUp, TrendingDown,
  Calendar, DollarSign, Tag, Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Transaction {
  id?: string;
  date: string;
  description: string;
  vendor?: string;
  amount: number;
  category: string;
  detailed_category: string;
  expense_frequency: 'fixed' | 'temporary' | 'special' | 'one_time';
  confidence: number;
}

interface ExpensesTableProps {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
  onSave?: (transactions: Transaction[]) => void;
}

const FREQUENCY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  fixed: { label: 'קבועה', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: '🔄' },
  temporary: { label: 'זמנית', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: '⏱️' },
  special: { label: 'מיוחדת', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: '⭐' },
  one_time: { label: 'חד פעמית', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', icon: '1️⃣' },
};

const CATEGORY_LABELS: Record<string, string> = {
  food_beverages: '🍔 מזון ומשקאות',
  cellular_communication: '📱 סלולר ותקשורת',
  entertainment_leisure: '🎬 בילויים ופנאי',
  transportation_fuel: '⛽ תחבורה ודלק',
  housing_maintenance: '🏠 דיור ותחזוקה',
  clothing_footwear: '👕 ביגוד והנעלה',
  health_medical: '💊 בריאות ותרופות',
  education: '📚 חינוך והשכלה',
  utilities: '⚡ שירותים (חשמל/מים/גז)',
  shopping_general: '🛒 קניות כלליות',
  subscriptions: '📺 מנויים',
  insurance: '🛡️ ביטוחים',
  loans_debt: '💳 הלוואות וחובות',
  other: '📦 אחר',
};

export default function ExpensesTable({ transactions, onEdit, onDelete, onSave }: ExpensesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'category'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filtering & Sorting
  const filteredAndSorted = useMemo(() => {
    let result = [...transactions];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(term) ||
          t.vendor?.toLowerCase().includes(term) ||
          t.category.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((t) => t.detailed_category === categoryFilter);
    }

    // Frequency filter
    if (frequencyFilter !== 'all') {
      result = result.filter((t) => t.expense_frequency === frequencyFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortField === 'category') {
        comparison = a.category.localeCompare(b.category);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [transactions, searchTerm, categoryFilter, frequencyFilter, sortField, sortDirection]);

  const toggleSort = (field: 'date' | 'amount' | 'category') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const totalAmount = filteredAndSorted.reduce((sum, t) => sum + t.amount, 0);
  const fixedExpenses = filteredAndSorted
    .filter((t) => t.expense_frequency === 'fixed')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">סך הכל הוצאות</p>
              <p className="text-3xl font-bold">₪{totalAmount.toLocaleString()}</p>
            </div>
            <DollarSign className="w-12 h-12 opacity-50" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium mb-1">הוצאות קבועות</p>
              <p className="text-3xl font-bold">₪{fixedExpenses.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-12 h-12 opacity-50" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium mb-1">סה"כ תנועות</p>
              <p className="text-3xl font-bold">{filteredAndSorted.length}</p>
            </div>
            <Tag className="w-12 h-12 opacity-50" />
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="חפש לפי תיאור, עסק או קטגוריה..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="כל הקטגוריות" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הקטגוריות</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Frequency Filter */}
          <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="כל התדירויות" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל התדירויות</SelectItem>
              {Object.entries(FREQUENCY_LABELS).map(([key, { label, icon }]) => (
                <SelectItem key={key} value={key}>
                  {icon} {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th
                  className="text-right px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    תאריך
                    {sortField === 'date' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="text-right px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300">
                  תיאור
                </th>
                <th
                  className="text-right px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => toggleSort('category')}
                >
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    קטגוריה
                    {sortField === 'category' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="text-right px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    תדירות
                  </div>
                </th>
                <th
                  className="text-right px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => toggleSort('amount')}
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    סכום
                    {sortField === 'amount' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="text-center px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSorted.map((transaction, index) => {
                const freq = FREQUENCY_LABELS[transaction.expense_frequency];
                const categoryLabel = CATEGORY_LABELS[transaction.detailed_category] || transaction.category;

                return (
                  <motion.tr
                    key={transaction.id || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {new Date(transaction.date).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {transaction.description}
                        </p>
                        {transaction.vendor && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {transaction.vendor}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {categoryLabel}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={`${freq.color} border-0 font-medium`}>
                        {freq.icon} {freq.label}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      ₪{transaction.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(transaction)}
                            className="hover:bg-blue-50 dark:hover:bg-blue-900"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        {onDelete && transaction.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(transaction.id!)}
                            className="hover:bg-red-50 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>

          {filteredAndSorted.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                לא נמצאו תנועות התואמות את החיפוש
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      {onSave && transactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end"
        >
          <Button
            onClick={() => onSave(transactions)}
            size="lg"
            className="px-8 font-bold shadow-lg"
          >
            💾 שמור את כל ההוצאות ({transactions.length})
          </Button>
        </motion.div>
      )}
    </div>
  );
}

