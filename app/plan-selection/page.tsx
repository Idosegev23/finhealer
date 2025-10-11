'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Zap, Sparkles, Check, ArrowLeft } from 'lucide-react';

type OnboardingType = 'quick' | 'full';
type PlanType = 'basic' | 'advanced';

export default function PlanSelectionPage() {
  const router = useRouter();
  const [selectedOnboarding, setSelectedOnboarding] = useState<OnboardingType | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);

  const handleContinue = () => {
    if (!selectedOnboarding || !selectedPlan) {
      alert('אנא בחר גם מסלול וגם תוכנית');
      return;
    }

    // שמור בחירות ב-localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('finhealer_onboarding_type', selectedOnboarding);
      localStorage.setItem('finhealer_plan_type', selectedPlan);
    }

    // המשך לתשלום
    router.push('/payment');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-12">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-secondary mb-4">
            בואו נתאים את FinHealer בשבילך 🎯
          </h1>
          <p className="text-xl text-textMuted">
            בחר איך להתחיל ואיזו תוכנית מתאימה לך
          </p>
        </motion.div>

        {/* Step 1: Onboarding Type */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-secondary mb-6 text-center">
            שלב 1: איך תרצה להתחיל?
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Quick Onboarding */}
            <button
              onClick={() => setSelectedOnboarding('quick')}
              className={`
                relative p-8 rounded-2xl border-2 transition-all text-right
                ${selectedOnboarding === 'quick'
                  ? 'border-primary bg-primary/5 shadow-xl'
                  : 'border-gray-200 hover:border-primary/50 hover:bg-primary/5'
                }
              `}
            >
              {selectedOnboarding === 'quick' && (
                <div className="absolute top-4 left-4">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-secondary">התחלה מהירה ⚡</h3>
                  <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                    מומלץ למתחילים
                  </span>
                </div>
              </div>

              <p className="text-textMuted mb-4">
                2-3 דקות בלבד. תקבל ערך מיידי ותוכל להשלים פרטים מאוחר יותר.
              </p>

              <ul className="space-y-2 text-sm text-textMuted">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span>2-3 שאלות בסיסיות</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span>התחל לרשום הוצאות מיד</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span>תובנות מיידיות</span>
                </li>
              </ul>
            </button>

            {/* Full Onboarding */}
            <button
              onClick={() => setSelectedOnboarding('full')}
              className={`
                relative p-8 rounded-2xl border-2 transition-all text-right
                ${selectedOnboarding === 'full'
                  ? 'border-primaryDark bg-primaryDark/5 shadow-xl'
                  : 'border-gray-200 hover:border-primaryDark/50 hover:bg-primaryDark/5'
                }
              `}
            >
              {selectedOnboarding === 'full' && (
                <div className="absolute top-4 left-4">
                  <div className="w-6 h-6 rounded-full bg-primaryDark flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primaryDark/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primaryDark" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-secondary">תמונה מלאה ✨</h3>
                  <span className="text-xs bg-primaryDark/10 text-primaryDark px-2 py-1 rounded-full">
                    לתוצאות מקסימליות
                  </span>
                </div>
              </div>

              <p className="text-textMuted mb-4">
                תמונת מצב 360° מלאה. כל הנתונים החשובים לתוכנית פיננסית מותאמת.
              </p>

              <ul className="space-y-2 text-sm text-textMuted">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primaryDark" />
                  <span>תמונה כלכלית מלאה</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primaryDark" />
                  <span>ממוצעי הוצאות (3-6 חודשים)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primaryDark" />
                  <span>מטרות וחלומות פיננסיים</span>
                </li>
              </ul>

              <div className="mt-4 text-xs text-textMuted">
                ⏱️ זמן משוער: 8-12 דקות
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: Plan Type */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-secondary mb-6 text-center">
            שלב 2: בחר את התוכנית שלך
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Basic Plan */}
            <button
              onClick={() => setSelectedPlan('basic')}
              className={`
                relative p-8 rounded-2xl border-2 transition-all text-right
                ${selectedPlan === 'basic'
                  ? 'border-primary bg-primary/5 shadow-xl'
                  : 'border-gray-200 hover:border-primary/50 hover:bg-primary/5'
                }
              `}
            >
              {selectedPlan === 'basic' && (
                <div className="absolute top-4 left-4">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              <div className="absolute -top-3 right-6 bg-success text-white px-3 py-1 rounded-full text-xs font-semibold">
                הכי פופולרי
              </div>

              <h3 className="text-2xl font-bold text-secondary mb-2">Basic</h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold text-primary">₪49</span>
                <span className="text-textMuted">לחודש</span>
              </div>

              <ul className="space-y-2 text-sm mb-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span>מעקב הוצאות בלתי מוגבל</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span>בוט וואטסאפ חכם 24/7</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span>AI Assistant (GPT-4)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span>OCR לקבלות</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span>תקציב אוטומטי + רמזור</span>
                </li>
              </ul>

              <p className="text-xs text-textMuted">
                מושלם למתחילים וכל מי שרוצה שליטה על הכסף
              </p>
            </button>

            {/* Advanced Plan */}
            <button
              onClick={() => setSelectedPlan('advanced')}
              className={`
                relative p-8 rounded-2xl border-2 transition-all text-right bg-gradient-to-br
                ${selectedPlan === 'advanced'
                  ? 'border-warning from-warning/10 to-warning/5 shadow-xl'
                  : 'border-gray-200 from-gray-50 to-white hover:border-warning/50'
                }
              `}
            >
              {selectedPlan === 'advanced' && (
                <div className="absolute top-4 left-4">
                  <div className="w-6 h-6 rounded-full bg-warning flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              <div className="absolute -top-3 right-6 bg-warning text-white px-3 py-1 rounded-full text-xs font-semibold">
                ליווי VIP
              </div>

              <h3 className="text-2xl font-bold text-secondary mb-2">Advanced</h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold text-warning">₪119</span>
                <span className="text-textMuted">לחודש</span>
              </div>

              <p className="text-sm font-semibold text-warning mb-3">
                כל תכונות Basic +
              </p>

              <ul className="space-y-2 text-sm mb-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-warning" />
                  <span className="font-semibold">2 פגישות עם גדי בחודש</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-warning" />
                  <span className="font-semibold">הערות אישיות שבועיות</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-warning" />
                  <span className="font-semibold">ליווי צמוד בווטסאפ</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-warning" />
                  <span>תכנון פיננסי מותאם</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-warning" />
                  <span>ייעוץ מיחזור הלוואות</span>
                </li>
              </ul>

              <p className="text-xs text-textMuted">
                לליווי אישי מלא ותוצאות מקסימליות
              </p>
            </button>
          </div>
        </div>

        {/* Continue Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <button
            onClick={handleContinue}
            disabled={!selectedOnboarding || !selectedPlan}
            className={`
              inline-flex items-center gap-2 px-8 py-4 rounded-lg text-lg font-semibold transition-all
              ${selectedOnboarding && selectedPlan
                ? 'bg-primary text-white hover:bg-primaryDark shadow-lg hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            המשך לתשלום
            <ArrowLeft className="w-5 h-5" />
          </button>

          <p className="text-sm text-textMuted mt-4">
            💳 תשלום מאובטח דרך חשבונית ירוקה
          </p>
        </motion.div>
      </div>
    </div>
  );
}

