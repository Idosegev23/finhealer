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

export const revalidate = 30

export default async function DashboardPage() {
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('id, name, subscription_status, phase, onboarding_state')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/login')

  const u = userData as any
  if (u.subscription_status !== 'active') redirect('/payment')

  // Current month range
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const today = now.toISOString().split('T')[0]

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
      .select('title, description, insight_type, priority')
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

  const insightColors: Record<string, string> = {
    high: 'bg-red-50 border-red-400',
    medium: 'bg-yellow-50 border-yellow-400',
    low: 'bg-blue-50 border-blue-400',
  }

  const insightEmoji: Record<string, string> = {
    warning: '⚠️', success: '✅', spending: '📊', saving: '💰', info: '💡',
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="container mx-auto px-4 py-6 max-w-5xl space-y-5">

        {/* Pending banner */}
        <PendingTransactionsBanner />

        {/* Greeting */}
        <div>
          <p className="text-gray-400 text-sm">{greeting},</p>
          <h1 className="text-2xl font-bold text-gray-900">{u.name || 'משתמש'}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Score + Phase */}
        <div className="grid lg:grid-cols-2 gap-4">
          <PhiScoreWidget score={score} />
          <PhaseJourney currentPhase={currentPhase} />
        </div>

        {/* Monthly KPIs */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })} — חודש נוכחי
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                </div>
                <span className="text-xs text-gray-400">הכנסות</span>
              </div>
              <p className="text-xl font-bold text-green-600">₪{monthlyIncome.toLocaleString('he-IL')}</p>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                  <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                </div>
                <span className="text-xs text-gray-400">הוצאות</span>
              </div>
              <p className="text-xl font-bold text-red-600">₪{monthlyExpenses.toLocaleString('he-IL')}</p>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span className="text-xs text-gray-400">יתרה</span>
              </div>
              <p className={`text-xl font-bold ${monthlyBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {monthlyBalance >= 0 ? '+' : ''}₪{monthlyBalance.toLocaleString('he-IL')}
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-yellow-50 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-yellow-600" />
                </div>
                <span className="text-xs text-gray-400">ממתינות</span>
              </div>
              <p className="text-xl font-bold text-yellow-600">{pendingCount ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Budget tracking */}
        {budgetTracking && budgetTracking.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-500" />
                מעקב תקציב
              </h3>
              <Link href="/dashboard/budget" className="text-xs text-amber-600 hover:underline flex items-center gap-0.5">
                הכל <ChevronLeft className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {(budgetTracking as any[]).map((item, i) => {
                const pct = Math.min(100, Math.round(item.percentage_used || 0))
                const over = pct >= 90
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700">{item.category_name}</span>
                      <span className={over ? 'text-red-600 font-medium' : 'text-gray-400'}>
                        ₪{Math.round(item.actual_spent || 0).toLocaleString('he-IL')} / ₪{Math.round(item.monthly_cap || 0).toLocaleString('he-IL')} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${over ? 'bg-red-500' : pct > 70 ? 'bg-yellow-400' : 'bg-green-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Goals + Loans */}
        <div className="grid lg:grid-cols-2 gap-4">
          <GoalsProgress goals={goals || []} />
          <LoansStatusCard />
        </div>

        {/* Smart insights from DB */}
        {insights && insights.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              תובנות חכמות
            </h3>
            <div className="space-y-2">
              {(insights as any[]).map((insight, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-xs border-r-4 ${insightColors[insight.priority] || insightColors.low}`}
                >
                  <p className="font-medium text-gray-900 mb-0.5">
                    {insightEmoji[insight.insight_type] || '💡'} {insight.title}
                  </p>
                  <p className="text-gray-500">{insight.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        {recentTx && recentTx.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">תנועות אחרונות</h3>
              <Link href="/dashboard/overview" className="text-xs text-amber-600 hover:underline flex items-center gap-0.5">
                הכל <ChevronLeft className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(recentTx as any[]).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'income' ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      {tx.type === 'income'
                        ? <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                        : <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
                    </div>
                    <div>
                      <p className="text-sm text-gray-900 leading-tight">{tx.vendor || tx.category || 'תנועה'}</p>
                      <p className="text-xs text-gray-400">{tx.tx_date || ''}</p>
                    </div>
                  </div>
                  <div className="text-left flex items-center gap-2">
                    {tx.status === 'pending' && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">ממתין</span>
                    )}
                    <p className={`font-semibold text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}₪{Number(tx.amount).toLocaleString('he-IL')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">פעולות מהירות</h3>
          <div className="grid grid-cols-3 gap-3">
            <Link
              href="/dashboard/missing-documents"
              className="flex flex-col items-center p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-100 hover:border-amber-200 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center mb-2">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-700 text-center font-medium">העלה דוח</span>
            </Link>

            <Link
              href="/dashboard/overview"
              className="flex flex-col items-center p-3 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-100 hover:border-teal-200 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-teal-500 flex items-center justify-center mb-2">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-700 text-center font-medium">גרפים</span>
            </Link>

            <Link
              href="/dashboard/goals"
              className="flex flex-col items-center p-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-100 hover:border-purple-200 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-500 flex items-center justify-center mb-2">
                <Target className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-700 text-center font-medium">יעדים</span>
            </Link>
          </div>
        </div>

        {/* Phase footer */}
        <p className="text-center text-xs text-gray-400 pb-2">
          שלב: <span className="font-medium text-gray-500">{phaseLabel[currentPhase] || currentPhase}</span>
        </p>

      </div>
    </div>
  )
}
