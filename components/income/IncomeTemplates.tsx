"use client";

import { Briefcase, Rocket, Home, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: any;
  employment_type: string;
  defaults: {
    pensionPercentage: number;
    advancedStudyPercentage: number;
    estimatedDeductionsPercentage: number; // מס + ביטוח לאומי
  };
}

const templates: Template[] = [
  {
    id: "employee",
    name: "שכיר רגיל",
    description: "עובד במשרה מלאה עם תלוש שכר",
    icon: Briefcase,
    employment_type: "employee",
    defaults: {
      pensionPercentage: 6, // 6% עובד
      advancedStudyPercentage: 2.5, // 2.5% קה"ש
      estimatedDeductionsPercentage: 20, // בערך 20% מס+ביטוח לאומי לשכר ממוצע
    },
  },
  {
    id: "self_employed",
    name: "עצמאי",
    description: "עובד עצמאי עם ניהול ספרים",
    icon: Rocket,
    employment_type: "self_employed",
    defaults: {
      pensionPercentage: 0, // עצמאי מחליט בעצמו
      advancedStudyPercentage: 0,
      estimatedDeductionsPercentage: 45, // מס גבוה + ביטוח לאומי עצמאי
    },
  },
  {
    id: "rental",
    name: "הכנסה משכירות",
    description: "דמי שכירות מנכס",
    icon: Home,
    employment_type: "rental",
    defaults: {
      pensionPercentage: 0,
      advancedStudyPercentage: 0,
      estimatedDeductionsPercentage: 10, // מס שבח/מס הכנסה נמוך
    },
  },
  {
    id: "investment",
    name: "הכנסה מהשקעות",
    description: "דיבידנדים, ריבית, רווחי הון",
    icon: TrendingUp,
    employment_type: "investment",
    defaults: {
      pensionPercentage: 0,
      advancedStudyPercentage: 0,
      estimatedDeductionsPercentage: 25, // מס על רווחי הון
    },
  },
];

interface IncomeTemplatesProps {
  onSelect: (template: Template) => void;
}

export default function IncomeTemplates({ onSelect }: IncomeTemplatesProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {templates.map((template) => {
        const Icon = template.icon;
        return (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className="group bg-white rounded-xl border-2 border-gray-200 p-6 text-right hover:border-[#3A7BD5] hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <Icon className="w-6 h-6 text-[#3A7BD5]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              {template.description}
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              {template.defaults.pensionPercentage > 0 && (
                <div>• פנסיה: {template.defaults.pensionPercentage}%</div>
              )}
              {template.defaults.advancedStudyPercentage > 0 && (
                <div>• קה&quot;ש: {template.defaults.advancedStudyPercentage}%</div>
              )}
              <div>
                • ניכויים: ~{template.defaults.estimatedDeductionsPercentage}%
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export { templates };
export type { Template };

