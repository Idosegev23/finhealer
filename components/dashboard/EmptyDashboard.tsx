'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  UserCircle, 
  TrendingUp, 
  Target, 
  MessageSquare, 
  Receipt, 
  PlusCircle,
  ArrowLeft,
  DollarSign,
  FileText,
  PieChart
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
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#3A7BD5] to-[#7ED957] flex items-center justify-center">
            <UserCircle className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {userName ? `היי ${userName}! ` : 'ברוך הבא! '}👋
          </h1>
          
          <p className="text-xl text-gray-600 mb-2">
            בואו נתחיל את המסע הפיננסי שלך
          </p>
          
          {!hasProfile && (
            <p className="text-sm text-orange-600 font-medium bg-orange-50 inline-block px-4 py-2 rounded-lg mt-2">
              💡 נתחיל עם הפרטים האישיים שלך - קצר ופשוט!
            </p>
          )}
        </motion.div>

        {/* Next Steps Cards */}
        <div className="space-y-6">
          {/* Step 1: Personal Details (if not done) */}
          {!hasProfile && (
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => router.push('/reflection')}
              className="w-full p-6 bg-white rounded-2xl text-right border-2 border-[#3A7BD5] shadow-lg hover:shadow-xl transition-all group"
            >
              <div className="flex items-center justify-between">
                <ArrowLeft className="w-6 h-6 text-[#3A7BD5] group-hover:translate-x-1 transition-transform" />
                <div className="flex-1 mr-4">
                  <div className="flex items-center justify-end gap-2 mb-2">
                    <h3 className="text-2xl font-bold text-gray-900">שלב 1: פרטים אישיים 👤</h3>
                    <div className="w-10 h-10 rounded-full bg-[#3A7BD5]/10 flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-[#3A7BD5]" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">
                    גיל, מצב משפחתי, פרטי ילדים וכתובת מגורים
                  </p>
                  <ul className="text-xs text-gray-600 mb-3 space-y-1">
                    <li className="flex items-center justify-end gap-2">
                      <span>✓ אפשרות לסריקת ת&quot;ז לmילוי אוטומטי</span>
                    </li>
                    <li className="flex items-center justify-end gap-2">
                      <span>✓ מידע נוסף (הכנסות, הוצאות) בדשבורד</span>
                    </li>
                  </ul>
                  <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
                    <span>⏱️ 3-5 דקות</span>
                    <span>•</span>
                    <span className="text-[#3A7BD5] font-medium">🎯 התחלה מהירה</span>
                  </div>
                </div>
              </div>
            </motion.button>
          )}

          {/* Info: Data Collection in Dashboard */}
          {hasProfile && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-[#E8F4FD] to-[#E8F5E9] p-6 rounded-2xl border-2 border-[#3A7BD5]/30"
            >
              <h3 className="text-xl font-bold text-[#1E2A3B] mb-3 text-right flex items-center justify-end gap-2">
                <span>השלם את תמונת המצב שלך 📊</span>
                <FileText className="w-6 h-6 text-[#3A7BD5]" />
              </h3>
              <p className="text-sm text-[#555555] mb-4 text-right">
                בדשבורד תמצא רובריקות נפרדות להשלמת המידע הפיננסי שלך:
              </p>
              <div className="grid md:grid-cols-3 gap-3 mb-4">
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs font-semibold text-[#1E2A3B] mb-1">💰 מידע פיננסי</p>
                  <ul className="text-xs text-[#555555] space-y-0.5">
                    <li>• הכנסות</li>
                    <li>• הוצאות קבועות</li>
                    <li>• הלוואות והתחייבויות</li>
                    <li>• חסכונות ונכסים</li>
                  </ul>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs font-semibold text-[#1E2A3B] mb-1">📈 השקעות</p>
                  <ul className="text-xs text-[#555555] space-y-0.5">
                    <li>• תיק השקעות</li>
                    <li>• קרנות נאמנות</li>
                    <li>• קריפטו</li>
                  </ul>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs font-semibold text-[#1E2A3B] mb-1">🛡️ ביטוחים</p>
                  <ul className="text-xs text-[#555555] space-y-0.5">
                    <li>• חיבור למסלקה</li>
                    <li>• סקירה אוטומטית</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-[#888888] text-right">
                💡 מלא בקצב שלך - הרובריקות יעלמו אחרי שתשלים אותן
              </p>
            </motion.div>
          )}

          {/* Step 2: Add First Transaction */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: hasProfile ? 0.2 : 0.2 }}
            onClick={() => router.push('/transactions')}
            className={`w-full p-6 rounded-2xl text-right shadow-lg hover:shadow-xl transition-all group bg-white
              ${!hasProfile 
                ? 'border-2 border-gray-200 opacity-60' 
                : 'border-2 border-[#7ED957]'
              }`}
          >
            <div className="flex items-center justify-between">
              <ArrowLeft className={`w-6 h-6 group-hover:translate-x-1 transition-transform ${!hasProfile ? 'text-gray-400' : 'text-[#7ED957]'}`} />
              <div className="flex-1 mr-4">
                <div className="flex items-center justify-end gap-2 mb-2">
                  <h3 className={`text-xl font-bold ${!hasProfile ? 'text-gray-500' : 'text-gray-900'}`}>
                    התחל מעקב: רשום תנועה ראשונה 📝
                  </h3>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!hasProfile ? 'bg-gray-100' : 'bg-[#7ED957]/10'}`}>
                    <PlusCircle className={`w-5 h-5 ${!hasProfile ? 'text-gray-400' : 'text-[#7ED957]'}`} />
                  </div>
                </div>
                <p className={`text-sm mb-2 ${!hasProfile ? 'text-gray-400' : 'text-gray-600'}`}>
                  רשום הוצאה או הכנסה ראשונה - ידנית, קבלה או דרך וואטסאפ
                </p>
                <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
                  <span>⚡ פעולה מהירה</span>
                </div>
              </div>
            </div>
          </motion.button>

          {/* Optional Actions */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Upload Receipt */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: hasProfile ? 0.3 : 0.3 }}
              onClick={() => {
                alert('🚧 תכונת סריקת קבלות נמצאת בפיתוח. אנא הוסיפו הוצאות ידנית בינתיים.');
              }}
              className={`p-4 rounded-xl text-right shadow hover:shadow-lg transition-all group bg-white border border-gray-200 opacity-60 cursor-not-allowed relative`}
            >
              <div className="absolute top-2 left-2 bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                בפיתוח
              </div>
              <div className="flex items-center justify-end gap-3 mb-2">
                <h4 className="text-sm font-bold text-gray-500">
                  העלה קבלה 📸
                </h4>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                  <Receipt className="w-4 h-4 text-gray-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                OCR חכם לזיהוי אוטומטי
              </p>
            </motion.button>

            {/* Connect WhatsApp */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: hasProfile ? 0.4 : 0.4 }}
              onClick={() => router.push('/settings?tab=whatsapp')}
              className={`p-4 rounded-xl text-right shadow hover:shadow-lg transition-all group bg-white
                ${!hasProfile 
                  ? 'border border-gray-200 opacity-60' 
                  : 'border border-purple-300 hover:border-purple-500'
                }`}
            >
              <div className="flex items-center justify-end gap-3 mb-2">
                <h4 className={`text-sm font-bold ${!hasProfile ? 'text-gray-500' : 'text-gray-900'}`}>
                  חיבור לוואטסאפ 💬
                </h4>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!hasProfile ? 'bg-gray-100' : 'bg-purple-100'}`}>
                  <MessageSquare className={`w-4 h-4 ${!hasProfile ? 'text-gray-400' : 'text-purple-600'}`} />
                </div>
              </div>
              <p className={`text-xs ${!hasProfile ? 'text-gray-400' : 'text-gray-600'}`}>
                בוט 24/7 + התראות חכמות
              </p>
            </motion.button>
          </div>
        </div>

        {/* Info Box - How it Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm"
        >
          <h4 className="text-lg font-bold text-gray-900 mb-4 text-right flex items-center justify-end gap-2">
            <span>איך FinHealer עובד?</span>
            <PieChart className="w-5 h-5 text-[#3A7BD5]" />
          </h4>
          <div className="space-y-3 text-sm text-gray-600 text-right">
            <div className="flex items-start gap-3">
              <UserCircle className="w-5 h-5 text-[#3A7BD5] mt-0.5 flex-shrink-0" />
              <p>
                <strong className="text-gray-900">שלב 1 - פרטים אישיים:</strong> מילוי מהיר של פרטים בסיסיים (3-5 דקות). אפשרות לסריקת ת&quot;ז למילוי אוטומטי.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-[#7ED957] mt-0.5 flex-shrink-0" />
              <p>
                <strong className="text-gray-900">שלב 2 - השלמת מידע פיננסי:</strong> בדשבורד תמצא רובריקות נפרדות למילוי הכנסות, הוצאות, הלוואות, השקעות וביטוחים - בקצב שלך.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-[#F6A623] mt-0.5 flex-shrink-0" />
              <p>
                <strong className="text-gray-900">שלב 3 - מעקב ותקציב:</strong> רישום תנועות יומיומי, תקציב אוטומטי מבוסס התנהלות, והגדרת יעדי חיסכון.
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
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#3A7BD5] to-[#7ED957] text-white rounded-xl font-bold hover:shadow-xl transition-all shadow-lg"
            >
              בואו נתחיל! 🚀
              <ArrowLeft className="w-5 h-5" />
            </button>
            <p className="text-xs text-gray-500 mt-3">
              3-5 דקות בלבד • המידע שלך מאובטח ומוצפן
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
