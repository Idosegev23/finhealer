'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

interface DataCollectionPromptProps {
  userId: string;
}

export function DataCollectionPrompt({ userId }: DataCollectionPromptProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkIfShouldShow();
  }, [userId]);

  const checkIfShouldShow = async () => {
    try {
      const supabase = createClient();

      // Get user creation date
      const { data: userData } = await supabase
        .from('users')
        .select('created_at')
        .eq('id', userId)
        .single();

      if (!userData) {
        setIsChecking(false);
        return;
      }

      const createdAt = new Date(userData.created_at);
      const now = new Date();
      const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Check if user has uploaded any bank statements
      const { data: statements } = await supabase
        .from('uploaded_statements')
        .select('id')
        .eq('user_id', userId)
        .eq('document_type', 'bank_statement')
        .limit(1);

      const hasBankStatement = statements && statements.length > 0;

      // Show modal if:
      // 1. User has been registered for 3+ days
      // 2. User has not uploaded a bank statement
      // 3. User hasn't dismissed this modal today (check localStorage)
      const dismissedToday = localStorage.getItem(`data_collection_prompt_dismissed_${userId}`);
      const today = new Date().toDateString();

      if (daysSinceCreation >= 3 && !hasBankStatement && dismissedToday !== today) {
        setShowModal(true);
      }

      setIsChecking(false);
    } catch (error) {
      console.error('Error checking if should show prompt:', error);
      setIsChecking(false);
    }
  };

  const handleDismiss = () => {
    const today = new Date().toDateString();
    localStorage.setItem(`data_collection_prompt_dismissed_${userId}`, today);
    setShowModal(false);
  };

  const handleGoToScan = () => {
    router.push('/dashboard/scan-center');
  };

  const handleGoToManual = () => {
    router.push('/dashboard/manual-input');
  };

  if (isChecking || !showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full bg-white p-8 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-4 left-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100 mb-4">
            <AlertCircle className="w-10 h-10 text-yellow-600" />
          </div>
          <h2 className="text-3xl font-bold text-phi-dark mb-2">
            שמנו לב שעדיין לא העלת דוח בנק 📊
          </h2>
          <p className="text-lg text-gray-600">
            בלי דוח בנק, קשה לנו לתת לך המלצות מדויקות
          </p>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-bold text-blue-900 mb-3">💡 למה דוח בנק כל כך חשוב?</h3>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-600">✓</span>
              <span>מראה את התמונה המלאה של ההכנסות וההוצאות שלך</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">✓</span>
              <span>עוזר לנו לזהות הוצאות חוזרות שאולי אפשר לחסוך</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">✓</span>
              <span>מאפשר לבנות תקציב חכם מבוסס נתונים אמיתיים</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">🚀</span>
              <span><strong>בונוס:</strong> דוח מ-6 חודשים אחורה = גישה מיידית לכל התכונות!</span>
            </li>
          </ul>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-center font-semibold text-gray-700">
            רוצה לנסות מסלול ידני במקום?
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <Button
              onClick={handleGoToScan}
              className="bg-gradient-to-l from-phi-gold to-phi-coral text-white font-bold py-6 hover:shadow-xl"
              size="lg"
            >
              <Upload className="w-5 h-5 ml-2" />
              לא, אני אעלה דוח
            </Button>
            <Button
              onClick={handleGoToManual}
              variant="outline"
              className="border-2 border-gray-400 font-bold py-6"
              size="lg"
            >
              <FileText className="w-5 h-5 ml-2" />
              כן, בואו ננסה ידני
            </Button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-sm text-gray-500 hover:text-gray-700 underline w-full text-center"
        >
          תזכיר לי מחר
        </button>
      </Card>
    </div>
  );
}

