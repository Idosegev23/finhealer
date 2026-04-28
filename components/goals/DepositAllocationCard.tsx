'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  Check,
  Pencil,
  X,
  Wallet,
  Target,
  TrendingUp,
  Calendar,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { Card as DSCard } from '@/components/ui/design-system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AllocationItem {
  goal_id: string;
  goal_name: string;
  priority: number;
  deadline: string | null;
  target_amount: number;
  current_amount: number;
  remaining: number;
  months_remaining: number | null;
  monthly_required: number;
  urgency_score: number;
  allocated: number;
  shortfall: number;
  share_percent: number;
  reasoning: string;
}

interface AllocationContext {
  total_current: number;
  total_target: number;
  remaining_to_goals: number;
  progress_percent: number;
  savings_account_count: number;
  savings_balance: number;
  savings_balance_source: 'savings_accounts' | 'profile_manual' | 'none';
  accounts_monthly_deposit: number;
  monthly_income: number;
  monthly_fixed_expenses: number;
}

interface AllocationResult {
  total_deposit: number;
  total_allocated: number;
  unallocated: number;
  total_required: number;
  is_underfunded: boolean;
  allocations: AllocationItem[];
  warnings: string[];
  monthly_savings_target?: number;
  context?: AllocationContext;
}

const formatILS = (n: number) =>
  `₪${Math.round(n).toLocaleString('he-IL')}`;

// "8 חודשים" / "שנה" / "שנתיים" / "3 שנים"
function formatMonths(m: number | null): string {
  if (m == null || m <= 0) return '—';
  const months = Math.round(m);
  if (months < 12) return `${months} ${months === 1 ? 'חודש' : 'חודשים'}`;
  const years = Math.round(months / 12);
  if (years === 1) return 'שנה';
  if (years === 2) return 'שנתיים';
  return `${years} שנים`;
}

function projectedMonthsToFinish(remaining: number, monthlyDeposit: number): number | null {
  if (monthlyDeposit <= 0) return null;
  if (remaining <= 0) return 0;
  return remaining / monthlyDeposit;
}

export function DepositAllocationCard() {
  const [data, setData] = useState<AllocationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftAmount, setDraftAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async (overrideAmount?: number) => {
    setLoading(true);
    try {
      const res = overrideAmount != null
        ? await fetch('/api/goals/allocate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: overrideAmount }),
          })
        : await fetch('/api/goals/allocate');
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = () => {
    setDraftAmount(String(data?.monthly_savings_target ?? data?.total_deposit ?? 0));
    setEditing(true);
  };

  const saveTarget = async () => {
    const n = Number(draftAmount);
    if (!Number.isFinite(n) || n < 0) return;
    setSaving(true);
    try {
      await fetch('/api/profile/savings-target', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_savings_target: n }),
      });
      setEditing(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DSCard padding="lg" className="flex items-center justify-center min-h-[120px]">
        <Loader2 className="w-6 h-6 animate-spin text-phi-slate" />
      </DSCard>
    );
  }

  if (!data) return null;

  const target = data.monthly_savings_target ?? 0;
  const ctx = data.context;
  const hasGoals = data.allocations.length > 0;
  const monthsToFinishAll = ctx ? projectedMonthsToFinish(ctx.remaining_to_goals, target) : null;

  return (
    <DSCard padding="lg" className="mb-6">
      {/* Headline */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-phi-gold" />
            איך הכסף שלך נחלק ליעדים
          </h3>
          <p className="text-sm text-phi-slate mt-1">
            הזן הפקדה חודשית אחת — Phi מחלק אותה אוטומטית לפי עדיפות, דדליין, וצורך
          </p>
        </div>
      </div>

      {/* Top KPI strip — saved / target / progress / months to finish */}
      {ctx && hasGoals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-emerald-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs text-phi-mint mb-1">
              <Wallet className="w-3.5 h-3.5" />
              כבר נצבר ביעדים
            </div>
            <div className="text-xl font-bold text-phi-mint tabular-nums">
              {formatILS(ctx.total_current)}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {ctx.progress_percent}% מהיעד הכולל
            </div>
          </div>

          <div className="bg-sky-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs text-phi-dark mb-1">
              <Target className="w-3.5 h-3.5" />
              סך היעד
            </div>
            <div className="text-xl font-bold text-phi-dark tabular-nums">
              {formatILS(ctx.total_target)}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              חסר {formatILS(ctx.remaining_to_goals)}
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs text-phi-coral mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              הפקדה חודשית
            </div>
            <div className="text-xl font-bold text-phi-coral tabular-nums">
              {formatILS(target)}
            </div>
            {ctx.savings_balance > 0 && ctx.savings_balance_source === 'savings_accounts' && (
              <div className="text-[11px] text-gray-500 mt-0.5">
                מתוך יתרה {formatILS(ctx.savings_balance)}
              </div>
            )}
          </div>

          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs text-purple-700 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              עד סיום כל היעדים
            </div>
            <div className="text-xl font-bold text-purple-700">
              {monthsToFinishAll == null ? '—' : formatMonths(monthsToFinishAll)}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              בקצב הפקדה הנוכחי
            </div>
          </div>
        </div>
      )}

      {/* Edit deposit */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">הפקדה חודשית:</span>
            <Input
              type="number"
              min="0"
              step="100"
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
              placeholder="3000"
              className="max-w-[200px]"
              autoFocus
            />
            <Button onClick={saveTarget} disabled={saving} className="bg-phi-mint hover:bg-phi-mint/90 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs text-phi-slate mb-0.5">ההפקדה החודשית שלך</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-phi-dark tabular-nums">
                  {formatILS(target)}
                </span>
                <span className="text-xs text-phi-slate">לחודש</span>
              </div>
            </div>
            {ctx && ctx.savings_balance > 0 && (
              <div className="text-xs text-gray-600 max-w-[280px]">
                💰 יתרה זמינה {formatILS(ctx.savings_balance)}
                {ctx.savings_account_count > 0 &&
                  ` ב-${ctx.savings_account_count} ${ctx.savings_account_count === 1 ? 'חשבון' : 'חשבונות'}`}.
                {ctx.accounts_monthly_deposit > 0 && target === 0 && (
                  <span className="block mt-1 text-phi-coral">
                    💡 בחשבונות מוגדרת הפקדה {formatILS(ctx.accounts_monthly_deposit)} — שווה להזין כאן
                  </span>
                )}
              </div>
            )}
            <button
              onClick={startEdit}
              className="text-xs text-phi-dark hover:underline flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              ערוך
            </button>
          </div>
        )}
      </div>

      {!hasGoals && (
        <div className="text-center py-6 text-phi-slate bg-amber-50 border border-amber-200 rounded-lg">
          <Info className="w-6 h-6 mx-auto mb-2 text-phi-coral" />
          <p className="text-sm">אין עדיין יעדים פעילים</p>
          <p className="text-xs mt-1">הוסף יעד למטה ונתחיל לחלק את ההפקדה לפי עדיפות ודדליין</p>
        </div>
      )}

      {hasGoals && target === 0 && (
        <p className="text-sm text-phi-coral bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          הגדר את סכום ההפקדה החודשית למעלה כדי לראות איך הוא יתחלק.
        </p>
      )}

      {hasGoals && target > 0 && (
        <>
          {data.is_underfunded && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex gap-2 items-start">
              <AlertTriangle className="w-4 h-4 text-phi-coral flex-shrink-0 mt-0.5" />
              <div className="text-xs text-gray-700 space-y-1">
                {data.warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            </div>
          )}

          {/* Per-goal breakdown table */}
          <div className="space-y-2">
            {data.allocations.map((a) => {
              const remainingForGoal = a.target_amount - a.current_amount;
              const monthsAtAllocated = a.allocated > 0
                ? remainingForGoal / a.allocated
                : null;
              const goalProgress = a.target_amount > 0
                ? (a.current_amount / a.target_amount) * 100
                : 0;

              return (
                <div key={a.goal_id} className="bg-gray-50 rounded-lg p-3">
                  {/* Top row: name + amount */}
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        href="/dashboard/goals"
                        className="font-medium text-gray-900 hover:text-phi-dark hover:underline truncate block"
                      >
                        {a.goal_name}
                      </Link>
                      <div className="text-xs text-phi-slate mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>עדיפות {a.priority}</span>
                        {a.deadline && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>דדליין: {new Date(a.deadline).toLocaleDateString('he-IL')}</span>
                          </>
                        )}
                        {a.shortfall > 0.5 && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-phi-coral">חסר {formatILS(a.shortfall)} לעמידה בדדליין</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-phi-dark tabular-nums">
                        {formatILS(a.allocated)}
                      </div>
                      <div className="text-[11px] text-phi-slate tabular-nums">
                        {a.share_percent.toFixed(0)}% מההפקדה
                      </div>
                    </div>
                  </div>

                  {/* Saved-vs-target line */}
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-600 tabular-nums">
                      נצבר {formatILS(a.current_amount)} מתוך {formatILS(a.target_amount)}
                    </span>
                    <span className="text-phi-slate tabular-nums">
                      {goalProgress.toFixed(0)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-white rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-phi-mint"
                      style={{ width: `${Math.min(goalProgress, 100)}%` }}
                    />
                  </div>

                  {/* ETA at the chosen deposit pace */}
                  {monthsAtAllocated != null && (
                    <div className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      בקצב {formatILS(a.allocated)}/חודש: {formatMonths(monthsAtAllocated)} עד היעד
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer totals */}
          <div className="mt-4 pt-3 border-t border-gray-200 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-phi-slate">סה״כ מוקצה הפקדה</span>
              <span className="font-semibold text-phi-dark tabular-nums">
                {formatILS(data.total_allocated)} / {formatILS(target)}
              </span>
            </div>
            {data.unallocated > 0.5 && (
              <div className="flex justify-between items-center mt-1 text-xs">
                <span className="text-phi-slate">לא משויך</span>
                <span className="text-phi-coral tabular-nums">
                  {formatILS(data.unallocated)} — שווה להוסיף יעד או להגדיל יעד קיים
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </DSCard>
  );
}
