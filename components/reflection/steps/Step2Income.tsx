'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface Step2Props {
  data: any;
  onChange: (field: string, value: any) => void;
}

export default function Step2Income({ data, onChange }: Step2Props) {
  const totalIncome = (data.monthly_income || 0) + (data.additional_income || 0) + (data.spouse_income || 0);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#1E2A3B] mb-2">ההכנסות שלך 💰</h2>
        <p className="text-[#555555]">כמה כסף נכנס כל חודש?</p>
      </div>

      <div className="grid gap-4">
        {/* הכנסה עיקרית */}
        <div>
          <Label htmlFor="income" className="text-[#1E2A3B] font-semibold">הכנסה חודשית נטו (משכורת)</Label>
          <div className="relative mt-1">
            <Input
              id="income"
              type="text"
              inputMode="numeric"
              value={data.monthly_income || ''}
              onChange={(e) => onChange('monthly_income', parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0)}
              placeholder="0"
              className="text-left pr-10"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
          </div>
          <p className="text-xs text-[#555555] mt-1">הסכום שמגיע אחרי ניכויים</p>
        </div>

        {/* הכנסות נוספות */}
        <div>
          <Label htmlFor="additional" className="text-[#1E2A3B] font-medium">הכנסות נוספות (אופציונלי)</Label>
          <div className="relative mt-1">
            <Input
              id="additional"
              type="text"
              inputMode="numeric"
              value={data.additional_income || ''}
              onChange={(e) => onChange('additional_income', parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0)}
              placeholder="0"
              className="text-left pr-10"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
          </div>
          <p className="text-xs text-[#555555] mt-1">עבודה נוספת, השכרה, פרילנס וכו׳</p>
        </div>

        {/* הכנסת בן/בת זוג */}
        {data.marital_status === 'married' && (
          <div>
            <Label htmlFor="spouse" className="text-[#1E2A3B] font-medium">הכנסת בן/בת הזוג (אם רלוונטי)</Label>
            <div className="relative mt-1">
              <Input
                id="spouse"
                type="text"
                inputMode="numeric"
                value={data.spouse_income || ''}
                onChange={(e) => onChange('spouse_income', parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0)}
                placeholder="0"
                className="text-left pr-10"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
            </div>
          </div>
        )}
      </div>

      {/* סיכום */}
      <div className="bg-[#E3F2FD] border-r-4 border-[#3A7BD5] rounded-lg p-4 mt-6">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-[#1E2A3B]">סה״כ הכנסות חודשיות:</span>
          <span className="text-2xl font-bold text-[#3A7BD5]">
            {totalIncome.toLocaleString('he-IL')} ₪
          </span>
        </div>
      </div>
    </div>
  );
}


