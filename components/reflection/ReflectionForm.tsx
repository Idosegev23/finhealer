'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Category {
  id: string;
  name: string;
  default_cap: number;
  icon: string | null;
}

interface ReflectionFormProps {
  categories: Category[];
  userId: string;
}

export default function ReflectionForm({ categories, userId }: ReflectionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [monthsBack, setMonthsBack] = useState<number>(3);
  const [amounts, setAmounts] = useState<Record<string, string>>(
    categories.reduce((acc, cat) => ({
      ...acc,
      [cat.name]: cat.default_cap?.toString() || '0'
    }), {})
  );

  const handleAmountChange = (category: string, value: string) => {
    // רק מספרים
    const numValue = value.replace(/[^\d]/g, '');
    setAmounts(prev => ({ ...prev, [category]: numValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const baselines = Object.entries(amounts)
        .filter(([_, amount]) => parseInt(amount) > 0)
        .map(([category, amount]) => ({
          category,
          avg_amount: parseInt(amount),
          months_back: monthsBack
        }));

      const response = await fetch('/api/reflection/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baselines })
      });

      if (!response.ok) {
        throw new Error('שגיאה בשמירת הנתונים');
      }

      // הצלחה - מעבר ל-dashboard
      router.push('/dashboard?welcome=behavior');
      router.refresh();
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה בשמירת הנתונים. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const totalMonthly = Object.values(amounts).reduce(
    (sum, val) => sum + (parseInt(val) || 0), 
    0
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* בחירת תקופה */}
      <div>
        <Label htmlFor="months" className="text-[#1E2A3B] font-semibold mb-2 block">
          מה התקופה שאתה זוכר הכי טוב?
        </Label>
        <Select 
          value={monthsBack.toString()} 
          onValueChange={(val) => setMonthsBack(parseInt(val))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 חודשים אחרונים</SelectItem>
            <SelectItem value="4">4 חודשים אחרונים</SelectItem>
            <SelectItem value="5">5 חודשים אחרונים</SelectItem>
            <SelectItem value="6">6 חודשים אחרונים</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* טבלת קטגוריות */}
      <div>
        <Label className="text-[#1E2A3B] font-semibold mb-3 block">
          הזן ממוצע הוצאה חודשי לכל קטגוריה (₪)
        </Label>
        <div className="space-y-3">
          {categories.map((category) => (
            <div 
              key={category.id} 
              className="flex items-center gap-3 p-3 bg-[#F5F6F8] rounded-lg"
            >
              <div className="text-2xl">{category.icon || '📦'}</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#1E2A3B]">{category.name}</p>
              </div>
              <div className="relative w-32">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={amounts[category.name] || '0'}
                  onChange={(e) => handleAmountChange(category.name, e.target.value)}
                  className="text-left pr-8"
                  placeholder="0"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555] text-sm">
                  ₪
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* סיכום */}
      <div className="bg-[#F0F9FF] border border-[#3A7BD5] rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-[#1E2A3B]">סה״כ הוצאות חודשיות ממוצעות:</span>
          <span className="text-2xl font-bold text-[#3A7BD5]">
            {totalMonthly.toLocaleString('he-IL')} ₪
          </span>
        </div>
        <p className="text-sm text-[#555555] mt-2">
          זה ממוצע של {(totalMonthly / 30).toFixed(0)} ₪ ליום
        </p>
      </div>

      {/* כפתור שמירה */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={loading || totalMonthly === 0}
          className="flex-1 bg-[#3A7BD5] hover:bg-[#2E5EA5] text-white font-semibold py-6"
        >
          {loading ? 'שומר...' : 'המשך לשלב הבא →'}
        </Button>
      </div>

      {totalMonthly === 0 && (
        <p className="text-sm text-[#D64541] text-center">
          יש להזין לפחות קטגוריה אחת עם סכום
        </p>
      )}
    </form>
  );
}


