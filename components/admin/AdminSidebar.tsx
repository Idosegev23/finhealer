"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Landmark,
  X,
} from "lucide-react";

const PHI = 'ϕ';

interface AdminSidebarProps {
  isMobileMenuOpen: boolean;
  closeMobileMenu: () => void;
}

const navItems = [
  { href: "/admin", label: "סקירה כללית", icon: LayoutDashboard },
  { href: "/admin/users", label: "משתמשים", icon: Users },
  { href: "/admin/consolidation", label: "איחוד הלוואות", icon: Landmark },
];

export function AdminSidebar({ isMobileMenuOpen, closeMobileMenu }: AdminSidebarProps) {
  const pathname = usePathname();

  const SidebarContent = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center justify-center border-b border-phi-slate/20">
        <Link href="/admin" onClick={onLinkClick} className="flex items-center gap-2">
          <span className="text-3xl font-serif text-phi-gold">{PHI}</span>
          <span className="text-lg font-bold text-white">Admin</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive
                  ? "bg-phi-gold/20 text-phi-gold"
                  : "text-gray-400 hover:bg-phi-slate/30 hover:text-white"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-phi-gold' : ''}`} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Back to dashboard */}
      <div className="p-4 border-t border-phi-slate/20">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>← חזרה לדשבורד</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-shrink-0 w-56 bg-phi-dark border-l border-phi-slate/20">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <>
          <div
            onClick={closeMobileMenu}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
          />
          <aside className="fixed right-0 top-0 z-50 w-64 h-full bg-phi-dark md:hidden shadow-2xl">
            <button
              onClick={closeMobileMenu}
              className="absolute top-4 left-4 text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <SidebarContent onLinkClick={closeMobileMenu} />
          </aside>
        </>
      )}
    </>
  );
}
