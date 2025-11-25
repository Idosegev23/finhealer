/**
 * Cron Job: Analyze Patterns
 * 
 * רץ יומית - מזהה דפוסי הוצאה של משתמשים
 * 
 * Schedule: 0 2 * * * (כל יום ב-02:00)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectPatterns, savePatterns } from "@/lib/learning/pattern-detector";

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

  console.log("[Cron] Starting pattern analysis...");
  const startTime = Date.now();
  
  try {
    // Get all active users who have transactions
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id")
      .in("phase", ["behavior", "budget", "goals", "monitoring"])
      .limit(100);

    if (usersError) {
      throw usersError;
    }

    console.log(`[Cron] Found ${users?.length || 0} users to analyze`);

    let processedCount = 0;
    let patternsFound = 0;
    let errors = 0;

    for (const user of users || []) {
      try {
        // Detect patterns for this user
        const patterns = await detectPatterns(user.id);
        
        if (patterns.length > 0) {
          // Save patterns to database
          await savePatterns(patterns);
          patternsFound += patterns.length;
        }

        processedCount++;
      } catch (error) {
        console.error(`[Cron] Error processing user ${user.id}:`, error);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`[Cron] Pattern analysis complete:`, {
      processedCount,
      patternsFound,
      errors,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      success: true,
      processedUsers: processedCount,
      patternsFound,
      errors,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[Cron] Pattern analysis failed:", error);
    return NextResponse.json(
      { error: "Pattern analysis failed", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

