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
  Calculator,
  TableProperties,
  Sparkles,
  Shield,
  Briefcase,
  ScanLine,
  ChevronDown,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ϕ = U+03D5 (mathematical phi)
const PHI = 'ϕ';

interface NavItem {
  href: string;
  label: string;
  icon: any;
}

interface NavSection {
  label: string;
  // Whether this group is collapsible. The first 'Essentials' group stays
  // pinned open. The other groups can be folded so the user is not
  // facing 20 items on first paint.
  collapsible: boolean;
  // Default open state when no localStorage preference exists.
  defaultOpen: boolean;
  items: NavItem[];
}

interface PhiSidebarProps {
  isMobileMenuOpen: boolean;
  closeMobileMenu: () => void;
}

// Sidebar grouped into 4 sections. The first group is the everyday
// surface (always open); the rest collapse so a new user sees a
// short, focused list and can drill in when needed.
const navSections: NavSection[] = [
  {
    label: 'ראשי',
    collapsible: false,
    defaultOpen: true,
    items: [
      { href: '/dashboard', label: 'דף הבית', icon: Home },
      { href: '/dashboard/assistant', label: 'שיחה עם φ', icon: Sparkles },
      { href: '/dashboard/scan-center', label: 'העלאת מסמכים', icon: ScanLine },
    ],
  },
  {
    label: 'כספים',
    collapsible: true,
    defaultOpen: true, // most users land in this group regularly
    items: [
      { href: '/dashboard/budget', label: 'תקציב', icon: Wallet },
      { href: '/dashboard/transactions', label: 'תנועות', icon: Receipt },
      { href: '/dashboard/expenses', label: 'הוצאות', icon: TrendingDown },
      { href: '/dashboard/income', label: 'הכנסות', icon: TrendingUp },
      { href: '/dashboard/recurring', label: 'מנויים וחוזרות', icon: Repeat },
      { href: '/dashboard/financial-table', label: 'טבלה פיננסית', icon: TableProperties },
      { href: '/dashboard/overview', label: 'סקירה כללית', icon: BarChart3 },
    ],
  },
  {
    label: 'תכנון לטווח ארוך',
    collapsible: true,
    defaultOpen: false, // hidden by default — opens when goals/budget set
    items: [
      { href: '/dashboard/goals', label: 'יעדים', icon: Target },
      { href: '/dashboard/savings', label: 'חסכונות', icon: PiggyBank },
      { href: '/dashboard/loans', label: 'הלוואות', icon: Landmark },
      { href: '/dashboard/insurance', label: 'ביטוחים', icon: Shield },
      { href: '/dashboard/pensions', label: 'פנסיה', icon: PiggyBank },
      { href: '/dashboard/investments', label: 'השקעות', icon: Briefcase },
      { href: '/dashboard/simulator', label: 'סימולטור', icon: Calculator },
    ],
  },
  {
    label: 'אחר',
    collapsible: true,
    defaultOpen: false,
    items: [
      { href: '/dashboard/missing-documents', label: 'מסמכים חסרים', icon: FileText },
      { href: '/dashboard/settings', label: 'הגדרות', icon: Settings },
    ],
  },
];

const STORAGE_KEY = 'phi:sidebar:open-sections';

export function PhiSidebar({ isMobileMenuOpen, closeMobileMenu }: PhiSidebarProps) {
  const pathname = usePathname();
  const [userName, setUserName] = useState<string>("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const s of navSections) initial[s.label] = s.defaultOpen;
    return initial;
  });

  // Hydrate persisted open/closed state, then auto-expand whichever
  // group contains the currently active route — so even if the user
  // collapsed 'תכנון' yesterday, navigating to /goals re-opens it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        setOpenSections((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  useEffect(() => {
    if (!pathname) return;
    setOpenSections((prev) => {
      const next = { ...prev };
      for (const s of navSections) {
        if (!s.collapsible) continue;
        const containsActive = s.items.some(
          (it) => pathname === it.href || (it.href !== '/dashboard' && pathname.startsWith(it.href)),
        );
        if (containsActive) next[s.label] = true;
      }
      return next;
    });
  }, [pathname]);

  const toggleSection = (label: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage may be disabled — silent
      }
      return next;
    });
  };

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

      {/* Navigation — grouped sections, advanced ones collapse */}
      <nav className="flex-1 p-3 overflow-y-auto" role="navigation" aria-label="תפריט ראשי">
        {navSections.map((section, sectionIdx) => {
          const isOpen = openSections[section.label] ?? section.defaultOpen;
          const containsActive = section.items.some(
            (it) => pathname === it.href || (it.href !== '/dashboard' && pathname.startsWith(it.href)),
          );
          return (
            <div key={section.label} className={sectionIdx > 0 ? 'mt-3' : ''}>
              {section.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.label)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {section.label}
                    {!isOpen && containsActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-phi-gold" />
                    )}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>
              ) : (
                <h3 className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 px-3 pb-1.5">
                  {section.label}
                </h3>
              )}

              {isOpen && (
                <div className="space-y-0.5 mt-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
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
                    );
                  })}
                </div>
              )}
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
      <aside
        data-tour="sidebar"
        className="hidden md:flex flex-shrink-0 w-64 bg-phi-dark border-l-2 border-phi-gold/30 shadow-[-4px_0_12px_rgba(7,66,89,0.15)]"
      >
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
