import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Heart, TrendingUp, TrendingDown, Target, Bell, Menu, Settings } from 'lucide-react'
import FinancialOverview from '@/components/dashboard/FinancialOverview'
import DebtVsAssets from '@/components/dashboard/DebtVsAssets'
import SmartInsights from '@/components/dashboard/SmartInsights'
import PhaseProgress from '@/components/dashboard/PhaseProgress'
import GoalsQuickView from '@/components/dashboard/GoalsQuickView'
import ExpenseBreakdown from '@/components/dashboard/ExpenseBreakdown'
import MonthlyBreakdown from '@/components/dashboard/MonthlyBreakdown'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { ProgressiveBanner } from '@/components/dashboard/ProgressiveBanner'
import EmptyDashboard from '@/components/dashboard/EmptyDashboard'
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

  // אם אין מנוי פעיל - הפנה לתשלום
  if (userData.subscription_status !== 'active') {
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
  })

  // קבלת סטטיסטיקות חודשיות
  const { data: monthlyStats } = await supabase
    .from('user_monthly_stats')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // קבלת מעקב תקציב
  const { data: budgetTracking } = await supabase
    .from('monthly_budget_tracking')
    .select('*')
    .eq('user_id', user.id)
    .limit(3)

  // קבלת יעדים פעילים
  const { data: activeGoals } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(3)

  // קבלת התראות אחרונות
  const { data: recentAlerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3)

  // קבלת ספירת תנועות
  const { count: transactionCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // חישוב ימים מההתחלה
  const daysSinceStart = Math.floor(
    (Date.now() - new Date(userData.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  const score = healthScore || 0
  const stats = monthlyStats || {
    total_income: 0,
    total_expenses: 0,
    net_balance: 0,
    expense_count: 0,
    income_count: 0,
  }

  // Check if user has completed profile (Empty State)
  const hasCompletedProfile = !!(
    userProfile?.total_monthly_income || 
    userProfile?.marital_status || 
    userProfile?.num_children !== undefined
  )

  // Show Empty State if no profile
  if (!hasCompletedProfile) {
    return <EmptyDashboard userName={userData.name} hasProfile={false} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F6F8] via-white to-[#F5F6F8]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1E2A3B] via-[#2E3A4B] to-[#1E2A3B] border-b border-gray-700/50 shadow-xl backdrop-blur-sm">
        <div className="container mx-auto px-4 py-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3A7BD5] to-[#2E5EA5] flex items-center justify-center shadow-lg">
                <span className="text-2xl">💪</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  שלום, {userData.name}!
                  <span className="text-2xl">👋</span>
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    {userData.subscription_status === 'active' ? 'משתמש פעיל' : 'ממתין להפעלה'}
                  </span>
                  <span className="text-sm text-gray-400">•</span>
                  <span className="text-sm text-gray-300">
                    Phase {userData.phase === 'reflection' ? '1' : userData.phase === 'behavior' ? '2' : userData.phase === 'budget' ? '3' : userData.phase === 'goals' ? '4' : '5'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notifications */}
              <button className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all group">
                <Bell className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                {recentAlerts && recentAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-[#F6A623] to-[#F68B23] rounded-full text-xs text-white flex items-center justify-center font-bold shadow-lg">
                    {recentAlerts.length}
                  </span>
                )}
              </button>

              {/* Settings */}
              <Link 
                href="/settings"
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all group"
              >
                <Settings className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-300" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Progressive Banners */}
        {!userProfile?.completed && transactionCount && transactionCount >= 5 && (
          <ProgressiveBanner type="complete_profile" />
        )}
        {transactionCount && transactionCount >= 5 && transactionCount < 15 && (
          <ProgressiveBanner type="add_transactions" transactionCount={transactionCount} />
        )}
        {daysSinceStart >= 14 && (!activeGoals || activeGoals.length === 0) && (
          <ProgressiveBanner type="set_goals" daysSinceStart={daysSinceStart} />
        )}
        {transactionCount && transactionCount >= 30 && userData.phase === 'behavior' && (
          <ProgressiveBanner type="budget_ready" />
        )}

        {/* Financial Health Score */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#3A7BD5] via-[#2E5EA5] to-[#1E4A8A] text-white rounded-3xl p-8 mb-8 shadow-2xl border border-white/10">
          {/* Animated Background Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl" style={{animationDelay: '1s'}}></div>
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-white/20 to-white/5 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-lg">
                  <Heart className="w-10 h-10 text-white" fill="currentColor" />
                </div>
                <div>
                  <h2 className="text-3xl font-black mb-1">ציון הבריאות הפיננסית</h2>
                  <p className="text-white/80 text-sm">מבוסס על חיסכון, עמידה בתקציב והתקדמות יעדים</p>
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-8xl font-black tracking-tight">{score}</span>
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-white/80">/100</span>
                  <span className="text-xs text-white/60">נקודות</span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative mb-6">
              <div className="h-6 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/20">
                <div
                  className="h-full bg-gradient-to-r from-white via-white/90 to-white/80 rounded-full transition-all duration-1000 ease-out flex items-center justify-end px-3 shadow-lg"
                  style={{ width: `${score}%` }}
                >
                  <span className="text-xs font-bold text-[#3A7BD5]">{score}%</span>
                </div>
              </div>
              {/* Milestone Markers */}
              <div className="flex justify-between mt-2 px-1">
                <span className="text-xs text-white/50">0</span>
                <span className="text-xs text-white/50">25</span>
                <span className="text-xs text-white/50">50</span>
                <span className="text-xs text-white/50">75</span>
                <span className="text-xs text-white/50">100</span>
              </div>
            </div>

            {/* Status Message */}
            <div className="flex items-center gap-3 p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
              <div className="text-3xl">
                {score >= 80 && '🎉'}
                {score >= 60 && score < 80 && '👍'}
                {score >= 40 && score < 60 && '⚠️'}
                {score < 40 && '💪'}
              </div>
              <div>
                <p className="font-bold text-lg">
                  {score >= 80 && 'מצוין! המצב הפיננסי שלך נהדר'}
                  {score >= 60 && score < 80 && 'טוב! אתה בכיוון הנכון'}
                  {score >= 40 && score < 60 && 'ניתן לשפר - יש לך פוטנציאל!'}
                  {score < 40 && 'בואו נעבוד על זה ביחד'}
                </p>
                <p className="text-sm text-white/70 mt-1">
                  {score >= 80 && 'המשך כך! אתה מנהל את הכספים שלך בצורה מצוינת'}
                  {score >= 60 && score < 80 && 'עוד קצת מאמץ ותגיע למצוינות'}
                  {score >= 40 && score < 60 && 'בואו נזהה הזדמנויות לשיפור'}
                  {score < 40 && 'יחד נשפר את המצב הפיננסי שלך'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            <FinancialOverview
              profile={userProfile}
              monthlyExpenses={stats.total_expenses || 0}
            />

            <MonthlyBreakdown profile={userProfile} />

            <SmartInsights
              profile={userProfile}
              monthlyExpenses={stats.total_expenses || 0}
            />

            {/* Budget Tracking */}
            {budgetTracking && budgetTracking.length > 0 && (
              <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl shadow-lg p-6 border border-gray-100/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#1E2A3B]">מעקב תקציב חודשי</h3>
                    <p className="text-xs text-gray-500">עמידה ביעדים</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {budgetTracking.map((category: any) => (
                    <BudgetBar
                      key={category.budget_category_id}
                      name={category.category_name}
                      spent={category.current_spent}
                      cap={category.monthly_cap}
                      percentage={category.usage_percentage}
                      color={category.color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - 1/3 */}
          <div className="space-y-6">
            <PhaseProgress currentPhase={userData.phase || 'reflection'} />
            
            <DebtVsAssets profile={userProfile} />
            
            <GoalsQuickView 
              profile={userProfile}
              activeGoals={activeGoals || []}
            />
          </div>
        </div>

        {/* Empty State */}
        {(!budgetTracking || budgetTracking.length === 0) &&
          (!activeGoals || activeGoals.length === 0) &&
          !userProfile && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold mb-2 text-[#1E2A3B]">בוא נתחיל!</h3>
              <p className="text-[#555555] mb-6">
                הגדר את התקציב החודשי שלך ויעדי חיסכון כדי להתחיל לעקוב אחרי הכסף שלך
              </p>
              <button className="bg-[#3A7BD5] text-white px-6 py-3 rounded-lg hover:bg-[#2E5EA5] transition">
                הגדר תקציב
              </button>
            </div>
          )}
      </div>

      {/* Quick Actions FAB */}
      <QuickActions />
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  trend,
  trendUp,
  subtitle,
}: {
  title: string
  value: string
  icon: React.ReactNode
  trend?: string
  trendUp?: boolean
  subtitle?: string
}) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        {icon}
      </div>
      <p className="text-3xl font-bold text-dark mb-1">{value}</p>
      {trend && (
        <p className={`text-sm ${trendUp ? 'text-success' : 'text-warning'}`}>
          {trend} מחודש שעבר
        </p>
      )}
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function BudgetBar({
  name,
  spent,
  cap,
  percentage,
  color,
}: {
  name: string
  spent: number
  cap: number
  percentage: number
  color: string
}) {
  const remaining = cap - spent
  const status = percentage > 100 ? 'over' : percentage > 80 ? 'warning' : 'good'

  return (
    <div className="group p-4 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-[#1E2A3B] flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            status === 'over' ? 'bg-red-500' : status === 'warning' ? 'bg-orange-500' : 'bg-emerald-500'
          }`}></span>
          {name}
        </span>
        <div className="text-left">
          <p className="text-sm font-bold text-gray-900">
            ₪{spent.toLocaleString('he-IL')}
          </p>
          <p className="text-xs text-gray-500">
            מתוך ₪{cap.toLocaleString('he-IL')}
          </p>
        </div>
      </div>
      
      <div className="relative">
        <div className="bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              status === 'over'
                ? 'bg-gradient-to-r from-red-500 to-red-600'
                : status === 'warning'
                ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
            } shadow-sm`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          >
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
          </div>
        </div>
        <span className={`absolute -top-6 text-xs font-bold transition-all ${
          status === 'over' ? 'text-red-600' : status === 'warning' ? 'text-orange-600' : 'text-emerald-600'
        }`} style={{ right: `${Math.min(percentage, 95)}%` }}>
          {percentage.toFixed(0)}%
        </span>
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className={`text-xs font-medium ${
          status === 'over' ? 'text-red-600' : status === 'warning' ? 'text-orange-600' : 'text-emerald-600'
        }`}>
          {status === 'over' && `⚠️ חרגת ב-₪${Math.abs(remaining).toLocaleString('he-IL')}`}
          {status === 'warning' && `⚡ נשארו ₪${remaining.toLocaleString('he-IL')}`}
          {status === 'good' && `✓ נשארו ₪${remaining.toLocaleString('he-IL')}`}
        </p>
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
          status === 'over' 
            ? 'bg-red-100 text-red-700' 
            : status === 'warning' 
            ? 'bg-orange-100 text-orange-700' 
            : 'bg-emerald-100 text-emerald-700'
        }`}>
          {status === 'over' && 'חריגה'}
          {status === 'warning' && 'שים לב'}
          {status === 'good' && 'תקין'}
        </span>
      </div>
    </div>
  )
}

function GoalCard({
  name,
  current,
  target,
  deadline,
}: {
  name: string
  current: number
  target: number
  deadline: string | null
}) {
  const percentage = (current / target) * 100

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-medium text-dark">{name}</h4>
          {deadline && (
            <p className="text-xs text-muted-foreground">
              יעד: {new Date(deadline).toLocaleDateString('he-IL')}
            </p>
          )}
        </div>
        <span className="text-sm font-medium text-primary">{percentage.toFixed(0)}%</span>
      </div>
      <div className="bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
        <div
          className="bg-primary h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        ₪{current.toLocaleString('he-IL')} מתוך ₪{target.toLocaleString('he-IL')}
      </p>
    </div>
  )
}

