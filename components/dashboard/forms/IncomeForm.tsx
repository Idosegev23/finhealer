'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Briefcase, DollarSign, Banknote, Building2, PiggyBank, Landmark, TrendingUp, Save, ArrowRight, Loader2 } from 'lucide-react';

interface IncomeSource {
  id?: string;
  source_name: string;
  employment_type: 'employee' | 'self_employed' | 'freelance' | 'business' | 'rental' | 'investment' | 'pension' | 'other';
  gross_amount: number | null;
  net_amount: number | null;
  actual_bank_amount: number | null;
  employer_name: string;
  pension_contribution: number | null;
  advanced_study_fund: number | null;
  other_deductions: number | null;
  is_primary: boolean;
}

interface IncomeFormProps {
  initialIncomeSources: any[];
}

const employmentTypes = [
  { value: 'employee', label: 'שכיר', icon: <Briefcase className="w-4 h-4" /> },
  { value: 'self_employed', label: 'עצמאי', icon: <DollarSign className="w-4 h-4" /> },
  { value: 'freelance', label: 'פרילנסר', icon: <Banknote className="w-4 h-4" /> },
  { value: 'business', label: 'בעל עסק', icon: <Building2 className="w-4 h-4" /> },
  { value: 'rental', label: 'הכנסה משכירות', icon: <Landmark className="w-4 h-4" /> },
  { value: 'investment', label: 'הכנסה מהשקעות', icon: <TrendingUp className="w-4 h-4" /> },
  { value: 'pension', label: 'פנסיה/קצבה', icon: <PiggyBank className="w-4 h-4" /> },
  { value: 'other', label: 'אחר', icon: <Plus className="w-4 h-4" /> },
];

export default function IncomeForm({ initialIncomeSources }: IncomeFormProps) {
  const router = useRouter();
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>(
    initialIncomeSources.map(source => ({
      id: source.id,
      source_name: source.source_name,
      employment_type: source.employment_type,
      gross_amount: source.gross_amount,
      net_amount: source.net_amount,
      actual_bank_amount: source.actual_bank_amount,
      employer_name: source.employer_name || '',
      pension_contribution: source.pension_contribution,
      advanced_study_fund: source.advanced_study_fund,
      other_deductions: source.other_deductions,
      is_primary: source.is_primary
    }))
  );
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const addIncomeSource = () => {
    const newSource: IncomeSource = {
      source_name: '',
      employment_type: 'employee',
      gross_amount: null,
      net_amount: null,
      actual_bank_amount: null,
      employer_name: '',
      pension_contribution: null,
      advanced_study_fund: null,
      other_deductions: null,
      is_primary: incomeSources.length === 0,
    };
    setIncomeSources(prev => [...prev, newSource]);
  };

  const updateIncomeSource = (index: number, field: keyof IncomeSource, value: any) => {
    setIncomeSources(prev =>
      prev.map((source, i) =>
        i === index ? { ...source, [field]: value } : source
      )
    );
  };

  const removeIncomeSource = (index: number) => {
    setIncomeSources(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccessMessage('');

    try {
      const response = await fetch('/api/reflection/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incomeSources: incomeSources.map(source => ({
            sourceName: source.source_name,
            employmentType: source.employment_type,
            grossAmount: source.gross_amount || 0,
            netAmount: source.net_amount || 0,
            actualBankAmount: source.actual_bank_amount || source.net_amount || 0,
            employerName: source.employer_name,
            pensionContribution: source.pension_contribution || 0,
            advancedStudyFund: source.advanced_study_fund || 0,
            otherDeductions: source.other_deductions || 0,
            isPrimary: source.is_primary
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save income sources');
      }

      setSuccessMessage('הנתונים נשמרו בהצלחה! ✓');
      
      // Redirect back to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);

    } catch (error) {
      console.error('Error saving income sources:', error);
      alert('אירעה שגיאה בשמירת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const getTypeInfo = (type: string) => employmentTypes.find(t => t.value === type) || employmentTypes[0];

  return (
    <div className="space-y-6">
      {/* Add Income Source Button */}
      <div className="flex justify-center">
        <Button
          type="button"
          onClick={addIncomeSource}
          className="bg-[#7ED957] hover:bg-[#6BBF4A] text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          הוסף מקור הכנסה
        </Button>
      </div>

      {incomeSources.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
          <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-[#888888]">עדיין לא הוספת מקורות הכנסה</p>
          <p className="text-xs text-[#888888] mt-1">לחץ על &quot;הוסף מקור הכנסה&quot; כדי להתחיל</p>
        </div>
      )}

      {/* Income Sources List */}
      <div className="space-y-4">
        <AnimatePresence>
          {incomeSources.map((source, index) => {
            const typeInfo = getTypeInfo(source.employment_type);
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 relative"
              >
                {/* Remove Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIncomeSource(index)}
                  className="absolute top-3 left-3 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {/* שם מקור הכנסה */}
                  <div>
                    <Label htmlFor={`sourceName-${index}`} className="text-[#1E2A3B] font-medium">שם מקור הכנסה</Label>
                    <Input
                      id={`sourceName-${index}`}
                      value={source.source_name}
                      onChange={(e) => updateIncomeSource(index, 'source_name', e.target.value)}
                      placeholder="לדוגמה: משכורת חודשית, עסק עצמאי"
                      className="mt-1"
                    />
                  </div>

                  {/* סוג תעסוקה */}
                  <div>
                    <Label htmlFor={`employmentType-${index}`} className="text-[#1E2A3B] font-medium">סוג תעסוקה</Label>
                    <Select
                      value={source.employment_type}
                      onValueChange={(value: any) => updateIncomeSource(index, 'employment_type', value)}
                    >
                      <SelectTrigger id={`employmentType-${index}`} className="w-full mt-1">
                        <SelectValue placeholder="בחר סוג תעסוקה" />
                      </SelectTrigger>
                      <SelectContent>
                        {employmentTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              {type.icon}
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {/* ברוטו */}
                  <div>
                    <Label htmlFor={`grossAmount-${index}`} className="text-[#1E2A3B] font-medium">הכנסה ברוטו (לפני קיזוזים)</Label>
                    <div className="relative mt-1">
                      <Input
                        id={`grossAmount-${index}`}
                        type="number"
                        value={source.gross_amount || ''}
                        onChange={(e) => updateIncomeSource(index, 'gross_amount', parseFloat(e.target.value) || null)}
                        placeholder="0"
                        className="text-left pr-10"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
                    </div>
                  </div>

                  {/* נטו */}
                  <div>
                    <Label htmlFor={`netAmount-${index}`} className="text-[#1E2A3B] font-medium">הכנסה נטו (אחרי מס וביטוח לאומי)</Label>
                    <div className="relative mt-1">
                      <Input
                        id={`netAmount-${index}`}
                        type="number"
                        value={source.net_amount || ''}
                        onChange={(e) => updateIncomeSource(index, 'net_amount', parseFloat(e.target.value) || null)}
                        placeholder="0"
                        className="text-left pr-10"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
                    </div>
                    <p className="text-xs text-[#888888] mt-1">מה שרשום בתלוש שכר (שורת &quot;נטו לתשלום&quot;)</p>
                  </div>
                </div>

                {/* קיזוזים נוספים */}
                {source.employment_type === 'employee' && (
                  <div className="bg-[#F5F6F8] rounded-lg p-4 mb-4">
                    <Label className="text-sm font-semibold text-[#1E2A3B] block mb-3">קיזוזים נוספים מהשכר (לפני כניסה לבנק)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* הפרשה לפנסיה */}
                      <div>
                        <Label htmlFor={`pension-${index}`} className="text-xs text-[#555555]">הפרשה לפנסיה</Label>
                        <div className="relative mt-1">
                          <Input
                            id={`pension-${index}`}
                            type="number"
                            value={source.pension_contribution || ''}
                            onChange={(e) => updateIncomeSource(index, 'pension_contribution', parseFloat(e.target.value) || null)}
                            placeholder="0"
                            className="text-left pr-10 text-sm"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]">₪</span>
                        </div>
                      </div>
                      {/* קרן השתלמות */}
                      <div>
                        <Label htmlFor={`advancedStudyFund-${index}`} className="text-xs text-[#555555]">קרן השתלמות</Label>
                        <div className="relative mt-1">
                          <Input
                            id={`advancedStudyFund-${index}`}
                            type="number"
                            value={source.advanced_study_fund || ''}
                            onChange={(e) => updateIncomeSource(index, 'advanced_study_fund', parseFloat(e.target.value) || null)}
                            placeholder="0"
                            className="text-left pr-10 text-sm"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]">₪</span>
                        </div>
                      </div>
                      {/* ניכויים אחרים */}
                      <div>
                        <Label htmlFor={`otherDeductions-${index}`} className="text-xs text-[#555555]">ניכויים אחרים</Label>
                        <div className="relative mt-1">
                          <Input
                            id={`otherDeductions-${index}`}
                            type="number"
                            value={source.other_deductions || ''}
                            onChange={(e) => updateIncomeSource(index, 'other_deductions', parseFloat(e.target.value) || null)}
                            placeholder="0"
                            className="text-left pr-10 text-sm"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]">₪</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* נטו לבנק בפועל */}
                <div>
                  <Label htmlFor={`actualBankAmount-${index}`} className="text-[#1E2A3B] font-medium">נטו שנכנס לבנק בפועל ⭐</Label>
                  <div className="relative mt-1">
                    <Input
                      id={`actualBankAmount-${index}`}
                      type="number"
                      value={source.actual_bank_amount || ''}
                      onChange={(e) => updateIncomeSource(index, 'actual_bank_amount', parseFloat(e.target.value) || null)}
                      placeholder="0"
                      className="text-left pr-10 bg-blue-50 border-blue-200"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3A7BD5]">₪</span>
                  </div>
                  <p className="text-xs text-[#888888] mt-1">הסכום הסופי שנכנס לחשבון הבנק שלך לאחר כל הקיזוזים</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Success Message */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#E8F5E9] border border-[#7ED957] rounded-lg p-4 text-center"
        >
          <p className="text-[#1E2A3B] font-semibold">{successMessage}</p>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard')}
          disabled={loading}
        >
          ביטול
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={loading || incomeSources.length === 0}
          className="bg-[#3A7BD5] hover:bg-[#2E5EA5] text-white px-8"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 ml-2" />
              שמור והמשך
              <ArrowRight className="w-4 h-4 mr-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

