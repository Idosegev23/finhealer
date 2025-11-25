/**
 * Cron Job: Monthly Review
 * 
 * רץ ב-1 לכל חודש - שולח סיכום חודשי + ציון φ
 * 
 * Schedule: 0 9 1 * * (ב-1 לכל חודש ב-09:00)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "@/lib/greenapi/client";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron] Starting monthly review...");
  const startTime = Date.now();
  
  try {
    // Get all active users
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, phone, full_name")
      .in("phase", ["budget", "goals", "monitoring"])
      .not("phone", "is", null)
      .limit(100);

    if (usersError) {
      throw usersError;
    }

    console.log(`[Cron] Found ${users?.length || 0} users for monthly review`);

    let sentCount = 0;
    let errors = 0;

    for (const user of users || []) {
      try {
        // Generate monthly review
        const review = await generateMonthlyReview(user.id, user.full_name);
        
        if (review) {
          // Send via WhatsApp
          await sendWhatsAppMessage(user.phone, review);
          sentCount++;
        }
      } catch (error) {
        console.error(`[Cron] Error sending to user ${user.id}:`, error);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`[Cron] Monthly review complete:`, {
      sentCount,
      errors,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      success: true,
      sentCount,
      errors,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[Cron] Monthly review failed:", error);
    return NextResponse.json(
      { error: "Monthly review failed", details: String(error) },
      { status: 500 }
    );
  }
}

// ============================================================================
// Generate Monthly Review
// ============================================================================

async function generateMonthlyReview(userId: string, userName?: string): Promise<string | null> {
  // Get last month data
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  
  const lastMonthStr = lastMonth.toISOString().slice(0, 7);
  const startDate = `${lastMonthStr}-01`;
  const endDate = lastMonthEnd.toISOString().split("T")[0];

  // Get transactions
  const { data: transactions } = await supabaseAdmin
    .from("transactions")
    .select("amount, type, expense_category")
    .eq("user_id", userId)
    .gte("tx_date", startDate)
    .lte("tx_date", endDate);

  if (!transactions || transactions.length === 0) {
    return null;
  }

  // Calculate totals
  const expenses = transactions.filter(t => t.type === "expense");
  const income = transactions.filter(t => t.type === "income");
  
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpenses;

  // Get budget
  const { data: budget } = await supabaseAdmin
    .from("budgets")
    .select("*, budget_categories(*)")
    .eq("user_id", userId)
    .eq("month", lastMonthStr)
    .single();

  // Calculate φ Score
  const phiScore = calculatePhiScore(totalExpenses, totalIncome, budget);

  // Group by category
  const byCategory: Record<string, number> = {};
  for (const t of expenses) {
    const cat = t.expense_category || "אחר";
    byCategory[cat] = (byCategory[cat] || 0) + t.amount;
  }

  // Find successes and overages
  const successes: string[] = [];
  const overages: string[] = [];

  if (budget?.budget_categories) {
    for (const budgetCat of budget.budget_categories) {
      const spent = byCategory[budgetCat.category_name] || 0;
      const allocated = budgetCat.allocated_amount || 0;
      
      if (spent <= allocated) {
        successes.push(`${budgetCat.category_name}: ${formatCurrency(spent)} / ${formatCurrency(allocated)}`);
      } else {
        const overage = spent - allocated;
        overages.push(`${budgetCat.category_name}: ${formatCurrency(spent)} / ${formatCurrency(allocated)} (+${formatCurrency(overage)})`);
      }
    }
  }

  // Get goals progress
  const { data: goals } = await supabaseAdmin
    .from("goals")
    .select("name, target_amount, current_amount")
    .eq("user_id", userId)
    .eq("status", "active");

  // Build message
  const monthName = getHebrewMonthName(lastMonth.getMonth());
  const greeting = userName ? `היי ${userName}! ` : "";
  
  let msg = `🎉 ${greeting}${monthName} הסתיים!\n\n`;
  
  msg += `📊 **ציון φ: ${phiScore}/100** ${getPhiEmoji(phiScore)}\n\n`;
  
  msg += `💰 **סיכום:**\n`;
  msg += `הכנסות: ${formatCurrency(totalIncome)}\n`;
  msg += `הוצאות: ${formatCurrency(totalExpenses)}\n`;
  msg += `יתרה: ${balance >= 0 ? "+" : ""}${formatCurrency(balance)}\n\n`;
  
  if (budget) {
    const budgetUsage = Math.round((totalExpenses / budget.total_budget) * 100);
    msg += `📈 **תקציב:** ${budgetUsage}%\n\n`;
  }
  
  if (successes.length > 0) {
    msg += `⭐ **הצלחות:**\n`;
    for (const s of successes.slice(0, 3)) {
      msg += `✅ ${s}\n`;
    }
    msg += `\n`;
  }
  
  if (overages.length > 0) {
    msg += `⚠️ **חריגות:**\n`;
    for (const o of overages.slice(0, 3)) {
      msg += `${o}\n`;
    }
    msg += `\n`;
  }
  
  if (goals && goals.length > 0) {
    msg += `🎯 **יעדים:**\n`;
    for (const goal of goals.slice(0, 3)) {
      const progress = Math.round((goal.current_amount / goal.target_amount) * 100);
      msg += `${goal.name}: ${progress}%\n`;
    }
    msg += `\n`;
  }
  
  // Recommendation
  msg += `💡 **המלצה לחודש הבא:**\n`;
  if (overages.length > 0) {
    msg += `שים לב ל${overages[0].split(":")[0]} - נסה להפחית קצת.`;
  } else if (balance > 0) {
    msg += `מצוין! המשך ככה. שקול להעביר ${formatCurrency(Math.round(balance * 0.5))} לחיסכון.`;
  } else {
    msg += `נסה לאזן את ההוצאות עם ההכנסות.`;
  }
  
  msg += `\n\nחודש טוב! 💪`;
  
  return msg;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return `₪${Math.abs(amount).toLocaleString("he-IL")}`;
}

function calculatePhiScore(expenses: number, income: number, budget: any): number {
  let score = 50; // Base score
  
  // Income vs Expenses ratio (max 30 points)
  if (income > 0) {
    const ratio = (income - expenses) / income;
    score += Math.min(30, Math.max(0, ratio * 100));
  }
  
  // Budget adherence (max 20 points)
  if (budget?.total_budget && budget.total_budget > 0) {
    const budgetRatio = expenses / budget.total_budget;
    if (budgetRatio <= 1) {
      score += 20 * (1 - budgetRatio);
    } else {
      score -= 10 * (budgetRatio - 1);
    }
  }
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

function getPhiEmoji(score: number): string {
  if (score >= 90) return "🏆";
  if (score >= 80) return "⭐";
  if (score >= 70) return "👍";
  if (score >= 60) return "👌";
  if (score >= 50) return "💪";
  return "📈";
}

function getHebrewMonthName(month: number): string {
  const months = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
  ];
  return months[month];
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;

