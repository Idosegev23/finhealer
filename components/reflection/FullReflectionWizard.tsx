'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import Step1Personal from './steps/Step1Personal';

interface FullReflectionWizardProps {
  categories: any[];
  userId: string;
}

export default function FullReflectionWizard({ categories, userId }: FullReflectionWizardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // State רק לפרטים אישיים
  const [data, setData] = useState({
    full_name: '',  // שם מלא
    age: null,
    marital_status: '',
    city: '',
    employment_status: '',
    dependents: [],  // Array of {id, name, birthDate, gender, relationshipType, isFinanciallySupported}
  });

  const handleChange = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = data.full_name && data.age && data.marital_status && data.city && data.employment_status;

  const handleComplete = async () => {
    if (!isFormValid) return;

    setLoading(true);

    try {
      // שמירת פרטים אישיים בלבד
      const profileResponse = await fetch('/api/reflection/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: data.full_name,
          age: data.age,
          marital_status: data.marital_status,
          city: data.city,
          employment_status: data.employment_status,
          dependents: data.dependents,
          completed: true
        })
      });

      if (!profileResponse.ok) {
        throw new Error('שגיאה בשמירת הפרטים האישיים');
      }

      // עדכון phase ל-data_collection
      const phaseResponse = await fetch('/api/user/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'data_collection' })
      });

      if (!phaseResponse.ok) {
        console.error('Failed to update phase, continuing anyway');
      }

      // הצגת הודעת הצלחה
      setShowSuccess(true);

      // מעבר לדשבורד אחרי 2 שניות
      setTimeout(() => {
        router.push('/dashboard?onboarding=completed');
        router.refresh();
      }, 2000);
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה בשמירת הנתונים. אנא נסה שוב.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 relative overflow-hidden" dir="rtl">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 left-20 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Success Animation */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ y: 50 }}
                animate={{ y: 0 }}
                className="bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-4 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  כל הכבוד {data.full_name}! 🎉
                </h2>
                <p className="text-gray-600">התחלנו להכיר אותך טוב יותר. מעביר אותך לדשבורד...</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header with animation */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-block mb-4"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </motion.div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            ברוכים הבאים ל-FinHealer! 🎉
          </h1>
          <p className="text-lg text-gray-600">
            בואו נתחיל להכיר אותך - זה יקח רק דקה
          </p>
        </motion.div>

        {/* Progress indicator */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-full p-2 max-w-md mx-auto shadow-sm">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm font-medium text-gray-700">שלב 1 מתוך 1</span>
              <div className="flex gap-2">
                <div className="w-24 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
              </div>
              <span className="text-sm font-medium text-blue-600">100%</span>
            </div>
          </div>
        </motion.div>

        {/* Form Card with animation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20"
        >
          <Step1Personal data={data} onChange={handleChange} />
        </motion.div>

        {/* Action buttons with animation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex justify-center gap-4"
        >
          <button
            onClick={handleComplete}
            disabled={loading || !isFormValid}
            className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl disabled:hover:shadow-lg flex items-center gap-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>שומר...</span>
              </>
            ) : (
              <>
                <span>סיום והמשך לדשבורד</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </motion.div>

        {/* Info text with animation */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-6 text-sm text-gray-600 bg-white/50 backdrop-blur-sm rounded-full px-6 py-3 inline-block mx-auto"
        >
          💡 תוכל להשלים מידע נוסף (הכנסות, הוצאות, השקעות) בדשבורד
        </motion.p>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}


