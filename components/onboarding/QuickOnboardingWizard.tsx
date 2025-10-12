'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Stepper, { Step } from '@/components/shared/Stepper';
import { QuickStep1Basic } from './quick-steps/QuickStep1Basic';
import { QuickStep2Financial } from './quick-steps/QuickStep2Financial';
import { QuickStep3GetStarted } from './quick-steps/QuickStep3GetStarted';

export interface QuickOnboardingData {
  // Step 1: Basic
  name?: string;
  primaryGoal?: string;

  // Step 2: Financial snapshot
  monthlyIncome?: number;
  hasDebts?: boolean;
  debtAmount?: number;
  hasSavings?: boolean;
  savingsAmount?: number;

  // Step 3: How to start
  startMethod?: 'manual' | 'receipts' | 'whatsapp';
}

export function QuickOnboardingWizard() {
  const router = useRouter();
  const [data, setData] = useState<QuickOnboardingData>({});
  const [currentStep, setCurrentStep] = useState(1);

  const updateData = (newData: Partial<QuickOnboardingData>) => {
    setData((prev) => ({ ...prev, ...newData }));
  };

  const handleComplete = async () => {
    try {
      // Update user profile with quick data
      const response = await fetch('/api/onboarding/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to save onboarding data');

      // After quick onboarding, always go to payment first
      // Store the start method for later use after payment
      if (typeof window !== 'undefined') {
        localStorage.setItem('finhealer_start_method', data.startMethod || 'manual');
      }
      
      router.push('/payment');
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      alert('אופס! משהו השתבש. נסה שוב.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 bg-white rounded-xl shadow-sm p-6"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          התחלה מהירה ⚡
        </h1>
        <p className="text-gray-600">
          רק 2-3 דקות ואתה בפנים!
        </p>
      </motion.div>

      {/* Stepper */}
      <Stepper
        initialStep={currentStep}
        onStepChange={setCurrentStep}
        onFinalStepCompleted={handleComplete}
        backButtonText="חזור"
        nextButtonText="המשך"
      >
        <Step>
          <QuickStep1Basic data={data} updateData={updateData} />
        </Step>

        <Step>
          <QuickStep2Financial data={data} updateData={updateData} />
        </Step>

        <Step>
          <QuickStep3GetStarted data={data} updateData={updateData} />
        </Step>
      </Stepper>

      {/* Footer link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center mt-8"
      >
        <button
          onClick={() => router.push('/reflection')}
          className="text-sm text-primary hover:underline"
        >
          רוצה למלא תמונה מלאה יותר? לחץ כאן
        </button>
      </motion.div>
    </div>
  );
}

