import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Wallet, TrendingUp, TrendingDown, Target, BarChart3, BookOpen, Calculator } from 'lucide-react'
import { PhaseProgressBar } from '@/components/dashboard/PhaseProgressBar'
import { TabsChart } from '@/components/dashboard/TabsChart'
import { KPICard } from '@/components/dashboard/KPICard'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PendingTransactionsBanner } from '@/components/dashboard/PendingTransactionsBanner'
import MissingDocumentsWidget from '@/components/dashboard/MissingDocumentsWidget'
import { DataCollectionDashboard } from '@/components/dashboard/DataCollectionDashboard'
import { DataCollectionPrompt } from '@/components/dashboard/DataCollectionPrompt'
import { getDaysOfData } from '@/lib/utils/phase-calculator'

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

  // ✨ שילוב queries - קבלת כל החשבונות הפיננסיים בבת אחת
  const [
    { data: loans },
    { data: savings },
    { data: insurances },
    { data: pensions },
    { data: incomeSources },
    { data: bankAccounts },
  ] = await Promise.all([
    supabase.from('loans').select('current_balance, active').eq('user_id', user.id).eq('active', true),
    supabase.from('savings_accounts').select('current_balance, active').eq('user_id', user.id).eq('active', true),
    supabase.from('insurance').select('monthly_premium, active').eq('user_id', user.id).eq('active', true),
    supabase.from('pension_insurance').select('current_balance, active').eq('user_id', user.id).eq('active', true),
    supabase.from('income_sources').select('net_amount, active').eq('user_id', user.id).eq('active', true),
    supabase.from('bank_accounts').select('current_balance, is_current').eq('user_id', user.id).eq('is_current', true),
  ])

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
  const currentPhase = userDataInfo.phase || 'data_collection'
  
  // Phase 1: Data Collection - show special dashboard with 2 paths
  if (currentPhase === 'data_collection') {
    // Get days of data and check if user has bank statement
    const daysOfData = await getDaysOfData(user.id);
    
    const { data: bankStatements } = await supabase
      .from('uploaded_statements')
      .select('id')
      .eq('user_id', user.id)
      .eq('document_type', 'bank_statement')
      .eq('status', 'completed')
      .limit(1);
    
    const hasBankStatement = Boolean(bankStatements?.length && bankStatements.length > 0);

    return (
      <div className="min-h-screen bg-gradient-to-br from-phi-mint/10 via-white to-phi-coral/10">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <PendingTransactionsBanner />
          <DataCollectionPrompt userId={user.id} />
          <DataCollectionDashboard 
            daysOfData={daysOfData} 
            hasBankStatement={hasBankStatement}
          />
        </div>
      </div>
    )
  }
  
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
    <div className="min-h-screen bg-gradient-to-br from-phi-mint/10 via-white to-phi-coral/10 dark:from-phi-dark dark:via-gray-900 dark:to-phi-dark">
      <div className="container mx-auto px-4 md:px-8 py-8 max-w-7xl">
        <PendingTransactionsBanner />
        
        {/* Hero Section - גדול וצבעוני */}
        <div className="mb-8 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
            שלום, {userDataInfo.name}! 👋
          </h1>
          <p className="text-xl md:text-3xl font-bold text-phi-gold">
            המסע שלך ל-φ (Phi) מושלם
          </p>
        </div>

        {/* Phase Progress Bar */}
        <PhaseProgressBar 
          currentPhase={userDataInfo.phase}
          sections={sections}
        />

        {/* Missing Documents Widget */}
        <div className="mb-6">
          <MissingDocumentsWidget />
        </div>

        {/* ציון φ - Hero Card ענק וצבעוני! */}
        <div className="bg-gradient-to-br from-amber-400 via-orange-400 to-phi-coral border-8 border-phi-gold rounded-3xl p-10 mb-10 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-right flex-1">
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4 flex items-center justify-center md:justify-start gap-4 drop-shadow-lg">
                ציון ϕ (Phi) שלך
              <InfoTooltip
                  content="הציון מחושב על בסיס הכנסות, הוצאות, חובות, חיסכון והתנהלות פיננסית כללית"
                type="info"
              />
              </h2>
              <p className="text-xl md:text-3xl font-bold text-white mb-6 drop-shadow-md">
              {score >= 80 ? '🎉 מעולה! המצב הפיננסי שלך נהדר' : 
               score >= 60 ? '👍 טוב! אתה בכיוון הנכון' : 
               score >= 40 ? '⚠️ ניתן לשפר - יש לך פוטנציאל' : 
               '💪 בואו נשפר את המצב ביחד'}
            </p>
            {score < 80 && (
              <Link href="/dashboard/phases">
                  <Button size="lg" className="bg-white text-phi-gold hover:bg-gray-100 font-bold text-xl h-16 px-8 shadow-xl">
                    💡 טיפים לשיפור
                </Button>
              </Link>
            )}
          </div>
            <div className="flex flex-col items-center bg-white/20 backdrop-blur-sm rounded-3xl p-8 border-4 border-white/40">
              <div className="text-9xl md:text-[12rem] font-black text-white mb-2 drop-shadow-2xl leading-none">
                {score}
              </div>
              <span className="text-4xl font-bold text-white/90">/100</span>
              <div className="w-48 md:w-56 bg-white/30 rounded-full h-6 mt-6 border-2 border-white/50">
                <div 
                  className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full transition-all duration-500 shadow-lg"
                  style={{ width: `${score}%` }}
                ></div>
              </div>
            </div>
          </div>
          </div>

        {/* 3 KPI Cards - פשוט ומודרני */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: הכנסות vs הוצאות - צבעוני! */}
          <KPICard
            title="מאזן חודשי"
            subtitle={`הכנסות: ₪${monthlyIncome.toLocaleString('he-IL')} | הוצאות: ₪${monthlyExpensesFromTransactions.toLocaleString('he-IL')}`}
            value={monthlyIncome - monthlyExpensesFromTransactions >= 0 
              ? `+₪${(monthlyIncome - monthlyExpensesFromTransactions).toLocaleString('he-IL')}` 
              : `-₪${Math.abs(monthlyIncome - monthlyExpensesFromTransactions).toLocaleString('he-IL')}`}
            icon={monthlyIncome - monthlyExpensesFromTransactions >= 0 ? TrendingUp : TrendingDown}
            iconBgColor={monthlyIncome - monthlyExpensesFromTransactions >= 0 ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-red-400 to-rose-500'}
            iconColor="text-white"
            valueColor={monthlyIncome - monthlyExpensesFromTransactions >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
            badge={{
              text: monthlyIncome - monthlyExpensesFromTransactions >= 0 ? 'עודף' : 'גירעון',
              color: monthlyIncome - monthlyExpensesFromTransactions >= 0 ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-rose-600',
            }}
            tooltip="ההפרש בין ההכנסות להוצאות החודשיות"
            button={{
              text: 'נהל תקציב',
              href: '/dashboard/budget',
              icon: BarChart3,
            }}
          />

          {/* Card 2: שווי נטו - צבעוני! */}
          <KPICard
            title="שווי נטו"
            subtitle="נכסים - חובות"
            value={netWorth >= 0 
              ? `+₪${netWorth.toLocaleString('he-IL')}` 
              : `-₪${Math.abs(netWorth).toLocaleString('he-IL')}`}
            icon={Target}
            iconBgColor="bg-gradient-to-br from-purple-400 to-indigo-500"
            iconColor="text-white"
            valueColor={netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
            badge={{
              text: netWorth >= 0 ? 'חיובי' : 'שלילי',
              color: netWorth >= 0 ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-rose-600',
            }}
            tooltip="המצב הפיננסי הכולל שלך - נכסים פחות חובות"
            button={{
              text: 'צפה בפירוט',
              href: '/dashboard/overview',
            }}
          />

          {/* Card 3: חשבון עו"ש - צבעוני! */}
          <KPICard
            title='חשבון עו"ש'
            subtitle="יתרה נוכחית"
            value={currentAccount >= 0 
              ? `+₪${currentAccount.toLocaleString('he-IL')}` 
              : `-₪${Math.abs(currentAccount).toLocaleString('he-IL')}`}
            icon={Wallet}
            iconBgColor="bg-gradient-to-br from-blue-400 to-cyan-500"
            iconColor="text-white"
            valueColor={currentAccount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
            badge={{
              text: 'פעיל',
              color: 'bg-gradient-to-r from-blue-500 to-cyan-600',
            }}
            tooltip='היתרה הנוכחית בחשבון העו"ש שלך'
            button={{
              text: 'עדכן יתרה',
              href: '/dashboard/cash-flow',
            }}
          />
            </div>

        {/* גרפים אינטראקטיביים - Tabs */}
        <div className="mb-8">
          <TabsChart />
        </div>
        {/* פעולות מהירות - גדול וצבעוני! */}
        <div className="bg-white dark:bg-gray-800 border-4 border-phi-gold/40 rounded-3xl p-8 shadow-2xl">
          <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-6">פעולות מהירות</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* רשום הוצאה - תמיד */}
            <Link 
              href="/dashboard/expenses"
              className="flex flex-col items-center gap-4 p-6 rounded-2xl border-4 border-red-300 bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/20 dark:to-rose-900/20 hover:border-red-500 hover:shadow-2xl transition-all hover:scale-105"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-xl">
                <TrendingDown className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white text-center">רשום הוצאה</span>
            </Link>

            {/* סקירת הוצאות */}
            <Link 
              href="/dashboard/expenses-overview"
              className="flex flex-col items-center gap-4 p-6 rounded-2xl border-4 border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-purple-900/20 dark:to-indigo-900/20 hover:border-purple-500 hover:shadow-2xl transition-all hover:scale-105"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-xl">
                <BarChart3 className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white text-center">סקירת הוצאות</span>
            </Link>

            {/* סימולטור הלוואות - אם יש הלוואות */}
            {hasLoans && (
              <Link 
                href="/loans-simulator"
                className="flex flex-col items-center gap-4 p-6 rounded-2xl border-4 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 hover:border-orange-500 hover:shadow-2xl transition-all hover:scale-105"
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-xl">
                  <Calculator className="w-10 h-10 text-white" strokeWidth={3} />
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white text-center">סימולטור הלוואות</span>
              </Link>
            )}

            {/* מדריך - אם ציון נמוך */}
            {score < 70 && (
              <Link 
                href="/guide"
                className="flex flex-col items-center gap-4 p-6 rounded-2xl border-4 border-phi-gold/60 bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/20 dark:to-yellow-900/20 hover:border-phi-gold hover:shadow-2xl transition-all hover:scale-105"
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-phi-gold to-amber-500 flex items-center justify-center shadow-xl">
                  <BookOpen className="w-10 h-10 text-white" strokeWidth={3} />
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white text-center">מדריך לשיפור</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
