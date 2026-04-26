import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle2, Target, TrendingUp, PiggyBank, Eye, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { PageWrapper, PageHeader, InsightBanner, Card, PhiButton } from '@/components/ui/design-system'

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

  const currentPhaseData = phases.find(p => p.id === currentPhase)

  return (
    <PageWrapper>
      <PageHeader
        title="מסלול ההבראה הפיננסית"
        subtitle={`5 שלבים — כרגע אתה ב: ${currentPhaseData?.name || ''}`}
      />

      <InsightBanner variant="info" icon={CheckCircle2} title={currentPhaseData?.name}>
        זה השלב שבו אתה נמצא כרגע. ההתקדמות לשלב הבא קורית באופן הדרגתי לפי הדאטה ושימוש במערכת.
      </InsightBanner>

      {/* Phases List */}
      <div className="space-y-4">
        {phases.map((phase, index) => {
          const Icon = phase.icon;
          const isCurrentPhase = phase.id === currentPhase;
          const isPastPhase = phases.findIndex(p => p.id === currentPhase) > index;

          return (
            <Card
              key={phase.id}
              className={isCurrentPhase ? 'ring-2 ring-phi-gold/40 border-phi-gold/30' : ''}
              padding="lg"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${isPastPhase ? 'bg-emerald-50' : isCurrentPhase ? 'bg-phi-gold/15' : 'bg-gray-50'}`}>
                  <Icon className={`w-7 h-7 ${isPastPhase ? 'text-phi-mint' : isCurrentPhase ? 'text-phi-gold' : 'text-gray-400'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-gray-900">{phase.name}</h2>
                    {isCurrentPhase && (
                      <span className="px-2.5 py-0.5 bg-phi-gold text-white text-xs font-bold rounded-full">
                        שלב נוכחי
                      </span>
                    )}
                    {isPastPhase && <CheckCircle2 className="w-5 h-5 text-phi-mint" />}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{phase.description}</p>
                  <p className="text-xs text-gray-400">משך משוער: {phase.duration}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">למה זה חשוב</h3>
                  <p className="text-gray-700 leading-relaxed">{phase.why}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">איך עושים את זה</h3>
                  <ul className="space-y-1.5">
                    {phase.how.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-700">
                        <span className="flex-shrink-0 w-5 h-5 bg-phi-dark text-phi-gold rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-900 mb-1">דוגמה</p>
                  <p className="text-sm text-amber-900/80">{phase.example}</p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-phi-mint mb-1">תוצאה</p>
                  <p className="text-sm text-gray-700">{phase.output}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="text-center pt-2">
        <Link href="/dashboard">
          <PhiButton variant="primary">חזרה לדשבורד</PhiButton>
        </Link>
      </div>
    </PageWrapper>
  );
}

