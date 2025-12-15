'use client';

/**
 * Pending Transactions Widget
 * מציג תנועות ממתינות לסיווג עם Real-time updates
 */

import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, MessageCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRealtimePendingTransactions } from './hooks/useRealtimeData';
import { motion, AnimatePresence } from 'framer-motion';

interface PendingTransactionsProps {
  userId: string;
  whatsappLink?: string;
}

export function PendingTransactions({ userId, whatsappLink }: PendingTransactionsProps) {
  const { 
    pending, 
    pendingCount, 
    isLoading, 
    lastUpdate,
    refetch 
  } = useRealtimePendingTransactions(userId);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Show nothing if no pending transactions
  if (!isLoading && pendingCount === 0) {
    return (
      <div className="bg-phi-mint/10 border border-phi-mint/30 rounded-xl p-4" dir="rtl">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-phi-mint" />
          <div>
            <h3 className="font-semibold text-phi-dark">כל התנועות מסווגות!</h3>
            <p className="text-sm text-phi-slate">אין תנועות ממתינות לסיווג</p>
          </div>
        </div>
      </div>
    );
  }

  // Group pending by type
  const pendingIncome = pending.filter(tx => tx.type === 'income');
  const pendingExpenses = pending.filter(tx => tx.type === 'expense');

  const totalPendingAmount = pending.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="bg-white border border-phi-frost rounded-xl shadow-sm overflow-hidden" dir="rtl">
      {/* Header */}
      <div 
        className="p-4 bg-gradient-to-l from-phi-coral/10 to-white cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-phi-coral/20 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-phi-coral" />
            </div>
            <div>
              <h3 className="font-bold text-phi-dark flex items-center gap-2">
                {pendingCount} תנועות ממתינות
                <motion.span
                  key={pendingCount}
                  initial={{ scale: 1.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center justify-center w-6 h-6 text-xs bg-phi-coral text-white rounded-full"
                >
                  {pendingCount}
                </motion.span>
              </h3>
              <p className="text-sm text-phi-slate">
                סה״כ {totalPendingAmount.toLocaleString('he-IL')} ₪ לסיווג
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              className="text-phi-slate hover:text-phi-dark"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-phi-slate" />
            ) : (
              <ChevronDown className="w-5 h-5 text-phi-slate" />
            )}
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 border-t border-phi-frost">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {pendingIncome.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-600 mb-1">הכנסות</p>
                    <p className="font-bold text-green-700">
                      {pendingIncome.length} תנועות
                    </p>
                    <p className="text-sm text-green-600">
                      {pendingIncome.reduce((s, t) => s + t.amount, 0).toLocaleString('he-IL')} ₪
                    </p>
                  </div>
                )}
                {pendingExpenses.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs text-red-600 mb-1">הוצאות</p>
                    <p className="font-bold text-red-700">
                      {pendingExpenses.length} תנועות
                    </p>
                    <p className="text-sm text-red-600">
                      {pendingExpenses.reduce((s, t) => s + t.amount, 0).toLocaleString('he-IL')} ₪
                    </p>
                  </div>
                )}
              </div>

              {/* Transaction List (first 5) */}
              <div className="space-y-2 mb-4">
                {pending.slice(0, 5).map((tx, index) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-2 bg-phi-bg/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        tx.type === 'income' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="text-sm text-phi-dark">
                        {tx.vendor || tx.description || 'תנועה'}
                      </span>
                    </div>
                    <span className={`text-sm font-medium ${
                      tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.type === 'income' ? '+' : '-'}
                      {tx.amount.toLocaleString('he-IL')} ₪
                    </span>
                  </motion.div>
                ))}
                
                {pending.length > 5 && (
                  <p className="text-center text-sm text-phi-slate py-2">
                    ועוד {pending.length - 5} תנועות...
                  </p>
                )}
              </div>

              {/* CTA */}
              {whatsappLink && (
                <a 
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white gap-2">
                    <MessageCircle className="w-4 h-4" />
                    סווג בוואטסאפ
                  </Button>
                </a>
              )}

              {/* Last Update */}
              {lastUpdate && (
                <p className="text-xs text-phi-slate text-center mt-3">
                  עדכון אחרון: {lastUpdate.toLocaleTimeString('he-IL')}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

