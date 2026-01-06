import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, MessageCircle, BarChart3, ArrowLeft } from 'lucide-react'
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

  // Get time-based greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב'

  const currentPhase = userDataInfo.phase || 'data_collection'
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

        {/* Goals Progress */}
        <GoalsProgress goals={goals || []} className="mb-8" />

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
