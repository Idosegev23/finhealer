import { Metadata } from 'next';
import { QuickOnboardingWizard } from '@/components/onboarding/QuickOnboardingWizard';

export const metadata: Metadata = {
  title: 'התחלה מהירה | FinHealer',
  description: 'התחל תוך 2 דקות',
};

export default function QuickOnboardingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <QuickOnboardingWizard />
    </div>
  );
}

