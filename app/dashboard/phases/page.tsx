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
  // Legacy compat: any user still on `reflection` is shown as data_collection
  const currentPhase = userDataInfo.phase === 'reflection' ? 'data_collection' : (userDataInfo.phase || 'data_collection')

  const phases = [
    {
      id: 'data_collection',
      name: 'שלב 1: איסוף נתונים',
      icon: Eye,
      color: 'blue',
      description: 'תמונה מלאה של מה שקורה',
      why: 'אי אפשר לשפר מה שלא יודעים. אנחנו מתחילים בלהביא דוחות אמיתיים מהבנק והאשראי, מסווגים כל תנועה, ובונים תמונה מדויקת של הכסף שלך.',
      how: [
        'העלאת דוחות בנק ואשראי של 3-6 חודשים אחרונים',
        'AI מסווג אוטומטית — אתה רק מאשר/מתקן',
        'φ לומד מכל תיקון — בפעם הבאה הוא יסווג נכון',
        'זיהוי הוצאות חוזרות, מנויים, הלוואות',
        'גילוי כפילויות (אותה תנועה גם בבנק וגם באשראי)',
      ],
      example: 'אחרי שעה אחת — יש לנו 200+ תנועות מסווגות, ויודעים בדיוק לאן הולך כל שקל בכל חודש.',
      duration: '1-2 שבועות',
      output: 'תמונת מצב מלאה של הנתונים הפיננסיים',
    },
    {
      id: 'behavior',
      name: 'שלב 2: ניתוח דפוסים',
      icon: TrendingUp,
      color: 'green',
      description: 'מבינים את ההרגלים האמיתיים',
      why: 'אחרי שיש לנו דאטה, אפשר לראות תמונות מעניינות — מה הקטגוריות שצומחות, איפה ההרגלים הקטנים מצטברים, מה ההפתעות.',
      how: [
        'זיהוי דפוסים יומיים/שבועיים (שישי = משלוחים)',
        'מציאת מנויים שכוחים',
        'השוואה מול ממוצעים אישיים',
        'תובנות פרואקטיביות — "שמתי לב שאתה מוציא 47% יותר על מסעדות מהממוצע שלך"',
        'הצעות לשינוי הדרגתי, לא דרסטי',
      ],
      example: 'שמתי לב: 15 משלוחים מוולט בחודש = 850 ₪. אם נוריד ל-10 — תחסוך 300 ₪ בלי להרגיש.',
      duration: '2-4 שבועות מעקב פעיל',
      output: 'הבנה עמוקה של ההרגלים הפיננסיים',
    },
    {
      id: 'goals',
      name: 'שלב 3: יעדים ומטרות 🆕',
      icon: Target,
      color: 'orange',
      description: 'מה החלום? לאן רצים?',
      why: 'יעדים *לפני* תקציב — צריך לדעת לאן רוצים להגיע כדי לבנות תקציב שתומך בזה. בלי יעד, תקציב הוא רק רשימת הגבלות.',
      how: [
        'הגדרת יעדים: רכב, חופשה, דירה, סגירת חוב, קרן חירום',
        'חישוב כמה צריך לחסוך בחודש לכל יעד',
        'פתרון התנגשויות — אם יש 3 יעדים והתקציב לא מספיק, איך מאזנים',
        'עדיפויות וזמן — איזה יעד דחוף יותר?',
        'איזון אוטומטי — היעד הדחוף מקבל יותר תקציב',
      ],
      example: 'יעד: "רכב חדש 80,000₪ בעוד שנתיים" → 3,333₪ לחודש. נבדוק בשלב הבא אם זה ריאלי.',
      duration: 'שוטף - מעקב חודשי',
      output: 'יעדים מוגדרים עם הקצאה חודשית מותאמת',
    },
    {
      id: 'budget',
      name: 'שלב 4: תקציב מבוסס יעדים 🆕',
      icon: BarChart3,
      color: 'purple',
      description: 'תקציב שתומך ביעדים שהגדרת',
      why: 'תקציב זה לא הגבלה — זו תכנית להגיע ליעדים. אחרי שיודעים מה היעד, התקציב נבנה כך שהוא מאפשר אותו.',
      how: [
        'AI בונה תקציב מותאם אישית לפי הרגלים והיעדים',
        'אתה רואה את ההמלצה ומאשר/משנה',
        'שינויים הדרגתיים — לא משנים הכל בבת אחת',
        'דאגה לחיסכון של לפחות 10% לכל יעד',
        'הגדרת אזהרות לחריגות',
      ],
      example: 'הכנסה 15,000₪. אחרי קבועות (5,000) + חיסכון ליעדים (3,500) — נשאר 6,500 לקטגוריות גמישות.',
      duration: '1 שבוע להקמה + מעקב שוטף',
      output: 'תקציב מפורט עם התראות וניטור',
    },
    {
      id: 'monitoring',
      name: 'שלב 5: מעקב ובקרה',
      icon: PiggyBank,
      color: 'red',
      description: 'ליווי שוטף, התאמות לחיים',
      why: 'החיים משתנים — הכנסות עולות/יורדות, יעדים מתעדכנים. מעקב רציף שומר על התכנית רלוונטית.',
      how: [
        'סיכומים שבועיים אוטומטיים',
        'התראות על חריגות בזמן אמת',
        'התאמות לתקציב כשהכנסה משתנה (±10%)',
        'חגיגות באבני דרך (25%, 50%, 75%, 100% מהיעד)',
        'הצעת איחוד הלוואות אם רלוונטי',
      ],
      example: 'יום ראשון בבוקר: סיכום השבוע. ראש חודש: ציון φ + סיכום החודש.',
      duration: 'שוטף - לכל החיים',
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

