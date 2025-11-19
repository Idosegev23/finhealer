'use client';

import { useRouter } from 'next/navigation';
import { FileText, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DataCollectionDashboardProps {
  daysOfData: number;
  hasBankStatement: boolean;
}

export function DataCollectionDashboard({ daysOfData, hasBankStatement }: DataCollectionDashboardProps) {
  const router = useRouter();

  const progress = Math.min((daysOfData / 30) * 100, 100);

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <Card className="bg-gradient-to-l from-phi-gold/10 to-phi-coral/10 border-4 border-phi-gold/30 p-8">
        <div className="text-center">
          <h1 className="text-4xl font-black text-phi-dark mb-4">
            שלב 1: איסוף נתונים 📊
          </h1>
          <p className="text-xl text-gray-700 mb-6">
            בואו נבנה את התמונה המלאה של המצב הפיננסי שלך
          </p>
          
          {/* Progress Bar */}
          <div className="max-w-2xl mx-auto mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700">
                {daysOfData} ימים של נתונים היסטוריים
              </span>
              <span className="text-sm font-semibold text-phi-gold">
                מתוך 30 נדרשים
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-phi-gold to-phi-coral h-4 rounded-full transition-all duration-500 shadow-lg"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {daysOfData < 30 ? `עוד ${30 - daysOfData} ימים של נתונים ותעבור לשלב הבא! 🎯` : 'מעולה! מספיק נתונים לשלב הבא 🎉'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              💡 טיפ: אם תעלה דוח בנק מ-3-6 חודשים אחורה, תדלג ישר לשלבים המתקדמים!
            </p>
          </div>
        </div>
      </Card>

      {/* Two Paths */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Path 1: Accurate - Scan Documents */}
        <Card className={`p-8 border-4 transition-all ${
          hasBankStatement 
            ? 'border-green-300 bg-green-50/50' 
            : 'border-phi-gold/50 hover:border-phi-gold hover:shadow-xl'
        }`}>
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-phi-gold/20 mb-4">
              <Upload className="w-10 h-10 text-phi-gold" />
            </div>
            <h2 className="text-3xl font-bold text-phi-dark mb-2">
              מסלול מדויק
              </h2>
            <div className="inline-block bg-phi-gold text-white px-4 py-1 rounded-full text-sm font-bold mb-4">
              ⭐ מומלץ
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📸</span>
              <div>
                <h3 className="font-bold text-gray-900">סרוק דוח בנק</h3>
                <p className="text-sm text-gray-600">3-6 חודשים אחורה</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="font-bold text-gray-900">AI מזהה אוטומטית</h3>
                <p className="text-sm text-gray-600">מה חסר לתמונה מלאה</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="font-bold text-gray-900">תאשר ותמשיך</h3>
                <p className="text-sm text-gray-600">המערכת עושה את השאר</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 mb-6 border-2 border-green-200">
            <h4 className="font-bold text-green-800 mb-2">✨ מה תקבל:</h4>
            <ul className="space-y-1 text-sm text-green-700">
              <li>• תמונה מדויקת 100%</li>
              <li>• המלצות מותאמות אישית</li>
              <li>• תקציב חכם מבוסס נתונים</li>
            </ul>
          </div>

          <Button
            onClick={() => router.push('/dashboard/scan-center')}
            className="w-full bg-gradient-to-l from-phi-gold to-phi-coral text-white text-lg font-bold py-6 hover:shadow-xl transition-all"
            size="lg"
          >
            {hasBankStatement ? '✅ המשך לסרוק דוחות' : '📸 התחל כאן - סרוק דוח בנק'}
          </Button>

          <p className="text-xs text-center text-gray-500 mt-3">
            ⏱️ לוקח 10-15 דקות (חד פעמי)
          </p>
        </Card>

        {/* Path 2: Manual Input */}
        <Card className="p-8 border-4 border-gray-300 hover:border-gray-400 hover:shadow-lg transition-all">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-200 mb-4">
              <FileText className="w-10 h-10 text-gray-600" />
            </div>
            <h2 className="text-3xl font-bold text-phi-dark mb-2">
              מסלול ידני
              </h2>
            <div className="inline-block bg-gray-400 text-white px-4 py-1 rounded-full text-sm font-bold mb-4">
              חלופה
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✍️</span>
              <div>
                <h3 className="font-bold text-gray-900">הזן ידנית</h3>
                <p className="text-sm text-gray-600">הכנסות והוצאות עיקריות</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <h3 className="font-bold text-gray-900">מלא פרטים</h3>
                <p className="text-sm text-gray-600">חובות, הלוואות, ביטוחים</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h3 className="font-bold text-gray-900">קבל המלצות</h3>
                <p className="text-sm text-gray-600">בסיסיות לפי הנתונים</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4 mb-6 border-2 border-yellow-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-yellow-800 mb-1">⚠️ חשוב לדעת:</h4>
                <p className="text-sm text-yellow-700">
                  המלצות יהיו פחות מדויקות כי אין לנו את כל הנתונים
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => router.push('/dashboard/manual-input')}
            variant="outline"
            className="w-full border-2 border-gray-400 text-gray-700 text-lg font-bold py-6 hover:bg-gray-50"
            size="lg"
          >
            ✍️ הזן ידנית
          </Button>

          <p className="text-xs text-center text-gray-500 mt-3">
            ⏱️ לוקח 5-10 דקות
          </p>
        </Card>
      </div>

        {/* Help Text */}
        <Card className="bg-blue-50 border-2 border-blue-200 p-6">
          <div className="flex items-start gap-4">
            <span className="text-4xl">💡</span>
            <div>
              <h3 className="font-bold text-blue-900 mb-2">למה זה חשוב?</h3>
              <p className="text-blue-800 leading-relaxed">
                שלב איסוף הנתונים הוא <strong>הבסיס לכל השאר</strong>. ממנו אנחנו בונים את התקציב החכם שלך, 
                מזהים הזדמנויות לחיסכון, ונותנים לך המלצות מותאמות אישית.
              </p>
              <div className="mt-3 bg-white rounded-lg p-3 border border-blue-300">
                <p className="text-blue-900 font-semibold mb-2">🚀 רוצה לדלג קדימה?</p>
                <p className="text-sm text-blue-800">
                  אם תעלה דוח בנק מ-<strong>6 חודשים אחורה</strong>, תקבל מיד גישה לכל התכונות המתקדמות!
                  המערכת מסתכלת על <strong>כמות הנתונים ההיסטוריים</strong> שיש לך, לא על כמה זמן אתה משתמש באפליקציה.
                </p>
              </div>
            </div>
          </div>
        </Card>
    </div>
  );
}
