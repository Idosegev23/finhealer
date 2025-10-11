'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Step1Props {
  data: any;
  onChange: (field: string, value: any) => void;
}

export default function Step1Personal({ data, onChange }: Step1Props) {
  const [agesText, setAgesText] = useState<string>(data.children_ages?.join(', ') || '');
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#1E2A3B] mb-2">בואו נכיר 👋</h2>
        <p className="text-[#555555]">כמה פרטים בסיסיים כדי להתאים את הליווי בצורה הטובה ביותר</p>
      </div>

      <div className="grid gap-4">
        {/* גיל */}
        <div>
          <Label htmlFor="age" className="text-[#1E2A3B] font-medium">מה הגיל שלך?</Label>
          <Input
            id="age"
            type="number"
            value={data.age || ''}
            onChange={(e) => onChange('age', parseInt(e.target.value) || null)}
            placeholder="לדוגמה: 32"
            className="mt-1"
          />
        </div>

        {/* מצב משפחתי */}
        <div>
          <Label htmlFor="marital" className="text-[#1E2A3B] font-medium">מצב משפחתי</Label>
          <Select value={data.marital_status || ''} onValueChange={(val) => onChange('marital_status', val)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="בחר..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">רווק/ה</SelectItem>
              <SelectItem value="married">נשוי/אה</SelectItem>
              <SelectItem value="divorced">גרוש/ה</SelectItem>
              <SelectItem value="widowed">אלמן/ה</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ילדים */}
        <div>
          <Label htmlFor="children" className="text-[#1E2A3B] font-medium">יש לך ילדים?</Label>
          <Select 
            value={data.children_count?.toString() || '0'} 
            onValueChange={(val) => onChange('children_count', parseInt(val))}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">אין לי ילדים</SelectItem>
              <SelectItem value="1">ילד אחד</SelectItem>
              <SelectItem value="2">2 ילדים</SelectItem>
              <SelectItem value="3">3 ילדים</SelectItem>
              <SelectItem value="4">4 ילדים</SelectItem>
              <SelectItem value="5">5+ ילדים</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* אם יש ילדים - גילאים */}
        {data.children_count > 0 && (
          <div>
            <Label className="text-[#1E2A3B] font-medium">גילאי הילדים</Label>
            <Input
              type="text"
              placeholder="לדוגמה: 5, 8, 12 או 5 8 12"
              value={agesText}
              onChange={(e) => {
                // Allow free typing
                setAgesText(e.target.value);
              }}
              onBlur={(e) => {
                // Parse on blur - supports both comma and space
                const text = e.target.value;
                const ages = text
                  .split(/[,\s]+/)  // Split by comma OR space
                  .map(a => a.trim())
                  .filter(a => a !== '')
                  .map(a => parseInt(a))
                  .filter(a => !isNaN(a) && a >= 0 && a <= 18);
                onChange('children_ages', ages);
              }}
              className="mt-1"
              dir="ltr"
            />
            <p className="text-xs text-[#555555] mt-1">
              💡 ניתן להפריד בפסיק או רווח (לדוגמה: 5, 8, 12 או 5 8 12)
              {data.children_ages && data.children_ages.length > 0 && (
                <span className="block text-[#7ED957] font-medium mt-1">
                  ✓ זיהיתי {data.children_ages.length} {data.children_ages.length === 1 ? 'גיל' : 'גילאים'}: {data.children_ages.join(', ')}
                </span>
              )}
            </p>
          </div>
        )}

        {/* עיר */}
        <div>
          <Label htmlFor="city" className="text-[#1E2A3B] font-medium">איפה אתה גר?</Label>
          <Input
            id="city"
            value={data.city || ''}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="לדוגמה: תל אביב"
            className="mt-1"
          />
          <p className="text-xs text-[#555555] mt-1">יעזור לנו להבין הוצאות מחיה אופייניות לאזור</p>
        </div>
      </div>
    </div>
  );
}


