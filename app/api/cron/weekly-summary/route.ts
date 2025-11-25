/**
 * Cron Job: Weekly Summary
 * 
 * רץ כל יום ראשון בבוקר - שולח סיכום שבועי למשתמשים
 * 
 * Schedule: 0 9 * * 0 (כל יום ראשון ב-09:00)
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

  console.log("[Cron] Starting weekly summary...");
  const startTime = Date.now();
  
  try {
    // Get all active users with phone numbers
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, phone, full_name")
      .in("phase", ["behavior", "budget", "goals", "monitoring"])
      .not("phone", "is", null)
      .limit(100);

    if (usersError) {
      throw usersError;
    }

    console.log(`[Cron] Found ${users?.length || 0} users to notify`);

    let sentCount = 0;
    let errors = 0;

    for (const user of users || []) {
      try {
        // Generate weekly summary
        const summary = await generateWeeklySummary(user.id);
        
        if (summary) {
          // Send via WhatsApp
          await sendWhatsAppMessage(user.phone, summary);
          sentCount++;
        }
      } catch (error) {
        console.error(`[Cron] Error sending to user ${user.id}:`, error);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`[Cron] Weekly summary complete:`, {
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
    console.error("[Cron] Weekly summary failed:", error);
    return NextResponse.json(
      { error: "Weekly summary failed", details: String(error) },
      { status: 500 }
    );
  }
}

// ============================================================================
// Generate Weekly Summary
// ============================================================================

async function generateWeeklySummary(userId: string): Promise<string | null> {
  // Get last 7 days data
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];

  // Get transactions
  const { data: transactions } = await supabaseAdmin
    .from("transactions")
    .select("amount, type, expense_category")
    .eq("user_id", userId)
    .gte("tx_date", weekAgoStr)
    .lte("tx_date", todayStr);

  if (!transactions || transactions.length === 0) {
    return null;
  }

  // Calculate totals
  const expenses = transactions.filter(t => t.type === "expense");
  const income = transactions.filter(t => t.type === "income");
  
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);

  // Group by category
  const byCategory: Record<string, number> = {};
  for (const t of expenses) {
    const cat = t.expense_category || "אחר";
    byCategory[cat] = (byCategory[cat] || 0) + t.amount;
  }

  // Sort categories
  const sortedCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Get budget for comparison
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: budget } = await supabaseAdmin
    .from("budgets")
    .select("total_budget")
    .eq("user_id", userId)
    .eq("month", currentMonth)
    .single();

  const weeklyBudget = budget ? Math.round(budget.total_budget / 4) : null;

  // Build message
  let msg = `📊 **סיכום שבועי:**\n\n`;
  
  if (totalIncome > 0) {
    msg += `💰 הכנסות: ${formatCurrency(totalIncome)}\n`;
  }
  
  msg += `💸 הוצאות: ${formatCurrency(totalExpenses)}\n`;
  
  if (weeklyBudget) {
    const percentage = Math.round((totalExpenses / weeklyBudget) * 100);
    const status = percentage > 100 ? "⚠️" : percentage > 80 ? "🟡" : "✅";
    msg += `📈 מתקציב שבועי: ${percentage}% ${status}\n`;
  }
  
  msg += `\n🔝 **הוצאות לפי קטגוריה:**\n`;
  
  for (const [category, amount] of sortedCategories) {
    msg += `• ${category}: ${formatCurrency(amount)}\n`;
  }
  
  // Add tip
  const biggestCategory = sortedCategories[0];
  if (biggestCategory) {
    msg += `\n💡 **טיפ:** הקטגוריה הגדולה ביותר השבוע היא "${biggestCategory[0]}".`;
    if (biggestCategory[1] > totalExpenses * 0.3) {
      msg += ` זה ${Math.round(biggestCategory[1] / totalExpenses * 100)}% מההוצאות - שווה לשים לב!`;
    }
  }
  
  msg += `\n\nשבוע טוב! 😊`;
  
  return msg;
}

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString("he-IL")}`;
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;

