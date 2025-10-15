'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { UserCircle, ArrowRight } from 'lucide-react';

export function OnboardingSelector() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/reflection');
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          ברוכים הבאים ל-FinHealer! 🎉
        </h1>
        <p className="text-xl text-gray-600 mb-2">
          בואו נתחיל עם הפרטים האישיים שלך
        </p>
        <p className="text-sm text-gray-500">
          מילוי מידע נוסף (הכנסות, הוצאות, השקעות) יהיה זמין בדשבורד
        </p>
      </motion.div>

      {/* Single Card */}
      <div className="mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="group"
        >
          <button
            onClick={handleStart}
            className="w-full h-full text-right bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-[#3A7BD5] hover:border-[#7ED957] relative"
          >
            <div className="relative">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#E8F4FD] mb-6 group-hover:bg-[#7ED957] group-hover:bg-opacity-20 transition-colors">
                <UserCircle className="w-12 h-12 text-[#3A7BD5] group-hover:text-[#7ED957]" />
              </div>

              {/* Title */}
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                בואו נתחיל! 🚀
              </h2>

              {/* Description */}
              <p className="text-gray-600 leading-relaxed mb-6 text-lg">
                נתחיל עם הפרטים האישיים שלך. תהליך קצר ופשוט שייקח כ-3-5 דקות.
              </p>

              {/* Features */}
              <ul className="space-y-3 mb-8 text-sm text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="text-[#7ED957] mt-0.5 text-lg">✓</span>
                  <span><strong>פרטים בסיסיים:</strong> גיל, מצב משפחתי, כתובת</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#7ED957] mt-0.5 text-lg">✓</span>
                  <span><strong>משפחה:</strong> פרטי ילדים (שם, תאריך לידה, מין)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#7ED957] mt-0.5 text-lg">✓</span>
                  <span><strong>אופציה לסריקת ת&quot;ז:</strong> מילוי אוטומטי מהר וקל</span>
                </li>
              </ul>

              {/* Info box */}
              <div className="bg-[#FFF3E0] border border-[#F6A623] rounded-lg p-4 mb-6">
                <p className="text-sm text-[#1E2A3B]">
                  <strong>💡 לאחר מכן:</strong> בדשבורד תוכל למלא מידע נוסף על הכנסות, הוצאות, השקעות וביטוחים - בקצב שלך!
                </p>
              </div>

              {/* Time estimate */}
              <div className="inline-flex items-center gap-2 bg-[#E8F5E9] px-4 py-2 rounded-lg mb-6">
                <span className="text-sm text-[#1E2A3B] font-medium">⏱️ זמן משוער: 3-5 דקות</span>
              </div>

              {/* CTA */}
              <div className="flex items-center justify-end gap-2 text-[#3A7BD5] font-bold text-lg group-hover:gap-4 transition-all">
                <span>בואו נתחיל</span>
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>
          </button>
        </motion.div>
      </div>
    </div>
  );
}

