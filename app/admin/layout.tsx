"use client";

import { useState } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { ToasterProvider } from '@/components/ui/toaster';
import { Menu } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <ToasterProvider>
    <div className="flex h-screen bg-gray-900 overflow-hidden" dir="rtl">
      {/* Sidebar */}
      <AdminSidebar
        isMobileMenuOpen={isMobileMenuOpen}
        closeMobileMenu={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 w-full overflow-y-auto">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-phi-dark border-b border-phi-slate/20">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-lg font-bold text-white">Phi Admin</span>
          <div className="w-6" />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-100">
          {children}
        </main>
      </div>
    </div>
    </ToasterProvider>
  );
}
