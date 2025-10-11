'use client';

import { motion } from 'framer-motion';
import { QuickOnboardingData } from '../QuickOnboardingWizard';
import { MessageCircle, Receipt, Edit3 } from 'lucide-react';

interface Props {
  data: QuickOnboardingData;
  updateData: (data: Partial<QuickOnboardingData>) => void;
}

const START_METHODS = [
  {
    id: 'manual' as const,
    icon: Edit3,
    title: 'רישום ידני',
    description: 'אתחיל לרשום הוצאות ביד, אחת אחת',
    benefits: ['גמישות מלאה', 'התחל תוך 30 שניות', 'שליטה מוחלטת'],
    badge: 'פשוט',
  },
  {
    id: 'receipts' as const,
    icon: Receipt,
    title: 'העלאת קבלות',
    description: 'אעלה קבלות ישנות (3-6 חודשים) ונבנה תמונה',
    benefits: ['מיידי וחכם', 'OCR אוטומטי', 'תובנות מהיר'],
    badge: 'מומלץ',
  },
  {
    id: 'whatsapp' as const,
    icon: MessageCircle,
    title: 'WhatsApp',
    description: 'אשלח הוצאות דרך WhatsApp - קל ומהיר',
    benefits: ['נוח ביותר', 'זמין 24/7', 'בוט עברי חכם'],
    badge: 'פופולרי',
  },
];

export function QuickStep3GetStarted({ data, updateData }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-secondary mb-2">
          איך תרצה להתחיל? 🚀
        </h2>
        <p className="text-textMuted">
          בחר את הדרך הכי נוחה לך - תמיד אפשר לשנות
        </p>
      </div>

      {/* Method cards */}
      <div className="space-y-4">
        {START_METHODS.map((method) => {
          const Icon = method.icon;
          const isSelected = data.startMethod === method.id;

          return (
            <button
              key={method.id}
              onClick={() => updateData({ startMethod: method.id })}
              className={`
                w-full text-right p-6 rounded-xl border-2 transition-all
                ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-lg'
                    : 'border-gray-200 hover:border-primary/50 hover:bg-primary/5'
                }
              `}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                  className={`
                  flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center
                  ${isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}
                `}
                >
                  <Icon className="w-6 h-6" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-secondary">
                      {method.title}
                    </h3>
                    <span
                      className={`
                      text-xs px-2 py-0.5 rounded-full
                      ${
                        method.badge === 'מומלץ'
                          ? 'bg-success/10 text-success'
                          : method.badge === 'פופולרי'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-gray-100 text-gray-600'
                      }
                    `}
                    >
                      {method.badge}
                    </span>
                  </div>

                  <p className="text-textMuted text-sm mb-3">
                    {method.description}
                  </p>

                  <ul className="space-y-1">
                    {method.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-textMuted">
                        <span className="text-success">✓</span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Checkbox */}
                <div className="flex-shrink-0">
                  <div
                    className={`
                    w-6 h-6 rounded-full border-2 flex items-center justify-center
                    ${
                      isSelected
                        ? 'border-primary bg-primary'
                        : 'border-gray-300 bg-white'
                    }
                  `}
                  >
                    {isSelected && (
                      <span className="text-white text-xs">✓</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info based on selection */}
      {data.startMethod && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/10 to-primaryDark/10 border border-primary/20 rounded-xl p-6 text-center"
        >
          {data.startMethod === 'whatsapp' && (
            <>
              <p className="text-lg font-semibold text-secondary mb-2">
                נפלא! 💬
              </p>
              <p className="text-sm text-textMuted">
                בשלב הבא נחבר את WhatsApp שלך ותוכל להתחיל לשלוח הוצאות
              </p>
            </>
          )}
          {data.startMethod === 'receipts' && (
            <>
              <p className="text-lg font-semibold text-secondary mb-2">
                בחירה חכמה! 📸
              </p>
              <p className="text-sm text-textMuted">
                בשלב הבא תוכל להעלות קבלות ונעבד אותן אוטומטית
              </p>
            </>
          )}
          {data.startMethod === 'manual' && (
            <>
              <p className="text-lg font-semibold text-secondary mb-2">
                מעולה! ✍️
              </p>
              <p className="text-sm text-textMuted">
                בשלב הבא תגיע לדשבורד ותוכל להתחיל לרשום הוצאות
              </p>
            </>
          )}
        </motion.div>
      )}

      {/* Final encouragement */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <p className="text-sm text-textMuted">
          🎉 <span className="font-semibold">זהו! אתה מוכן להתחיל</span>
        </p>
      </motion.div>
    </motion.div>
  );
}

