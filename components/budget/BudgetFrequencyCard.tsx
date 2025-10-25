'use client';

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

interface BudgetFrequencyCardProps {
  type: 'fixed' | 'temporary' | 'special' | 'one_time';
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  transactionCount: number;
  status: 'ok' | 'warning' | 'exceeded';
}

const FREQUENCY_CONFIG = {
  fixed: {
    label: 'הוצאות קבועות',
    icon: '🔄',
    description: 'חוזרות כל חודש',
    color: 'from-blue-500 to-blue-600',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  },
  temporary: {
    label: 'הוצאות זמניות',
    icon: '⏱️',
    description: 'לתקופה מוגבלת',
    color: 'from-yellow-500 to-yellow-600',
    badgeColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  },
  special: {
    label: 'הוצאות מיוחדות',
    icon: '⭐',
    description: 'לא תכופות אך חשובות',
    color: 'from-purple-500 to-purple-600',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
  },
  one_time: {
    label: 'הוצאות חד פעמיות',
    icon: '1️⃣',
    description: 'רכישות חד פעמיות',
    color: 'from-gray-500 to-gray-600',
    badgeColor: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  }
};

export default function BudgetFrequencyCard({
  type,
  allocatedAmount,
  spentAmount,
  remainingAmount,
  percentageUsed,
  transactionCount,
  status
}: BudgetFrequencyCardProps) {
  const config = FREQUENCY_CONFIG[type];

  const getProgressColor = () => {
    if (percentageUsed >= 100) return 'bg-red-500';
    if (percentageUsed >= 90) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${config.color} flex items-center justify-center text-3xl shadow-lg`}>
          {config.icon}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            {config.label}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {config.description}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {Math.round(percentageUsed)}% בשימוש
          </span>
          <Badge className={config.badgeColor}>
            {transactionCount} תנועות
          </Badge>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentageUsed, 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
            className={`h-full ${getProgressColor()} rounded-full`}
          />
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">תקציב</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            ₪{allocatedAmount.toLocaleString()}
          </p>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">הוצאו</p>
          <p className={`text-lg font-bold ${
            status === 'exceeded' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
          }`}>
            ₪{spentAmount.toLocaleString()}
          </p>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">נותר</p>
          <p className={`text-lg font-bold ${
            remainingAmount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
          }`}>
            ₪{Math.abs(remainingAmount).toLocaleString()}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

