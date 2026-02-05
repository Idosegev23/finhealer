'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import type { Goal } from '@/types/goals';

interface GoalsTimelineProps {
  goals: Goal[];
}

const GOAL_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  emergency_fund: { label: 'קרן חירום', emoji: '🛡️', color: '#8FBCBB' },
  debt_payoff: { label: 'סגירת חובות', emoji: '💳', color: '#BF616A' },
  savings_goal: { label: 'חיסכון', emoji: '🎯', color: '#A96B48' },
  vehicle: { label: 'רכב', emoji: '🚗', color: '#5E81AC' },
  vacation: { label: 'חופשה', emoji: '✈️', color: '#88C0D0' },
  renovation: { label: 'שיפוץ', emoji: '🏠', color: '#D08770' },
  real_estate_investment: { label: 'נכס', emoji: '🏘️', color: '#EBCB8B' },
  pension_increase: { label: 'פנסיה', emoji: '📈', color: '#A3BE8C' },
  child_savings: { label: 'חיסכון לילד', emoji: '👶', color: '#B48EAD' },
  family_savings: { label: 'משפחתי', emoji: '👨\u200d👩\u200d👧\u200d👦', color: '#81A1C1' },
  education: { label: 'לימודים', emoji: '📚', color: '#5E81AC' },
  wedding: { label: 'חתונה', emoji: '💒', color: '#B48EAD' },
  home_purchase: { label: 'דירה', emoji: '🏡', color: '#EBCB8B' },
  retirement: { label: 'פנסיה', emoji: '🌴', color: '#A3BE8C' },
  general_improvement: { label: 'שיפור', emoji: '⚖️', color: '#8FBCBB' },
  other: { label: 'אחר', emoji: '📦', color: '#4C566A' },
};

export function GoalsTimeline({ goals }: GoalsTimelineProps) {
  // חשב טווח זמנים
  const { minDate, maxDate, months } = useMemo(() => {
    const now = new Date();
    const dates = goals
      .filter(g => g.deadline)
      .map(g => new Date(g.deadline!).getTime());

    if (dates.length === 0) {
      // אין תאריכי יעד - הצג 12 חודשים קדימה
      const min = now.getTime();
      const max = new Date(now.getFullYear(), now.getMonth() + 12, 1).getTime();
      return {
        minDate: min,
        maxDate: max,
        months: generateMonthsList(min, max),
      };
    }

    const min = Math.min(now.getTime(), ...dates);
    const max = Math.max(...dates);

    return {
      minDate: min,
      maxDate: max,
      months: generateMonthsList(min, max),
    };
  }, [goals]);

  function generateMonthsList(start: number, end: number): Date[] {
    const months: Date[] = [];
    const current = new Date(start);
    current.setDate(1);

    while (current.getTime() <= end) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  function getGoalPosition(goal: Goal): { start: number; width: number } {
    const now = new Date();
    const startDate = goal.start_date ? new Date(goal.start_date) : now;
    const endDate = goal.deadline ? new Date(goal.deadline) : new Date(now.getFullYear(), now.getMonth() + 6, 1);

    const totalRange = maxDate - minDate;
    const start = ((startDate.getTime() - minDate) / totalRange) * 100;
    const end = ((endDate.getTime() - minDate) / totalRange) * 100;
    const width = end - start;

    return {
      start: Math.max(0, Math.min(100, start)),
      width: Math.max(2, Math.min(100 - start, width)),
    };
  }

  function isGoalOverdue(goal: Goal): boolean {
    if (!goal.deadline) return false;
    return new Date(goal.deadline) < new Date() && goal.status !== 'completed';
  }

  // מיין יעדים לפי תאריך סיום
  const sortedGoals = [...goals].sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-phi-gold" />
          ציר זמן יעדים (Timeline)
        </CardTitle>
      </CardHeader>
      <CardContent dir="rtl">
        {/* Header - Months */}
        <div className="mb-6 border-b pb-2">
          <div className="flex justify-between text-sm text-muted-foreground px-2">
            {months.map((month, idx) => (
              <div
                key={idx}
                className="flex-1 text-center"
                style={{ minWidth: `${100 / months.length}%` }}
              >
                {month.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' })}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Bars */}
        <div className="space-y-4">
          {sortedGoals.map((goal) => {
            const position = getGoalPosition(goal);
            const progress = goal.target_amount > 0
              ? (goal.current_amount / goal.target_amount) * 100
              : 0;
            const goalType = GOAL_TYPE_LABELS[goal.goal_type || 'other'];
            const isOverdue = isGoalOverdue(goal);

            return (
              <div key={goal.id} className="relative">
                {/* Goal Label */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{goalType.emoji}</span>
                  <span className="font-medium text-sm">{goal.name}</span>
                  <Badge variant={isOverdue ? 'destructive' : 'secondary'} className="text-xs">
                    {isOverdue ? 'באיחור' : `${Math.round(progress)}%`}
                  </Badge>
                  {goal.status === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </div>

                {/* Timeline Bar Container */}
                <div className="relative h-10 bg-phi-bg rounded-lg border border-phi-slate/20">
                  {/* Goal Bar */}
                  <div
                    className="absolute top-0 h-full rounded-lg transition-all duration-300 hover:shadow-md group cursor-pointer"
                    style={{
                      left: `${position.start}%`,
                      width: `${position.width}%`,
                      backgroundColor: goalType.color,
                      opacity: goal.status === 'completed' ? 0.5 : 0.85,
                    }}
                  >
                    {/* Progress Fill */}
                    <div
                      className="h-full rounded-lg"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: goalType.color,
                        opacity: 1,
                        borderRight: progress < 100 ? '2px solid white' : 'none',
                      }}
                    />

                    {/* Tooltip on Hover */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-phi-dark text-white text-xs rounded-lg p-3 shadow-lg whitespace-nowrap">
                        <div className="font-semibold mb-1">{goal.name}</div>
                        <div className="text-phi-frost/80">
                          {goal.current_amount.toLocaleString('he-IL')} / {goal.target_amount.toLocaleString('he-IL')} ₪
                        </div>
                        {goal.deadline && (
                          <div className="text-phi-frost/80">
                            יעד: {new Date(goal.deadline).toLocaleDateString('he-IL')}
                          </div>
                        )}
                        {goal.monthly_allocation && goal.monthly_allocation > 0 && (
                          <div className="text-phi-mint">
                            <TrendingUp className="w-3 h-3 inline mr-1" />
                            {goal.monthly_allocation.toLocaleString('he-IL')} ₪/חודש
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Current Date Marker */}
                  {(() => {
                    const now = new Date().getTime();
                    const nowPosition = ((now - minDate) / (maxDate - minDate)) * 100;
                    if (nowPosition >= 0 && nowPosition <= 100) {
                      return (
                        <div
                          className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
                          style={{ left: `${nowPosition}%` }}
                        >
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Goal Meta Info */}
                <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground px-2">
                  <div className="flex items-center gap-2">
                    {goal.start_date && (
                      <span>
                        התחלה: {new Date(goal.start_date).toLocaleDateString('he-IL')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {goal.deadline ? (
                      <>
                        <Clock className="w-3 h-3" />
                        <span>
                          יעד: {new Date(goal.deadline).toLocaleDateString('he-IL')}
                        </span>
                      </>
                    ) : (
                      <span className="text-phi-slate/50">אין תאריך יעד</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 pt-4 border-t">
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span>היום</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 bg-phi-gold rounded" />
              <span>התקדמות</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 bg-phi-gold/30 rounded" />
              <span>נותר</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <span>הושלם</span>
            </div>
          </div>
        </div>

        {goals.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>אין יעדים להצגה</p>
            <p className="text-sm">הוסף יעד ראשון כדי לראות את ציר הזמן</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
