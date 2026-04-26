/**
 * Money Flow Engine — v3.1
 *
 * Replaces the disconnected budget+goals model with a unified flow:
 *
 *   Income → Locked (obligations) → Savings (goals) → Safety → Free (daily budget)
 *
 * Three numbers that matter:
 *   1. Daily free: how much can I spend today?
 *   2. Weekly free: how much this week?
 *   3. Month-end forecast: +/- at this pace?
 *
 * Also provides:
 *   - "Can I afford X?" calculator
 *   - Spending velocity (am I on track?)
 *   - What changed vs last month?
 *   - Seasonal calendar (upcoming big expenses)
 */

import { createServiceClient } from '@/lib/supabase/server';
import { cache } from '@/lib/utils/cache';

// ============================================================================
// Types
// ============================================================================

export interface MoneyFlowResult {
  // Core numbers
  monthlyIncome: number;
  locked: LockedExpenses;
  savings: SavingsAllocation;
  safetyBuffer: number;
  freeAmount: number;

  // Daily/weekly
  daysLeftInMonth: number;
  dailyBudget: number;
  weeklyBudget: number;
  spentToday: number;
  spentThisWeek: number;
  remainingToday: number;
  remainingThisWeek: number;

  // Forecast
  spentSoFar: number;
  spendingVelocity: number; // avg daily spend rate
  forecastEndOfMonth: number; // + surplus / - deficit
  onTrack: boolean;

  // Meta
  month: string;
  calculatedAt: string;
}

export interface LockedExpenses {
  total: number;
  items: Array<{
    category: string;
    vendor: string;
    amount: number;
    day: number; // day of month
    paid: boolean; // already paid this month?
  }>;
  paidSoFar: number;
  upcomingThisMonth: number;
}

export interface SavingsAllocation {
  total: number;
  goals: Array<{
    id: string;
    name: string;
    monthlyAllocation: number;
    deposited: number; // this month
    remaining: number;
  }>;
  depositedSoFar: number;
}

export interface AffordabilityResult {
  canAfford: boolean;
  impact: {
    onDailyBudget: number; // new daily budget if purchased
    onGoals: Array<{ name: string; delayMonths: number }>;
    onForecast: number; // new month-end forecast
  };
  alternatives: Array<{
    option: string;
    description: string;
    monthlyImpact: number;
  }>;
  recommendation: string;
}

export interface MonthComparison {
  totalDiff: number;
  oneTimeExpenses: Array<{ vendor: string; amount: number }>;
  recurringChanges: Array<{ category: string; diff: number; direction: 'up' | 'down' }>;
  newExpenses: Array<{ vendor: string; amount: number }>;
  summary: string; // AI-generated narrative
}

// ============================================================================
// Main: Calculate Money Flow
// ============================================================================

export async function calculateMoneyFlow(userId: string, month?: string): Promise<MoneyFlowResult> {
  const cacheKey = `money_flow:${userId}:${month || 'current'}`;
  return cache.getOrSet(cacheKey, 60, () => _calculateMoneyFlowImpl(userId, month));
}

async function _calculateMoneyFlowImpl(userId: string, month?: string): Promise<MoneyFlowResult> {
  const supabase = createServiceClient();
  const now = new Date();
  let targetMonth = month || now.toISOString().substring(0, 7);

  // If caller didn't pin a month and the current month has no data yet
  // (common for new users uploading historical statements), fall back to the
  // latest month that actually has transactions. Otherwise the user sees
  // ₪0/0/0 even though they have plenty of data.
  if (!month) {
    const monthStartProbe = `${targetMonth}-01`;
    const { count: currentMonthCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .or('is_summary.is.null,is_summary.eq.false')
      .gte('tx_date', monthStartProbe);
    if (!currentMonthCount || currentMonthCount === 0) {
      const { data: latest } = await supabase
        .from('transactions')
        .select('tx_date')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .or('is_summary.is.null,is_summary.eq.false')
        .order('tx_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      const latestDate = (latest as any)?.tx_date as string | undefined;
      if (latestDate) targetMonth = latestDate.substring(0, 7);
    }
  }

  const monthStart = `${targetMonth}-01`;
  const lastDay = new Date(parseInt(targetMonth.split('-')[0]), parseInt(targetMonth.split('-')[1]), 0).getDate();
  const monthEnd = `${targetMonth}-${lastDay}`;
  const today = now.toISOString().split('T')[0];
  const currentDay = now.getDate();
  const daysLeft = Math.max(1, lastDay - currentDay);

  // Week boundaries (Sunday-Saturday)
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  // ── Fetch all data in parallel ──
  const [
    { data: incomeTx },
    { data: expenseTx },
    { data: todayTx },
    { data: weekTx },
    { data: goals },
    { data: goalDeposits },
    { data: userProfile },
  ] = await Promise.all([
    // Monthly income
    supabase.from('transactions')
      .select('amount')
      .eq('user_id', userId).eq('type', 'income').eq('status', 'confirmed')
      .or('is_summary.is.null,is_summary.eq.false')
      .gte('tx_date', monthStart).lte('tx_date', monthEnd),
    // Monthly expenses (all confirmed, non-summary)
    supabase.from('transactions')
      .select('amount, vendor, expense_category, expense_type, tx_date, category')
      .eq('user_id', userId).eq('type', 'expense').eq('status', 'confirmed')
      .or('is_summary.is.null,is_summary.eq.false')
      .gte('tx_date', monthStart).lte('tx_date', monthEnd),
    // Today's expenses
    supabase.from('transactions')
      .select('amount')
      .eq('user_id', userId).eq('type', 'expense').eq('status', 'confirmed')
      .or('is_summary.is.null,is_summary.eq.false')
      .eq('tx_date', today),
    // This week's expenses
    supabase.from('transactions')
      .select('amount')
      .eq('user_id', userId).eq('type', 'expense').eq('status', 'confirmed')
      .or('is_summary.is.null,is_summary.eq.false')
      .gte('tx_date', weekStartStr).lte('tx_date', weekEndStr),
    // Active goals
    supabase.from('goals')
      .select('id, name, monthly_allocation, current_amount, target_amount')
      .eq('user_id', userId).eq('status', 'active'),
    // Goal deposits this month
    supabase.from('transactions')
      .select('amount, goal_id')
      .eq('user_id', userId).eq('status', 'confirmed')
      .not('goal_id', 'is', null)
      .gte('tx_date', monthStart).lte('tx_date', monthEnd),
    // User profile for context
    supabase.from('user_financial_profile')
      .select('total_monthly_income, total_fixed_expenses')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  // ── Calculate income ──
  let monthlyIncome = (incomeTx || []).reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);

  // Fallback: if no income this month, use profile's average or last 3 months average
  if (monthlyIncome === 0) {
    const profileIncome = Number(userProfile?.total_monthly_income || 0);
    if (profileIncome > 0) {
      monthlyIncome = profileIncome;
    } else {
      // Calculate from last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const { data: recentIncome } = await supabase.from('transactions')
        .select('amount')
        .eq('user_id', userId).eq('type', 'income').eq('status', 'confirmed')
        .or('is_summary.is.null,is_summary.eq.false')
        .gte('tx_date', threeMonthsAgo.toISOString().split('T')[0]);
      if (recentIncome && recentIncome.length > 0) {
        const total = recentIncome.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
        monthlyIncome = Math.round(total / 3);
      }
    }
  }

  // ── Separate locked (fixed) vs variable expenses ──
  const expenses = (expenseTx || []) as Array<{ amount: number; vendor: string; expense_category: string; expense_type: string; tx_date: string; category: string }>;

  const lockedItems: LockedExpenses['items'] = [];
  let variableSpent = 0;

  for (const tx of expenses) {
    const amount = Math.abs(Number(tx.amount));
    const isFixed = tx.expense_type === 'fixed';
    const txDay = parseInt((tx.tx_date || '').split('-')[2] || '0');

    if (isFixed) {
      lockedItems.push({
        category: tx.expense_category || tx.category || tx.vendor || '',
        vendor: tx.vendor || '',
        amount,
        day: txDay,
        paid: true, // if it's in transactions, it was paid
      });
    } else {
      variableSpent += amount;
    }
  }

  const lockedTotal = lockedItems.reduce((s, i) => s + i.amount, 0);

  // ── Estimate upcoming locked expenses (from DNA/history) ──
  // Use profile's fixed expenses as baseline, subtract what's already paid
  const profileFixedExpenses = Number(userProfile?.total_fixed_expenses || 0);
  const estimatedLockedTotal = Math.max(lockedTotal, profileFixedExpenses);
  const upcomingLocked = Math.max(0, estimatedLockedTotal - lockedTotal);

  const locked: LockedExpenses = {
    total: estimatedLockedTotal,
    items: lockedItems,
    paidSoFar: lockedTotal,
    upcomingThisMonth: upcomingLocked,
  };

  // ── Savings (goals) ──
  const depositsByGoal = new Map<string, number>();
  for (const d of (goalDeposits || [])) {
    const gid = d.goal_id;
    depositsByGoal.set(gid, (depositsByGoal.get(gid) || 0) + Math.abs(Number(d.amount)));
  }

  const savingsGoals = (goals || []).map(g => {
    const allocation = Number(g.monthly_allocation || 0);
    const deposited = depositsByGoal.get(g.id) || 0;
    return {
      id: g.id,
      name: g.name,
      monthlyAllocation: allocation,
      deposited,
      remaining: Math.max(0, allocation - deposited),
    };
  });

  const savingsTotal = savingsGoals.reduce((s, g) => s + g.monthlyAllocation, 0);
  const savingsDeposited = savingsGoals.reduce((s, g) => s + g.deposited, 0);

  const savings: SavingsAllocation = {
    total: savingsTotal,
    goals: savingsGoals,
    depositedSoFar: savingsDeposited,
  };

  // ── Safety buffer (10%) ──
  const safetyBuffer = Math.round(monthlyIncome * 0.10);

  // ── Free amount ──
  const freeAmount = Math.max(0, monthlyIncome - estimatedLockedTotal - savingsTotal - safetyBuffer);

  // ── Daily/weekly ──
  const spentToday = (todayTx || []).reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
  const spentThisWeek = (weekTx || []).reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
  const totalVariableSpent = variableSpent;

  const dailyBudget = daysLeft > 0 ? Math.round((freeAmount - totalVariableSpent + lockedTotal - estimatedLockedTotal) / daysLeft) : 0;
  // Recalculate: what's actually left for variable spending
  const variableRemaining = Math.max(0, freeAmount - totalVariableSpent);
  const actualDailyBudget = daysLeft > 0 ? Math.round(variableRemaining / daysLeft) : 0;
  const daysInWeekRemaining = Math.min(7 - dayOfWeek, daysLeft);
  const actualWeeklyBudget = actualDailyBudget * daysInWeekRemaining;

  // ── Spending velocity & forecast ──
  const daysSoFar = Math.max(1, currentDay);
  const avgDailySpend = totalVariableSpent / daysSoFar;
  const projectedMonthlyVariable = avgDailySpend * lastDay;
  const projectedTotal = estimatedLockedTotal + projectedMonthlyVariable + savingsTotal;
  const forecastEndOfMonth = Math.round(monthlyIncome - projectedTotal);
  const onTrack = forecastEndOfMonth >= 0;

  return {
    monthlyIncome,
    locked,
    savings,
    safetyBuffer,
    freeAmount,
    daysLeftInMonth: daysLeft,
    dailyBudget: Math.max(0, actualDailyBudget),
    weeklyBudget: Math.max(0, actualWeeklyBudget),
    spentToday,
    spentThisWeek,
    remainingToday: Math.max(0, actualDailyBudget - spentToday),
    remainingThisWeek: Math.max(0, actualWeeklyBudget - spentThisWeek),
    spentSoFar: totalVariableSpent,
    spendingVelocity: Math.round(avgDailySpend),
    forecastEndOfMonth,
    onTrack,
    month: targetMonth,
    calculatedAt: now.toISOString(),
  };
}

// ============================================================================
// "Can I Afford X?"
// ============================================================================

export async function canIAfford(
  userId: string,
  amount: number,
  description?: string
): Promise<AffordabilityResult> {
  const flow = await calculateMoneyFlow(userId);

  const newForecast = flow.forecastEndOfMonth - amount;
  const canAfford = newForecast >= 0;
  const newDailyBudget = flow.daysLeftInMonth > 0
    ? Math.max(0, Math.round((flow.freeAmount - flow.spentSoFar - amount) / flow.daysLeftInMonth))
    : 0;

  // Calculate impact on goals
  const goalImpact = flow.savings.goals.map(g => {
    if (canAfford) return { name: g.name, delayMonths: 0 };
    // If can't afford, how many months of goal savings would this cost?
    const monthsDelay = g.monthlyAllocation > 0 ? Math.ceil(Math.abs(newForecast) / g.monthlyAllocation) : 0;
    return { name: g.name, delayMonths: monthsDelay };
  }).filter(g => g.delayMonths > 0);

  // Build alternatives
  const alternatives: AffordabilityResult['alternatives'] = [];

  // Option 1: Pay in installments
  if (amount > 500) {
    const monthly12 = Math.round(amount / 12);
    alternatives.push({
      option: 'תשלומים',
      description: `12 תשלומים של ${monthly12.toLocaleString('he-IL')}₪`,
      monthlyImpact: monthly12,
    });
  }

  // Option 2: Delay a goal temporarily
  const flexibleGoal = flow.savings.goals.find(g => g.monthlyAllocation > 0);
  if (flexibleGoal && !canAfford) {
    alternatives.push({
      option: `להקטין ${flexibleGoal.name} זמנית`,
      description: `להפחית חיסכון ל${flexibleGoal.name} בחודשיים הקרובים`,
      monthlyImpact: Math.round(flexibleGoal.monthlyAllocation * 0.5),
    });
  }

  // Option 3: Wait
  if (!canAfford) {
    const monthsToSave = flow.dailyBudget > 0 ? Math.ceil(amount / (flow.dailyBudget * 30)) : 99;
    alternatives.push({
      option: 'לחכות ולחסוך',
      description: `עוד ${monthsToSave} חודשים ותהיה לך את הסכום`,
      monthlyImpact: 0,
    });
  }

  // Build recommendation
  let recommendation: string;
  if (canAfford && newDailyBudget >= flow.dailyBudget * 0.5) {
    recommendation = `אפשר! התקציב היומי ירד ל-${newDailyBudget.toLocaleString('he-IL')}₪ (מ-${flow.dailyBudget.toLocaleString('he-IL')}₪). סוף חודש: ${newForecast >= 0 ? '+' : ''}${newForecast.toLocaleString('he-IL')}₪.`;
  } else if (canAfford) {
    recommendation = `טכנית אפשר, אבל התקציב היומי ירד ל-${newDailyBudget.toLocaleString('he-IL')}₪. ייהיה צפוף. שווה לשקול תשלומים.`;
  } else {
    recommendation = `חסרים ${Math.abs(newForecast).toLocaleString('he-IL')}₪ לסוף החודש. ${alternatives.length > 0 ? 'יש חלופות:' : 'מומלץ לחכות.'}`;
  }

  return {
    canAfford,
    impact: {
      onDailyBudget: newDailyBudget,
      onGoals: goalImpact,
      onForecast: newForecast,
    },
    alternatives,
    recommendation,
  };
}

// ============================================================================
// Month-over-Month Comparison
// ============================================================================

export async function compareToLastMonth(userId: string): Promise<MonthComparison> {
  const supabase = createServiceClient();
  const now = new Date();
  const thisMonth = now.toISOString().substring(0, 7);

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().substring(0, 7);

  const lastDay = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo, 0).getDate();
  };

  // Fetch both months
  const [{ data: thisTx }, { data: lastTx }] = await Promise.all([
    supabase.from('transactions')
      .select('amount, vendor, expense_category, expense_type, tx_date')
      .eq('user_id', userId).eq('type', 'expense').eq('status', 'confirmed')
      .or('is_summary.is.null,is_summary.eq.false')
      .gte('tx_date', `${thisMonth}-01`).lte('tx_date', `${thisMonth}-${lastDay(thisMonth)}`),
    supabase.from('transactions')
      .select('amount, vendor, expense_category, expense_type, tx_date')
      .eq('user_id', userId).eq('type', 'expense').eq('status', 'confirmed')
      .or('is_summary.is.null,is_summary.eq.false')
      .gte('tx_date', `${lastMonth}-01`).lte('tx_date', `${lastMonth}-${lastDay(lastMonth)}`),
  ]);

  const sumByCategory = (txs: any[]) => {
    const map = new Map<string, number>();
    for (const tx of txs) {
      const cat = tx.expense_category || tx.vendor || 'אחר';
      map.set(cat, (map.get(cat) || 0) + Math.abs(Number(tx.amount)));
    }
    return map;
  };

  const thisMap = sumByCategory(thisTx || []);
  const lastMap = sumByCategory(lastTx || []);

  const thisTotal = (thisTx || []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const lastTotal = (lastTx || []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const totalDiff = Math.round(thisTotal - lastTotal);

  // Find one-time expenses (large, appeared only once)
  const oneTimeExpenses: MonthComparison['oneTimeExpenses'] = [];
  const recurringChanges: MonthComparison['recurringChanges'] = [];
  const newExpenses: MonthComparison['newExpenses'] = [];

  for (const [cat, amount] of Array.from(thisMap.entries())) {
    const lastAmount = lastMap.get(cat) || 0;
    const diff = Math.round(amount - lastAmount);

    if (lastAmount === 0 && amount > 200) {
      // New expense this month
      newExpenses.push({ vendor: cat, amount: Math.round(amount) });
    } else if (Math.abs(diff) > 100) {
      // Significant change in recurring
      recurringChanges.push({
        category: cat,
        diff: Math.abs(diff),
        direction: diff > 0 ? 'up' : 'down',
      });
    }
  }

  // One-time = large single transactions not in last month
  for (const tx of (thisTx || [])) {
    const amount = Math.abs(Number(tx.amount));
    if (amount > 500) {
      const vendor = tx.vendor || '';
      const wasInLastMonth = (lastTx || []).some(lt =>
        lt.vendor === vendor && Math.abs(Number(lt.amount) - amount) < 50
      );
      if (!wasInLastMonth) {
        oneTimeExpenses.push({ vendor, amount: Math.round(amount) });
      }
    }
  }

  // Build narrative summary
  const parts: string[] = [];
  if (totalDiff > 0) {
    parts.push(`החודש הוצאת ${totalDiff.toLocaleString('he-IL')}₪ יותר מחודש שעבר.`);
  } else if (totalDiff < 0) {
    parts.push(`החודש הוצאת ${Math.abs(totalDiff).toLocaleString('he-IL')}₪ פחות מחודש שעבר!`);
  } else {
    parts.push(`ההוצאות דומות לחודש שעבר.`);
  }

  if (oneTimeExpenses.length > 0) {
    const oneTimeTotal = oneTimeExpenses.reduce((s, e) => s + e.amount, 0);
    parts.push(`מתוכם ${oneTimeTotal.toLocaleString('he-IL')}₪ חד-פעמיים (${oneTimeExpenses.map(e => e.vendor).join(', ')}).`);
  }

  const upChanges = recurringChanges.filter(c => c.direction === 'up').slice(0, 2);
  if (upChanges.length > 0) {
    parts.push(`עליות: ${upChanges.map(c => `${c.category} +${c.diff.toLocaleString('he-IL')}₪`).join(', ')}.`);
  }

  return {
    totalDiff,
    oneTimeExpenses: oneTimeExpenses.slice(0, 5),
    recurringChanges: recurringChanges.sort((a, b) => b.diff - a.diff).slice(0, 5),
    newExpenses: newExpenses.slice(0, 3),
    summary: parts.join(' '),
  };
}

// ============================================================================
// Format for WhatsApp
// ============================================================================

export function formatMoneyFlowForWhatsApp(flow: MoneyFlowResult, userName?: string): string {
  const name = userName ? `${userName}, ` : '';
  const forecast = flow.forecastEndOfMonth;
  const forecastStr = `${forecast >= 0 ? '+' : ''}${forecast.toLocaleString('he-IL')}`;
  const emoji = flow.onTrack ? '✅' : '⚠️';

  let msg = `💰 *${name}מצב הכסף:*\n\n`;

  // The three numbers
  msg += `📍 *היום:* ${flow.remainingToday.toLocaleString('he-IL')}₪ חופשי\n`;
  msg += `📅 *השבוע:* ${flow.remainingThisWeek.toLocaleString('he-IL')}₪ חופשי\n`;
  msg += `${emoji} *סוף חודש:* ${forecastStr}₪\n`;

  // Breakdown
  msg += `\n📊 *פירוט:*\n`;
  msg += `הכנסה: ${flow.monthlyIncome.toLocaleString('he-IL')}₪\n`;
  msg += `🔒 התחייבויות: ${flow.locked.total.toLocaleString('he-IL')}₪\n`;
  msg += `🎯 חיסכון: ${flow.savings.total.toLocaleString('he-IL')}₪\n`;
  msg += `💰 חופשי: ${flow.freeAmount.toLocaleString('he-IL')}₪ (${flow.dailyBudget.toLocaleString('he-IL')}₪/יום)\n`;

  // Velocity warning
  if (!flow.onTrack) {
    msg += `\n⚡ *קצב:* ${flow.spendingVelocity.toLocaleString('he-IL')}₪/יום. `;
    const targetVelocity = flow.daysLeftInMonth > 0
      ? Math.round((flow.freeAmount - flow.spentSoFar) / flow.daysLeftInMonth)
      : 0;
    msg += `כדי לסיים ב-0: ${targetVelocity.toLocaleString('he-IL')}₪/יום`;
  }

  return msg;
}

export function formatAffordabilityForWhatsApp(result: AffordabilityResult, amount: number, description?: string): string {
  const item = description || 'הפריט';
  const amountStr = amount.toLocaleString('he-IL');

  let msg = result.canAfford
    ? `✅ *${item} ב-${amountStr}₪ — אפשרי!*\n\n`
    : `⚠️ *${item} ב-${amountStr}₪ — צפוף.*\n\n`;

  msg += result.recommendation + '\n';

  if (result.impact.onGoals.length > 0) {
    msg += `\n🎯 השפעה על יעדים:\n`;
    for (const g of result.impact.onGoals) {
      msg += `• ${g.name}: עיכוב ${g.delayMonths} חודשים\n`;
    }
  }

  if (result.alternatives.length > 0) {
    msg += `\n💡 חלופות:\n`;
    for (const a of result.alternatives) {
      msg += `• ${a.option}: ${a.description}\n`;
    }
  }

  return msg;
}
