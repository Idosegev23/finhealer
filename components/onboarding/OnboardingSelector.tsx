'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Stepper, { Step } from '@/components/ui/stepper';
import { Smartphone, Zap, Crown, CheckCircle, MessageCircle, ExternalLink, CreditCard, Lock, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

type Plan = 'basic' | 'premium';

export function OnboardingSelector() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showWhatsAppRedirect, setShowWhatsAppRedirect] = useState(false);
  const [sendingWelcome, setSendingWelcome] = useState(false);

  // Step 1: Plan selection
  const [selectedPlan, setSelectedPlan] = useState<Plan>('basic');

  // Step 2: Payment
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Step 3: Phone & WhatsApp
  const [phone, setPhone] = useState('');
  const [waOptIn, setWaOptIn] = useState(true);
  const [formattedPhone, setFormattedPhone] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }
      
      setUserId(user.id);
    };

    checkAuth();
  }, [router]);

  const handlePlanSelection = async () => {
    // Just validate and move to payment
    return true;
  };

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : v;
  };

  // Format expiry date
  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  // Simulate payment processing
  const handlePayment = async () => {
    // Validate card details
    if (cardNumber.replace(/\s/g, '').length < 16) {
      alert('אנא הכנס מספר כרטיס תקין');
      return false;
    }
    if (cardExpiry.length < 5) {
      alert('אנא הכנס תאריך תוקף תקין');
      return false;
    }
    if (cardCvv.length < 3) {
      alert('אנא הכנס CVV תקין');
      return false;
    }
    if (!cardName.trim()) {
      alert('אנא הכנס שם בעל הכרטיס');
      return false;
    }

    setPaymentProcessing(true);

    // Simulate payment processing (demo)
    await new Promise(resolve => setTimeout(resolve, 2000));

    setPaymentProcessing(false);
    setPaymentSuccess(true);

    // Show success animation briefly
    await new Promise(resolve => setTimeout(resolve, 1000));

    return true;
  };

  // WhatsApp-First: סיום ההרשמה ושליחה לWhatsApp
  const handleFinalStep = async () => {
    try {
      setIsLoading(true);

      // Validate phone
      if (!phone) {
        alert('אנא הכנס מספר טלפון');
        setIsLoading(false);
        return;
      }

      // Format phone number
      const cleanedPhone = phone.replace(/\D/g, '');
      let phoneFormatted = cleanedPhone;
      if (cleanedPhone.startsWith('0')) {
        phoneFormatted = '972' + cleanedPhone.substring(1);
      } else if (!cleanedPhone.startsWith('972')) {
        phoneFormatted = '972' + cleanedPhone;
      }
      
      setFormattedPhone(phoneFormatted);

      // 1. Create user and subscription in DB (with all data at once!)
      const response = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          onboardingType: 'quick',
          phone: phoneFormatted,
          waOptIn: waOptIn,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה ביצירת מנוי');
      }

      console.log('✅ User created with phone:', phoneFormatted);
      
      setSendingWelcome(true);

      // 2. Send WhatsApp welcome message
      if (waOptIn && phoneFormatted) {
        try {
          const welcomeMessage = `שלום,

אני *φ* (פי) - המאמן הפיננסי שלך.

אני כאן כדי לעזור לך להשיג *שליטה מלאה* על הכסף שלך.
לא משנה מאיפה אתה מתחיל - ביחד נגיע לאיזון.

מה השם שלך?`;

          const waResponse = await fetch('/api/wa/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: phoneFormatted,
              message: welcomeMessage,
              isOnboarding: true, // 🆕 יוצר context עם state onboarding_personal
            }),
          });

          if (!waResponse.ok) {
            console.error('Failed to send WhatsApp welcome message');
          } else {
            console.log('✅ WhatsApp welcome message sent to:', phoneFormatted);
          }
        } catch (waError) {
          console.error('WhatsApp send error:', waError);
          // Don't block the flow if WhatsApp fails
        }
      }

      // 3. Show WhatsApp redirect screen
      setShowWhatsAppRedirect(true);

    } catch (error) {
      console.error('Onboarding error:', error);
      alert('אירעה שגיאה. נסה שוב.');
    } finally {
      setIsLoading(false);
      setSendingWelcome(false);
    }
  };

  const plans = [
    {
      id: 'basic' as Plan,
      name: 'בסיסי',
      price: 49,
      icon: Zap,
      features: [
        'מעקב הוצאות והכנסות',
        'תקציב חכם',
        'יעדים פיננסיים',
        'דוחות חודשיים',
        'בוט WhatsApp',
      ],
    },
    {
      id: 'premium' as Plan,
      name: 'מתקדם',
      price: 119,
      icon: Crown,
      popular: true,
      features: [
        'כל התכונות מהמנוי הבסיסי',
        'ניתוח AI מתקדם',
        'המלצות מותאמות אישית',
        'סימולטור הלוואות',
        'ייעוץ עם גדי (2 פעמים בחודש)',
        'תמיכה עדיפות',
      ],
    },
  ];

  const selectedPlanDetails = plans.find(p => p.id === selectedPlan);

  const handleStepTransition = async (fromStep: number, toStep: number) => {
    // Step 1 -> 2: Plan selection -> Payment
    if (fromStep === 1 && toStep === 2) {
      return await handlePlanSelection();
    }
    
    // Step 2 -> 3: Payment -> Phone
    if (fromStep === 2 && toStep === 3) {
      return await handlePayment();
    }
    
    return true;
  };

  // WhatsApp Redirect Screen
  if (showWhatsAppRedirect) {
    const botPhoneNumber = '972544266506';
    const waLink = `https://wa.me/${botPhoneNumber}?text=היי`;
    const displayPhone = formattedPhone.startsWith('972') 
      ? `0${formattedPhone.slice(3)}` 
      : formattedPhone;

    return (
      <div className="min-h-screen bg-gradient-to-br from-phi-bg via-white to-phi-mint/10 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full"
        >
          {/* Success Card */}
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mb-6"
            >
              <div className="relative inline-block">
                <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-phi-gold rounded-full flex items-center justify-center border-2 border-white"
                >
                  <span className="text-white font-serif text-lg">φ</span>
                </motion.div>
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-2xl font-bold text-phi-dark mb-2">
                ההרשמה הושלמה בהצלחה! 🎉
              </h1>
              <p className="text-gray-600 mb-6">
                שלחנו לך הודעה ב-WhatsApp למספר
                <span className="font-medium text-phi-dark block mt-1" dir="ltr">
                  {displayPhone}
                </span>
              </p>
            </motion.div>

            {/* WhatsApp Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <MessageCircle className="w-6 h-6" />
                <span>המשך ב-WhatsApp</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </motion.div>

            {/* Info Box */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 text-right"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Smartphone className="w-5 h-5 text-phi-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-phi-dark text-sm mb-1">
                    מה קורה עכשיו?
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    φ (פאי) המאמן הפיננסי שלך מחכה לך ב-WhatsApp!
                    <br />
                    הוא ישאל אותך כמה שאלות קצרות ויעזור לך להתחיל.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Steps Preview */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-6 text-right"
            >
              <h4 className="text-sm font-medium text-gray-500 mb-3">השלבים הבאים:</h4>
              <div className="space-y-2">
                {[
                  'היכרות קצרה (שם, גיל, מצב משפחתי)',
                  'שליחת דוחות בנק/אשראי',
                  'קבלת תמונה פיננסית מלאה',
                ].map((step, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-xs font-medium text-green-700">
                      {index + 1}
                    </div>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Dashboard Link */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-8 pt-6 border-t border-gray-100"
            >
              <p className="text-sm text-gray-500 mb-3">
                רוצה לצפות בנתונים שלך?
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-gray-600 hover:text-phi-dark transition-colors text-sm font-medium"
              >
                <span>צפה בדשבורד</span>
                <span className="text-xs text-gray-400">(צפייה בלבד)</span>
              </Link>
            </motion.div>
          </div>

          {/* Bottom Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-sm text-gray-500 mt-6"
          >
            לא קיבלת הודעה? בדוק את הWhatsApp שלך או{' '}
            <a href={waLink} className="text-green-600 hover:underline">
              לחץ כאן לפתוח שיחה
            </a>
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-success/10 py-8">
      <div className="container mx-auto px-4">
        <Stepper
          initialStep={1}
          onBeforeStepChange={handleStepTransition}
          onFinalStepCompleted={handleFinalStep}
          backButtonText="חזור"
          nextButtonText="המשך"
          finalButtonText={isLoading ? (sendingWelcome ? 'שולח הודעה...' : 'שומר...') : 'סיום והמשך ב-WhatsApp'}
        >
          {/* Step 1: Plan Selection */}
          <Step>
            <div className="py-8" dir="rtl">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  בחר את המנוי שלך 🎯
                </h2>
                <p className="text-gray-600">
                  בחר את התוכנית המתאימה לך ביותר
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {plans.map((plan) => {
                  const Icon = plan.icon;
                  const isSelected = selectedPlan === plan.id;

                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`
                        relative p-6 rounded-2xl border-2 text-right transition-all
                        ${isSelected
                          ? 'border-primary bg-primary/5 shadow-lg'
                          : 'border-gray-200 hover:border-primary/50'
                        }
                      `}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 right-6 bg-success text-white px-3 py-1 rounded-full text-sm font-semibold">
                          הכי פופולרי ⭐
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900 mb-1">
                            {plan.name}
                          </h3>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-primary">₪{plan.price}</span>
                            <span className="text-gray-600">/חודש</span>
                          </div>
                        </div>
                        <Icon className={`w-10 h-10 ${isSelected ? 'text-primary' : 'text-gray-400'}`} />
                      </div>

                      <ul className="space-y-3 mb-4">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-success mt-0.5">✓</span>
                            <span className="text-sm text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {isSelected && (
                        <div className="mt-4 pt-4 border-t border-primary/20">
                          <div className="flex items-center gap-2 text-primary font-semibold">
                            <CheckCircle className="w-5 h-5" />
                            <span>נבחר</span>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Step>

          {/* Step 2: Payment */}
          <Step>
            <div className="py-8" dir="rtl">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                  <CreditCard className="w-10 h-10 text-blue-600" />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  פרטי תשלום 💳
                </h2>
                <p className="text-gray-600">
                  מנוי {selectedPlanDetails?.name} - ₪{selectedPlanDetails?.price}/חודש
                </p>
              </div>

              <div className="max-w-md mx-auto">
                {/* Payment Success Animation */}
                <AnimatePresence>
                  {paymentSuccess && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 flex items-center justify-center bg-white/90 z-10 rounded-2xl"
                    >
                      <div className="text-center">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
                        </motion.div>
                        <p className="text-xl font-bold text-green-600">התשלום אושר! ✓</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Credit Card Form */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 relative">
                  {/* Card Preview */}
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 mb-6 text-white">
                    <div className="flex justify-between items-start mb-8">
                      <div className="text-xs opacity-70">כרטיס אשראי</div>
                      <div className="flex gap-1">
                        <div className="w-6 h-6 bg-red-500 rounded-full opacity-80"></div>
                        <div className="w-6 h-6 bg-yellow-500 rounded-full -ml-3 opacity-80"></div>
                      </div>
                    </div>
                    <div className="font-mono text-lg tracking-wider mb-4" dir="ltr">
                      {cardNumber || '•••• •••• •••• ••••'}
                    </div>
                    <div className="flex justify-between text-sm">
                      <div>
                        <div className="text-xs opacity-70 mb-1">שם בעל הכרטיס</div>
                        <div>{cardName || 'שם מלא'}</div>
                      </div>
                      <div>
                        <div className="text-xs opacity-70 mb-1">תוקף</div>
                        <div dir="ltr">{cardExpiry || 'MM/YY'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        מספר כרטיס
                      </label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="1234 5678 9012 3456"
                        maxLength={19}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                        dir="ltr"
                        disabled={paymentProcessing}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        שם בעל הכרטיס
                      </label>
                      <input
                        type="text"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="ישראל ישראלי"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={paymentProcessing}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          תוקף
                        </label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                          placeholder="MM/YY"
                          maxLength={5}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                          dir="ltr"
                          disabled={paymentProcessing}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CVV
                        </label>
                        <input
                          type="text"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="123"
                          maxLength={4}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                          dir="ltr"
                          disabled={paymentProcessing}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
                    <Lock className="w-4 h-4" />
                    <span>התשלום מאובטח בתקן PCI DSS</span>
                  </div>

                  {/* Demo Notice */}
                  <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                    <p className="text-sm text-yellow-800">
                      🧪 <strong>מצב דמו</strong> - הזן פרטים כלשהם לבדיקה
                    </p>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="mt-6 flex items-center justify-center gap-6 text-gray-400">
                  <div className="flex items-center gap-1">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs">מאובטח</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Lock className="w-4 h-4" />
                    <span className="text-xs">SSL</span>
                  </div>
                  <div className="text-xs">Visa | Mastercard | ישראכרט</div>
                </div>
              </div>
            </div>
          </Step>

          {/* Step 3: Phone & WhatsApp */}
          <Step>
            <div className="py-8" dir="rtl">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <Smartphone className="w-10 h-10 text-green-600" />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                מספר טלפון ו-WhatsApp 📱
              </h2>
                <p className="text-gray-600">
                  הכל מתנהל דרך WhatsApp - שם תפגוש את φ המאמן שלך!
                </p>
              </div>

              <div className="space-y-6 max-w-md mx-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    מספר טלפון (נייד)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="050-1234567"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ניתן להזין עם או בלי מקף
                  </p>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <input
                      type="checkbox"
                      checked={waOptIn}
                      onChange={(e) => setWaOptIn(e.target.checked)}
                      className="mt-1 w-5 h-5 text-green-600 rounded"
                      id="wa-opt-in"
                    />
                    <label htmlFor="wa-opt-in" className="flex-1 cursor-pointer">
                      <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="font-serif text-green-600">φ</span>
                        <span>המאמן הפיננסי האישי שלך ב-WhatsApp</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">
                        הכל קורה ב-WhatsApp! לא צריך להיכנס לאתר:
                      </p>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start gap-2">
                          <span className="text-green-600">✓</span>
                          <span>היכרות קצרה (שם, גיל, מצב משפחתי)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600">✓</span>
                          <span>שליחת דוחות בנק ואשראי</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600">✓</span>
                          <span>רישום הוצאות בהודעה פשוטה</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600">✓</span>
                          <span>קבלת תובנות ועצות מותאמות</span>
                        </li>
                      </ul>
                    </label>
                  </div>
                </div>

                {/* Notice about WhatsApp-first */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-right">
                  <p className="text-sm text-gray-700">
                    <strong>💡 חשוב לדעת:</strong> אחרי השלמת ההרשמה, כל האינטראקציה תהיה דרך WhatsApp. 
                    הדשבורד זמין לצפייה בנתונים בלבד.
                  </p>
                </div>
              </div>
            </div>
          </Step>
        </Stepper>
      </div>
    </div>
  );
}
