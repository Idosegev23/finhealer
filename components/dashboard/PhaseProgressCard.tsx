"use client";

import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Section {
  id: string;
  label: string;
  href: string;
  completed: boolean;
}

interface PhaseProgressCardProps {
  userName: string;
  currentPhase: string;
  sections: {
    income: boolean;
    expenses: boolean;
    loans: boolean;
    savings: boolean;
    cash_flow: boolean;
    investments: boolean;
    insurance: boolean;
  };
}

export function PhaseProgressCard({ userName, currentPhase, sections }: PhaseProgressCardProps) {
  // רק אם אנחנו בשלב data_collection
  if (currentPhase !== 'data_collection') {
    return null;
  }

  const sectionsList: Section[] = [
    { id: 'income', label: 'הכנסות', href: '/dashboard/income', completed: sections.income },
    { id: 'expenses', label: 'הוצאות', href: '/dashboard/expenses', completed: sections.expenses },
    { id: 'loans', label: 'הלוואות', href: '/dashboard/loans', completed: sections.loans },
    { id: 'savings', label: 'חיסכון', href: '/dashboard/savings', completed: sections.savings },
    { id: 'cash_flow', label: 'תזרים מזומנים', href: '/dashboard/cash-flow', completed: sections.cash_flow },
    { id: 'investments', label: 'השקעות', href: '/dashboard/investments', completed: sections.investments },
    { id: 'insurance', label: 'ביטוחים', href: '/dashboard/insurance', completed: sections.insurance },
  ];

  const completedCount = sectionsList.filter(s => s.completed).length;
  const totalCount = sectionsList.length;
  const progressPercentage = Math.round((completedCount / totalCount) * 100);

  // אם הכל הושלם - לא להציג כלום
  if (completedCount === totalCount) {
    return null;
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-1">
            {userName}, בואו נשלים את תמונת המצב
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
            השלמת {completedCount} מתוך {totalCount} קטגוריות ({progressPercentage}%)
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-blue-200 dark:bg-blue-900/40 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>

          {/* Missing Sections */}
          <div className="flex flex-wrap gap-2">
            {sectionsList.filter(s => !s.completed).map((section) => (
              <Link
                key={section.id}
                href={section.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <Circle className="w-3 h-3" />
                {section.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

