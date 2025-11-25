import { NextRequest, NextResponse } from "next/server";
import { processDueReminders } from "@/lib/proactive/reminder-system";
import { generateInsights, sendInsightAsReminder } from "@/lib/proactive/insights-generator";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Cron Job: Process Due Reminders
 * 
 * Should be called every 15 minutes by Vercel Cron or similar
 * 
 * Vercel Cron config (vercel.json):
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/reminders",
 *       "schedule": "0,15,30,45 * * * *"
 *     }
 *   ]
 * }
 */

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("🕐 Cron: Processing due reminders...");

    // 1. Process and send due reminders
    const reminderResults = await processDueReminders();
    
    console.log(`✅ Sent ${reminderResults.sent} reminders`);
    console.log(`❌ Failed ${reminderResults.failed} reminders`);

    // 2. Generate and send proactive insights (once per day)
    const hour = new Date().getHours();
    
    if (hour === 9) {
      // Run at 9 AM
      await processProactiveInsights();
    }

    return NextResponse.json({
      success: true,
      remindersSent: reminderResults.sent,
      remindersFailed: reminderResults.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Cron error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Process proactive insights for all users
 */
async function processProactiveInsights(): Promise<void> {
  try {
    const supabase = createServiceClient();

    // Get all active users
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("wa_opt_in", true)
      .limit(100); // Process max 100 users per run

    if (!users) return;

    console.log(`📊 Generating insights for ${users.length} users...`);

    let insightsSent = 0;

    for (const user of users) {
      try {
        // Generate insights
        const insights = await generateInsights(user.id);

        // Send top priority insights only
        const topInsights = insights
          .filter((i) => i.priority === "high")
          .slice(0, 1); // Max 1 insight per day

        for (const insight of topInsights) {
          await sendInsightAsReminder(user.id, insight);
          insightsSent++;
        }
      } catch (error) {
        console.error(`Failed to process insights for user ${user.id}:`, error);
      }
    }

    console.log(`✅ Sent ${insightsSent} proactive insights`);
  } catch (error) {
    console.error("Failed to process proactive insights:", error);
  }
}

// For testing purposes
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, userId } = body;

  if (action === "test_insights" && userId) {
    const insights = await generateInsights(userId);
    
    return NextResponse.json({
      insights,
      count: insights.length,
    });
  }

  if (action === "test_reminder" && userId) {
    const results = await processDueReminders();
    
    return NextResponse.json({
      results,
    });
  }

  return NextResponse.json(
    { error: "Invalid action" },
    { status: 400 }
  );
}

