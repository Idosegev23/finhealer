"use client";

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { PhiSidebar } from '@/components/dashboard/PhiSidebar';
import { PhiHeader } from '@/components/dashboard/PhiHeader';
import { DashboardWrapper } from '@/components/dashboard/DashboardWrapper';
import { TourProvider, AutoStartTour } from '@/components/tour/TourProvider';
import { TourHelpButton } from '@/components/tour/TourHelpButton';
import type { TourId } from '@/components/tour/tours';

// Path → tour mapping. The dashboard auto-launches the relevant tour the first
// time the user lands on each section. After dismiss/complete, it stays gone.
// Order matters — more specific routes (e.g. data/loans) must come before
// general ones (e.g. /loans).
function tourForPath(pathname: string): TourId | null {
  if (!pathname) return null;
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'dashboard';
  if (pathname.startsWith('/dashboard/assistant')) return 'assistant';
  if (pathname.startsWith('/dashboard/overview')) return 'overview';
  if (pathname.startsWith('/dashboard/financial-table')) return 'financial-table';
  if (pathname.startsWith('/dashboard/budget')) return 'budget';
  if (pathname.startsWith('/dashboard/expenses')) return 'expenses';
  if (pathname.startsWith('/dashboard/income')) return 'income';
  if (pathname.startsWith('/dashboard/transactions')) return 'transactions';
  if (pathname.startsWith('/dashboard/recurring')) return 'recurring';
  if (pathname.startsWith('/dashboard/goals')) return 'goals';
  if (pathname.startsWith('/dashboard/loans')) return 'loans';
  if (pathname.startsWith('/dashboard/savings')) return 'savings';
  if (pathname.startsWith('/dashboard/investments')) return 'investments';
  if (pathname.startsWith('/dashboard/insurance')) return 'insurance';
  if (pathname.startsWith('/dashboard/pensions')) return 'pensions';
  if (pathname.startsWith('/dashboard/simulator')) return 'simulator';
  if (pathname.startsWith('/dashboard/scan-center')) return 'scan-center';
  if (pathname.startsWith('/dashboard/missing-documents')) return 'missing-documents';
  if (pathname.startsWith('/dashboard/reports')) return 'reports';
  if (pathname.startsWith('/dashboard/settings')) return 'settings';
  return null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const activeTour = tourForPath(pathname || '');

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <TourProvider>
      <DashboardWrapper>
        <div className="flex h-screen bg-gray-900 overflow-hidden" dir="rtl">
          {/* Sidebar */}
          <PhiSidebar
            isMobileMenuOpen={isMobileMenuOpen}
            closeMobileMenu={closeMobileMenu}
          />

          {/* Main Content */}
          <div className="flex flex-col flex-1 w-full overflow-y-auto">
            {/* Header */}
            <PhiHeader toggleMobileMenu={toggleMobileMenu} />

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900">
              {children}
            </main>
          </div>

          {/* Auto-launch the contextual tour on first visit */}
          {activeTour && <AutoStartTour tourId={activeTour} delay={800} />}
          {/* Floating help button — re-launches the contextual tour */}
          {activeTour && <TourHelpButton tourId={activeTour} />}
        </div>
      </DashboardWrapper>
    </TourProvider>
  );
}
