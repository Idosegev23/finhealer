'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { 
  Menu, X, Shield, CheckCircle2, Smartphone, Target, 
  TrendingUp, Zap, MessageCircle, Brain, Users, BarChart3,
  Eye, Activity, Sparkles, ArrowLeft, ChevronLeft
} from 'lucide-react'
import PhiLogo from '@/components/ui/PhiLogo'
import PhiAnimation from '@/components/landing/PhiAnimation'
import PhiScore from '@/components/landing/PhiScore'

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-phi-frost/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <PhiLogo size="sm" />
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-8 items-center">
              <Link href="#how-it-works" className="text-phi-slate hover:text-phi-dark transition-colors font-medium">
                איך זה עובד
              </Link>
              <Link href="#features" className="text-phi-slate hover:text-phi-dark transition-colors font-medium">
                תכונות
              </Link>
              <Link href="#pricing" className="text-phi-slate hover:text-phi-dark transition-colors font-medium">
                מחירים
              </Link>
              <Link 
                href="/login" 
                className="text-phi-gold hover:text-phi-coral transition-colors font-bold"
              >
                התחבר
              </Link>
              <Link 
                href="/signup" 
                className="bg-gradient-to-l from-phi-gold to-phi-coral text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
              >
                הרשם
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
              className="md:hidden mt-4 pb-4 flex flex-col gap-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Link href="#how-it-works" className="text-phi-slate py-2 px-3">איך זה עובד</Link>
              <Link href="#features" className="text-phi-slate py-2 px-3">תכונות</Link>
              <Link href="#pricing" className="text-phi-slate py-2 px-3">מחירים</Link>
              <Link href="/login" className="text-phi-gold py-2 px-3 font-bold">התחבר</Link>
              <Link href="/signup" className="bg-gradient-to-l from-phi-gold to-phi-coral text-white px-6 py-3 rounded-xl text-center font-bold">
                הרשם
              </Link>
            </motion.nav>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div 
              className="inline-flex items-center gap-2 bg-phi-frost/50 border border-phi-gold/20 text-phi-gold px-4 py-2 rounded-full text-sm font-bold mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-4 h-4" />
              <span>היחס הזהב של הבריאות הפיננסית</span>
            </motion.div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-phi-dark mb-6 leading-tight">
              φ
              <br />
              האיזון המושלם
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-phi-gold to-phi-coral">
                לכסף שלך
              </span>
            </h1>
            
            <p className="text-xl text-phi-slate mb-8 leading-relaxed">
              פלטפורמה חכמה לבריאות פיננסית עם ליווי אישי של גדי - מאמן פיננסי מוסמך.
              <br className="hidden md:block" />
              <strong className="text-phi-dark">מעקב אוטומטי</strong>, תובנות מבוססות AI, ו<strong className="text-phi-dark">בוט WhatsApp חכם</strong>.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link
                href="/login"
                className="group relative bg-gradient-to-l from-phi-gold to-phi-coral text-white px-8 py-4 rounded-xl text-lg font-black shadow-xl hover:shadow-2xl transition-all inline-flex items-center justify-center gap-2 hover:-translate-y-1"
              >
                <span>התחל עכשיו - 7 ימים חינם</span>
                <ChevronLeft className="w-5 h-5 group-hover:translate-x-[-4px] transition-transform" />
              </Link>
              <a
                href="#how-it-works"
                className="border-2 border-phi-dark text-phi-dark px-8 py-4 rounded-xl text-lg font-bold hover:bg-phi-dark hover:text-white transition-all text-center"
              >
                גלה את ה-φ שלך
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center gap-6 flex-wrap text-sm">
              {[
                { icon: Shield, text: "מאובטח 100%" },
                { icon: Users, text: "ליווי אנושי" },
                { icon: CheckCircle2, text: "ללא התחייבות" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-phi-slate">
                  <item.icon className="w-5 h-5 text-phi-mint" />
                  <span className="font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Animation */}
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <PhiAnimation className="w-full max-w-md" />
          </motion.div>
        </div>
      </section>

      {/* What is Phi Section */}
      <section className="bg-gradient-to-b from-phi-bg/50 to-white py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-phi-dark mb-4">
              מה זה φ (Phi)?
            </h2>
            <p className="text-xl text-phi-slate max-w-2xl mx-auto">
              φ (פאי) הוא היחס הזהב - הנוסחה המתמטית לאיזון מושלם
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: '🌀',
                title: 'φ = איזון',
                desc: 'היחס הזהב בין הכנסות להוצאות - כמו בטבע, באמנות, ובכסף שלך',
                color: 'phi-gold'
              },
              {
                icon: '📊',
                title: 'φ = הנוסחה שלך',
                desc: 'ציון בריאות פיננסית 0-100 שמחושב מתוך 12 פרמטרים חכמים',
                color: 'phi-mint'
              },
              {
                icon: '🎯',
                title: 'φ = תכנון חכם',
                desc: 'מעקב אוטומטי, תובנות AI, והשגת יעדים פיננסיים בצורה מדויקת',
                color: 'phi-coral'
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all border border-phi-frost group"
              >
                <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">{item.icon}</div>
                <h3 className="text-2xl font-bold text-phi-dark mb-3">{item.title}</h3>
                <p className="text-phi-slate leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - 5 Phases */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-phi-dark mb-4">
              המסע שלך ל-φ המושלם
            </h2>
            <p className="text-xl text-phi-slate max-w-2xl mx-auto">
              5 שלבים מובנים שמתאימים לך אישית
            </p>
          </motion.div>

          {/* Timeline */}
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-5 gap-6">
              {[
                { num: '1', title: 'שיקוף עבר', desc: 'תמונת מצב 360°', icon: Eye },
                { num: '2', title: 'זיהוי הרגלים', desc: 'למידת דפוסים', icon: Activity },
                { num: '3', title: 'תקציב חכם', desc: 'יצירה אוטומטית', icon: TrendingUp },
                { num: '4', title: 'הגדרת מטרות', desc: 'יעדי חיסכון', icon: Target },
                { num: '5', title: 'בקרה רציפה', desc: 'מעקב יומי', icon: BarChart3 }
              ].map((phase, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative"
                >
                  <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-phi-frost hover:border-phi-gold transition-all group">
                    <div className="absolute -top-4 right-4 w-10 h-10 rounded-full bg-phi-gold text-white flex items-center justify-center font-bold shadow-lg">
                      {phase.num}
                    </div>
                    <phase.icon className="w-12 h-12 text-phi-gold mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-lg font-bold text-phi-dark mb-2">{phase.title}</h3>
                    <p className="text-sm text-phi-slate">{phase.desc}</p>
                  </div>
                  {/* Connector Line */}
                  {i < 4 && (
                    <div className="hidden md:block absolute top-1/2 left-full w-6 h-0.5 bg-phi-frost" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="bg-gradient-to-b from-white to-phi-bg/50 py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-phi-dark mb-4">
              למה Phi שונה?
            </h2>
            <p className="text-xl text-phi-slate max-w-2xl mx-auto">
              לא עוד אפליקציה &quot;עוד אחת&quot; - זה מאמן אישי שמלווה אותך
            </p>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Large - WhatsApp Bot */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="md:col-span-2 md:row-span-2 bg-gradient-to-br from-phi-gold to-phi-coral p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all text-white relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <Smartphone className="w-16 h-16 mb-4 relative z-10" />
              <h3 className="text-3xl font-bold mb-4 relative z-10">בוט WhatsApp חכם</h3>
              <p className="text-lg mb-4 relative z-10 opacity-90">
                שלח הודעה או תמונת קבלה - הבוט מבין עברית, מעבד OCR ומציע קטגוריות אוטומטית
              </p>
              <div className="flex gap-2 relative z-10">
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">OCR</span>
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">24/7</span>
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">עברית</span>
              </div>
            </motion.div>

            {/* AI Assistant */}
            <FeatureCard
              icon={Brain}
              title="AI Assistant"
              desc="מאמן AI שמכיר את המצב שלך ונותן עצות מותאמות"
              color="mint"
            />

            {/* Human Support */}
            <FeatureCard
              icon={Users}
              title="ליווי אישי"
              desc="גדי מלווה אותך בתוכנית VIP"
              color="coral"
            />

            {/* Tracking */}
            <FeatureCard
              icon={TrendingUp}
              title="מעקב אוטומטי"
              desc="תקציב חכם שמתעדכן בזמן אמת"
              color="gold"
            />

            {/* Alerts */}
            <FeatureCard
              icon={Zap}
              title="התראות חכמות"
              desc="הודעות בזמן אמת בשפה חמה"
              color="mint"
            />

            {/* Goals */}
            <FeatureCard
              icon={Target}
              title="יעדים ומטרות"
              desc="חיסכון אישי ומשפחתי"
              color="coral"
            />

            {/* Reports */}
            <FeatureCard
              icon={BarChart3}
              title="דוחות מתקדמים"
              desc="גרפים וסיכומים ויזואליים"
              color="gold"
            />
          </div>
        </div>
      </section>

      {/* Phi Score Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-black text-phi-dark mb-6">
                מה זה ציון φ?
              </h2>
              <p className="text-xl text-phi-slate mb-6 leading-relaxed">
                ציון φ הוא מדד מתמטי (0-100) שמחושב מתוך <strong>12 פרמטרים</strong> של הבריאות הפיננסית שלך:
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'יחס הכנסות להוצאות',
                  'אחוז חיסכון חודשי',
                  'גובה חובות לעומת הכנסה',
                  'קיום קרן חירום',
                  'עמידה ביעדים',
                  'ותובנות נוספות...'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-phi-mint" />
                    <span className="text-phi-dark">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-lg text-phi-slate">
                ככל שה-φ שלך גבוה יותר - הבריאות הפיננסית שלך טובה יותר! 🎯
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex justify-center"
            >
              <PhiScore score={73} size="lg" animated showLabel />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gradient-to-b from-phi-bg/50 to-white py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-phi-dark mb-4">
              בחר את התוכנית שלך
            </h2>
            <p className="text-xl text-phi-slate">
              שתי תוכניות - כל אחת עם ערך אמיתי
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Basic Phi */}
            <PricingCard
              name="Basic φ"
              price="₪49"
              badge="פופולרי"
              badgeColor="phi-mint"
              features={[
                'מעקב בלתי מוגבל',
                'בוט WhatsApp 24/7',
                'AI Assistant (GPT-4)',
                'OCR לקבלות',
                'תקציב אוטומטי',
                'יעדי חיסכון',
                'דוחות וגרפים',
                'התראות חכמות',
                'ציון φ בזמן אמת'
              ]}
            />

            {/* VIP Phi */}
            <PricingCard
              name="φ VIP"
              price="₪119"
              badge="ליווי אישי"
              badgeColor="phi-coral"
              vip
              features={[
                'כל התכונות של Basic',
                '⭐ 2 פגישות חודשיות עם גדי',
                '⭐ הערות אישיות שבועיות',
                '⭐ ליווי צמוד בWhatsApp',
                '⭐ תכנון פיננסי מותאם',
                '⭐ ייעוץ למיחזור הלוואות',
                '⭐ אסטרטגיות חיסכון',
                'תמיכה מועדפת'
              ]}
            />
          </div>

          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-2 bg-phi-mint/10 text-phi-mint px-6 py-3 rounded-full font-medium">
              <Shield className="w-5 h-5" />
              <span>אחריות החזר כספי מלא עד 14 יום</span>
            </div>
          </div>
        </div>
      </section>

      {/* Meet Gadi */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-phi-frost/50 to-white p-8 md:p-12 rounded-3xl shadow-xl border border-phi-frost">
            <div className="grid md:grid-cols-3 gap-8 items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="flex justify-center"
              >
                <div className="w-48 h-48 rounded-full bg-gradient-to-br from-phi-gold to-phi-coral flex items-center justify-center text-white text-6xl font-bold shadow-2xl">
                  ג
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="md:col-span-2"
              >
                <h2 className="text-3xl md:text-4xl font-black text-phi-dark mb-4">
                  פגוש את גדי
                </h2>
                <p className="text-lg text-phi-slate mb-4 leading-relaxed">
                  <strong className="text-phi-dark">מאמן פיננסי מוסמך</strong> עם למעלה מ-10 שנות ניסיון בליווי אישי ועסקי. 
                  גדי יצר את Phi מתוך הבנה שבריאות פיננסית היא לא רק מספרים - זה <strong>איזון</strong>, <strong>תכנון</strong>, ו<strong>ליווי אנושי</strong>.
                </p>
                <p className="text-lg text-phi-slate mb-6">
                  &quot;יצרתי את Phi כי ראיתי שאנשים צריכים מערכת שלא רק עוקבת - אלא גם <strong>מבינה, מלווה ומעודדת</strong>. 
                  φ הוא היחס הזהב - וזה בדיוק מה שמגיע לכם עם הכסף שלכם.&quot; 💪
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-phi-gold text-2xl">φ</span>
                  <span className="text-phi-slate">גדי, מייסד Phi</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="bg-phi-bg/30 py-20">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-black text-center mb-16 text-phi-dark"
          >
            מה אומרים המשתמשים?
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                quote: "תוך חודש הצלחתי לחסוך 800 ₪ שלא ידעתי שיש לי. הבוט פשוט עזר לי לראות איפה הכסף נעלם. ה-φ שלי עלה מ-42 ל-68!",
                name: "רועי, 32",
                role: "עצמאי"
              },
              {
                quote: "השיחה עם גדי שינתה לי את כל התפיסה על כסף. זה לא רק אפליקציה - זה באמת מאמן שמכיר אותך ואכפת לו.",
                name: "מיכל, 28",
                role: "אם לשניים"
              },
              {
                quote: "הצלחתי להקטין את החוב בכרטיס אשראי ב-40% תוך 3 חודשים. התוכנית שבנה לי גדי בתוכנית VIP פשוט עובדת.",
                name: "אורי, 45",
                role: "שכיר"
              }
            ].map((t, i) => (
              <TestimonialCard key={i} {...t} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative bg-gradient-to-br from-phi-dark via-phi-slate to-phi-dark py-24 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-phi-gold rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-phi-coral rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black mb-6"
          >
            מוכן למצוא את ה-φ שלך?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl mb-10 opacity-90 max-w-2xl mx-auto"
          >
            הצטרף עכשיו ל-Phi וקבל 7 ימי ניסיון חינם
            <br />
            ללא כרטיס אשראי, ללא התחייבות
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <Link
              href="/login"
              className="group bg-white text-phi-dark px-10 py-5 rounded-xl text-xl font-black hover:shadow-2xl hover:scale-105 transition-all inline-flex items-center gap-2 shadow-xl"
            >
              <span>התחל עכשיו בחינם</span>
              <ArrowLeft className="w-6 h-6 group-hover:translate-x-[-4px] transition-transform" />
            </Link>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.8 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-lg"
          >
            🎁 המשתמשים הראשונים מקבלים חודש ראשון ב-50% הנחה
          </motion.p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-phi-dark text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <PhiLogo size="sm" className="mb-4" />
              <p className="text-phi-frost">
                האיזון המושלם לכסף שלך
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-phi-gold">מוצר</h4>
              <ul className="space-y-2 text-phi-frost">
                <li><Link href="#how-it-works" className="hover:text-white transition">איך זה עובד</Link></li>
                <li><Link href="#features" className="hover:text-white transition">תכונות</Link></li>
                <li><Link href="#pricing" className="hover:text-white transition">מחירים</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-phi-gold">חשבון</h4>
              <ul className="space-y-2 text-phi-frost">
                <li><Link href="/login" className="hover:text-white transition">התחברות</Link></li>
                <li><Link href="/signup" className="hover:text-white transition">הרשמה</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition">דשבורד</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-phi-gold">משפטי</h4>
              <ul className="space-y-2 text-phi-frost">
                <li><Link href="/legal/terms" className="hover:text-white transition">תנאי שימוש</Link></li>
                <li><Link href="/legal/privacy" className="hover:text-white transition">מדיניות פרטיות</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-phi-slate/30 pt-8 text-center text-phi-frost">
            <p>© 2025 Phi (φ). כל הזכויות שמורות. | עם ❤️ מגדי</p>
          </div>
        </div>
      </footer>
    </main>
  )
}

// Helper Components

function FeatureCard({ icon: Icon, title, desc, color }: {
  icon: any
  title: string
  desc: string
  color: 'gold' | 'mint' | 'coral'
}) {
  const colors = {
    gold: 'from-phi-gold/20 to-phi-gold/5 border-phi-gold/30 hover:border-phi-gold',
    mint: 'from-phi-mint/20 to-phi-mint/5 border-phi-mint/30 hover:border-phi-mint',
    coral: 'from-phi-coral/20 to-phi-coral/5 border-phi-coral/30 hover:border-phi-coral',
  }

  const iconColors = {
    gold: 'text-phi-gold',
    mint: 'text-phi-mint',
    coral: 'text-phi-coral',
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className={`bg-gradient-to-br ${colors[color]} p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border-2 group`}
    >
      <Icon className={`w-12 h-12 ${iconColors[color]} mb-4 group-hover:scale-110 transition-transform`} />
      <h3 className="text-xl font-bold text-phi-dark mb-2">{title}</h3>
      <p className="text-phi-slate text-sm">{desc}</p>
    </motion.div>
  )
}

function PricingCard({ name, price, badge, badgeColor, vip = false, features }: {
  name: string
  price: string
  badge: string
  badgeColor: string
  vip?: boolean
  features: string[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative ${vip ? 'bg-gradient-to-br from-phi-dark to-phi-slate text-white' : 'bg-white'} p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all border-2 ${vip ? 'border-phi-gold' : 'border-phi-frost'}`}
    >
      <div className={`absolute -top-4 right-8 bg-${badgeColor} text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg`}>
        {badge}
      </div>

      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold mb-2">{name}</h3>
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-5xl font-bold">{price}</span>
          <span className={vip ? 'opacity-90' : 'text-phi-slate'}>לחודש</span>
        </div>
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${vip ? 'text-phi-gold' : 'text-phi-mint'} mt-0.5`} />
            <span className={vip ? 'text-white' : 'text-phi-dark'}>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/login"
        className={`block w-full ${vip ? 'bg-white text-phi-dark hover:bg-phi-frost' : 'bg-gradient-to-l from-phi-gold to-phi-coral text-white hover:shadow-xl'} py-4 rounded-xl text-center font-bold transition-all`}
      >
        התחל עכשיו - 7 ימים חינם
      </Link>

      <p className={`text-sm text-center mt-4 ${vip ? 'opacity-90' : 'text-phi-slate'}`}>
        ללא התחייבות • ביטול בכל עת
      </p>
    </motion.div>
  )
}

function TestimonialCard({ quote, name, role, delay }: {
  quote: string
  name: string
  role: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-phi-frost group"
    >
      <div className="text-phi-gold text-5xl mb-4 group-hover:scale-110 transition-transform">&quot;</div>
      <p className="text-phi-slate mb-6 italic leading-relaxed">{quote}</p>
      <div className="flex items-center gap-3 pt-4 border-t border-phi-frost">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-phi-gold to-phi-coral flex items-center justify-center text-white font-bold text-lg shadow-md">
          {name[0]}
        </div>
        <div>
          <p className="font-bold text-phi-dark">{name}</p>
          <p className="text-sm text-phi-slate">{role}</p>
        </div>
      </div>
    </motion.div>
  )
}
