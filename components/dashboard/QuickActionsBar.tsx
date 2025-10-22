"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CreditCard,
  Shield,
  Briefcase,
} from "lucide-react";
import Link from "next/link";

const quickActions = [
  {
    icon: TrendingUp,
    label: "הוסף הכנסה",
    href: "/dashboard/income",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: TrendingDown,
    label: "רשום הוצאה",
    href: "/dashboard/expenses",
    color: "from-orange-500 to-red-600",
  },
  {
    icon: CreditCard,
    label: "נהל הלוואות",
    href: "/dashboard/loans",
    color: "from-purple-500 to-pink-600",
  },
  {
    icon: PiggyBank,
    label: "עדכן חיסכון",
    href: "/dashboard/savings",
    color: "from-blue-500 to-cyan-600",
  },
  {
    icon: Shield,
    label: "ביטוחים",
    href: "/dashboard/insurance",
    color: "from-indigo-500 to-blue-600",
  },
  {
    icon: Briefcase,
    label: "פנסיה",
    href: "/dashboard/pensions",
    color: "from-teal-500 to-green-600",
  },
];

export function QuickActionsBar() {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-theme-primary mb-4">פעולות מהירות</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.div
              key={action.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Link href={action.href}>
                <div className="group cursor-pointer">
                  <div
                    className={`bg-gradient-to-br ${action.color} rounded-xl p-6 text-white shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}
                  >
                    <Icon className="w-8 h-8 mb-3 mx-auto" />
                    <p className="text-sm font-semibold text-center">
                      {action.label}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

