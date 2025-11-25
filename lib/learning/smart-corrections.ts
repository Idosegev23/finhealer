import { createClient } from "@/lib/supabase/server";
import { getUserPatterns, Pattern } from "./pattern-detector";

/**
 * Smart Corrections Learning
 * Learns from user corrections to improve future suggestions
 */

export interface Correction {
  id: string;
  userId: string;
  patternId?: string;
  originalValue: any;
  correctedValue: any;
  correctionType: "category" | "amount" | "merchant" | "description";
  transactionId?: string;
  createdAt: Date;
}

/**
 * Record a user correction
 */
export async function recordCorrection(
  userId: string,
  correctionType: Correction["correctionType"],
  originalValue: any,
  correctedValue: any,
  transactionId?: string,
  patternId?: string
): Promise<void> {
  try {
    const supabase = await createClient();

    // Save correction
    await supabase.from("pattern_corrections").insert({
      user_id: userId,
      pattern_id: patternId,
      original_value: originalValue,
      corrected_value: correctedValue,
      correction_type: correctionType,
      transaction_id: transactionId,
    });

    // Update or create pattern based on correction
    await learnFromCorrection(
      userId,
      correctionType,
      originalValue,
      correctedValue
    );

    // If pattern exists, adjust its confidence
    if (patternId) {
      await adjustPatternConfidence(patternId, false); // Correction means pattern was wrong
    }
  } catch (error) {
    console.error("Failed to record correction:", error);
  }
}

/**
 * Learn from correction and update patterns
 */
async function learnFromCorrection(
  userId: string,
  correctionType: string,
  originalValue: any,
  correctedValue: any
): Promise<void> {
  const supabase = await createClient();

  if (correctionType === "category") {
    // If user corrected a category, create or strengthen pattern
    const merchant = originalValue.merchant || correctedValue.merchant;
    
    if (merchant) {
      // Check if pattern exists
      const { data: existingPattern } = await supabase
        .from("user_patterns")
        .select("*")
        .eq("user_id", userId)
        .eq("pattern_type", "merchant")
        .eq("pattern_key", merchant.toLowerCase())
        .single();

      if (existingPattern) {
        // Update existing pattern
        const newCount = existingPattern.learned_from_count + 1;
        const currentCategory = existingPattern.pattern_value.category;
        
        if (currentCategory === correctedValue.category) {
          // Correction confirms pattern - increase confidence
          const newConfidence = Math.min(
            existingPattern.confidence_score + 0.1,
            1.0
          );
          
          await supabase
            .from("user_patterns")
            .update({
              confidence_score: newConfidence,
              learned_from_count: newCount,
              last_seen: new Date().toISOString(),
            })
            .eq("id", existingPattern.id);
        } else {
          // Correction contradicts pattern - decrease confidence
          const newConfidence = Math.max(
            existingPattern.confidence_score - 0.15,
            0.3
          );
          
          await supabase
            .from("user_patterns")
            .update({
              confidence_score: newConfidence,
              learned_from_count: newCount,
              last_seen: new Date().toISOString(),
            })
            .eq("id", existingPattern.id);
        }
      } else {
        // Create new pattern from correction
        await supabase.from("user_patterns").insert({
          user_id: userId,
          pattern_type: "merchant",
          pattern_key: merchant.toLowerCase(),
          pattern_value: { category: correctedValue.category },
          confidence_score: 0.6, // Start with medium confidence
          learned_from_count: 1,
          auto_apply: false,
        });
      }
    }
  }

  // Similar logic for amount, merchant, description corrections
  // TODO: Implement for other correction types
}

/**
 * Adjust pattern confidence based on correction
 */
async function adjustPatternConfidence(
  patternId: string,
  correct: boolean
): Promise<void> {
  const supabase = await createClient();

  const { data: pattern } = await supabase
    .from("user_patterns")
    .select("*")
    .eq("id", patternId)
    .single();

  if (!pattern) return;

  let newConfidence = pattern.confidence_score;
  
  if (correct) {
    // Pattern was correct - increase confidence
    newConfidence = Math.min(newConfidence + 0.05, 1.0);
  } else {
    // Pattern was wrong - decrease confidence
    newConfidence = Math.max(newConfidence - 0.1, 0.0);
  }

  // Update auto_apply based on new confidence
  const autoApply = newConfidence >= 0.85;

  await supabase
    .from("user_patterns")
    .update({
      confidence_score: newConfidence,
      auto_apply: autoApply,
      last_seen: new Date().toISOString(),
    })
    .eq("id", patternId);
}

/**
 * Get correction history for analysis
 */
export async function getCorrectionHistory(
  userId: string,
  limit: number = 50
): Promise<Correction[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("pattern_corrections")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map((c: any) => ({
      id: c.id,
      userId: c.user_id,
      patternId: c.pattern_id,
      originalValue: c.original_value,
      correctedValue: c.corrected_value,
      correctionType: c.correction_type,
      transactionId: c.transaction_id,
      createdAt: new Date(c.created_at),
    }));
  } catch (error) {
    console.error("Failed to get correction history:", error);
    return [];
  }
}

/**
 * Analyze correction patterns to identify problem areas
 */
export async function analyzeCorrectionPatterns(userId: string): Promise<{
  mostCorrectedCategory?: string;
  mostCorrectedMerchant?: string;
  averageCorrectionsPerWeek: number;
  accuracyScore: number;
}> {
  const corrections = await getCorrectionHistory(userId, 100);
  
  if (corrections.length === 0) {
    return {
      averageCorrectionsPerWeek: 0,
      accuracyScore: 1.0,
    };
  }

  // Find most corrected category
  const categoryCounts = new Map<string, number>();
  for (const c of corrections) {
    if (c.correctionType === "category") {
      const original = c.originalValue.category;
      categoryCounts.set(original, (categoryCounts.get(original) || 0) + 1);
    }
  }

  const mostCorrectedCategory = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  // Calculate corrections per week
  const oldestCorrection = corrections[corrections.length - 1];
  const weeksSince =
    (Date.now() - oldestCorrection.createdAt.getTime()) /
    (1000 * 60 * 60 * 24 * 7);
  const averageCorrectionsPerWeek = corrections.length / (weeksSince || 1);

  // Calculate accuracy score
  // Fewer corrections = higher accuracy
  const supabase = await createClient();
  const { count: totalTransactions } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const accuracyScore =
    totalTransactions && totalTransactions > 0
      ? 1 - corrections.length / totalTransactions
      : 1.0;

  return {
    mostCorrectedCategory,
    averageCorrectionsPerWeek,
    accuracyScore: Math.max(0, Math.min(1, accuracyScore)),
  };
}

/**
 * Get suggestion confidence based on past corrections
 */
export async function getSuggestionConfidence(
  userId: string,
  suggestedCategory: string,
  merchant?: string
): Promise<number> {
  const patterns = await getUserPatterns(userId);
  
  // If we have a merchant pattern, use its confidence
  if (merchant) {
    const merchantPattern = patterns.find(
      (p) =>
        p.patternType === "merchant" &&
        p.patternKey === merchant.toLowerCase() &&
        p.patternValue.category === suggestedCategory
    );

    if (merchantPattern) {
      return merchantPattern.confidenceScore;
    }
  }

  // Check correction history for this category
  const corrections = await getCorrectionHistory(userId, 100);
  const categoryCorrections = corrections.filter(
    (c) =>
      c.correctionType === "category" &&
      c.originalValue.category === suggestedCategory
  );

  // If this category has been corrected often, reduce confidence
  if (categoryCorrections.length > 5) {
    return 0.4; // Low confidence
  } else if (categoryCorrections.length > 2) {
    return 0.6; // Medium confidence
  }

  return 0.7; // Default confidence
}

/**
 * Batch process corrections for pattern updates
 */
export async function batchProcessCorrections(userId: string): Promise<void> {
  const corrections = await getCorrectionHistory(userId);
  
  // Group corrections by merchant/category
  const merchantCategoryMap = new Map<string, Map<string, number>>();

  for (const correction of corrections) {
    if (correction.correctionType !== "category") continue;

    const merchant = correction.correctedValue.merchant?.toLowerCase();
    const category = correction.correctedValue.category;

    if (!merchant || !category) continue;

    if (!merchantCategoryMap.has(merchant)) {
      merchantCategoryMap.set(merchant, new Map());
    }

    const categoryMap = merchantCategoryMap.get(merchant)!;
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
  }

  // Create or update patterns
  const supabase = await createClient();

  for (const entry of Array.from(merchantCategoryMap.entries())) {
    const [merchant, categoryMap] = entry;
    const sortedCategories = Array.from(categoryMap.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    const mostCommonCategory = sortedCategories[0];
    const totalCount = Array.from(categoryMap.values()).reduce(
      (a, b) => a + b,
      0
    );
    const confidence = mostCommonCategory[1] / totalCount;

    if (confidence >= 0.5 && totalCount >= 3) {
      // Strong enough pattern
      await supabase
        .from("user_patterns")
        .upsert({
          user_id: userId,
          pattern_type: "merchant",
          pattern_key: merchant,
          pattern_value: { category: mostCommonCategory[0] },
          confidence_score: confidence,
          learned_from_count: totalCount,
          auto_apply: confidence >= 0.8,
        }, {
          onConflict: "user_id,pattern_type,pattern_key",
        });
    }
  }
}

export default {
  recordCorrection,
  getCorrectionHistory,
  analyzeCorrectionPatterns,
  getSuggestionConfidence,
  batchProcessCorrections,
};

