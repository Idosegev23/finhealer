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
  {
    name: 'get_monthly_summary',
    description: 'Returns income/expenses/balance for a given month, plus top categories. If month is omitted, returns the latest month that has data (smart default — beats "0/0/0 for current month" when user has historical statements). Use when the user asks "סיכום", "פירוט", "כמה הוצאתי", "איך אני עומד".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        month: { type: Type.STRING, description: 'YYYY-MM. Omit to auto-pick the latest month with data.' },
      },
    },
  },
  {
    name: 'get_top_expenses',
    description: 'Returns the top expense categories/vendors for a month, sorted by amount. Use when the user asks "על מה הוצאתי הכי הרבה" or you want to ground a coaching reply.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        month: { type: Type.STRING, description: 'YYYY-MM. Omit to use the latest month with data.' },
        limit: { type: Type.INTEGER, description: 'How many top items to return. Default 5.' },
      },
    },
  },
  {
    name: 'get_budget_status',
    description: 'Returns current budget — total budget, total spent, remaining, status, and per-category breakdown. Use for "תקציב", "כמה נשאר", "איך אני עומד מול התקציב".',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_goals_progress',
    description: 'Returns active goals with progress (current/target, % done, target date). Use for "יעדים", "מטרות", "כמה חסכתי".',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_cashflow_projection',
    description: 'Returns a 3-month cash flow forecast (projected income/expenses/balance per month). Use for "תזרים", "תחזית", "מה צפוי בחודשים הבאים".',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_data_status',
    description: 'Returns a quick overview of what data the user has — total transactions, months covered, statements uploaded, has_budget, has_goals. Call this FIRST when you\'re unsure if the user has any data to discuss.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'start_classification',
    description: 'Triggers the classification flow — auto-classifies pending transactions, then prompts user about ambiguous ones. Use when the user says "נתחיל" / "סווג" / wants to organize transactions. Returns a status object you can use to compose your reply.',
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

    case 'get_monthly_summary': {
      // Smart month: if requested month is empty, use latest month with data
      let targetMonth: string | undefined = args.month;
      let isAutoSelected = false;
      if (!targetMonth) {
        const { data: latest } = await supabase
          .from('transactions')
          .select('tx_date')
          .eq('user_id', userId)
          .eq('status', 'confirmed')
          .order('tx_date', { ascending: false })
          .limit(1);
        if (latest?.[0]?.tx_date) {
          targetMonth = latest[0].tx_date.slice(0, 7);
          isAutoSelected = true;
        } else {
          return { found: false, message: 'אין עדיין תנועות מאומתות. שלח דוח כדי שאתחיל לעקוב.' };
        }
      }
      const [y, m] = (targetMonth as string).split('-');
      const start = `${targetMonth}-01`;
      const end = new Date(Number(y), Number(m), 1).toISOString().slice(0, 10);

      const { data: tx } = await supabase
        .from('transactions')
        .select('amount, type, expense_category, category, vendor')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .or('is_summary.is.null,is_summary.eq.false')
        .gte('tx_date', start)
        .lt('tx_date', end);

      const list = tx || [];
      const income = list.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
      const expenses = list.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

      const catTotals = new Map<string, number>();
      for (const t of list) {
        if (t.type !== 'expense') continue;
        const cat = t.expense_category || t.category || 'אחר';
        catTotals.set(cat, (catTotals.get(cat) || 0) + Math.abs(Number(t.amount) || 0));
      }
      const topCategories = Array.from(catTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, amount]) => ({ category, amount: Math.round(amount) }));

      return {
        found: true,
        month: targetMonth,
        is_auto_selected: isAutoSelected,
        income: Math.round(income),
        expenses: Math.round(expenses),
        balance: Math.round(income - expenses),
        transaction_count: list.length,
        top_categories: topCategories,
      };
    }

    case 'get_top_expenses': {
      let targetMonth: string | undefined = args.month;
      const limit = Math.max(1, Math.min(20, Number(args.limit) || 5));
      if (!targetMonth) {
        const { data: latest } = await supabase
          .from('transactions')
          .select('tx_date').eq('user_id', userId).eq('status', 'confirmed')
          .order('tx_date', { ascending: false }).limit(1);
        if (!latest?.[0]?.tx_date) return { found: false };
        targetMonth = latest[0].tx_date.slice(0, 7);
      }
      const [y, m] = (targetMonth as string).split('-');
      const start = `${targetMonth}-01`;
      const end = new Date(Number(y), Number(m), 1).toISOString().slice(0, 10);

      const { data: tx } = await supabase
        .from('transactions')
        .select('amount, vendor, expense_category, category, tx_date')
        .eq('user_id', userId).eq('status', 'confirmed').eq('type', 'expense')
        .or('is_summary.is.null,is_summary.eq.false')
        .gte('tx_date', start).lt('tx_date', end)
        .order('amount', { ascending: false });

      const items = (tx || []).slice(0, limit).map(t => ({
        vendor: t.vendor || t.expense_category || t.category || 'הוצאה',
        amount: Math.abs(Number(t.amount) || 0),
        category: t.expense_category || t.category || 'אחר',
        date: t.tx_date,
      }));
      return { found: true, month: targetMonth, top_expenses: items };
    }

    case 'get_budget_status': {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: budget } = await supabase
        .from('budgets')
        .select('id, month, total_budget, total_spent, savings_goal, status')
        .eq('user_id', userId).eq('month', currentMonth)
        .in('status', ['active', 'warning', 'exceeded'])
        .limit(1).maybeSingle();

      if (!budget) return { has_budget: false, month: currentMonth };

      const { data: cats } = await supabase
        .from('budget_categories')
        .select('category_name, allocated_amount, spent_amount, percentage_used, status')
        .eq('budget_id', budget.id)
        .order('percentage_used', { ascending: false });

      return {
        has_budget: true,
        month: budget.month,
        total_budget: Number(budget.total_budget) || 0,
        total_spent: Number(budget.total_spent) || 0,
        remaining: (Number(budget.total_budget) || 0) - (Number(budget.total_spent) || 0),
        savings_goal: Number(budget.savings_goal) || 0,
        status: budget.status,
        categories: (cats || []).map(c => ({
          name: c.category_name,
          allocated: Number(c.allocated_amount) || 0,
          spent: Number(c.spent_amount) || 0,
          pct_used: Math.round(Number(c.percentage_used) || 0),
          status: c.status,
        })),
      };
    }

    case 'get_goals_progress': {
      const { data: goals } = await supabase
        .from('goals')
        .select('id, name, target_amount, current_amount, deadline, priority, status, goal_type')
        .eq('user_id', userId).eq('status', 'active')
        .order('priority', { ascending: true });

      if (!goals || goals.length === 0) return { has_goals: false, goals: [] };

      return {
        has_goals: true,
        goals: goals.map(g => {
          const target = Number(g.target_amount) || 0;
          const current = Number(g.current_amount) || 0;
          const progress = target > 0 ? Math.round((current / target) * 100) : 0;
          const daysToDeadline = g.deadline
            ? Math.max(0, Math.floor((new Date(g.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null;
          return {
            id: g.id, name: g.name, type: g.goal_type,
            target, current, progress_pct: progress,
            deadline: g.deadline, days_to_deadline: daysToDeadline,
            priority: g.priority,
          };
        }),
      };
    }

    case 'get_cashflow_projection': {
      try {
        const { projectCashFlow } = await import('@/lib/finance/cash-flow-projector');
        const analysis = await projectCashFlow(userId, 3);
        return {
          months: analysis.projections.map(p => ({
            month: p.month_name,
            projected_income: Math.round(p.projected_income),
            projected_expenses: Math.round(p.projected_expenses),
            net: Math.round(p.net_cash_flow),
            balance: Math.round(p.projected_balance),
            warning_level: p.warning_level,
          })),
          warnings: analysis.warnings,
          recommendations: analysis.recommendations,
        };
      } catch (err: any) {
        return { error: err.message || 'cashflow projection failed' };
      }
    }

    case 'get_data_status': {
      const [{ count: txTotal }, { count: txConfirmed }, { count: txPending }, { count: docs }, { count: budgetCount }, { count: goalCount }, { data: latestTx }] = await Promise.all([
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'confirmed'),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'pending'),
        supabase.from('uploaded_statements').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('processed', true),
        supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['active', 'warning', 'exceeded']),
        supabase.from('goals').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
        supabase.from('transactions').select('tx_date').eq('user_id', userId).eq('status', 'confirmed').order('tx_date', { ascending: false }).limit(1),
      ]);

      const { data: months } = await supabase.from('transactions')
        .select('tx_date').eq('user_id', userId).eq('status', 'confirmed');
      const distinctMonths = new Set((months || []).map((t: any) => (t.tx_date || '').slice(0, 7))).size;

      return {
        total_transactions: txTotal || 0,
        confirmed_transactions: txConfirmed || 0,
        pending_transactions: txPending || 0,
        documents_uploaded: docs || 0,
        months_covered: distinctMonths,
        latest_transaction_date: latestTx?.[0]?.tx_date || null,
        has_budget: (budgetCount || 0) > 0,
        has_goals: (goalCount || 0) > 0,
      };
    }

    case 'start_classification': {
      try {
        const { startClassification } = await import('@/lib/conversation/states/classification');
        // Get phone from user record
        const { data: u } = await supabase.from('users').select('phone, name').eq('id', userId).single();
        if (!u?.phone) return { started: false, error: 'no phone on user' };
        const ctx = { userId, phone: u.phone, state: 'classification' as any, userName: u.name || '' };
        const result = await startClassification(ctx);
        return {
          started: true,
          new_state: result.newState || null,
          success: result.success,
        };
      } catch (err: any) {
        return { started: false, error: err.message || 'classification failed to start' };
      }
    }

    default:
      return { error: `unknown tool: ${name}` };
  }
}
