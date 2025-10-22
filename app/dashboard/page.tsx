import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Wallet, TrendingUp, TrendingDown, Target, DollarSign, CreditCard, PlusCircle } from 'lucide-react'
import { NetWorthCard } from '@/components/dashboard/NetWorthCard'
import { CurrentAccountCard } from '@/components/dashboard/CurrentAccountCard'
import { PhaseProgressCard } from '@/components/dashboard/PhaseProgressCard'
import { PhaseProgressBar } from '@/components/dashboard/PhaseProgressBar'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { QuickActionsBar } from '@/components/dashboard/QuickActionsBar'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  // בדיקת אימות
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // קבלת נתוני משתמש
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/login')
  }

  const userDataInfo = userData as any

  // אם אין מנוי פעיל - הפנה לתשלום
  if (userDataInfo.subscription_status !== 'active') {
    redirect('/payment')
  }

  // קבלת פרופיל פיננסי מלא
  const { data: userProfile } = await supabase
    .from('user_financial_profile')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // קבלת ציון בריאות פיננסית
  const { data: healthScore } = await supabase.rpc('calculate_financial_health', {
    p_user_id: user.id,
  } as any)

  // קבלת הלוואות
  const { data: loans } = await supabase
    .from('loans')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)

  // קבלת חיסכון
  const { data: savings } = await supabase
    .from('savings_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)

  // קבלת ביטוחים
  const { data: insurances } = await supabase
    .from('insurance')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)

  // קבלת פנסיה
  const { data: pensions } = await supabase
    .from('pension_insurance')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)

  // קבלת הכנסות
  const { data: incomeSources } = await supabase
    .from('income_sources')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)

  // חישובים
  const profile: any = userProfile || {}
  const score = Number(healthScore) || 0

  const totalLoans = (loans || []).reduce((sum: number, loan: any) => 
    sum + (Number(loan.current_balance) || 0), 0)
  
  const totalSavings = (savings || []).reduce((sum: number, acc: any) => 
    sum + (Number(acc.current_balance) || 0), 0)
  
  const totalPension = (pensions || []).reduce((sum: number, pen: any) => 
    sum + (Number(pen.current_balance) || 0), 0)
  
  const totalInsurance = (insurances || []).reduce((sum: number, ins: any) => 
    sum + (Number(ins.monthly_premium) || 0), 0)
  
  const monthlyIncome = (incomeSources || []).reduce((sum: number, src: any) => 
    sum + (Number(src.net_amount) || 0), 0)

  const totalAssets = totalSavings + totalPension + (Number(profile.investments) || 0)
  const totalLiabilities = totalLoans + (Number(profile.total_debt) || 0)
  const netWorth = totalAssets - totalLiabilities
  const currentAccount = Number(profile.current_account_balance) || 0

  // קבלת סטטוס השלמת סקציות (לשלב data_collection)
  const { data: dataSections } = await supabase
    .from('user_data_sections')
    .select('*')
    .eq('user_id', user.id)

  const sections = {
    income: dataSections?.some((s: any) => s.subsection === 'income' && s.completed) ?? false,
    expenses: dataSections?.some((s: any) => s.subsection === 'expenses' && s.completed) ?? false,
    loans: dataSections?.some((s: any) => s.subsection === 'loans' && s.completed) ?? false,
    savings: dataSections?.some((s: any) => s.subsection === 'savings' && s.completed) ?? false,
    cash_flow: dataSections?.some((s: any) => s.subsection === 'cash_flow' && s.completed) ?? false,
    investments: dataSections?.some((s: any) => s.subsection === 'investments' && s.completed) ?? false,
    insurance: dataSections?.some((s: any) => s.subsection === 'insurance' && s.completed) ?? false,
  }

  return (
    <div className="min-h-screen bg-dashboard">
      <div className="container mx-auto px-4 py-8">
      {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-theme-primary mb-2">
            שלום, {userDataInfo.name}! 👋
                </h1>
          <p className="text-lg text-theme-secondary">
            סקירה כללית של המצב הפיננסי שלך
          </p>
            </div>

        {/* Quick Actions Bar */}
        <QuickActionsBar />

        {/* Phase Progress - Only if in data_collection phase */}
        <PhaseProgressCard 
          userName={userDataInfo.name}
          currentPhase={userDataInfo.phase}
          sections={sections}
        />

        {/* Phase Progress Bar - All 5 Phases */}
        <PhaseProgressBar 
          currentPhase={userDataInfo.phase}
          sections={sections}
        />

        {/* ציון בריאות פיננסית */}
        <div className="bg-card-dark border border-theme rounded-2xl p-8 mb-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-theme-primary">ציון בריאות פיננסית</h2>
              <InfoTooltip
                content="הציון מחושב על בסיס הכנסות, הוצאות, חובות, חיסכון והתנהלות פיננסית כללית. ציון גבוה = מצב פיננסי טוב יותר"
                type="info"
              />
            </div>
            <div className="text-6xl font-black text-blue-600">{score}<span className="text-3xl text-theme-tertiary">/100</span></div>
            </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-4">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${score}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-base text-theme-secondary">
              {score >= 80 ? '🎉 מעולה! המצב הפיננסי שלך נהדר' : score >= 60 ? '👍 טוב! אתה בכיוון הנכון' : score >= 40 ? '⚠️ ניתן לשפר - יש לך פוטנציאל' : '💪 בואו נשפר את המצב ביחד'}
            </p>
            {score < 80 && (
              <Link href="/dashboard/phases">
                <Button variant="outline" size="sm" className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  טיפים לשיפור
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* סיכום פיננסי - 4 כרטיסים */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* מצב חשבון */}
          <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Wallet className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-theme-tertiary text-sm font-medium">מצב חשבון עו&quot;ש</p>
              <InfoTooltip
                content="היתרה הנוכחית בחשבון העו&quot;ש שלך - הכסף הזמין לשימוש מיידי"
                type="info"
              />
            </div>
            <p className={`text-3xl font-bold mb-3 ${currentAccount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {currentAccount >= 0 ? '+' : ''}₪{currentAccount.toLocaleString('he-IL')}
            </p>
            <Link href="/dashboard/cash-flow">
              <Button variant="ghost" size="sm" className="w-full text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                <PlusCircle className="w-4 h-4 ml-2" />
                עדכן יתרה
              </Button>
            </Link>
                </div>

          {/* הכנסה חודשית */}
          <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-theme-tertiary text-sm font-medium">הכנסה חודשית</p>
              <InfoTooltip
                content="סכום כל ההכנסות החודשיות הקבועות שלך מכל המקורות"
                type="info"
              />
            </div>
            <p className="text-3xl font-bold text-theme-primary mb-3">
              ₪{monthlyIncome.toLocaleString('he-IL')}
            </p>
            <Link href="/dashboard/income">
              <Button variant="ghost" size="sm" className="w-full text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                <PlusCircle className="w-4 h-4 ml-2" />
                הוסף הכנסה
              </Button>
            </Link>
                </div>

          {/* חובות */}
          <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-theme-tertiary text-sm font-medium">סך החובות</p>
              <InfoTooltip
                content="סך כל ההלוואות והחובות הפעילים שלך - מה שאתה צריך להחזיר"
                type="info"
              />
            </div>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400 mb-3">
              ₪{totalLiabilities.toLocaleString('he-IL')}
            </p>
            <Link href="/dashboard/loans">
              <Button variant="ghost" size="sm" className="w-full text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                <PlusCircle className="w-4 h-4 ml-2" />
                נהל הלוואות
              </Button>
            </Link>
              </div>

          {/* שווי נטו */}
          <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-theme-tertiary text-sm font-medium">שווי נטו</p>
              <InfoTooltip
                content="נכסים פחות חובות - המצב הפיננסי הכולל שלך. ככל שהמספר גבוה יותר, המצב טוב יותר"
                type="info"
              />
            </div>
            <p className={`text-3xl font-bold mb-3 ${netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {netWorth >= 0 ? '+' : ''}₪{netWorth.toLocaleString('he-IL')}
            </p>
            <Link href="/dashboard/overview">
              <Button variant="ghost" size="sm" className="w-full text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                צפה בסיכום מלא
              </Button>
            </Link>
          </div>
        </div>

        {/* גרפים ויזואליים */}
        <DashboardCharts loans={loans || []} />

        {/* ניהול נכסים וחובות */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* הלוואות */}
          <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-theme-primary">הלוואות</h3>
              <Link href="/dashboard/loans" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                ניהול →
              </Link>
                  </div>
            {loans && loans.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-theme-secondary">סך יתרה:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">₪{totalLoans.toLocaleString('he-IL')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-theme-secondary">מספר הלוואות:</span>
                  <span className="font-bold text-theme-primary">{loans.length}</span>
                </div>
              </div>
            ) : (
              <p className="text-theme-tertiary text-sm">אין הלוואות רשומות</p>
            )}
          </div>

          {/* חיסכון */}
          <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-theme-primary">חיסכון</h3>
              <Link href="/dashboard/savings" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                ניהול →
              </Link>
            </div>
            {savings && savings.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-theme-secondary">סך יתרה:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">₪{totalSavings.toLocaleString('he-IL')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-theme-secondary">מספר חשבונות:</span>
                  <span className="font-bold text-theme-primary">{savings.length}</span>
                </div>
          </div>
            ) : (
              <p className="text-theme-tertiary text-sm">אין חשבונות חיסכון רשומים</p>
            )}
        </div>

          {/* ביטוח */}
          <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-theme-primary">ביטוחים</h3>
              <Link href="/dashboard/insurance" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                ניהול →
              </Link>
            </div>
            {insurances && insurances.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-theme-secondary">פרמיה חודשית:</span>
                  <span className="font-bold text-theme-primary">₪{totalInsurance.toLocaleString('he-IL')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-theme-secondary">מספר פוליסות:</span>
                  <span className="font-bold text-theme-primary">{insurances.length}</span>
                </div>
              </div>
            ) : (
              <p className="text-theme-tertiary text-sm">אין ביטוחים רשומים</p>
          )}
      </div>

          {/* פנסיה */}
          <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-theme-primary">פנסיה וקופות גמל</h3>
              <Link href="/dashboard/pensions" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                ניהול →
              </Link>
            </div>
            {pensions && pensions.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-theme-secondary">סך יתרה:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">₪{totalPension.toLocaleString('he-IL')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-theme-secondary">מספר קרנות:</span>
                  <span className="font-bold text-theme-primary">{pensions.length}</span>
    </div>
      </div>
            ) : (
              <p className="text-theme-tertiary text-sm">אין קרנות פנסיה רשומות</p>
            )}
        </div>
      </div>
      
        {/* פעולות מהירות */}
        <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-theme-primary mb-4">פעולות מהירות</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link 
              href="/dashboard/income"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-theme hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
              <span className="text-sm text-theme-secondary">הכנסות</span>
            </Link>
            <Link 
              href="/dashboard/expenses"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-theme hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <CreditCard className="w-6 h-6 text-red-600 dark:text-red-400" />
              <span className="text-sm text-theme-secondary">הוצאות</span>
            </Link>
            <Link 
              href="/dashboard/loans"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-theme hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <TrendingDown className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              <span className="text-sm text-theme-secondary">הלוואות</span>
            </Link>
            <Link 
              href="/loans-simulator"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-theme hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-theme-secondary">סימולטור</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

