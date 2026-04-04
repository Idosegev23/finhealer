"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Target,
  Wallet,
  Receipt,
  FileText,
  Settings,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Landmark,
  PiggyBank,
  Repeat,
  Gift,
  Calculator,
  TableProperties,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ϕ = U+03D5 (mathematical phi)
const PHI = 'ϕ';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  separator?: boolean;
}

interface PhiSidebarProps {
  isMobileMenuOpen: boolean;
  closeMobileMenu: () => void;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "ראשי", icon: Home },
  { href: "/dashboard/overview", label: "סקירה כללית", icon: BarChart3 },

  { href: "/dashboard/budget", label: "תקציב", icon: Wallet, separator: true },
  { href: "/dashboard/expenses", label: "הוצאות", icon: TrendingDown },
  { href: "/dashboard/income", label: "הכנסות", icon: TrendingUp },
  { href: "/dashboard/transactions", label: "תנועות", icon: Receipt },
  { href: "/dashboard/financial-table", label: "טבלה פיננסית", icon: TableProperties },
  { href: "/dashboard/recurring", label: "מנויים וחוזרות", icon: Repeat },

  { href: "/dashboard/goals", label: "יעדים", icon: Target, separator: true },
  { href: "/dashboard/loans", label: "הלוואות", icon: Landmark },
  { href: "/dashboard/savings", label: "חסכונות", icon: PiggyBank },
  { href: "/dashboard/simulator", label: "סימולטור", icon: Calculator },

  { href: "/dashboard/missing-documents", label: "מסמכים", icon: FileText, separator: true },
  { href: "/dashboard/settings", label: "הגדרות", icon: Settings },
];

export function PhiSidebar({ isMobileMenuOpen, closeMobileMenu }: PhiSidebarProps) {
  const pathname = usePathname();
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("name")
          .eq("id", user.id)
          .single();
        const profileData = profile as any;
        setUserName(profileData?.name || user.email?.split("@")[0] || "");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const SidebarContent = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center justify-center border-b border-phi-slate/20">
        <Link href="/dashboard" onClick={onLinkClick} className="flex items-center gap-2">
          <span className="text-3xl font-serif text-phi-gold">{PHI}</span>
          <span className="text-lg font-bold text-white">Phi</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto" role="navigation" aria-label="תפריט ראשי">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <div key={item.href}>
              {item.separator && (
                <div className="border-t border-phi-slate/15 my-2" />
              )}
              <Link
                href={item.href}
                onClick={onLinkClick}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all group ${
                  isActive
                    ? "bg-phi-gold/20 text-phi-gold"
                    : "text-gray-400 hover:bg-phi-slate/30 hover:text-white"
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-phi-gold' : ''}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User */}
      {userName && (
        <div className="p-4 border-t border-phi-slate/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-phi-gold to-phi-coral flex items-center justify-center text-white text-sm font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-gray-400">משתמש פעיל</p>
            </div>
          </div>
        </div>
      )}
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
          {/* Backdrop */}
          <div
            onClick={closeMobileMenu}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
          />

          {/* Mobile Menu */}
          <aside className="fixed right-0 top-0 z-50 w-64 h-full bg-phi-dark md:hidden shadow-2xl">
            {/* Close button */}
            <button
              onClick={closeMobileMenu}
              className="absolute top-4 left-4 text-gray-400 hover:text-white"
              aria-label="סגור תפריט"
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
