"use client";

import { CheckCircle2, Circle, Clock, Lock } from "lucide-react";

interface Phase {
  id: string;
  name: string;
  description: string;
  order: number;
  progress?: number; // 0-100
}

interface PhaseProgressBarProps {
  currentPhase: string;
  sections?: {
    income: boolean;
    expenses: boolean;
    loans: boolean;
    savings: boolean;
    cash_flow: boolean;
    investments: boolean;
    insurance: boolean;
  };
}

const phases: Phase[] = [
  {
    id: 'reflection',
    name: 'שיקוף',
    description: 'הבנת העבר והווה',
    order: 1,
  },
  {
    id: 'behavior',
    name: 'שינוי הרגלים',
    description: 'בניית הרגלים חדשים',
    order: 2,
  },
  {
    id: 'budget',
    name: 'תקציב',
    description: 'ניהול תקציב חכם',
    order: 3,
  },
  {
    id: 'goals',
    name: 'יעדים',
    description: 'הגדרת מטרות',
    order: 4,
  },
  {
    id: 'monitoring',
    name: 'מעקב',
    description: 'ניטור והתאמות',
    order: 5,
  },
];

export function PhaseProgressBar({ currentPhase, sections }: PhaseProgressBarProps) {
  const currentPhaseIndex = phases.findIndex(p => p.id === currentPhase);

  // חישוב התקדמות לשלב data_collection (reflection)
  const getReflectionProgress = () => {
    if (!sections) return 0;
    const completed = Object.values(sections).filter(Boolean).length;
    const total = Object.values(sections).length;
    return Math.round((completed / total) * 100);
  };

  const getPhaseStatus = (phase: Phase) => {
    const phaseIndex = phase.order - 1;
    
    if (phaseIndex < currentPhaseIndex) {
      return 'completed';
    } else if (phaseIndex === currentPhaseIndex) {
      return 'current';
    } else {
      return 'locked';
    }
  };

  const getPhaseProgress = (phase: Phase) => {
    const status = getPhaseStatus(phase);
    
    if (status === 'completed') return 100;
    if (status === 'locked') return 0;
    
    // עבור שלב נוכחי
    if (phase.id === 'reflection' && sections) {
      return getReflectionProgress();
    }
    
    // ברירת מחדל לשלבים אחרים
    return 0;
  };

  return (
    <div className="bg-card-dark border border-theme rounded-2xl p-6 shadow-lg">
      <h3 className="text-xl font-bold text-theme-primary mb-4">מסלול ההבראה הפיננסית</h3>
      <p className="text-theme-secondary text-sm mb-6">
        5 שלבים להשגת בריאות פיננסית מלאה
      </p>

      <div className="space-y-4">
        {phases.map((phase, index) => {
          const status = getPhaseStatus(phase);
          const progress = getPhaseProgress(phase);
          const isLast = index === phases.length - 1;

          return (
            <div key={phase.id}>
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  status === 'completed' 
                    ? 'bg-green-500 dark:bg-green-600' 
                    : status === 'current'
                    ? 'bg-blue-500 dark:bg-blue-600'
                    : 'bg-gray-300 dark:bg-gray-700'
                }`}>
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : status === 'current' ? (
                    <Clock className="w-5 h-5 text-white" />
                  ) : (
                    <Lock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <h4 className={`font-bold ${
                        status === 'current' 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : status === 'completed'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-theme-tertiary'
                      }`}>
                        {phase.order}. {phase.name}
                      </h4>
                      <p className="text-sm text-theme-tertiary">{phase.description}</p>
                    </div>
                    {status !== 'locked' && (
                      <span className={`text-sm font-bold ${
                        status === 'completed' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {progress}%
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {status !== 'locked' && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          status === 'completed' 
                            ? 'bg-green-500 dark:bg-green-600' 
                            : 'bg-blue-500 dark:bg-blue-600'
                        }`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div className="mr-5 h-8 w-0.5 bg-gray-300 dark:bg-gray-700"></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

