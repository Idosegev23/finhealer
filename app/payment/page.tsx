'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Check, CreditCard, Tag, Loader2, Sparkles,
  Shield, Zap, Crown, ArrowLeft, Gift, Lock
} from 'lucide-react'

const PHI = '\u03D5'

type Plan = 'basic' | 'premium'

const PLANS = {
  basic: {
    name: `${PHI} Basic`,
    price: 49,
    period: 'חודש',
    features: [
      'בוט וואטסאפ 24/7',
      'ניתוח AI חכם',
      'תקציב אוטומטי',
      'יעדי חיסכון',
      'התראות חכמות',
      'ציון פיננסי',
    ],
  },
  premium: {
    name: `${PHI} VIP`,
    price: 119,
    period: 'חודש',
    popular: true,
    features: [
      'כל מה שב-Basic',
      '2 שיחות חודשיות עם גדי',
      'תמיכה צמודה בוואטסאפ',
      'תכנון פיננסי מותאם',
      'ייעוץ הלוואות',
      'תמיכה בעדיפות',
    ],
  },
}

export default function PaymentPage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<Plan>('basic')
  const [couponCode, setCouponCode] = useState('')
  const [couponStatus, setCouponStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [couponLabel, setCouponLabel] = useState('')
  const [isFree, setIsFree] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
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

  const validateCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponStatus('checking')

    try {
      const res = await fetch('/api/coupon/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode }),
      })
      const data = await res.json()

      if (data.valid) {
        setCouponStatus('valid')
        setCouponLabel(data.coupon.label)
        if (data.coupon.type === 'free') {
          setIsFree(true)
        }
      } else {
        setCouponStatus('invalid')
        setCouponLabel(data.error || 'קופון לא תקין')
        setIsFree(false)
      }
    } catch {
      setCouponStatus('invalid')
      setCouponLabel('שגיאה בבדיקת הקופון')
    }
  }

  const handlePayment = async () => {
    setIsProcessing(true)

    try {
      if (isFree && couponStatus === 'valid') {
        // Apply free coupon
        const res = await fetch('/api/coupon/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: couponCode, apply: true }),
        })
        const data = await res.json()
        if (!data.applied) throw new Error('Failed to apply coupon')
      } else {
        // Demo payment — just activate trial
        const res = await fetch('/api/subscription/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: selectedPlan }),
        })
        if (!res.ok) throw new Error('Payment failed')
      }

      setShowSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2500)
    } catch (err: any) {
      console.error('Payment error:', err)
      setIsProcessing(false)
    }
  }

  const plan = PLANS[selectedPlan]
  const finalPrice = isFree ? 0 : plan.price

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-phi-bg flex items-center justify-center p-4" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            className="w-20 h-20 bg-phi-mint/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Check className="w-10 h-10 text-phi-mint" />
          </motion.div>
          <h2 className="text-2xl font-bold text-phi-dark mb-2">
            {isFree ? 'הקופון הופעל בהצלחה!' : 'התשלום בוצע בהצלחה!'}
          </h2>
          <p className="text-phi-slate mb-4">
            {isFree ? 'נהנים מגישה מלאה בחינם' : `נרשמת לתוכנית ${plan.name}`}
          </p>
          <div className="flex items-center justify-center gap-2 text-phi-slate text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>מעביר לדשבורד...</span>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-phi-bg flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-6xl font-serif text-phi-gold inline-block mb-4">{PHI}</span>
          <h1 className="text-2xl font-bold text-phi-dark mb-2">בחר את התוכנית שלך</h1>
          <p className="text-phi-slate">7 ימי נסיון חינם לכל תוכנית</p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {(Object.entries(PLANS) as [Plan, typeof PLANS.basic][]).map(([key, p]) => (
            <motion.div
              key={key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedPlan(key)}
              className={`relative bg-white rounded-2xl p-6 cursor-pointer transition-all border-2 ${
                selectedPlan === key
                  ? 'border-phi-gold shadow-lg shadow-phi-gold/10'
                  : 'border-phi-frost hover:border-phi-gold/30'
              }`}
            >
              {('popular' in p && (p as any).popular) && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-phi-gold text-phi-dark text-xs font-bold px-3 py-1 rounded-full">
                    הכי פופולרי
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-phi-dark text-lg">{p.name}</h3>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedPlan === key ? 'border-phi-gold bg-phi-gold' : 'border-phi-frost'
                }`}>
                  {selectedPlan === key && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-phi-dark">{isFree ? '0' : p.price}</span>
                <span className="text-phi-slate text-sm mr-1">{isFree ? '' : `₪/${p.period}`}</span>
                {isFree && <span className="text-phi-mint font-bold text-sm mr-2">חינם!</span>}
              </div>

              <ul className="space-y-2">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-phi-slate">
                    <Check className="w-4 h-4 text-phi-mint flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Payment Card */}
        <motion.div
          layout
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          {/* Coupon */}
          <div className="mb-6">
            <label className="text-sm font-medium text-phi-dark mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4 text-phi-gold" />
              יש לך קופון?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value)
                  if (couponStatus !== 'idle') {
                    setCouponStatus('idle')
                    setCouponLabel('')
                    setIsFree(false)
                  }
                }}
                placeholder="הכנס קוד קופון"
                className="flex-1 px-4 py-3 border-2 border-phi-frost rounded-lg focus:ring-2 focus:ring-phi-gold focus:border-transparent text-sm"
                dir="ltr"
              />
              <button
                onClick={validateCoupon}
                disabled={!couponCode.trim() || couponStatus === 'checking'}
                className="px-5 py-3 bg-phi-dark text-white rounded-lg font-medium hover:bg-phi-slate transition disabled:opacity-50 text-sm whitespace-nowrap"
              >
                {couponStatus === 'checking' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'הפעל'
                )}
              </button>
            </div>

            <AnimatePresence>
              {couponStatus === 'valid' && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 flex items-center gap-2 text-phi-mint text-sm"
                >
                  <Gift className="w-4 h-4" />
                  <span>{couponLabel}</span>
                </motion.div>
              )}
              {couponStatus === 'invalid' && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 text-red-500 text-sm"
                >
                  {couponLabel}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="border-t border-phi-frost my-4" />

          {/* Summary */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-phi-slate text-sm">תוכנית</span>
              <span className="text-phi-dark font-medium">{plan.name}</span>
            </div>
            {isFree && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-phi-slate text-sm">קופון</span>
                <span className="text-phi-mint font-medium">{couponLabel}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-lg font-bold">
              <span className="text-phi-dark">סה&quot;כ</span>
              <span className={isFree ? 'text-phi-mint' : 'text-phi-dark'}>
                {isFree ? 'חינם' : `₪${finalPrice}/${plan.period}`}
              </span>
            </div>
          </div>

          {/* Demo Card (visual only) */}
          {!isFree && (
            <div className="mb-6 bg-gradient-to-br from-phi-dark to-phi-slate rounded-xl p-5 text-white">
              <div className="flex justify-between items-start mb-8">
                <CreditCard className="w-8 h-8 opacity-80" />
                <span className="text-xs opacity-60">DEMO</span>
              </div>
              <div className="text-lg tracking-[0.2em] mb-4 font-mono" dir="ltr">
                •••• •••• •••• 4242
              </div>
              <div className="flex justify-between text-xs opacity-70">
                <span>DEMO USER</span>
                <span>12/28</span>
              </div>
            </div>
          )}

          {/* Pay Button */}
          <button
            onClick={handlePayment}
            disabled={isProcessing}
            className={`w-full py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-3 ${
              isFree
                ? 'bg-phi-mint hover:bg-phi-mint/90 text-white'
                : 'bg-phi-gold hover:bg-phi-gold/90 text-phi-dark'
            } disabled:opacity-50`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>מעבד...</span>
              </>
            ) : isFree ? (
              <>
                <Sparkles className="w-5 h-5" />
                <span>הפעל גישה חינם</span>
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                <span>שלם ₪{finalPrice}</span>
              </>
            )}
          </button>

          {/* Security badges */}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-phi-slate">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              מאובטח SSL
            </span>
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              PCI DSS
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              ביטול בכל עת
            </span>
          </div>
        </motion.div>

        {/* Skip link */}
        <div className="text-center">
          <Link
            href="/dashboard"
            className="text-phi-slate hover:text-phi-dark transition text-sm"
          >
            דלג, אמשיך עם תקופת הנסיון
          </Link>
        </div>
      </div>
    </div>
  )
}
