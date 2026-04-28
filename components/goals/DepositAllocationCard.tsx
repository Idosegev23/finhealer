'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertTriangle, Check, Pencil, X } from 'lucide-react';
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

interface AllocationResult {
  total_deposit: number;
  total_allocated: number;
  unallocated: number;
  total_required: number;
  is_underfunded: boolean;
  allocations: AllocationItem[];
  warnings: string[];
  monthly_savings_target?: number;
}

const formatILS = (n: number) =>
  `₪${Math.round(n).toLocaleString('he-IL')}`;

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
  const hasGoals = data.allocations.length > 0;

  return (
    <DSCard padding="lg" className="mb-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-phi-gold" />
            חלוקת ההפקדה החודשית
          </h3>
          <p className="text-sm text-phi-slate mt-1">
            הזן סכום אחד שאתה מפקיד בחודש — המערכת מחלקת אותו ליעדים לפי עדיפות ודחיפות
          </p>
        </div>
      </div>

      {editing ? (
        <div className="flex items-center gap-2 mb-4">
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
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-3xl font-bold text-phi-dark tabular-nums">
            {formatILS(target)}
          </span>
          <span className="text-sm text-phi-slate">בחודש</span>
          <button
            onClick={startEdit}
            className="text-xs text-phi-dark hover:underline flex items-center gap-1 mr-auto"
          >
            <Pencil className="w-3 h-3" />
            ערוך
          </button>
        </div>
      )}

      {!hasGoals && (
        <p className="text-sm text-phi-slate bg-gray-50 rounded-lg p-3">
          אין יעדים פעילים. הוסף יעד חדש כדי שהמערכת תחלק את ההפקדה אוטומטית.
        </p>
      )}

      {hasGoals && target === 0 && (
        <p className="text-sm text-phi-coral bg-amber-50 border border-amber-200 rounded-lg p-3">
          הגדר את סכום ההפקדה החודשית שלך כדי לראות איך הוא מתחלק.
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

          <div className="space-y-2">
            {data.allocations.map((a) => (
              <div key={a.goal_id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{a.goal_name}</p>
                    <p className="text-xs text-phi-slate truncate">{a.reasoning}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-phi-dark tabular-nums">{formatILS(a.allocated)}</p>
                    <p className="text-xs text-phi-slate tabular-nums">{a.share_percent.toFixed(0)}%</p>
                  </div>
                </div>
                <div className="h-1.5 bg-white rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      a.shortfall > 0.5 ? 'bg-phi-coral' : 'bg-phi-mint'
                    }`}
                    style={{ width: `${Math.min(a.share_percent, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center text-sm">
            <span className="text-phi-slate">סה״כ מוקצה</span>
            <span className="font-semibold text-phi-dark tabular-nums">
              {formatILS(data.total_allocated)}
              {data.unallocated > 0.5 && (
                <span className="text-phi-slate text-xs mr-2">
                  · יתרה לא משויכת {formatILS(data.unallocated)}
                </span>
              )}
            </span>
          </div>
        </>
      )}
    </DSCard>
  );
}
