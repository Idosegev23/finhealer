import { createClient } from "@/lib/supabase/server";
import { createInsightReminder } from "./reminder-system";

/**
 * Financial Insights Generator
 * Analyzes user data to generate proactive insights
 */

export interface Insight {
  type: "overspending" | "savings_opportunity" | "upcoming_bills" | "goal_progress" | "pattern_detected" | "anomaly";
  priority: "high" | "medium" | "low";
  message: string;
  data: any;
  actionable: boolean;
  suggestedAction?: string;
}

/**
 * Generate all insights for user
 */
export async function generateInsights(userId: string): Promise<Insight[]> {
  const insights: Insight[] = [];

  // Run all insight generators
  insights.push(...(await detectOverspending(userId)));
  insights.push(...(await findSavingsOpportunities(userId)));
  insights.push(...(await analyzeUpcomingBills(userId)));
  insights.push(...(await checkGoalProgress(userId)));
  insights.push(...(await detectSpendingPatterns(userId)));
  insights.push(...(await detectAnomalies(userId)));

  // Sort by priority
  return insights.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Detect overspending in categories
 */
async function detectOverspending(userId: string): Promise<Insight[]> {
  const supabase = await createClient();
  const insights: Insight[] = [];

  // Get current month and previous month spending
  const currentMonth = new Date().toISOString().substring(0, 7);
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthStr = lastMonth.toISOString().substring(0, 7);

  const { data: categories } = await supabase
    .from("expense_categories")
    .select("id, name")
    .eq("active", true);

  if (!categories) return insights;

  for (const category of categories) {
    // Current month spending
    const { data: currentSpending } = await supabase
      .rpc("get_category_spending", {
        p_user_id: userId,
        p_category: category.name,
        p_month: currentMonth,
      });

    // Last month spending
    const { data: lastSpending } = await supabase
      .rpc("get_category_spending", {
        p_user_id: userId,
        p_category: category.name,
        p_month: lastMonthStr,
      });

    if (currentSpending && lastSpending && lastSpending > 0) {
      const increase = ((currentSpending - lastSpending) / lastSpending) * 100;

      if (increase > 30) {
        // More than 30% increase
        insights.push({
          type: "overspending",
          priority: "high",
          message: `הוצאות ${category.name} עלו ב-${Math.round(increase)}% החודש`,
          data: {
            category: category.name,
            percentage: Math.round(increase),
            current: currentSpending,
            previous: lastSpending,
          },
          actionable: true,
          suggestedAction: "לראות פירוט מפורט של ההוצאות בקטגוריה",
        });
      }
    }
  }

  return insights;
}

/**
 * Find savings opportunities
 */
async function findSavingsOpportunities(userId: string): Promise<Insight[]> {
  const supabase = await createClient();
  const insights: Insight[] = [];

  // Check for duplicate subscriptions
  const { data: subscriptions } = await supabase
    .from("transactions")
    .select("vendor, amount")
    .eq("user_id", userId)
    .eq("expense_frequency", "recurring")
    .eq("active", true);

  if (subscriptions) {
    // Group by similar vendors
    const vendorGroups = new Map<string, any[]>();
    
    for (const sub of subscriptions) {
      const vendor = sub.vendor.toLowerCase();
      
      if (!vendorGroups.has(vendor)) {
        vendorGroups.set(vendor, []);
      }
      
      vendorGroups.get(vendor)!.push(sub);
    }

    // Find duplicates
    for (const entry of Array.from(vendorGroups.entries())) {
      const [vendor, subs] = entry;
      if (subs.length > 1) {
        const total = subs.reduce((sum, s) => sum + s.amount, 0);
        
        insights.push({
          type: "savings_opportunity",
          priority: "medium",
          message: `יש ${subs.length} מנויים ל-${vendor} - אפשר לאחד?`,
          data: {
            vendor,
            count: subs.length,
            totalAmount: total,
          },
          actionable: true,
          suggestedAction: "לבדוק אם אפשר לבטל מנוי כפול",
        });
      }
    }
  }

  return insights;
}

/**
 * Analyze upcoming bills
 */
async function analyzeUpcomingBills(userId: string): Promise<Insight[]> {
  const supabase = await createClient();
  const insights: Insight[] = [];

  // Get next month's expected bills
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthStr = nextMonth.toISOString().substring(0, 7);

  const { data: bills } = await supabase
    .from("transactions")
    .select("amount, vendor, due_date")
    .eq("user_id", userId)
    .eq("expense_frequency", "recurring")
    .gte("due_date", `${nextMonthStr}-01`)
    .lte("due_date", `${nextMonthStr}-31`);

  if (bills && bills.length > 0) {
    const total = bills.reduce((sum, bill) => sum + bill.amount, 0);
    
    // Check if total is more than 50% of monthly income
    const { data: profile } = await supabase
      .from("user_financial_profile")
      .select("total_monthly_income")
      .eq("user_id", userId)
      .single();

    if (profile && total > profile.total_monthly_income * 0.5) {
      insights.push({
        type: "upcoming_bills",
        priority: "high",
        message: `חודש הבא יש ${bills.length} תשלומים גדולים (${total} ₪)`,
        data: {
          count: bills.length,
          total,
          bills: bills.map((b) => ({ vendor: b.vendor, amount: b.amount })),
        },
        actionable: true,
        suggestedAction: "לתכנן תקציב מראש",
      });
    }
  }

  return insights;
}

/**
 * Check goal progress
 */
async function checkGoalProgress(userId: string): Promise<Insight[]> {
  const supabase = await createClient();
  const insights: Insight[] = [];

  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");

  if (!goals) return insights;

  for (const goal of goals) {
    const progress = (goal.current_amount / goal.target_amount) * 100;
    const target_date = new Date(goal.target_date);
    const daysUntilTarget = Math.floor(
      (target_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    // Calculate if on track
    const expectedProgress = 100 - (daysUntilTarget / ((target_date.getTime() - new Date(goal.created_at).getTime()) / (1000 * 60 * 60 * 24))) * 100;

    if (progress < expectedProgress - 20) {
      // More than 20% behind
      insights.push({
        type: "goal_progress",
        priority: "medium",
        message: `היעד "${goal.name}" מפגר בלוח הזמנים`,
        data: {
          goalName: goal.name,
          progress,
          expectedProgress,
          ahead: false,
        },
        actionable: true,
        suggestedAction: "להגדיל חיסכון חודשי",
      });
    } else if (progress > expectedProgress + 20) {
      // More than 20% ahead
      insights.push({
        type: "goal_progress",
        priority: "low",
        message: `מעולה! היעד "${goal.name}" לפני לוח הזמנים!`,
        data: {
          goalName: goal.name,
          progress,
          expectedProgress,
          ahead: true,
        },
        actionable: false,
      });
    }
  }

  return insights;
}

/**
 * Detect spending patterns
 */
async function detectSpendingPatterns(userId: string): Promise<Insight[]> {
  const supabase = await createClient();
  const insights: Insight[] = [];

  // Check for Friday night spending pattern
  const { data: fridaySpending } = await supabase
    .from("transactions")
    .select("amount, date")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  if (fridaySpending) {
    const fridays = fridaySpending.filter((tx) => {
      const date = new Date(tx.date);
      return date.getDay() === 5; // Friday
    });

    if (fridays.length >= 8) {
      // At least 8 Fridays
      const avgFridaySpending =
        fridays.reduce((sum, tx) => sum + tx.amount, 0) / fridays.length;

      insights.push({
        type: "pattern_detected",
        priority: "low",
        message: `זיהיתי דפוס: בממוצע ${Math.round(avgFridaySpending)} ₪ בשישי`,
        data: {
          day: "שישי",
          average: Math.round(avgFridaySpending),
          frequency: fridays.length,
        },
        actionable: true,
        suggestedAction: "לתקצב מראש את ההוצאות של סוף השבוע",
      });
    }
  }

  return insights;
}

/**
 * Detect spending anomalies
 */
async function detectAnomalies(userId: string): Promise<Insight[]> {
  const supabase = await createClient();
  const insights: Insight[] = [];

  // Get last 90 days of spending
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, vendor, date")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("date", ninetyDaysAgo.toISOString());

  if (!transactions || transactions.length === 0) return insights;

  // Calculate average daily spending
  const totalSpending = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const avgDailySpending = totalSpending / 90;

  // Check last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentTransactions = transactions.filter(
    (tx) => new Date(tx.date) >= sevenDaysAgo
  );

  const recentSpending = recentTransactions.reduce(
    (sum, tx) => sum + tx.amount,
    0
  );

  const recentAvg = recentSpending / 7;

  // If recent spending is 50% higher than average
  if (recentAvg > avgDailySpending * 1.5) {
    insights.push({
      type: "anomaly",
      priority: "high",
      message: `ההוצאות השבוע גבוהות מהרגיל ב-${Math.round(((recentAvg - avgDailySpending) / avgDailySpending) * 100)}%`,
      data: {
        recentAvg: Math.round(recentAvg),
        normalAvg: Math.round(avgDailySpending),
        difference: Math.round(recentAvg - avgDailySpending),
      },
      actionable: true,
      suggestedAction: "לבדוק את ההוצאות האחרונות",
    });
  }

  return insights;
}

/**
 * Send insight as reminder
 */
export async function sendInsightAsReminder(
  userId: string,
  insight: Insight
): Promise<void> {
  await createInsightReminder(userId, insight.type as any, insight.data);
}

export default {
  generateInsights,
  sendInsightAsReminder,
};

