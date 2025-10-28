'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface ExpenseCategory {
  id: string;
  name: string;
  expense_type: 'fixed' | 'variable' | 'special';
  applicable_to: 'employee' | 'self_employed' | 'both';
  category_group: string;
  display_order: number;
}

interface ExpenseCategorySelectorProps {
  value?: string; // שם הקטגוריה הנבחרת
  onChange: (category: ExpenseCategory) => void;
  employmentStatus?: 'employee' | 'self_employed' | 'both';
  expenseType?: 'fixed' | 'variable' | 'special';
  placeholder?: string;
  className?: string;
}

const EXPENSE_TYPE_LABELS = {
  fixed: 'קבועה',
  variable: 'משתנה',
  special: 'מיוחדת',
};

export default function ExpenseCategorySelector({
  value,
  onChange,
  employmentStatus = 'both',
  expenseType,
  placeholder = 'חפש או בחר הוצאה...',
  className = '',
}: ExpenseCategorySelectorProps) {
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<ExpenseCategory[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // טעינת קטגוריות מהשרת
  useEffect(() => {
    fetchCategories();
  }, [employmentStatus, expenseType]);

  // סגירת dropdown כשלוחצים בחוץ
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // עדכון רשימה מסוננת כשמשנים חיפוש
  useEffect(() => {
    if (!search.trim()) {
      setFilteredCategories(categories);
      return;
    }

    const filtered = categories.filter((cat) =>
      cat.name.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredCategories(filtered);
    setSelectedIndex(-1);
  }, [search, categories]);

  async function fetchCategories() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (employmentStatus) params.append('employment', employmentStatus);
      if (expenseType) params.append('type', expenseType);

      const response = await fetch(`/api/expenses/categories?${params.toString()}`);
      const data = await response.json();

      if (data.categories) {
        setCategories(data.categories);
        setFilteredCategories(data.categories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(category: ExpenseCategory) {
    onChange(category);
    setSearch(category.name);
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCategories.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCategories.length - 1
        );
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredCategories[selectedIndex]) {
          handleSelect(filteredCategories[selectedIndex]);
        }
        break;

      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }

  // קיבוץ לפי סוג הוצאה
  const groupedCategories = {
    fixed: filteredCategories.filter((c) => c.expense_type === 'fixed'),
    variable: filteredCategories.filter((c) => c.expense_type === 'variable'),
    special: filteredCategories.filter((c) => c.expense_type === 'special'),
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input עם חיפוש */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value || search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
          disabled={loading}
        />
        <ChevronDown
          className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Dropdown עם תוצאות */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-sm">טוען קטגוריות...</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>לא נמצאו תוצאות</p>
              <p className="text-sm mt-1">נסה חיפוש אחר</p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedCategories).map(
                ([type, cats]) =>
                  cats.length > 0 && (
                    <div key={type} className="mb-2">
                      {/* כותרת קבוצה */}
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                        הוצאות {EXPENSE_TYPE_LABELS[type as keyof typeof EXPENSE_TYPE_LABELS]}
                      </div>

                      {/* רשימת הוצאות */}
                      {cats.map((category, idx) => {
                        const globalIdx = filteredCategories.indexOf(category);
                        const isSelected = globalIdx === selectedIndex;

                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => handleSelect(category)}
                            className={`w-full text-right px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between ${
                              isSelected ? 'bg-blue-100' : ''
                            }`}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                          >
                            <span className="font-medium">{category.name}</span>
                            {category.applicable_to !== 'both' && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {category.applicable_to === 'employee' ? 'שכיר' : 'עצמאי'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

