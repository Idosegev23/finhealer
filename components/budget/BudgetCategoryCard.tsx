'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface BudgetCategoryCardProps {
  categoryName: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  status: 'ok' | 'warning' | 'exceeded';
  icon?: string;
}

export default function BudgetCategoryCard({
  categoryName,
  allocatedAmount,
  spentAmount,
  remainingAmount,
  percentageUsed,
  status,
  icon = '📊'
}: BudgetCategoryCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'ok': return 'from-green-500 to-green-600';
      case 'warning': return 'from-yellow-500 to-yellow-600';
      case 'exceeded': return 'from-red-500 to-red-600';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'ok': return <CheckCircle className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'exceeded': return <TrendingUp className="w-5 h-5" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'ok': return 'תקין';
      case 'warning': return 'התקרב לגבול';
      case 'exceeded': return 'חריגה';
    }
  };

  const getProgressColor = () => {
    if (percentageUsed >= 100) return 'bg-red-500';
    if (percentageUsed >= 90) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 hover:shadow-xl transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getStatusColor()} flex items-center justify-center text-2xl shadow-lg`}>
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">{categoryName}</h3>
            <Badge variant="outline" className={`${
              status === 'ok' ? 'border-green-500 text-green-700 dark:text-green-400' :
              status === 'warning' ? 'border-yellow-500 text-yellow-700 dark:text-yellow-400' :
              'border-red-500 text-red-700 dark:text-red-400'
            } mt-1`}>
              {getStatusIcon()}
              <span className="mr-1">{getStatusText()}</span>
            </Badge>
          </div>
        </div>
        <div className="text-left">
          <p className="text-xs text-gray-500 dark:text-gray-400">הוצאו</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">
            {Math.round(percentageUsed)}%
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentageUsed, 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full ${getProgressColor()} rounded-full`}
          />
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">תקציב</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            ₪{allocatedAmount.toLocaleString()}
          </p>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">הוצאו</p>
          <p className={`text-sm font-bold ${
            status === 'exceeded' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
          }`}>
            ₪{spentAmount.toLocaleString()}
          </p>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">נותר</p>
          <p className={`text-sm font-bold ${
            remainingAmount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
          }`}>
            ₪{Math.abs(remainingAmount).toLocaleString()}
            {remainingAmount < 0 && ' -'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

