'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Sparkles, Zap, ArrowRight } from 'lucide-react';

export function OnboardingSelector() {
  const router = useRouter();

  const handleQuickStart = () => {
    router.push('/onboarding/quick');
  };

  const handleFullOnboarding = () => {
    router.push('/reflection');
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-16"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          ברוכים הבאים ל-FinHealer! 🎉
        </h1>
        <p className="text-xl text-gray-600">
          איך היית רוצה להתחיל את המסע הפיננסי שלך?
        </p>
      </motion.div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Quick Start Card */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="group"
        >
          <button
            onClick={handleQuickStart}
            className="w-full h-full text-right bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border-2 border-gray-200 hover:border-blue-400 relative"
          >
            <div className="relative">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-6 group-hover:bg-blue-200 transition-colors">
                <Zap className="w-8 h-8 text-blue-600" />
              </div>

              {/* Badge */}
              <div className="inline-block mb-4">
                <span className="text-xs font-semibold bg-green-100 text-green-700 px-3 py-1 rounded-full">
                  מומלץ למתחילים
                </span>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                בוא נתחיל קטן ⚡
              </h2>

              {/* Description */}
              <p className="text-gray-600 leading-relaxed mb-6">
                התחל תוך 2 דקות ותקבל ערך מיידי. תוכל להשלים פרטים נוספים מאוחר יותר, בקצב שלך.
              </p>

              {/* Features */}
              <ul className="space-y-2 mb-6 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>2-3 שאלות בסיסיות בלבד</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>תתחיל לרשום הוצאות מיד</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>תקבל תובנות כבר ביום הראשון</span>
                </li>
              </ul>

              {/* CTA */}
              <div className="flex items-center justify-end gap-2 text-blue-600 font-semibold group-hover:gap-4 transition-all">
                <span>בואו נתחיל</span>
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </button>
        </motion.div>

        {/* Full Onboarding Card */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="group"
        >
          <button
            onClick={handleFullOnboarding}
            className="w-full h-full text-right bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border-2 border-gray-200 hover:border-purple-400 relative"
          >
            <div className="relative">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-6 group-hover:bg-purple-200 transition-colors">
                <Sparkles className="w-8 h-8 text-purple-600" />
              </div>

              {/* Badge */}
              <div className="inline-block mb-4">
                <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                  לתוצאות מקסימליות
                </span>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                יש לי זמן - בוא נעשה את זה כמו שצריך ✨
              </h2>

              {/* Description */}
              <p className="text-gray-600 leading-relaxed mb-6">
                תמונת מצב 360° מלאה. נאסוף את כל הנתונים החשובים כדי לבנות לך תוכנית פיננסית מותאמת אישית.
              </p>

              {/* Features */}
              <ul className="space-y-2 mb-6 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>תמונה כלכלית מלאה (הכנסות, הוצאות, חובות, נכסים)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>ממוצעי הוצאות היסטוריים (3-6 חודשים)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>הגדרת מטרות פיננסיות וחלומות</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>המלצות מותאמות מהיום הראשון</span>
                </li>
              </ul>

              {/* Time estimate */}
              <div className="inline-flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg mb-4">
                <span className="text-xs text-gray-600">⏱️ זמן משוער: 8-12 דקות</span>
              </div>

              {/* CTA */}
              <div className="flex items-center justify-end gap-2 text-purple-600 font-semibold group-hover:gap-4 transition-all">
                <span>אני מוכן</span>
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </button>
        </motion.div>
      </div>

      {/* Footer note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="text-center"
      >
        <p className="text-sm text-gray-600">
          💡 <span className="font-medium">טיפ:</span> אם אתה לא בטוח - תתחיל קטן. תמיד תוכל להוסיף פרטים נוספים מאוחר יותר.
        </p>
      </motion.div>
    </div>
  );
}

