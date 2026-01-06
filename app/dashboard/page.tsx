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

  // 🆕 Get monthly transactions summary
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const { data: monthlyTransactions } = await supabase
    .from('transactions')
    .select('type, amount, status')
    .eq('user_id', user.id)
    .gte('date', `${currentMonth}-01`)
    .lte('date', `${currentMonth}-31`)

  const monthlyIncome = (monthlyTransactions || [])
    .filter((t: any) => t.type === 'income')
    .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
  
  const monthlyExpenses = (monthlyTransactions || [])
    .filter((t: any) => t.type === 'expense')
    .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)

  const pendingCount = (monthlyTransactions || [])
    .filter((t: any) => t.status === 'pending' || t.status === 'proposed').length

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

  const currentPhase = userDataInfo.phase || 'data_collection'
  const onboardingState = userDataInfo.onboarding_state || 'start'
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

        {/* 🆕 Monthly Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-phi-frost">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm text-phi-slate">הכנסות החודש</span>
            </div>
            <p className="text-2xl font-bold text-green-600">₪{monthlyIncome.toLocaleString('he-IL')}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-phi-frost">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm text-phi-slate">הוצאות החודש</span>
            </div>
            <p className="text-2xl font-bold text-red-600">₪{monthlyExpenses.toLocaleString('he-IL')}</p>
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
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm text-phi-slate">מסמכים שהועלו</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{documentsCount || 0}</p>
          </div>
        </div>

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

            {/* Transactions */}
            <Link
              href="/transactions"
              className="flex flex-col items-center p-4 rounded-xl bg-phi-coral/10 border-2 border-phi-coral/30 hover:border-phi-coral transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-phi-coral flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ArrowLeft className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-phi-dark text-center">תנועות</span>
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
