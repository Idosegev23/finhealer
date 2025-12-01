/**
 * Cron Job: Weekly Summary
 * 
 * רץ כל יום ראשון בבוקר - שולח סיכום שבועי למשתמשים
 * 
 * Schedule: 0 9 * * 0 (כל יום ראשון ב-09:00)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGreenAPIClient } from "@/lib/greenapi/client";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const greenAPI = getGreenAPIClient();

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
        
        if (summary && user.phone) {
          // Send via WhatsApp
          await greenAPI.sendMessage({
            phoneNumber: user.phone,
            message: summary,
          });
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

  // Get user info including phi score
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("full_name, phi_score, current_phase")
    .eq("id", userId)
    .single();

  // Get transactions (using amount < 0 for expenses)
  const { data: transactions } = await supabaseAdmin
    .from("transactions")
    .select("amount, expense_category, date")
    .eq("user_id", userId)
    .eq("status", "approved")
    .gte("date", weekAgoStr)
    .lte("date", todayStr);

  if (!transactions || transactions.length === 0) {
    return null;
  }

  // Calculate totals
  const expenses = transactions.filter(t => t.amount < 0);
  const income = transactions.filter(t => t.amount > 0);
  
  const totalExpenses = Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0));
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);

  // Group by category
  const byCategory: Record<string, number> = {};
  for (const t of expenses) {
    const cat = t.expense_category || "אחר";
    byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
  }

  // Sort categories
  const sortedCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Get previous week for comparison
  const twoWeeksAgo = new Date(weekAgo);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
  
  const { data: prevTransactions } = await supabaseAdmin
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("status", "approved")
    .lt("amount", 0)
    .gte("date", twoWeeksAgo.toISOString().split("T")[0])
    .lt("date", weekAgoStr);
  
  const prevWeekExpenses = Math.abs(prevTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0);
  const changePercent = prevWeekExpenses > 0 
    ? Math.round(((totalExpenses - prevWeekExpenses) / prevWeekExpenses) * 100)
    : 0;

  // Build message
  const userName = user?.full_name?.split(' ')[0] || 'היי';
  let msg = `📊 *סיכום שבועי, ${userName}!*\n\n`;
  
  // Phi Score if available
  if (user?.phi_score) {
    const scoreEmoji = user.phi_score >= 80 ? '🌟' : user.phi_score >= 60 ? '👍' : '📈';
    msg += `${scoreEmoji} *ציון φ:* ${user.phi_score}/100\n\n`;
  }
  
  if (totalIncome > 0) {
    msg += `💰 הכנסות: ${formatCurrency(totalIncome)}\n`;
  }
  
  msg += `💸 הוצאות: ${formatCurrency(totalExpenses)}\n`;
  
  // Week over week comparison
  if (prevWeekExpenses > 0) {
    if (changePercent > 0) {
      msg += `📈 ${changePercent}% יותר מהשבוע שעבר\n`;
    } else if (changePercent < 0) {
      msg += `📉 ${Math.abs(changePercent)}% פחות מהשבוע שעבר 🎉\n`;
    } else {
      msg += `➡️ כמו השבוע שעבר\n`;
    }
  }
  
  // Balance
  const balance = totalIncome - totalExpenses;
  if (balance > 0) {
    msg += `✅ חסכת: ${formatCurrency(balance)}\n`;
  } else if (balance < 0 && totalIncome > 0) {
    msg += `⚠️ גירעון: ${formatCurrency(Math.abs(balance))}\n`;
  }
  
  msg += `\n🔝 *הוצאות לפי קטגוריה:*\n`;
  
  for (const [category, amount] of sortedCategories) {
    const percent = Math.round((amount / totalExpenses) * 100);
    msg += `• ${category}: ${formatCurrency(amount)} (${percent}%)\n`;
  }
  
  // Insight based on data
  const biggestCategory = sortedCategories[0];
  if (biggestCategory && biggestCategory[1] > totalExpenses * 0.35) {
    msg += `\n💡 *תובנה:* ${biggestCategory[0]} היא ${Math.round(biggestCategory[1] / totalExpenses * 100)}% מההוצאות. `;
    msg += `אפשר לחסוך שם?`;
  } else if (changePercent < -10) {
    msg += `\n💡 *כל הכבוד!* צמצמת הוצאות השבוע - המשך ככה!`;
  } else if (changePercent > 20) {
    msg += `\n💡 *שים לב:* עלייה משמעותית בהוצאות השבוע. רוצה לבדוק יחד?`;
  }
  
  msg += `\n\nשבוע טוב! 😊`;
  
  return msg;
}

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString("he-IL")}`;
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;

