'use client';

import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface PhaseProgressProps {
  currentPhase: string;
}

// Phase order: data_collection → behavior → goals → budget → monitoring
// (Goals before Budget per Gadi's methodology — need to know targets before setting budget that supports them.)
const phases = [
  { key: 'data_collection', label: 'איסוף נתונים', description: 'העלאת דוחות וסיווג' },
  { key: 'behavior', label: 'התנהלות', description: 'זיהוי דפוסים' },
  { key: 'goals', label: 'יעדים', description: 'הגדרת מטרות' },
  { key: 'budget', label: 'תקציב', description: 'בניית תקציב מבוסס יעדים' },
  { key: 'monitoring', label: 'ניטור', description: 'בקרה רציפה' }
];

const phaseMessages = {
  data_collection: {
    title: 'מתחילים! 🚀',
    description: 'שלח דוחות בנק/אשראי, ואני אסווג ואצור תמונה ברורה',
    nextStep: 'שלח דוח בוואטסאפ',
    daysUntil: 0
  },
  behavior: {
    title: 'מנתחים דפוסים... 📊',
    description: 'מזהים הרגלי הוצאה. מתחילים להבין את התמונה האמיתית',
    nextStep: 'המשך להעלות דוחות',
    daysUntil: 0
  },
  goals: {
    title: 'בואו נגדיר יעדים 🎯',
    description: 'מה אתה רוצה להשיג? חיסכון לרכב, חופשה, סגירת חוב',
    nextStep: 'הוסף יעד',
    daysUntil: 0
  },
  budget: {
    title: 'בונים תקציב שתומך ביעדים 💡',
    description: 'תקציב חכם שמותאם בדיוק לכמה שאתה צריך לחיסכון',
    nextStep: 'אשר תקציב',
    daysUntil: 0
  },
  monitoring: {
    title: 'אתה במעקב מלא! ✨',
    description: 'אני עוקב אחרי ההוצאות והיעדים, ואעדכן על חריגות והזדמנויות',
    nextStep: 'המשך להתקדם',
    daysUntil: 0
  }
};

export default function PhaseProgress({ currentPhase }: PhaseProgressProps) {
  // Legacy compat: treat any old "reflection" phase as data_collection
  const normalizedPhase = currentPhase === 'reflection' ? 'data_collection' : currentPhase;
  const currentIndex = phases.findIndex(p => p.key === normalizedPhase);
  const message = phaseMessages[normalizedPhase as keyof typeof phaseMessages] || phaseMessages.data_collection;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-[#1E2A3B] mb-2">איפה אני במסע?</h3>
      <p className="text-sm text-[#555555] mb-6">{message.title}</p>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute right-[19px] top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        <div className="space-y-4">
          {phases.map((phase, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isPending = index > currentIndex;

            return (
              <div key={phase.key} className="relative flex items-start gap-3">
                <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  isCompleted 
                    ? 'bg-phi-mint border-phi-mint' 
                    : isCurrent
                    ? 'bg-phi-dark border-[#3A7BD5]'
                    : 'bg-white border-gray-300'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : isCurrent ? (
                    <Clock className="w-5 h-5 text-white" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                
                <div className="flex-1 pt-1">
                  <p className={`font-semibold ${
                    isCurrent ? 'text-phi-dark' : isCompleted ? 'text-phi-mint' : 'text-gray-400'
                  }`}>
                    {phase.label}
                  </p>
                  <p className="text-xs text-[#555555]">{phase.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Step */}
      <div className="mt-6 p-4 bg-[#E3F2FD] rounded-lg">
        <p className="text-sm font-medium text-[#1E2A3B] mb-1">{message.description}</p>
        <div className="flex items-center justify-between mt-3">
          <button className="text-sm font-semibold text-phi-dark hover:underline">
            {message.nextStep} →
          </button>
          {message.daysUntil > 0 && (
            <span className="text-xs text-[#555555]">
              עוד {message.daysUntil} ימים
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


