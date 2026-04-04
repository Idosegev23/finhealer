'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Home, Shield, Smartphone, Car, Baby, Heart, Tv, Zap, 
  Save, ArrowRight, ArrowLeft, Loader2, ChevronDown, 
  ChevronUp, CheckCircle, AlertCircle, TrendingUp
} from 'lucide-react';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/toaster';

interface SmartExpensesFormProps {
  initialData: any;
}

const STEPS = [
  { 
    id: 1, 
    key: 'housing', 
    title: 'דיור', 
    icon: Home,
    color: 'from-blue-500 to-blue-600',
    fields: ['rent_mortgage', 'building_maintenance', 'property_tax']
  },
  { 
    id: 2, 
    key: 'insurance', 
    title: 'ביטוחים', 
    icon: Shield,
    color: 'from-orange-500 to-orange-600',
    fields: ['life_insurance', 'health_insurance', 'car_insurance', 'home_insurance']
  },
  { 
    id: 3, 
    key: 'communication', 
    title: 'תקשורת', 
    icon: Smartphone,
    color: 'from-green-500 to-green-600',
    fields: ['cellular', 'internet', 'tv_cable']
  },
  { 
    id: 4, 
    key: 'transport', 
    title: 'רכב ותחבורה', 
    icon: Car,
    color: 'from-red-500 to-red-600',
    fields: ['leasing', 'fuel', 'parking', 'public_transport']
  },
  { 
    id: 5, 
    key: 'children', 
    title: 'ילדים וחינוך', 
    icon: Baby,
    color: 'from-purple-500 to-purple-600',
    fields: ['daycare', 'afterschool', 'tuition', 'extracurricular', 'babysitter']
  },
  { 
    id: 6, 
    key: 'health', 
    title: 'בריאות ורווחה', 
    icon: Heart,
    color: 'from-cyan-500 to-cyan-600',
    fields: ['gym', 'therapy', 'medication']
  },
  { 
    id: 7, 
    key: 'subscriptions', 
    title: 'מנויים', 
    icon: Tv,
    color: 'from-yellow-500 to-yellow-600',
    fields: ['streaming', 'digital_services']
  },
  { 
    id: 8, 
    key: 'utilities', 
    title: 'חשמל מים וגז', 
    icon: Zap,
    color: 'from-pink-500 to-pink-600',
    fields: ['electricity', 'water', 'gas']
  },
];

const FIELD_CONFIG: Record<string, any> = {
  // דיור
  rent_mortgage: { label: 'שכר דירה / משכנתא', tooltip: 'התשלום החודשי למשכנתא או שכירות', required: true },
  building_maintenance: { label: 'דמי ניהול / ועד בית', tooltip: 'דמי ניהול, ועד בית או דמי ביוב' },
  property_tax: { label: 'ארנונה', tooltip: 'ארנונה חודשית ממוצעת', required: true },
  
  // ביטוחים
  life_insurance: { label: 'ביטוח חיים', tooltip: 'ביטוח חיים למקרה מוות (חלילה)' },
  health_insurance: { label: 'ביטוח בריאות', tooltip: 'ביטוח בריאות משלים או פרטי' },
  car_insurance: { 
    label: 'ביטוח רכב',
    tooltip: 'ביטוח רכב מפורט - חובה, מקיף, צד ג׳',
    detailed: true,
    subfields: {
      has_car: { type: 'checkbox', label: 'יש לי רכב' },
      insurance_type: { 
        type: 'radio', 
        label: 'סוג ביטוח',
        options: [
          { value: 'mandatory', label: 'חובה בלבד' },
          { value: 'comprehensive', label: 'מקיף' },
          { value: 'third_party', label: 'צד ג׳ מורחב' }
        ]
      },
      has_towing: { type: 'checkbox', label: 'כולל גרר' },
      has_windshield: { type: 'checkbox', label: 'כולל שמשות' },
      monthly_cost: { type: 'number', label: 'עלות חודשית', tooltip: 'העלות החודשית הממוצעת' }
    }
  },
  home_insurance: { label: 'ביטוח דירה', tooltip: 'ביטוח תכולה ומבנה' },
  
  // תקשורת
  cellular: { label: 'סלולר', tooltip: 'חבילת סלולר חודשית', required: true },
  internet: { label: 'אינטרנט', tooltip: 'אינטרנט ביתי' },
  tv_cable: { label: 'טלוויזיה / כבלים', tooltip: 'yes/hot או סטרימינג' },
  
  // רכב ותחבורה
  leasing: { label: 'ליסינג / החזר הלוואה', tooltip: 'תשלום חודשי על ליסינג או הלוואה' },
  fuel: { label: 'דלק', tooltip: 'דלק חודשי ממוצע' },
  parking: { label: 'חניה', tooltip: 'חניה חודשית קבועה' },
  public_transport: { label: 'תחבורה ציבורית', tooltip: 'חופשי חודשי או נסיעות' },
  
  // ילדים וחינוך
  daycare: { label: 'מעון / גן', tooltip: 'שכר לימוד חודשי למעון או גן' },
  afterschool: { label: 'צהרון', tooltip: 'צהרון חודשי' },
  tuition: { label: 'שכר לימוד', tooltip: 'שכר לימוד לבי"ס פרטי' },
  extracurricular: { label: 'חוגים', tooltip: 'חוגי העשרה לילדים' },
  babysitter: { label: 'בייביסיטר', tooltip: 'בייביסיטר חודשי קבוע' },
  
  // בריאות ורווחה
  gym: { label: 'חדר כושר', tooltip: 'מנוי חודשי לחדר כושר' },
  therapy: { label: 'טיפולים', tooltip: 'טיפולים רפואיים או פארא-רפואיים' },
  medication: { label: 'תרופות', tooltip: 'תרופות חודשיות קבועות' },
  
  // מנויים
  streaming: { label: 'שירותי סטרימינג', tooltip: 'Netflix, Spotify, וכו' },
  digital_services: { label: 'שירותים דיגיטליים', tooltip: 'iCloud, Dropbox, וכו' },
  
  // חשמל מים וגז
  electricity: { label: 'חשמל', tooltip: 'חשבון חשמל חודשי ממוצע', required: true },
  water: { label: 'מים', tooltip: 'חשבון מים דו-חודשי חלקי 2' },
  gas: { label: 'גז', tooltip: 'גז בישול (אם יש)' },
};

export default function SmartExpensesForm({ initialData }: SmartExpensesFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [expenses, setExpenses] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    Object.keys(FIELD_CONFIG).forEach(key => {
      initial[key] = initialData[key] || (FIELD_CONFIG[key].detailed ? {} : 0);
    });
    return initial;
  });
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const currentStepData = STEPS[currentStep - 1];
  const progress = (completedSteps.length / STEPS.length) * 100;

  const updateExpense = (key: string, value: any) => {
    setExpenses(prev => ({ ...prev, [key]: value }));
  };

  const calculateTotal = () => {
    let total = 0;
    Object.keys(expenses).forEach(key => {
      const config = FIELD_CONFIG[key];
      if (config?.detailed) {
        // For detailed fields like car_insurance
        if (expenses[key]?.monthly_cost) {
          total += parseFloat(expenses[key].monthly_cost) || 0;
        }
      } else {
        total += parseFloat(expenses[key]) || 0;
      }
    });
    return total;
  };

  const calculateStepTotal = (stepKey: string) => {
    const step = STEPS.find(s => s.key === stepKey);
    if (!step) return 0;
    
    let total = 0;
    step.fields.forEach(field => {
      const config = FIELD_CONFIG[field];
      if (config?.detailed) {
        if (expenses[field]?.monthly_cost) {
          total += parseFloat(expenses[field].monthly_cost) || 0;
        }
      } else {
        total += parseFloat(expenses[field]) || 0;
      }
    });
    return total;
  };

  const isStepValid = () => {
    const step = STEPS[currentStep - 1];
    for (const field of step.fields) {
      const config = FIELD_CONFIG[field];
      if (config?.required) {
        if (config.detailed) {
          // Check if detailed field has required data
          if (!expenses[field]?.monthly_cost && expenses[field]?.has_car) {
            return false;
          }
        } else {
          if (!expenses[field] || expenses[field] === 0) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleNext = async () => {
    // Auto-save current step
    await autoSave();
    
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final save
      await handleFinalSave();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const autoSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/reflection/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenses)
      });
    } catch (error) {
      console.error('Auto-save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalSave = async () => {
    setLoading(true);
    try {
      const totalFixed = calculateTotal();
      
      const response = await fetch('/api/reflection/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenses,
          total_fixed_expenses: totalFixed,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save expenses');
      }

      // Mark section as completed
      await fetch('/api/user/section/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subsection: 'expenses' })
      });

      setSuccessMessage('🎉 כל הנתונים נשמרו בהצלחה!');
      
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);

    } catch (error) {
      console.error('Error saving expenses:', error);
      addToast({ title: 'אירעה שגיאה בשמירת הנתונים', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const renderCarInsuranceFields = () => {
    const carData = expenses.car_insurance || {};
    
    return (
      <div className="space-y-4 p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-blue-200">
        {/* Has Car Checkbox */}
        <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg">
          <Checkbox
            id="has_car"
            checked={carData.has_car || false}
            onCheckedChange={(checked) => {
              updateExpense('car_insurance', { ...carData, has_car: checked });
            }}
          />
          <Label htmlFor="has_car" className="text-lg font-bold cursor-pointer">
            יש לי רכב 🚗
          </Label>
        </div>

        <AnimatePresence>
          {carData.has_car && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              {/* Insurance Type */}
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                <Label className="text-base font-bold mb-3 block">סוג ביטוח רכב</Label>
                <RadioGroup
                  value={carData.insurance_type || ''}
                  onValueChange={(value: string) => {
                    updateExpense('car_insurance', { ...carData, insurance_type: value });
                  }}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition-colors">
                      <RadioGroupItem value="mandatory" id="mandatory" />
                      <Label htmlFor="mandatory" className="cursor-pointer flex-1">
                        <span className="font-semibold">חובה בלבד</span>
                        <span className="text-sm text-gray-500 block">ביטוח מינימלי חובה על פי חוק</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition-colors">
                      <RadioGroupItem value="comprehensive" id="comprehensive" />
                      <Label htmlFor="comprehensive" className="cursor-pointer flex-1">
                        <span className="font-semibold">מקיף</span>
                        <span className="text-sm text-gray-500 block">כיסוי מלא - נזקים, גניבה, אובדן</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition-colors">
                      <RadioGroupItem value="third_party" id="third_party" />
                      <Label htmlFor="third_party" className="cursor-pointer flex-1">
                        <span className="font-semibold">צד ג׳ מורחב</span>
                        <span className="text-sm text-gray-500 block">כיסוי לנזקי צד ג׳ + נזקי טבע</span>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Additional Coverage */}
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg space-y-3">
                <Label className="text-base font-bold mb-3 block">כיסויים נוספים</Label>
                
                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <Checkbox
                    id="has_towing"
                    checked={carData.has_towing || false}
                    onCheckedChange={(checked) => {
                      updateExpense('car_insurance', { ...carData, has_towing: checked });
                    }}
                  />
                  <Label htmlFor="has_towing" className="cursor-pointer flex-1">
                    <span className="font-semibold">גרר 🚗💨</span>
                    <span className="text-sm text-gray-500 block">שירות גרירה במקרה תקלה</span>
                  </Label>
                </div>

                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <Checkbox
                    id="has_windshield"
                    checked={carData.has_windshield || false}
                    onCheckedChange={(checked) => {
                      updateExpense('car_insurance', { ...carData, has_windshield: checked });
                    }}
                  />
                  <Label htmlFor="has_windshield" className="cursor-pointer flex-1">
                    <span className="font-semibold">שמשות 🪟</span>
                    <span className="text-sm text-gray-500 block">כיסוי להחלפת שמשות</span>
                  </Label>
                </div>
              </div>

              {/* Monthly Cost */}
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                <Label htmlFor="car_monthly_cost" className="text-base font-bold mb-2 block flex items-center gap-2">
                  עלות חודשית
                  <InfoTooltip content="הסכום החודשי הממוצע שאתה משלם לביטוח הרכב" />
                </Label>
                <div className="relative">
                  <Input
                    id="car_monthly_cost"
                    type="number"
                    value={carData.monthly_cost || ''}
                    onChange={(e) => {
                      updateExpense('car_insurance', { ...carData, monthly_cost: e.target.value });
                    }}
                    placeholder="0"
                    className="text-left pr-10 text-lg font-semibold"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₪</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderField = (fieldKey: string) => {
    const config = FIELD_CONFIG[fieldKey];
    
    if (config.detailed && fieldKey === 'car_insurance') {
      return renderCarInsuranceFields();
    }

    return (
      <div key={fieldKey}>
        <Label htmlFor={fieldKey} className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-2">
          {config.label}
          {config.tooltip && <InfoTooltip content={config.tooltip} />}
          {config.required && <span className="text-red-500">*</span>}
        </Label>
        <div className="relative">
          <Input
            id={fieldKey}
            type="number"
            value={expenses[fieldKey] || ''}
            onChange={(e) => updateExpense(fieldKey, parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="text-left pr-10 text-lg"
            required={config.required}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₪</span>
        </div>
      </div>
    );
  };

  const StepIcon = currentStepData.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
      {/* Header with Progress */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center`}>
              <StepIcon className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black">{currentStepData.title}</h2>
              <p className="text-blue-100">שלב {currentStep} מתוך {STEPS.length}</p>
            </div>
          </div>
          {saving && (
            <div className="flex items-center gap-2 text-sm bg-white/20 px-4 py-2 rounded-full">
              <Loader2 className="w-4 h-4 animate-spin" />
              שומר...
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>התקדמות</span>
            <span className="font-bold">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3 bg-white/20" />
        </div>

        {/* Step Total */}
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="flex justify-between items-center">
            <span className="text-lg">סה&quot;כ {currentStepData.title}:</span>
            <span className="text-3xl font-black">
              {calculateStepTotal(currentStepData.key).toLocaleString('he-IL')} ₪
            </span>
          </div>
        </div>
      </motion.div>

      {/* Step Navigation Dots */}
      <div className="flex justify-center gap-2">
        {STEPS.map((step, index) => {
          const StepIconSmall = step.icon;
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          
          return (
            <motion.button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`relative group ${
                isCurrent 
                  ? 'w-14 h-14' 
                  : 'w-10 h-10'
              } rounded-full flex items-center justify-center transition-all ${
                isCompleted 
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/50' 
                  : isCurrent
                  ? `bg-gradient-to-br ${step.color} text-white shadow-lg`
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {isCompleted ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <StepIconSmall className={isCurrent ? 'w-6 h-6' : 'w-4 h-4'} />
              )}
              
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-gray-900 text-white text-xs px-3 py-1 rounded-lg whitespace-nowrap">
                  {step.title}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Fields */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-800"
      >
        <div className="space-y-6">
          {currentStepData.fields.map(field => renderField(field))}
        </div>
      </motion.div>

      {/* Total Summary Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <TrendingUp className="w-12 h-12" />
            <div>
              <p className="text-sm text-green-100">סך כל ההוצאות הקבועות</p>
              <p className="text-4xl font-black">{calculateTotal().toLocaleString('he-IL')} ₪</p>
            </div>
          </div>
          <div className="text-left">
            <p className="text-sm text-green-100">שלבים שהושלמו</p>
            <p className="text-3xl font-black">{completedSteps.length}/{STEPS.length}</p>
          </div>
        </div>
      </motion.div>

      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-green-50 border-2 border-green-500 rounded-xl p-6 text-center"
          >
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-green-900 font-bold text-xl">{successMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex gap-4 justify-between pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1 || loading}
          className="px-8"
        >
          <ArrowRight className="w-4 h-4 ml-2" />
          חזור
        </Button>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard')}
            disabled={loading}
          >
            שמור ויציאה
          </Button>

          <Button
            type="button"
            onClick={handleNext}
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                שומר...
              </>
            ) : currentStep === STEPS.length ? (
              <>
                <Save className="w-4 h-4 ml-2" />
                סיים ושמור
              </>
            ) : (
              <>
                המשך
                <ArrowLeft className="w-4 h-4 mr-2" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Validation Warning */}
      {!isStepValid() && currentStep < STEPS.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 flex items-center gap-3"
        >
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
          <p className="text-yellow-800">
            <strong>שים לב:</strong> יש שדות חובה שטרם מולאו בשלב זה
          </p>
        </motion.div>
      )}
    </div>
  );
}

