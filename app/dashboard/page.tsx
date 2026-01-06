import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, MessageCircle, BarChart3, ArrowLeft, TrendingUp, TrendingDown, Clock, Target } from 'lucide-react'
import { PhiScoreWidget } from '@/components/dashboard/PhiScoreWidget'
import { PhaseJourney } from '@/components/dashboard/PhaseJourney'
import { GoalsProgress } from '@/components/dashboard/GoalsProgress'
import { PendingTransactionsBanner } from '@/components/dashboard/PendingTransactionsBanner'

// ϕ = U+03D5 (mathematical phi)
const PHI = 'ϕ'

// Revalidate every 30 seconds
export const revalidate = 30

export default async function DashboardPage() {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user data
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/login')
  }

  const userDataInfo = userData as any

  // Check subscription
  if (userDataInfo.subscription_status !== 'active') {
    redirect('/payment')
  }

  // Get phi score
  const { data: healthScore } = await supabase.rpc('calculate_financial_health', {
    p_user_id: user.id,
  } as any)

  // Get goals
  const { data: goals } = await supabase
    .from('goals')
    .select('id, name, target_amount, current_amount, goal_type, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('priority', { ascending: true })

  // 🆕 Get ALL confirmed transactions for totals
  const { data: allTransactions } = await supabase
    .from('transactions')
    .select('type, amount, status, tx_date')
    .eq('user_id', user.id)

  // Calculate totals from ALL confirmed transactions
  const totalIncome = (allTransactions || [])
    .filter((t: any) => t.type === 'income' && t.status === 'confirmed')
    .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
  
  const totalExpenses = (allTransactions || [])
    .filter((t: any) => t.type === 'expense' && t.status === 'confirmed')
    .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)

  const pendingCount = (allTransactions || [])
    .filter((t: any) => t.status === 'pending' || t.status === 'proposed').length

  // Find date range of transactions
  const transactionDates = (allTransactions || [])
    .filter((t: any) => t.tx_date)
    .map((t: any) => new Date(t.tx_date))
  const oldestDate = transactionDates.length > 0 
    ? new Date(Math.min(...transactionDates.map(d => d.getTime())))
    : null
  const newestDate = transactionDates.length > 0
    ? new Date(Math.max(...transactionDates.map(d => d.getTime())))
    : null
  
  // Calculate number of months for averages
  const monthsCount = oldestDate && newestDate
    ? Math.max(1, Math.round((newestDate.getTime() - oldestDate.getTime()) / (30 * 24 * 60 * 60 * 1000)))
    : 1
  
  const monthlyAvgIncome = Math.round(totalIncome / monthsCount)
  const monthlyAvgExpenses = Math.round(totalExpenses / monthsCount)

  // 🆕 Get recent transactions
  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select('id, type, amount, category, vendor, date, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // 🆕 Get documents count
  const { count: documentsCount } = await supabase
    .from('uploaded_statements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Get time-based greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב'

  // Use current_phase or onboarding_state (they should be synced), fallback to phase
  const currentPhase = userDataInfo.current_phase || userDataInfo.onboarding_state || userDataInfo.phase || 'data_collection'
  const onboardingState = userDataInfo.onboarding_state || userDataInfo.current_phase || 'start'
  const score = Number(healthScore) || null

  return (
    <div className="min-h-screen bg-phi-bg" dir="rtl">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Pending transactions banner */}
        <PendingTransactionsBanner />

        {/* Header */}
        <div className="mb-8">
          <p className="text-phi-slate mb-1">{greeting},</p>
          <h1 className="text-3xl font-bold text-phi-dark">
            {userDataInfo.name || 'משתמש'} 👋
          </h1>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Phi Score */}
          <PhiScoreWidget score={score} />
          
          {/* Phase Journey */}
          <PhaseJourney currentPhase={currentPhase} />
        </div>

        {/* 🆕 Financial Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-phi-frost">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <span className="text-sm text-phi-slate">סה״כ הכנסות</span>
                <p className="text-xs text-phi-slate/60">ממוצע: ₪{monthlyAvgIncome.toLocaleString('he-IL')}/חודש</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600">₪{totalIncome.toLocaleString('he-IL')}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-phi-frost">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <span className="text-sm text-phi-slate">סה״כ הוצאות</span>
                <p className="text-xs text-phi-slate/60">ממוצע: ₪{monthlyAvgExpenses.toLocaleString('he-IL')}/חודש</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600">₪{totalExpenses.toLocaleString('he-IL')}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-phi-frost">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm text-phi-slate">ממתינות לאישור</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{pendingCount}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-phi-frost">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-phi-gold/20 flex items-center justify-center">
                <span className="text-phi-gold font-serif font-bold">φ</span>
              </div>
              <span className="text-sm text-phi-slate">יתרה</span>
            </div>
            <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-phi-mint' : 'text-red-600'}`}>
              {totalIncome - totalExpenses >= 0 ? '+' : ''}₪{(totalIncome - totalExpenses).toLocaleString('he-IL')}
            </p>
          </div>
        </div>

        {/* Date Range Info */}
        {oldestDate && newestDate && (
          <div className="text-center text-sm text-phi-slate mb-4">
            📊 נתונים מ-{oldestDate.toLocaleDateString('he-IL')} עד {newestDate.toLocaleDateString('he-IL')} ({monthsCount} חודשים)
          </div>
        )}

        {/* 🆕 Current Status Banner */}
        <div className="bg-gradient-to-l from-phi-gold/20 to-phi-gold/5 rounded-xl p-4 mb-8 border border-phi-gold/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-phi-gold flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-phi-slate">סטטוס נוכחי</p>
                <p className="font-bold text-phi-dark">
                  {onboardingState === 'start' && 'התחלה - מחכה לדוח ראשון'}
                  {onboardingState === 'waiting_for_document' && 'ממתין למסמך'}
                  {onboardingState === 'document_received' && 'מסמך התקבל - מעבד...'}
                  {onboardingState === 'classification_income' && 'סיווג הכנסות'}
                  {onboardingState === 'classification_expense' && 'סיווג הוצאות'}
                  {onboardingState === 'behavior' && 'ניתוח התנהגות'}
                  {onboardingState === 'goals' && 'הגדרת יעדים'}
                  {onboardingState === 'budget' && 'בניית תקציב'}
                  {onboardingState === 'monitoring' && '✅ ניטור שוטף'}
                  {!['start', 'waiting_for_document', 'document_received', 'classification_income', 'classification_expense', 'behavior', 'goals', 'budget', 'monitoring'].includes(onboardingState) && onboardingState}
                </p>
              </div>
            </div>
            <a
              href="https://wa.me/972544266506"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#25D366] text-white rounded-lg text-sm font-medium hover:bg-[#1faa52] transition-colors"
            >
              המשך ב-WhatsApp →
            </a>
          </div>
        </div>

        {/* Goals Progress */}
        <GoalsProgress goals={goals || []} className="mb-8" />

        {/* 🆕 Recent Transactions */}
        {recentTransactions && recentTransactions.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-phi-frost mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-phi-dark">תנועות אחרונות</h3>
              <Link href="/dashboard/overview" className="text-sm text-phi-gold hover:underline">
                הצג הכל →
              </Link>
            </div>
            <div className="space-y-3">
              {recentTransactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-phi-frost last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {tx.type === 'income' ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-phi-dark">{tx.vendor || tx.category || 'תנועה'}</p>
                      <p className="text-xs text-phi-slate">{tx.date}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className={`font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}₪{Number(tx.amount).toLocaleString('he-IL')}
                    </p>
                    {tx.status === 'pending' && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">ממתין</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-phi-frost">
          <h3 className="text-lg font-bold text-phi-dark mb-4">פעולות מהירות</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* WhatsApp - Primary */}
            <a
              href="https://wa.me/972544266506"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center p-4 rounded-xl bg-[#25D366]/10 border-2 border-[#25D366]/30 hover:border-[#25D366] transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#25D366] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-phi-dark text-center">וואטסאפ</span>
            </a>

            {/* Upload Documents */}
            <Link
              href="/dashboard/missing-documents"
              className="flex flex-col items-center p-4 rounded-xl bg-phi-gold/10 border-2 border-phi-gold/30 hover:border-phi-gold transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-phi-gold flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-phi-dark text-center">העלה דוח</span>
            </Link>

            {/* Charts */}
            <Link
              href="/dashboard/overview"
              className="flex flex-col items-center p-4 rounded-xl bg-phi-mint/10 border-2 border-phi-mint/30 hover:border-phi-mint transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-phi-mint flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-phi-dark text-center">גרפים</span>
            </Link>

            {/* Budget */}
            <Link
              href="/dashboard/budget"
              className="flex flex-col items-center p-4 rounded-xl bg-phi-coral/10 border-2 border-phi-coral/30 hover:border-phi-coral transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-phi-coral flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-phi-dark text-center">תקציב</span>
            </Link>
          </div>
        </div>

        {/* WhatsApp Tip */}
        <div className="mt-8 bg-gradient-to-l from-[#25D366]/10 to-transparent rounded-xl p-4 border border-[#25D366]/20">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-serif text-lg">{PHI}</span>
            </div>
            <div>
              <p className="text-phi-dark font-medium text-sm">
                כל הפעולות מתבצעות דרך וואטסאפ!
              </p>
              <p className="text-phi-slate text-xs">
                שלח דוחות, שאל שאלות, קבל תובנות - הכל במקום אחד 💬
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

