'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CreditCard, CheckCircle2, Shield, Star, Calendar } from 'lucide-react'

type Plan = 'basic' | 'advanced'

export default function PaymentPage() {
  const router = useRouter()
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<Plan>('basic')
  const [onboardingType, setOnboardingType] = useState<'quick' | 'full'>('quick')

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          console.log('❌ לא מחובר, מפנה להתחברות')
          router.push('/login')
          return
        }
        
        setUserId(user.id)
        console.log('✅ משתמש מחובר:', user.email)

        // טען בחירות מ-localStorage (אם יש)
        if (typeof window !== 'undefined') {
          const savedPlan = localStorage.getItem('finhealer_plan_type') as Plan | null
          const savedOnboarding = localStorage.getItem('finhealer_onboarding_type') as 'quick' | 'full' | null
          
          if (savedPlan) setSelectedPlan(savedPlan)
          if (savedOnboarding) setOnboardingType(savedOnboarding)
          
          console.log('📋 הגדרות נבחרו:', { plan: savedPlan || 'basic', onboarding: savedOnboarding || 'quick' })
        }

        // בדוק אם כבר שילם (רשומה ב-users table)
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('subscription_status, phase')
          .eq('id', user.id)
          .maybeSingle()

        // אם יש רשומה במסד נתונים
        if (userData && !userError) {
          const userInfo = userData as any
          console.log('👤 סטטוס משתמש:', userInfo)
          
          if (userInfo.subscription_status === 'active') {
            console.log('✅ משתמש כבר שילם, מפנה ל-dashboard')
            router.push('/dashboard')
            return
          }
        } else {
          // אין רשומה - משתמש חדש שטרם שילם
          console.log('🆕 משתמש חדש - טרם שילם')
        }
      } catch (err) {
        console.error('❌ שגיאה בטעינת נתונים:', err)
        setError('שגיאה בטעינת הנתונים. אנא נסה לרענן את הדף.')
      }
    }

    checkAuth()
  }, [router])

  // סליקה דמה - בפרודקשן זה יהיה אינטגרציה אמיתית עם חשבונית ירוקה
  const handleDemoPayment = async (plan: Plan) => {
    if (!userId) return

    const amount = plan === 'basic' ? 49 : 119

    try {
      setIsProcessing(true)
      setError(null)

      console.log('💳 מעבד תשלום דמה...', { plan, amount })

      // קריאה ל-API שמטפל במנוי ויצירת user
      const response = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          plan,
          onboardingType 
        }),
      })

      // בדוק אם התגובה היא JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.error('התקבלה תגובה לא-JSON:', await response.text())
        throw new Error('שגיאה בשרת - נא לנסות שוב')
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'שגיאה ביצירת מנוי')
      }

      console.log('✅ תשלום הושלם בהצלחה!', result)

      // המתן רגע להצגת הודעת הצלחה
      await new Promise(resolve => setTimeout(resolve, 1500))

      // נקה localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('finhealer_plan_type')
        localStorage.removeItem('finhealer_start_method')
        // אבל שמור את onboarding_type למסע ההמשך
      }

      // הפנה למסלול onboarding הנכון
      if (onboardingType === 'quick') {
        window.location.href = '/onboarding/quick'
      } else {
        window.location.href = '/reflection'
      }
    } catch (err: any) {
      console.error('❌ שגיאה בתשלום:', err)
      setError(err.message || 'אירעה שגיאה בעיבוד התשלום')
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-white to-success/10 px-4 py-12">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-dark mb-2">
            הצטרף ל-FinHealer
          </h1>
          <p className="text-lg text-muted-foreground">
            בחר את התוכנית המתאימה לך
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mb-6 text-sm max-w-2xl mx-auto">
            {error}
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Basic Plan */}
          <PricingCard
            title="בסיסי"
            price={49}
            features={[
              "מעקב הוצאות והכנסות בלתי מוגבל",
              "בוט וואטסאפ חכם 24/7",
              "AI Assistant אישי בעברית",
              "זיהוי קבלות אוטומטי (OCR)",
              "התראות חכמות בזמן אמת",
              "דוחות וגרפים מתקדמים",
              "ניהול יעדי חיסכון",
            ]}
            isSelected={selectedPlan === 'basic'}
            onSelect={() => setSelectedPlan('basic')}
            onPurchase={() => handleDemoPayment('basic')}
            isProcessing={isProcessing && selectedPlan === 'basic'}
          />

          {/* Advanced Plan */}
          <PricingCard
            title="מתקדם"
            price={119}
            badge="הכי פופולרי"
            features={[
              "כל מה שיש בתוכנית הבסיסית",
              "פגישות אישיות מוזלות עם יועץ",
              "2 פגישות זום בחודש (במקום 1)",
              "מעקב צמוד יותר",
              "גישה מועדפת לתכונות חדשות",
              "דוחות מתקדמים נוספים",
              "תמיכה עדיפות",
            ]}
            isSelected={selectedPlan === 'advanced'}
            onSelect={() => setSelectedPlan('advanced')}
            onPurchase={() => handleDemoPayment('advanced')}
            isProcessing={isProcessing && selectedPlan === 'advanced'}
            highlight
          />
        </div>

        {/* Terms */}
        <div className="text-center text-xs text-muted-foreground space-y-2">
          <p>
            בלחיצה על &quot;שלם והתחל עכשיו&quot; אתה מסכים ל
            <a href="/legal/terms" className="text-primary hover:underline mx-1">
              תנאי השימוש
            </a>
            ול
            <a href="/legal/privacy" className="text-primary hover:underline mx-1">
              מדיניות הפרטיות
            </a>
          </p>
          <p>🔒 ניתן לבטל את המנוי בכל עת ללא התחייבות</p>
        </div>
      </div>
    </div>
  )
}

function PricingCard({
  title,
  price,
  features,
  badge,
  isSelected,
  onSelect,
  onPurchase,
  isProcessing,
  highlight = false,
}: {
  title: string
  price: number
  features: string[]
  badge?: string
  isSelected: boolean
  onSelect: () => void
  onPurchase: () => void
  isProcessing: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-2xl p-8 border-2 transition-all cursor-pointer ${
        highlight
          ? 'border-primary/50 relative'
          : isSelected
          ? 'border-primary'
          : 'border-gray-200'
      }`}
      onClick={onSelect}
    >
      {badge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-gradient-to-r from-primary to-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1">
            <Star className="w-4 h-4" />
            {badge}
          </span>
        </div>
      )}

      {/* Title */}
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-dark mb-2">{title}</h3>
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-5xl font-bold text-primary">₪{price}</span>
          <span className="text-lg text-muted-foreground">/חודש</span>
        </div>
        {price === 49 && (
          <p className="text-success font-medium mt-2">🎉 7 ימי ניסיון חינם!</p>
        )}
      </div>

      {/* Features */}
      <div className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <div key={index} className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <span className="text-sm text-dark">{feature}</span>
          </div>
        ))}
      </div>

      {/* Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onPurchase()
        }}
        disabled={isProcessing}
        className={`w-full font-bold py-4 px-6 rounded-xl transition duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${
          highlight
            ? 'bg-gradient-to-r from-primary to-blue-600 text-white hover:opacity-90'
            : 'bg-primary text-white hover:bg-primary/90'
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>מעבד תשלום...</span>
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            <span>בחר תוכנית זו</span>
          </>
        )}
      </button>

      {title === 'מתקדם' && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-2">
          <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            <strong>פגישות מוזלות:</strong> 2 פגישות זום חודשיות במחיר מיוחד
          </p>
        </div>
      )}
    </div>
  )
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
      <span className="text-dark">{text}</span>
    </div>
  )
}

