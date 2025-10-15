'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Briefcase, TrendingUp, Home, Banknote, Building2 } from 'lucide-react';

interface IncomeSource {
  id: string;
  sourceName: string;
  employmentType: 'employee' | 'self_employed' | 'freelance' | 'business' | 'rental' | 'investment' | 'pension' | 'other';
  grossAmount: number;
  netAmount: number; // נטו משכורת (אחרי מס)
  actualBankAmount: number; // מה שבאמת נכנס לבנק
  employerName?: string;
  pensionContribution?: number;
  advancedStudyFund?: number;
  otherDeductions?: number;
  isPrimary: boolean;
}

interface Step2Props {
  data: any;
  onChange: (field: string, value: any) => void;
}

const employmentTypes = [
  { value: 'employee', label: 'שכיר', icon: Briefcase, color: '#3A7BD5' },
  { value: 'self_employed', label: 'עצמאי', icon: TrendingUp, color: '#7ED957' },
  { value: 'freelance', label: 'פרילנסר', icon: Briefcase, color: '#9B59B6' },
  { value: 'business', label: 'עסק', icon: Building2, color: '#F6A623' },
  { value: 'rental', label: 'שכירות', icon: Home, color: '#E91E63' },
  { value: 'investment', label: 'השקעות', icon: TrendingUp, color: '#00BCD4' },
  { value: 'pension', label: 'פנסיה', icon: Banknote, color: '#607D8B' },
  { value: 'other', label: 'אחר', icon: Banknote, color: '#9E9E9E' },
];

export default function Step2Income({ data, onChange }: Step2Props) {
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>(data.incomeSources || []);
  const [showAdvanced, setShowAdvanced] = useState<string | null>(null);

  const addIncomeSource = () => {
    const newSource: IncomeSource = {
      id: Math.random().toString(36).substr(2, 9),
      sourceName: '',
      employmentType: 'employee',
      grossAmount: 0,
      netAmount: 0,
      actualBankAmount: 0,
      isPrimary: incomeSources.length === 0,
    };
    const updated = [...incomeSources, newSource];
    setIncomeSources(updated);
    onChange('incomeSources', updated);
  };

  const updateSource = (id: string, field: keyof IncomeSource, value: any) => {
    const updated = incomeSources.map(source => 
      source.id === id ? { ...source, [field]: value } : source
    );
    setIncomeSources(updated);
    onChange('incomeSources', updated);
  };

  const removeSource = (id: string) => {
    const updated = incomeSources.filter(s => s.id !== id);
    setIncomeSources(updated);
    onChange('incomeSources', updated);
  };

  const setPrimary = (id: string) => {
    const updated = incomeSources.map(s => ({
      ...s,
      isPrimary: s.id === id
    }));
    setIncomeSources(updated);
    onChange('incomeSources', updated);
  };

  const calculateDeductions = (gross: number, net: number) => {
    return gross - net;
  };

  const totalGross = incomeSources.reduce((sum, s) => sum + (s.grossAmount || 0), 0);
  const totalNet = incomeSources.reduce((sum, s) => sum + (s.netAmount || 0), 0);
  const totalActualBank = incomeSources.reduce((sum, s) => sum + (s.actualBankAmount || 0), 0);
  const totalDeductions = totalGross - totalActualBank;

  const getTypeInfo = (type: string) => {
    return employmentTypes.find(t => t.value === type) || employmentTypes[0];
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#1E2A3B] mb-2">שלב 2: ההכנסות שלך 💰</h2>
        <p className="text-[#555555] mb-2">פירוט מלא של מקורות ההכנסה - ברוטו, נטו וסוג התעסוקה</p>
        <div className="inline-block bg-[#E8F4FD] px-4 py-2 rounded-lg mt-2">
          <p className="text-xs text-[#3A7BD5]">
            <strong>מה נלקח:</strong> מקורות הכנסה • סכומים ברוטו ונטו • שכיר/עצמאי • מעסיק • פנסיה
          </p>
        </div>
        <p className="text-xs text-[#F6A623] bg-[#FFF3E0] inline-block px-4 py-2 rounded-lg mt-2">
          💡 מידע זה קריטי לחישוב פנסיות, הטבות מס וזכויות
        </p>
      </div>

      <div className="space-y-4">
        {/* כפתור הוסף מקור הכנסה */}
        <div className="flex items-center justify-between">
          <Label className="text-[#1E2A3B] font-semibold">מקורות הכנסה</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addIncomeSource}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            הוסף מקור הכנסה
          </Button>
        </div>

        {incomeSources.length === 0 && (
          <div className="text-center py-8 bg-[#F5F6F8] rounded-lg border-2 border-dashed border-gray-300">
            <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-[#888888]">עדיין לא הוספת מקורות הכנסה</p>
            <p className="text-xs text-[#888888] mt-1">לחץ על "הוסף מקור הכנסה" כדי להתחיל</p>
          </div>
        )}

        {/* רשימת מקורות הכנסה */}
        <div className="space-y-4">
          {incomeSources.map((source, index) => {
            const typeInfo = getTypeInfo(source.employmentType);
            const Icon = typeInfo.icon;
            const deductions = calculateDeductions(source.grossAmount, source.netAmount);
            const deductionRate = source.grossAmount > 0 ? ((deductions / source.grossAmount) * 100).toFixed(1) : 0;

            return (
              <div 
                key={source.id} 
                className="p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-[#3A7BD5] transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${typeInfo.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: typeInfo.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#1E2A3B]">
                          {source.sourceName || `מקור הכנסה ${index + 1}`}
                        </p>
                        {source.isPrimary && (
                          <span className="text-xs bg-[#7ED957] text-white px-2 py-0.5 rounded">עיקרי</span>
                        )}
                      </div>
                      <p className="text-xs text-[#888888]">{typeInfo.label}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSource(source.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Main fields */}
                <div className="grid gap-3">
                  {/* שם המקור */}
                  <div>
                    <Label className="text-xs text-[#555555]">שם מקור ההכנסה</Label>
                    <Input
                      value={source.sourceName}
                      onChange={(e) => updateSource(source.id, 'sourceName', e.target.value)}
                      placeholder="לדוגמה: משכורת ראשית, פרויקט צד, שכירות דירה"
                      className="mt-1"
                    />
                  </div>

                  {/* סוג תעסוקה */}
                  <div>
                    <Label className="text-xs text-[#555555]">סוג תעסוקה</Label>
                    <Select 
                      value={source.employmentType} 
                      onValueChange={(val) => updateSource(source.id, 'employmentType', val)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {employmentTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="w-4 h-4" style={{ color: type.color }} />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    {/* הכנסה ברוטו */}
                    <div>
                      <Label className="text-xs text-[#555555]">
                        💼 הכנסה ברוטו (לפני כל הניכויים)
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={source.grossAmount || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0;
                            updateSource(source.id, 'grossAmount', value);
                          }}
                          placeholder="0"
                          className="text-left pr-10"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
                      </div>
                      <p className="text-xs text-[#888888] mt-1">מה שרשום בחוזה העבודה</p>
                    </div>

                    {/* נטו משכורת */}
                    <div>
                      <Label className="text-xs text-[#555555]">
                        📄 נטו משכורת (אחרי מס + ביטוח לאומי)
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={source.netAmount || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0;
                            updateSource(source.id, 'netAmount', value);
                          }}
                          placeholder="0"
                          className="text-left pr-10"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
                      </div>
                      <p className="text-xs text-[#888888] mt-1">מה שרשום בתלוש שכר (שורת "נטו לתשלום")</p>
                    </div>

                    {/* קיזוזים נוספים */}
                    {source.employmentType === 'employee' && (
                      <div className="bg-[#F5F6F8] rounded-lg p-3 space-y-2">
                        <Label className="text-xs font-semibold text-[#1E2A3B]">
                          קיזוזים נוספים מהתלוש (אופציונלי)
                        </Label>
                        
                        <div className="grid grid-cols-3 gap-2">
                          {/* פנסיה */}
                          <div>
                            <Label className="text-xs text-[#555555]">פנסיה</Label>
                            <div className="relative mt-1">
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={source.pensionContribution || ''}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0;
                                  updateSource(source.id, 'pensionContribution', value);
                                }}
                                placeholder="0"
                                className="text-left pr-7 text-sm h-8"
                              />
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555555] text-xs">₪</span>
                            </div>
                          </div>

                          {/* קרן השתלמות */}
                          <div>
                            <Label className="text-xs text-[#555555]">קה״ש</Label>
                            <div className="relative mt-1">
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={source.advancedStudyFund || ''}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0;
                                  updateSource(source.id, 'advancedStudyFund', value);
                                }}
                                placeholder="0"
                                className="text-left pr-7 text-sm h-8"
                              />
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555555] text-xs">₪</span>
                            </div>
                          </div>

                          {/* אחר */}
                          <div>
                            <Label className="text-xs text-[#555555]">אחר</Label>
                            <div className="relative mt-1">
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={source.otherDeductions || ''}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0;
                                  updateSource(source.id, 'otherDeductions', value);
                                }}
                                placeholder="0"
                                className="text-left pr-7 text-sm h-8"
                              />
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555555] text-xs">₪</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-[#888888]">
                          💡 כולל: הלוואות, ביטוחים נוספים, ארגון עובדים וכו׳
                        </p>
                      </div>
                    )}

                    {/* נכנס לבנק בפועל */}
                    <div className="bg-[#E8F5E9] border-2 border-[#7ED957] rounded-lg p-3">
                      <Label className="text-xs font-semibold text-[#1E2A3B]">
                        🏦 נכנס לבנק בפועל (החשוב ביותר!)
                      </Label>
                      <div className="relative mt-2">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={source.actualBankAmount || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0;
                            updateSource(source.id, 'actualBankAmount', value);
                          }}
                          placeholder="0"
                          className="text-left pr-10 font-semibold border-[#7ED957]"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
                      </div>
                      <p className="text-xs text-[#7ED957] font-medium mt-1">
                        ✓ מה שבאמת מגיע לחשבון הבנק שלך
                      </p>
                    </div>
                  </div>

                  {/* חישוב הפרשים */}
                  {source.netAmount > 0 && source.actualBankAmount > 0 && source.netAmount !== source.actualBankAmount && (
                    <div className="bg-[#FFF3E0] border border-[#F6A623] rounded p-3 text-xs space-y-1">
                      <p className="font-semibold text-[#1E2A3B]">📊 פירוט הפרשים:</p>
                      {source.grossAmount > 0 && (
                        <p className="text-[#555555]">
                          • מס + ביטוח לאומי: <strong>{(source.grossAmount - source.netAmount).toLocaleString('he-IL')} ₪</strong>
                        </p>
                      )}
                      {(source.pensionContribution || 0) > 0 && (
                        <p className="text-[#555555]">
                          • פנסיה: <strong>{(source.pensionContribution || 0).toLocaleString('he-IL')} ₪</strong>
                        </p>
                      )}
                      {(source.advancedStudyFund || 0) > 0 && (
                        <p className="text-[#555555]">
                          • קרן השתלמות: <strong>{(source.advancedStudyFund || 0).toLocaleString('he-IL')} ₪</strong>
                        </p>
                      )}
                      {(source.otherDeductions || 0) > 0 && (
                        <p className="text-[#555555]">
                          • קיזוזים אחרים: <strong>{(source.otherDeductions || 0).toLocaleString('he-IL')} ₪</strong>
                        </p>
                      )}
                      <div className="pt-1 border-t border-[#F6A623] mt-2">
                        <p className="text-[#1E2A3B] font-semibold">
                          סה״כ קיזוזים: {(source.netAmount - source.actualBankAmount).toLocaleString('he-IL')} ₪
                        </p>
                      </div>
                    </div>
                  )}

                  {/* פרטים נוספים לפי סוג */}
                  {source.employmentType === 'employee' && (
                    <div>
                      <Label className="text-xs text-[#555555]">שם המעסיק (אופציונלי)</Label>
                      <Input
                        value={source.employerName || ''}
                        onChange={(e) => updateSource(source.id, 'employerName', e.target.value)}
                        placeholder="לדוגמה: חברת ABC בע״מ"
                        className="mt-1"
                      />
                    </div>
                  )}

                  {(source.employmentType === 'employee' || source.employmentType === 'self_employed') && (
                    <div>
                      <Label className="text-xs text-[#555555]">ניכוי פנסיה חודשי (אופציונלי)</Label>
                      <div className="relative mt-1">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={source.pensionContribution || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0;
                            updateSource(source.id, 'pensionContribution', value);
                          }}
                          placeholder="0"
                          className="text-left pr-10"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
                      </div>
                      <p className="text-xs text-[#888888] mt-1">
                        חשוב לחישוב זכויות פנסיוניות עתידיות
                      </p>
                    </div>
                  )}

                  {/* סימון כעיקרי */}
                  {!source.isPrimary && incomeSources.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPrimary(source.id)}
                      className="text-xs"
                    >
                      סמן כמקור הכנסה עיקרי
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* סיכום */}
      {incomeSources.length > 0 && (
        <div className="bg-gradient-to-l from-[#E3F2FD] to-[#E8F5E9] border-2 border-[#7ED957] rounded-lg p-4">
          <p className="text-sm font-semibold text-[#1E2A3B] mb-3">📊 סיכום הכנסות:</p>
          
          <div className="grid grid-cols-3 gap-3">
            {/* ברוטו */}
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-[#888888]">סה״כ ברוטו</p>
              <p className="text-lg font-bold text-[#3A7BD5]">
                {totalGross.toLocaleString('he-IL')} ₪
              </p>
            </div>

            {/* נטו משכורת */}
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-[#888888]">נטו משכורת</p>
              <p className="text-lg font-bold text-[#3A7BD5]">
                {totalNet.toLocaleString('he-IL')} ₪
              </p>
            </div>

            {/* נכנס לבנק */}
            <div className="bg-[#E8F5E9] border-2 border-[#7ED957] rounded-lg p-3">
              <p className="text-xs text-[#7ED957] font-semibold">🏦 נכנס לבנק</p>
              <p className="text-xl font-bold text-[#7ED957]">
                {totalActualBank.toLocaleString('he-IL')} ₪
              </p>
            </div>
          </div>

          {totalDeductions > 0 && (
            <div className="mt-3 bg-white rounded-lg p-3">
              <p className="text-xs text-[#888888]">סה״כ ניכויים וקיזוזים חודשיים</p>
              <p className="text-lg font-bold text-[#F6A623]">
                {totalDeductions.toLocaleString('he-IL')} ₪
              </p>
              <div className="text-xs text-[#888888] mt-2 space-y-1">
                <p>• מס הכנסה + ביטוח לאומי: {(totalGross - totalNet).toLocaleString('he-IL')} ₪</p>
                <p>• קיזוזים נוספים: {(totalNet - totalActualBank).toLocaleString('he-IL')} ₪</p>
              </div>
            </div>
          )}

          {/* פירוט מקורות */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-[#888888] mb-2">פירוט לפי סוג תעסוקה (נכנס לבנק):</p>
            <div className="space-y-1 text-xs">
              {employmentTypes.map(type => {
                const sourcesOfType = incomeSources.filter(s => s.employmentType === type.value);
                const total = sourcesOfType.reduce((sum, s) => sum + (s.actualBankAmount || 0), 0);
                if (total === 0) return null;
                
                return (
                  <div key={type.value} className="flex justify-between items-center">
                    <span className="text-[#555555]">• {type.label}</span>
                    <span className="font-medium text-[#1E2A3B]">
                      {total.toLocaleString('he-IL')} ₪
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
