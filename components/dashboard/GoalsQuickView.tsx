'use client';

import { Target, Sparkles, TrendingUp, Plus } from 'lucide-react';
import Link from 'next/link';

interface GoalsQuickViewProps {
  profile: any;
  activeGoals: any[];
}

export default function GoalsQuickView({ profile, activeGoals }: GoalsQuickViewProps) {
  const hasGoals = activeGoals && activeGoals.length > 0;
  const hasProfileGoals = profile?.short_term_goal || profile?.long_term_dream;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#1E2A3B] flex items-center gap-2">
          <Target className="w-5 h-5 text-[#3A7BD5]" />
          המטרות שלך
        </h3>
        <Link 
          href="/goals"
          className="text-sm text-[#3A7BD5] hover:underline font-medium"
        >
          ניהול מלא →
        </Link>
      </div>

      {/* יעדים פעילים */}
      {hasGoals ? (
        <div className="space-y-3 mb-4">
          {activeGoals.slice(0, 3).map((goal) => {
            const progress = goal.target_amount > 0 
              ? (goal.current_amount / goal.target_amount) * 100 
              : 0;

            return (
              <div key={goal.id} className="p-3 bg-[#F5F6F8] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {goal.child_name && (
                      <span className="text-sm">👶</span>
                    )}
                    <span className="text-sm font-medium text-[#1E2A3B]">
                      {goal.name}
                      {goal.child_name && (
                        <span className="text-xs text-[#555555] mr-1">({goal.child_name})</span>
                      )}
                    </span>
                  </div>
                  <span className="text-xs text-[#555555]">
                    {progress.toFixed(0)}%
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-[#7ED957] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-xs text-[#555555]">
                  <span>{goal.current_amount.toLocaleString('he-IL')} ₪</span>
                  <span>{goal.target_amount.toLocaleString('he-IL')} ₪</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : hasProfileGoals ? (
        // אם יש מטרות בפרופיל אבל עוד לא נוצרו יעדים
        <div className="space-y-3 mb-4">
          {profile.short_term_goal && (
            <div className="p-4 bg-[#E3F2FD] rounded-lg border-r-4 border-[#3A7BD5]">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-[#3A7BD5] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#1E2A3B] mb-1">מטרה קצרה</p>
                  <p className="text-xs text-[#555555]">{profile.short_term_goal}</p>
                  <button className="text-xs text-[#3A7BD5] font-medium mt-2 hover:underline">
                    צור יעד לחיסכון →
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {profile.long_term_dream && (
            <div className="p-4 bg-[#FFF3E0] rounded-lg border-r-4 border-[#F6A623]">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-[#F6A623] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#1E2A3B] mb-1">החלום הגדול</p>
                  <p className="text-xs text-[#555555]">{profile.long_term_dream}</p>
                  <button className="text-xs text-[#F6A623] font-medium mt-2 hover:underline">
                    צור תוכנית →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // אם אין בכלל מטרות
        <div className="py-8 text-center">
          <div className="w-16 h-16 bg-[#F5F6F8] rounded-full flex items-center justify-center mx-auto mb-3">
            <Target className="w-8 h-8 text-[#555555]" />
          </div>
          <p className="text-sm text-[#555555] mb-4">עדיין לא הגדרת יעדים</p>
          <Link 
            href="/goals"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#3A7BD5] text-white rounded-full text-sm font-medium hover:bg-[#2E5EA5] transition-colors"
          >
            <Plus className="w-4 h-4" />
            הוסף יעד ראשון
          </Link>
        </div>
      )}

      {/* סטטיסטיקה */}
      {hasGoals && (
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#555555]">סה&quot;כ חיסכון ביעדים:</span>
            <span className="font-bold text-[#7ED957] flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              {activeGoals.reduce((sum, g) => sum + (g.current_amount || 0), 0).toLocaleString('he-IL')} ₪
            </span>
          </div>
        </div>
      )}
    </div>
  );
}


