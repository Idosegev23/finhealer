import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, BarChart3, Target, TrendingUp, TrendingDown,
  Clock, Wallet, Lightbulb, ChevronLeft
} from 'lucide-react'
import { PhiScoreWidget } from '@/components/dashboard/PhiScoreWidget'
import { PhaseJourney } from '@/components/dashboard/PhaseJourney'
import { GoalsProgress } from '@/components/dashboard/GoalsProgress'
import { PendingTransactionsBanner } from '@/components/dashboard/PendingTransactionsBanner'
import { LoansStatusCard } from '@/components/dashboard/LoansStatusCard'
import { RealtimeRefresh } from '@/components/dashboard/RealtimeRefresh'
import { ExpensesPieBudget } from '@/components/dashboard/ExpensesPieBudget'
import BenchmarkWidget from '@/components/dashboard/BenchmarkWidget'
import ReferralCard from '@/components/dashboard/ReferralCard'
import InstallPWA from '@/components/dashboard/InstallPWA'
import { DedupAlert } from '@/components/dashboard/DedupAlert'
import { QuickAddFAB } from '@/components/dashboard/QuickAddFAB'
import { OnboardingWizard } from '@/components/dashboard/OnboardingWizard'
import { KpiGrid, StatCard, Section, InsightBanner, EmptyState, ProgressBar } from '@/components/ui/design-system'
import { getActivePeriod } from '@/lib/finance/active-period'
import { tryUpgradePhase } from '@/lib/services/PhaseService'

export const revalidate = 30

export default async function DashboardPage() {
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('id, name, phone, subscription_status, phase, onboarding_state')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/login')

  const u = userData as any

  // Onboarding gate: anyone without a phone or still on 'start' goes to /onboarding.
  // This is the canonical check — handles email login, OAuth, deep links, refreshes.
  if (!u.phone || !u.onboarding_state || u.onboarding_state === 'start') {
    redirect('/onboarding')
  }

  // Auto-advance the user's lifecycle phase based on actual data. Without
  // this the phase pinned itself to whatever was set during onboarding —
  // even after the user uploaded statements, classified, set goals, or
  // had a budget waiting. Now every dashboard load reconciles phase with
  // calculatePhase() rules (≥30 tx → behavior, +1 goal → budget, etc.).
  try {
    const upgraded = await tryUpgradePhase(user.id)
    if (upgraded) {
      // Reflect the freshly calculated phase in the rendered view, instead
      // of forcing a redirect/refresh.
      u.phase = upgraded
    }
  } catch (err) {
    console.error('[dashboard] tryUpgradePhase failed:', err)
  }

  // Active period — falls back to latest month with data when current month
  // is empty (common for users who upload historical statements).
  const now = new Date()
  const activePeriod = await getActivePeriod(supabase, user.id)
  const firstOfMonth = activePeriod.start
  const today = activePeriod.end

  // Parallel server-side fetches
  const [
    { data: healthScore },
    { data: monthlyTx },
    { data: goals },
    { data: recentTx },
    { data: budgetTracking },
    { data: insights },
    { count: pendingCount },
  ] = await Promise.all([
    supabase.rpc('calculate_financial_health', { p_user_id: user.id } as any),
    supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .gte('tx_date', firstOfMonth)
      .lte('tx_date', today),
    supabase
      .from('goals')
      .select('id, name, target_amount, current_amount, goal_type, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('priority', { ascending: true })
      .limit(3),
    supabase
      .from('transactions')
      .select('id, type, amount, category, vendor, tx_date, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('monthly_budget_tracking')
      .select('category_name, monthly_cap, actual_spent, percentage_used')
      .eq('user_id', user.id)
      .order('percentage_used', { ascending: false })
      .limit(4),
    supabase
      .from('behavior_insights')
      .select('title, insight_text, insight_type, priority')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending'),
  ])

  // Monthly calculations
  const txList = (monthlyTx || []) as any[]
  const monthlyIncome = txList
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  const monthlyExpenses = txList
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  const monthlyBalance = monthlyIncome - monthlyExpenses

  const hour = now.getHours()
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב'
  const currentPhase = u.phase || 'data_collection'
  const score = Number(healthScore) || null

  const phaseLabel: Record<string, string> = {
    start: 'התחלה',
    waiting_for_document: 'ממתין למסמך',
    document_received: 'מסמך התקבל',
    classification_income: 'סיווג הכנסות',
    classification_expense: 'סיווג הוצאות',
    behavior: 'ניתוח התנהגות',
    goals: 'הגדרת יעדים',
    budget: 'בניית תקציב',
    monitoring: 'ניטור שוטף ✅',
    data_collection: 'איסוף נתונים',
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" role="main" aria-label="דשבורד ראשי">
      <div className="container mx-auto px-4 py-6 max-w-5xl space-y-5">

        {/* Real-time: auto-refresh when WhatsApp bot processes documents */}
        <RealtimeRefresh
          userId={user.id}
          tables={['behavior_insights', 'budgets', 'goals', 'uploaded_statements']}
        />

        {/* Dedup alert — CC double-counting detection */}
        <DedupAlert />

        {/* Pending banner */}
        <PendingTransactionsBanner />

        {/* Greeting */}
        <div>
          <p className="text-phi-slate text-sm">{greeting},</p>
          <h1 className="text-2xl font-bold text-gray-900">{u.name || 'משתמש'}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Onboarding Wizard for new users */}
        <OnboardingWizard
          userName={u.name || ''}
          hasTransactions={(recentTx?.length || 0) > 0}
          phase={currentPhase}
        />

        {/* Score + Phase */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div data-tour="phi-score">
            <PhiScoreWidget score={score} />
          </div>
          <PhaseJourney currentPhase={currentPhase} />
        </div>

        {/* Monthly KPIs — semantic colors per metric type */}
        <div data-tour="kpis">
          <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {activePeriod.label}{activePeriod.isFallback ? ' — חודש אחרון עם דאטה' : ' — חודש נוכחי'}
          </p>
          <KpiGrid cols={4}>
            <StatCard
              label="הכנסות"
              value={`₪${monthlyIncome.toLocaleString('he-IL')}`}
              icon={TrendingUp}
              tone="income"
            />
            <StatCard
              label="הוצאות"
              value={`₪${monthlyExpenses.toLocaleString('he-IL')}`}
              icon={TrendingDown}
              tone="expense"
            />
            <StatCard
              label="יתרה"
              value={`${monthlyBalance >= 0 ? '+' : ''}₪${monthlyBalance.toLocaleString('he-IL')}`}
              icon={Wallet}
              tone={monthlyBalance >= 0 ? 'balance' : 'expense'}
            />
            <StatCard
              label="ממתינות"
              value={pendingCount ?? 0}
              icon={Clock}
              tone="pending"
            />
          </KpiGrid>
        </div>

        {/* Expenses pie chart + budget recommendations */}
        <ExpensesPieBudget />

        {/* Budget tracking */}
        {(!budgetTracking || budgetTracking.length === 0) ? (
          <Section title="מעקב תקציב" titleIcon={Target}>
            <p className="text-xs text-gray-500">עדיין לא הוגדר תקציב.</p>
            <Link href="/dashboard/budget" className="inline-block mt-2 text-xs text-phi-gold font-medium hover:underline">
              צור תקציב חכם
            </Link>
          </Section>
        ) : (
          <Section
            title="מעקב תקציב"
            titleIcon={Target}
            action={
              <Link href="/dashboard/budget" className="text-xs text-phi-gold hover:underline flex items-center gap-0.5">
                הכל <ChevronLeft className="w-3 h-3" />
              </Link>
            }
          >
            <div className="space-y-3">
              {(budgetTracking as any[]).map((item, i) => {
                const pct = Math.min(100, Math.round(item.percentage_used || 0))
                const over = pct >= 90
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700">{item.category_name}</span>
                      <span className={over ? 'text-phi-coral font-medium' : 'text-gray-500'}>
                        ₪{Math.round(item.actual_spent || 0).toLocaleString('he-IL')} / ₪{Math.round(item.monthly_cap || 0).toLocaleString('he-IL')} ({pct}%)
                      </span>
                    </div>
                    <ProgressBar value={pct} />
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* Goals + Loans */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div data-tour="goals">
            <GoalsProgress goals={goals || []} />
          </div>
          <LoansStatusCard />
        </div>

        {/* Smart insights from DB */}
        {insights && insights.length > 0 && (
          <Section title="תובנות חכמות" titleIcon={Lightbulb}>
            <div className="space-y-2">
              {(insights as any[]).map((insight, i) => {
                const variant: 'danger' | 'warning' | 'info' =
                  insight.priority === 'high' ? 'danger' :
                  insight.priority === 'medium' ? 'warning' : 'info';
                return (
                  <InsightBanner key={i} variant={variant} title={insight.title}>
                    {insight.insight_text}
                  </InsightBanner>
                );
              })}
            </div>
          </Section>
        )}

        {/* Recent Transactions */}
        {(!recentTx || recentTx.length === 0) ? (
          <EmptyState
            icon={FileText}
            title="אין עדיין תנועות"
            description="העלה דוח בנק כדי להתחיל לראות את התמונה הפיננסית שלך."
            action={{ label: 'העלה דוח ראשון', href: '/dashboard/scan-center' }}
          />
        ) : (
          <Section
            title="תנועות אחרונות"
            action={
              <Link href="/dashboard/overview" className="text-xs text-phi-gold hover:underline flex items-center gap-0.5">
                הכל <ChevronLeft className="w-3 h-3" />
              </Link>
            }
          >
            <div className="divide-y divide-gray-100">
              {(recentTx as any[]).map((tx) => {
                const isIncome = tx.type === 'income';
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                        {isIncome
                          ? <TrendingUp className="w-3.5 h-3.5 text-phi-mint" />
                          : <TrendingDown className="w-3.5 h-3.5 text-phi-coral" />}
                      </div>
                      <div>
                        <p className="text-sm text-gray-900 leading-tight">{tx.vendor || tx.category || 'תנועה'}</p>
                        <p className="text-xs text-gray-500">{tx.tx_date || ''}</p>
                      </div>
                    </div>
                    <div className="text-end flex items-center gap-2">
                      {tx.status === 'pending' && (
                        <span className="text-xs bg-amber-50 text-phi-gold border border-amber-200 px-1.5 py-0.5 rounded-full">ממתין</span>
                      )}
                      <p className={`font-semibold text-sm tabular-nums ${isIncome ? 'text-phi-mint' : 'text-phi-coral'}`}>
                        {isIncome ? '+' : '-'}₪{Number(tx.amount).toLocaleString('he-IL')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Benchmark + Referral */}
        <div className="grid lg:grid-cols-2 gap-4">
          <BenchmarkWidget />
          <ReferralCard />
        </div>

        {/* Quick Actions — unified phi palette, no rainbow */}
        <Section title="פעולות מהירות">
          <div className="grid grid-cols-3 gap-3">
            <Link
              href="/dashboard/missing-documents"
              className="flex flex-col items-center p-3 rounded-xl border border-gray-100 hover:border-phi-gold/40 hover:bg-amber-50/50 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-phi-dark flex items-center justify-center mb-2 group-hover:bg-phi-slate transition-colors">
                <FileText className="w-4 h-4 text-phi-gold" />
              </div>
              <span className="text-xs text-gray-700 text-center font-medium">העלה דוח</span>
            </Link>

            <Link
              href="/dashboard/overview"
              className="flex flex-col items-center p-3 rounded-xl border border-gray-100 hover:border-phi-gold/40 hover:bg-amber-50/50 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-phi-dark flex items-center justify-center mb-2 group-hover:bg-phi-slate transition-colors">
                <BarChart3 className="w-4 h-4 text-phi-gold" />
              </div>
              <span className="text-xs text-gray-700 text-center font-medium">גרפים</span>
            </Link>

            <Link
              href="/dashboard/goals"
              className="flex flex-col items-center p-3 rounded-xl border border-gray-100 hover:border-phi-gold/40 hover:bg-amber-50/50 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-phi-dark flex items-center justify-center mb-2 group-hover:bg-phi-slate transition-colors">
                <Target className="w-4 h-4 text-phi-gold" />
              </div>
              <span className="text-xs text-gray-700 text-center font-medium">יעדים</span>
            </Link>
          </div>
        </Section>

        {/* Phase footer */}
        <p className="text-center text-xs text-gray-400 pb-2">
          שלב: <span className="font-medium text-gray-500">{phaseLabel[currentPhase] || currentPhase}</span>
        </p>

        {/* PWA Install Prompt */}
        <InstallPWA />

        {/* Floating Quick Add Expense */}
        <QuickAddFAB />
      </div>
    </div>
  )
}
