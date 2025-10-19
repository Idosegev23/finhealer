"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "דשבורד", icon: Home },
  { href: "/dashboard/phases", label: "השלבים", icon: Activity },
  { href: "/dashboard/overview", label: "תמונת מצב", icon: BarChart3 },
  { href: "/dashboard/income", label: "הכנסות", icon: TrendingUp },
  { href: "/dashboard/expenses", label: "הוצאות", icon: Receipt },
  { href: "/dashboard/loans", label: "הלוואות", icon: DollarSign },
  { href: "/dashboard/savings", label: "חיסכון", icon: PiggyBank },
  { href: "/dashboard/insurance", label: "ביטוחים", icon: Shield },
  { href: "/dashboard/pensions", label: "פנסיה", icon: Briefcase },
  { href: "/loans-simulator", label: "סימולטור", icon: Calculator },
  { href: "/guide", label: "מדריך", icon: BookOpen },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const [financialData, setFinancialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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
        <div className="py-2">
          <div className="flex animate-marquee-seamless">
            {/* Multiple duplicates for truly seamless loop */}
            {[...Array(4)].map((_, setIdx) => (
              <div key={`set-${setIdx}`} className="flex flex-shrink-0">
                {financialItems.map((item, idx) => (
                  <div key={`${setIdx}-${idx}`} className="flex items-center gap-2 whitespace-nowrap mx-8">
                    {item.icon}
                    <span className="text-xs font-medium opacity-80">{item.label}:</span>
                    <span className={`text-sm font-bold ${item.color}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        
        {/* Theme Toggle positioned absolutely */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
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
                    
                    {/* Tooltip */}
                    <span className={`absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
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
              <div className="grid grid-cols-3 gap-3">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

