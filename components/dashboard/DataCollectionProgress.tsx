'use client';

import { CheckCircle, Circle } from 'lucide-react';

interface ProgressSection {
  category: string;
  subsections: {
    name: string;
    completed: boolean;
  }[];
}

interface DataCollectionProgressProps {
  sections: ProgressSection[];
  onComplete?: () => void;
}

export default function DataCollectionProgress({ sections, onComplete }: DataCollectionProgressProps) {
  // Calculate progress
  const totalSubsections = sections.reduce((sum, cat) => sum + cat.subsections.length, 0);
  const completedSubsections = sections.reduce(
    (sum, cat) => sum + cat.subsections.filter(s => s.completed).length, 
    0
  );
  const percentage = totalSubsections > 0 ? Math.round((completedSubsections / totalSubsections) * 100) : 0;
  const isComplete = percentage === 100;

  if (isComplete && onComplete) {
    onComplete();
  }

  return (
    <div className="bg-gradient-to-l from-[#E8F4FD] to-[#E8F5E9] rounded-xl p-6 border-2 border-[#3A7BD5]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#1E2A3B]">
          התקדמות איסוף נתונים 📊
        </h2>
        <div className="text-2xl font-bold text-[#3A7BD5]">
          {percentage}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-l from-[#3A7BD5] to-[#7ED957] transition-all duration-500 ease-out rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Summary */}
      <div className="text-center mb-6">
        <p className="text-sm text-[#555555]">
          השלמת <strong>{completedSubsections}</strong> מתוך <strong>{totalSubsections}</strong> רובריקות
        </p>
        {!isComplete && (
          <p className="text-xs text-[#888888] mt-2">
            💡 השלם את כל הרובריקות כדי לקבל תמונת מצב מלאה
          </p>
        )}
        {isComplete && (
          <div className="mt-4 p-4 bg-[#E8F5E9] border-2 border-[#7ED957] rounded-lg">
            <CheckCircle className="w-8 h-8 text-[#7ED957] mx-auto mb-2" />
            <p className="font-bold text-[#1E2A3B]">
              🎉 מעולה! השלמת את איסוף הנתונים!
            </p>
            <p className="text-sm text-[#555555] mt-1">
              עכשיו נוכל להתחיל לנתח ולספק לך תובנות מותאמות אישית
            </p>
          </div>
        )}
      </div>

      {/* Categories Breakdown */}
      <div className="space-y-4">
        {sections.map((category, idx) => {
          const catCompleted = category.subsections.filter(s => s.completed).length;
          const catTotal = category.subsections.length;
          const catPercentage = catTotal > 0 ? Math.round((catCompleted / catTotal) * 100) : 0;

          return (
            <div key={idx} className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[#1E2A3B]">{category.category}</h3>
                <span className="text-sm text-[#3A7BD5] font-medium">
                  {catCompleted}/{catTotal}
                </span>
              </div>
              <div className="space-y-2">
                {category.subsections.map((subsection, subIdx) => (
                  <div key={subIdx} className="flex items-center gap-2 text-sm">
                    {subsection.completed ? (
                      <CheckCircle className="w-4 h-4 text-[#7ED957] flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                    <span className={subsection.completed ? 'text-[#555555]' : 'text-[#888888]'}>
                      {subsection.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

