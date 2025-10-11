'use client';

import { motion } from 'framer-motion';
import { QuickOnboardingData } from '../QuickOnboardingWizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  data: QuickOnboardingData;
  updateData: (data: Partial<QuickOnboardingData>) => void;
}

const GOALS = [
  { id: 'save_apartment', label: 'לחסוך לדירה', icon: '🏠' },
  { id: 'control_spending', label: 'לשלוט בהוצאות', icon: '💰' },
  { id: 'reduce_debts', label: 'להקטין חובות', icon: '💳' },
  { id: 'save_family', label: 'לחסוך למשפחה', icon: '👨‍👩‍👧‍👦' },
  { id: 'financial_freedom', label: 'עצמאות כלכלית', icon: '✨' },
  { id: 'other', label: 'אחר', icon: '🎯' },
];

export function QuickStep1Basic({ data, updateData }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-secondary mb-2">
          בוא נכיר! 👋
        </h2>
        <p className="text-textMuted">
          רק כמה פרטים בסיסיים ואנחנו יוצאים לדרך
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">איך לקרוא לך?</Label>
        <Input
          id="name"
          type="text"
          placeholder="למשל: יוסי"
          value={data.name || ''}
          onChange={(e) => updateData({ name: e.target.value })}
          className="text-lg"
        />
        <p className="text-xs text-textMuted">
          נשתמש בזה כדי להפוך את החוויה אישית יותר
        </p>
      </div>

      {/* Primary Goal */}
      <div className="space-y-3">
        <Label>מה המטרה העיקרית שלך?</Label>
        <div className="grid grid-cols-2 gap-3">
          {GOALS.map((goal) => (
            <button
              key={goal.id}
              onClick={() => updateData({ primaryGoal: goal.id })}
              className={`
                relative p-4 rounded-xl border-2 transition-all text-right
                ${
                  data.primaryGoal === goal.id
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-gray-200 hover:border-primary/50 hover:bg-primary/5'
                }
              `}
            >
              <div className="text-2xl mb-2">{goal.icon}</div>
              <div className="text-sm font-medium text-secondary">
                {goal.label}
              </div>
              {data.primaryGoal === goal.id && (
                <div className="absolute top-2 left-2">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Encouragement */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-success/10 border border-success/20 rounded-lg p-4 text-center"
      >
        <p className="text-sm text-success font-medium">
          🎉 מעולה! זה הצעד הראשון לשליטה כלכלית
        </p>
      </motion.div>
    </motion.div>
  );
}

