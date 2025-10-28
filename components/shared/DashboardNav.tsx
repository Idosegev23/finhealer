"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Marquee } from "@/components/ui/marquee";
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
  Wallet,
  TrendingDown,
  Activity,
  BarChart3,
  Menu,
  X,
  Plus,
  FileText,
  ChevronDown,
  Target,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "ראשי", icon: Home },
  { href: "/dashboard/overview", label: "תמונת מצב", icon: BarChart3 },
  { href: "/dashboard/goals", label: "יעדים", icon: Target },
  { href: "/loans-simulator", label: "סימולטור", icon: Calculator },
  { href: "/guide", label: "מדריך", icon: BookOpen },
];

// Data collection dropdown
const dataItems = [
  { href: "/dashboard/data/expenses", label: "הוצאות", icon: Receipt },
  { href: "/dashboard/data/income", label: "הכנסות", icon: TrendingUp },
  { href: "/dashboard/data/loans", label: "הלוואות", icon: DollarSign },
  { href: "/dashboard/data/savings", label: "חיסכון", icon: PiggyBank },
  { href: "/dashboard/data/insurance", label: "ביטוחים", icon: Shield },
  { href: "/dashboard/data/pensions", label: "פנסיה", icon: Briefcase },
];

// Reports dropdown
const reportItems = [
  { href: "/dashboard/reports/overview", label: "סיכום כללי", icon: BarChart3 },
  { href: "/dashboard/reports/expenses", label: "הוצאות", icon: TrendingDown },
  { href: "/dashboard/reports/income", label: "הכנסות", icon: TrendingUp },
  { href: "/dashboard/reports/cash-flow", label: "תזרים", icon: Activity },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const [financialData, setFinancialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dataDropdownOpen, setDataDropdownOpen] = useState(false);
  const [reportsDropdownOpen, setReportsDropdownOpen] = useState(false);
  
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      const res = await fetch("/api/financial-summary");
      if (res.ok) {
        const data = await res.json();
        setFinancialData(data);
      }
    } catch (error) {
      console.error("Error fetching financial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const accountBalance = financialData?.current_account_balance || 0;
  const monthlyIncome = financialData?.monthly_income || 0;
  const totalDebt = financialData?.total_debt || 0;
  const netWorth = financialData?.net_worth || 0;

  const financialItems = [
    {
      icon: <Wallet className="w-4 h-4" />,
      label: 'עו"ש',
      value: loading ? '...' : `₪${Math.abs(accountBalance).toLocaleString('he-IL')}`,
      color: accountBalance >= 0 ? 'text-green-300' : 'text-red-300'
    },
    {
      icon: <TrendingUp className="w-4 h-4" />,
      label: 'הכנסה חודשית',
      value: loading ? '...' : `₪${monthlyIncome.toLocaleString('he-IL')}`,
      color: 'text-green-300'
    },
    {
      icon: <TrendingDown className="w-4 h-4" />,
      label: 'חובות',
      value: loading ? '...' : `₪${totalDebt.toLocaleString('he-IL')}`,
      color: 'text-orange-300'
    },
    {
      icon: <Activity className="w-4 h-4" />,
      label: 'שווי נטו',
      value: loading ? '...' : `₪${Math.abs(netWorth).toLocaleString('he-IL')}`,
      color: netWorth >= 0 ? 'text-green-300' : 'text-red-300'
    }
  ];

  return (
    <div className={`sticky top-0 z-50 ${isDark ? 'bg-card-dark border-gray-800' : 'bg-white border-gray-200'} border-b shadow-md transition-colors duration-200`} dir="rtl">
      {/* Spybar - נתונים פיננסיים עם Marquee */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white overflow-hidden relative">
        <Marquee pauseOnHover className="[--duration:10s] [--gap:2rem] py-2">
          {financialItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 whitespace-nowrap">
              {item.icon}
              <span className="text-xs font-medium opacity-80">{item.label}:</span>
              <span className={`text-sm font-bold ${item.color}`}>
                {item.value}
              </span>
            </div>
          ))}
        </Marquee>
        
        {/* Theme Toggle positioned absolutely */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-blue-700/50 backdrop-blur-sm rounded-full p-1">
          <ThemeToggle />
        </div>
      </div>

      {/* Navigation */}
      <div className="border-t border-theme">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-2">
            {/* Desktop Navigation - Full Width Spread */}
            <div className="hidden md:flex items-center justify-between w-full gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`group relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl transition-all flex-1 ${
                      isActive
                        ? "bg-[#3A7BD5] text-white shadow-lg"
                        : isDark 
                          ? "text-gray-400 hover:bg-gray-800 hover:text-white"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-medium text-center whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              })}
              
              {/* Data Collection Dropdown */}
              <div className="relative flex-1">
                <button
                  onClick={() => setDataDropdownOpen(!dataDropdownOpen)}
                  className={`group w-full flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl transition-all ${
                    pathname.startsWith('/dashboard/data')
                      ? "bg-[#3A7BD5] text-white shadow-lg"
                      : isDark 
                        ? "text-gray-400 hover:bg-gray-800 hover:text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-xs font-medium whitespace-nowrap">נתונים</span>
                </button>
                
                {dataDropdownOpen && (
                  <div className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 w-48 rounded-lg shadow-xl border z-50 ${
                    isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}>
                    {dataItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setDataDropdownOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                            pathname === item.href
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                              : isDark
                                ? 'text-gray-300 hover:bg-gray-700'
                                : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reports Dropdown */}
              <div className="relative flex-1">
                <button
                  onClick={() => setReportsDropdownOpen(!reportsDropdownOpen)}
                  className={`group w-full flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl transition-all ${
                    pathname.startsWith('/dashboard/reports')
                      ? "bg-[#3A7BD5] text-white shadow-lg"
                      : isDark 
                        ? "text-gray-400 hover:bg-gray-800 hover:text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <FileText className="w-6 h-6" />
                  <span className="text-xs font-medium whitespace-nowrap">דוחות</span>
                </button>
                
                {reportsDropdownOpen && (
                  <div className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 w-48 rounded-lg shadow-xl border z-50 ${
                    isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}>
                    {reportItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setReportsDropdownOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                            pathname === item.href
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                              : isDark
                                ? 'text-gray-300 hover:bg-gray-700'
                                : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 w-full flex items-center justify-center"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-theme-primary" />
              ) : (
                <Menu className="w-6 h-6 text-theme-primary" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-theme">
            <div className="max-w-7xl mx-auto px-4 py-4">
              {/* Main Nav */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                        isActive
                          ? "bg-[#3A7BD5] text-white shadow-lg"
                          : isDark 
                            ? "text-gray-400 hover:bg-gray-800 hover:text-white"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-xs font-medium text-center">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              
              {/* Data Collection Section */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 mb-2 px-2">הוסף נתונים</h3>
                <div className="grid grid-cols-3 gap-2">
                  {dataItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                          isActive
                            ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20"
                            : isDark 
                              ? "text-gray-400 hover:bg-gray-800"
                              : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs text-center">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Reports Section */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 mb-2 px-2">דוחות</h3>
                <div className="grid grid-cols-2 gap-2">
                  {reportItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-2 p-3 rounded-lg transition-all ${
                          isActive
                            ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20"
                            : isDark 
                              ? "text-gray-400 hover:bg-gray-800"
                              : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

