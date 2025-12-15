'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FinancialOverviewProps {
  profile: any;
  monthlyExpenses: number;
  userId?: string;
  onRefresh?: () => void;
}

export default function FinancialOverview({ 
  profile, 
  monthlyExpenses,
  userId,
  onRefresh 
}: FinancialOverviewProps) {
  const totalIncome = profile?.total_monthly_income || 0;
  const totalFixed = profile?.total_fixed_expenses || 0;
  const availableBudget = totalIncome - totalFixed - monthlyExpenses;
  const utilizationRate = totalIncome > 0 ? ((totalFixed + monthlyExpenses) / totalIncome) * 100 : 0;
  
  // Animation states
  const [displayedIncome, setDisplayedIncome] = useState(0);
  const [displayedFixed, setDisplayedFixed] = useState(0);
  const [displayedExpenses, setDisplayedExpenses] = useState(0);
  const [displayedBudget, setDisplayedBudget] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animate numbers when they change
  useEffect(() => {
    setIsAnimating(true);
    const duration = 800;
    const startTime = Date.now();
    
    const startIncome = displayedIncome;
    const startFixed = displayedFixed;
    const startExpenses = displayedExpenses;
    const startBudget = displayedBudget;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      
      setDisplayedIncome(Math.round(startIncome + (totalIncome - startIncome) * eased));
      setDisplayedFixed(Math.round(startFixed + (totalFixed - startFixed) * eased));
      setDisplayedExpenses(Math.round(startExpenses + (monthlyExpenses - startExpenses) * eased));
      setDisplayedBudget(Math.round(startBudget + (availableBudget - startBudget) * eased));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };
    
    requestAnimationFrame(animate);
  }, [totalIncome, totalFixed, monthlyExpenses, availableBudget]);

  return (
    <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3A7BD5] to-[#2E5EA5] flex items-center justify-center shadow-md">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1E2A3B]">סקירה פיננסית</h3>
            <p className="text-xs text-gray-500">מצב כספי נוכחי</p>
          </div>
        </div>
        
        {/* Refresh indicator */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="רענון נתונים"
          >
            <RefreshCw className={`w-4 h-4 ${isAnimating ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Main Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* הכנסות */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 p-4 transition-all hover:shadow-md hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-200/20 rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm">
                <ArrowUpRight className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium text-emerald-700">הכנסות</span>
            </div>
            <motion.p 
              key={totalIncome}
              initial={{ opacity: 0.5, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-2xl font-bold text-gray-900 mb-1"
            >
              {displayedIncome.toLocaleString('he-IL')}
              <span className="text-sm font-normal text-gray-500 mr-1">₪</span>
            </motion.p>
            <p className="text-xs text-gray-500">חודשי</p>
          </div>
        </div>

        {/* הוצאות קבועות */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 p-4 transition-all hover:shadow-md hover:scale-[1.02]">
          <div className="absolute top-0 left-0 w-20 h-20 bg-orange-200/20 rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shadow-sm">
                <ArrowDownRight className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium text-orange-700">קבועות</span>
            </div>
            <motion.p 
              key={totalFixed}
              initial={{ opacity: 0.5, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-2xl font-bold text-gray-900 mb-1"
            >
              {displayedFixed.toLocaleString('he-IL')}
              <span className="text-sm font-normal text-gray-500 mr-1">₪</span>
            </motion.p>
            <p className="text-xs text-gray-500">הוצאות</p>
          </div>
        </div>

        {/* הוצאות משתנות */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-gray-100 p-4 transition-all hover:shadow-md hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-20 h-20 bg-slate-200/20 rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-slate-600 flex items-center justify-center shadow-sm">
                <TrendingDown className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium text-slate-700">משתנות</span>
            </div>
            <motion.p 
              key={monthlyExpenses}
              initial={{ opacity: 0.5, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-2xl font-bold text-gray-900 mb-1"
            >
              {displayedExpenses.toLocaleString('he-IL')}
              <span className="text-sm font-normal text-gray-500 mr-1">₪</span>
            </motion.p>
            <p className="text-xs text-gray-500">החודש</p>
          </div>
        </div>

        {/* ניצול */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 p-4 transition-all hover:shadow-md hover:scale-[1.02]">
          <div className="absolute top-0 left-0 w-20 h-20 bg-violet-200/20 rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center shadow-sm">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium text-violet-700">ניצול</span>
            </div>
            <p className={`text-2xl font-bold mb-1 ${utilizationRate > 90 ? 'text-red-600' : 'text-gray-900'}`}>
              {utilizationRate.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500">מההכנסות</p>
          </div>
        </div>
      </div>

      {/* Available Budget - Hero Card */}
      <div className={`relative overflow-hidden rounded-2xl p-6 transition-all ${
        availableBudget >= 0
          ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30'
          : 'bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30'
      }`}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>

        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/90 text-sm font-medium mb-1">תקציב פנוי</p>
              <div className="flex items-baseline gap-2">
                <motion.span 
                  key={availableBudget}
                  initial={{ opacity: 0.5, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-4xl font-bold text-white"
                >
                  {Math.abs(displayedBudget).toLocaleString('he-IL')}
                </motion.span>
                <span className="text-xl text-white/80">₪</span>
              </div>
            </div>

            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              {availableBudget >= 0 ? (
                <TrendingUp className="w-8 h-8 text-white" />
              ) : (
                <TrendingDown className="w-8 h-8 text-white" />
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-white/80">מצב כספי</span>
              <span className="text-xs text-white/80">
                {availableBudget >= 0 ? 'יציב ✓' : 'דורש התייחסות'}
              </span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-full bg-white/90 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(utilizationRate, 100)}%` }}
              />
            </div>
          </div>

          {/* Alert */}
          {utilizationRate > 90 && (
            <div className="mt-4 p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
              <p className="text-xs text-white/90 leading-relaxed">
                ⚠️ שים לב: ניצלת יותר מ-90% מההכנסה החודשית
              </p>
            </div>
          )}
          {availableBudget < 0 && (
            <div className="mt-4 p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
              <p className="text-xs text-white/90 leading-relaxed">
                🚨 התקציב החופשי שלילי - מומלץ לבצע התאמות בהוצאות
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


