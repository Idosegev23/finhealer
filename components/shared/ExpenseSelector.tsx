'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Lock, BarChart3, Star, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AddCustomExpenseModal from './AddCustomExpenseModal';

export interface ExpenseOption {
  id: string;
  name: string;
  expense_type: 'fixed' | 'variable' | 'special';
  category_group?: string;
  is_custom: boolean;
}

interface ExpenseSelectorProps {
  value?: string;
  onChange: (expense: ExpenseOption) => void;
  employmentStatus?: 'employee' | 'self_employed' | 'both';
  autoFocus?: boolean;
}

const expenseTypeIcons = {
  fixed: { icon: Lock, label: 'קבועה', color: 'text-blue-600' },
  variable: { icon: BarChart3, label: 'משתנה', color: 'text-green-600' },
  special: { icon: Star, label: 'מיוחדת', color: 'text-yellow-600' },
};

export default function ExpenseSelector({
  value,
  onChange,
  employmentStatus,
  autoFocus
}: ExpenseSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expenses, setExpenses] = useState<ExpenseOption[]>([]);
  const [groupedExpenses, setGroupedExpenses] = useState<Record<string, ExpenseOption[]>>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch expenses
  useEffect(() => {
    fetchExpenses();
  }, [employmentStatus]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchExpenses = async (search?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (employmentStatus) params.append('employment_status', employmentStatus);

      const response = await fetch(`/api/expenses/categories?${params}`);
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      const allExpenses = [...data.predefined, ...data.custom];
      setExpenses(allExpenses);
      setGroupedExpenses(data.grouped);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2 || searchTerm.length === 0) {
        fetchExpenses(searchTerm);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelect = (expense: ExpenseOption) => {
    onChange(expense);
    setSearchTerm(expense.name);
    setShowDropdown(false);
  };

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  const handleCustomExpenseCreated = (newExpense: ExpenseOption) => {
    setShowCustomModal(false);
    fetchExpenses(); // Refresh list
    handleSelect(newExpense); // Select the new expense
  };

  // Filtered expenses for search
  const filteredExpenses = expenses.filter(exp =>
    exp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
            setActiveTab('search');
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="חפש או בחר קטגוריה..."
          className="pr-10 text-right"
          autoFocus={autoFocus}
        />
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-hidden"
          >
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('search')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'search'
                    ? 'text-[#3A7BD5] border-b-2 border-[#3A7BD5]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Search className="w-4 h-4 inline-block ml-1" />
                חיפוש
              </button>
              <button
                onClick={() => setActiveTab('browse')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'browse'
                    ? 'text-[#3A7BD5] border-b-2 border-[#3A7BD5]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline-block ml-1" />
                דפדוף
              </button>
            </div>

            <div className="overflow-y-auto max-h-80">
              {/* Search Tab */}
              {activeTab === 'search' && (
                <div className="p-2">
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">טוען...</div>
                  ) : filteredExpenses.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm ? 'לא נמצאו תוצאות' : 'התחל להקליד לחיפוש'}
                    </div>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <ExpenseItem
                        key={expense.id}
                        expense={expense}
                        onClick={() => handleSelect(expense)}
                      />
                    ))
                  )}
                </div>
              )}

              {/* Browse Tab */}
              {activeTab === 'browse' && (
                <div className="p-2">
                  {Object.entries(groupedExpenses).map(([group, items]) => (
                    <div key={group} className="mb-2">
                      <button
                        onClick={() => toggleGroup(group)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <span className="font-semibold text-[#1E2A3B]">{group}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{items.length}</span>
                          {expandedGroups.has(group) ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </button>

                      <AnimatePresence>
                        {expandedGroups.has(group) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mr-4"
                          >
                            {items.map((expense) => (
                              <ExpenseItem
                                key={expense.id}
                                expense={expense}
                                onClick={() => handleSelect(expense)}
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Custom Button */}
            <div className="border-t border-gray-200 p-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCustomModal(true);
                  setShowDropdown(false);
                }}
                className="w-full justify-center"
              >
                <Plus className="w-4 h-4 ml-1" />
                הוסף הוצאה מותאמת אישית
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Expense Modal */}
      {showCustomModal && (
        <AddCustomExpenseModal
          onClose={() => setShowCustomModal(false)}
          onSuccess={handleCustomExpenseCreated}
        />
      )}
    </div>
  );
}

// Expense Item Component
function ExpenseItem({
  expense,
  onClick
}: {
  expense: ExpenseOption;
  onClick: () => void;
}) {
  const typeInfo = expenseTypeIcons[expense.expense_type];
  const Icon = typeInfo.icon;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors group"
    >
      <div className="flex items-center gap-2 flex-1 text-right">
        <Icon className={`w-4 h-4 ${typeInfo.color}`} />
        <span className="text-sm text-[#1E2A3B]">{expense.name}</span>
        {expense.is_custom && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
            מותאם
          </span>
        )}
      </div>
      <span className={`text-xs ${typeInfo.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
        {typeInfo.label}
      </span>
    </button>
  );
}

