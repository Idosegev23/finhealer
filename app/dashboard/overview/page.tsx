import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Wallet, BarChart3,
  Target, PiggyBank, Landmark, Briefcase,
  ChevronLeft, MessageCircle, type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import WhatsAppBanner from '@/components/dashboard/WhatsAppBanner'
import { ExpensesPieBudget } from '@/components/dashboard/ExpensesPieBudget'
import {
  PageWrapper, PageHeader, KpiGrid, StatCard, Section,
  ProgressBar, Card,
} from '@/components/ui/design-system'

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
    <PageWrapper>
      <WhatsAppBanner message="רוצה לעדכן נתונים? לשאול שאלה? כל זה דרך WhatsApp! 💬" />

      <PageHeader title="סקירה כללית" subtitle={`${monthName} — תמונת מצב פיננסית`} />

      {/* KPI cards — semantic palette */}
      <KpiGrid cols={4}>
        <StatCard
          label="הכנסות"
          value={`₪${curIncome.toLocaleString('he-IL')}`}
          icon={TrendingUp}
          tone="income"
        />
        <StatCard
          label="הוצאות"
          value={`₪${curExpenses.toLocaleString('he-IL')}`}
          icon={TrendingDown}
          tone="expense"
          subtitle={expenseChange !== 0 ? `${expenseChange > 0 ? '+' : ''}${expenseChange}% מחודש קודם` : undefined}
        />
        <StatCard
          label="מאזן"
          value={`${curBalance >= 0 ? '+' : ''}₪${curBalance.toLocaleString('he-IL')}`}
          icon={Wallet}
          tone={curBalance >= 0 ? 'balance' : 'expense'}
        />
        <StatCard
          label="חיסכון"
          value={`₪${totalSavings.toLocaleString('he-IL')}`}
          icon={PiggyBank}
          tone="neutral"
        />
      </KpiGrid>

      {/* Pie chart + budget recommendations */}
      <ExpensesPieBudget />

      {/* Top spending categories */}
      {topCats.length > 0 && (
        <Section
          title={`הוצאות מובילות — ${monthName}`}
          titleIcon={BarChart3}
          action={
            <Link href="/dashboard/expenses" className="text-xs text-phi-gold hover:underline flex items-center gap-0.5">
              הכל <ChevronLeft className="w-3 h-3" />
            </Link>
          }
        >
          <div className="space-y-2">
            {topCats.map(([cat, amount]) => {
              const pct = curExpenses > 0 ? Math.round((amount / curExpenses) * 100) : 0
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700">{cat}</span>
                    <span className="text-gray-500 tabular-nums">₪{amount.toLocaleString('he-IL')} ({pct}%)</span>
                  </div>
                  <ProgressBar value={pct} size="md" />
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Active goals */}
      {goals && goals.length > 0 && (
        <Section
          title="יעדים פעילים"
          titleIcon={Target}
          action={
            <Link href="/dashboard/goals" className="text-xs text-phi-gold hover:underline flex items-center gap-0.5">
              הכל <ChevronLeft className="w-3 h-3" />
            </Link>
          }
        >
          <div className="space-y-3">
            {(goals as any[]).map((goal) => {
              const pct = goal.target_amount > 0
                ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
                : 0
              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-800 font-medium">{goal.name}</span>
                    <span className="text-gray-500 text-xs tabular-nums">
                      ₪{Number(goal.current_amount || 0).toLocaleString('he-IL')} / ₪{Number(goal.target_amount).toLocaleString('he-IL')}
                    </span>
                  </div>
                  <ProgressBar value={pct} size="md" />
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Modules grid — unified phi palette */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ModuleLink title="הלוואות" icon={Landmark}
          count={(loans || []).length}
          detail={totalLoansPayment > 0 ? `₪${totalLoansPayment.toLocaleString('he-IL')}/חודש` : undefined}
          subDetail={totalLoansBalance > 0 ? `יתרה: ₪${totalLoansBalance.toLocaleString('he-IL')}` : undefined}
          href="/dashboard/loans"
        />
        <ModuleLink title="חסכונות" icon={PiggyBank}
          count={(savings || []).length}
          detail={totalSavings > 0 ? `₪${totalSavings.toLocaleString('he-IL')}` : undefined}
          href="/dashboard/savings"
        />
        <ModuleLink title="הכנסות קבועות" icon={Briefcase}
          count={(income || []).length}
          detail={totalIncomeFixed > 0 ? `₪${totalIncomeFixed.toLocaleString('he-IL')}/חודש` : undefined}
          href="/dashboard/income"
        />
        <ModuleLink title="יעדים" icon={Target}
          count={(goals || []).length}
          href="/dashboard/goals"
        />
      </div>

      {/* Recent transactions */}
      {recentTx && recentTx.length > 0 && (
        <Section
          title="תנועות אחרונות"
          action={
            <Link href="/dashboard/transactions" className="text-xs text-phi-gold hover:underline flex items-center gap-0.5">
              הכל <ChevronLeft className="w-3 h-3" />
            </Link>
          }
        >
          <div className="divide-y divide-gray-100">
            {(recentTx as any[]).map((tx) => {
              const isIncome = tx.type === 'income'
              return (
                <div key={tx.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                      {isIncome
                        ? <TrendingUp className="w-3.5 h-3.5 text-phi-mint" />
                        : <TrendingDown className="w-3.5 h-3.5 text-phi-coral" />}
                    </div>
                    <div>
                      <p className="text-sm text-gray-900 leading-tight">{tx.vendor || tx.expense_category || tx.category || 'תנועה'}</p>
                      <p className="text-xs text-gray-500">{tx.tx_date}</p>
                    </div>
                  </div>
                  <p className={`font-semibold text-sm tabular-nums ${isIncome ? 'text-phi-mint' : 'text-phi-coral'}`}>
                    {isIncome ? '+' : '-'}₪{Number(tx.amount).toLocaleString('he-IL')}
                  </p>
                </div>
              )
            })}
          </div>
        </Section>
      )}
    </PageWrapper>
  )
}

// ─── Helper ────────────────────────────────────────────────────────

function ModuleLink({ title, icon: Icon, count, detail, subDetail, href }: {
  title: string;
  icon: LucideIcon;
  count: number;
  detail?: string;
  subDetail?: string;
  href: string;
}) {
  return (
    <Link href={href} className="block group">
      <Card hover className="h-full">
        <div className="w-9 h-9 rounded-lg bg-phi-dark group-hover:bg-phi-slate transition-colors flex items-center justify-center mb-2">
          <Icon className="w-4 h-4 text-phi-gold" />
        </div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {count > 0 ? (
          <>
            {detail && <p className="text-sm font-bold mt-1 text-phi-dark tabular-nums">{detail}</p>}
            {subDetail && <p className="text-xs text-gray-500 mt-0.5 tabular-nums">{subDetail}</p>}
            <p className="text-xs text-gray-500 mt-1">{count} רשומות</p>
          </>
        ) : (
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            עדכן ב-WhatsApp
          </p>
        )}
      </Card>
    </Link>
  )
}
