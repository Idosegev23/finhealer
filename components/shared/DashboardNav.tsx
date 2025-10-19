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

  return (
    <div className={`sticky top-0 z-50 ${isDark ? 'bg-card-dark border-gray-800' : 'bg-white border-gray-200'} border-b shadow-md transition-colors duration-200`} dir="rtl">
      {/* Spybar - נתונים פיננסיים */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-6 overflow-x-auto scrollbar-hide">
            {/* מצב חשבון */}
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-medium opacity-80">עו&quot;ש:</span>
              <span className={`text-sm font-bold ${accountBalance >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {loading ? '...' : `₪${Math.abs(accountBalance).toLocaleString('he-IL')}`}
              </span>
            </div>

            {/* הכנסה חודשית */}
            <div className="flex items-center gap-2 whitespace-nowrap">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium opacity-80">הכנסה:</span>
              <span className="text-sm font-bold text-green-300">
                {loading ? '...' : `₪${monthlyIncome.toLocaleString('he-IL')}`}
              </span>
            </div>

            {/* חובות */}
            <div className="flex items-center gap-2 whitespace-nowrap">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium opacity-80">חובות:</span>
              <span className="text-sm font-bold text-orange-300">
                {loading ? '...' : `₪${totalDebt.toLocaleString('he-IL')}`}
              </span>
            </div>

            {/* שווי נטו */}
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Activity className="w-4 h-4" />
              <span className="text-xs font-medium opacity-80">שווי נטו:</span>
              <span className={`text-sm font-bold ${netWorth >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {loading ? '...' : `₪${Math.abs(netWorth).toLocaleString('he-IL')}`}
              </span>
            </div>

            {/* רענון */}
            <button 
              onClick={fetchFinancialData}
              className="text-xs font-medium opacity-80 hover:opacity-100 transition-opacity px-3 py-1 rounded bg-white/10 hover:bg-white/20"
            >
              ↻ רענן
            </button>

            {/* Theme Toggle */}
            <div className="mr-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 overflow-x-auto py-4 scrollbar-hide">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-5 py-3 rounded-lg whitespace-nowrap transition-all font-semibold ${
                  isActive
                    ? "bg-[#3A7BD5] text-white shadow-lg scale-105"
                    : isDark 
                      ? "text-gray-300 hover:bg-gray-800 hover:text-white hover:scale-105"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:scale-105"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-base">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

