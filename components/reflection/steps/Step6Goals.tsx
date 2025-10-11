'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Target, Sparkles } from 'lucide-react';

interface Step6Props {
  data: any;
  onChange: (field: string, value: any) => void;
}

const reasons = [
  { value: 'dont_know_where_money_goes', label: 'לא יודע לאן הכסף הולך' },
  { value: 'want_to_save', label: 'רוצה לחסוך למטרה מסוימת' },
  { value: 'debts', label: 'חובות שצריך לסדר' },
  { value: 'improve_general', label: 'משפר מצב כללי' },
  { value: 'prepare_future', label: 'מתכונן לעתיד (נישואים, ילדים, פנסיה)' },
  { value: 'other', label: 'אחר...' },
];

export default function Step6Goals({ data, onChange }: Step6Props) {
  const { why_here = [], short_term_goal = '', long_term_dream = '' } = data;

  const toggleReason = (reason: string) => {
    const current = why_here || [];
    if (current.includes(reason)) {
      onChange('why_here', current.filter((r: string) => r !== reason));
    } else {
      onChange('why_here', [...current, reason]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#1E2A3B] mb-2">המטרות שלך 🎯</h2>
        <p className="text-[#555555]">בואו נבין מה חשוב לך</p>
      </div>

      {/* למה באת? */}
      <div>
        <Label className="text-[#1E2A3B] font-semibold mb-3 block">
          למה החלטת להצטרף ל-FinHealer? (אפשר לבחור כמה)
        </Label>
        <div className="space-y-2">
          {reasons.map((reason) => (
            <div 
              key={reason.value}
              className="flex items-center gap-3 p-3 bg-[#F5F6F8] rounded-lg hover:bg-[#E3F2FD] transition-colors cursor-pointer"
              onClick={() => toggleReason(reason.value)}
            >
              <Checkbox 
                checked={why_here?.includes(reason.value) || false}
                onCheckedChange={() => toggleReason(reason.value)}
              />
              <Label className="text-sm font-medium cursor-pointer flex-1">
                {reason.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* מטרה קצרה */}
      <div>
        <Label className="text-[#1E2A3B] font-semibold mb-2 flex items-center gap-2">
          <Target className="w-5 h-5 text-[#3A7BD5]" />
          מטרה קצרת טווח (3-6 חודשים)
        </Label>
        <Textarea
          value={short_term_goal}
          onChange={(e) => onChange('short_term_goal', e.target.value)}
          placeholder="לדוגמה: לחסוך 5,000 ₪ לחופשה בקיץ"
          className="mt-1 resize-none"
          rows={3}
        />
      </div>

      {/* חלום גדול */}
      <div>
        <Label className="text-[#1E2A3B] font-semibold mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#F6A623]" />
          החלום הגדול שלך (שנה+)
        </Label>
        <Textarea
          value={long_term_dream}
          onChange={(e) => onChange('long_term_dream', e.target.value)}
          placeholder="לדוגמה: לקנות דירה, לפתוח עסק, פנסיה מוקדמת..."
          className="mt-1 resize-none"
          rows={3}
        />
      </div>

      {/* עידוד */}
      <div className="bg-gradient-to-l from-[#E3F2FD] to-[#F0F9FF] rounded-lg p-4 mt-6">
        <p className="text-[#1E2A3B] font-medium text-center">
          🌟 מעולה! עכשיו אנחנו מכירים אותך טוב יותר
        </p>
        <p className="text-sm text-[#555555] text-center mt-2">
          בואו נתחיל לעבוד ביחד על המטרות שלך!
        </p>
      </div>
    </div>
  );
}


