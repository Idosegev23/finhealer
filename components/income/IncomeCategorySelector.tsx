"use client"

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IncomeCategorySelectorProps {
  value?: string;
  onChange: (category: { id: string; name: string; employment_type?: string; allowance_type?: string }) => void;
}

// קטגוריות הכנסה קבועות (לפי הפרומפט שהגדרנו)
const INCOME_CATEGORIES = [
  {
    id: 'salary',
    name: 'משכורת',
    employment_type: 'employee',
    icon: '💼'
  },
  {
    id: 'freelance',
    name: 'עצמאי/פרילנס',
    employment_type: 'freelancer',
    icon: '💻'
  },
  {
    id: 'business',
    name: 'עסק',
    employment_type: 'business_owner',
    icon: '🏢'
  },
  {
    id: 'allowance_unemployment',
    name: 'קצבת אבטלה',
    allowance_type: 'unemployment',
    icon: '📋'
  },
  {
    id: 'allowance_disability',
    name: 'קצבת נכות',
    allowance_type: 'disability',
    icon: '♿'
  },
  {
    id: 'allowance_pension',
    name: 'קצבת זקנה/פנסיה',
    allowance_type: 'pension',
    icon: '👴'
  },
  {
    id: 'allowance_other',
    name: 'קצבה אחרת',
    allowance_type: 'other',
    icon: '📄'
  },
  {
    id: 'tax_refund',
    name: 'החזר מס',
    icon: '💰'
  },
  {
    id: 'social_security',
    name: 'גמלאות/ביטוח לאומי',
    icon: '🏛️'
  },
  {
    id: 'investments',
    name: 'השקעות',
    icon: '📈'
  },
  {
    id: 'rental',
    name: 'השכרה',
    icon: '🏠'
  },
  {
    id: 'gift',
    name: 'מתנה/ירושה',
    icon: '🎁'
  },
  {
    id: 'transfer',
    name: 'העברה נכנסת',
    icon: '↗️'
  },
  {
    id: 'other',
    name: 'הכנסה אחרת',
    icon: '💵'
  }
];

export default function IncomeCategorySelector({ value, onChange }: IncomeCategorySelectorProps) {
  const [selectedId, setSelectedId] = useState<string>(value || '');

  useEffect(() => {
    setSelectedId(value || '');
  }, [value]);

  const handleChange = (categoryId: string) => {
    setSelectedId(categoryId);
    const category = INCOME_CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      onChange({
        id: category.id,
        name: category.name,
        employment_type: category.employment_type,
        allowance_type: category.allowance_type
      });
    }
  };

  return (
    <Select value={selectedId} onValueChange={handleChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="בחר קטגוריית הכנסה..." />
      </SelectTrigger>
      <SelectContent>
        {/* קבוצת עבודה */}
        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">💼 הכנסות מעבודה</div>
        {INCOME_CATEGORIES.filter(c => c.employment_type).map((category) => (
          <SelectItem key={category.id} value={category.id}>
            <span className="flex items-center gap-2">
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </span>
          </SelectItem>
        ))}

        {/* קבוצת קצבאות */}
        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 mt-2">🏛️ קצבאות וגמלאות</div>
        {INCOME_CATEGORIES.filter(c => c.allowance_type).map((category) => (
          <SelectItem key={category.id} value={category.id}>
            <span className="flex items-center gap-2">
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </span>
          </SelectItem>
        ))}

        {/* קבוצת אחרות */}
        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 mt-2">💰 הכנסות אחרות</div>
        {INCOME_CATEGORIES.filter(c => !c.employment_type && !c.allowance_type).map((category) => (
          <SelectItem key={category.id} value={category.id}>
            <span className="flex items-center gap-2">
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

