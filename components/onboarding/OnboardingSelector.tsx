// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Stepper, { Step } from '@/components/ui/stepper';
import { UserCircle, Users, Sparkles, CheckCircle, CreditCard, Smartphone, Zap, Crown } from 'lucide-react';

type Plan = 'basic' | 'premium';

export function OnboardingSelector() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Step 1: Plan selection
  const [selectedPlan, setSelectedPlan] = useState<Plan>('basic');

  // Step 2: Payment (handled by GreenInvoice redirect)
  const [paymentComplete, setPaymentComplete] = useState(false);

  // Step 3: Phone & WhatsApp
  const [phone, setPhone] = useState('');
  const [waOptIn, setWaOptIn] = useState(true);

  // Step 4: Personal Info
  const [age, setAge] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [city, setCity] = useState('');

  // Step 5: Family
  const [childrenCount, setChildrenCount] = useState(0);

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

  const handlePayment = async () => {
    try {
      setIsLoading(true);

      // For now, we'll use demo payment until GreenInvoice is integrated
      const response = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          onboardingType: 'quick',
          phone: '0000000000', // Temporary - will be updated in next step
          waOptIn: false, // Will be updated in next step
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה ביצירת מנוי');
      }

      setPaymentComplete(true);
      return true;
    } catch (error) {
      console.error('Payment error:', error);
      alert('אירעה שגיאה. נסה שוב.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneStep = async () => {
    if (!phone) {
      alert('אנא הכנס מספר טלפון');
      return false;
    }

    // Clean phone number
    const cleanedPhone = phone.replace(/\D/g, '');
    let formattedPhone = cleanedPhone;

    if (cleanedPhone.startsWith('0')) {
      formattedPhone = '972' + cleanedPhone.substring(1);
    } else if (!cleanedPhone.startsWith('972')) {
      formattedPhone = '972' + cleanedPhone;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('users')
        .update({
          phone: formattedPhone,
          wa_opt_in: waOptIn,
        })
        .eq('id', userId);

      if (error) {
        console.error('Error saving phone:', error);
        alert('שגיאה בשמירת מספר הטלפון');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Phone error:', error);
      return false;
    }
  };

  const handleFinalStep = async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();

      // Save to user_financial_profile
      const { error: profileError } = await supabase
        .from('user_financial_profile')
        .upsert({
          user_id: userId,
          age: age ? parseInt(age) : null,
          marital_status: maritalStatus || null,
          city: city || null,
          children_count: childrenCount,
          completed: true,
          completed_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error('Error saving profile:', profileError);
        alert('שגיאה בשמירת הפרטים. נסה שוב.');
        return;
      }

      // Update user phase
      const { error: userError } = await supabase
        .from('users')
        .update({ phase: 'data_collection' })
        .eq('id', userId);

      if (userError) {
        console.error('Error updating phase:', userError);
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Onboarding error:', error);
      alert('אירעה שגיאה. נסה שוב.');
    } finally {
      setIsLoading(false);
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
        'ייעוץ עם גדי (1 פעם בחודש)',
        'תמיכה עדיפות',
      ],
    },
  ];

  const handleStepTransition = async (fromStep: number, toStep: number) => {
    // Step 2 -> 3: Process payment
    if (fromStep === 2 && toStep === 3) {
      return await handlePayment();
    }
    
    // Step 3 -> 4: Save phone
    if (fromStep === 3 && toStep === 4) {
      return await handlePhoneStep();
    }
    
    return true; // Allow transition by default
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-success/10 py-8">
      <div className="container mx-auto px-4">
        <Stepper
          initialStep={1}
          onBeforeStepChange={handleStepTransition}
          onFinalStepCompleted={handleFinalStep}
          backButtonText="חזור"
          nextButtonText="המשך"
          finalButtonText={isLoading ? 'שומר...' : 'סיום'}
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

          {/* Step 2: Payment Confirmation */}
          <Step>
            <div className="py-8 text-center" dir="rtl">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
                <CreditCard className="w-12 h-12 text-primary" />
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                אישור מנוי 🎯
              </h2>

              <div className="max-w-md mx-auto mb-8">
                <div className="bg-gradient-to-br from-primary/5 to-success/5 border-2 border-primary/20 rounded-2xl p-8 mb-6">
                  <div className="mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                      {React.createElement(plans.find(p => p.id === selectedPlan)?.icon || Zap, { className: 'w-10 h-10 text-primary' })}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {plans.find(p => p.id === selectedPlan)?.name}
                    </h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-primary">
                        ₪{plans.find(p => p.id === selectedPlan)?.price}
                      </span>
                      <span className="text-gray-600">/חודש</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-sm text-gray-600 mb-3">המנוי כולל:</p>
                    <ul className="space-y-2 text-sm text-right">
                      {plans.find(p => p.id === selectedPlan)?.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-success">✓</span>
                          <span className="text-gray-700">{feature}</span>
                </li>
                      ))}
                      <li className="text-gray-500">ועוד...</li>
              </ul>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-700">
                    ✅ <strong>לתשומת ליבך:</strong> זהו מנוי הדגמה. בפרודקשן יהיה תשלום אמיתי דרך GreenInvoice
                  </p>
                </div>

                <p className="text-xs text-gray-500">
                  🔒 ניתן לבטל את המנוי בכל עת ללא התחייבות
                </p>
              </div>
            </div>
          </Step>

          {/* Step 3: Phone & WhatsApp */}
          <Step>
            <div className="py-8" dir="rtl">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Smartphone className="w-10 h-10 text-primary" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                מספר טלפון ו-WhatsApp 📱
              </h2>

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
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ניתן להזין עם או בלי מקף
                  </p>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <input
                      type="checkbox"
                      checked={waOptIn}
                      onChange={(e) => setWaOptIn(e.target.checked)}
                      className="mt-1 w-5 h-5 text-primary"
                      id="wa-opt-in"
                    />
                    <label htmlFor="wa-opt-in" className="flex-1 cursor-pointer">
                      <div className="font-semibold text-gray-900 mb-2">
                        🤖 פיני - המאמן הפיננסי האישי שלך ב-WhatsApp
                      </div>
                      <p className="text-sm text-gray-700 mb-3">
                        קבל התראות, תובנות וטיפים ישירות ל-WhatsApp:
                      </p>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start gap-2">
                          <span className="text-success">✓</span>
                          <span>סיכומים יומיים של הוצאות</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-success">✓</span>
                          <span>התראות על חריגה מתקציב</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-success">✓</span>
                          <span>רישום הוצאות בקלות דרך הודעה</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-success">✓</span>
                          <span>שיחה עם AI לשאלות פיננסיות</span>
                        </li>
                      </ul>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </Step>

          {/* Step 4: Personal Info */}
          <Step>
            <div className="py-8" dir="rtl">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <UserCircle className="w-10 h-10 text-primary" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                פרטים אישיים
              </h2>

              <div className="space-y-4 max-w-md mx-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    גיל
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="למשל: 35"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    מצב משפחתי
                  </label>
                  <select
                    value={maritalStatus}
                    onChange={(e) => setMaritalStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">בחר...</option>
                    <option value="single">רווק/ה</option>
                    <option value="married">נשוי/אה</option>
                    <option value="divorced">גרוש/ה</option>
                    <option value="widowed">אלמן/ה</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    עיר מגורים
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="למשל: תל אביב"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </Step>

          {/* Step 5: Family */}
          <Step>
            <div className="py-8" dir="rtl">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Users className="w-10 h-10 text-primary" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                משפחה
              </h2>

              <div className="space-y-4 max-w-md mx-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    מספר ילדים
                  </label>
                  <input
                    type="number"
                    value={childrenCount}
                    onChange={(e) => setChildrenCount(parseInt(e.target.value) || 0)}
                    min="0"
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-right">
                  <p className="text-sm text-gray-700">
                    <strong>💡 טיפ:</strong> פרטים נוספים על ילדים (שמות, גילאים) תוכל למלא מאוחר יותר בדשבורד
                  </p>
                </div>
              </div>
            </div>
          </Step>

          {/* Step 6: Complete */}
          <Step>
            <div className="text-center py-8" dir="rtl">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10 mb-6">
                <CheckCircle className="w-12 h-12 text-success" />
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                הכל מוכן! 🎊
              </h2>

              <p className="text-lg text-gray-600 mb-6">
                סיימת את תהליך ההצטרפות בהצלחה!
              </p>

              <div className="bg-gradient-to-r from-primary/10 to-success/10 border border-primary/20 rounded-lg p-6 max-w-md mx-auto">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 mb-2">מה הלאה?</p>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li>• תגיע לדשבורד האישי שלך</li>
                      <li>• תוכל למלא מידע נוסף על הכנסות והוצאות</li>
                      <li>• תקבל תובנות והמלצות מותאמות אישית</li>
                      <li>• תוכל ליצור תקציב ויעדים פיננסיים</li>
                      {waOptIn && <li>• פיני יתחיל לשלוח לך הודעות ב-WhatsApp 🤖</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Step>
        </Stepper>
      </div>
    </div>
  );
}
