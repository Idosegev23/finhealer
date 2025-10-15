'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import ExpenseSelector, { ExpenseOption } from '@/components/shared/ExpenseSelector';

interface Props {
  onClose: () => void;
  employmentStatus?: 'employee' | 'self_employed' | 'both';
}

export function QuickExpenseForm({ onClose, employmentStatus }: Props) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [expenseType, setExpenseType] = useState<'fixed' | 'variable' | 'special' | null>(null);
  const [categoryGroup, setCategoryGroup] = useState<string | null>(null);
  const [vendor, setVendor] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      alert('נא להזין סכום תקין');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          amount: parseFloat(amount),
          category: category || 'כללי',
          expense_type: expenseType,
          category_group: categoryGroup,
          vendor: vendor || null,
          source: 'manual',
          status: 'confirmed',
          auto_categorized: false,
          date: new Date().toISOString().split('T')[0],
        }),
      });

      if (!response.ok) throw new Error('Failed to save transaction');

      // Success!
      alert('✅ ההוצאה נשמרה בהצלחה!');
      onClose();
      
      // Refresh the page to show new transaction
      window.location.reload();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('❌ שגיאה בשמירת ההוצאה. נסה שוב.');
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
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-secondary flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-primary" />
            הוצאה מהירה
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">סכום *</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="150"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg pr-10"
                autoFocus
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted">
                ₪
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">קטגוריה</Label>
            <ExpenseSelector
              value={category}
              onChange={(expense: ExpenseOption) => {
                setCategory(expense.name);
                setExpenseType(expense.expense_type);
                setCategoryGroup(expense.category_group || null);
              }}
              employmentStatus={employmentStatus}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor">איפה? (אופציונלי)</Label>
            <Input
              id="vendor"
              type="text"
              placeholder="למשל: סופר, תחנת דלק..."
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
          </div>

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
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'שומר...' : 'שמור'}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

