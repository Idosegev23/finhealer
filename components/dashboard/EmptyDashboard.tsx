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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-12">
      <div className="container mx-auto max-w-4xl">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-primaryDark flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-secondary mb-4">
            {userName ? `היי ${userName}! ` : 'ברוך הבא! '}👋
          </h1>
          
          <p className="text-xl text-textMuted mb-2">
            בואו נתחיל את המסע הפיננסי שלך
          </p>
          
          {!hasProfile && (
            <p className="text-sm text-warning font-medium">
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
              className="w-full p-6 bg-gradient-to-r from-primary to-primaryDark rounded-2xl text-right text-white shadow-xl hover:shadow-2xl transition-all group"
            >
              <div className="flex items-center justify-between">
                <ArrowLeft className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                <div className="flex-1 mr-4">
                  <div className="flex items-center justify-end gap-2 mb-2">
                    <h3 className="text-2xl font-bold">שלב 1: תמונת מצב 360°</h3>
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-white/90 text-sm mb-3">
                    נתחיל להכיר אותך - מצב משפחתי, הכנסות, הוצאות, חובות ומטרות
                  </p>
                  <div className="flex items-center justify-end gap-2 text-xs text-white/80">
                    <span>⏱️ 8-12 דקות</span>
                    <span>•</span>
                    <span>🎯 חובה להמשך</span>
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
            className={`w-full p-6 rounded-2xl text-right shadow-lg hover:shadow-xl transition-all group
              ${!hasProfile 
                ? 'bg-card border-2 border-gray-200' 
                : 'bg-gradient-to-r from-success/10 to-success/5 border-2 border-success'
              }`}
          >
            <div className="flex items-center justify-between">
              <ArrowLeft className={`w-6 h-6 group-hover:translate-x-1 transition-transform ${!hasProfile ? 'text-gray-400' : 'text-success'}`} />
              <div className="flex-1 mr-4">
                <div className="flex items-center justify-end gap-2 mb-2">
                  <h3 className={`text-xl font-bold ${!hasProfile ? 'text-gray-500' : 'text-secondary'}`}>
                    {hasProfile ? 'שלב 2' : 'שלב 2'}: רשום הוצאה ראשונה
                  </h3>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!hasProfile ? 'bg-gray-100' : 'bg-success/10'}`}>
                    <PlusCircle className={`w-5 h-5 ${!hasProfile ? 'text-gray-400' : 'text-success'}`} />
                  </div>
                </div>
                <p className={`text-sm mb-2 ${!hasProfile ? 'text-gray-400' : 'text-textMuted'}`}>
                  התחל למעקב - רשום הוצאה או הכנסה ידנית
                </p>
                <div className="flex items-center justify-end gap-2 text-xs text-textMuted">
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
            className={`w-full p-6 rounded-2xl text-right shadow-lg hover:shadow-xl transition-all group
              ${!hasProfile 
                ? 'bg-card border-2 border-gray-200' 
                : 'bg-gradient-to-r from-warning/10 to-warning/5 border-2 border-warning'
              }`}
          >
            <div className="flex items-center justify-between">
              <ArrowLeft className={`w-6 h-6 group-hover:translate-x-1 transition-transform ${!hasProfile ? 'text-gray-400' : 'text-warning'}`} />
              <div className="flex-1 mr-4">
                <div className="flex items-center justify-end gap-2 mb-2">
                  <h3 className={`text-xl font-bold ${!hasProfile ? 'text-gray-500' : 'text-secondary'}`}>
                    אופציה: העלה קבלה
                  </h3>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!hasProfile ? 'bg-gray-100' : 'bg-warning/10'}`}>
                    <Receipt className={`w-5 h-5 ${!hasProfile ? 'text-gray-400' : 'text-warning'}`} />
                  </div>
                </div>
                <p className={`text-sm mb-2 ${!hasProfile ? 'text-gray-400' : 'textMuted'}`}>
                  צלם קבלה ותן לנו לזהות אוטומטית את הסכום והספק
                </p>
                <div className="flex items-center justify-end gap-2 text-xs text-textMuted">
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
            className={`w-full p-6 rounded-2xl text-right shadow-lg hover:shadow-xl transition-all group
              ${!hasProfile 
                ? 'bg-card border-2 border-gray-200' 
                : 'bg-gradient-to-r from-primaryDark/10 to-primaryDark/5 border-2 border-primaryDark'
              }`}
          >
            <div className="flex items-center justify-between">
              <ArrowLeft className={`w-6 h-6 group-hover:translate-x-1 transition-transform ${!hasProfile ? 'text-gray-400' : 'text-primaryDark'}`} />
              <div className="flex-1 mr-4">
                <div className="flex items-center justify-end gap-2 mb-2">
                  <h3 className={`text-xl font-bold ${!hasProfile ? 'text-gray-500' : 'text-secondary'}`}>
                    אופציה: התחבר לוואטסאפ
                  </h3>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!hasProfile ? 'bg-gray-100' : 'bg-primaryDark/10'}`}>
                    <MessageSquare className={`w-5 h-5 ${!hasProfile ? 'text-gray-400' : 'text-primaryDark'}`} />
                  </div>
                </div>
                <p className={`text-sm mb-2 ${!hasProfile ? 'text-gray-400' : 'text-textMuted'}`}>
                  רשום הוצאות ישירות מהווטסאפ + קבל תזכורות והתראות חכמות
                </p>
                <div className="flex items-center justify-end gap-2 text-xs text-textMuted">
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
          className="mt-12 p-6 bg-primary/5 rounded-2xl border border-primary/20"
        >
          <h4 className="text-lg font-bold text-secondary mb-3 text-right">
            💡 איך FinHealer עובד?
          </h4>
          <div className="space-y-3 text-sm text-textMuted text-right">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <p>
                <strong className="text-secondary">שלב 1 - תמונת מצב:</strong> נכיר אותך ונבין את המצב הפיננסי שלך (הכנסות, הוצאות, חובות)
              </p>
            </div>
            <div className="flex items-start gap-3">
              <PlusCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
              <p>
                <strong className="text-secondary">שלב 2 - מעקב:</strong> תתחיל לרשום הוצאות והכנסות (ידני, קבלות, או וואטסאפ)
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
              <p>
                <strong className="text-secondary">שלב 3 - תקציב + יעדים:</strong> נייצר תקציב אוטומטי מבוסס ההתנהלות שלך ונגדיר יעדים
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
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-lg font-semibold hover:bg-primaryDark transition-all shadow-lg hover:shadow-xl"
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

