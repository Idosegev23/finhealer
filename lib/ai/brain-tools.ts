/**
 * Brain Tools — read-only data lookups the AI can call mid-conversation via Gemini function calling.
 *
 * The point: ground φ's answers in real DB facts so it never hallucinates a number.
 * When a user asks "כמה אני משלם על מנויים?" the brain calls `get_subscriptions()`
 * and gets a real answer, instead of guessing or having to pre-load every possible
 * data slice into the system prompt.
 *
 * All tools are READ-ONLY. Side-effect actions (log_expense, set_goal, show_summary, …)
 * stay on the existing JSON action routing — function calling is for grounding only.
 */

import { Type } from '@google/genai';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Tool declarations — what Gemini sees and can call
// ============================================================================

export const BRAIN_TOOL_DECLARATIONS = [
  {
    name: 'get_loans',
    description: 'Returns the user\'s active loans (mortgage, personal, credit). Use when the user asks about debts, monthly loan payments, or you want to suggest consolidation.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_subscriptions',
    description: 'Returns recurring monthly charges identified as subscriptions (Netflix, gym, software). Use when the user asks about subscriptions or you want to flag forgotten ones.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_baseline_for_category',
    description: 'Returns the user\'s average monthly spend in a given category over the last N months. Use when comparing current spending to "normal" for that user.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: 'Category name in Hebrew, exactly as stored (e.g. "מסעדות", "קניות סופר", "דלק")' },
        months: { type: Type.INTEGER, description: 'How many recent months to average over. Default 3.' },
      },
      required: ['category'],
    },
  },
  {
    name: 'compare_to_last_month',
    description: 'Returns this-month vs last-month spend per category, with the largest deltas at the top. Use when the user asks "איך אני עומד החודש?" or you want to surface anomalies.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        topN: { type: Type.INTEGER, description: 'How many categories to return (sorted by absolute delta). Default 5.' },
      },
    },
  },
  {
    name: 'find_unusual_expenses',
    description: 'Returns single transactions in the current month that are unusually large compared to typical spending in their category. Use to flag anomalies the user might not have noticed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        thresholdRatio: { type: Type.NUMBER, description: 'How many times the category average a transaction must exceed to count as unusual. Default 2.5.' },
      },
    },
  },
  {
    name: 'get_phi_score',
    description: 'Returns the user\'s current φ Score (0-100) and the breakdown by component (savings, on-budget, goal-progress, debt-load).',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'check_duplicates',
    description: 'Returns transactions flagged as suspected duplicates (same date, similar amount, similar vendor). Use when the user asks "יש כפילויות?" or you want to flag billing errors.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
] as const;

// ============================================================================
// Tool execution — what each tool actually does
// ============================================================================

export type ToolName = typeof BRAIN_TOOL_DECLARATIONS[number]['name'];

export async function executeBrainTool(
  userId: string,
  name: string,
  args: Record<string, any> = {}
): Promise<unknown> {
  const supabase = createServiceClient();

  switch (name) {
    case 'get_loans': {
      const { data: loans } = await supabase
        .from('loans')
        .select('lender, original_amount, current_balance, monthly_payment, interest_rate, remaining_payments, loan_type')
        .eq('user_id', userId)
        .neq('status', 'closed');
      return {
        loans: (loans || []).map(l => ({
          lender: l.lender,
          type: l.loan_type,
          balance: Number(l.current_balance) || 0,
          monthly_payment: Number(l.monthly_payment) || 0,
          interest_rate: Number(l.interest_rate) || null,
          remaining_payments: l.remaining_payments,
        })),
        total_monthly: (loans || []).reduce((s, l) => s + (Number(l.monthly_payment) || 0), 0),
        count: loans?.length || 0,
      };
    }

    case 'get_subscriptions': {
      // Recurring transactions in current month with same vendor + similar amount
      const { data: tx } = await supabase
        .from('transactions')
        .select('vendor, amount, category, expense_category, tx_date')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .eq('type', 'expense')
        .or('is_summary.is.null,is_summary.eq.false')
        .gte('tx_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

      // Group by vendor; if appeared 2+ months and amount stable, treat as subscription
      const groups = new Map<string, Array<{ amount: number; month: string }>>();
      for (const t of tx || []) {
        const v = (t.vendor || '').trim().toLowerCase();
        if (!v) continue;
        const month = (t.tx_date || '').slice(0, 7);
        const existing = groups.get(v);
        if (existing) existing.push({ amount: Math.abs(Number(t.amount)), month });
        else groups.set(v, [{ amount: Math.abs(Number(t.amount)), month }]);
      }

      const subs: Array<{ vendor: string; monthly: number; months_seen: number }> = [];
      for (const [vendor, hits] of Array.from(groups.entries())) {
        const months = new Set(hits.map(h => h.month));
        if (months.size < 2) continue;
        const avg = hits.reduce((s, h) => s + h.amount, 0) / hits.length;
        const variance = Math.max(...hits.map(h => Math.abs(h.amount - avg))) / Math.max(avg, 1);
        if (variance < 0.15) {
          subs.push({ vendor, monthly: Math.round(avg), months_seen: months.size });
        }
      }

      subs.sort((a, b) => b.monthly - a.monthly);
      return {
        subscriptions: subs,
        total_monthly: subs.reduce((s, x) => s + x.monthly, 0),
        count: subs.length,
      };
    }

    case 'get_baseline_for_category': {
      const category = String(args.category || '').trim();
      const months = Math.max(1, Math.min(12, Number(args.months) || 3));
      if (!category) return { error: 'category is required' };

      const since = new Date();
      since.setMonth(since.getMonth() - months);
      const sinceStr = since.toISOString().slice(0, 10);

      const { data: tx } = await supabase
        .from('transactions')
        .select('amount, tx_date, expense_category, category')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .eq('type', 'expense')
        .or('is_summary.is.null,is_summary.eq.false')
        .gte('tx_date', sinceStr);

      const matching = (tx || []).filter(t =>
        (t.expense_category === category) || (t.category === category)
      );
      if (matching.length === 0) {
        return { category, months, average_monthly: 0, total: 0, transaction_count: 0, found: false };
      }

      const total = matching.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
      const monthsSeen = new Set(matching.map(t => (t.tx_date || '').slice(0, 7))).size;
      const avgMonthly = monthsSeen > 0 ? total / monthsSeen : 0;

      return {
        category,
        months,
        average_monthly: Math.round(avgMonthly),
        total: Math.round(total),
        transaction_count: matching.length,
        months_seen: monthsSeen,
        found: true,
      };
    }

    case 'compare_to_last_month': {
      const topN = Math.max(1, Math.min(20, Number(args.topN) || 5));
      const now = new Date();
      const thisMonth = now.toISOString().slice(0, 7);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonth = lastMonthDate.toISOString().slice(0, 7);

      const { data: tx } = await supabase
        .from('transactions')
        .select('amount, tx_date, expense_category, category')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .eq('type', 'expense')
        .or('is_summary.is.null,is_summary.eq.false')
        .gte('tx_date', `${lastMonth}-01`);

      const byCategory = new Map<string, { thisMonth: number; lastMonth: number }>();
      for (const t of tx || []) {
        const cat = t.expense_category || t.category || 'אחר';
        const month = (t.tx_date || '').slice(0, 7);
        const amt = Math.abs(Number(t.amount) || 0);
        const entry = byCategory.get(cat) || { thisMonth: 0, lastMonth: 0 };
        if (month === thisMonth) entry.thisMonth += amt;
        else if (month === lastMonth) entry.lastMonth += amt;
        byCategory.set(cat, entry);
      }

      const rows = Array.from(byCategory.entries()).map(([cat, v]) => ({
        category: cat,
        this_month: Math.round(v.thisMonth),
        last_month: Math.round(v.lastMonth),
        delta: Math.round(v.thisMonth - v.lastMonth),
        delta_pct: v.lastMonth > 0 ? Math.round(((v.thisMonth - v.lastMonth) / v.lastMonth) * 100) : null,
      }));
      rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

      return { categories: rows.slice(0, topN), this_month: thisMonth, last_month: lastMonth };
    }

    case 'find_unusual_expenses': {
      const ratio = Number(args.thresholdRatio) || 2.5;
      const now = new Date();
      const thisMonth = now.toISOString().slice(0, 7);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const { data: tx } = await supabase
        .from('transactions')
        .select('id, vendor, amount, tx_date, expense_category, category')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .eq('type', 'expense')
        .or('is_summary.is.null,is_summary.eq.false')
        .gte('tx_date', ninetyDaysAgo);

      // Build per-category average
      const catTotals = new Map<string, { sum: number; count: number }>();
      for (const t of tx || []) {
        const cat = t.expense_category || t.category || 'אחר';
        const amt = Math.abs(Number(t.amount) || 0);
        const entry = catTotals.get(cat) || { sum: 0, count: 0 };
        entry.sum += amt;
        entry.count += 1;
        catTotals.set(cat, entry);
      }

      const unusual: Array<{ vendor: string; amount: number; date: string; category: string; ratio: number }> = [];
      for (const t of tx || []) {
        if ((t.tx_date || '').slice(0, 7) !== thisMonth) continue;
        const cat = t.expense_category || t.category || 'אחר';
        const stats = catTotals.get(cat);
        if (!stats || stats.count < 3) continue;
        const avg = stats.sum / stats.count;
        const amt = Math.abs(Number(t.amount) || 0);
        if (avg > 0 && amt / avg >= ratio) {
          unusual.push({
            vendor: t.vendor || cat,
            amount: Math.round(amt),
            date: t.tx_date,
            category: cat,
            ratio: Math.round((amt / avg) * 10) / 10,
          });
        }
      }

      unusual.sort((a, b) => b.amount - a.amount);
      return { unusual: unusual.slice(0, 10), threshold_ratio: ratio };
    }

    case 'get_phi_score': {
      // Best-effort: try the existing RPC, fall back to a manual computation
      const { data, error } = await supabase.rpc('calculate_financial_health', { p_user_id: userId });
      if (!error && data) return { score: data.score ?? null, breakdown: data.breakdown ?? null };

      // Fallback — basic heuristic
      const { data: profile } = await supabase
        .from('user_financial_profile')
        .select('total_monthly_income, total_fixed_expenses, total_debt')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile) return { score: null, breakdown: null, fallback: true };
      const income = Number((profile as any).total_monthly_income) || 0;
      const fixed = Number((profile as any).total_fixed_expenses) || 0;
      const debt = Number((profile as any).total_debt) || 0;

      const surplus = income - fixed;
      const surplusScore = income > 0 ? Math.min(100, (surplus / income) * 200) : 0;
      const debtScore = income > 0 ? Math.max(0, 100 - (debt / (income * 12)) * 100) : 0;
      const score = Math.round((surplusScore + debtScore) / 2);
      return { score, breakdown: { surplus_score: Math.round(surplusScore), debt_score: Math.round(debtScore) }, fallback: true };
    }

    case 'check_duplicates': {
      const { findDuplicateGroups } = await import('@/lib/finance/dedupe-transactions');
      const groups = await findDuplicateGroups(userId, 'strict');
      const groupArr = Array.from(groups.values()).slice(0, 10);
      return {
        duplicate_groups: groupArr.length,
        examples: groupArr.slice(0, 5).map(g => ({
          count: g.length,
          tx_date: g[0].tx_date,
          amount: Number(g[0].amount),
          vendor: g[0].vendor,
        })),
      };
    }

    default:
      return { error: `unknown tool: ${name}` };
  }
}
