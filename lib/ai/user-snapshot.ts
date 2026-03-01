/**
 * User Financial Snapshot Builder
 *
 * Builds a rich context string from ALL available user data so the AI
 * can have truly intelligent, contextual conversations.
 *
 * Instead of: "שם: ישראל, הוצאות: 4500₪"
 * The AI gets: full financial picture, pending actions, trends, goals progress
 *
 * ~6-8 parallel queries, cached per message cycle.
 */

import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface UserSnapshot {
  /** Compact text context for AI system prompts (~300-500 tokens) */
  contextText: string;
  /** Structured data for programmatic access */
  data: SnapshotData;
}

interface SnapshotData {
  name: string;
  phase: string;
  state: string;
  daysSinceJoined: number;
  // Transactions
  confirmedCount: number;
  pendingCount: number;
  currentMonthIncome: number;
  currentMonthExpenses: number;
  topCategories: { name: string; amount: number }[];
  // Goals
  activeGoals: { name: string; progress: number; remaining: number }[];
  // Budget
  budgetUsedPercent: number | null;
  budgetOverCategories: string[];
  // Documents
  coveredMonths: number;
  // Actions needed
  pendingActions: string[];
}

// ============================================================================
// In-memory cache (per request cycle in serverless)
// ============================================================================

const snapshotCache = new Map<string, { snapshot: UserSnapshot; ts: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds (within same message processing)

// ============================================================================
// Main Function
// ============================================================================

export async function buildUserSnapshot(userId: string): Promise<UserSnapshot> {
  // Check cache
  const cached = snapshotCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.snapshot;
  }

  const supabase = createServiceClient();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  // Run all queries in parallel
  const [
    userResult,
    currentMonthTxResult,
    pendingTxResult,
    confirmedCountResult,
    goalsResult,
    budgetResult,
    budgetCategoriesResult,
    loansResult,
    docsResult,
    duplicatesResult,
    creditPendingResult,
    insightsResult,
  ] = await Promise.all([
    // 1. User basics
    supabase
      .from('users')
      .select('name, full_name, phase, onboarding_state, created_at')
      .eq('id', userId)
      .single(),

    // 2. Current month transactions (confirmed)
    supabase
      .from('transactions')
      .select('amount, type, category')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .gte('tx_date', monthStart),

    // 3. Pending transactions count
    supabase
      .from('transactions')
      .select('id, type')
      .eq('user_id', userId)
      .eq('status', 'pending'),

    // 4. Total confirmed count
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'confirmed'),

    // 5. Active goals
    supabase
      .from('goals')
      .select('name, target_amount, current_amount, monthly_allocation, deadline')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('priority', { ascending: true }),

    // 6. Current month budget
    supabase
      .from('budgets')
      .select('total_budget, total_spent, savings_goal')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .single(),

    // 7. Budget categories (current month, over budget)
    supabase
      .from('budget_categories')
      .select('category_name, allocated_amount, spent_amount')
      .eq('user_id', userId)
      .eq('month', currentMonth),

    // 8. Active loans
    supabase
      .from('loans')
      .select('loan_type, current_balance, monthly_payment')
      .eq('user_id', userId)
      .eq('status', 'active'),

    // 9. Documents uploaded
    supabase
      .from('uploaded_statements')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),

    // 10. Duplicate suspects
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'duplicate_suspect'),

    // 11. Needs credit detail
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'needs_credit_detail'),

    // 12. Unseen insights
    supabase
      .from('behavior_insights')
      .select('title, priority')
      .eq('user_id', userId)
      .eq('seen', false)
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  // ── Process results ────────────────────────────────────────────────────────

  const user = userResult.data;
  const userName = user?.name || user?.full_name || 'משתמש';
  const daysSinceJoined = user?.created_at
    ? Math.floor((now.getTime() - new Date(user.created_at).getTime()) / 86400000)
    : 0;

  // Current month income & expenses
  const monthTx = currentMonthTxResult.data || [];
  const currentMonthIncome = monthTx
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const currentMonthExpenses = monthTx
    .filter(t => t.type === 'expense' || t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Top expense categories
  const categoryMap = new Map<string, number>();
  monthTx
    .filter(t => t.type === 'expense' || t.amount < 0)
    .forEach(t => {
      const cat = t.category || 'לא מסווג';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + Math.abs(t.amount));
    });
  const topCategories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  // Pending
  const pendingTx = pendingTxResult.data || [];
  const pendingCount = pendingTx.length;
  const confirmedCount = confirmedCountResult.count || 0;

  // Goals
  const goals = goalsResult.data || [];
  const activeGoals = goals.map(g => ({
    name: g.name,
    progress: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0,
    remaining: Math.max(0, g.target_amount - g.current_amount),
  }));

  // Budget
  const budget = budgetResult.data;
  const budgetUsedPercent = budget && budget.total_budget > 0
    ? Math.round((budget.total_spent / budget.total_budget) * 100)
    : null;

  const budgetCategories = budgetCategoriesResult.data || [];
  const budgetOverCategories = budgetCategories
    .filter(c => c.allocated_amount > 0 && c.spent_amount > c.allocated_amount)
    .map(c => c.category_name);

  // Loans
  const loans = loansResult.data || [];
  const totalDebt = loans.reduce((sum, l) => sum + (l.current_balance || 0), 0);
  const totalMonthlyPayments = loans.reduce((sum, l) => sum + (l.monthly_payment || 0), 0);

  // Documents
  const docsCount = docsResult.count || 0;

  // Duplicates & credit
  const duplicatesCount = duplicatesResult.count || 0;
  const creditPendingCount = creditPendingResult.count || 0;

  // Insights
  const unseenInsights = insightsResult.data || [];

  // ── Build pending actions list ─────────────────────────────────────────────

  const pendingActions: string[] = [];

  if (pendingCount > 0) {
    pendingActions.push(`${pendingCount} תנועות ממתינות לסיווג`);
  }
  if (duplicatesCount > 0) {
    pendingActions.push(`${duplicatesCount} חשודות ככפילויות`);
  }
  if (creditPendingCount > 0) {
    pendingActions.push(`${creditPendingCount} ממתינות לפירוט אשראי`);
  }
  if (budgetOverCategories.length > 0) {
    pendingActions.push(`חריגה מתקציב ב: ${budgetOverCategories.join(', ')}`);
  }
  if (unseenInsights.length > 0) {
    pendingActions.push(`${unseenInsights.length} תובנות חדשות`);
  }

  // ── Build context text ─────────────────────────────────────────────────────

  let ctx = `[פרופיל]\n`;
  ctx += `שם: ${userName}. לקוח ${daysSinceJoined} יום. שלב: ${user?.phase || 'לא ידוע'}.\n`;
  ctx += `מסמכים: ${docsCount} הועלו.\n\n`;

  ctx += `[חודש נוכחי]\n`;
  ctx += `הכנסות: ₪${currentMonthIncome.toLocaleString('he-IL')}. `;
  ctx += `הוצאות: ₪${currentMonthExpenses.toLocaleString('he-IL')}. `;
  const balance = currentMonthIncome - currentMonthExpenses;
  ctx += `יתרה: ${balance >= 0 ? '+' : ''}₪${balance.toLocaleString('he-IL')}.\n`;

  if (topCategories.length > 0) {
    ctx += `הוצאות עיקריות: ${topCategories.map(c => `${c.name} ₪${c.amount.toLocaleString('he-IL')}`).join(', ')}.\n`;
  }

  if (budgetUsedPercent !== null) {
    ctx += `תקציב: ${budgetUsedPercent}% נוצל`;
    if (budget?.savings_goal) {
      ctx += `, יעד חיסכון: ₪${budget.savings_goal.toLocaleString('he-IL')}`;
    }
    ctx += `.\n`;
    if (budgetOverCategories.length > 0) {
      ctx += `⚠ חריגה ב: ${budgetOverCategories.join(', ')}.\n`;
    }
  }

  ctx += `\n`;

  if (activeGoals.length > 0) {
    ctx += `[יעדים]\n`;
    activeGoals.forEach(g => {
      ctx += `• ${g.name}: ${g.progress}% (חסר ₪${g.remaining.toLocaleString('he-IL')})\n`;
    });
    ctx += `\n`;
  }

  if (loans.length > 0) {
    ctx += `[חובות]\n`;
    ctx += `${loans.length} הלוואות, סה"כ ₪${totalDebt.toLocaleString('he-IL')}, תשלום חודשי ₪${totalMonthlyPayments.toLocaleString('he-IL')}.\n\n`;
  }

  ctx += `[תנועות]\n`;
  ctx += `${confirmedCount} מסווגות`;
  if (pendingCount > 0) ctx += `, ${pendingCount} ממתינות`;
  ctx += `.\n`;

  if (pendingActions.length > 0) {
    ctx += `\n[פעולות ממתינות]\n`;
    pendingActions.forEach(a => {
      ctx += `• ${a}\n`;
    });
  }

  // ── Build structured data ──────────────────────────────────────────────────

  const snapshotData: SnapshotData = {
    name: userName,
    phase: user?.phase || 'unknown',
    state: user?.onboarding_state || 'unknown',
    daysSinceJoined,
    confirmedCount,
    pendingCount,
    currentMonthIncome,
    currentMonthExpenses,
    topCategories,
    activeGoals,
    budgetUsedPercent,
    budgetOverCategories,
    coveredMonths: docsCount,
    pendingActions,
  };

  const snapshot: UserSnapshot = {
    contextText: ctx,
    data: snapshotData,
  };

  // Cache
  snapshotCache.set(userId, { snapshot, ts: Date.now() });

  return snapshot;
}
