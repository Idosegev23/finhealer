'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { 
  Menu, X, Shield, CheckCircle2, FileText, Brain, Users,
  Target, ChevronLeft, MessageCircle, TrendingUp, BarChart3
} from 'lucide-react'
import Image from 'next/image'

// ϕ = U+03D5 (mathematical phi - the golden ratio symbol)
const PHI = 'ϕ'

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <main className="min-h-screen bg-white" dir="rtl">
      {/* Header - Minimal */}
      <header className="border-b border-phi-frost/50 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <span className="text-4xl font-serif text-phi-gold">{PHI}</span>
              <span className="text-xl font-bold text-phi-dark hidden sm:inline">Phi</span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-8 items-center">
              <Link href="#how-it-works" className="text-phi-slate hover:text-phi-dark transition-colors">
                איך זה עובד
              </Link>
              <Link href="#pricing" className="text-phi-slate hover:text-phi-dark transition-colors">
                מחירים
              </Link>
              <Link href="/login" className="text-phi-dark font-medium hover:text-phi-gold transition-colors">
                התחבר
              </Link>
              <Link 
                href="/signup" 
                className="bg-phi-dark text-white px-6 py-2.5 rounded-lg font-medium hover:bg-phi-slate transition-all"
              >
                התחל בחינם
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-phi-dark p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <motion.nav
              className="md:hidden mt-4 pb-4 flex flex-col gap-3 border-t border-phi-frost pt-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <Link href="#how-it-works" className="text-phi-slate py-2">איך זה עובד</Link>
              <Link href="#pricing" className="text-phi-slate py-2">מחירים</Link>
              <Link href="/login" className="text-phi-dark py-2 font-medium">התחבר</Link>
              <Link href="/signup" className="bg-phi-dark text-white px-6 py-3 rounded-lg text-center font-medium">
                התחל בחינם
              </Link>
            </motion.nav>
          )}
        </div>
      </header>

      {/* Hero Section - Clean & Minimal */}
      <section className="relative min-h-[80vh] flex items-center">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Phi Symbol - Large & Animated */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="mb-8"
            >
              <span className="text-[120px] md:text-[180px] font-serif text-phi-gold leading-none inline-block animate-phi-glow">
                {PHI}
              </span>
            </motion.div>
            
            <motion.h1 
              className="text-4xl md:text-6xl font-bold text-phi-dark mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              היחס הזהב של הכסף שלך
            </motion.h1>
            
            <motion.p 
              className="text-xl md:text-2xl text-phi-slate mb-4 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              מאמן פיננסי דיגיטלי בוואטסאפ
            </motion.p>

            <motion.p 
              className="text-lg text-phi-slate/80 mb-10 max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              מעלה דוחות → מקבל תובנות → בונה תקציב חכם
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Link
                href="/signup"
                className="group bg-phi-dark text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-phi-slate transition-all inline-flex items-center justify-center gap-2"
              >
                <span>התחל עכשיו - 7 ימים חינם</span>
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </Link>
              <a
                href="#how-it-works"
                className="border-2 border-phi-dark text-phi-dark px-8 py-4 rounded-lg text-lg font-medium hover:bg-phi-dark hover:text-white transition-all text-center"
              >
                איך זה עובד?
              </a>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div 
              className="flex items-center justify-center gap-8 mt-12 text-sm text-phi-slate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-phi-mint" />
                <span>מאובטח</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-phi-mint" />
                <span>ליווי אנושי</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-phi-mint" />
                <span>ללא התחייבות</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3 USPs - Simple Cards */}
      <section className="py-20 bg-phi-bg/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: MessageCircle,
                title: 'פשוט',
                desc: 'שולח PDF בוואטסאפ, AI עושה הכל',
              },
              {
                icon: Brain,
                title: 'חכם',
                desc: 'מזהה מנויים, מגמות, הזדמנויות חיסכון',
              },
              {
                icon: Users,
                title: 'אישי',
                desc: 'גדי - מאמן פיננסי אנושי מלווה',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-2xl shadow-sm border border-phi-frost hover:shadow-lg transition-all text-center"
              >
                <div className="w-14 h-14 bg-phi-gold/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-7 h-7 text-phi-gold" />
                </div>
                <h3 className="text-xl font-bold text-phi-dark mb-2">{item.title}</h3>
                <p className="text-phi-slate">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - 4 Steps */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-phi-dark mb-4">
              איך זה עובד?
            </h2>
            <p className="text-lg text-phi-slate">
              4 צעדים פשוטים לשליטה פיננסית
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { 
                  num: '1', 
                  title: 'שולח דוחות', 
                  desc: 'בנק, אשראי, משכורת - בוואטסאפ',
                  icon: FileText
                },
                { 
                  num: '2', 
                  title: 'AI מנתח', 
                  desc: 'מזהה דפוסים והוצאות קבועות',
                  icon: Brain
                },
                { 
                  num: '3', 
                  title: 'מגדיר יעדים', 
                  desc: 'קרן חירום, חיסכון, רכישות',
                  icon: Target
                },
                { 
                  num: '4', 
                  title: 'מקבל תקציב', 
                  desc: 'תקציב חכם שתומך ביעדים',
                  icon: BarChart3
                },
              ].map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative"
                >
                  <div className="bg-white p-6 rounded-2xl border-2 border-phi-frost hover:border-phi-gold transition-all h-full">
                    <div className="absolute -top-3 right-4 w-8 h-8 rounded-full bg-phi-gold text-white flex items-center justify-center font-bold text-sm">
                      {step.num}
                    </div>
                    <step.icon className="w-10 h-10 text-phi-gold mb-4" />
                    <h3 className="font-bold text-phi-dark mb-2">{step.title}</h3>
                    <p className="text-sm text-phi-slate">{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Phi Score Demo */}
      <section className="py-20 bg-phi-bg/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl md:text-4xl font-bold text-phi-dark mb-6">
                  ציון {PHI} שלך
                </h2>
                <p className="text-lg text-phi-slate mb-6">
                  מדד 0-100 שמשקף את הבריאות הפיננסית שלך, מבוסס על 12 פרמטרים:
                </p>
                <ul className="space-y-3">
                  {[
                    'יחס הכנסות להוצאות',
                    'אחוז חיסכון חודשי',
                    'קיום קרן חירום',
                    'עמידה ביעדים',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-phi-mint flex-shrink-0" />
                      <span className="text-phi-dark">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex justify-center"
              >
                <div className="relative">
                  {/* Score Circle */}
                  <div className="w-48 h-48 rounded-full bg-gradient-to-br from-phi-gold to-phi-coral flex items-center justify-center shadow-2xl">
                    <div className="w-40 h-40 rounded-full bg-white flex flex-col items-center justify-center">
                      <span className="text-5xl font-bold text-phi-dark">72</span>
                      <span className="text-sm text-phi-slate">ציון {PHI}</span>
                    </div>
                  </div>
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-phi-mint text-white px-4 py-1 rounded-full text-sm font-medium">
                    מצב טוב!
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing - Simple */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-phi-dark mb-4">
              מחירים פשוטים
            </h2>
            <p className="text-lg text-phi-slate">
              7 ימי ניסיון חינם, ללא כרטיס אשראי
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Basic */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-2xl border-2 border-phi-frost hover:border-phi-gold transition-all"
            >
              <h3 className="text-2xl font-bold text-phi-dark mb-2">Basic {PHI}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-phi-dark">₪49</span>
                <span className="text-phi-slate">/חודש</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'בוט WhatsApp 24/7',
                  'AI Assistant',
                  'תקציב אוטומטי',
                  'יעדי חיסכון',
                  'התראות חכמות',
                  `ציון ${PHI} בזמן אמת`,
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-phi-mint flex-shrink-0" />
                    <span className="text-phi-dark">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full bg-phi-dark text-white py-3 rounded-lg text-center font-medium hover:bg-phi-slate transition-all"
              >
                התחל בחינם
              </Link>
            </motion.div>

            {/* VIP */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-phi-dark text-white p-8 rounded-2xl border-2 border-phi-gold relative"
            >
              <div className="absolute -top-3 right-6 bg-phi-gold text-white px-3 py-1 rounded-full text-sm font-medium">
                ליווי אישי
              </div>
              <h3 className="text-2xl font-bold mb-2">{PHI} VIP</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">₪119</span>
                <span className="text-white/70">/חודש</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'כל תכונות Basic',
                  '2 פגישות חודשיות עם גדי',
                  'ליווי צמוד בוואטסאפ',
                  'תכנון פיננסי מותאם',
                  'ייעוץ למיחזור הלוואות',
                  'תמיכה מועדפת',
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-phi-gold flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full bg-white text-phi-dark py-3 rounded-lg text-center font-medium hover:bg-phi-frost transition-all"
              >
                התחל בחינם
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-phi-dark text-white">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-6xl font-serif text-phi-gold mb-6 inline-block">{PHI}</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              מוכן למצוא את ה-{PHI} שלך?
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
              הצטרף עכשיו וקבל 7 ימי ניסיון חינם
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-white text-phi-dark px-8 py-4 rounded-lg text-lg font-medium hover:bg-phi-frost transition-all"
            >
              <span>התחל עכשיו</span>
              <ChevronLeft className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer - Minimal */}
      <footer className="bg-phi-dark text-white/70 py-8 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-serif text-phi-gold">{PHI}</span>
              <span className="text-white">Phi</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/legal/terms" className="hover:text-white transition">תנאי שימוש</Link>
              <Link href="/legal/privacy" className="hover:text-white transition">פרטיות</Link>
              <Link href="/login" className="hover:text-white transition">התחברות</Link>
            </div>
            <p className="text-sm">© 2025 Phi ({PHI})</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
