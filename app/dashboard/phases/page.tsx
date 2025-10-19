import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle2, Target, TrendingUp, PiggyBank, Eye, BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default async function PhasesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/login')
  }

  const userDataInfo = userData as any
  const currentPhase = userDataInfo.phase || 'reflection'

  const phases = [
    {
      id: 'reflection',
      name: 'שלב 1: שיקוף',
      icon: Eye,
      color: 'blue',
      description: 'הבנת המצב הכלכלי הנוכחי',
      why: 'למה זה חשוב? כי רוב האנשים לא באמת יודעים לאן הכסף שלהם הולך. שיקוף נותן לך תמונת מצב אמיתית ללא שיפוטיות - רק עובדות.',
      how: [
        'איסוף נתונים פיננסיים: הכנסות, הוצאות, חובות, נכסים',
        'ניתוח דפי חשבון בנק של 3-6 חודשים אחרונים',
        'חלוקת הוצאות לקטגוריות ברורות',
        'זיהוי דפוסי הוצאה ותחומי בעיה',
        'הבנת מצב תזרים המזומנים',
      ],
      example: 'אם ראית שהוצאת בממוצע 1,200 ₪ על בילויים בחודש, זה לא שיפוט - זה רק מידע. עכשיו אתה יכול להחליט אם זה בסדר עבורך או שאתה רוצה לשנות משהו.',
      duration: '1-2 שבועות',
      output: 'תמונת מצב מלאה של הנתונים הפיננסיים',
    },
    {
      id: 'behavior',
      name: 'שלב 2: שינוי הרגלים',
      icon: TrendingUp,
      color: 'green',
      description: 'בניית הרגלי הוצאה בריאים',
      why: 'שיקוף זה רק ההתחלה. כדי לשפר את המצב, צריך לשנות הרגלים. מחקרים מראים שנדרשים 21 יום ליצירת הרגל חדש.',
      how: [
        'זיהוי ההרגלים הבעייתיים (קניות אימפולסיביות, מנויים מיותרים)',
        'הגדרת חלופות בריאות (במקום קפה בחוץ - להכין בבית)',
        'שימוש בטכניקת "24 שעות" - לחכות יום לפני קניה גדולה',
        'מעקב יומי אחר הוצאות דרך האפליקציה',
        'חגיגת הצלחות קטנות',
      ],
      example: 'במקום לקנות קפה ב-18 ₪ כל בוקר (540 ₪ בחודש), תכין בבית ב-2 ₪ (60 ₪ בחודש). חסכת 480 ₪ בחודש!',
      duration: '1-2 חודשים',
      output: 'הרגלי הוצאה מודעים ובשליטה',
    },
    {
      id: 'budget',
      name: 'שלב 3: תקציב חכם',
      icon: BarChart3,
      color: 'purple',
      description: 'ניהול תקציב מבוסס נתונים',
      why: 'תקציב זה לא הגבלה - זה תכנית. זה אומר לכסף שלך לאן ללכת, במקום לתהות לאן הוא הלך.',
      how: [
        'חישוב תקציב חודשי לפי קטגוריות',
        'שיטת 50/30/20: 50% צרכים, 30% רצונות, 20% חיסכון',
        'הקצאת תקציב לכל קטגוריה',
        'מעקב שבועי אחר עמידה בתקציב',
        'התאמות לפי צרכים משתנים',
      ],
      example: 'אם ההכנסה שלך 10,000 ₪: 5,000 ₪ לצרכים קבועים (דיור, אוכל), 3,000 ₪ לרצונות (בילויים), 2,000 ₪ לחיסכון.',
      duration: '1 חודש להקמה + מעקב שוטף',
      output: 'תקציב מפורט עם התראות וניטור',
    },
    {
      id: 'goals',
      name: 'שלב 4: יעדים ומטרות',
      icon: Target,
      color: 'orange',
      description: 'הגדרת יעדים פיננסיים ברורים',
      why: 'חיסכון ללא מטרה זה כמו לרוץ ללא קו סיום. יעדים נותנים משמעות ומוטיבציה.',
      how: [
        'הגדרת יעדים SMART (ספציפיים, מדידים, ברי השגה)',
        'פירוק יעדים גדולים לאבני דרך',
        'קביעת לוח זמנים ריאלי',
        'יצירת חשבון נפרד לכל יעד',
        'מעקב ויזואלי אחר התקדמות',
      ],
      example: 'יעד: "לחסוך 30,000 ₪ לטיול משפחתי בעוד שנה" → 2,500 ₪ לחודש. הפרדה לחשבון נפרד + מעקב חודשי.',
      duration: 'שוטף - מעקב חודשי',
      output: 'רשימת יעדים עם מעקב התקדמות',
    },
    {
      id: 'monitoring',
      name: 'שלב 5: מעקב ובקרה',
      icon: PiggyBank,
      color: 'red',
      description: 'ניטור שוטף והתאמות',
      why: 'החיים משתנים - ההכנסות, ההוצאות, המטרות. מעקב קבוע מבטיח שהתכנית תמיד רלוונטית.',
      how: [
        'סקירה שבועית של הוצאות',
        'בדיקה חודשית של עמידה בתקציב',
        'עדכון יעדים לפי שינויים בחיים',
        'ניתוח רבעוני של מגמות',
        'התאמות בתקציב לפי צורך',
      ],
      example: 'כל יום ראשון: 10 דקות סקירה של השבוע. כל ראש חודש: 30 דקות סיכום החודש ותכנון הבא.',
      duration: 'שוטף - לכל החיים!',
      output: 'בריאות פיננסית מלאה ושליטה בכסף',
    },
  ];

  return (
    <div className="min-h-screen bg-dashboard">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-theme-primary mb-2">
            מסלול ההבראה הפיננסית 🎯
          </h1>
          <p className="text-theme-secondary">
            5 שלבים להשגת בריאות פיננסית מלאה - אתה נמצא בשלב: <span className="font-bold text-blue-600 dark:text-blue-400">{phases.find(p => p.id === currentPhase)?.name}</span>
          </p>
        </div>

        {/* Current Phase Indicator */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-blue-900 dark:text-blue-100">
                {phases.find(p => p.id === currentPhase)?.name}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                זה השלב שבו אתה נמצא כרגע
              </p>
            </div>
          </div>
        </div>

        {/* Phases List */}
        <div className="space-y-6">
          {phases.map((phase, index) => {
            const Icon = phase.icon;
            const isCurrentPhase = phase.id === currentPhase;
            const isPastPhase = phases.findIndex(p => p.id === currentPhase) > index;

            return (
              <div 
                key={phase.id}
                className={`bg-card-dark border rounded-2xl p-6 shadow-lg transition-all ${
                  isCurrentPhase 
                    ? 'border-blue-500 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-900' 
                    : 'border-theme'
                }`}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    phase.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    phase.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                    phase.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' :
                    phase.color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                    'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    <Icon className={`w-7 h-7 ${
                      phase.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                      phase.color === 'green' ? 'text-green-600 dark:text-green-400' :
                      phase.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                      phase.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                      'text-red-600 dark:text-red-400'
                    }`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-2xl font-bold text-theme-primary">{phase.name}</h2>
                      {isCurrentPhase && (
                        <span className="px-3 py-1 bg-blue-500 text-white text-sm font-bold rounded-full">
                          שלב נוכחי
                        </span>
                      )}
                      {isPastPhase && (
                        <CheckCircle2 className="w-6 h-6 text-green-500 dark:text-green-400" />
                      )}
                    </div>
                    <p className="text-lg text-theme-secondary mb-4">{phase.description}</p>
                    <div className="inline-flex items-center gap-2 text-sm text-theme-tertiary">
                      <span>⏱️ משך: {phase.duration}</span>
                    </div>
                  </div>
                </div>

                {/* Why */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-theme-primary mb-2">💡 למה זה חשוב?</h3>
                  <p className="text-theme-secondary">{phase.why}</p>
                </div>

                {/* How */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-theme-primary mb-2">🎯 איך עושים את זה?</h3>
                  <ul className="space-y-2">
                    {phase.how.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-theme-secondary">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-bold">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Example */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-bold text-green-900 dark:text-green-100 mb-2">
                    📝 דוגמה
                  </h3>
                  <p className="text-green-800 dark:text-green-200">{phase.example}</p>
                </div>

                {/* Output */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">
                    ✅ תוצאה
                  </h3>
                  <p className="text-blue-800 dark:text-blue-200">{phase.output}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            ← חזרה לדשבורד
          </Link>
        </div>
      </div>
    </div>
  );
}

