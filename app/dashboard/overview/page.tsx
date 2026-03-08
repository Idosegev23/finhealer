import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Wallet, BarChart3,
  Target, PiggyBank, Landmark, Briefcase,
  ChevronLeft, MessageCircle,
} from 'lucide-react'
import Link from 'next/link'
import WhatsAppBanner from '@/components/dashboard/WhatsAppBanner'
import { ExpensesPieBudget } from '@/components/dashboard/ExpensesPieBudget'

export const revalidate = 30;

export default async function OverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('id, name, phase')
    .eq('id', user.id)
    .single()
  if (!userData) redirect('/login')

  // Current month
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const today = now.toISOString().split('T')[0]

  // Previous month
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  // Parallel fetches — only what matters
  const [
    { data: currentTx },
    { data: prevTx },
    { data: goals },
    { data: loans },
    { data: savings },
    { data: income },
    { data: recentTx },
    { data: topCategories },
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('type, amount, expense_category')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .gte('tx_date', firstOfMonth)
      .lte('tx_date', today)
      .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true'),
    supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .gte('tx_date', prevMonthStart)
      .lte('tx_date', prevMonthEnd)
      .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true'),
    supabase
      .from('goals')
      .select('id, name, target_amount, current_amount, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('priority', { ascending: true })
      .limit(5),
    supabase
      .from('loans')
      .select('id, monthly_payment, current_balance')
      .eq('user_id', user.id)
      .eq('active', true),
    supabase
      .from('savings_accounts')
      .select('id, current_balance')
      .eq('user_id', user.id)
      .eq('active', true),
    supabase
      .from('income_sources')
      .select('id, source_name, actual_bank_amount')
      .eq('user_id', user.id)
      .eq('active', true),
    supabase
      .from('transactions')
      .select('id, type, amount, category, vendor, tx_date, expense_category')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true')
      .order('tx_date', { ascending: false })
      .limit(10),
    supabase
      .from('transactions')
      .select('expense_category, amount')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .eq('status', 'confirmed')
      .gte('tx_date', firstOfMonth)
      .lte('tx_date', today)
      .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true'),
  ])

  // Monthly KPIs
  const curList = (currentTx || []) as any[]
  const curIncome = curList.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
  const curExpenses = curList.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0)
  const curBalance = curIncome - curExpenses

  const prevList = (prevTx || []) as any[]
  const prevExpenses = prevList.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0)
  const expenseChange = prevExpenses > 0
    ? Math.round(((curExpenses - prevExpenses) / prevExpenses) * 100)
    : 0

  // Top categories
  const catMap: Record<string, number> = {}
  ;(topCategories || []).forEach((tx: any) => {
    const cat = tx.expense_category || 'לא מסווג'
    catMap[cat] = (catMap[cat] || 0) + Math.round(Number(tx.amount) || 0)
  })
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Summaries
  const totalLoansPayment = (loans || []).reduce((s: number, l: any) => s + Number(l.monthly_payment || 0), 0)
  const totalLoansBalance = (loans || []).reduce((s: number, l: any) => s + Number(l.current_balance || 0), 0)
  const totalSavings = (savings || []).reduce((s: number, a: any) => s + Number(a.current_balance || 0), 0)
  const totalIncomeFixed = (income || []).reduce((s: number, i: any) => s + Number(i.actual_bank_amount || 0), 0)

  const monthName = now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="container mx-auto px-4 py-6 max-w-5xl space-y-5">
        <WhatsAppBanner message="רוצה לעדכן נתונים? לשאול שאלה? כל זה דרך WhatsApp! 💬" />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">סקירה כללית</h1>
          <p className="text-sm text-gray-500">{monthName} — תמונת מצב פיננסית</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="הכנסות" value={curIncome} color="green"
            icon={<TrendingUp className="w-4 h-4 text-green-600" />} />
          <KpiCard label="הוצאות" value={curExpenses} color="red"
            icon={<TrendingDown className="w-4 h-4 text-red-600" />}
            badge={expenseChange !== 0 ? `${expenseChange > 0 ? '+' : ''}${expenseChange}%` : undefined}
            badgeColor={expenseChange > 0 ? 'red' : 'green'} />
          <KpiCard label="מאזן" value={curBalance} color={curBalance >= 0 ? 'blue' : 'red'} signed
            icon={<Wallet className="w-4 h-4 text-blue-600" />} />
          <KpiCard label="חיסכון" value={totalSavings} color="purple"
            icon={<PiggyBank className="w-4 h-4 text-purple-600" />} />
        </div>

        {/* Pie chart + budget recommendations */}
        <ExpensesPieBudget />

        {/* Top spending categories this month */}
        {topCats.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                הוצאות מובילות — {monthName}
              </h3>
              <Link href="/dashboard/expenses" className="text-xs text-amber-600 hover:underline flex items-center gap-0.5">
                הכל <ChevronLeft className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {topCats.map(([cat, amount]) => {
                const pct = curExpenses > 0 ? Math.round((amount / curExpenses) * 100) : 0
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700">{cat}</span>
                      <span className="text-gray-500">₪{amount.toLocaleString('he-IL')} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-amber-400 to-amber-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Goals */}
        {goals && goals.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                יעדים פעילים
              </h3>
              <Link href="/dashboard/goals" className="text-xs text-purple-600 hover:underline flex items-center gap-0.5">
                הכל <ChevronLeft className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {(goals as any[]).map((goal) => {
                const pct = goal.target_amount > 0
                  ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
                  : 0
                return (
                  <div key={goal.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-800 font-medium">{goal.name}</span>
                      <span className="text-gray-500 text-xs">
                        ₪{Number(goal.current_amount || 0).toLocaleString('he-IL')} / ₪{Number(goal.target_amount).toLocaleString('he-IL')}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-purple-400 to-purple-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Financial modules summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ModuleCard title="הלוואות" icon={<Landmark className="w-4 h-4" />}
            count={(loans || []).length}
            detail={totalLoansPayment > 0 ? `₪${totalLoansPayment.toLocaleString('he-IL')}/חודש` : undefined}
            subDetail={totalLoansBalance > 0 ? `יתרה: ₪${totalLoansBalance.toLocaleString('he-IL')}` : undefined}
            href="/dashboard/loans" color="red" />
          <ModuleCard title="חסכונות" icon={<PiggyBank className="w-4 h-4" />}
            count={(savings || []).length}
            detail={totalSavings > 0 ? `₪${totalSavings.toLocaleString('he-IL')}` : undefined}
            href="/dashboard/savings" color="green" />
          <ModuleCard title="הכנסות קבועות" icon={<Briefcase className="w-4 h-4" />}
            count={(income || []).length}
            detail={totalIncomeFixed > 0 ? `₪${totalIncomeFixed.toLocaleString('he-IL')}/חודש` : undefined}
            href="/dashboard/income" color="blue" />
          <ModuleCard title="יעדים" icon={<Target className="w-4 h-4" />}
            count={(goals || []).length}
            href="/dashboard/goals" color="purple" />
        </div>

        {/* Recent transactions */}
        {recentTx && recentTx.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">תנועות אחרונות</h3>
              <Link href="/dashboard/transactions" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
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
                      <p className="text-sm text-gray-900 leading-tight">{tx.vendor || tx.expense_category || tx.category || 'תנועה'}</p>
                      <p className="text-xs text-gray-400">{tx.tx_date}</p>
                    </div>
                  </div>
                  <p className={`font-semibold text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}₪{Number(tx.amount).toLocaleString('he-IL')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helper Components ─────────────────────────────

function KpiCard({ label, value, icon, color, signed, badge, badgeColor }: {
  label: string; value: number; icon: React.ReactNode; color: string;
  signed?: boolean; badge?: string; badgeColor?: string;
}) {
  const cm: Record<string, string> = {
    green: 'text-green-600', red: 'text-red-600', blue: 'text-blue-600', purple: 'text-purple-600',
  }
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center">{icon}</div>
        {badge && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
            badgeColor === 'red' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
          }`}>{badge}</span>
        )}
      </div>
      <span className="text-xs text-gray-400">{label}</span>
      <p className={`text-xl font-bold ${cm[color] || 'text-gray-900'}`}>
        {signed && value >= 0 ? '+' : ''}₪{value.toLocaleString('he-IL')}
      </p>
    </div>
  )
}

function ModuleCard({ title, icon, count, detail, subDetail, href, color }: {
  title: string; icon: React.ReactNode; count: number;
  detail?: string; subDetail?: string; href: string; color: string;
}) {
  const bg: Record<string, string> = { red: 'bg-red-50', green: 'bg-green-50', blue: 'bg-blue-50', purple: 'bg-purple-50' }
  const tx: Record<string, string> = { red: 'text-red-600', green: 'text-green-600', blue: 'text-blue-600', purple: 'text-purple-600' }
  return (
    <Link href={href} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-gray-200 transition-colors block">
      <div className={`w-8 h-8 rounded-lg ${bg[color]} flex items-center justify-center mb-2 ${tx[color]}`}>{icon}</div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {count > 0 ? (
        <>
          {detail && <p className={`text-sm font-bold mt-1 ${tx[color]}`}>{detail}</p>}
          {subDetail && <p className="text-xs text-gray-400 mt-0.5">{subDetail}</p>}
          <p className="text-xs text-gray-400 mt-1">{count} רשומות</p>
        </>
      ) : (
        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
          <MessageCircle className="w-3 h-3" />
          עדכן דרך WhatsApp
        </p>
      )}
    </Link>
  )
}
