"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PhiLogo from "@/components/ui/PhiLogo";
import {
  Home,
  TrendingUp,
  DollarSign,
  PiggyBank,
  Shield,
  Briefcase,
  Receipt,
  Calculator,
  BookOpen,
  Target,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  FileText,
  Plus,
  Scan,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PhiSidebarProps {
  isMobileMenuOpen: boolean;
  closeMobileMenu: () => void;
}

export function PhiSidebar({ isMobileMenuOpen, closeMobileMenu }: PhiSidebarProps) {
  const pathname = usePathname();
  const [userName, setUserName] = useState<string>("");
  const [userAvatar, setUserAvatar] = useState<string>("");
  const [dataDropdownOpen, setDataDropdownOpen] = useState(false);
  const [reportsDropdownOpen, setReportsDropdownOpen] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("name")
          .eq("id", user.id)
          .single();
        const profileData = profile as any;
        setUserName(
          profileData?.name || user.email?.split("@")[0] || "משתמש"
        );
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const mainNavItems = [
    { href: "/dashboard", label: "ראשי", icon: Home },
    { href: "/dashboard/overview", label: "תמונת מצב", icon: BarChart3 },
    { href: "/dashboard/scan-center", label: "סריקה", icon: Scan },
    { href: "/dashboard/goals", label: "יעדים", icon: Target },
    { href: "/loans-simulator", label: "סימולטור הלוואות", icon: Calculator },
    { href: "/guide", label: "מדריך", icon: BookOpen },
  ];

  const dataItems = [
    { href: "/dashboard/data/expenses", label: "הוצאות", icon: Receipt },
    { href: "/dashboard/income", label: "הכנסות", icon: TrendingUp },
    { href: "/dashboard/data/loans", label: "הלוואות", icon: DollarSign },
    { href: "/dashboard/data/savings", label: "חיסכון", icon: PiggyBank },
    {
      href: "/dashboard/data/insurance",
      label: "ביטוחים",
      icon: Shield,
    },
    { href: "/dashboard/data/pensions", label: "פנסיה", icon: Briefcase },
  ];

  const reportItems = [
    { href: "/dashboard/reports/overview", label: "סיכום כללי", icon: BarChart3 },
    { href: "/dashboard/reports/expenses", label: "דוח הוצאות", icon: Receipt },
    { href: "/dashboard/reports/income", label: "דוח הכנסות", icon: TrendingUp },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex z-20 flex-shrink-0 w-64 overflow-y-auto bg-phi-dark border-l border-phi-slate/30">
        <div className="flex flex-col w-full">
          {/* Logo & Brand */}
          <div className="p-4 bg-gradient-to-b from-phi-dark to-phi-slate/20">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 hover:scale-105 transition-transform"
            >
              <PhiLogo size="sm" showText={false} animated={false} />
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-phi-gold">
                  <span style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                    ϕ
                  </span>{" "}
                  Phi
                </span>
                <span className="text-xs text-phi-mint">היחס הזהב שלך</span>
              </div>
            </Link>
          </div>

          {/* User Profile */}
          <div className="flex justify-center py-6">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-phi-gold to-phi-coral flex items-center justify-center text-white text-3xl font-bold border-4 border-phi-mint shadow-lg">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-phi-mint rounded-full border-4 border-phi-dark"></div>
              </div>
              <p className="mt-3 text-base font-bold text-white">{userName}</p>
              <p className="text-xs text-phi-mint">משתמש פעיל</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-2">
            {/* Main Items */}
            <div className="space-y-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                      isActive
                        ? "bg-gradient-to-l from-phi-gold to-phi-coral text-white shadow-lg"
                        : "text-gray-300 hover:bg-phi-slate/30 hover:text-white"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Data Dropdown */}
            <div className="pt-4">
              <button
                onClick={() => setDataDropdownOpen(!dataDropdownOpen)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                  pathname.startsWith("/dashboard/data")
                    ? "bg-phi-mint/20 text-phi-mint"
                    : "text-gray-300 hover:bg-phi-slate/30 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-semibold">הוסף נתונים</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    dataDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {dataDropdownOpen && (
                <div className="mt-2 space-y-1 pr-4">
                  {dataItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                          isActive
                            ? "bg-phi-mint/20 text-phi-mint"
                            : "text-gray-400 hover:bg-phi-slate/20 hover:text-white"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reports Dropdown */}
            <div>
              <button
                onClick={() => setReportsDropdownOpen(!reportsDropdownOpen)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                  pathname.startsWith("/dashboard/reports")
                    ? "bg-phi-mint/20 text-phi-mint"
                    : "text-gray-300 hover:bg-phi-slate/30 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-semibold">דוחות</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    reportsDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {reportsDropdownOpen && (
                <div className="mt-2 space-y-1 pr-4">
                  {reportItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                          isActive
                            ? "bg-phi-mint/20 text-phi-mint"
                            : "text-gray-400 hover:bg-phi-slate/20 hover:text-white"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-phi-slate/30">
            <div className="flex items-center justify-center gap-2 text-phi-mint text-xs">
              <span style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '16px' }}>
                ϕ
              </span>
              <span>גרסה 1.0.0</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeMobileMenu}
            className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          />

          {/* Mobile Menu */}
          <aside className="fixed right-0 top-0 z-50 flex flex-col w-64 h-full overflow-y-auto bg-phi-dark md:hidden shadow-2xl transform transition-transform duration-300">
            <div className="flex flex-col w-full">
              {/* Logo & Brand */}
              <div className="p-4 bg-gradient-to-b from-phi-dark to-phi-slate/20">
                <Link
                  href="/dashboard"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3"
                >
                  <PhiLogo size="sm" showText={false} animated={false} />
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-phi-gold">
                      <span
                        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                      >
                        ϕ
                      </span>{" "}
                      Phi
                    </span>
                    <span className="text-xs text-phi-mint">
                      היחס הזהב שלך
                    </span>
                  </div>
                </Link>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-3 py-4 space-y-2">
                {mainNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                        isActive
                          ? "bg-gradient-to-l from-phi-gold to-phi-coral text-white shadow-lg"
                          : "text-gray-300 hover:bg-phi-slate/30 hover:text-white"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-semibold">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}

                {/* Data Items */}
                <div className="pt-4">
                  <button
                    onClick={() => setDataDropdownOpen(!dataDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-gray-300 hover:bg-phi-slate/30 hover:text-white transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Plus className="w-5 h-5" />
                      <span className="text-sm font-semibold">
                        הוסף נתונים
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        dataDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {dataDropdownOpen && (
                    <div className="mt-2 space-y-1 pr-4">
                      {dataItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={closeMobileMenu}
                            className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-400 hover:bg-phi-slate/20 hover:text-white transition-all"
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-medium">
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Report Items */}
                <div>
                  <button
                    onClick={() => setReportsDropdownOpen(!reportsDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-gray-300 hover:bg-phi-slate/30 hover:text-white transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5" />
                      <span className="text-sm font-semibold">דוחות</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        reportsDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {reportsDropdownOpen && (
                    <div className="mt-2 space-y-1 pr-4">
                      {reportItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={closeMobileMenu}
                            className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-400 hover:bg-phi-slate/20 hover:text-white transition-all"
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-medium">
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </nav>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

