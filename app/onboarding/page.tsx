import { Metadata } from 'next';
import { OnboardingSelector } from '@/components/onboarding/OnboardingSelector';

export const metadata: Metadata = {
  title: 'ברוכים הבאים | FinHealer',
  description: 'התחל את המסע הפיננסי שלך',
};

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <OnboardingSelector />
    </div>
  );
}
