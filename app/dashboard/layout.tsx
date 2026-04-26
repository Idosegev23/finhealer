"use client";

import { useState } from 'react';
import { PhiSidebar } from '@/components/dashboard/PhiSidebar';
import { PhiHeader } from '@/components/dashboard/PhiHeader';
import { DashboardWrapper } from '@/components/dashboard/DashboardWrapper';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
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
      </div>
    </DashboardWrapper>
  );
}

