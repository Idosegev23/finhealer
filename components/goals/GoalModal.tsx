'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Goal, GoalType, BudgetSource } from '@/types/goals';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goal: Partial<Goal>) => Promise<void>;
  goal?: Goal | null;
  userId: string;
}

const GOAL_TYPES: { value: GoalType; label: string; emoji: string }[] = [
  { value: 'emergency_fund', label: 'קרן חירום', emoji: '🛡️' },
  { value: 'debt_payoff', label: 'סגירת חובות', emoji: '💳' },
  { value: 'savings_goal', label: 'חיסכון למטרה', emoji: '🎯' },
  { value: 'vehicle', label: 'רכב', emoji: '🚗' },
  { value: 'vacation', label: 'חופשה', emoji: '✈️' },
  { value: 'renovation', label: 'שיפוץ דירה', emoji: '🏠' },
  { value: 'real_estate_investment', label: 'נכס להשקעה', emoji: '🏘️' },
  { value: 'pension_increase', label: 'הגדלת פנסיה', emoji: '📈' },
  { value: 'child_savings', label: 'חיסכון לילד', emoji: '👶' },
  { value: 'family_savings', label: 'חיסכון משפחתי', emoji: '👨\u200d👩\u200d👧\u200d👦' },
  { value: 'education', label: 'לימודים', emoji: '📚' },
  { value: 'wedding', label: 'חתונה', emoji: '💒' },
  { value: 'home_purchase', label: 'רכישת דירה', emoji: '🏡' },
  { value: 'retirement', label: 'פנסיה', emoji: '🌴' },
  { value: 'general_improvement', label: 'שיפור כללי', emoji: '⚖️' },
  { value: 'other', label: 'אחר', emoji: '📦' },
];

const BUDGET_SOURCES: { value: BudgetSource; label: string }[] = [
  { value: 'income', label: 'הכנסה שוטפת' },
  { value: 'bonus', label: 'בונוס/פרמיה' },
  { value: 'sale', label: 'מכירת נכס' },
  { value: 'inheritance', label: 'ירושה' },
  { value: 'other', label: 'אחר' },
];

export function GoalModal({ isOpen, onClose, onSave, goal, userId }: GoalModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    goal_type: 'savings_goal' as GoalType,
    target_amount: '',
    deadline: '',
    priority: '5',
    budget_source: 'income' as BudgetSource,
    funding_notes: '',
    goal_group: '',
  });

  useEffect(() => {
    if (goal) {
      setFormData({
        name: goal.name || '',
        goal_type: goal.goal_type || 'savings_goal',
        target_amount: goal.target_amount?.toString() || '',
        deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '',
        priority: goal.priority?.toString() || '5',
        budget_source: goal.budget_source || 'income',
        funding_notes: goal.funding_notes || '',
        goal_group: goal.goal_group || '',
      });
    } else {
      setFormData({
        name: '',
        goal_type: 'savings_goal',
        target_amount: '',
        deadline: '',
        priority: '5',
        budget_source: 'income',
        funding_notes: '',
        goal_group: '',
      });
    }
  }, [goal, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const goalData: Partial<Goal> = {
        name: formData.name,
        goal_type: formData.goal_type,
        target_amount: parseFloat(formData.target_amount) || 0,
        deadline: formData.deadline || null,
        priority: parseInt(formData.priority) || 5,
        budget_source: formData.budget_source,
        funding_notes: formData.funding_notes || null,
        goal_group: formData.goal_group || null,
        user_id: userId,
        status: 'active',
        is_flexible: true,
        min_allocation: 0,
        monthly_allocation: 0,
        auto_adjust: true,
      };

      if (goal) {
        goalData.id = goal.id;
      }

      await onSave(goalData);
      onClose();
    } catch (error) {
      console.error('Error saving goal:', error);
      alert('שגיאה בשמירת היעד');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {goal ? 'עריכת יעד' : 'יעד חדש'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* סוג יעד */}
          <div className="space-y-2">
            <Label htmlFor="goal_type">סוג יעד *</Label>
            <Select
              value={formData.goal_type}
              onValueChange={(value) => setFormData({ ...formData, goal_type: value as GoalType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.emoji} {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* שם יעד */}
          <div className="space-y-2">
            <Label htmlFor="name">שם היעד *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="לדוגמה: רכב חדש, חופשה משפחתית"
              required
            />
          </div>

          {/* סכום יעד */}
          <div className="space-y-2">
            <Label htmlFor="target_amount">סכום יעד (₪) *</Label>
            <Input
              id="target_amount"
              type="number"
              value={formData.target_amount}
              onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
              placeholder="0"
              min="0"
              step="100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* תאריך יעד */}
            <div className="space-y-2">
              <Label htmlFor="deadline">תאריך יעד</Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              />
            </div>

            {/* עדיפות */}
            <div className="space-y-2">
              <Label htmlFor="priority">עדיפות (1-10) *</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                min="1"
                max="10"
                required
              />
              <p className="text-xs text-muted-foreground">1 = הכי חשוב, 10 = הכי פחות חשוב</p>
            </div>
          </div>

          {/* מקור תקציב */}
          <div className="space-y-2">
            <Label htmlFor="budget_source">מקור מימון</Label>
            <Select
              value={formData.budget_source}
              onValueChange={(value) => setFormData({ ...formData, budget_source: value as BudgetSource })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUDGET_SOURCES.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* קיבוץ */}
          <div className="space-y-2">
            <Label htmlFor="goal_group">קבוצת יעדים (אופציונלי)</Label>
            <Input
              id="goal_group"
              value={formData.goal_group}
              onChange={(e) => setFormData({ ...formData, goal_group: e.target.value })}
              placeholder="לדוגמה: ילדים, נדל״ן, רכבים"
            />
            <p className="text-xs text-muted-foreground">
              לקיבוץ יעדים דומים (ילדים, נדל״ן, רכבים וכו׳)
            </p>
          </div>

          {/* הערות */}
          <div className="space-y-2">
            <Label htmlFor="funding_notes">הערות נוספות</Label>
            <Textarea
              id="funding_notes"
              value={formData.funding_notes}
              onChange={(e) => setFormData({ ...formData, funding_notes: e.target.value })}
              placeholder="פרטים נוספים על מקור המימון או היעד"
              rows={3}
            />
          </div>

          {/* כפתורים */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              ביטול
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'שומר...' : goal ? 'שמור שינויים' : 'צור יעד'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
