'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Step5Props {
  categories: any[];
  data: any;
  onChange: (field: string, value: any) => void;
}

export default function Step5History({ categories, data, onChange }: Step5Props) {
  const { baselines = {}, months_back = 3 } = data;

  const handleAmountChange = (category: string, value: string) => {
    const numValue = value.replace(/[^\d]/g, '');
    onChange('baselines', { ...baselines, [category]: numValue });
  };

  const totalMonthly = Object.values(baselines).reduce(
    (sum: number, val: any) => sum + (parseInt(val as string) || 0), 
    0
  );

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#1E2A3B] mb-2">ההיסטוריה שלך 📊</h2>
        <p className="text-[#555555]">ממוצעי הוצאות מהחודשים האחרונים</p>
      </div>

      {/* בחירת תקופה */}
      <div>
        <Label className="text-[#1E2A3B] font-semibold mb-2 block">
          מה התקופה שאתה זוכר הכי טוב?
        </Label>
        <Select 
          value={months_back.toString()} 
          onValueChange={(val) => onChange('months_back', parseInt(val))}
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
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
          {categories.map((category) => (
            <div 
              key={category.id} 
              className="flex items-center gap-3 p-2 bg-[#F5F6F8] rounded-lg"
            >
              <div className="text-xl">{category.icon || '📦'}</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#1E2A3B]">{category.name}</p>
              </div>
              <div className="relative w-28">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={baselines[category.name] || ''}
                  onChange={(e) => handleAmountChange(category.name, e.target.value)}
                  className="text-left pr-8 text-sm"
                  placeholder="0"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555555] text-xs">
                  ₪
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* סיכום */}
      <div className="bg-[#E3F2FD] border-r-4 border-[#3A7BD5] rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-[#1E2A3B]">סה״כ הוצאות ממוצעות:</span>
          <span className="text-2xl font-bold text-[#3A7BD5]">
            {totalMonthly.toLocaleString('he-IL')} ₪
          </span>
        </div>
        <p className="text-sm text-[#555555] mt-2">
          זה ממוצע של {(totalMonthly / 30).toFixed(0)} ₪ ליום
        </p>
      </div>

      <p className="text-xs text-[#555555] text-center">
        💭 לא בטוח בדיוק בסכומים? אין בעיה - הזן הערכה כללית
      </p>
    </div>
  );
}


