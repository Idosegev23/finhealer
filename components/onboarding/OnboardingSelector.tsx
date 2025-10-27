// @ts-nocheck
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Stepper, { Step } from '@/components/ui/stepper';
import { UserCircle, Users, Sparkles, CheckCircle } from 'lucide-react';

export function OnboardingSelector() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // State for form data
  const [age, setAge] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [city, setCity] = useState('');
  const [childrenCount, setChildrenCount] = useState(0);

  const handleFinalStep = async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Update user financial profile
      const { error } = await supabase
        .from('user_financial_profile')
        .upsert({
          user_id: user.id,
          age: age ? parseInt(age) : null,
          marital_status: maritalStatus || null,
          city: city || null,
          children_count: childrenCount,
          completed: true,
          completed_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error saving profile:', error);
        alert('שגיאה בשמירת הפרטים. נסה שוב.');
        return;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-success/10 py-8">
      <Stepper
        initialStep={1}
        onFinalStepCompleted={handleFinalStep}
        backButtonText="חזור"
        nextButtonText="המשך"
        finalButtonText={isLoading ? 'שומר...' : 'סיום'}
      >
        {/* Step 1: Welcome */}
        <Step>
          <div className="text-center py-8" dir="rtl">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
              <UserCircle className="w-12 h-12 text-primary" />
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              ברוכים הבאים ל-FinHealer! 🎉
            </h2>
            
            <p className="text-lg text-gray-600 mb-6">
              בואו נכיר אותך יותר טוב כדי לספק לך חווייה מותאמת אישית
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-right">
              <p className="text-sm text-gray-700">
                <strong>💡 תהליך קצר:</strong> 3 שלבים פשוטים ואתה מוכן!
              </p>
            </div>
          </div>
        </Step>

        {/* Step 2: Personal Info */}
        <Step>
          <div className="py-8" dir="rtl">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <UserCircle className="w-10 h-10 text-primary" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              פרטים אישיים
            </h2>
            
            <div className="space-y-4">
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

        {/* Step 3: Family */}
        <Step>
          <div className="py-8" dir="rtl">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Users className="w-10 h-10 text-primary" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              משפחה
            </h2>
            
            <div className="space-y-4">
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

        {/* Step 4: Complete */}
        <Step>
          <div className="text-center py-8" dir="rtl">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10 mb-6">
              <CheckCircle className="w-12 h-12 text-success" />
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              הכל מוכן! 🎊
            </h2>
            
            <p className="text-lg text-gray-600 mb-6">
              סיימת את התהליך בהצלחה!
            </p>
            
            <div className="bg-gradient-to-r from-primary/10 to-success/10 border border-primary/20 rounded-lg p-6 text-right">
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900 mb-2">מה הלאה?</p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• תגיע לדשבורד האישי שלך</li>
                    <li>• תוכל למלא מידע נוסף על הכנסות והוצאות</li>
                    <li>• תקבל תובנות והמלצות מותאמות אישית</li>
                    <li>• תוכל ליצור תקציב ויעדים פיננסיים</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Step>
      </Stepper>
    </div>
  );
}

