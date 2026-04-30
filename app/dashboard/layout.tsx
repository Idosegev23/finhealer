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
function tourForPath(pathname: string): TourId | null {
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'dashboard';
  if (pathname.startsWith('/dashboard/budget')) return 'budget';
  if (pathname.startsWith('/dashboard/goals')) return 'goals';
  if (pathname.startsWith('/dashboard/loans')) return 'loans';
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
