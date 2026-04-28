/**
 * Deposit Allocator — distributes ONE monthly savings deposit across
 * the user's active goals based on priority + deadline urgency.
 *
 * The user sets a single number (`monthly_savings_target`) and active
 * goals carry their own (priority, deadline, target, current). This
 * module returns the per-goal share of any deposit, with the
 * arithmetic surfaced so the UI can explain *why* each goal got what.
 *
 * Distinct from lib/goals/goals-balancer.ts: that one calculates the
 * affordability ceiling from income/expenses. This one assumes the
 * deposit is already decided and just splits it.
 *
 * Algorithm (two-pass):
 *   1. Required pass — sort active goals by priority asc, then by
 *      urgency desc. For each, pay `min(remainingDeposit, monthlyRequired)`.
 *      `monthlyRequired = max((target - current) / monthsRemaining,
 *      min_allocation || 0)`. A goal with no deadline contributes
 *      Infinity months → required of 0 unless `min_allocation` is set.
 *   2. Leftover pass — if deposit > sum(required), distribute the
 *      leftover proportional to each goal's urgency_score, capped at
 *      `remaining` (target − current). Goals already at target stop
 *      receiving anything.
 *
 * Urgency_score:
 *   priority weight = 1 / priority (default priority=5 → 0.2)
 *   time pressure   = 1 + 12 / max(monthsRemaining, 1)   (a deadline
 *                     12 months out doubles the weight; 6 months → 3x)
 *   urgency = priorityWeight × timePressure
 */

export interface GoalForAllocation {
  id: string;
  name: string;
  priority: number | null;
  deadline: string | null;
  target_amount: number;
  current_amount: number | null;
  min_allocation: number | null;
  is_flexible: boolean | null;
  status: string;
}

export interface AllocationItem {
  goal_id: string;
  goal_name: string;
  priority: number;
  deadline: string | null;
  target_amount: number;
  current_amount: number;
  remaining: number;
  months_remaining: number | null; // null = no deadline
  monthly_required: number;
  urgency_score: number;
  // Allocation outcome
  allocated: number;
  shortfall: number;     // monthly_required − allocated (positive = under)
  share_percent: number; // allocated / depositAmount * 100
  reasoning: string;     // human-readable note
}

export interface AllocationResult {
  total_deposit: number;
  total_allocated: number;
  unallocated: number;
  total_required: number;
  is_underfunded: boolean; // deposit < required for active goals
  allocations: AllocationItem[];
  warnings: string[];
}

const MONTH_DAYS = 30.44;

function monthsBetween(from: Date, toIso: string | null): number | null {
  if (!toIso) return null;
  const to = new Date(toIso);
  if (Number.isNaN(to.getTime())) return null;
  const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(diffDays / MONTH_DAYS, 0);
}

function urgencyScore(priority: number, months: number | null): number {
  const priorityWeight = 1 / Math.max(priority, 1);
  // No deadline → assume 60-month horizon (5 years). Far enough to be
  // low-urgency but not zero so it can still claim leftover.
  const horizon = months == null ? 60 : Math.max(months, 1);
  const timePressure = 1 + 12 / horizon;
  return priorityWeight * timePressure;
}

export function allocateDeposit(input: {
  goals: GoalForAllocation[];
  depositAmount: number;
  asOf?: Date;
}): AllocationResult {
  const asOf = input.asOf || new Date();
  const deposit = Math.max(0, Number(input.depositAmount) || 0);

  const active = input.goals.filter((g) => g.status === 'active');
  if (active.length === 0 || deposit === 0) {
    return {
      total_deposit: deposit,
      total_allocated: 0,
      unallocated: deposit,
      total_required: 0,
      is_underfunded: false,
      allocations: [],
      warnings: active.length === 0
        ? ['אין יעדים פעילים — הוסף יעד כדי להתחיל לחלק הפקדות']
        : ['הסכום להפקדה הוא 0'],
    };
  }

  // Pre-compute per-goal context
  const items = active.map((g): AllocationItem => {
    const target = Number(g.target_amount) || 0;
    const current = Number(g.current_amount) || 0;
    const remaining = Math.max(target - current, 0);
    const months = monthsBetween(asOf, g.deadline);
    const minAlloc = Number(g.min_allocation) || 0;
    const monthlyRequired = months != null && months > 0
      ? Math.max(remaining / months, minAlloc)
      : minAlloc; // no deadline → only min_allocation if set
    const priority = g.priority || 5;
    const urgency = urgencyScore(priority, months);
    return {
      goal_id: g.id,
      goal_name: g.name,
      priority,
      deadline: g.deadline,
      target_amount: target,
      current_amount: current,
      remaining,
      months_remaining: months,
      monthly_required: Math.min(monthlyRequired, remaining), // can't need more than what's left
      urgency_score: urgency,
      allocated: 0,
      shortfall: 0,
      share_percent: 0,
      reasoning: '',
    };
  });

  // Sort by priority asc → urgency desc
  const sorted = [...items].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.urgency_score - a.urgency_score;
  });

  let depositLeft = deposit;
  const totalRequired = sorted.reduce((s, g) => s + g.monthly_required, 0);

  // Pass 1: cover monthly_required in priority order
  for (const g of sorted) {
    if (depositLeft <= 0) break;
    if (g.monthly_required <= 0) continue;
    const pay = Math.min(depositLeft, g.monthly_required, g.remaining);
    g.allocated += pay;
    depositLeft -= pay;
  }

  // Pass 2: distribute leftover by urgency among goals not yet capped
  if (depositLeft > 0.5) {
    const candidates = sorted.filter((g) => g.allocated < g.remaining);
    const totalUrgency = candidates.reduce((s, g) => s + g.urgency_score, 0);
    if (totalUrgency > 0) {
      // First proportional pass
      let secondaryLeft = depositLeft;
      for (const g of candidates) {
        const desired = (g.urgency_score / totalUrgency) * depositLeft;
        const headroom = g.remaining - g.allocated;
        const add = Math.min(desired, headroom);
        g.allocated += add;
        secondaryLeft -= add;
      }
      depositLeft = Math.max(0, secondaryLeft);
      // If still leftover (some goals capped early), give the rest
      // greedily by urgency until we run out of either deposit or
      // remaining capacity.
      if (depositLeft > 0.5) {
        const greedy = [...candidates]
          .filter((g) => g.allocated < g.remaining)
          .sort((a, b) => b.urgency_score - a.urgency_score);
        for (const g of greedy) {
          if (depositLeft <= 0) break;
          const headroom = g.remaining - g.allocated;
          const add = Math.min(headroom, depositLeft);
          g.allocated += add;
          depositLeft -= add;
        }
      }
    }
  }

  // Reasoning + shortfall + share %
  for (const g of items) {
    g.shortfall = Math.max(0, g.monthly_required - g.allocated);
    g.share_percent = deposit > 0 ? (g.allocated / deposit) * 100 : 0;
    const parts: string[] = [];
    parts.push(`עדיפות ${g.priority}`);
    if (g.months_remaining != null) {
      parts.push(`${Math.round(g.months_remaining)} חודשים ליעד`);
    } else {
      parts.push('ללא תאריך יעד');
    }
    if (g.monthly_required > 0) {
      parts.push(`נדרש חודשי ₪${Math.round(g.monthly_required).toLocaleString('he-IL')}`);
    }
    if (g.shortfall > 0.5) {
      parts.push(`חסר ₪${Math.round(g.shortfall).toLocaleString('he-IL')}`);
    }
    g.reasoning = parts.join(' · ');
  }

  const totalAllocated = items.reduce((s, g) => s + g.allocated, 0);
  const warnings: string[] = [];
  const isUnderfunded = totalRequired > deposit + 0.5;
  if (isUnderfunded) {
    warnings.push(
      `ההפקדה החודשית (₪${Math.round(deposit).toLocaleString('he-IL')}) קטנה מהדרוש לעמידה בכל היעדים (₪${Math.round(totalRequired).toLocaleString('he-IL')}). יעדים גמישים יכולים להידחות, אחרים יקבלו פחות.`
    );
  }
  if (depositLeft > 0.5) {
    warnings.push(
      `נותרו ₪${Math.round(depositLeft).toLocaleString('he-IL')} לא משויכים — היעדים הפעילים כבר במקסימום הצבירה.`
    );
  }

  return {
    total_deposit: deposit,
    total_allocated: totalAllocated,
    unallocated: Math.max(0, deposit - totalAllocated),
    total_required: totalRequired,
    is_underfunded: isUnderfunded,
    allocations: items.sort((a, b) => b.allocated - a.allocated),
    warnings,
  };
}
