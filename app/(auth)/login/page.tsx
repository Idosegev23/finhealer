'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

// ϕ = U+03D5 (mathematical phi)
const PHI = 'ϕ'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) throw error
    } catch (err: any) {
      setError(err.message || 'אירעה שגיאה בהתחברות')
      setIsLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setIsLoading(true)
      setError(null)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        window.location.href = '/dashboard'
      }
    } catch (err: any) {
      setError(err.message || 'אירעה שגיאה בהתחברות')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-phi-gold via-phi-coral to-phi-gold relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-white">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-[200px] font-serif leading-none drop-shadow-2xl">
              {PHI}
            </span>
          </motion.div>
          <motion.h2 
            className="text-3xl font-bold mt-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            היחס הזהב של הכסף שלך
          </motion.h2>
          <motion.p 
            className="text-lg mt-4 opacity-90 text-center max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            מאמן פיננסי דיגיטלי בוואטסאפ
          </motion.p>
        </div>
        {/* Decorative circles */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-block">
              <span className="text-6xl font-serif text-phi-gold">{PHI}</span>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl font-bold text-phi-dark mb-2">
              ברוך הבא
            </h1>
            <p className="text-phi-slate mb-8">
              התחבר לחשבון שלך
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mb-6 text-sm">
                {error}
              </div>
            )}

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full bg-white border-2 border-phi-frost hover:border-phi-gold text-phi-dark font-medium py-4 px-6 rounded-lg transition duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>מתחבר...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>המשך עם Google</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-phi-frost"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-phi-slate">או</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-phi-dark mb-2">
                  כתובת מייל
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-phi-frost rounded-lg focus:ring-2 focus:ring-phi-gold focus:border-transparent transition"
                  placeholder="your@email.com"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-phi-dark mb-2">
                  סיסמה
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-phi-frost rounded-lg focus:ring-2 focus:ring-phi-gold focus:border-transparent transition"
                  placeholder="הסיסמה שלך"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-phi-dark hover:bg-phi-slate text-white font-medium py-4 px-6 rounded-lg transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>מתחבר...</span>
                  </>
                ) : (
                  <span>כניסה</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-phi-slate">
              <p>
                בהתחברות אתה מסכים ל
                <Link href="/legal/terms" className="text-phi-gold hover:underline mx-1">
                  תנאי השימוש
                </Link>
                ול
                <Link href="/legal/privacy" className="text-phi-gold hover:underline mx-1">
                  מדיניות הפרטיות
                </Link>
              </p>
            </div>

            {/* Sign Up Link */}
            <div className="text-center mt-8 pt-8 border-t border-phi-frost">
              <p className="text-phi-slate">
                עדיין אין לך חשבון?{' '}
                <Link href="/signup" className="text-phi-gold hover:underline font-medium">
                  הירשם כאן
                </Link>
              </p>
            </div>

            {/* Back to Home */}
            <div className="text-center mt-4">
              <Link href="/" className="text-phi-slate hover:text-phi-dark transition text-sm">
                ← חזרה לדף הבית
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
