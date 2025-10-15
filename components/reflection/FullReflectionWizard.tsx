'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Step1Personal from './steps/Step1Personal';

interface FullReflectionWizardProps {
  categories: any[];
  userId: string;
}

export default function FullReflectionWizard({ categories, userId }: FullReflectionWizardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // State רק לפרטים אישיים
  const [data, setData] = useState({
    age: null,
    marital_status: '',
    city: '',
    employment_status: '',
    dependents: [],  // Array of {id, name, birthDate, gender, relationshipType, isFinanciallySupported}
  });

  const handleChange = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleComplete = async () => {
    setLoading(true);

    try {
      // שמירת פרטים אישיים בלבד
      const profileResponse = await fetch('/api/reflection/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: data.age,
          marital_status: data.marital_status,
          city: data.city,
          employment_status: data.employment_status,
          dependents: data.dependents,
          completed: true
        })
      });

      if (!profileResponse.ok) {
        throw new Error('שגיאה בשמירת הפרטים האישיים');
      }

      // עדכון phase ל-data_collection
      const phaseResponse = await fetch('/api/user/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'data_collection' })
      });

      if (!phaseResponse.ok) {
        console.error('Failed to update phase, continuing anyway');
      }

      // מעבר לדשבורד
      router.push('/dashboard?onboarding=completed');
      router.refresh();
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה בשמירת הנתונים. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] py-12 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1E2A3B] mb-2">ברוכים הבאים ל-FinHealer! 🎉</h1>
          <p className="text-[#555555]">בואו נתחיל עם כמה פרטים בסיסיים עליך</p>
        </div>

        {/* Step1Personal */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <Step1Personal data={data} onChange={handleChange} />
        </div>

        {/* Action buttons */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleComplete}
            disabled={loading || !data.age || !data.marital_status || !data.city}
            className="px-8 py-3 bg-[#3A7BD5] text-white rounded-lg font-semibold hover:bg-[#2E5EA5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'שומר...' : 'סיום והמשך לדשבורד →'}
          </button>
        </div>

        {/* Info text */}
        <p className="text-center mt-4 text-sm text-[#888888]">
          תוכל להשלים מידע נוסף (הכנסות, הוצאות, השקעות) בדשבורד
        </p>
      </div>
    </div>
  );
}


