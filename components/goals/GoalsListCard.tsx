'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Pencil, 
  Trash2, 
  TrendingUp, 
  Calendar,
  DollarSign,
  Star,
  ArrowUpDown,
  Plus
} from 'lucide-react';
import type { Goal } from '@/types/goals';

interface GoalsListCardProps {
  goals: Goal[];
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onReorder?: (goals: Goal[]) => void;
  onDeposit?: (goal: Goal) => void;
}

const GOAL_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  emergency_fund: { label: 'קרן חירום', emoji: '🛡️' },
  debt_payoff: { label: 'סגירת חובות', emoji: '💳' },
  savings_goal: { label: 'חיסכון', emoji: '🎯' },
  vehicle: { label: 'רכב', emoji: '🚗' },
  vacation: { label: 'חופשה', emoji: '✈️' },
  renovation: { label: 'שיפוץ', emoji: '🏠' },
  real_estate_investment: { label: 'נכס', emoji: '🏘️' },
  pension_increase: { label: 'פנסיה', emoji: '📈' },
  child_savings: { label: 'חיסכון לילד', emoji: '👶' },
  family_savings: { label: 'משפחתי', emoji: '👨\u200d👩\u200d👧\u200d👦' },
  education: { label: 'לימודים', emoji: '📚' },
  wedding: { label: 'חתונה', emoji: '💒' },
  home_purchase: { label: 'דירה', emoji: '🏡' },
  retirement: { label: 'פנסיה', emoji: '🌴' },
  general_improvement: { label: 'שיפור', emoji: '⚖️' },
  other: { label: 'אחר', emoji: '📦' },
};

export function GoalsListCard({ goals, onEdit, onDelete, onReorder, onDeposit }: GoalsListCardProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (goalId: string, goalName: string) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את היעד "${goalName}"?`)) {
      return;
    }

    setDeletingId(goalId);
    try {
      await onDelete(goalId);
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('שגיאה במחיקת היעד');
    } finally {
      setDeletingId(null);
    }
  };

  const sortedGoals = [...goals].sort((a, b) => (a.priority || 5) - (b.priority || 5));

  // קיבוץ יעדים לפי goal_group
  const groupedGoals = sortedGoals.reduce((acc, goal) => {
    const group = goal.goal_group || 'ללא קבוצה';
    if (!acc[group]) acc[group] = [];
    acc[group].push(goal);
    return acc;
  }, {} as Record<string, Goal[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedGoals).map(([groupName, groupGoals]) => (
        <Card key={groupName}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>{groupName}</span>
              <Badge variant="outline">{groupGoals.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {groupGoals.map((goal) => {
                const progress = goal.target_amount > 0 
                  ? Math.round((goal.current_amount / goal.target_amount) * 100)
                  : 0;
                const goalType = GOAL_TYPE_LABELS[goal.goal_type || 'other'];

                return (
                  <div
                    key={goal.id}
                    className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{goalType.emoji}</span>
                          <h3 className="font-semibold text-lg">{goal.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {goalType.label}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-2">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span>עדיפות {goal.priority}</span>
                          </div>

                          {goal.deadline && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(goal.deadline).toLocaleDateString('he-IL')}</span>
                            </div>
                          )}

                          {goal.monthly_allocation && goal.monthly_allocation > 0 && (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-4 h-4 text-green-500" />
                              <span>{goal.monthly_allocation.toLocaleString('he-IL')} ₪/חודש</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {onDeposit && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => onDeposit(goal)}
                            className="bg-phi-gold hover:bg-phi-dark"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            הפקדה
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEdit(goal)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(goal.id, goal.name)}
                          disabled={deletingId === goal.id}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">
                          {goal.current_amount.toLocaleString('he-IL')} ₪
                        </span>
                        <span className="text-muted-foreground">
                          מתוך {goal.target_amount.toLocaleString('he-IL')} ₪
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{progress}% הושלם</span>
                        {goal.target_amount > goal.current_amount && (
                          <span>
                            נותרו {(goal.target_amount - goal.current_amount).toLocaleString('he-IL')} ₪
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Budget Source */}
                    {goal.budget_source && (
                      <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          מקור: {goal.funding_notes || goal.budget_source}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {goals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">אין יעדים עדיין</p>
            <p className="text-sm">לחץ על ״יעד חדש״ ליצירת יעד ראשון</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
