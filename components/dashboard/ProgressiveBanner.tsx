'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, TrendingUp, FileText, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProgressiveBannerProps {
  type: 'complete_profile' | 'add_transactions' | 'set_goals' | 'budget_ready';
  transactionCount?: number;
  daysSinceStart?: number;
}

export function ProgressiveBanner({ type, transactionCount = 0, daysSinceStart = 0 }: ProgressiveBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const router = useRouter();

  const banners = {
    complete_profile: {
      icon: FileText,
      color: 'primary',
      title: 'רוצה תובנות מדויקות יותר?',
      description: 'השלם את הפרופיל הפיננסי שלך ונוכל לתת לך המלצות מותאמות אישית',
      cta: 'השלם פרופיל',
      link: '/reflection',
    },
    add_transactions: {
      icon: TrendingUp,
      color: 'success',
      title: `הוספת ${transactionCount} הוצאות - יופי! 🎉`,
      description: 'עוד כמה הוצאות ונוכל להתחיל לזהות דפוסים ולתת לך טיפים חכמים',
      cta: 'הוסף עוד הוצאות',
      link: '/transactions?add=true',
    },
    set_goals: {
      icon: Target,
      color: 'warning',
      title: `עברת ${daysSinceStart} ימים עם FinHealer!`,
      description: 'מוכן להגדיר מטרת חיסכון? זה יעזור לך להישאר ממוקד',
      cta: 'הגדר מטרה',
      link: '/goals?new=true',
    },
    budget_ready: {
      icon: TrendingUp,
      color: 'primary',
      title: 'מספיק נתונים לתקציב חכם! 💪',
      description: 'אספת מספיק נתונים. מוכן שנבנה לך תקציב מבוסס על ההתנהלות שלך?',
      cta: 'בנה תקציב',
      link: '/budget?generate=true',
    },
  };

  const banner = banners[type];
  const Icon = banner.icon;

  if (isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -20, height: 0 }}
        className={`
          relative overflow-hidden rounded-xl border-2 p-5 mb-6
          bg-gradient-to-l from-${banner.color}/5 to-transparent
          border-${banner.color}/20
        `}
      >
        {/* Background decoration */}
        <div className={`absolute top-0 left-0 w-1 h-full bg-${banner.color}`} />

        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-${banner.color}/10 flex items-center justify-center`}>
            <Icon className={`w-6 h-6 text-${banner.color}`} />
          </div>

          {/* Content */}
          <div className="flex-1">
            <h3 className="text-lg font-bold text-secondary mb-1">
              {banner.title}
            </h3>
            <p className="text-sm text-textMuted mb-3">
              {banner.description}
            </p>

            {/* CTA */}
            <button
              onClick={() => router.push(banner.link)}
              className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-lg
                bg-${banner.color} text-white font-medium text-sm
                hover:opacity-90 transition-opacity
              `}
            >
              <span>{banner.cta}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => setIsDismissed(true)}
            className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-textMuted" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

