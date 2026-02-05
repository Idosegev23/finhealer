'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { GripVertical, Star, Calendar, TrendingUp, Save } from 'lucide-react';
import type { Goal } from '@/types/goals';

interface GoalsDragListProps {
  goals: Goal[];
  onSave: (reorderedGoals: Goal[]) => Promise<void>;
  onClose: () => void;
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

function SortableGoalItem({ goal, index }: { goal: Goal; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const progress = goal.target_amount > 0 
    ? Math.round((goal.current_amount / goal.target_amount) * 100)
    : 0;
  const goalType = GOAL_TYPE_LABELS[goal.goal_type || 'other'];

  return (
    <div ref={setNodeRef} style={style} className="mb-3">
      <Card className={`${isDragging ? 'shadow-lg border-phi-gold' : 'hover:border-phi-gold/50'} transition-all`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing touch-none"
            >
              <GripVertical className="w-6 h-6 text-phi-slate hover:text-phi-gold transition-colors" />
            </div>

            {/* Priority Badge */}
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-phi-gold/10 border-2 border-phi-gold/30">
              <span className="font-bold text-lg text-phi-dark">{index + 1}</span>
            </div>

            {/* Goal Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{goalType.emoji}</span>
                <h3 className="font-semibold text-phi-dark">{goal.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  {goalType.label}
                </Badge>
              </div>

              {/* Progress */}
              <div className="space-y-1">
                <Progress value={progress} className="h-1.5" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{goal.current_amount.toLocaleString('he-IL')} ₪</span>
                  <span>{progress}%</span>
                  <span>{goal.target_amount.toLocaleString('he-IL')} ₪</span>
                </div>
              </div>

              {/* Meta Info */}
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                {goal.deadline && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(goal.deadline).toLocaleDateString('he-IL')}</span>
                  </div>
                )}
                {goal.monthly_allocation && goal.monthly_allocation > 0 && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span>{goal.monthly_allocation.toLocaleString('he-IL')} ₪/חודש</span>
                  </div>
                )}
              </div>
            </div>

            {/* Old Priority (for reference) */}
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">עדיפות מקורית</div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{goal.priority}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function GoalsDragList({ goals, onSave, onClose }: GoalsDragListProps) {
  const [items, setItems] = useState(goals);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
      setHasChanges(true);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      // עדכן עדיפויות לפי הסדר החדש (1 = הכי חשוב)
      const reorderedGoals = items.map((goal, index) => ({
        ...goal,
        priority: index + 1,
      }));

      await onSave(reorderedGoals);
      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('Error saving priorities:', error);
      alert('שגיאה בשמירת עדיפויות');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-phi-gold/10 to-phi-mint/10 p-4 rounded-lg border border-phi-gold/30">
        <h3 className="text-lg font-semibold text-phi-dark mb-2">
          🎯 סדר עדיפויות - גרור ושנה
        </h3>
        <p className="text-sm text-phi-slate">
          גרור יעדים למעלה או למטה כדי לשנות את סדר העדיפויות.
          <br />
          היעד העליון הוא בעדיפות הגבוהה ביותר (1).
        </p>
      </div>

      {/* Sortable List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map(g => g.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {items.map((goal, index) => (
              <SortableGoalItem key={goal.id} goal={goal} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          ביטול
        </Button>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-phi-slate">
              ⚡ יש שינויים שלא נשמרו
            </span>
          )}
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || isSaving}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'שומר...' : 'שמור עדיפויות'}
          </Button>
        </div>
      </div>
    </div>
  );
}
