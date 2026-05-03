'use client'

// ============================================================================
// φ Landing Page — premium financial vibe (Stripe/Linear inspired)
// ----------------------------------------------------------------------------
// Honest beta-stage messaging: "free during beta", no fictional 7-day trial.
// Sections: Header → Hero → Trust strip → How it works → Live demo card →
// Beta value props → FAQ → Final CTA → Footer.
// ============================================================================

import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useState, useRef } from 'react'
import {
  Menu,
  X,
  Shield,
  CheckCircle2,
  Brain,
  Users,
  ChevronLeft,
  MessageCircle,
  Sparkles,
  Lock,
  ArrowRight,
  Banknote,
  Target,
  TrendingUp,
  Plus,
  Minus,
  HelpCircle,
} from 'lucide-react'

const PHI = 'ϕ'

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.4])

  return (
    <main className="min-h-screen bg-white text-phi-dark" dir="rtl">
      {/* ========================== Header ========================== */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-phi-frost/40 bg-white/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl font-serif text-phi-gold leading-none">{PHI}</span>
            <span className="text-lg font-bold text-phi-dark">Phi</span>
            <span className="hidden sm:inline-flex items-center text-[10px] font-medium uppercase tracking-wider text-phi-coral border border-phi-coral/30 bg-phi-coral/5 rounded-full px-2 py-0.5">
              Beta
            </span>
          </Link>

          <nav className="hidden md:flex gap-8 items-center text-sm">
            <Link href="#how-it-works" className="text-phi-slate hover:text-phi-dark transition-colors">
              איך זה עובד
            </Link>
            <Link href="#whats-included" className="text-phi-slate hover:text-phi-dark transition-colors">
              מה מקבלים
            </Link>
            <Link href="#faq" className="text-phi-slate hover:text-phi-dark transition-colors">
              שאלות נפוצות
            </Link>
            <Link
              href="/login"
              className="text-phi-dark font-medium hover:text-phi-coral transition-colors"
            >
              התחבר
            </Link>
            <Link
              href="/signup"
              className="group inline-flex items-center gap-1 bg-phi-dark text-white px-5 py-2.5 rounded-full font-medium hover:bg-[#053448] transition-all shadow-sm hover:shadow"
            >
              הצטרף לבטא
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </Link>
          </nav>

          <button
            className="md:hidden text-phi-dark p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="תפריט"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <motion.nav
            className="md:hidden border-t border-phi-frost px-4 py-3 flex flex-col gap-2 bg-white"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <Link href="#how-it-works" className="py-2 text-phi-slate" onClick={() => setMobileMenuOpen(false)}>
              איך זה עובד
            </Link>
            <Link href="#whats-included" className="py-2 text-phi-slate" onClick={() => setMobileMenuOpen(false)}>
              מה מקבלים
            </Link>
            <Link href="#faq" className="py-2 text-phi-slate" onClick={() => setMobileMenuOpen(false)}>
              שאלות נפוצות
            </Link>
            <Link href="/login" className="py-2 font-medium" onClick={() => setMobileMenuOpen(false)}>
              התחבר
            </Link>
            <Link
              href="/signup"
              className="bg-phi-dark text-white px-5 py-3 rounded-full text-center font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              הצטרף לבטא
            </Link>
          </motion.nav>
        )}
      </header>

      {/* ========================== Hero ========================== */}
      <section ref={heroRef} className="relative pt-36 pb-24 md:pt-44 md:pb-32 overflow-hidden">
        {/* Background gradients */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-b from-white via-white to-phi-bg/40"
        />
        <div
          aria-hidden
          className="absolute top-20 -right-32 w-[28rem] h-[28rem] rounded-full bg-phi-gold/20 blur-[100px] -z-10"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-phi-mint/20 blur-[100px] -z-10"
        />

        <div className="container mx-auto px-4">
          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="max-w-4xl mx-auto text-center"
          >
            {/* Beta badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full bg-phi-dark text-white text-xs font-medium tracking-wide"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-phi-gold animate-pulse" />
              Beta פתוחה — חינם לחלוטין, ללא כרטיס אשראי
            </motion.div>

            {/* Phi symbol */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, type: 'spring' }}
              className="mb-6"
            >
              <span className="text-[100px] md:text-[140px] font-serif text-phi-gold leading-none inline-block animate-phi-glow drop-shadow-[0_8px_30px_rgba(242,193,102,0.35)]">
                {PHI}
              </span>
            </motion.div>

            <motion.h1
              className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              הבריאות הפיננסית
              <br />
              <span className="bg-gradient-to-l from-phi-coral via-phi-gold to-phi-coral bg-clip-text text-transparent">
                שלך, באיזון.
              </span>
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-phi-slate mb-3 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              מאמן פיננסי דיגיטלי בוואטסאפ. שולחים דוחות ← מקבלים תקציב חכם, יעדים אמיתיים, וציון פיננסי שמתעדכן בזמן אמת.
            </motion.p>

            <motion.p
              className="text-sm text-phi-slate/80 mb-10 max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              בנוי בעברית, מותאם לעולם הפיננסי הישראלי, מלווה אישית על ידי גדי.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-3 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Link
                href="/signup"
                className="group bg-phi-dark text-white px-7 py-4 rounded-full text-base font-medium hover:bg-[#053448] transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-phi-dark/20 hover:shadow-xl hover:shadow-phi-dark/30 hover:-translate-y-0.5"
              >
                <span>הצטרף לבטא — חינם</span>
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </Link>
              <a
                href="#how-it-works"
                className="px-7 py-4 rounded-full text-base font-medium text-phi-dark border border-phi-frost hover:border-phi-dark/30 hover:bg-phi-bg/50 transition-all inline-flex items-center justify-center gap-2"
              >
                <span>צפה בהדגמה</span>
              </a>
            </motion.div>

            {/* Trust strip */}
            <motion.div
              className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-12 text-sm text-phi-slate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-phi-mint" />
                <span>מוצפן בקצה</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-phi-mint" />
                <span>הנתונים שלך, שלך</span>
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
          </motion.div>
        </div>
      </section>

      {/* ========================== What is φ — explainer ========================== */}
      <section className="py-20 border-t border-phi-frost/40 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            {[
              {
                icon: MessageCircle,
                title: 'אין אפליקציה להוריד',
                desc: 'הכל בוואטסאפ שאתה כבר משתמש בו. שלח PDF של דוח בנק — והעבודה מתחילה.',
              },
              {
                icon: Brain,
                title: 'AI שמבין עברית פיננסית',
                desc: 'מזהה הוצאות קבועות, מנויים שכחת מהם, ומגמות שלא רואים בעין.',
              },
              {
                icon: Users,
                title: 'גדי, מאמן אנושי',
                desc: 'בני אדם זה לא תוכנה. בכל שלב יש מאמן פיננסי שתוכל לדבר איתו.',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.08 }}
                className="group relative p-6 rounded-2xl border border-phi-frost hover:border-phi-gold/60 hover:shadow-lg hover:shadow-phi-gold/10 transition-all bg-white"
              >
                <div className="w-11 h-11 rounded-xl bg-phi-dark/5 flex items-center justify-center mb-4 group-hover:bg-phi-gold/15 transition-colors">
                  <item.icon className="w-5 h-5 text-phi-dark group-hover:text-phi-coral transition-colors" />
                </div>
                <h3 className="text-base font-bold mb-1.5">{item.title}</h3>
                <p className="text-sm text-phi-slate leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================== How it works ========================== */}
      <section id="how-it-works" className="py-24 bg-phi-bg/40">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16 max-w-2xl mx-auto"
          >
            <span className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-phi-coral mb-3">
              תהליך מלא
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              מהיום הראשון, לא מ-6 חודשים
            </h2>
            <p className="text-lg text-phi-slate">
              ארבעה צעדים פשוטים — כל אחד מהם לוקח דקות, לא ימים.
            </p>
          </motion.div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-4 gap-4 md:gap-6">
              {[
                {
                  num: '01',
                  title: 'מתחברים',
                  desc: 'הרשמה במייל או Google. מזין מספר טלפון לחיבור הוואטסאפ.',
                  icon: Sparkles,
                },
                {
                  num: '02',
                  title: 'שולחים דוח',
                  desc: 'PDF של דוח עו"ש מ-3 חודשים אחרונים, ישירות לבוט.',
                  icon: Banknote,
                },
                {
                  num: '03',
                  title: 'φ מנתח',
                  desc: 'בדקות — קטגוריות, מנויים שכוחים, דפוסים שלא הבחנת בהם.',
                  icon: Brain,
                },
                {
                  num: '04',
                  title: 'בונים תוכנית',
                  desc: 'תקציב מותאם אישית, יעד אמיתי, וציון φ שמתעדכן.',
                  icon: Target,
                },
              ].map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative bg-white rounded-2xl p-6 border border-phi-frost h-full hover:border-phi-gold transition-all"
                >
                  <div className="text-xs font-mono font-bold text-phi-coral mb-3 tracking-wider">
                    {step.num}
                  </div>
                  <step.icon className="w-7 h-7 text-phi-dark mb-3" />
                  <h3 className="font-bold mb-2 text-base">{step.title}</h3>
                  <p className="text-sm text-phi-slate leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================== Live demo card / Phi score ========================== */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-phi-coral mb-3">
                ציון φ
              </span>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                מספר אחד.
                <br />
                <span className="text-phi-slate">ולדעת איפה אתה עומד.</span>
              </h2>
              <p className="text-lg text-phi-slate mb-8 leading-relaxed">
                ציון 0–100 שמשקף את הבריאות הפיננסית שלך. מבוסס על 12 פרמטרים שנבדקים אוטומטית מתוך התנועות שלך — ולא ממילוי טפסים.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'יחס הכנסות מול הוצאות',
                  'אחוז חיסכון חודשי',
                  'מצב קרן חירום',
                  'עמידה ביעדים שהגדרת',
                  'גודל ועלות החוב הקיים',
                  'יציבות תזרים לאורך זמן',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-phi-dark">
                    <CheckCircle2 className="w-5 h-5 text-phi-mint flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 text-phi-dark font-medium hover:text-phi-coral transition-colors"
              >
                גלה את הציון שלך
                <ArrowRight className="w-4 h-4 rotate-180" />
              </Link>
            </motion.div>

            {/* Score visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative aspect-square max-w-md mx-auto">
                {/* Outer ring */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-phi-gold via-phi-coral to-phi-gold blur-xl opacity-30" />
                <div className="relative w-full h-full rounded-full bg-gradient-to-br from-phi-gold/95 via-phi-coral to-phi-gold/95 p-1 shadow-2xl shadow-phi-gold/30">
                  <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center">
                    <span className="text-7xl md:text-8xl font-bold text-phi-dark leading-none">72</span>
                    <span className="text-sm text-phi-slate mt-2 font-medium">ציון {PHI}</span>
                    <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-phi-mint/10 text-phi-mint text-xs font-medium">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>+8 בחודש האחרון</span>
                    </div>
                  </div>
                </div>
                {/* Floating cards */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg border border-phi-frost p-3 text-right"
                >
                  <div className="text-xs text-phi-slate">חיסכון</div>
                  <div className="text-sm font-bold text-phi-mint">+₪1,240</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.45 }}
                  className="absolute -bottom-2 -left-4 bg-white rounded-xl shadow-lg border border-phi-frost p-3 text-right"
                >
                  <div className="text-xs text-phi-slate">קרן חירום</div>
                  <div className="text-sm font-bold text-phi-dark">3.2 חודשים</div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========================== What's included (Beta) ========================== */}
      <section id="whats-included" className="py-24 bg-phi-dark text-white">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16 max-w-2xl mx-auto"
          >
            <span className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-phi-gold mb-3">
              גישה Beta
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              חינם בזמן הבטא.
              <br />
              <span className="text-phi-gold">בלי כוכביות.</span>
            </h2>
            <p className="text-lg text-white/70">
              אנחנו בונים את זה יחד עם המשתמשים הראשונים. תקבל גישה לכל הפיצ׳רים, ובתמורה נשמח לקבל ממך פידבק.
            </p>
          </motion.div>

          <div className="max-w-3xl mx-auto bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 md:p-10">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-5xl font-bold text-phi-gold">חינם</span>
              <span className="text-white/50 line-through text-lg">₪49/חודש</span>
            </div>
            <p className="text-sm text-white/60 mb-8">
              ללא כרטיס אשראי, ללא תקופת ניסיון מוסתרת, ללא חיוב אוטומטי. כשהבטא תסתיים — נעדכן אותך מראש לפני כל מעבר לתשלום, ותוכל להחליט בשקט.
            </p>

            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mb-10">
              {[
                'בוט WhatsApp 24/7',
                'AI Assistant לעברית פיננסית',
                'תקציב אוטומטי + עריכה ידנית',
                'יעדי חיסכון, חוב ורכישה',
                'התראות חכמות',
                `ציון ${PHI} בזמן אמת`,
                'זיהוי מנויים וחיובים קבועים',
                'ייצוא דוחות חודשיים',
                'ליווי אישי מצוות φ',
                'גיבוי וייצוא הנתונים שלך',
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-phi-gold flex-shrink-0" />
                  <span className="text-white/90">{f}</span>
                </div>
              ))}
            </div>

            <Link
              href="/signup"
              className="block w-full bg-phi-gold text-phi-dark py-4 rounded-full text-center font-bold hover:bg-white transition-all"
            >
              הצטרף לבטא עכשיו
            </Link>
            <p className="text-center text-xs text-white/50 mt-4">
              ההרשמה לוקחת פחות מדקה. ניתן למחוק את החשבון בכל עת.
            </p>
          </div>
        </div>
      </section>

      {/* ========================== FAQ ========================== */}
      <section id="faq" className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 max-w-2xl mx-auto"
          >
            <span className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-phi-coral mb-3">
              שאלות נפוצות
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">דיברנו עם משתמשים אמיתיים</h2>
          </motion.div>

          <div className="max-w-3xl mx-auto space-y-3">
            {[
              {
                q: 'מה זה Beta? זה אומר שהכל חינם לתמיד?',
                a: 'לא. אנחנו בשלב Beta פעיל — המשמעות היא שהמערכת זמינה חינם לחלוטין כרגע, בזמן שאנחנו משכללים אותה עם המשתמשים הראשונים. כשנעבור למודל בתשלום, נעדכן אותך מראש (אין חיוב אוטומטי, אין כרטיס אשראי במערכת).',
              },
              {
                q: 'הנתונים שלי מאובטחים?',
                a: 'כן. דוחות מוצפנים בקצה, נשמרים בתשתית מאובטחת, ולא נמכרים לאף אחד. תמיד תוכל לייצא או למחוק את כל הנתונים שלך בלחיצה.',
              },
              {
                q: 'אני לא חזק עם וואטסאפ. זה מסובך?',
                a: 'לא. אם אתה יודע לשלוח הודעה ב-WhatsApp — אתה יודע להשתמש ב-φ. כל פעולה אפשרית גם בדשבורד באתר.',
              },
              {
                q: 'מה קורה אם אני נתקע?',
                a: 'יש סיור מודרך מובנה בכל מסך, ובכל זמן אתה יכול לכתוב לגדי ולקבל ליווי אנושי.',
              },
              {
                q: 'אני יכול למחוק את החשבון?',
                a: 'בכל רגע. בקליק אחד מההגדרות. כל המידע נמחק תוך 24 שעות.',
              },
            ].map((item, i) => (
              <FAQItem key={i} q={item.q} a={item.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ========================== Final CTA ========================== */}
      <section className="py-24 bg-gradient-to-br from-phi-dark via-[#0a5876] to-phi-dark text-white relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-20 -left-20 w-96 h-96 bg-phi-gold/20 rounded-full blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-20 -right-20 w-96 h-96 bg-phi-coral/15 rounded-full blur-3xl"
        />
        <div className="container mx-auto px-4 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-6xl md:text-7xl font-serif text-phi-gold mb-6 inline-block animate-phi-glow drop-shadow-[0_8px_30px_rgba(242,193,102,0.4)]">
              {PHI}
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
              מוכן למצוא את ה-{PHI} שלך?
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
              הצטרף לבטא — שלוש דקות הרשמה, ללא כרטיס אשראי. נחזיר אותך לכאן רק כדי לראות את ההתקדמות.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-phi-gold text-phi-dark px-8 py-4 rounded-full text-base font-bold hover:bg-white transition-all shadow-2xl shadow-phi-gold/30 hover:-translate-y-0.5"
            >
              <span>הצטרף עכשיו — חינם</span>
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <p className="text-xs text-white/50 mt-5">
              כבר יש חשבון?{' '}
              <Link href="/login" className="underline underline-offset-2 hover:text-white">
                התחבר כאן
              </Link>
            </p>
          </motion.div>
        </div>
      </section>

      {/* ========================== Footer ========================== */}
      <footer className="bg-phi-dark text-white/70 py-10 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-serif text-phi-gold">{PHI}</span>
              <span className="text-white font-bold">Phi</span>
              <span className="text-[10px] uppercase tracking-wider text-phi-coral border border-phi-coral/30 rounded-full px-1.5 py-0.5">
                Beta
              </span>
            </div>
            <nav className="flex gap-6 text-sm">
              <Link href="/legal/terms" className="hover:text-white transition">
                תנאי שימוש
              </Link>
              <Link href="/legal/privacy" className="hover:text-white transition">
                פרטיות
              </Link>
              <Link href="/login" className="hover:text-white transition">
                התחברות
              </Link>
              <a
                href="mailto:hello@phi-coach.app"
                className="hover:text-white transition flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                עזרה
              </a>
            </nav>
            <p className="text-sm">
              © 2026 Phi ({PHI})
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}

// ============================================================================
// FAQ accordion item — small co-located component
// ============================================================================
function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(index === 0)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className="border border-phi-frost rounded-2xl overflow-hidden bg-white"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-right hover:bg-phi-bg/40 transition"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-phi-dark">{q}</span>
        <span
          className={`flex-shrink-0 w-8 h-8 rounded-full bg-phi-bg flex items-center justify-center transition-transform ${
            open ? 'rotate-180 bg-phi-gold/20' : ''
          }`}
        >
          {open ? (
            <Minus className="w-4 h-4 text-phi-coral" />
          ) : (
            <Plus className="w-4 h-4 text-phi-dark" />
          )}
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <div className="px-6 pb-5 text-sm text-phi-slate leading-relaxed">{a}</div>
      </motion.div>
    </motion.div>
  )
}
