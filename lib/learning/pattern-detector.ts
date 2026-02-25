import { createClient } from "@/lib/supabase/server";

/**
 * Pattern Detection Engine
 * Learns from user behavior to enable auto-categorization
 */

export interface Pattern {
  id: string;
  userId: string;
  patternType: "merchant" | "category" | "amount_range" | "day_of_week" | "time_of_day" | "subscription";
  patternKey: string;
  patternValue: any;
  confidenceScore: number;
  learnedFromCount: number;
  lastSeen: Date;
  autoApply: boolean;
}

export interface TransactionPattern {
  merchant?: string;
  category?: string;
  amount?: number;
  dayOfWeek?: number;
  timeOfDay?: string;
  description?: string;
}

/**
 * Detect patterns from transaction history
 */
export async function detectPatterns(userId: string): Promise<Pattern[]> {
  const supabase = await createClient();
  const patterns: Pattern[] = [];

  // Get user's transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("tx_date", { ascending: false })
    .limit(500); // Last 500 transactions

  if (!transactions || transactions.length === 0) {
    return patterns;
  }

  // Detect merchant patterns
  const merchantPatterns = await detectMerchantPatterns(transactions, userId);
  patterns.push(...merchantPatterns);

  // Detect amount range patterns
  const amountPatterns = await detectAmountPatterns(transactions, userId);
  patterns.push(...amountPatterns);

  // Detect day of week patterns
  const dayPatterns = await detectDayOfWeekPatterns(transactions, userId);
  patterns.push(...dayPatterns);

  // Detect subscription patterns
  const subscriptionPatterns = await detectSubscriptionPatterns(transactions, userId);
  patterns.push(...subscriptionPatterns);

  return patterns;
}

/**
 * Detect merchant → category patterns
 * E.g., "שופרסל" → "מזון" (3+ times)
 */
async function detectMerchantPatterns(
  transactions: any[],
  userId: string
): Promise<Pattern[]> {
  const merchantMap = new Map<string, { categories: string[]; count: number }>();

  for (const tx of transactions) {
    if (!tx.merchant_name || !tx.category) continue;

    const merchant = tx.merchant_name.trim().toLowerCase();
    
    if (!merchantMap.has(merchant)) {
      merchantMap.set(merchant, { categories: [], count: 0 });
    }

    const entry = merchantMap.get(merchant)!;
    entry.categories.push(tx.category);
    entry.count++;
  }

  const patterns: Pattern[] = [];

  Array.from(merchantMap.entries()).forEach(([merchant, data]) => {
    if (data.count < 3) return; // Need at least 3 occurrences

    // Find most common category
    const categoryCounts = new Map<string, number>();
    data.categories.forEach((cat) => {
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    });

    const sortedCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    const mostCommonCategory = sortedCategories[0][0];
    const categoryCount = sortedCategories[0][1];
    const confidence = categoryCount / data.count;

    if (confidence >= 0.6) {
      // At least 60% consistency
      patterns.push({
        id: `${userId}-merchant-${merchant}`,
        userId,
        patternType: "merchant",
        patternKey: merchant,
        patternValue: { category: mostCommonCategory },
        confidenceScore: confidence,
        learnedFromCount: data.count,
        lastSeen: new Date(),
        autoApply: confidence >= 0.8,
      });
    }
  });

  return patterns;
}

/**
 * Detect amount range patterns
 * E.g., 10-20 ₪ → usually "קפה/בילויים"
 */
async function detectAmountPatterns(
  transactions: any[],
  userId: string
): Promise<Pattern[]> {
  const patterns: Pattern[] = [];
  const ranges = [
    { min: 0, max: 30, label: "micro" },
    { min: 30, max: 100, label: "small" },
    { min: 100, max: 500, label: "medium" },
    { min: 500, max: 2000, label: "large" },
    { min: 2000, max: Infinity, label: "xlarge" },
  ];

  for (const range of ranges) {
    const txInRange = transactions.filter(
      (tx) => tx.amount >= range.min && tx.amount < range.max
    );

    if (txInRange.length < 10) continue; // Need at least 10 samples

    // Find most common category in this range
    const categoryCounts = new Map<string, number>();
    for (const tx of txInRange) {
      if (tx.category) {
        categoryCounts.set(tx.category, (categoryCounts.get(tx.category) || 0) + 1);
      }
    }

    const sortedCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    if (sortedCategories.length > 0) {
      const mostCommon = sortedCategories[0];
      const confidence = mostCommon[1] / txInRange.length;

      if (confidence >= 0.4) {
        // Lower threshold for amount patterns
        patterns.push({
          id: `${userId}-amount-${range.label}`,
          userId,
          patternType: "amount_range",
          patternKey: range.label,
          patternValue: {
            min: range.min,
            max: range.max,
            likely_category: mostCommon[0],
          },
          confidenceScore: confidence,
          learnedFromCount: txInRange.length,
          lastSeen: new Date(),
          autoApply: false, // Don't auto-apply amount patterns
        });
      }
    }
  }

  return patterns;
}

/**
 * Detect day of week patterns
 * E.g., Friday nights → "בילויים"
 */
async function detectDayOfWeekPatterns(
  transactions: any[],
  userId: string
): Promise<Pattern[]> {
  const patterns: Pattern[] = [];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (let day = 0; day < 7; day++) {
    const txOnDay = transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate.getDay() === day;
    });

    if (txOnDay.length < 5) continue; // Need at least 5 samples

    // Find most common category on this day
    const categoryCounts = new Map<string, number>();
    for (const tx of txOnDay) {
      if (tx.category) {
        categoryCounts.set(tx.category, (categoryCounts.get(tx.category) || 0) + 1);
      }
    }

    const sortedCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    if (sortedCategories.length > 0) {
      const mostCommon = sortedCategories[0];
      const confidence = mostCommon[1] / txOnDay.length;

      if (confidence >= 0.5) {
        patterns.push({
          id: `${userId}-day-${day}`,
          userId,
          patternType: "day_of_week",
          patternKey: day.toString(),
          patternValue: {
            day: dayNames[day],
            likely_category: mostCommon[0],
          },
          confidenceScore: confidence,
          learnedFromCount: txOnDay.length,
          lastSeen: new Date(),
          autoApply: false,
        });
      }
    }
  }

  return patterns;
}

/**
 * Detect recurring transactions (subscriptions)
 * Same amount, same merchant, recurring monthly/weekly
 */
async function detectSubscriptionPatterns(
  transactions: any[],
  userId: string
): Promise<Pattern[]> {
  const patterns: Pattern[] = [];
  
  // Group by merchant and amount
  const groupMap = new Map<string, any[]>();
  
  for (const tx of transactions) {
    if (!tx.merchant_name || !tx.amount) continue;
    
    const key = `${tx.merchant_name}-${Math.round(tx.amount)}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(tx);
  }

  Array.from(groupMap.entries()).forEach(([key, txs]) => {
    if (txs.length < 3) return; // Need at least 3 occurrences

    // Check if dates are evenly spaced (monthly)
    txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const intervals: number[] = [];
    for (let i = 1; i < txs.length; i++) {
      const days = Math.round(
        (new Date(txs[i].date).getTime() - new Date(txs[i - 1].date).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      intervals.push(days);
    }

    // Check if intervals are consistent (±7 days)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const isConsistent = intervals.every((interval) => Math.abs(interval - avgInterval) <= 7);

    if (isConsistent && (avgInterval >= 25 || avgInterval >= 6)) {
      // Monthly (25-35 days) or weekly (6-8 days)
      const frequency = avgInterval >= 25 ? "monthly" : "weekly";
      
      patterns.push({
        id: `${userId}-subscription-${key}`,
        userId,
        patternType: "subscription",
        patternKey: key,
        patternValue: {
          merchant: txs[0].merchant_name,
          amount: txs[0].amount,
          frequency,
          category: txs[0].category,
          next_expected: new Date(
            new Date(txs[txs.length - 1].date).getTime() +
              avgInterval * 24 * 60 * 60 * 1000
          ),
        },
        confidenceScore: 0.9,
        learnedFromCount: txs.length,
        lastSeen: new Date(txs[txs.length - 1].date),
        autoApply: true,
      });
    }
  });

  return patterns;
}

/**
 * Save patterns to database
 */
export async function savePatterns(patterns: Pattern[]): Promise<void> {
  const supabase = await createClient();

  for (const pattern of patterns) {
    await supabase
      .from("user_patterns")
      .upsert({
        user_id: pattern.userId,
        pattern_type: pattern.patternType,
        pattern_key: pattern.patternKey,
        pattern_value: pattern.patternValue,
        confidence_score: pattern.confidenceScore,
        learned_from_count: pattern.learnedFromCount,
        last_seen: pattern.lastSeen.toISOString(),
        auto_apply: pattern.autoApply,
      }, {
        onConflict: "user_id,pattern_type,pattern_key",
      });
  }
}

/**
 * Get patterns for a user
 */
export async function getUserPatterns(
  userId: string,
  minConfidence: number = 0.5
): Promise<Pattern[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_patterns")
    .select("*")
    .eq("user_id", userId)
    .gte("confidence_score", minConfidence)
    .order("confidence_score", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    userId: p.user_id,
    patternType: p.pattern_type,
    patternKey: p.pattern_key,
    patternValue: p.pattern_value,
    confidenceScore: p.confidence_score,
    learnedFromCount: p.learned_from_count,
    lastSeen: new Date(p.last_seen),
    autoApply: p.auto_apply,
  }));
}

/**
 * Match transaction against learned patterns
 */
export async function matchTransaction(
  userId: string,
  transaction: TransactionPattern
): Promise<{
  category?: string;
  confidence: number;
  matchedPattern?: Pattern;
}> {
  const patterns = await getUserPatterns(userId);

  // Try merchant match first (highest confidence)
  if (transaction.merchant) {
    const merchantPattern = patterns.find(
      (p) =>
        p.patternType === "merchant" &&
        p.patternKey === transaction.merchant?.toLowerCase()
    );

    if (merchantPattern) {
      return {
        category: merchantPattern.patternValue.category,
        confidence: merchantPattern.confidenceScore,
        matchedPattern: merchantPattern,
      };
    }
  }

  // Try subscription match
  if (transaction.merchant && transaction.amount) {
    const subKey = `${transaction.merchant}-${Math.round(transaction.amount)}`;
    const subPattern = patterns.find(
      (p) => p.patternType === "subscription" && p.patternKey === subKey
    );

    if (subPattern) {
      return {
        category: subPattern.patternValue.category,
        confidence: subPattern.confidenceScore,
        matchedPattern: subPattern,
      };
    }
  }

  // Try amount range match (lowest confidence)
  if (transaction.amount) {
    const amountPattern = patterns.find((p) => {
      if (p.patternType !== "amount_range") return false;
      return (
        transaction.amount! >= p.patternValue.min &&
        transaction.amount! < p.patternValue.max
      );
    });

    if (amountPattern) {
      return {
        category: amountPattern.patternValue.likely_category,
        confidence: amountPattern.confidenceScore * 0.7, // Reduce confidence for amount matches
        matchedPattern: amountPattern,
      };
    }
  }

  return { confidence: 0 };
}

/**
 * Update pattern with new data point
 */
export async function updatePattern(
  patternId: string,
  correct: boolean
): Promise<void> {
  const supabase = await createClient();

  if (correct) {
    // Increment count and boost confidence
    await supabase.rpc("increment_pattern_confidence", {
      p_pattern_id: patternId,
    });
  } else {
    // Reduce confidence
    await supabase.rpc("decrement_pattern_confidence", {
      p_pattern_id: patternId,
    });
  }
}

export default {
  detectPatterns,
  savePatterns,
  getUserPatterns,
  matchTransaction,
  updatePattern,
};

