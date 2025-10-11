'use client';

import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface PhaseProgressProps {
  currentPhase: string;
}

const phases = [
  { key: 'reflection', label: 'שיקוף עבר', description: 'איסוף מידע ראשוני' },
  { key: 'behavior', label: 'התנהלות', description: 'זיהוי דפוסים' },
  { key: 'budget', label: 'תקציב', description: 'הקמת תקציב חכם' },
  { key: 'goals', label: 'יעדים', description: 'הגדרת מטרות' },
  { key: 'monitoring', label: 'ניטור', description: 'בקרה רציפה' }
];

const phaseMessages = {
  reflection: {
    title: 'שלב ההתחלה הושלם! 🎉',
    description: 'עכשיו נתחיל לעקוב אחרי ההוצאות שלך ולזהות דפוסים',
    nextStep: 'רשום הוצאות יומיות',
    daysUntil: 30
  },
  behavior: {
    title: 'אוספים נתונים... 📊',
    description: 'המשך לרשום הוצאות. עוד מעט נציע לך תקציב מותאם אישית',
    nextStep: 'המשך לרשום הוצאות',
    daysUntil: 23
  },
  budget: {
    title: 'הגיע הזמן לתקציב! 💡',
    description: 'יש לנו מספיק נתונים להציע לך תקציב חכם',
    nextStep: 'הגדר תקציב',
    daysUntil: 0
  },
  goals: {
    title: 'תקציב הוגדר ✅',
    description: 'בואו נגדיר יעדים שרוצים להשיג',
    nextStep: 'הוסף יעדים',
    daysUntil: 0
  },
  monitoring: {
    title: 'אתה במעקב מלא! 🚀',
    description: 'המערכת עוקבת אחריך ותעדכן אותך על כל חריגה או הזדמנות',
    nextStep: 'המשך להתקדם',
    daysUntil: 0
  }
};

export default function PhaseProgress({ currentPhase }: PhaseProgressProps) {
  const currentIndex = phases.findIndex(p => p.key === currentPhase);
  const message = phaseMessages[currentPhase as keyof typeof phaseMessages] || phaseMessages.reflection;

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
                    ? 'bg-[#7ED957] border-[#7ED957]' 
                    : isCurrent
                    ? 'bg-[#3A7BD5] border-[#3A7BD5]'
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
                    isCurrent ? 'text-[#3A7BD5]' : isCompleted ? 'text-[#7ED957]' : 'text-gray-400'
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
          <button className="text-sm font-semibold text-[#3A7BD5] hover:underline">
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


