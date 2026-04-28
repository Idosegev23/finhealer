'use client';

/**
 * Top-of-page status panel shown when an active budget exists. Answers
 * three questions the old layout didn't:
 *
 *   1. How am I doing this month? (% spent, days left, on-pace flag)
 *   2. What's already over budget? (red list)
 *   3. What's close to limit? (amber list)
 *
 * The old budget page jumped straight from KPI strip → tabs without
 * giving users a sense of urgency or what to look at first.
 */

import { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import { Card as DSCard } from '@/components/ui/design-system';

interface BudgetCategory {
  id: string;
  category_name: string;
  allocated_amount: number;
  spent_amount: number | null;
  remaining_amount: number | null;
  percentage_used: number | null;
  status?: string | null;
  is_flexible?: boolean | null;
}

interface BudgetStatusHeroProps {
  categories: BudgetCategory[];
  totalAllocated: number;
  monthLabel: string; // e.g. "אפריל 2026"
  onJumpToCategories: () => void;
}

const formatILS = (n: number) =>
  `₪${Math.round(n).toLocaleString('he-IL')}`;

function daysLeftInMonth(): { left: number; total: number; passedPercent: number } {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  return {
    left: Math.max(0, lastDay - today),
    total: lastDay,
    passedPercent: Math.round((today / lastDay) * 100),
  };
}

export function BudgetStatusHero({
  categories,
  totalAllocated,
  monthLabel,
  onJumpToCategories,
}: BudgetStatusHeroProps) {
  const days = useMemo(() => daysLeftInMonth(), []);

  const totalSpent = categories.reduce((s, c) => s + (Number(c.spent_amount) || 0), 0);
  const totalRemaining = Math.max(0, totalAllocated - totalSpent);
  const usedPercent = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

  // 'on pace' = spending should roughly match how much of the month has passed.
  // > +10% over the calendar pace → behind. > -10% under → ahead. else on-pace.
  const pace = days.passedPercent > 0 ? usedPercent - days.passedPercent : 0;
  const paceStatus: 'over' | 'on' | 'under' =
    pace > 10 ? 'over' : pace < -10 ? 'under' : 'on';

  const overBudget = categories
    .filter((c) => Number(c.spent_amount) > Number(c.allocated_amount))
    .sort(
      (a, b) =>
        Number(b.spent_amount) - Number(b.allocated_amount) -
        (Number(a.spent_amount) - Number(a.allocated_amount)),
    );

  const closeToLimit = categories
    .filter((c) => {
      const used = Number(c.percentage_used);
      return used >= 75 && Number(c.spent_amount) <= Number(c.allocated_amount);
    })
    .sort((a, b) => Number(b.percentage_used) - Number(a.percentage_used));

  const onTrack = categories.length - overBudget.length - closeToLimit.length;

  return (
    <DSCard padding="lg" className="mb-6 border-2 border-phi-gold/30">
      {/* Top row — month + days left + total status */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{monthLabel}</h2>
          <p className="text-xs text-phi-slate flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            נותרו {days.left} מתוך {days.total} ימים בחודש ({100 - days.passedPercent}%)
          </p>
        </div>

        <div
          className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 ${
            paceStatus === 'over'
              ? 'bg-red-50 text-phi-coral border border-red-200'
              : paceStatus === 'under'
              ? 'bg-emerald-50 text-phi-mint border border-emerald-200'
              : 'bg-sky-50 text-phi-dark border border-sky-200'
          }`}
        >
          {paceStatus === 'over' && <TrendingUp className="w-4 h-4" />}
          {paceStatus === 'under' && <TrendingDown className="w-4 h-4" />}
          {paceStatus === 'on' && <CheckCircle2 className="w-4 h-4" />}
          {paceStatus === 'over' && `מהיר ב-${pace}% מהקצב — שווה להאט`}
          {paceStatus === 'under' && `איטי ב-${Math.abs(pace)}% — מצוין, יש מרווח`}
          {paceStatus === 'on' && 'בקצב'}
        </div>
      </div>

      {/* Money bar — spent vs total */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <div className="text-xs text-phi-slate">הוצאת החודש</div>
            <div className="text-2xl font-bold text-phi-dark tabular-nums">
              {formatILS(totalSpent)}
              <span className="text-sm text-phi-slate font-normal mr-2">
                / {formatILS(totalAllocated)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-phi-slate">נותר</div>
            <div className="text-xl font-bold text-phi-mint tabular-nums">
              {formatILS(totalRemaining)}
            </div>
          </div>
        </div>
        <div className="h-2 bg-white rounded-full overflow-hidden relative">
          <div
            className={`h-full transition-all duration-300 ${
              usedPercent > 100 ? 'bg-phi-coral' :
              usedPercent > 80 ? 'bg-phi-gold' :
              'bg-phi-mint'
            }`}
            style={{ width: `${Math.min(usedPercent, 100)}%` }}
          />
          {/* Calendar pace marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-phi-dark"
            style={{ right: `${days.passedPercent}%` }}
            title={`קצב חודש: ${days.passedPercent}%`}
          />
        </div>
        <div className="flex justify-between text-[11px] text-phi-slate mt-1.5">
          <span>{usedPercent}% מההקצאה הוצא</span>
          <span>קו שחור = קצב לוח השנה ({days.passedPercent}%)</span>
        </div>
      </div>

      {/* Category status — 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {/* Over budget */}
        <div className={`rounded-lg p-3 border ${overBudget.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 opacity-70'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className={`w-4 h-4 ${overBudget.length > 0 ? 'text-phi-coral' : 'text-gray-400'}`} />
              <span className="text-xs font-semibold text-gray-900">חורגות</span>
            </div>
            <span className={`text-xs font-bold ${overBudget.length > 0 ? 'text-phi-coral' : 'text-gray-400'}`}>
              {overBudget.length}
            </span>
          </div>
          {overBudget.length === 0 ? (
            <p className="text-[11px] text-gray-500">אין קטגוריות שחורגות</p>
          ) : (
            <ul className="space-y-1.5">
              {overBudget.slice(0, 4).map((c) => {
                const over = Number(c.spent_amount) - Number(c.allocated_amount);
                return (
                  <li key={c.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-800 truncate flex-1 ml-2">{c.category_name}</span>
                    <span className="text-phi-coral font-medium tabular-nums flex-shrink-0">
                      +{formatILS(over)}
                    </span>
                  </li>
                );
              })}
              {overBudget.length > 4 && (
                <li className="text-[11px] text-phi-slate pt-1">
                  ועוד {overBudget.length - 4}…
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Close to limit */}
        <div className={`rounded-lg p-3 border ${closeToLimit.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200 opacity-70'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className={`w-4 h-4 ${closeToLimit.length > 0 ? 'text-phi-gold' : 'text-gray-400'}`} />
              <span className="text-xs font-semibold text-gray-900">קרוב לגבול</span>
            </div>
            <span className={`text-xs font-bold ${closeToLimit.length > 0 ? 'text-phi-gold' : 'text-gray-400'}`}>
              {closeToLimit.length}
            </span>
          </div>
          {closeToLimit.length === 0 ? (
            <p className="text-[11px] text-gray-500">אין קטגוריות בסיכון</p>
          ) : (
            <ul className="space-y-1.5">
              {closeToLimit.slice(0, 4).map((c) => (
                <li key={c.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-800 truncate flex-1 ml-2">{c.category_name}</span>
                  <span className="text-phi-gold font-medium tabular-nums flex-shrink-0">
                    {Math.round(Number(c.percentage_used))}%
                  </span>
                </li>
              ))}
              {closeToLimit.length > 4 && (
                <li className="text-[11px] text-phi-slate pt-1">
                  ועוד {closeToLimit.length - 4}…
                </li>
              )}
            </ul>
          )}
        </div>

        {/* On track */}
        <div className="rounded-lg p-3 border bg-emerald-50 border-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-phi-mint" />
              <span className="text-xs font-semibold text-gray-900">במסלול</span>
            </div>
            <span className="text-xs font-bold text-phi-mint">{onTrack}</span>
          </div>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            קטגוריות שמתחת ל-75% מההקצאה. אין סיבה לשנות אותן עכשיו.
          </p>
        </div>
      </div>

      {/* What to do next */}
      {(overBudget.length > 0 || closeToLimit.length > 0) && (
        <div className="bg-phi-dark/5 border border-phi-dark/10 rounded-lg p-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-phi-gold/20 flex items-center justify-center flex-shrink-0">
            <span className="text-phi-gold font-serif">φ</span>
          </div>
          <div className="flex-1 text-sm">
            <div className="font-medium text-gray-900 mb-0.5">מה כדאי לעשות עכשיו</div>
            <p className="text-xs text-gray-700 leading-relaxed">
              {overBudget.length > 0 && (
                <>
                  בקטגוריות החורגות, או צריך לחתוך הוצאה עד סוף החודש, או להעלות את ההקצאה אם זה צורך אמיתי.
                </>
              )}
              {overBudget.length > 0 && closeToLimit.length > 0 && ' '}
              {closeToLimit.length > 0 && (
                <>
                  בקטגוריות הקרובות לגבול, שווה להפחית את הקצב כדי לא לחרוג.
                </>
              )}
            </p>
          </div>
          <button
            onClick={onJumpToCategories}
            className="text-xs font-medium text-phi-dark hover:underline flex items-center gap-1 flex-shrink-0 self-center"
          >
            לערוך
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </DSCard>
  );
}
