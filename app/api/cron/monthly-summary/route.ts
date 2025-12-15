/**
 * Cron Job: Monthly Summary
 * 
 * רץ ב-1 לכל חודש ב-09:00 - שולח סיכום חודשי מקיף
 * 
 * Schedule: 0 9 1 * * (vercel.json)
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

  console.log("[Cron] Starting monthly summary...");
  const startTime = Date.now();
  
  try {
    // Get all active users with phone
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, phone, full_name")
      .not("phone", "is", null)
      .in("phase", ["behavior", "budget", "goals", "monitoring"])
      .limit(200);

    if (usersError) throw usersError;

    console.log(`[Cron] Found ${users?.length || 0} users for monthly summary`);

    let sentCount = 0;
    let errors = 0;

    for (const user of users || []) {
      try {
        const summary = await generateMonthlySummary(user.id, user.full_name);
        
        if (summary) {
          await sendWhatsAppMessage(user.phone, summary);
          sentCount++;
          
          // Rate limiting - 100ms between messages
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`[Cron] Error for user ${user.id}:`, error);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`[Cron] Monthly summary complete:`, { sentCount, errors, duration });

    return NextResponse.json({
      success: true,
      sentCount,
      errors,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[Cron] Monthly summary failed:", error);
    return NextResponse.json(
      { error: "Monthly summary failed", details: String(error) },
      { status: 500 }
    );
  }
}

// ============================================================================
// Generate Monthly Summary
// ============================================================================

async function generateMonthlySummary(
  userId: string, 
  userName?: string
): Promise<string | null> {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  
  const startDate = lastMonth.toISOString().split("T")[0];
  const endDate = lastMonthEnd.toISOString().split("T")[0];

  // Get transactions
  const { data: transactions } = await supabaseAdmin
    .from("transactions")
    .select(`
      amount, 
      type, 
      vendor,
      budget_categories (name)
    `)
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("tx_date", startDate)
    .lte("tx_date", endDate);

  if (!transactions || transactions.length < 5) {
    return null; // לא מספיק נתונים
  }

  // Calculate totals
  const income = transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const balance = income - expenses;
  const savingsRate = income > 0 ? ((balance / income) * 100) : 0;

  // Category breakdown (top 3)
  const byCategory: Record<string, number> = {};
  for (const t of transactions.filter(t => t.type === "expense")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catName = (t as any).budget_categories?.name || "אחר";
    byCategory[catName] = (byCategory[catName] || 0) + t.amount;
  }
  
  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  // Get previous month for comparison
  const prevMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, 1);
  const prevMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 0);
  
  const { data: prevTransactions } = await supabaseAdmin
    .from("transactions")
    .select("amount, type")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("tx_date", prevMonth.toISOString().split("T")[0])
    .lte("tx_date", prevMonthEnd.toISOString().split("T")[0]);

  const prevExpenses = (prevTransactions || [])
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenseChange = prevExpenses > 0 
    ? Math.round(((expenses - prevExpenses) / prevExpenses) * 100) 
    : 0;

  // Calculate φ Score (simplified)
  let phiScore = 50;
  if (income > 0) {
    phiScore += Math.min(30, Math.max(-20, savingsRate));
  }
  if (expenses > 0 && prevExpenses > 0) {
    if (expenses < prevExpenses) phiScore += 10;
    if (expenses > prevExpenses * 1.2) phiScore -= 10;
  }
  phiScore = Math.min(100, Math.max(0, Math.round(phiScore)));

  // Build message
  const monthName = getHebrewMonthName(lastMonth.getMonth());
  const greeting = userName ? `היי ${userName}! ` : "";
  
  let msg = `📊 ${greeting}*סיכום ${monthName}:*\n\n`;
  
  msg += `💰 *הכנסות:* ${formatCurrency(income)}\n`;
  msg += `💸 *הוצאות:* ${formatCurrency(expenses)}`;
  
  if (expenseChange !== 0) {
    const arrow = expenseChange > 0 ? "↑" : "↓";
    const emoji = expenseChange > 0 ? "" : " 👍";
    msg += ` (${arrow}${Math.abs(expenseChange)}%${emoji})`;
  }
  msg += `\n`;
  
  msg += `💵 *חסכון:* ${formatCurrency(balance)} (${savingsRate.toFixed(0)}%)\n\n`;
  
  // Top categories
  if (topCategories.length > 0) {
    msg += `*קטגוריות מובילות:*\n`;
    topCategories.forEach(([name, amount], i) => {
      msg += `${i + 1}. ${name}: ${formatCurrency(amount)}\n`;
    });
    msg += `\n`;
  }
  
  // φ Score
  msg += `*ציון φ:* ${phiScore}/100 ${getPhiEmoji(phiScore)}\n`;
  
  // Tip based on score
  if (phiScore >= 80) {
    msg += `\n🌟 מצוין! המשך ככה.`;
  } else if (phiScore >= 60) {
    msg += `\n💪 כיוון טוב! אפשר לשפר עוד.`;
  } else {
    msg += `\n📈 יש מה לשפר. בוא נדבר על זה?`;
  }
  
  msg += `\n\nחודש טוב! 🌸`;
  
  return msg;
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString("he-IL")} ₪`;
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

