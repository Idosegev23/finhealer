import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Heart, TrendingUp, TrendingDown, Target, Bell } from 'lucide-react'
import FinancialOverview from '@/components/dashboard/FinancialOverview'
import DebtVsAssets from '@/components/dashboard/DebtVsAssets'
import SmartInsights from '@/components/dashboard/SmartInsights'
import PhaseProgress from '@/components/dashboard/PhaseProgress'
import GoalsQuickView from '@/components/dashboard/GoalsQuickView'
import ExpenseBreakdown from '@/components/dashboard/ExpenseBreakdown'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { ProgressiveBanner } from '@/components/dashboard/ProgressiveBanner'
import EmptyDashboard from '@/components/dashboard/EmptyDashboard'

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
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <header className="bg-[#1E2A3B] border-b border-gray-700">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">שלום, {userData.name}! 👋</h1>
            <p className="text-sm text-gray-300">
              {userData.subscription_status === 'active' ? '✨ משתמש פעיל' : '⏳ ממתין להפעלת מנוי'}
            </p>
          </div>
          <button className="relative">
            <Bell className="w-6 h-6 text-white" />
            {recentAlerts && recentAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#F6A623] rounded-full text-xs text-white flex items-center justify-center">
                {recentAlerts.length}
              </span>
            )}
          </button>
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
        <div className="bg-gradient-to-r from-[#3A7BD5] to-[#2E5EA5] text-white rounded-2xl p-8 mb-8 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Heart className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">ציון הבריאות הפיננסית שלך</h2>
              <p className="opacity-90">מבוסס על חיסכון, עמידה בתקציב והתקדמות יעדים</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-7xl font-bold">{score}</span>
            <span className="text-3xl opacity-90">/100</span>
          </div>
          <div className="mt-4 bg-white/20 rounded-full h-4 overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all duration-1000"
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="mt-4 text-sm opacity-90">
            {score >= 80 && '🎉 מצוין! המצב הפיננסי שלך נהדר'}
            {score >= 60 && score < 80 && '👍 טוב! אתה בכיוון הנכון'}
            {score >= 40 && score < 60 && '⚠️ ניתן לשפר. יש לך פוטנציאל!'}
            {score < 40 && '💪 בואו נעבוד על זה ביחד'}
          </p>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            <FinancialOverview
              profile={userProfile}
              monthlyExpenses={stats.total_expenses || 0}
            />

            <ExpenseBreakdown profile={userProfile} />

            <SmartInsights
              profile={userProfile}
              monthlyExpenses={stats.total_expenses || 0}
            />

            {/* Budget Tracking */}
            {budgetTracking && budgetTracking.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-[#1E2A3B] mb-4">מעקב תקציב חודשי</h3>
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
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-dark">{name}</span>
        <span className="text-sm text-muted-foreground">
          ₪{spent.toLocaleString('he-IL')} / ₪{cap.toLocaleString('he-IL')}
        </span>
      </div>
      <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            status === 'over'
              ? 'bg-red-500'
              : status === 'warning'
              ? 'bg-warning'
              : 'bg-success'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {status === 'over' && `חרגת ב-₪${Math.abs(remaining).toLocaleString('he-IL')}`}
        {status === 'warning' && `נשארו ₪${remaining.toLocaleString('he-IL')} (שים לב!)`}
        {status === 'good' && `נשארו ₪${remaining.toLocaleString('he-IL')}`}
      </p>
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

