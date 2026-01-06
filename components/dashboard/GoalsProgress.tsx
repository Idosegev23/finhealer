'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Target, Plus, TrendingUp } from 'lucide-react'

interface Goal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  goal_type: string
}

interface GoalsProgressProps {
  goals: Goal[]
  className?: string
}

const getGoalIcon = (type: string) => {
  switch (type) {
    case 'emergency_fund': return '🛡️'
    case 'debt_reduction': return '💳'
    case 'specific_savings': return '🎯'
    default: return '⚖️'
  }
}

export function GoalsProgress({ goals, className = '' }: GoalsProgressProps) {
  const activeGoals = goals.filter(g => g.current_amount < g.target_amount)
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-phi-frost ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-phi-dark flex items-center gap-2">
          <Target className="w-5 h-5 text-phi-gold" />
          היעדים שלך
        </h3>
        <Link 
          href="/dashboard/goals"
          className="text-phi-gold hover:text-phi-coral text-sm font-medium flex items-center gap-1 transition"
        >
          <Plus className="w-4 h-4" />
          יעד חדש
        </Link>
      </div>

      {activeGoals.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-phi-frost/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-phi-slate" />
          </div>
          <p className="text-phi-slate mb-4">עדיין לא הגדרת יעדים</p>
          <Link
            href="/dashboard/goals"
            className="inline-flex items-center gap-2 bg-phi-gold text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-phi-coral transition"
          >
            <Plus className="w-4 h-4" />
            הגדר יעד ראשון
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {activeGoals.slice(0, 3).map((goal, index) => {
            const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
            
            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getGoalIcon(goal.goal_type)}</span>
                    <span className="font-medium text-phi-dark text-sm">{goal.name}</span>
                  </div>
                  <span className="text-xs text-phi-slate">
                    {Math.round(progress)}%
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="h-2 bg-phi-frost rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-l from-phi-gold to-phi-mint rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                  />
                </div>

                {/* Amounts */}
                <div className="flex justify-between mt-1 text-xs text-phi-slate">
                  <span>{formatCurrency(goal.current_amount)}</span>
                  <span>{formatCurrency(goal.target_amount)}</span>
                </div>
              </motion.div>
            )
          })}

          {activeGoals.length > 3 && (
            <Link
              href="/dashboard/goals"
              className="block text-center text-sm text-phi-gold hover:text-phi-coral transition mt-4"
            >
              ראה עוד {activeGoals.length - 3} יעדים →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

