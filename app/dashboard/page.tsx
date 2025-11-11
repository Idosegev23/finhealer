import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Wallet, TrendingUp, TrendingDown, Target, PlusCircle, ArrowRight, Calculator, BarChart3, BookOpen } from 'lucide-react'
import { PhaseProgressBar } from '@/components/dashboard/PhaseProgressBar'
import { ExpensesDrilldownChart } from '@/components/dashboard/ExpensesDrilldownChart'
import { IncomeDrilldownChart } from '@/components/dashboard/IncomeDrilldownChart'
import { AssetsLiabilitiesDrilldownChart } from '@/components/dashboard/AssetsLiabilitiesDrilldownChart'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PendingTransactionsBanner } from '@/components/dashboard/PendingTransactionsBanner'

// Phase-specific dashboards
import { OnboardingDashboard } from '@/components/dashboard/phases/OnboardingDashboard'
import { BehaviorDashboard } from '@/components/dashboard/phases/BehaviorDashboard'
import { BudgetDashboard } from '@/components/dashboard/phases/BudgetDashboard'
import { GoalsDashboard } from '@/components/dashboard/phases/GoalsDashboard'
import { FullDashboard } from '@/components/dashboard/phases/FullDashboard'

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

  // קבלת יתרת בנק נוכחית
  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_current', true)

  // קבלת תנועות החודש (parent transactions + cash expenses)
  // כולל: תנועות מדוח בנק (is_source_transaction), תנועות מזומן (is_cash_expense), תנועות אחרות
  // ⭐ רק תנועות מאושרות (confirmed) - לא ממתינות לאישור!
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const { data: monthlyTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'confirmed') // ⭐ רק תנועות מאושרות - לא ממתינות!
    .gte('date', `${currentMonth}-01`)
    .lte('date', `${currentMonth}-31`)
    .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true') // כולל תנועות parent + מזומן

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
  
  // חישוב הכנסות והוצאות מתנועות בפועל (רק parent transactions)
  const monthlyIncomeFromTransactions = (monthlyTransactions || [])
    .filter((tx: any) => tx.type === 'income')
    .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0)
  
  const monthlyExpensesFromTransactions = (monthlyTransactions || [])
    .filter((tx: any) => tx.type === 'expense')
    .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0)

  // הכנסה חודשית: העדיפו מתנועות בפועל, או מ-income_sources כברירת מחדל
  const monthlyIncome = monthlyIncomeFromTransactions > 0 
    ? monthlyIncomeFromTransactions 
    : (incomeSources || []).reduce((sum: number, src: any) => sum + (Number(src.net_amount) || 0), 0)

  // יתרת בנק נוכחית
  const currentBankBalance = (bankAccounts || []).reduce((sum: number, acc: any) => 
    sum + (Number(acc.current_balance) || 0), 0)

  const totalAssets = totalSavings + totalPension + (Number(profile.investments) || 0) + currentBankBalance
  const totalLiabilities = totalLoans + (Number(profile.total_debt) || 0)
  const netWorth = totalAssets - totalLiabilities
  const currentAccount = currentBankBalance > 0 ? currentBankBalance : Number(profile.current_account_balance) || 0

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

  // לוגיקה חכמה לכפתורים
  const hasIncome = (incomeSources?.length || 0) > 0
  const hasLoans = (loans?.length || 0) > 0
  const hasSavings = (savings?.length || 0) > 0
  const hasInsurance = (insurances?.length || 0) > 0
  const hasPensions = (pensions?.length || 0) > 0

  // Phase-based dashboard selection
  const currentPhase = userDataInfo.phase || 'reflection'
  
  // Phase 1-4 show simplified dashboards
  // Phase 5 (monitoring) shows full dashboard
  if (currentPhase === 'reflection') {
    return (
      <div className="min-h-screen bg-dashboard">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <PendingTransactionsBanner />
          <OnboardingDashboard />
        </div>
      </div>
    )
  }

  if (currentPhase === 'behavior') {
    return (
      <div className="min-h-screen bg-dashboard">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <PendingTransactionsBanner />
          <BehaviorDashboard />
        </div>
      </div>
    )
  }

  if (currentPhase === 'budget') {
    return (
      <div className="min-h-screen bg-dashboard">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <PendingTransactionsBanner />
          <BudgetDashboard />
        </div>
      </div>
    )
  }

  if (currentPhase === 'goals') {
    return (
      <div className="min-h-screen bg-dashboard">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <PendingTransactionsBanner />
          <GoalsDashboard />
        </div>
      </div>
    )
  }

  // Phase 5 (monitoring) or data_collection - show full dashboard
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto px-8 py-8 max-w-7xl">
        <PendingTransactionsBanner />
        {/* Header */}
        <div className="mb-8 bg-gradient-to-l from-phi-gold/10 to-phi-coral/10 dark:from-phi-gold/5 dark:to-phi-coral/5 rounded-2xl p-6 border-4 border-phi-gold/20">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            שלום, {userDataInfo.name}! 👋
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            סקירה כללית של המצב הפיננסי שלך
          </p>
        </div>

        {/* Phase Progress Bar - All 5 Phases */}
        <PhaseProgressBar 
          currentPhase={userDataInfo.phase}
          sections={sections}
        />

        {/* ציון בריאות פיננסית */}
        <div className="bg-white dark:bg-phi-dark border border-phi-gold/30 rounded-2xl p-8 mb-8 shadow-xl hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">ציון ϕ (Phi)</h2>
              <InfoTooltip
                content="הציון מחושב על בסיס הכנסות, הוצאות, חובות, חיסכון והתנהלות פיננסית כללית. ציון גבוה = מצב פיננסי טוב יותר"
                type="info"
              />
            </div>
            <div className="text-6xl font-black text-phi-gold">
              {score}<span className="text-3xl text-gray-500 dark:text-gray-400">/100</span>
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-4">
            <div 
              className="bg-gradient-to-r from-phi-gold to-phi-coral h-4 rounded-full transition-all duration-500 shadow-lg"
              style={{ width: `${score}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-base text-gray-600 dark:text-gray-300">
              {score >= 80 ? '🎉 מעולה! המצב הפיננסי שלך נהדר' : 
               score >= 60 ? '👍 טוב! אתה בכיוון הנכון' : 
               score >= 40 ? '⚠️ ניתן לשפר - יש לך פוטנציאל' : 
               '💪 בואו נשפר את המצב ביחד'}
            </p>
            {score < 80 && (
              <Link href="/dashboard/phases">
                <Button variant="outline" size="sm" className="text-phi-gold border-phi-gold hover:bg-phi-gold/10">
                  טיפים לשיפור
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* גרפים אינטראקטיביים - פאי להכנסות ולהוצאות */}
        <div className="mb-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ExpensesDrilldownChart />
            <IncomeDrilldownChart />
          </div>
          
          <div className="w-full">
            <AssetsLiabilitiesDrilldownChart />
          </div>
        </div>

        {/* סיכום פיננסי - 5 כרטיסים עם כפתורים חכמים */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {/* מצב חשבון */}
          <div className="bg-white dark:bg-phi-dark border border-phi-gold/20 rounded-xl p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Wallet className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="bg-green-500 rounded-full h-6 px-2 flex items-center text-white font-semibold text-xs">
                <span>פעיל</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">חשבון עו&quot;ש</p>
              <InfoTooltip
                content="היתרה הנוכחית בחשבון העו&quot;ש שלך"
                type="info"
              />
            </div>
            <p className={`text-3xl font-bold mb-3 ${currentAccount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {currentAccount >= 0 ? '+' : ''}₪{currentAccount.toLocaleString('he-IL')}
            </p>
            <Link href="/dashboard/cash-flow" className="block">
              <Button variant="ghost" size="sm" className="w-full text-phi-gold hover:bg-phi-gold/10 border border-phi-gold/30">
                <PlusCircle className="w-4 h-4 ml-2" />
                עדכן יתרה
              </Button>
            </Link>
          </div>

          {/* הכנסה חודשית */}
          <div className="bg-white dark:bg-phi-dark border border-phi-gold/20 rounded-xl p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="bg-blue-500 rounded-full h-6 px-2 flex items-center text-white font-semibold text-xs">
                <span>חודשי</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">הכנסה חודשית</p>
              <InfoTooltip
                content="סכום כל ההכנסות החודשיות הקבועות שלך"
                type="info"
              />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              ₪{monthlyIncome.toLocaleString('he-IL')}
            </p>
            <Link href="/dashboard/income" className="block">
              <Button variant="ghost" size="sm" className="w-full text-phi-gold hover:bg-phi-gold/10 border border-phi-gold/30">
                {hasIncome ? (
                  <>
                    <ArrowRight className="w-4 h-4 ml-2" />
                    נהל הכנסות
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4 ml-2" />
                    הוסף הכנסה ראשונה
                  </>
                )}
              </Button>
            </Link>
          </div>

          {/* הוצאות החודש */}
          <div className="bg-white dark:bg-phi-dark border border-phi-gold/20 rounded-xl p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingDown className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="bg-red-500 rounded-full h-6 px-2 flex items-center text-white font-semibold text-xs">
                <span>חודשי</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">הוצאות החודש</p>
              <InfoTooltip
                content="סך כל ההוצאות בחודש הנוכחי (רק תנועות מאושרות)"
                type="info"
              />
            </div>
            <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-3">
              ₪{monthlyExpensesFromTransactions.toLocaleString('he-IL')}
            </p>
            <Link href="/dashboard/expenses" className="block">
              <Button variant="ghost" size="sm" className="w-full text-phi-gold hover:bg-phi-gold/10 border border-phi-gold/30">
                <ArrowRight className="w-4 h-4 ml-2" />
                ניהול הוצאות
              </Button>
            </Link>
          </div>

          {/* חובות */}
          <div className="bg-white dark:bg-phi-dark border border-phi-gold/20 rounded-xl p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="bg-yellow-500 rounded-full h-6 px-2 flex items-center text-white font-semibold text-xs">
                <span>פעיל</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">סך החובות</p>
              <InfoTooltip
                content="סך כל ההלוואות והחובות הפעילים שלך"
                type="info"
              />
            </div>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400 mb-3">
              ₪{totalLiabilities.toLocaleString('he-IL')}
            </p>
            {hasLoans ? (
              <Link href="/loans-simulator" className="block">
                <Button variant="ghost" size="sm" className="w-full text-phi-gold hover:bg-phi-gold/10 border border-phi-gold/30">
                  <Calculator className="w-4 h-4 ml-2" />
                  סימולטור איחוד
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard/loans" className="block">
                <Button variant="ghost" size="sm" className="w-full text-phi-gold hover:bg-phi-gold/10 border border-phi-gold/30">
                  <PlusCircle className="w-4 h-4 ml-2" />
                  הוסף הלוואה
                </Button>
              </Link>
            )}
          </div>

          {/* שווי נטו */}
          <div className="bg-white dark:bg-phi-dark border border-phi-gold/20 rounded-xl p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className={`${netWorth >= 0 ? 'bg-green-500' : 'bg-red-500'} rounded-full h-6 px-2 flex items-center text-white font-semibold text-xs`}>
                <span>{netWorth >= 0 ? 'חיובי' : 'שלילי'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">שווי נטו</p>
              <InfoTooltip
                content="נכסים פחות חובות - המצב הפיננסי הכולל שלך"
                type="info"
              />
            </div>
            <p className={`text-3xl font-bold mb-3 ${netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {netWorth >= 0 ? '+' : ''}₪{netWorth.toLocaleString('he-IL')}
            </p>
            <Link href="/dashboard/overview" className="block">
              <Button variant="ghost" size="sm" className="w-full text-phi-gold hover:bg-phi-gold/10 border border-phi-gold/30">
                <ArrowRight className="w-4 h-4 ml-2" />
                צפה בפירוט
              </Button>
            </Link>
          </div>
        </div>
        <div className="bg-white dark:bg-phi-dark border border-phi-gold/30 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">פעולות נוספות</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* הוצאות - תמיד מוצג */}
            <Link 
              href="/dashboard/expenses"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-phi-gold/30 hover:bg-phi-gold/10 dark:hover:bg-phi-gold/5 transition-colors"
            >
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">רשום הוצאה</span>
            </Link>

            {/* סקירת הוצאות - חדש */}
            <Link 
              href="/dashboard/expenses-overview"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-phi-gold/30 hover:bg-phi-gold/10 dark:hover:bg-phi-gold/5 transition-colors"
            >
              <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">סקירת הוצאות</span>
            </Link>

            {/* חיסכון - חכם */}
            <Link 
              href="/dashboard/savings"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-phi-gold/30 hover:bg-phi-gold/10 dark:hover:bg-phi-gold/5 transition-colors"
            >
              <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {hasSavings ? 'חיסכון' : 'פתח חיסכון'}
              </span>
            </Link>

            {/* ביטוח - חכם */}
            {!hasInsurance && (
              <Link 
                href="/dashboard/insurance"
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-phi-gold/30 hover:bg-phi-gold/10 dark:hover:bg-phi-gold/5 transition-colors"
              >
                <Target className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">הוסף ביטוח</span>
              </Link>
            )}

            {/* פנסיה - חכם */}
            {!hasPensions && (
              <Link 
                href="/dashboard/pensions"
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-phi-gold/30 hover:bg-phi-gold/10 dark:hover:bg-phi-gold/5 transition-colors"
              >
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">הוסף פנסיה</span>
              </Link>
            )}

            {/* הלוואות - רק אם יש */}
            {hasLoans && (
              <Link 
                href="/dashboard/loans"
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-phi-gold/30 hover:bg-phi-gold/10 dark:hover:bg-phi-gold/5 transition-colors"
              >
                <ArrowRight className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">נהל הלוואות</span>
              </Link>
            )}

            {/* מדריך - רק אם הציון נמוך */}
            {score < 70 && (
              <Link 
                href="/guide"
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-phi-gold/30 hover:bg-phi-gold/10 dark:hover:bg-phi-gold/5 transition-colors"
              >
                <BookOpen className="w-6 h-6 text-phi-gold" />
                <span className="text-sm text-gray-600 dark:text-gray-300">מדריך</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
