'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Lock, BarChart3, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { ExpenseOption } from './ExpenseSelector';

interface AddCustomExpenseModalProps {
  onClose: () => void;
  onSuccess: (expense: ExpenseOption) => void;
}

export default function AddCustomExpenseModal({ onClose, onSuccess }: AddCustomExpenseModalProps) {
  const [name, setName] = useState('');
  const [expenseType, setExpenseType] = useState<'fixed' | 'variable' | 'special'>('variable');
  const [categoryGroup, setCategoryGroup] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const expenseTypes = [
    { value: 'fixed', label: 'קבועה', icon: Lock, description: 'הוצאה שחוזרת בסכום דומה כל חודש', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { value: 'variable', label: 'משתנה', icon: BarChart3, description: 'הוצאה שמשתנה מחודש לחודש', color: 'bg-green-50 border-green-200 text-green-700' },
    { value: 'special', label: 'מיוחדת', icon: Star, description: 'הוצאה חד-פעמית או נדירה', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('נא להזין שם להוצאה');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/expenses/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          expense_type: expenseType,
          category_group: categoryGroup.trim() || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create custom expense');
      }

      // Success!
      onSuccess(data.expense);

    } catch (err: any) {
      console.error('Error creating custom expense:', err);
      setError(err.message || 'אירעה שגיאה. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#1E2A3B]">
            הוסף הוצאה מותאמת
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <Label htmlFor="expense-name" className="text-[#1E2A3B] font-medium mb-2 block">
              שם ההוצאה *
            </Label>
            <Input
              id="expense-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל: מנוי למכון כושר, טיפול פיזיותרפיה..."
              className="text-right"
              autoFocus
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              בחר שם ברור שיעזור לך לזהות את ההוצאה בעתיד
            </p>
          </div>

          {/* Expense Type */}
          <div>
            <Label className="text-[#1E2A3B] font-medium mb-3 block">
              סוג ההוצאה *
            </Label>
            <div className="space-y-2">
              {expenseTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = expenseType === type.value;

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setExpenseType(type.value as any)}
                    className={`w-full flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? type.color + ' border-opacity-100'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isSelected ? '' : 'text-gray-400'}`} />
                    <div className="flex-1 text-right">
                      <div className={`font-semibold ${isSelected ? '' : 'text-gray-700'}`}>
                        {type.label}
                      </div>
                      <div className={`text-xs mt-0.5 ${isSelected ? 'opacity-90' : 'text-gray-500'}`}>
                        {type.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Group (Optional) */}
          <div>
            <Label htmlFor="category-group" className="text-[#1E2A3B] font-medium mb-2 block">
              קבוצת קטגוריה (אופציונלי)
            </Label>
            <Input
              id="category-group"
              type="text"
              value={categoryGroup}
              onChange={(e) => setCategoryGroup(e.target.value)}
              placeholder="למשל: בריאות, בילויים, חינוך..."
              className="text-right"
            />
            <p className="text-xs text-gray-500 mt-1">
              עוזר לארגן את ההוצאות בקטגוריות
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              ביטול
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#3A7BD5] hover:bg-[#2E5EA5]"
              disabled={loading}
            >
              {loading ? 'שומר...' : 'הוסף הוצאה'}
            </Button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs text-blue-800">
            <strong>💡 טיפ:</strong> ההוצאה המותאמת תישמר אצלך בלבד ותופיע בכל הרשימות שלך בעתיד.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

