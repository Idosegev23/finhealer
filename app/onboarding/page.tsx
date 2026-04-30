'use client'

// ============================================================================
// φ Onboarding — clearer 3-step flow
// ----------------------------------------------------------------------------
// Each step:
//   1. Has a numbered, named progress indicator (not just dots).
//   2. Explains *why* we're asking for what we're asking for.
//   3. Shows what's coming next.
// Wrapped in <TourProvider> so the welcome tour can pop on first visit.
// ============================================================================

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Loader2,
  MessageCircle,
  CheckCircle2,
  ArrowLeft,
  ChevronLeft,
  Phone,
  Sparkles,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react'
import { WHATSAPP_BOT_NUMBER } from '@/lib/constants'
import { TourProvider, AutoStartTour, useTour } from '@/components/tour/TourProvider'

const PHI = 'ϕ'

type Step = 'welcome' | 'phone' | 'done'

const STEPS: { id: Step; label: string; sublabel: string }[] = [
  { id: 'welcome', label: 'הכרות', sublabel: 'מה הולך לקרות' },
  { id: 'phone', label: 'חיבור וואטסאפ', sublabel: 'איך נדבר' },
  { id: 'done', label: 'סיום', sublabel: 'מתחילים' },
]

export default function OnboardingPage() {
  return (
    <TourProvider>
      <OnboardingInner />
    </TourProvider>
  )
}

function OnboardingInner() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
    }
    checkAuth()
  }, [router])

  const handlePhoneSubmit = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      setError('אנא הכנס מספר טלפון תקין (לפחות 9 ספרות)')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const cleanedPhone = phone.replace(/\D/g, '')
      let phoneFormatted = cleanedPhone
      if (cleanedPhone.startsWith('0')) {
        phoneFormatted = '972' + cleanedPhone.substring(1)
      } else if (!cleanedPhone.startsWith('972')) {
        phoneFormatted = '972' + cleanedPhone
      }

      const referralCode = localStorage.getItem('phi-referral-code')
      const response = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'basic',
          onboardingType: 'quick',
          phone: phoneFormatted,
          waOptIn: true,
          referralCode: referralCode || undefined,
        }),
      })
      if (referralCode) localStorage.removeItem('phi-referral-code')
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'שגיאה בשמירת הנתונים')
      }
      try {
        const welcomeResponse = await fetch(`/api/wa/welcome?phone=${encodeURIComponent(phoneFormatted)}`)
        const welcomeData = await welcomeResponse.json()
        await fetch('/api/wa/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phoneFormatted,
            message:
              welcomeData.message ||
              `היי! 👋 אני *${PHI} (פאי)* — המאמן הפיננסי שלך. שלח לי דוחות בנק ונתחיל!`,
            isOnboarding: true,
          }),
        })
      } catch {
        console.error('WhatsApp message failed')
      }
      setStep('done')
    } catch (err: any) {
      setError(err.message || 'אירעה שגיאה')
    } finally {
      setIsLoading(false)
    }
  }

  const waLink = `https://wa.me/${WHATSAPP_BOT_NUMBER}`
  const stepIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-phi-bg via-white to-phi-bg/50 relative overflow-hidden"
      dir="rtl"
    >
      {/* Auto-launch the welcome tour on first visit */}
      <AutoStartTour tourId="onboarding-welcome" delay={650} />

      {/* Background decoration */}
      <div
        aria-hidden
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-phi-gold/15 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-phi-mint/10 blur-3xl"
      />

      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
        <div className="w-full max-w-xl">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center justify-center gap-2 mb-8 text-phi-slate hover:text-phi-dark transition"
          >
            <span className="text-3xl font-serif text-phi-gold">{PHI}</span>
            <span className="font-bold text-phi-dark">Phi</span>
            <span className="text-[10px] uppercase tracking-wider text-phi-coral border border-phi-coral/30 bg-phi-coral/5 rounded-full px-2 py-0.5">
              Beta
            </span>
          </Link>

          {/* Labeled progress bar — replaces tiny dots */}
          <div data-tour="progress" className="mb-8">
            <div className="flex items-center justify-between mb-3">
              {STEPS.map((s, i) => {
                const reached = i <= stepIndex
                const isCurrent = i === stepIndex
                return (
                  <div key={s.id} className="flex-1 flex items-center">
                    <div className="flex flex-col items-center w-full">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                          reached
                            ? 'bg-phi-dark text-white shadow-md'
                            : 'bg-white border-2 border-phi-frost text-phi-slate'
                        } ${isCurrent ? 'ring-4 ring-phi-gold/30' : ''}`}
                      >
                        {i < stepIndex ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                      </div>
                      <div className="mt-2 text-center hidden sm:block">
                        <div
                          className={`text-xs font-medium ${
                            reached ? 'text-phi-dark' : 'text-phi-slate'
                          }`}
                        >
                          {s.label}
                        </div>
                        <div className="text-[10px] text-phi-slate/70">{s.sublabel}</div>
                      </div>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-1 mb-6 sm:mb-12 transition-all ${
                          i < stepIndex ? 'bg-phi-dark' : 'bg-phi-frost'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 'welcome' && (
              <WelcomeStep key="welcome" onContinue={() => setStep('phone')} />
            )}
            {step === 'phone' && (
              <PhoneStep
                key="phone"
                phone={phone}
                setPhone={setPhone}
                error={error}
                setError={setError}
                isLoading={isLoading}
                onSubmit={handlePhoneSubmit}
                onBack={() => setStep('welcome')}
              />
            )}
            {step === 'done' && <DoneStep key="done" waLink={waLink} />}
          </AnimatePresence>

          {/* Help / replay tour */}
          <ReplayTourLink />

          <div className="text-center mt-2">
            <Link href="/" className="text-phi-slate hover:text-phi-dark transition text-xs">
              ← חזרה לדף הבית
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Step 1 — Welcome
// ============================================================================
function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white rounded-3xl shadow-xl shadow-phi-dark/5 p-8 md:p-10 border border-phi-frost"
    >
      <div className="text-center mb-6">
        <motion.span
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="inline-block text-7xl font-serif text-phi-gold mb-4 animate-phi-glow"
        >
          {PHI}
        </motion.span>
        <h1 className="text-2xl md:text-3xl font-bold text-phi-dark mb-2">
          ברוך הבא! בוא נכיר.
        </h1>
        <p className="text-phi-slate">
          אני {PHI} — המאמן הפיננסי שלך. ההגדרה לוקחת פחות משלוש דקות.
        </p>
      </div>

      {/* What's about to happen */}
      <div className="bg-gradient-to-br from-phi-bg/60 to-white rounded-2xl p-5 mb-6 border border-phi-frost/60 text-right">
        <p className="text-sm font-bold text-phi-dark mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-phi-gold" />
          מה הולך לקרות עכשיו
        </p>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-phi-dark/5 text-phi-dark text-xs font-bold flex items-center justify-center">
              1
            </span>
            <div>
              <span className="font-medium text-phi-dark">תזין מספר טלפון</span>
              <p className="text-phi-slate text-xs mt-0.5">
                כדי שנוכל לחבר אותך לבוט WhatsApp שלנו
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-phi-dark/5 text-phi-dark text-xs font-bold flex items-center justify-center">
              2
            </span>
            <div>
              <span className="font-medium text-phi-dark">תקבל הודעת ברכה בוואטסאפ</span>
              <p className="text-phi-slate text-xs mt-0.5">תוך שניות, מ-{PHI} ישירות לאפליקציה</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-phi-dark/5 text-phi-dark text-xs font-bold flex items-center justify-center">
              3
            </span>
            <div>
              <span className="font-medium text-phi-dark">תשלח דוח בנק PDF</span>
              <p className="text-phi-slate text-xs mt-0.5">3 חודשים אחרונים — ו-φ יתחיל לעבוד</p>
            </div>
          </li>
        </ol>
      </div>

      {/* Privacy assurance */}
      <div className="flex items-start gap-2.5 text-xs text-phi-slate mb-6 bg-phi-mint/5 border border-phi-mint/20 rounded-xl p-3">
        <ShieldCheck className="w-4 h-4 text-phi-mint flex-shrink-0 mt-0.5" />
        <p>
          כל הנתונים שלך מוצפנים. לא נחלוק עם אף אחד, ואפשר למחוק את החשבון בכל רגע.
        </p>
      </div>

      <button
        onClick={onContinue}
        className="w-full bg-phi-dark text-white py-4 rounded-xl font-medium hover:bg-[#053448] transition flex items-center justify-center gap-2 shadow-lg shadow-phi-dark/20 hover:shadow-xl hover:shadow-phi-dark/30"
      >
        <span>בוא נתחיל</span>
        <ChevronLeft className="w-5 h-5" />
      </button>
    </motion.div>
  )
}

// ============================================================================
// Step 2 — Phone
// ============================================================================
function PhoneStep({
  phone,
  setPhone,
  error,
  setError,
  isLoading,
  onSubmit,
  onBack,
}: {
  phone: string
  setPhone: (v: string) => void
  error: string | null
  setError: (v: string | null) => void
  isLoading: boolean
  onSubmit: () => void
  onBack: () => void
}) {
  const isValid = phone && phone.replace(/\D/g, '').length >= 9

  return (
    <motion.div
      data-tour="phone-step"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white rounded-3xl shadow-xl shadow-phi-dark/5 p-8 md:p-10 border border-phi-frost"
    >
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-phi-gold/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Phone className="w-7 h-7 text-phi-coral" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-phi-dark mb-2">
          איך נדבר איתך?
        </h1>
        <p className="text-phi-slate">
          אנחנו צריכים מספר וואטסאפ כדי להתחבר אליך. זה הערוץ העיקרי לעבודה איתי.
        </p>
      </div>

      {/* Why we need this */}
      <div className="bg-phi-bg/40 rounded-xl p-4 mb-6 text-sm text-phi-slate">
        <p className="font-medium text-phi-dark mb-1.5">למה אנחנו צריכים את זה?</p>
        <ul className="space-y-1 text-xs leading-relaxed">
          <li>• כדי לשלוח לך הודעת פתיחה ב-WhatsApp</li>
          <li>• כדי לקבל ממך דוחות בנק (פשוט שולחים את ה-PDF לבוט)</li>
          <li>• כדי לענות לך מיד על שאלות פיננסיות</li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <label className="block text-sm font-medium text-phi-dark mb-2">מספר טלפון נייד</label>
      <input
        type="tel"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value)
          setError(null)
        }}
        placeholder="050-1234567"
        className="w-full px-4 py-4 border-2 border-phi-frost rounded-xl focus:ring-2 focus:ring-phi-gold focus:border-phi-gold transition text-lg text-center font-mono"
        dir="ltr"
        disabled={isLoading}
        autoComplete="tel"
        inputMode="tel"
      />
      {isValid && (
        <p className="text-sm text-phi-mint mt-2 text-center flex items-center justify-center gap-1">
          <CheckCircle2 className="w-4 h-4" />
          המספר תקין — אפשר להמשיך
        </p>
      )}

      <button
        onClick={onSubmit}
        disabled={isLoading || !isValid}
        className="mt-6 w-full bg-phi-dark text-white py-4 rounded-xl font-medium hover:bg-[#053448] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-phi-dark/20"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>מחבר אותך...</span>
          </>
        ) : (
          <>
            <span>חבר אותי לוואטסאפ</span>
            <ChevronLeft className="w-5 h-5" />
          </>
        )}
      </button>

      <button
        onClick={onBack}
        className="w-full text-phi-slate py-3 mt-2 text-sm hover:text-phi-dark transition"
      >
        ← חזרה
      </button>
    </motion.div>
  )
}

// ============================================================================
// Step 3 — Done
// ============================================================================
function DoneStep({ waLink }: { waLink: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-3xl shadow-xl shadow-phi-dark/5 p-8 md:p-10 border border-phi-frost text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        className="mb-6"
      >
        <div className="w-20 h-20 bg-phi-mint/15 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-phi-mint" />
        </div>
      </motion.div>

      <h1 className="text-2xl md:text-3xl font-bold text-phi-dark mb-3">
        מעולה! ההגדרה הושלמה.
      </h1>

      <p className="text-phi-slate mb-2">שלחנו לך הודעה ב-WhatsApp.</p>
      <p className="text-phi-slate mb-6 text-sm">
        השלב הבא: שלח דוח בנק PDF לבוט (3 חודשים אחרונים), ו-φ יתחיל לעבוד.
      </p>

      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full bg-[#25D366] hover:bg-[#1ebe5a] text-white py-4 rounded-xl font-medium transition flex items-center justify-center gap-3 mb-3 shadow-lg shadow-[#25D366]/30"
      >
        <MessageCircle className="w-5 h-5" />
        <span>פתח WhatsApp</span>
      </a>

      <Link
        href="/dashboard"
        className="w-full border border-phi-frost text-phi-dark py-4 rounded-xl font-medium hover:bg-phi-bg/50 transition flex items-center justify-center gap-2"
      >
        <span>היכנס לדשבורד</span>
        <ArrowLeft className="w-5 h-5" />
      </Link>
    </motion.div>
  )
}

// ============================================================================
// Replay tour link — small button under the form
// ============================================================================
function ReplayTourLink() {
  const { start, resetSeen } = useTour()
  return (
    <div className="text-center mt-6">
      <button
        onClick={() => {
          resetSeen('onboarding-welcome')
          start('onboarding-welcome', { force: true })
        }}
        className="inline-flex items-center gap-1.5 text-sm text-phi-slate hover:text-phi-dark transition"
      >
        <HelpCircle className="w-4 h-4" />
        הצג לי שוב את ההסברים
      </button>
    </div>
  )
}
