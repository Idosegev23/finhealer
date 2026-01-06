'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Loader2, MessageCircle, CheckCircle2, ArrowLeft, ChevronLeft } from 'lucide-react'

// ϕ = U+03D5 (mathematical phi)
const PHI = 'ϕ'

type Step = 'welcome' | 'phone' | 'done'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formattedPhone, setFormattedPhone] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
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
      setError('אנא הכנס מספר טלפון תקין')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Format phone number
      const cleanedPhone = phone.replace(/\D/g, '')
      let phoneFormatted = cleanedPhone
      if (cleanedPhone.startsWith('0')) {
        phoneFormatted = '972' + cleanedPhone.substring(1)
      } else if (!cleanedPhone.startsWith('972')) {
        phoneFormatted = '972' + cleanedPhone
      }
      
      setFormattedPhone(phoneFormatted)

      // Create/update user with phone
      const response = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'basic',
          onboardingType: 'quick',
          phone: phoneFormatted,
          waOptIn: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'שגיאה בשמירת הנתונים')
      }

      // Send WhatsApp welcome message
      try {
        const welcomeResponse = await fetch(`/api/wa/welcome?phone=${encodeURIComponent(phoneFormatted)}`)
        const welcomeData = await welcomeResponse.json()
        
        await fetch('/api/wa/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phoneFormatted,
            message: welcomeData.message || `היי! 👋 אני *${PHI} (פאי)* - המאמן הפיננסי שלך. שלח לי דוחות בנק ונתחיל!`,
            isOnboarding: true,
          }),
        })
      } catch {
        // Don't block if WhatsApp fails
        console.error('WhatsApp message failed')
      }

      setStep('done')
    } catch (err: any) {
      setError(err.message || 'אירעה שגיאה')
    } finally {
      setIsLoading(false)
    }
  }

  const botPhoneNumber = '972544266506'
  const waLink = `https://wa.me/${botPhoneNumber}`

  return (
    <div className="min-h-screen bg-phi-bg flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {['welcome', 'phone', 'done'].map((s, i) => (
            <div 
              key={s}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                s === step ? 'bg-phi-gold w-8' : 
                ['welcome', 'phone', 'done'].indexOf(step) > i ? 'bg-phi-gold' : 'bg-phi-frost'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Welcome */}
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl shadow-lg p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <span className="text-8xl font-serif text-phi-gold inline-block mb-6">
                  {PHI}
                </span>
              </motion.div>

              <h1 className="text-2xl font-bold text-phi-dark mb-4">
                ברוכים הבאים!
              </h1>
              
              <p className="text-phi-slate mb-2">
                אני {PHI}, המאמן הפיננסי שלך.
              </p>
              <p className="text-phi-slate mb-8">
                בואו נתחיל את המסע יחד!
              </p>

              <div className="bg-phi-bg/50 rounded-xl p-4 mb-8 text-right">
                <p className="text-sm text-phi-slate mb-3 font-medium">איך זה עובד:</p>
                <ul className="space-y-2 text-sm text-phi-slate">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-phi-mint flex-shrink-0" />
                    <span>שולח לי דוחות בנק בוואטסאפ</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-phi-mint flex-shrink-0" />
                    <span>אני מנתח ומזהה דפוסים</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-phi-mint flex-shrink-0" />
                    <span>ביחד בונים תקציב חכם</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setStep('phone')}
                className="w-full bg-phi-dark text-white py-4 rounded-lg font-medium hover:bg-phi-slate transition flex items-center justify-center gap-2"
              >
                <span>המשך</span>
                <ChevronLeft className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* Step 2: Phone */}
          {step === 'phone' && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl shadow-lg p-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-phi-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-phi-gold" />
                </div>
                <h1 className="text-2xl font-bold text-phi-dark mb-2">
                  מה המספר שלך?
                </h1>
                <p className="text-phi-slate text-sm">
                  נשתמש בו לוואטסאפ
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm">
                  {error}
                </div>
              )}

              <div className="mb-6">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setError(null)
                  }}
                  placeholder="050-1234567"
                  className="w-full px-4 py-4 border-2 border-phi-frost rounded-lg focus:ring-2 focus:ring-phi-gold focus:border-transparent text-lg text-center"
                  dir="ltr"
                  disabled={isLoading}
                />
                {phone && phone.replace(/\D/g, '').length >= 9 && (
                  <p className="text-sm text-phi-mint mt-2 text-center flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    פורמט תקין
                  </p>
                )}
              </div>

              <button
                onClick={handlePhoneSubmit}
                disabled={isLoading || phone.replace(/\D/g, '').length < 9}
                className="w-full bg-phi-dark text-white py-4 rounded-lg font-medium hover:bg-phi-slate transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>שומר...</span>
                  </>
                ) : (
                  <>
                    <span>המשך</span>
                    <ChevronLeft className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                onClick={() => setStep('welcome')}
                className="w-full text-phi-slate py-3 mt-3 text-sm hover:text-phi-dark transition"
              >
                חזרה
              </button>
            </motion.div>
          )}

          {/* Step 3: Done */}
          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-lg p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="mb-6"
              >
                <div className="w-20 h-20 bg-phi-mint/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-phi-mint" />
                </div>
              </motion.div>

              <h1 className="text-2xl font-bold text-phi-dark mb-2">
                מעולה! 🎉
              </h1>
              
              <p className="text-phi-slate mb-2">
                שלחנו לך הודעה בוואטסאפ.
              </p>
              <p className="text-phi-slate mb-8">
                שלח לנו את דוחות הבנק שלך ונתחיל!
              </p>

              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white py-4 rounded-lg font-medium transition flex items-center justify-center gap-3 mb-4"
              >
                <MessageCircle className="w-5 h-5" />
                <span>פתח וואטסאפ</span>
              </a>

              <Link
                href="/dashboard"
                className="w-full border-2 border-phi-frost text-phi-dark py-4 rounded-lg font-medium hover:bg-phi-frost/50 transition flex items-center justify-center gap-2"
              >
                <span>לדשבורד</span>
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back to home */}
        <div className="text-center mt-6">
          <Link href="/" className="text-phi-slate hover:text-phi-dark transition text-sm">
            ← חזרה לדף הבית
          </Link>
        </div>
      </div>
    </div>
  )
}
