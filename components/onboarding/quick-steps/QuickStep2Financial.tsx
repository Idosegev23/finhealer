'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { QuickOnboardingData } from '../QuickOnboardingWizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  data: QuickOnboardingData;
  updateData: (data: Partial<QuickOnboardingData>) => void;
}

export function QuickStep2Financial({ data, updateData }: Props) {
  const [showDebtAmount, setShowDebtAmount] = useState(data.hasDebts || false);
  const [showSavingsAmount, setShowSavingsAmount] = useState(data.hasSavings || false);

  const handleDebtToggle = (hasDebts: boolean) => {
    setShowDebtAmount(hasDebts);
    updateData({ hasDebts, debtAmount: hasDebts ? data.debtAmount : undefined });
  };

  const handleSavingsToggle = (hasSavings: boolean) => {
    setShowSavingsAmount(hasSavings);
    updateData({ hasSavings, savingsAmount: hasSavings ? data.savingsAmount : undefined });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 bg-white rounded-xl shadow-sm p-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          תמונה כלכלית בסיסית 💼
        </h2>
        <p className="text-gray-600">
          נתונים משוערים לגמרי - רק כדי לקבל תמונה ראשונית
        </p>
      </div>

      {/* Monthly Income */}
      <div className="space-y-2">
        <Label htmlFor="income">הכנסה חודשית (משוערת)</Label>
        <div className="relative">
          <Input
            id="income"
            type="number"
            placeholder="10,000"
            value={data.monthlyIncome || ''}
            onChange={(e) => updateData({ monthlyIncome: Number(e.target.value) })}
            className="text-lg pr-12"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted">
            ₪
          </span>
        </div>
        <p className="text-xs text-textMuted">
          כולל כל מקורות ההכנסה (עבודה, עצמאי, השכרה וכו&apos;)
        </p>
      </div>

      {/* Debts */}
      <div className="space-y-3">
        <Label>יש לך חובות?</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleDebtToggle(false)}
            className={`
              p-4 rounded-xl border-2 transition-all
              ${
                data.hasDebts === false
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
              }
            `}
          >
            <div className="text-2xl mb-1">✅</div>
            <div className="text-sm font-medium text-gray-900">לא</div>
          </button>
          <button
            onClick={() => handleDebtToggle(true)}
            className={`
              p-4 rounded-xl border-2 transition-all
              ${
                data.hasDebts === true
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
              }
            `}
          >
            <div className="text-2xl mb-1">💳</div>
            <div className="text-sm font-medium text-gray-900">כן</div>
          </button>
        </div>

        {showDebtAmount && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <Label htmlFor="debtAmount">כמה בערך? (משוער)</Label>
            <div className="relative">
              <Input
                id="debtAmount"
                type="number"
                placeholder="50,000"
                value={data.debtAmount || ''}
                onChange={(e) => updateData({ debtAmount: Number(e.target.value) })}
                className="pr-12"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted">
                ₪
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Savings */}
      <div className="space-y-3">
        <Label>יש לך חסכונות / קרנות?</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleSavingsToggle(false)}
            className={`
              p-4 rounded-xl border-2 transition-all
              ${
                data.hasSavings === false
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }
            `}
          >
            <div className="text-2xl mb-1">💰</div>
            <div className="text-sm font-medium text-gray-900">עדיין לא</div>
          </button>
          <button
            onClick={() => handleSavingsToggle(true)}
            className={`
              p-4 rounded-xl border-2 transition-all
              ${
                data.hasSavings === true
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
              }
            `}
          >
            <div className="text-2xl mb-1">💎</div>
            <div className="text-sm font-medium text-gray-900">כן</div>
          </button>
        </div>

        {showSavingsAmount && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <Label htmlFor="savingsAmount">כמה בערך? (משוער)</Label>
            <div className="relative">
              <Input
                id="savingsAmount"
                type="number"
                placeholder="20,000"
                value={data.savingsAmount || ''}
                onChange={(e) => updateData({ savingsAmount: Number(e.target.value) })}
                className="pr-12"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted">
                ₪
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Encouragement */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center"
      >
        <p className="text-sm text-blue-700 font-medium">
          💪 כל דרך מתחילה במקום כלשהו - אתה כבר בדרך!
        </p>
      </motion.div>
    </motion.div>
  );
}

