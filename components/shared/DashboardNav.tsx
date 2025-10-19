"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  TrendingUp,
  DollarSign,
  PiggyBank,
  Shield,
  Briefcase,
  Receipt,
  Target,
  Calculator,
  BookOpen,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "דשבורד", icon: Home },
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

  return (
    <nav className="bg-white border-b border-gray-200 shadow-md sticky top-0 z-50" dir="rtl">
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
    </nav>
  );
}

