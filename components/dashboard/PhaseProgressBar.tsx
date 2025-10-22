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
    <div className="bg-card-dark border border-theme rounded-2xl p-6 mb-8 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-theme-primary">מסלול ההבראה הפיננסית</h3>
          <p className="text-theme-secondary text-sm mt-1">
            5 שלבים להשגת בריאות פיננסית מלאה
          </p>
        </div>
        {currentPhaseIndex >= 0 && (
          <div className="text-left">
            <span className="text-sm text-theme-tertiary">שלב נוכחי:</span>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {phases[currentPhaseIndex]?.name}
            </p>
          </div>
        )}
      </div>

      {/* Horizontal Progress Bar */}
      <div className="relative">
        {/* Connection Line */}
        <div className="absolute top-5 right-0 left-0 h-0.5 bg-gray-300 dark:bg-gray-700" 
             style={{ right: '5%', left: '5%' }}></div>

        {/* Phases */}
        <div className="grid grid-cols-5 gap-2 relative">
          {phases.map((phase, index) => {
            const status = getPhaseStatus(phase);
            const progress = getPhaseProgress(phase);

            return (
              <div key={phase.id} className="flex flex-col items-center">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 z-10 transition-all duration-300 ${
                  status === 'completed' 
                    ? 'bg-green-500 dark:bg-green-600 shadow-lg shadow-green-500/50' 
                    : status === 'current'
                    ? 'bg-blue-500 dark:bg-blue-600 shadow-lg shadow-blue-500/50 ring-4 ring-blue-200 dark:ring-blue-800'
                    : 'bg-gray-300 dark:bg-gray-700'
                }`}>
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : status === 'current' ? (
                    <Clock className="w-5 h-5 text-white animate-pulse" />
                  ) : (
                    <Lock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </div>

                {/* Phase Info */}
                <div className="text-center">
                  <p className={`text-sm font-bold mb-1 ${
                    status === 'current' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : status === 'completed'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-theme-tertiary'
                  }`}>
                    {phase.name}
                  </p>
                  
                  {/* Progress Percentage */}
                  {status !== 'locked' && (
                    <span className={`text-xs font-semibold ${
                      status === 'completed' 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {progress}%
                    </span>
                  )}
                  
                  {/* Mini Progress Bar */}
                  {status === 'current' && progress > 0 && progress < 100 && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                      <div 
                        className="h-1.5 rounded-full transition-all duration-500 bg-blue-500 dark:bg-blue-600"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

