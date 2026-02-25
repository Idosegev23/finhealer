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
      .select("id, phone, name, full_name")
      .in("phase", ["behavior", "budget", "goals", "monitoring"])
      .eq("wa_opt_in", true)
      .not("phone", "is", null)
      .limit(100);

    if (usersError) {
      throw usersError;
    }

    console.log(`[Cron] Found ${users?.length || 0} users to notify`);

    let sentCount = 0;
    let errors = 0;

    // 🚀 Batch load: all transactions for the last 2 weeks for all users upfront
    const userIds = (users || []).map(u => u.id);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(weekAgo);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
    const todayStr = new Date().toISOString().split("T")[0];
    const twoWeeksAgoStr = twoWeeksAgo.toISOString().split("T")[0];

    const { data: allTwoWeeksTx } = await supabaseAdmin
      .from("transactions")
      .select("user_id, amount, type, expense_category, tx_date")
      .eq("status", "confirmed")
      .gte("tx_date", twoWeeksAgoStr)
      .lte("tx_date", todayStr)
      .in("user_id", userIds);

    // Group by user_id in memory
    const txByUser = new Map<string, typeof allTwoWeeksTx>();
    for (const tx of allTwoWeeksTx || []) {
      if (!txByUser.has(tx.user_id)) txByUser.set(tx.user_id, []);
      txByUser.get(tx.user_id)!.push(tx);
    }

    for (const user of users || []) {
      try {
        // Generate weekly summary using pre-loaded data
        const summary = generateWeeklySummaryFromData(
          user.id,
          user.name || user.full_name,
          txByUser.get(user.id) || []
        );

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
// Generate Weekly Summary (using pre-loaded data - no DB calls!)
// ============================================================================

function generateWeeklySummaryFromData(
  userId: string,
  userName: string | null,
  allTransactions: Array<{ user_id: string; amount: number; type: string; expense_category: string; tx_date: string }>
): string | null {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  // Split into this week and last week
  const thisWeekTx = allTransactions.filter(t => t.tx_date >= weekAgoStr);
  const prevWeekTx = allTransactions.filter(t => t.tx_date < weekAgoStr);

  if (thisWeekTx.length === 0) {
    return null;
  }

  // Calculate totals - use type field for reliable categorization
  const expenses = thisWeekTx.filter(t => t.type === "expense" || t.amount < 0);
  const income = thisWeekTx.filter(t => t.type === "income" || (t.amount > 0 && t.type !== "expense"));

  const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalIncome = income.reduce((sum, t) => sum + Math.abs(t.amount), 0);

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

  // Previous week comparison
  const prevWeekExpenses = prevWeekTx
    .filter(t => t.type === "expense" || t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const changePercent = prevWeekExpenses > 0
    ? Math.round(((totalExpenses - prevWeekExpenses) / prevWeekExpenses) * 100)
    : 0;

  // Build message
  const displayName = userName?.split(' ')[0] || 'היי';
  let msg = `📊 *סיכום שבועי, ${displayName}!*\n\n`;

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

  // Weekly challenge - based on data patterns
  if (changePercent > 10) {
    msg += `\n\n💪 *אתגר השבוע:* נסה לחתוך 10% מההוצאות - זה ${formatCurrency(Math.round(totalExpenses * 0.1))} חיסכון!`;
  } else if (sortedCategories.length > 0) {
    const topCat = sortedCategories[0][0];
    msg += `\n\n🎯 *אתגר השבוע:* נסה לצמצם ${topCat} ב-15% - מה דעתך?`;
  } else {
    msg += `\n\n📊 כתוב *"תזרים"* לתחזית 3 חודשים קדימה 📈`;
  }

  msg += `\n\nשבוע טוב! 😊`;

  return msg;
}

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString("he-IL")}`;
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;

