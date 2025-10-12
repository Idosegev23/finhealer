'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, 
  TrendingUp, 
  Target, 
  MessageSquare, 
  Receipt, 
  PlusCircle,
  ArrowLeft
} from 'lucide-react';

interface EmptyDashboardProps {
  userName?: string;
  hasProfile: boolean;
}

export default function EmptyDashboard({ userName, hasProfile }: EmptyDashboardProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="container mx-auto max-w-4xl">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12 bg-white rounded-2xl shadow-sm p-8"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-blue-600" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {userName ? `היי ${userName}! ` : 'ברוך הבא! '}👋
          </h1>
          
          <p className="text-xl text-gray-600 mb-2">
            בואו נתחיל את המסע הפיננסי שלך
          </p>
          
          {!hasProfile && (
            <p className="text-sm text-orange-600 font-medium bg-orange-50 inline-block px-4 py-2 rounded-lg mt-2">
              💡 כדי לקבל תובנות מותאמות, נתחיל בתמונת מצב קצרה
            </p>
          )}
        </motion.div>

        {/* Next Steps Cards */}
        <div className="space-y-6">
          {/* Step 1: Complete Profile (if not done) */}
          {!hasProfile && (
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => router.push('/reflection')}
              className="w-full p-6 bg-white rounded-2xl text-right border-2 border-blue-500 shadow-lg hover:shadow-xl transition-all group"
            >
              <div className="flex items-center justify-between">
                <ArrowLeft className="w-6 h-6 text-blue-600 group-hover:translate-x-1 transition-transform" />
                <div className="flex-1 mr-4">
                  <div className="flex items-center justify-end gap-2 mb-2">
                    <h3 className="text-2xl font-bold text-gray-900">שלב 1: תמונת מצב 360°</h3>
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">
                    נתחיל להכיר אותך - מצב משפחתי, הכנסות, הוצאות, חובות ומטרות
                  </p>
                  <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
                    <span>⏱️ 8-12 דקות</span>
                    <span>•</span>
                    <span className="text-blue-600 font-medium">🎯 חובה להמשך</span>
                  </div>
                </div>
              </div>
            </motion.button>
          )}

          {/* Step 2: Add First Transaction */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: hasProfile ? 0.1 : 0.2 }}
            onClick={() => router.push('/transactions')}
            className={`w-full p-6 rounded-2xl text-right shadow-lg hover:shadow-xl transition-all group bg-white
              ${!hasProfile 
                ? 'border-2 border-gray-200 opacity-60' 
                : 'border-2 border-green-500'
              }`}
          >
            <div className="flex items-center justify-between">
              <ArrowLeft className={`w-6 h-6 group-hover:translate-x-1 transition-transform ${!hasProfile ? 'text-gray-400' : 'text-green-600'}`} />
              <div className="flex-1 mr-4">
                <div className="flex items-center justify-end gap-2 mb-2">
                  <h3 className={`text-xl font-bold ${!hasProfile ? 'text-gray-500' : 'text-gray-900'}`}>
                    {hasProfile ? 'שלב 2' : 'שלב 2'}: רשום הוצאה ראשונה
                  </h3>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!hasProfile ? 'bg-gray-100' : 'bg-green-100'}`}>
                    <PlusCircle className={`w-5 h-5 ${!hasProfile ? 'text-gray-400' : 'text-green-600'}`} />
                  </div>
                </div>
                <p className={`text-sm mb-2 ${!hasProfile ? 'text-gray-400' : 'text-gray-600'}`}>
                  התחל למעקב - רשום הוצאה או הכנסה ידנית
                </p>
                <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
                  <span>⚡ פעולה מהירה</span>
                </div>
              </div>
            </div>
          </motion.button>

          {/* Step 3: Upload Receipt */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: hasProfile ? 0.2 : 0.3 }}
            onClick={() => router.push('/transactions?upload=true')}
            className={`w-full p-6 rounded-2xl text-right shadow-lg hover:shadow-xl transition-all group bg-white
              ${!hasProfile 
                ? 'border-2 border-gray-200 opacity-60' 
                : 'border-2 border-gray-300'
              }`}
          >
            <div className="flex items-center justify-between">
              <ArrowLeft className={`w-6 h-6 group-hover:translate-x-1 transition-transform ${!hasProfile ? 'text-gray-400' : 'text-orange-600'}`} />
              <div className="flex-1 mr-4">
                <div className="flex items-center justify-end gap-2 mb-2">
                  <h3 className={`text-xl font-bold ${!hasProfile ? 'text-gray-500' : 'text-gray-900'}`}>
                    אופציה: העלה קבלה
                  </h3>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!hasProfile ? 'bg-gray-100' : 'bg-orange-100'}`}>
                    <Receipt className={`w-5 h-5 ${!hasProfile ? 'text-gray-400' : 'text-orange-600'}`} />
                  </div>
                </div>
                <p className={`text-sm mb-2 ${!hasProfile ? 'text-gray-400' : 'text-gray-600'}`}>
                  צלם קבלה ותן לנו לזהות אוטומטית את הסכום והספק
                </p>
                <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
                  <span>📸 OCR חכם</span>
                </div>
              </div>
            </div>
          </motion.button>

          {/* Step 4: Connect WhatsApp */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: hasProfile ? 0.3 : 0.4 }}
            onClick={() => router.push('/settings?tab=whatsapp')}
            className={`w-full p-6 rounded-2xl text-right shadow-lg hover:shadow-xl transition-all group bg-white
              ${!hasProfile 
                ? 'border-2 border-gray-200 opacity-60' 
                : 'border-2 border-gray-300'
              }`}
          >
            <div className="flex items-center justify-between">
              <ArrowLeft className={`w-6 h-6 group-hover:translate-x-1 transition-transform ${!hasProfile ? 'text-gray-400' : 'text-purple-600'}`} />
              <div className="flex-1 mr-4">
                <div className="flex items-center justify-end gap-2 mb-2">
                  <h3 className={`text-xl font-bold ${!hasProfile ? 'text-gray-500' : 'text-gray-900'}`}>
                    אופציה: התחבר לוואטסאפ
                  </h3>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!hasProfile ? 'bg-gray-100' : 'bg-purple-100'}`}>
                    <MessageSquare className={`w-5 h-5 ${!hasProfile ? 'text-gray-400' : 'text-purple-600'}`} />
                  </div>
                </div>
                <p className={`text-sm mb-2 ${!hasProfile ? 'text-gray-400' : 'text-gray-600'}`}>
                  רשום הוצאות ישירות מהווטסאפ + קבל תזכורות והתראות חכמות
                </p>
                <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
                  <span>💬 בוט 24/7</span>
                </div>
              </div>
            </div>
          </motion.button>
        </div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm"
        >
          <h4 className="text-lg font-bold text-gray-900 mb-3 text-right">
            💡 איך FinHealer עובד?
          </h4>
          <div className="space-y-3 text-sm text-gray-600 text-right">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <p>
                <strong className="text-gray-900">שלב 1 - תמונת מצב:</strong> נכיר אותך ונבין את המצב הפיננסי שלך (הכנסות, הוצאות, חובות)
              </p>
            </div>
            <div className="flex items-start gap-3">
              <PlusCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p>
                <strong className="text-gray-900">שלב 2 - מעקב:</strong> תתחיל לרשום הוצאות והכנסות (ידני, קבלות, או וואטסאפ)
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <p>
                <strong className="text-gray-900">שלב 3 - תקציב + יעדים:</strong> נייצר תקציב אוטומטי מבוסס ההתנהלות שלך ונגדיר יעדים
              </p>
            </div>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        {!hasProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-center"
          >
            <button
              onClick={() => router.push('/reflection')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
            >
              בואו נתחיל! 🚀
              <ArrowLeft className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

