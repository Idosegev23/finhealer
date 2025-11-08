"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Briefcase,
  DollarSign,
  Banknote,
  Building2,
  Landmark,
  TrendingUp,
  PiggyBank,
  Plus,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Calendar,
  Zap,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { SmartIncomeCalculator } from './SmartIncomeCalculator';

// ============================================================================
// טיפוסים
// ============================================================================

interface WizardData {
  source_name: string;
  employment_type: string;
  actual_bank_amount: number | null;
  payment_frequency: string;
  gross_amount?: number | null;
  net_amount?: number | null;
  employer_name?: string;
  pension_contribution?: number | null;
  advanced_study_fund?: number | null;
  other_deductions?: number | null;
  is_primary?: boolean;
  is_variable?: boolean;
  min_amount?: number | null;
  max_amount?: number | null;
}

interface ConversationalIncomeWizardProps {
  onSuccess?: (data: any) => void;
  onCancel?: () => void;
  initialData?: Partial<WizardData>;
  editMode?: boolean;
  incomeId?: string;
}

// ============================================================================
// קבועים
// ============================================================================

const EMPLOYMENT_TYPES = [
  { value: 'employee', label: 'שכיר', icon: Briefcase, color: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
  { value: 'self_employed', label: 'עצמאי', icon: DollarSign, color: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
  { value: 'freelance', label: 'פרילנסר', icon: Banknote, color: 'bg-green-50 text-green-600 hover:bg-green-100' },
  { value: 'business', label: 'בעל עסק', icon: Building2, color: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
  { value: 'rental', label: 'שכירות', icon: Landmark, color: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' },
  { value: 'investment', label: 'השקעות', icon: TrendingUp, color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
  { value: 'pension', label: 'פנסיה', icon: PiggyBank, color: 'bg-pink-50 text-pink-600 hover:bg-pink-100' },
  { value: 'other', label: 'אחר', icon: Plus, color: 'bg-gray-50 text-gray-600 hover:bg-gray-100' },
];

const SOURCE_NAME_SUGGESTIONS = [
  'משכורת',
  'עסק עצמאי',
  'פרוייקטים',
  'דירה להשכרה',
  'דיבידנדים',
  'פנסיה',
  'קצבה',
  'הכנסה נוספת',
];

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'אחת לחודש', icon: Calendar },
  { value: 'weekly', label: 'אחת לשבוע', icon: Calendar },
  { value: 'one_time', label: 'חד-פעמי', icon: Zap },
];

// ============================================================================
// קומפוננטה ראשית
// ============================================================================

export default function ConversationalIncomeWizard({
  onSuccess,
  onCancel,
  initialData = {},
  editMode = false,
  incomeId,
}: ConversationalIncomeWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [calculatedData, setCalculatedData] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [uploadingPayslip, setUploadingPayslip] = useState(false);
  const [payslipData, setPayslipData] = useState<any>(null);

  const [data, setData] = useState<WizardData>({
    source_name: initialData.source_name || '',
    employment_type: initialData.employment_type || '',
    actual_bank_amount: initialData.actual_bank_amount || null,
    payment_frequency: initialData.payment_frequency || 'monthly',
    gross_amount: initialData.gross_amount,
    net_amount: initialData.net_amount,
    employer_name: initialData.employer_name,
    pension_contribution: initialData.pension_contribution,
    advanced_study_fund: initialData.advanced_study_fund,
    other_deductions: initialData.other_deductions,
    is_primary: initialData.is_primary ?? false,
    is_variable: initialData.is_variable ?? false,
    min_amount: initialData.min_amount,
    max_amount: initialData.max_amount,
  });

  // חישוב אוטומטי כשיש מספיק נתונים
  useEffect(() => {
    if (data.actual_bank_amount && data.employment_type && data.actual_bank_amount > 0) {
      const result = SmartIncomeCalculator.calculateReverse(
        data.actual_bank_amount,
        data.employment_type as any
      );
      setCalculatedData(result);
    }
  }, [data.actual_bank_amount, data.employment_type]);

  // פונקציות עזר
  const handleNext = () => {
    if (canProceed()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return data.employment_type !== '';
      case 2:
        return data.source_name.trim() !== '';
      case 3:
        return data.actual_bank_amount !== null && data.actual_bank_amount > 0;
      case 4:
        return data.payment_frequency !== '';
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const bodyData = {
        source_name: data.source_name,
        employment_type: data.employment_type,
        actual_bank_amount: data.actual_bank_amount,
        payment_frequency: data.payment_frequency,
        gross_amount: calculatedData?.gross || null,
        net_amount: calculatedData?.net || null,
        employer_name: data.employer_name || null,
        pension_contribution: calculatedData?.pension || null,
        advanced_study_fund: calculatedData?.advancedStudy || null,
        other_deductions: data.other_deductions || null,
        is_primary: data.is_primary,
        is_variable: data.is_variable,
        min_amount: data.min_amount,
        max_amount: data.max_amount,
      };

      // עדכון או יצירה
      const response = await fetch(
        editMode && incomeId ? `/api/income/${incomeId}` : '/api/income',
        {
          method: editMode ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || (editMode ? 'שגיאה בעדכון מקור הכנסה' : 'שגיאה ביצירת מקור הכנסה'));
      }

      onSuccess?.(result.income);
    } catch (error: any) {
      alert(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // חישוב progress
  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-xl" dir="rtl">
      {/* Header with Edit Mode Indicator */}
      {editMode && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-900">
            <span className="text-lg">✏️</span>
            <span className="font-semibold">מצב עריכה</span>
          </div>
          <p className="text-sm text-blue-700 mt-1">
            אתה עורך הכנסה קיימת - כל השינויים ישמרו
          </p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#3A7BD5] to-[#7ED957]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>שלב {step} מתוך {totalSteps}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Steps */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <Step1EmploymentType
            value={data.employment_type}
            onChange={(type) => setData({ ...data, employment_type: type })}
            onNext={handleNext}
          />
        )}

        {step === 2 && (
          <Step2SourceName
            value={data.source_name}
            employmentType={data.employment_type}
            onChange={(name) => setData({ ...data, source_name: name })}
            onNext={handleNext}
            onBack={handleBack}
            onUploadPayslip={async (file: File) => {
              setUploadingPayslip(true);
              try {
                // TODO: Implement OCR
                // For now, just show a message
                alert('🚀 תכונת OCR תתווסף בקרוב! נוכל לקרוא את התלוש אוטומטית');
                setUploadingPayslip(false);
              } catch (error) {
                alert('❌ שגיאה בקריאת התלוש');
                setUploadingPayslip(false);
              }
            }}
            uploadingPayslip={uploadingPayslip}
          />
        )}

        {step === 3 && (
          <Step3Amount
            value={data.actual_bank_amount}
            isVariable={data.is_variable ?? false}
            minAmount={data.min_amount ?? null}
            maxAmount={data.max_amount ?? null}
            onChange={(amount) => setData({ ...data, actual_bank_amount: amount })}
            onVariableToggle={(isVariable) => setData({ ...data, is_variable: isVariable })}
            onRangeChange={(min, max) => setData({ ...data, min_amount: min, max_amount: max })}
            calculatedData={calculatedData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {step === 4 && (
          <Step4Frequency
            value={data.payment_frequency}
            onChange={(freq) => setData({ ...data, payment_frequency: freq })}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {step === 5 && (
          <Step5Confirm
            data={data}
            calculatedData={calculatedData}
            onChange={setData}
            onSubmit={handleSubmit}
            onBack={handleBack}
            loading={loading}
          />
        )}
      </AnimatePresence>

      {/* Cancel Button */}
      {onCancel && (
        <div className="mt-6 text-center">
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
            disabled={loading}
          >
            ביטול
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Step Components
// ============================================================================

function Step1EmploymentType({
  value,
  onChange,
  onNext,
}: {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">בואו נתחיל! 👋</h2>
        <p className="text-gray-600">איך אתה מרוויח?</p>
        <div className="mt-3 text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
          💡 בחר את סוג התעסוקה הראשי שלך - זה יעזור לנו לחשב את הניכויים בצורה מדויקת
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {EMPLOYMENT_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = value === type.value;

          return (
            <motion.button
              key={type.value}
              onClick={() => {
                onChange(type.value);
                setTimeout(onNext, 300);
              }}
              className={`p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-[#3A7BD5] bg-[#3A7BD5]/10 shadow-md'
                  : `border-transparent ${type.color}`
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? 'text-[#3A7BD5]' : ''}`} />
              <span className="text-sm font-medium block">{type.label}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

function Step2SourceName({
  value,
  employmentType,
  onChange,
  onNext,
  onBack,
  onUploadPayslip,
  uploadingPayslip,
}: {
  value: string;
  employmentType: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onUploadPayslip?: (file: File) => void;
  uploadingPayslip?: boolean;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fileInputRef = useState<HTMLInputElement | null>(null)[1];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadPayslip) {
      onUploadPayslip(file);
    }
  };

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">נהדר! ✨</h2>
        <p className="text-gray-600">איך תרצה לקרוא למקור הכנסה הזה?</p>
        <div className="mt-3 text-sm text-gray-500 bg-green-50 border border-green-100 rounded-lg p-3">
          💡 תן שם ברור - למשל "משכורת ראשית", "פרויקט X", "דירה להשכרה"
        </div>
      </div>

      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="לדוגמה: משכורת, עסק, פרויקטים..."
          className="text-lg p-6 text-center"
          autoFocus
        />

        {/* Suggestions */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
            {SOURCE_NAME_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onMouseDown={() => {
                  onChange(suggestion);
                  setShowSuggestions(false);
                }}
                className="w-full text-right px-4 py-2 hover:bg-gray-50 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Upload Payslip Option */}
      {employmentType === 'employee' && onUploadPayslip && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#3A7BD5] transition-colors cursor-pointer bg-gray-50 hover:bg-blue-50">
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="hidden"
            id="payslip-upload"
            disabled={uploadingPayslip}
          />
          <label htmlFor="payslip-upload" className="cursor-pointer">
            <div className="flex flex-col items-center gap-2">
              {uploadingPayslip ? (
                <>
                  <Loader2 className="w-8 h-8 text-[#3A7BD5] animate-spin" />
                  <p className="text-sm text-gray-600">קורא את התלוש...</p>
                </>
              ) : (
                <>
                  <Sparkles className="w-8 h-8 text-[#3A7BD5]" />
                  <p className="font-semibold text-gray-900">יש לך תלוש משכורת?</p>
                  <p className="text-sm text-gray-600">העלה אותו ונמלא הכל אוטומטית! ✨</p>
                  <p className="text-xs text-gray-500 mt-1">תומך בתמונות ו-PDF</p>
                </>
              )}
            </div>
          </label>
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={onBack} variant="outline" className="flex-1">
          <ArrowRight className="w-4 h-4 ml-2" />
          חזור
        </Button>
        <Button
          onClick={onNext}
          disabled={!value.trim()}
          className="flex-1 bg-[#3A7BD5] hover:bg-[#2E6BB7]"
        >
          המשך
          <ArrowLeft className="w-4 h-4 mr-2" />
        </Button>
      </div>
    </motion.div>
  );
}

function Step3Amount({
  value,
  isVariable,
  minAmount,
  maxAmount,
  onChange,
  onVariableToggle,
  onRangeChange,
  calculatedData,
  onNext,
  onBack,
}: {
  value: number | null;
  isVariable: boolean;
  minAmount: number | null;
  maxAmount: number | null;
  onChange: (value: number) => void;
  onVariableToggle: (value: boolean) => void;
  onRangeChange: (min: number | null, max: number | null) => void;
  calculatedData: any;
  onNext: () => void;
  onBack: () => void;
}) {
  const [inputValue, setInputValue] = useState(value?.toString() || '');

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    const num = parseFloat(newValue);
    if (!isNaN(num) && num > 0) {
      onChange(num);
    }
  };

  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">כמה נכנס לך לבנק? 💰</h2>
        <p className="text-gray-600 text-sm">
          {isVariable ? 'הזן את הסכום הממוצע שלך' : 'הסכום שבאמת מגיע לחשבון בכל חודש'}
        </p>
        <div className="mt-3 text-sm text-gray-500 bg-yellow-50 border border-yellow-100 rounded-lg p-3">
          💡 זה הסכום שרואים בחשבון הבנק <strong>אחרי</strong> כל הניכויים (מס, ביטוח לאומי, פנסיה)
        </div>
      </div>

      {/* הכנסה משתנה Toggle */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isVariable}
            onChange={(e) => onVariableToggle(e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-700">הכנסה משתנה?</span>
        </label>
      </div>

      {!isVariable ? (
        <>
          <div className="relative">
            <Input
              type="number"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="0"
              className="text-3xl font-bold p-8 text-center"
              autoFocus
            />
            <div className="absolute left-1/2 transform -translate-x-1/2 bottom-2 text-gray-400 text-sm">
              ₪
            </div>
          </div>

          {/* חישוב אוטומטי */}
          {calculatedData && value && value > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-50 border border-blue-200 rounded-lg p-4"
            >
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900 mb-2">חישוב משוער:</p>
                  <div className="space-y-1 text-sm text-blue-800">
                    <div className="flex justify-between">
                      <span>ברוטו משוער:</span>
                      <span className="font-semibold">{SmartIncomeCalculator.formatAmount(calculatedData.gross)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>נטו:</span>
                      <span className="font-semibold">{SmartIncomeCalculator.formatAmount(calculatedData.net)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm mb-2 block text-gray-700">מינימום</Label>
              <Input
                type="number"
                value={minAmount?.toString() || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onRangeChange(!isNaN(val) ? val : null, maxAmount);
                }}
                placeholder="0"
                className="text-lg p-4"
              />
            </div>
            <div>
              <Label className="text-sm mb-2 block text-gray-700">מקסימום</Label>
              <Input
                type="number"
                value={maxAmount?.toString() || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onRangeChange(minAmount, !isNaN(val) ? val : null);
                }}
                placeholder="0"
                className="text-lg p-4"
              />
            </div>
          </div>

          {minAmount && maxAmount && (
            <div className="text-center text-sm text-gray-600">
              ממוצע: <span className="font-semibold">{SmartIncomeCalculator.formatAmount((minAmount + maxAmount) / 2)}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={onBack} variant="outline" className="flex-1">
          <ArrowRight className="w-4 h-4 ml-2" />
          חזור
        </Button>
        <Button
          onClick={onNext}
          disabled={!value || value <= 0}
          className="flex-1 bg-[#3A7BD5] hover:bg-[#2E6BB7]"
        >
          המשך
          <ArrowLeft className="w-4 h-4 mr-2" />
        </Button>
      </div>
    </motion.div>
  );
}

function Step4Frequency({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">באיזו תדירות? 📅</h2>
        <p className="text-gray-600">כל כמה זמן ההכנסה הזו מגיעה?</p>
        <div className="mt-3 text-sm text-gray-500 bg-purple-50 border border-purple-100 rounded-lg p-3">
          💡 רוב האנשים מקבלים משכורת פעם בחודש, אבל יש גם תשלומים שבועיים או חד-פעמיים
        </div>
      </div>

      <div className="space-y-3">
        {FREQUENCY_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;

          return (
            <motion.button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setTimeout(onNext, 300);
              }}
              className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                isSelected
                  ? 'border-[#3A7BD5] bg-[#3A7BD5]/10 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon className={`w-6 h-6 ${isSelected ? 'text-[#3A7BD5]' : 'text-gray-400'}`} />
              <span className={`text-lg font-medium ${isSelected ? 'text-[#3A7BD5]' : 'text-gray-700'}`}>
                {option.label}
              </span>
              {isSelected && <CheckCircle className="w-6 h-6 text-[#7ED957] mr-auto" />}
            </motion.button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button onClick={onBack} variant="outline" className="flex-1">
          <ArrowRight className="w-4 h-4 ml-2" />
          חזור
        </Button>
      </div>
    </motion.div>
  );
}

function Step5Confirm({
  data,
  calculatedData,
  onChange,
  onSubmit,
  onBack,
  loading,
}: {
  data: WizardData;
  calculatedData: any;
  onChange: (data: WizardData) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const employmentLabel = EMPLOYMENT_TYPES.find((t) => t.value === data.employment_type)?.label;
  const frequencyLabel = FREQUENCY_OPTIONS.find((f) => f.value === data.payment_frequency)?.label;

  return (
    <motion.div
      key="step5"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">כל הכבוד! 🎉</h2>
        <p className="text-gray-600">בואו נוודא שהכל נכון</p>
        <div className="mt-3 text-sm text-gray-500 bg-green-50 border border-green-100 rounded-lg p-3">
          ✅ זה סיכום הנתונים - אם משהו לא נכון, תמיד אפשר לחזור אחורה
        </div>
      </div>

      {/* סיכום */}
      <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">שם:</span>
          <span className="font-semibold text-lg">{data.source_name}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">סוג:</span>
          <span className="font-semibold">{employmentLabel}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">סכום:</span>
          <span className="font-bold text-2xl text-[#3A7BD5]">
            {SmartIncomeCalculator.formatAmount(data.actual_bank_amount)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">תדירות:</span>
          <span className="font-semibold">{frequencyLabel}</span>
        </div>

        {calculatedData && (
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-2">חישובים נוספים:</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">ברוטו משוער:</span>
                <span className="font-medium">{SmartIncomeCalculator.formatAmount(calculatedData.gross)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">נטו:</span>
                <span className="font-medium">{SmartIncomeCalculator.formatAmount(calculatedData.net)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* סימון כראשי */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_primary"
          checked={data.is_primary}
          onChange={(e) => onChange({ ...data, is_primary: e.target.checked })}
          className="rounded"
        />
        <Label htmlFor="is_primary" className="cursor-pointer">
          זה מקור ההכנסה העיקרי שלי
        </Label>
      </div>

      {/* כפתורי פעולה */}
      <div className="flex gap-3 pt-4">
        <Button onClick={onBack} variant="outline" className="flex-1" disabled={loading}>
          <ArrowRight className="w-4 h-4 ml-2" />
          חזור
        </Button>
        <Button
          onClick={onSubmit}
          disabled={loading}
          className="flex-1 bg-[#7ED957] hover:bg-[#6BC847] text-white"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {editMode ? 'מעדכן...' : 'שומר...'}
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              {editMode ? 'עדכן!' : 'סיימתי!'}
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

