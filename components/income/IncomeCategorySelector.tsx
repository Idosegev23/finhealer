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
  // value מכיל את השם (name), לא את ה-id
  const [selectedName, setSelectedName] = useState<string>(value || '');

  useEffect(() => {
    setSelectedName(value || '');
  }, [value]);

  const handleChange = (categoryName: string) => {
    setSelectedName(categoryName);
    const category = INCOME_CATEGORIES.find(c => c.name === categoryName);
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
    <Select value={selectedName} onValueChange={handleChange}>
      <SelectTrigger className="w-full text-xl font-bold py-6">
        <SelectValue placeholder="בחר קטגוריית הכנסה..." />
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {/* קבוצת עבודה */}
        <div className="px-4 py-3 text-lg font-extrabold text-gray-700 bg-gray-100">💼 הכנסות מעבודה</div>
        {INCOME_CATEGORIES.filter(c => c.employment_type).map((category) => (
          <SelectItem key={category.id} value={category.name} className="text-xl py-4 cursor-pointer hover:bg-green-100">
            <span className="flex items-center gap-3">
              <span className="text-2xl">{category.icon}</span>
              <span className="font-bold">{category.name}</span>
            </span>
          </SelectItem>
        ))}

        {/* קבוצת קצבאות */}
        <div className="px-4 py-3 text-lg font-extrabold text-gray-700 bg-gray-100 mt-2">🏛️ קצבאות וגמלאות</div>
        {INCOME_CATEGORIES.filter(c => c.allowance_type).map((category) => (
          <SelectItem key={category.id} value={category.name} className="text-xl py-4 cursor-pointer hover:bg-green-100">
            <span className="flex items-center gap-3">
              <span className="text-2xl">{category.icon}</span>
              <span className="font-bold">{category.name}</span>
            </span>
          </SelectItem>
        ))}

        {/* קבוצת אחרות */}
        <div className="px-4 py-3 text-lg font-extrabold text-gray-700 bg-gray-100 mt-2">💰 הכנסות אחרות</div>
        {INCOME_CATEGORIES.filter(c => !c.employment_type && !c.allowance_type).map((category) => (
          <SelectItem key={category.id} value={category.name} className="text-xl py-4 cursor-pointer hover:bg-green-100">
            <span className="flex items-center gap-3">
              <span className="text-2xl">{category.icon}</span>
              <span className="font-bold">{category.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

