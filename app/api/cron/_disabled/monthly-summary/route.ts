/**
 * Cron Job: Monthly Summary
 * 
 * רץ ב-1 לכל חודש ב-09:00 - שולח סיכום חודשי מקיף
 * 
 * Schedule: 0 9 1 * * (vercel.json)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage, sendWhatsAppImage } from "@/lib/greenapi/client";
import { generateChartForUser } from "@/lib/ai/chart-generator";
import { isQuietTime } from '@/lib/utils/quiet-hours';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quietCheck = isQuietTime();
  if (quietCheck.isQuiet) {
    console.log(`[Cron] Skipped — ${quietCheck.description}`);
    return NextResponse.json({ skipped: true, reason: quietCheck.description });
  }

  console.log("[Cron] Starting monthly summary...");
  const startTime = Date.now();
  
  try {
    // Get all active users with phone
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, phone, name, full_name")
      .not("phone", "is", null)
      .eq("wa_opt_in", true)
      .in("phase", ["behavior", "budget", "goals", "monitoring"])
      .limit(200);

    if (usersError) throw usersError;

    console.log(`[Cron] Found ${users?.length || 0} users for monthly summary`);

    // 🔧 Batch load transactions for all users (avoid N+1)
    const userIds = (users || []).map(u => u.id);
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const prevMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, 1);
    const prevMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 0);

    const [{ data: allCurrentTx }, { data: allPrevTx }] = await Promise.all([
      supabaseAdmin
        .from("transactions")
        .select("user_id, amount, type, vendor, budget_categories (name)")
        .in("user_id", userIds)
        .eq("status", "confirmed")
        .or('is_summary.is.null,is_summary.eq.false')
        .gte("tx_date", lastMonth.toISOString().split("T")[0])
        .lte("tx_date", lastMonthEnd.toISOString().split("T")[0]),
      supabaseAdmin
        .from("transactions")
        .select("user_id, amount, type")
        .in("user_id", userIds)
        .eq("status", "confirmed")
        .or('is_summary.is.null,is_summary.eq.false')
        .gte("tx_date", prevMonth.toISOString().split("T")[0])
        .lte("tx_date", prevMonthEnd.toISOString().split("T")[0]),
    ]);

    // Group by user_id
    const currentTxByUser = new Map<string, any[]>();
    const prevTxByUser = new Map<string, any[]>();
    for (const tx of allCurrentTx || []) {
      const arr = currentTxByUser.get(tx.user_id) || [];
      arr.push(tx);
      currentTxByUser.set(tx.user_id, arr);
    }
    for (const tx of allPrevTx || []) {
      const arr = prevTxByUser.get(tx.user_id) || [];
      arr.push(tx);
      prevTxByUser.set(tx.user_id, arr);
    }

    console.log(`[Cron] Batch loaded ${(allCurrentTx || []).length} current + ${(allPrevTx || []).length} prev month transactions`);

    let sentCount = 0;
    let errors = 0;

    for (const user of users || []) {
      try {
        const userTransactions = currentTxByUser.get(user.id) || [];
        const userPrevTransactions = prevTxByUser.get(user.id) || [];
        const summary = generateMonthlySummaryFromData(
          userTransactions, userPrevTransactions, user.name || user.full_name
        );

        if (summary) {
          // שלח הודעת טקסט
          await sendWhatsAppMessage(user.phone, summary);
          sentCount++;
          
          // נסה ליצור אינפוגרפיקה ויזואלית
          try {
            const infographic = await generateChartForUser(user.id, 'monthly_infographic');
            if (infographic) {
              await sendWhatsAppImage(
                user.phone, 
                infographic.base64, 
                '📊 הסיכום החודשי שלך בגרף אחד'
              );
              console.log(`[Cron] Infographic sent to user ${user.id}`);
            }
          } catch (chartError) {
            // לא קריטי - ממשיכים גם בלי גרף
            console.warn(`[Cron] Chart generation failed for ${user.id}:`, chartError);
          }
          
          // Rate limiting - 500ms between users (יותר זמן כי יש 2 הודעות)
          await new Promise(resolve => setTimeout(resolve, 500));
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
// Generate Monthly Summary (from pre-loaded data - no N+1 queries)
// ============================================================================

function generateMonthlySummaryFromData(
  transactions: any[],
  prevTransactions: any[],
  userName?: string
): string | null {
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
    const txWithCategory = t as unknown as { amount: number; type: string; vendor: string; budget_categories?: { name: string } };
    const catName = txWithCategory.budget_categories?.name || "אחר";
    byCategory[catName] = (byCategory[catName] || 0) + t.amount;
  }

  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

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
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
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

