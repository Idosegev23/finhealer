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
  fixed: 'קבועות',
  variable: 'משתנות',
  special: 'מיוחדות',
};

const CATEGORY_GROUP_LABELS: Record<string, string> = {
  housing: 'דיור',
  communication: 'תקשורת',
  taxes: 'מיסים',
  food: 'מזון',
  transportation: 'תחבורה',
  health: 'בריאות',
  insurance: 'ביטוחים',
  utilities: 'שירותים',
  entertainment: 'בידור',
  education: 'חינוך',
  shopping: 'קניות',
  personal_care: 'טיפוח',
  pets: 'חיות מחמד',
  children: 'ילדים',
  vehicle: 'רכב',
  financial_transfers: 'העברות כספיות',
  professional_services: 'שירותים מקצועיים',
  home_services: 'שירותי בית',
  digital: 'דיגיטלי',
  equipment: 'ציוד',
  marketing: 'שיווק',
  banking: 'בנקאות',
  donations: 'תרומות',
  gifts: 'מתנות',
  events: 'אירועים',
  leisure: 'פנאי',
  home: 'בית',
  loans: 'הלוואות',
  maintenance: 'תחזוקה',
  employees: 'עובדים',
  other: 'אחר',
};

const CATEGORY_GROUP_ICONS: Record<string, string> = {
  housing: '🏠',
  communication: '📞',
  taxes: '💰',
  food: '🛒',
  transportation: '🚗',
  health: '🏥',
  insurance: '🛡️',
  utilities: '💡',
  entertainment: '🎬',
  education: '📚',
  shopping: '🛍️',
  personal_care: '💅',
  pets: '🐾',
  children: '👶',
  vehicle: '🚙',
  financial_transfers: '💸',
  professional_services: '💼',
  home_services: '🔧',
  digital: '💻',
  equipment: '⚙️',
  marketing: '📢',
  banking: '🏦',
  donations: '❤️',
  gifts: '🎁',
  events: '🎉',
  leisure: '🎨',
  home: '🏡',
  loans: '💳',
  maintenance: '🛠️',
  employees: '👥',
  other: '📦',
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

  // נקה "other" אם הוא ה-value הראשוני
  useEffect(() => {
    if (value === 'other') {
      setSearch('');
    }
  }, [value]);

  // סגירת dropdown כשלוחצים בחוץ
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // אם לא בחרו קטגוריה ו-value הוא other, נקה את השדה
        if (!search && value === 'other') {
          setSearch('');
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [search, value]);

  // עדכון רשימה מסוננת כשמשנים חיפוש
  useEffect(() => {
    if (!search.trim()) {
      setFilteredCategories(categories);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = categories.filter((cat) => {
      // חיפוש בשם הקטגוריה
      const nameMatch = cat.name.toLowerCase().includes(searchLower);
      // חיפוש בשם הקבוצה (עברית)
      const groupLabel = CATEGORY_GROUP_LABELS[cat.category_group] || '';
      const groupMatch = groupLabel.toLowerCase().includes(searchLower);
      
      return nameMatch || groupMatch;
    });
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

  // פונקציית עזר לקיבוץ לפי category_group
  function groupByCategory(cats: ExpenseCategory[]): Record<string, ExpenseCategory[]> {
    return cats.reduce((acc, cat) => {
      const group = cat.category_group;
      if (!acc[group]) acc[group] = [];
      acc[group].push(cat);
      return acc;
    }, {} as Record<string, ExpenseCategory[]>);
  }

  // קיבוץ לפי סוג הוצאה ואז לפי קבוצה
  const groupedCategories = {
    fixed: groupByCategory(filteredCategories.filter((c) => c.expense_type === 'fixed')),
    variable: groupByCategory(filteredCategories.filter((c) => c.expense_type === 'variable')),
    special: groupByCategory(filteredCategories.filter((c) => c.expense_type === 'special')),
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input עם חיפוש */}
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-7 w-7 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={search || (value && value !== 'other' ? value : '') || ''}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pr-14 pl-14 py-5 text-xl font-bold border-2 border-gray-400 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-500 text-right bg-white"
          disabled={loading}
        />
        <ChevronDown
          className={`absolute left-4 top-1/2 -translate-y-1/2 h-7 w-7 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Dropdown עם תוצאות */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border-3 border-gray-300 rounded-xl shadow-2xl max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-600">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-4 border-blue-600"></div>
              <p className="mt-3 text-xl font-bold">טוען קטגוריות...</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-6 text-center text-gray-600">
              <p className="text-2xl font-bold">לא נמצאו תוצאות</p>
              <p className="text-lg mt-2">נסה חיפוש אחר</p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedCategories).map(
                ([type, groupsByCategory]) =>
                  Object.keys(groupsByCategory).length > 0 && (
                    <div key={type} className="mb-3">
                      {/* כותרת ראשית - סוג הוצאה */}
                      <div className="px-5 py-4 text-lg font-extrabold text-white bg-gradient-to-r from-blue-600 to-indigo-600 sticky top-0 border-b-2 border-blue-700 shadow-md">
                        📊 הוצאות {EXPENSE_TYPE_LABELS[type as keyof typeof EXPENSE_TYPE_LABELS]}
                      </div>

                      {/* קבוצות משנה */}
                      {Object.entries(groupsByCategory).map(([categoryGroup, cats]) => (
                        <div key={categoryGroup} className="mb-2">
                          {/* כותרת קבוצה משנה */}
                          <div className="px-7 py-3 text-base font-bold text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                            {CATEGORY_GROUP_ICONS[categoryGroup] || '📌'} {CATEGORY_GROUP_LABELS[categoryGroup] || categoryGroup}
                          </div>

                          {/* רשימת קטגוריות */}
                          {cats.map((category) => {
                            const globalIdx = filteredCategories.indexOf(category);
                            const isSelected = globalIdx === selectedIndex;

                            return (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => handleSelect(category)}
                                className={`w-full text-right px-10 py-3 hover:bg-orange-100 transition-colors flex items-center justify-between border-b border-gray-50 ${
                                  isSelected ? 'bg-orange-200 font-extrabold' : ''
                                }`}
                                onMouseEnter={() => setSelectedIndex(globalIdx)}
                              >
                                <span className="text-lg font-semibold">• {category.name}</span>
                                {category.applicable_to !== 'both' && (
                                  <span className="text-sm font-bold text-gray-600 bg-gray-200 px-2 py-1 rounded-lg">
                                    {category.applicable_to === 'employee' ? '👔 שכיר' : '💼 עצמאי'}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ))}
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

