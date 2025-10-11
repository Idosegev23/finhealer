'use client'

import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Smartphone, TrendingUp, Target, Users, Brain, Zap, Shield, HeartHandshake, Sparkles, Menu, X } from 'lucide-react'
import { RetroGrid } from '@/components/ui/retro-grid'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-[#F5F6F8]/30 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <motion.div 
              className="text-2xl font-bold text-[#3A7BD5] flex items-center gap-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
            💪 FinHealer
            </motion.div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-6 items-center">
              <Link href="#how-it-works" className="text-[#1E2A3B] hover:text-[#3A7BD5] transition-colors font-medium">
                איך זה עובד
              </Link>
              <Link href="#features" className="text-[#1E2A3B] hover:text-[#3A7BD5] transition-colors font-medium">
                תכונות
              </Link>
              <Link href="#pricing" className="text-[#1E2A3B] hover:text-[#3A7BD5] transition-colors font-medium">
                מחירים
              </Link>
              <Link href="/login" className="bg-gradient-to-r from-[#3A7BD5] to-[#2E5EA5] text-white px-6 py-2 rounded-lg hover:shadow-lg hover:scale-105 transition-all">
                התחבר
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-[#3A7BD5] p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="תפריט"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.nav
                className="md:hidden mt-4 pb-4 flex flex-col gap-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Link 
                  href="#how-it-works" 
                  className="text-[#1E2A3B] hover:text-[#3A7BD5] transition-colors font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
              איך זה עובד
            </Link>
                <Link 
                  href="#features" 
                  className="text-[#1E2A3B] hover:text-[#3A7BD5] transition-colors font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
              תכונות
            </Link>
                <Link 
                  href="#pricing" 
                  className="text-[#1E2A3B] hover:text-[#3A7BD5] transition-colors font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
              מחירים
            </Link>
                <Link 
                  href="/login" 
                  className="bg-gradient-to-r from-[#3A7BD5] to-[#2E5EA5] text-white px-6 py-3 rounded-lg text-center font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
              התחבר
            </Link>
              </motion.nav>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 py-24 text-center overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 h-full w-full">
          <RetroGrid />
        </div>
        
        <motion.div 
          className="relative z-10 max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <motion.div 
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#3A7BD5]/10 to-[#7ED957]/10 border border-[#3A7BD5]/20 text-[#3A7BD5] px-5 py-2.5 rounded-full text-sm font-semibold mb-8 shadow-sm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Sparkles className="w-4 h-4" />
            <span>ליווי פיננסי מתמשך שמרגיש כמו CRM חכם</span>
          </motion.div>
          
          <motion.h1 
            className="text-6xl md:text-7xl font-black text-[#1E2A3B] mb-6 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            המאמן הפיננסי
            <br />
            האישי שלך
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3A7BD5] via-[#2E5EA5] to-[#3A7BD5] animate-gradient">
              24/7 בווטסאפ
            </span>
          </motion.h1>
          
          <motion.p 
            className="text-xl md:text-2xl text-[#555555] mb-10 max-w-3xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            מעקב חכם, תובנות מותאמות אישית, והליווי של גדי - מאמן פיננסי מוסמך.
            <br />
            <strong className="text-[#1E2A3B]">לא עוד Excel.</strong> לא עוד דאגות. רק שליטה מלאה על הכסף שלך.
          </motion.p>
          
          <motion.div 
            className="flex gap-4 justify-center flex-wrap mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Link
              href="/login"
              className="group bg-gradient-to-r from-[#3A7BD5] to-[#2E5EA5] text-white px-10 py-5 rounded-xl text-lg font-bold hover:shadow-2xl hover:scale-105 transition-all inline-flex items-center gap-2 shadow-lg relative overflow-hidden"
            >
              <span className="relative z-10">התחל עכשיו - 7 ימים חינם</span>
              <ArrowLeft className="w-5 h-5 relative z-10 group-hover:translate-x-[-4px] transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#2E5EA5] to-[#1E4A8A] opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <a
              href="#how-it-works"
              className="border-2 border-[#3A7BD5] text-[#3A7BD5] px-10 py-5 rounded-xl text-lg font-bold hover:bg-[#3A7BD5]/5 hover:shadow-lg transition-all"
            >
              איך זה עובד?
            </a>
          </motion.div>

          {/* Trust indicators */}
          <motion.div 
            className="flex items-center justify-center gap-8 flex-wrap text-sm text-[#555555]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {[
              { icon: Shield, text: "מאובטח 100%" },
              { icon: Users, text: "ליווי אנושי של גדי" },
              { icon: CheckCircle2, text: "ללא התחייבות" }
            ].map((item, i) => (
              <motion.div 
                key={i}
                className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100"
                whileHover={{ scale: 1.05, y: -2 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <item.icon className="w-5 h-5 text-[#7ED957]" />
                <span className="font-medium">{item.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Floating Elements */}
        <motion.div
          className="absolute top-20 right-[10%] w-20 h-20 bg-gradient-to-br from-[#7ED957]/20 to-transparent rounded-full blur-xl"
          animate={{ 
            y: [0, -20, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 left-[15%] w-32 h-32 bg-gradient-to-br from-[#3A7BD5]/20 to-transparent rounded-full blur-xl"
          animate={{ 
            y: [0, 20, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ 
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </section>

      {/* How It Works - 5 Phases */}
      <section id="how-it-works" className="bg-gradient-to-b from-white to-[#F5F6F8]/50 py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-5xl font-black text-center mb-6 text-[#1E2A3B]">
            המסע הפיננסי שלך - 5 שלבים
          </h2>
            <p className="text-center text-lg text-[#555555] mb-16 max-w-2xl mx-auto">
            FinHealer מלווה אותך בתהליך מובנה שמתאים לך אישית - מרגע הרישום ועד שליטה מלאה
          </p>
          </motion.div>
          
          <div className="grid md:grid-cols-5 gap-6 max-w-7xl mx-auto">
            {([
              {
                number: "1",
                title: "שיקוף עבר",
                description: "נבנה תמונת מצב 360° - הכנסות, הוצאות, חובות, נכסים",
                icon: "🔍",
                color: "primary" as const
              },
              {
                number: "2",
                title: "זיהוי הרגלים",
                description: "הבוט מזהה דפוסי הוצאה ונותן טיפים מותאמים",
                icon: "🧠",
                color: "success" as const
              },
              {
                number: "3",
                title: "תקציב חכם",
                description: "יצירה אוטומטית של תקציב מבוסס על ההתנהלות שלך",
                icon: "💰",
                color: "warning" as const
              },
              {
                number: "4",
                title: "הגדרת מטרות",
                description: "יעדי חיסכון אישיים + ילדים ומטרות",
                icon: "🎯",
                color: "primary" as const
              },
              {
                number: "5",
                title: "בקרה רציפה",
                description: "מעקב יומי, התראות חכמות, ודוחות מפורטים",
                icon: "📊",
                color: "success" as const
              }
            ] as const).map((phase, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <PhaseCard {...phase} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl font-black text-center mb-6 text-[#1E2A3B]">
          למה FinHealer שונה?
        </h2>
          <p className="text-center text-lg text-[#555555] mb-16 max-w-2xl mx-auto">
          לא עוד אפליקציה &quot;עוד אחת&quot; - זה מאמן אישי שמלווה אותך בכל צעד
        </p>
        </motion.div>
        
        {/* Bento Grid Layout */}
        <div className="grid md:grid-cols-6 gap-6 max-w-7xl mx-auto">
          {/* Large Feature - WhatsApp Bot */}
          <motion.div
            className="md:col-span-3 md:row-span-2 group"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="h-full bg-gradient-to-br from-[#3A7BD5] to-[#2E5EA5] p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <Smartphone className="w-16 h-16 text-white mb-6 relative z-10" />
              <h3 className="text-3xl font-bold mb-4 text-white relative z-10">בוט וואטסאפ דו-כיווני</h3>
              <p className="text-white/90 text-lg leading-relaxed relative z-10">
                שלח טקסט או תמונת קבלה - הבוט מבין עברית, מעבד OCR ומציע קטגוריות חכמות. כמו לדבר עם חבר!
              </p>
              <div className="mt-6 flex gap-2 relative z-10">
                <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm">OCR</span>
                <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm">עברית</span>
                <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm">24/7</span>
              </div>
            </div>
          </motion.div>

          {/* AI Assistant */}
          <motion.div
            className="md:col-span-3 group"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="h-full bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all border-2 border-[#7ED957]/20 relative overflow-hidden">
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#7ED957]/10 rounded-full blur-2xl" />
              <Brain className="w-12 h-12 text-[#7ED957] mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-[#1E2A3B]">AI Assistant בעברית</h3>
              <p className="text-[#555555] leading-relaxed">
                מאמן פיננסי AI שמכיר את המצב שלך, נותן עצות מותאמות ומעודד אותך להצליח.
              </p>
            </div>
          </motion.div>

          {/* Human Support */}
          <motion.div
            className="md:col-span-2 group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="h-full bg-gradient-to-br from-[#F6A623] to-[#F68B23] p-6 rounded-3xl shadow-lg hover:shadow-2xl transition-all relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
              <HeartHandshake className="w-12 h-12 text-white mb-4 relative z-10" />
              <h3 className="text-xl font-bold mb-2 text-white relative z-10">ליווי אנושי של גדי</h3>
              <p className="text-white/90 text-sm relative z-10">
                לא רק בוט - גדי מלווה אותך אישית
              </p>
            </div>
          </motion.div>

          {/* Smart Budget */}
          <motion.div
            className="md:col-span-2 group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="h-full bg-white p-6 rounded-3xl shadow-lg hover:shadow-2xl transition-all border-2 border-[#3A7BD5]/20">
              <TrendingUp className="w-12 h-12 text-[#3A7BD5] mb-4" />
              <h3 className="text-xl font-bold mb-2 text-[#1E2A3B]">תקציב אוטומטי</h3>
              <p className="text-[#555555] text-sm">
                המערכת לומדת ובונה תקציב מותאם אישית
              </p>
            </div>
          </motion.div>

          {/* Goals */}
          <motion.div
            className="md:col-span-2 group"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="h-full bg-gradient-to-br from-[#7ED957]/20 to-[#7ED957]/5 p-6 rounded-3xl shadow-lg hover:shadow-2xl transition-all border-2 border-[#7ED957]/30">
              <Target className="w-12 h-12 text-[#7ED957] mb-4" />
              <h3 className="text-xl font-bold mb-2 text-[#1E2A3B]">יעדים ומטרות</h3>
              <p className="text-[#555555] text-sm">
                הגדר יעדי חיסכון אישיים ומשפחתיים
              </p>
            </div>
          </motion.div>

          {/* Real-time Alerts */}
          <motion.div
            className="md:col-span-2 md:row-span-1 group"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="h-full bg-white p-6 rounded-3xl shadow-lg hover:shadow-2xl transition-all border-2 border-[#F6A623]/20 relative overflow-hidden">
              <div className="absolute -bottom-5 -right-5 w-24 h-24 bg-[#F6A623]/10 rounded-full blur-xl" />
              <Zap className="w-12 h-12 text-[#F6A623] mb-4 relative z-10" />
              <h3 className="text-xl font-bold mb-2 text-[#1E2A3B] relative z-10">התראות בזמן אמת</h3>
              <p className="text-[#555555] text-sm relative z-10">
                הודעות חכמות בווטסאפ - חם וידידותי
              </p>
            </div>
          </motion.div>
        </div>

        {/* Additional Benefits */}
        <div className="mt-16 bg-gradient-to-br from-[#3A7BD5]/10 to-[#2E5EA5]/5 rounded-2xl p-8 md:p-12">
          <h3 className="text-2xl font-bold text-center mb-8 text-[#1E2A3B]">
            ועוד...
          </h3>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <BenefitItem text="OCR חכם לקבלות (Tesseract.js)" />
            <BenefitItem text="דוחות חודשיים ושנתיים אוטומטיים" />
            <BenefitItem text="מעקב תזרים ויתרות בזמן אמת" />
            <BenefitItem text="סיכומים יומיים בשעה שבוחרים" />
            <BenefitItem text="זיהוי דפוסי הוצאה והרגלים" />
            <BenefitItem text="חישוב ציון בריאות פיננסית (0-100)" />
            <BenefitItem text="מנוע המלצות מבוסס מגמות" />
            <BenefitItem text="אינטגרציה עם חשבונית ירוקה" />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-gradient-to-b from-white to-[#F5F6F8]/50 py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-5xl font-black text-center mb-6 text-[#1E2A3B]">
            בחר את התוכנית המתאימה לך
          </h2>
            <p className="text-center text-lg text-[#555555] mb-16">
            שתי תוכניות פשוטות - כל אחת עם ערך אמיתי
          </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Basic Plan */}
            <motion.div 
              className="bg-white rounded-3xl shadow-xl p-8 border-2 border-[#3A7BD5]/20 hover:border-[#3A7BD5] hover:shadow-2xl transition-all relative"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              whileHover={{ scale: 1.02, y: -5 }}
            >
              <div className="absolute -top-4 right-8 bg-[#7ED957] text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                הכי פופולרי
              </div>
              
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2 text-[#1E2A3B]">Basic</h3>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-[#3A7BD5]">₪49</span>
                  <span className="text-[#555555]">לחודש</span>
                </div>
                <p className="text-sm text-[#555555] mt-2">מושלם למתחילים</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <PricingFeature text="מעקב הוצאות והכנסות בלתי מוגבל" />
                <PricingFeature text="בוט וואטסאפ חכם 24/7" />
                <PricingFeature text="AI Assistant אישי (GPT-4)" />
                <PricingFeature text="OCR לקבלות (זיהוי אוטומטי)" />
                <PricingFeature text="תקציב אוטומטי + רמזור חכם" />
                <PricingFeature text="יעדי חיסכון + מעקב התקדמות" />
                <PricingFeature text="דוחות וגרפים מתקדמים" />
                <PricingFeature text="התראות חכמות בזמן אמת" />
                <PricingFeature text="ציון בריאות פיננסית" />
              </ul>
              
              <Link
                href="/login"
                className="block w-full bg-gradient-to-r from-[#3A7BD5] to-[#2E5EA5] text-white py-4 rounded-xl text-center font-bold hover:shadow-xl hover:scale-105 transition-all"
              >
                התחל עכשיו - 7 ימים חינם
              </Link>
              
              <p className="text-sm text-[#555555] text-center mt-4">
                ללא התחייבות • ביטול בכל עת
              </p>
            </motion.div>

            {/* Advanced Plan */}
            <motion.div 
              className="bg-gradient-to-br from-[#1E2A3B] to-[#2E5EA5] rounded-3xl shadow-xl p-8 border-2 border-[#3A7BD5] relative text-white hover:shadow-2xl transition-all"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ scale: 1.02, y: -5 }}
            >
              <div className="absolute -top-4 right-8 bg-[#F6A623] text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                ליווי VIP
              </div>
              
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">Advanced</h3>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold">₪119</span>
                  <span className="opacity-90">לחודש</span>
                </div>
                <p className="text-sm opacity-90 mt-2">ליווי אישי מלא</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <PricingFeature text="כל התכונות של Basic" light />
                <PricingFeature text="⭐ 2 פגישות אישיות עם גדי בחודש" light highlight />
                <PricingFeature text="⭐ הערות אישיות שבועיות מגדי" light highlight />
                <PricingFeature text="⭐ ליווי צמוד בווטסאפ" light highlight />
                <PricingFeature text="⭐ תכנון פיננסי מותאם אישית" light highlight />
                <PricingFeature text="⭐ ייעוץ למיחזור הלוואות" light highlight />
                <PricingFeature text="⭐ אסטרטגיות חיסכון מתקדמות" light highlight />
                <PricingFeature text="תמיכה מועדפת בצ'אט" light />
              </ul>
              
              <Link
                href="/login"
                className="block w-full bg-white text-[#1E2A3B] py-4 rounded-xl text-center font-bold hover:bg-gray-100 hover:shadow-xl transition-all"
              >
                התחל עכשיו - 7 ימים חינם
              </Link>
              
              <p className="text-sm text-center mt-4 opacity-90">
                ללא התחייבות • ביטול בכל עת
              </p>
            </motion.div>
          </div>

          {/* Money Back Guarantee */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 bg-[#7ED957]/10 text-[#7ED957] px-6 py-3 rounded-full font-medium">
              <Shield className="w-5 h-5" />
              <span>אחריות החזר כספי מלא עד 14 יום</span>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonials */}
      <section className="container mx-auto px-4 py-24">
        <motion.h2 
          className="text-5xl font-black text-center mb-16 text-[#1E2A3B]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          מה אומרים המשתמשים?
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              quote: "תוך חודש הצלחתי לחסוך 800 ₪ שלא ידעתי שיש לי. הבוט פשוט עזר לי לראות איפה הכסף נעלם.",
              name: "רועי, 32",
              role: "עצמאי"
            },
            {
              quote: "השיחה עם גדי שינתה לי את כל התפיסה על כסף. זה לא רק אפליקציה - זה באמת מאמן.",
              name: "מיכל, 28",
              role: "אם לשניים"
            },
            {
              quote: "הצלחתי להקטין את החוב בכרטיס אשראי ב-40% תוך 3 חודשים. התוכנית שבנה לי גדי פשוט עובדת.",
              name: "אורי, 45",
              role: "שכיר"
            }
          ].map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <TestimonialCard {...testimonial} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative bg-gradient-to-br from-[#3A7BD5] via-[#2E5EA5] to-[#1E4A8A] py-24 text-white overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.h2 
            className="text-5xl md:text-6xl font-black mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            מוכן לקחת שליטה על הכסף שלך?
          </motion.h2>
          <motion.p 
            className="text-xl md:text-2xl mb-10 opacity-90 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            הצטרף עכשיו ל-FinHealer וקבל 7 ימי ניסיון חינם.
            <br />
            ללא כרטיס אשראי, ללא התחייבות.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
          <Link
            href="/login"
              className="group bg-white text-[#3A7BD5] px-10 py-5 rounded-xl text-xl font-black hover:shadow-2xl hover:scale-105 transition-all inline-flex items-center gap-2 shadow-xl relative overflow-hidden"
            >
              <span className="relative z-10">התחל עכשיו בחינם</span>
              <ArrowLeft className="w-6 h-6 relative z-10 group-hover:translate-x-[-4px] transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-gray-50 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </motion.div>
          <motion.p 
            className="mt-8 text-lg opacity-80"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.8 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
          >
            🎁 המשתמשים הראשונים מקבלים חודש ראשון ב-50% הנחה
          </motion.p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1E2A3B] text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                💪 FinHealer
              </h3>
              <p className="text-gray-400">
                המאמן הפיננסי האישי שלך 24/7
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">מוצר</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#how-it-works" className="hover:text-white transition">איך זה עובד</Link></li>
                <li><Link href="#features" className="hover:text-white transition">תכונות</Link></li>
                <li><Link href="#pricing" className="hover:text-white transition">מחירים</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">חשבון</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/login" className="hover:text-white transition">התחברות</Link></li>
                <li><Link href="/login" className="hover:text-white transition">הרשמה</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition">דשבורד</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">משפטי</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/legal/terms" className="hover:text-white transition">תנאי שימוש</Link></li>
                <li><Link href="/legal/privacy" className="hover:text-white transition">מדיניות פרטיות</Link></li>
                <li><Link href="/contact" className="hover:text-white transition">צור קשר</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>© 2025 FinHealer. כל הזכויות שמורות. | עם ❤️ מגדי</p>
          </div>
        </div>
      </footer>
    </main>
  )
}

function PhaseCard({ number, title, description, icon, color }: { 
  number: string
  title: string
  description: string
  icon: string
  color: 'primary' | 'success' | 'warning'
}) {
  const colorClasses = {
    primary: 'from-[#3A7BD5]/20 to-[#2E5EA5]/10 border-[#3A7BD5]/30 hover:border-[#3A7BD5]',
    success: 'from-[#7ED957]/20 to-[#7ED957]/10 border-[#7ED957]/30 hover:border-[#7ED957]',
    warning: 'from-[#F6A623]/20 to-[#F6A623]/10 border-[#F6A623]/30 hover:border-[#F6A623]',
  }

  const numberColors = {
    primary: 'bg-[#3A7BD5] text-white',
    success: 'bg-[#7ED957] text-white',
    warning: 'bg-[#F6A623] text-white',
  }

  return (
    <div className={`relative bg-gradient-to-br ${colorClasses[color]} border-2 rounded-2xl p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300 group`}>
      <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">{icon}</div>
      <div className={`absolute top-4 left-4 w-10 h-10 rounded-full ${numberColors[color]} shadow-lg flex items-center justify-center font-bold text-lg`}>
        {number}
      </div>
      <h3 className="text-lg font-bold mb-2 text-[#1E2A3B]">{title}</h3>
      <p className="text-sm text-[#555555] leading-relaxed">{description}</p>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { 
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-xl transition border border-gray-100">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2 text-[#1E2A3B]">{title}</h3>
      <p className="text-[#555555]">{description}</p>
    </div>
  )
}

function BenefitItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle2 className="w-6 h-6 text-[#7ED957] flex-shrink-0" />
      <span className="text-[#1E2A3B]">{text}</span>
    </div>
  )
}

function PricingFeature({ text, light = false, highlight = false }: { 
  text: string
  light?: boolean
  highlight?: boolean
}) {
  return (
    <li className="flex items-center gap-3">
      <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${light ? 'text-white' : 'text-[#7ED957]'}`} />
      <span className={`${light ? 'text-white' : 'text-[#1E2A3B]'} ${highlight ? 'font-semibold' : ''}`}>
        {text}
      </span>
    </li>
  )
}

function TestimonialCard({ quote, name, role }: {
  quote: string
  name: string
  role: string
}) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all border-2 border-gray-100 hover:border-[#3A7BD5]/30 group h-full flex flex-col">
      <div className="text-[#3A7BD5] text-5xl mb-4 group-hover:scale-110 transition-transform">&quot;</div>
      <p className="text-[#555555] mb-6 italic leading-relaxed flex-grow">{quote}</p>
      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3A7BD5] to-[#2E5EA5] flex items-center justify-center text-white font-bold text-lg shadow-md">
          {name[0]}
        </div>
        <div>
          <p className="font-bold text-[#1E2A3B]">{name}</p>
          <p className="text-sm text-[#555555]">{role}</p>
        </div>
      </div>
    </div>
  )
}
