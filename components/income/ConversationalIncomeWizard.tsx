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
import { useToast } from '@/components/ui/toaster';

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
  { value: 'employee', label: 'שכיר', icon: Briefcase, color: 'bg-blue-50 text-blue-600 hover:bg-blue-100', description: 'עובד במשכורת קבועה' },
  { value: 'contractor', label: 'קבלן כוח אדם', icon: Briefcase, color: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100', description: 'תלוש משכורת אבל זכויות שונות' },
  { value: 'hybrid', label: 'היברידי', icon: Briefcase, color: 'bg-violet-50 text-violet-600 hover:bg-violet-100', description: 'שכיר + עצמאי' },
  { value: 'self_employed', label: 'עצמאי כללי', icon: DollarSign, color: 'bg-purple-50 text-purple-600 hover:bg-purple-100', description: 'עצמאי ללא תיאור רשמי' },
  { value: 'licensed_business', label: 'עוסק מורשה', icon: Building2, color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100', description: 'עם מע״ם 18%' },
  { value: 'exempt_business', label: 'עוסק פטור', icon: DollarSign, color: 'bg-teal-50 text-teal-600 hover:bg-teal-100', description: 'ללא מע״ם' },
  { value: 'freelance', label: 'פרילנסר', icon: Banknote, color: 'bg-green-50 text-green-600 hover:bg-green-100', description: 'עבודות פרויקטליות' },
  { value: 'business', label: 'עסק קטן', icon: Building2, color: 'bg-orange-50 text-orange-600 hover:bg-orange-100', description: 'ללא תיאוריה' },
  { value: 'rental', label: 'שכירות', icon: Landmark, color: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100', description: 'הכנסה מדמי שכירות' },
  { value: 'investment', label: 'השקעות', icon: TrendingUp, color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100', description: 'דיבידנדים וריבית' },
  { value: 'capital_income', label: 'הכנסה מהון', icon: TrendingUp, color: 'bg-blue-50 text-blue-600 hover:bg-blue-100', description: 'מכירת מניות ורווחי הון' },
  { value: 'allowance', label: 'קצבה', icon: PiggyBank, color: 'bg-rose-50 text-rose-600 hover:bg-rose-100', description: 'אבטלה/נכות/ביטוח לאומי' },
  { value: 'pension', label: 'פנסיה', icon: PiggyBank, color: 'bg-pink-50 text-pink-600 hover:bg-pink-100', description: 'קצבת פנסיה' },
  { value: 'other', label: 'אחר', icon: Plus, color: 'bg-gray-50 text-gray-600 hover:bg-gray-100', description: 'סוג אחר' },
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
  const { addToast } = useToast();
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
      addToast({ type: 'error', title: 'שגיאה', description: error.message || String(error), duration: 4000 });
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
            className="h-full bg-gradient-to-r from-phi-dark to-phi-mint"
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
                addToast({ type: 'info', title: 'תכונת OCR תתווסף בקרוב! נוכל לקרוא את התלוש אוטומטית', duration: 4000 });
                setUploadingPayslip(false);
              } catch (error) {
                addToast({ type: 'error', title: 'שגיאה בקריאת התלוש', duration: 4000 });
                setUploadingPayslip(false);
              }
            }}
            uploadingPayslip={uploadingPayslip}
          />
        )}

        {step === 3 && (
          <Step3Amount
            employmentType={data.employment_type}
            employerName={data.employer_name}
            grossAmount={data.gross_amount ?? null}
            netAmount={data.net_amount ?? null}
            actualBankAmount={data.actual_bank_amount ?? null}
            isVariable={data.is_variable ?? false}
            minAmount={data.min_amount ?? null}
            maxAmount={data.max_amount ?? null}
            onDataChange={(updates) => setData({ ...data, ...updates })}
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
            editMode={editMode}
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
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
              className={`p-4 rounded-xl border-2 transition-all text-right ${
                isSelected
                  ? 'border-[#3A7BD5] bg-phi-dark/10 shadow-md'
                  : `border-transparent ${type.color}`
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-2">
                <Icon className={`w-6 h-6 flex-shrink-0 mt-0.5 ${isSelected ? 'text-phi-dark' : ''}`} />
                <div className="flex-1 text-right">
                  <span className="text-sm font-semibold block">{type.label}</span>
                  {type.description && (
                    <span className="text-xs text-gray-500 block mt-0.5">{type.description}</span>
                  )}
                </div>
              </div>
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
          💡 תן שם ברור - למשל &quot;משכורת ראשית&quot;, &quot;פרויקט X&quot;, &quot;דירה להשכרה&quot;
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
                  <Loader2 className="w-8 h-8 text-phi-dark animate-spin" />
                  <p className="text-sm text-gray-600">קורא את התלוש...</p>
                </>
              ) : (
                <>
                  <Sparkles className="w-8 h-8 text-phi-dark" />
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
          className="flex-1 bg-phi-dark hover:bg-[#2E6BB7]"
        >
          המשך
          <ArrowLeft className="w-4 h-4 mr-2" />
        </Button>
      </div>
    </motion.div>
  );
}

function Step3Amount({
  employmentType,
  employerName,
  grossAmount,
  netAmount,
  actualBankAmount,
  isVariable,
  minAmount,
  maxAmount,
  onDataChange,
  calculatedData,
  onNext,
  onBack,
}: {
  employmentType: string;
  employerName?: string;
  grossAmount: number | null;
  netAmount: number | null;
  actualBankAmount: number | null;
  isVariable: boolean;
  minAmount: number | null;
  maxAmount: number | null;
  onDataChange: (updates: Partial<WizardData>) => void;
  calculatedData: any;
  onNext: () => void;
  onBack: () => void;
}) {
  const [localGross, setLocalGross] = useState(grossAmount?.toString() || '');
  const [localNet, setLocalNet] = useState(netAmount?.toString() || '');
  const [localBank, setLocalBank] = useState(actualBankAmount?.toString() || '');
  const [localEmployer, setLocalEmployer] = useState(employerName || '');
  const [includesVAT, setIncludesVAT] = useState(false);
  const [taxPaid, setTaxPaid] = useState(false);
  const [hybridSalaryPart, setHybridSalaryPart] = useState('');
  const [hybridFreelancePart, setHybridFreelancePart] = useState('');

  // סיווג סוגי תעסוקה
  const isEmployee = employmentType === 'employee' || employmentType === 'contractor';
  const isVATBusiness = employmentType === 'licensed_business';
  const isExemptBusiness = employmentType === 'exempt_business';
  const isHybrid = employmentType === 'hybrid';
  const isAllowance = employmentType === 'allowance';
  const isCapitalIncome = employmentType === 'capital_income';
  const isSimpleIncome = ['rental', 'investment', 'pension', 'other'].includes(employmentType);
  const isVariableIncome = ['self_employed', 'freelance', 'business'].includes(employmentType);

  const handleGrossChange = (value: string) => {
    setLocalGross(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      onDataChange({ gross_amount: num });
    }
  };

  const handleNetChange = (value: string) => {
    setLocalNet(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      onDataChange({ net_amount: num });
    }
  };

  const handleBankChange = (value: string) => {
    setLocalBank(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      onDataChange({ actual_bank_amount: num });
    }
  };

  // חישוב מע"מ אוטומטי
  const calculateVAT = (amountWithVAT: number) => {
    const withoutVAT = amountWithVAT / 1.18;
    const vat = amountWithVAT - withoutVAT;
    return { withoutVAT: Math.round(withoutVAT), vat: Math.round(vat) };
  };

  const canProceed = () => {
    if (isEmployee) {
      return (grossAmount && grossAmount > 0) || (actualBankAmount && actualBankAmount > 0);
    }
    if (isHybrid) {
      const salaryNum = parseFloat(hybridSalaryPart);
      const freelanceNum = parseFloat(hybridFreelancePart);
      return !isNaN(salaryNum) && salaryNum > 0 && !isNaN(freelanceNum) && freelanceNum > 0;
    }
    if (isVariableIncome && isVariable) {
      return minAmount && maxAmount && minAmount > 0 && maxAmount > 0;
    }
    return actualBankAmount && actualBankAmount > 0;
  };

  // תוכן דינמי בהתאם לסוג התעסוקה
  const getTitle = () => {
    if (isEmployee) {
      if (employmentType === 'contractor') return 'פרטי משכורת - קבלן כוח אדם 💼';
      return 'בואו נבין את המשכורת שלך 💰';
    }
    if (isVATBusiness) return 'הכנסה חודשית - עוסק מורשה 📊';
    if (isExemptBusiness) return 'הכנסה חודשית - עוסק פטור 📝';
    if (isHybrid) return 'חישוב הכנסה משולבת 🔀';
    if (isAllowance) return 'סכום הקצבה החודשי 🏥';
    if (isCapitalIncome) return 'הכנסה מהון 📈';
    if (isSimpleIncome) return 'כמה מגיע לך? 💰';
    return 'מה ההכנסה החודשית? 💰';
  };

  const getDescription = () => {
    if (isEmployee) {
      if (employmentType === 'contractor') {
        return 'קבלן כוח אדם - יש לך תלוש משכורת אבל זכויות שונות';
      }
      return 'נצטרך כמה פרטים כדי לחשב הכל בצורה מדויקת';
    }
    if (isVATBusiness) return 'עוסק מורשה - ההכנסה שלך כוללת מע״ם 18%';
    if (isExemptBusiness) return 'עוסק פטור - ללא מע״ם, עד 100,000 ₪ בשנה';
    if (isHybrid) return 'חלק מהכנסה כשכיר + חלק כעצמאי';
    if (isAllowance) return 'קצבאות מביטוח לאומי בדרך כלל פטורות ממס';
    if (isCapitalIncome) return 'דיבידנדים ורווחי הון - מיסוי שונה';
    if (employmentType === 'rental') return 'סכום השכירות החודשי שמגיע לך';
    if (employmentType === 'investment') return 'דיבידנדים או ריבית חודשית';
    if (employmentType === 'pension') return 'הקצבה החודשית';
    return 'הסכום שבאמת מגיע לחשבון בכל חודש';
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{getTitle()}</h2>
        <p className="text-gray-600 text-sm">{getDescription()}</p>
        
        {isEmployee && (
          <div className="mt-3 text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
            💡 אם יש לך תלוש משכורת, נוכל למלא הכל אוטומטית!
        </div>
        )}
      </div>

      {/* שכיר - שדות מורכבים */}
      {isEmployee && (
        <div className="space-y-6">
          {/* שם מעסיק */}
          <div>
            <Label className="text-sm mb-2 block text-gray-700">שם המעסיק</Label>
            <Input
              value={localEmployer}
              onChange={(e) => {
                setLocalEmployer(e.target.value);
                onDataChange({ employer_name: e.target.value });
              }}
              placeholder="לדוגמה: חברת XYZ"
              className="text-lg p-4"
            />
      </div>

          {/* ברוטו */}
          <div>
            <Label className="text-sm mb-2 block text-gray-700 font-semibold">
              משכורת ברוטו (לפני ניכויים) *
            </Label>
          <div className="relative">
            <Input
              type="number"
                value={localGross}
                onChange={(e) => handleGrossChange(e.target.value)}
                placeholder="15,000"
                className="text-2xl font-bold p-6 text-center"
              autoFocus
            />
            <div className="absolute left-1/2 transform -translate-x-1/2 bottom-2 text-gray-400 text-sm">
              ₪
            </div>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              זה הסכום שרשום בחוזה העבודה
            </p>
          </div>

          {/* חישוב אוטומטי מפורט */}
          {grossAmount && grossAmount > 0 && (() => {
            const detailed = SmartIncomeCalculator.calculateDetailedBreakdown(
              grossAmount,
              employmentType,
              { hasPension: true, hasStudyFund: true }
            );
            if (!detailed) return null;

            return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-blue-50 via-green-50 to-purple-50 border-2 border-blue-200 rounded-xl p-5 space-y-4"
              >
                {/* כותרת */}
                <div className="flex items-center gap-2 border-b border-blue-200 pb-3">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-bold text-blue-900">חישוב ישראלי מדויק 2025</span>
                </div>

                {/* תקרות */}
                <div className="bg-white/60 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                    <span className="text-gray-600">תקרת ביטוח לאומי:</span>
                    <span className="font-semibold">{SmartIncomeCalculator.formatAmount(detailed.thresholds.nationalInsuranceCeiling)}</span>
                    </div>
                    <div className="flex justify-between">
                    <span className="text-gray-600">סף מופחת:</span>
                    <span className="font-semibold">{SmartIncomeCalculator.formatAmount(detailed.thresholds.nationalInsuranceThreshold)}</span>
                    </div>
                  {detailed.thresholds.isAboveNationalInsuranceCeiling && (
                    <div className="text-amber-600 text-xs mt-1">⚠️ המשכורת מעל התקרה</div>
                  )}
                  </div>

                {/* פירוט ניכויים */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-700">פירוט ניכויים:</div>
                  
                  {/* מס הכנסה */}
                  <details className="bg-white/70 rounded-lg p-3 cursor-pointer">
                    <summary className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">💰 מס הכנסה</span>
                      <span className="font-bold text-red-600">-{SmartIncomeCalculator.formatAmount(detailed.incomeTax.amount)}</span>
                    </summary>
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      {detailed.incomeTax.brackets.map((bracket, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>מדרגה {idx + 1} ({(bracket.rate * 100).toFixed(0)}%):</span>
                          <span>{SmartIncomeCalculator.formatAmount(bracket.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </details>

                  {/* ביטוח לאומי */}
                  <details className="bg-white/70 rounded-lg p-3 cursor-pointer">
                    <summary className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">🏥 ביטוח לאומי</span>
                      <span className="font-bold text-red-600">-{SmartIncomeCalculator.formatAmount(detailed.nationalInsurance.amount)}</span>
                    </summary>
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>עד סף (3.5%):</span>
                        <span>{SmartIncomeCalculator.formatAmount(detailed.nationalInsurance.lowerPart)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>מעל סף (7%):</span>
                        <span>{SmartIncomeCalculator.formatAmount(detailed.nationalInsurance.upperPart)}</span>
                      </div>
                    </div>
                  </details>

                  {/* מס בריאות */}
                  <details className="bg-white/70 rounded-lg p-3 cursor-pointer">
                    <summary className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">⚕️ מס בריאות</span>
                      <span className="font-bold text-red-600">-{SmartIncomeCalculator.formatAmount(detailed.healthTax.amount)}</span>
                    </summary>
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>עד סף (3.1%):</span>
                        <span>{SmartIncomeCalculator.formatAmount(detailed.healthTax.lowerPart)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>מעל סף (5%):</span>
                        <span>{SmartIncomeCalculator.formatAmount(detailed.healthTax.upperPart)}</span>
                      </div>
                    </div>
                  </details>
                </div>

                {/* נטו משכורת */}
                <div className="flex justify-between items-center p-3 bg-white/80 rounded-lg border border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">נטו משכורת:</span>
                  <span className="text-xl font-bold text-gray-900">{SmartIncomeCalculator.formatAmount(detailed.net)}</span>
                </div>

                {/* פנסיה וקה&quot;ש */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg text-xs">
                    <span className="text-gray-600">🏦 פנסיה עובד (6%):</span>
                    <span className="font-medium text-red-600">-{SmartIncomeCalculator.formatAmount(detailed.pension.employee)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg text-xs">
                    <span className="text-gray-600">📚 קרן השתלמות (2.5%):</span>
                    <span className="font-medium text-red-600">-{SmartIncomeCalculator.formatAmount(detailed.studyFund.employee)}</span>
                  </div>
                </div>

                {/* סכום בנק סופי */}
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl border-2 border-green-300">
                  <span className="text-base font-bold text-green-900">💵 נכנס לחשבון:</span>
                  <span className="text-2xl font-black text-green-700">{SmartIncomeCalculator.formatAmount(detailed.actualBank)}</span>
                </div>

                {/* הפרשות מעסיק (מידע) */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs space-y-1">
                  <div className="font-semibold text-purple-900 mb-1">💡 הפרשות מעסיק (לא נוכות ממך):</div>
                  <div className="flex justify-between text-purple-700">
                    <span>פנסיה מעסיק (6.5%):</span>
                    <span className="font-medium">+{SmartIncomeCalculator.formatAmount(detailed.pension.employer)}</span>
                  </div>
                  <div className="flex justify-between text-purple-700">
                    <span>קה&quot;ש מעסיק (7.5%):</span>
                    <span className="font-medium">+{SmartIncomeCalculator.formatAmount(detailed.studyFund.employer)}</span>
                </div>
              </div>
            </motion.div>
            );
          })()}

          {/* אופציה למלא סכום בנק ידני */}
          {!grossAmount && (
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">או, אם אתה לא יודע את הברוטו:</p>
              <div>
                <Label className="text-sm mb-2 block text-gray-700">סכום שנכנס לבנק</Label>
                <div className="relative max-w-xs mx-auto">
                  <Input
                    type="number"
                    value={localBank}
                    onChange={(e) => handleBankChange(e.target.value)}
                    placeholder="12,000"
                    className="text-xl font-bold p-5 text-center"
                  />
                  <div className="absolute left-1/2 transform -translate-x-1/2 bottom-1 text-gray-400 text-xs">
                    ₪
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* עצמאי/פרילנסר - סכום + אופציה למשתנה */}
      {(employmentType === 'self_employed' || employmentType === 'freelance' || employmentType === 'business') && (
        <div className="space-y-6">
          {/* שאלה על מע"מ - לעצמאי שעדיין לא מוגדר */}
          {!isVATBusiness && !isExemptBusiness && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-amber-900 mb-2">❓ האם אתה רשום כעוסק מורשה (עם מע״ם)?</p>
              <p className="text-amber-700 text-xs mb-3">
                אם אתה מדווח ומשלם מע״מ 18%, בחר &quot;עוסק מורשה&quot; בשלב הראשון
              </p>
              <div className="flex items-center gap-2 bg-amber-100 border border-amber-300 rounded-lg p-2">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={includesVAT}
                    onChange={(e) => setIncludesVAT(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-amber-900 font-medium text-xs">הסכום שאני מזין כולל מע״ם 18%</span>
                </label>
              </div>
            </div>
          )}

          {/* הכנסה משתנה Toggle */}
          <div className="flex items-center justify-center gap-2 text-sm bg-purple-50 border border-purple-100 rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVariable}
                onChange={(e) => onDataChange({ is_variable: e.target.checked })}
                className="rounded"
              />
              <span className="text-gray-700 font-medium">ההכנסה שלי משתנה מחודש לחודש</span>
            </label>
          </div>

          {!isVariable ? (
            <div>
              <Label className="text-sm mb-2 block text-gray-700 font-semibold">
                הכנסה חודשית ממוצעת
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={localBank}
                  onChange={(e) => handleBankChange(e.target.value)}
                  placeholder="10,000"
                  className="text-3xl font-bold p-8 text-center"
                  autoFocus
                />
                <div className="absolute left-1/2 transform -translate-x-1/2 bottom-2 text-gray-400 text-sm">
                  ₪
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                הסכום שבדרך כלל נכנס לך לחשבון
              </p>
            </div>
      ) : (
        <div className="space-y-4">
              <Label className="text-sm block text-gray-700 font-semibold text-center">
                מה הטווח שלך?
              </Label>
          <div className="grid grid-cols-2 gap-4">
            <div>
                  <Label className="text-sm mb-2 block text-gray-600">מינימום</Label>
              <Input
                type="number"
                value={minAmount?.toString() || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                      onDataChange({ min_amount: !isNaN(val) ? val : null });
                }}
                    placeholder="5,000"
                className="text-lg p-4"
              />
            </div>
            <div>
                  <Label className="text-sm mb-2 block text-gray-600">מקסימום</Label>
              <Input
                type="number"
                value={maxAmount?.toString() || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                      onDataChange({ max_amount: !isNaN(val) ? val : null });
                }}
                    placeholder="15,000"
                className="text-lg p-4"
              />
            </div>
          </div>

              {minAmount && maxAmount && minAmount > 0 && maxAmount > 0 && (
                <div className="text-center bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-sm text-gray-600">ממוצע חודשי:</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {SmartIncomeCalculator.formatAmount((minAmount + maxAmount) / 2)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* עוסק מורשה - עם מע"מ */}
      {isVATBusiness && (
        <div className="space-y-6">
          {/* אזהרה על מע"מ */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 text-lg">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold text-yellow-900 mb-1">עוסק מורשה - שים לב למע״ם!</p>
                <p className="text-yellow-700 text-xs">מע״מ בישראל הוא 18% - זה לא רווח שלך, אלא מס שתעביר למדינה</p>
              </div>
            </div>
          </div>

          {/* Toggle האם כולל מע"מ */}
          <div className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includesVAT}
                onChange={(e) => setIncludesVAT(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-700 font-medium text-sm">הסכום כולל מע״ם</span>
            </label>
          </div>

          {/* שדה סכום */}
          <div>
            <Label className="text-sm mb-2 block text-gray-700 font-semibold text-center">
              {includesVAT ? 'סכום כולל מע״ם' : 'סכום לפני מע״ם'}
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={localBank}
                onChange={(e) => {
                  handleBankChange(e.target.value);
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num) && num > 0 && includesVAT) {
                    const calc = calculateVAT(num);
                    onDataChange({ 
                      actual_bank_amount: calc.withoutVAT,
                      gross_amount: num
                    });
                  }
                }}
                placeholder={includesVAT ? "11,800" : "10,000"}
                className="text-3xl font-bold p-8 text-center"
                autoFocus
              />
              <div className="absolute left-1/2 transform -translate-x-1/2 bottom-2 text-gray-400 text-sm">
                ₪
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {includesVAT ? 'הסכום שקיבלת מהלקוח' : 'ההכנסה הנקייה שלך'}
            </p>
          </div>

          {/* חישוב מע"מ אוטומטי */}
          {includesVAT && actualBankAmount && actualBankAmount > 0 && (() => {
            const vatCalc = calculateVAT(actualBankAmount);
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center gap-2 border-b border-emerald-200 pb-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-900">חישוב מע״ם אוטומטי</span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                    <span className="text-gray-700">סכום שקיבלת:</span>
                    <span className="font-bold text-gray-900">{SmartIncomeCalculator.formatAmount(actualBankAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                    <span className="text-gray-700">לפני מע״ם (÷1.18):</span>
                    <span className="font-bold text-emerald-700">{SmartIncomeCalculator.formatAmount(vatCalc.withoutVAT)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                    <span className="text-gray-700">מע״ם (18%):</span>
                    <span className="font-bold text-red-600">{SmartIncomeCalculator.formatAmount(vatCalc.vat)}</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  💡 זה הסכום שתצטרך לדווח בדוח החודשי/דו-חודשי למע״ם
                </div>
              </motion.div>
            );
          })()}

          {/* Toggle הכנסה משתנה */}
          <div className="flex items-center justify-center gap-2 text-sm bg-purple-50 border border-purple-100 rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVariable}
                onChange={(e) => onDataChange({ is_variable: e.target.checked })}
                className="rounded"
              />
              <span className="text-gray-700 font-medium">ההכנסה שלי משתנה מחודש לחודש</span>
            </label>
          </div>

          {/* אזהרה על ביטוח לאומי */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs">
            <p className="font-semibold text-orange-900 mb-1">📊 חשוב לדעת:</p>
            <ul className="text-orange-700 space-y-1 mr-4">
              <li>• ביטוח לאומי עצמאי: 17.83% (גבוה יותר משכיר!)</li>
              <li>• אין ניכוי במקור - תשלם מס בדוח שנתי</li>
              <li>• מומלץ לשמור 30-40% מההכנסה למס וביטוח לאומי</li>
            </ul>
          </div>
        </div>
      )}

      {/* עוסק פטור - ללא מע"מ */}
      {isExemptBusiness && (
        <div className="space-y-6">
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm">
            <p className="font-semibold text-teal-900 mb-1">✓ עוסק פטור מע״ם</p>
            <p className="text-teal-700 text-xs">
              פטור ממע״ם עד 100,000 ₪ בשנה (~8,300 ₪ לחודש). מעל זה - חייב להירשם כעוסק מורשה
            </p>
          </div>

          <div>
            <Label className="text-sm mb-2 block text-gray-700 font-semibold text-center">
              הכנסה חודשית ממוצעת
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={localBank}
                onChange={(e) => handleBankChange(e.target.value)}
                placeholder="7,000"
                className="text-3xl font-bold p-8 text-center"
                autoFocus
              />
              <div className="absolute left-1/2 transform -translate-x-1/2 bottom-2 text-gray-400 text-sm">
                ₪
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              הסכום הנקי שנכנס לך (ללא מע״ם)
            </p>
          </div>

          {/* Toggle הכנסה משתנה */}
          <div className="flex items-center justify-center gap-2 text-sm bg-purple-50 border border-purple-100 rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVariable}
                onChange={(e) => onDataChange({ is_variable: e.target.checked })}
                className="rounded"
              />
              <span className="text-gray-700 font-medium">ההכנסה שלי משתנה</span>
            </label>
          </div>
        </div>
      )}

      {/* היברידי - שכיר + עצמאי */}
      {isHybrid && (
        <div className="space-y-6">
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-sm">
            <p className="font-semibold text-violet-900 mb-1">🔀 הכנסה משולבת</p>
            <p className="text-violet-700 text-xs">
              חלק מהכנסה כשכיר (עם ניכויי מס אוטומטיים) + חלק כעצמאי (ללא ניכוי במקור)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* חלק שכיר */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <Label className="text-sm mb-2 block text-blue-900 font-semibold">💼 חלק שכיר</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={hybridSalaryPart}
                  onChange={(e) => {
                    setHybridSalaryPart(e.target.value);
                    const num = parseFloat(e.target.value);
                    if (!isNaN(num)) {
                      onDataChange({ gross_amount: num });
                    }
                  }}
                  placeholder="12,000"
                  className="text-xl font-bold p-4 text-center"
                />
                <div className="absolute left-1/2 transform -translate-x-1/2 bottom-1 text-gray-400 text-xs">
                  ₪
                </div>
              </div>
              <p className="text-xs text-blue-700 mt-1 text-center">ברוטו משכורת</p>
            </div>

            {/* חלק עצמאי */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <Label className="text-sm mb-2 block text-green-900 font-semibold">💰 חלק עצמאי</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={hybridFreelancePart}
                  onChange={(e) => {
                    setHybridFreelancePart(e.target.value);
                    const num = parseFloat(e.target.value);
                    if (!isNaN(num)) {
                      onDataChange({ net_amount: num });
                    }
                  }}
                  placeholder="6,000"
                  className="text-xl font-bold p-4 text-center"
                />
                <div className="absolute left-1/2 transform -translate-x-1/2 bottom-1 text-gray-400 text-xs">
                  ₪
                </div>
              </div>
              <p className="text-xs text-green-700 mt-1 text-center">הכנסה חודשית</p>
            </div>
          </div>

          {/* סיכום משולב */}
          {hybridSalaryPart && hybridFreelancePart && (() => {
            const salary = parseFloat(hybridSalaryPart);
            const freelance = parseFloat(hybridFreelancePart);
            if (isNaN(salary) || isNaN(freelance)) return null;
            
            const total = salary + freelance;
            const salaryPercent = ((salary / total) * 100).toFixed(0);
            const freelancePercent = ((freelance / total) * 100).toFixed(0);

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-blue-50 via-violet-50 to-green-50 border-2 border-violet-200 rounded-xl p-4"
              >
                <p className="text-sm font-semibold text-violet-900 mb-3 text-center">סיכום משולב:</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg text-sm">
                    <span className="text-gray-700">↳ משכורת (שכיר):</span>
                    <span className="font-bold text-blue-700">{SmartIncomeCalculator.formatAmount(salary)} ({salaryPercent}%)</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg text-sm">
                    <span className="text-gray-700">↳ פרילנס (עצמאי):</span>
                    <span className="font-bold text-green-700">{SmartIncomeCalculator.formatAmount(freelance)} ({freelancePercent}%)</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/80 rounded-lg border-2 border-violet-300">
                    <span className="text-sm font-bold text-gray-900">סה״כ הכנסה:</span>
                    <span className="text-xl font-black text-violet-700">{SmartIncomeCalculator.formatAmount(total)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </div>
      )}

      {/* קצבה - פטורה ממס */}
      {isAllowance && (
        <div className="space-y-6">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm">
            <p className="font-semibold text-rose-900 mb-1">🏥 קצבה מביטוח לאומי</p>
            <p className="text-rose-700 text-xs">
              קצבאות אבטלה, נכות וזקנה בדרך כלל פטורות ממס הכנסה
            </p>
          </div>

          <div>
            <Label className="text-sm mb-2 block text-gray-700 font-semibold text-center">
              סכום קצבה חודשי
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={localBank}
                onChange={(e) => handleBankChange(e.target.value)}
                placeholder="5,000"
                className="text-3xl font-bold p-8 text-center"
                autoFocus
              />
              <div className="absolute left-1/2 transform -translate-x-1/2 bottom-2 text-gray-400 text-sm">
                ₪
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              הסכום הקבוע שמגיע לך מהביטוח הלאומי
            </p>
          </div>
        </div>
      )}

      {/* הכנסה מהון - דיבידנדים/מניות */}
      {isCapitalIncome && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p className="font-semibold text-blue-900 mb-1">📈 הכנסה מהון</p>
            <p className="text-blue-700 text-xs">
              דיבידנדים ורווחי הון חייבים במס שונה - בדרך כלל 25-30%
            </p>
          </div>

          {/* Toggle מס נוכה */}
          <div className="flex items-center justify-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={taxPaid}
                onChange={(e) => setTaxPaid(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-700 font-medium text-sm">המס כבר נוכה (ניכוי במקור 25%)</span>
            </label>
          </div>

          <div>
            <Label className="text-sm mb-2 block text-gray-700 font-semibold text-center">
              {taxPaid ? 'סכום נטו אחרי מס' : 'סכום ברוטו לפני מס'}
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={localBank}
                onChange={(e) => handleBankChange(e.target.value)}
                placeholder="10,000"
                className="text-3xl font-bold p-8 text-center"
                autoFocus
              />
              <div className="absolute left-1/2 transform -translate-x-1/2 bottom-2 text-gray-400 text-sm">
                ₪
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {taxPaid ? 'הסכום שבאמת קיבלת' : 'סך כל רווחי ההון'}
            </p>
          </div>
        </div>
      )}

      {/* הכנסות פשוטות - רק סכום */}
      {isSimpleIncome && (
        <div>
          <div className="relative">
            <Input
              type="number"
              value={localBank}
              onChange={(e) => handleBankChange(e.target.value)}
              placeholder="5,000"
              className="text-3xl font-bold p-8 text-center"
              autoFocus
            />
            <div className="absolute left-1/2 transform -translate-x-1/2 bottom-2 text-gray-400 text-sm">
              ₪
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            הסכום החודשי הממוצע
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button onClick={onBack} variant="outline" className="flex-1">
          <ArrowRight className="w-4 h-4 ml-2" />
          חזור
        </Button>
        <Button
          onClick={onNext}
          disabled={!canProceed()}
          className="flex-1 bg-phi-dark hover:bg-[#2E6BB7]"
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
                  ? 'border-[#3A7BD5] bg-phi-dark/10 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon className={`w-6 h-6 ${isSelected ? 'text-phi-dark' : 'text-gray-400'}`} />
              <span className={`text-lg font-medium ${isSelected ? 'text-phi-dark' : 'text-gray-700'}`}>
                {option.label}
              </span>
              {isSelected && <CheckCircle className="w-6 h-6 text-phi-mint mr-auto" />}
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
  editMode,
}: {
  data: WizardData;
  calculatedData: any;
  onChange: (data: WizardData) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  editMode?: boolean;
}) {
  const employmentLabel = EMPLOYMENT_TYPES.find((t) => t.value === data.employment_type)?.label;
  const frequencyLabel = FREQUENCY_OPTIONS.find((f) => f.value === data.payment_frequency)?.label;
  const isEmployee = data.employment_type === 'employee' || data.employment_type === 'contractor';
  const isVATBusiness = data.employment_type === 'licensed_business';
  const isExemptBusiness = data.employment_type === 'exempt_business';
  const isHybrid = data.employment_type === 'hybrid';
  const isAllowance = data.employment_type === 'allowance';
  const isCapitalIncome = data.employment_type === 'capital_income';
  const isVariableIncome = ['self_employed', 'freelance', 'business'].includes(data.employment_type);

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

        {/* שכיר/קבלן - תלוש משכורת מדומה */}
        {isEmployee && data.gross_amount && data.gross_amount > 0 && (() => {
          const detailed = SmartIncomeCalculator.calculateDetailedBreakdown(
            data.gross_amount,
            data.employment_type,
            { hasPension: true, hasStudyFund: true }
          );
          if (!detailed) return null;

          return (
            <div className="bg-white border-2 border-gray-300 rounded-lg p-4 text-xs font-mono mt-4">
              <div className="border-b-2 border-gray-400 pb-2 mb-3">
                <div className="text-center font-bold text-sm mb-1">תלוש משכורת</div>
                {data.employer_name && <div className="text-center text-gray-600">{data.employer_name}</div>}
                <div className="text-center text-gray-500">תקופה: חודשי</div>
        </div>

              <div className="space-y-1">
                <div className="flex justify-between font-bold border-b border-gray-300 pb-1">
                  <span>ברוטו למס:</span>
                  <span>{SmartIncomeCalculator.formatAmount(data.gross_amount)}</span>
        </div>

                <div className="text-gray-600 mt-2 mb-1 font-semibold">ניכויים:</div>
                <div className="flex justify-between text-red-600 mr-2">
                  <span>מס הכנסה</span>
                  <span>-{SmartIncomeCalculator.formatAmount(detailed.incomeTax.amount)}</span>
              </div>
                <div className="flex justify-between text-red-600 mr-2">
                  <span>ביטוח לאומי</span>
                  <span>-{SmartIncomeCalculator.formatAmount(detailed.nationalInsurance.amount)}</span>
              </div>
                <div className="flex justify-between text-red-600 mr-2">
                  <span>מס בריאות</span>
                  <span>-{SmartIncomeCalculator.formatAmount(detailed.healthTax.amount)}</span>
                </div>
                
                <div className="flex justify-between font-bold border-t border-b border-gray-300 py-1 mt-1">
                  <span>נטו משכורת:</span>
                  <span>{SmartIncomeCalculator.formatAmount(detailed.net)}</span>
                </div>

                <div className="text-gray-600 mt-2 mb-1 font-semibold text-[10px]">הפרשות מעסיק:</div>
                <div className="flex justify-between text-green-600 mr-2">
                  <span>פנסיה (6.5%)</span>
                  <span>+{SmartIncomeCalculator.formatAmount(detailed.pension.employer)}</span>
                </div>
                <div className="flex justify-between text-green-600 mr-2">
                  <span>פיצויים (8.33%)</span>
                  <span>+{SmartIncomeCalculator.formatAmount(Math.round(data.gross_amount * 0.0833))}</span>
                </div>

                <div className="text-gray-600 mt-2 mb-1 font-semibold">ניכויים נוספים:</div>
                <div className="flex justify-between text-red-600 mr-2">
                  <span>פנסיה עובד (6%)</span>
                  <span>-{SmartIncomeCalculator.formatAmount(detailed.pension.employee)}</span>
                </div>
                <div className="flex justify-between text-red-600 mr-2">
                  <span>קרן השתלמות (2.5%)</span>
                  <span>-{SmartIncomeCalculator.formatAmount(detailed.studyFund.employee)}</span>
                </div>

                <div className="flex justify-between font-bold border-t-2 border-gray-400 pt-1 mt-2 text-green-700 text-sm">
                  <span>נכנס לחשבון:</span>
                  <span>{SmartIncomeCalculator.formatAmount(detailed.actualBank)}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* עצמאי/פרילנסר/עוסקים - אזהרה חשובה */}
        {(isVariableIncome || isVATBusiness || isExemptBusiness) && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="font-bold text-orange-900 mb-2">חשוב לעצמאים!</p>
                <ul className="text-sm text-orange-800 space-y-1 mr-4">
                  <li>• ביטוח לאומי עצמאי: <strong>17.83%</strong> (גבוה משכיר!)</li>
                  <li>• אין ניכוי מס במקור - תשלם בדוח שנתי</li>
                  <li>• מומלץ <strong>לשמור 30-40%</strong> מההכנסה למס וביטוח</li>
                  {isVATBusiness && <li>• מע״מ 18% - זה <strong>לא רווח שלך</strong>, תעביר למדינה</li>}
                  <li>• שקול להתייעץ עם רואה חשבון</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* עצמאי/פרילנסר - הכנסה משתנה או קבועה */}
        {(data.employment_type === 'self_employed' || data.employment_type === 'freelance' || data.employment_type === 'business') && (
          <>
            {data.is_variable ? (
              <>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-gray-600">טווח הכנסה:</span>
                  <span className="font-semibold">משתנה</span>
              </div>
                {data.min_amount && data.max_amount && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">מינימום:</span>
                      <span className="font-medium">{SmartIncomeCalculator.formatAmount(data.min_amount)}</span>
              </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">מקסימום:</span>
                      <span className="font-medium">{SmartIncomeCalculator.formatAmount(data.max_amount)}</span>
            </div>
                    <div className="flex justify-between items-center bg-white/60 rounded-lg p-3 -mx-2">
                      <span className="text-gray-700 font-medium">ממוצע חודשי:</span>
                      <span className="font-bold text-2xl text-phi-dark">
                        {SmartIncomeCalculator.formatAmount((data.min_amount + data.max_amount) / 2)}
                      </span>
          </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex justify-between items-center bg-white/60 rounded-lg p-3 -mx-2">
                <span className="text-gray-700 font-medium">הכנסה חודשית:</span>
                <span className="font-bold text-2xl text-phi-dark">
                  {SmartIncomeCalculator.formatAmount(data.actual_bank_amount)}
                </span>
              </div>
            )}
          </>
        )}

        {/* הכנסות פשוטות */}
        {['rental', 'investment', 'pension', 'other'].includes(data.employment_type) && (
          <div className="flex justify-between items-center bg-white/60 rounded-lg p-3 -mx-2">
            <span className="text-gray-700 font-medium">סכום חודשי:</span>
            <span className="font-bold text-2xl text-phi-dark">
              {SmartIncomeCalculator.formatAmount(data.actual_bank_amount)}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <span className="text-gray-600">תדירות:</span>
          <span className="font-semibold">{frequencyLabel}</span>
        </div>
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
          className="flex-1 bg-phi-mint hover:bg-phi-mint/90 text-white"
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

