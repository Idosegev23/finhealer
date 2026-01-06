/**
 * Behavior Detection Engine - Phase 2 של Phi
 * 
 * מנוע לזיהוי 5 סוגי דפוסי התנהגות:
 * 1. Recurring - מנויים וחיובים חוזרים
 * 2. Spikes - קפיצות בהוצאות
 * 3. Trends - מגמות עולות/יורדות
 * 4. Day Patterns - דפוסי יום בשבוע
 * 5. Seasonality - עונתיות
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getCategoryByName, type CategoryDef } from '@/lib/finance/categories';

// ============================================================================
// Types
// ============================================================================

export interface RecurringPattern {
  vendor: string;
  category: string | null;
  avgAmount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  occurrences: number;
  lastDate: string;
  nextExpected: string;
  variance: number; // % variance in amount
  confidence: number;
}

export interface SpikeDetection {
  transactionId: string;
  vendor: string;
  amount: number;
  date: string;
  avgAmount: number;
  spikeRatio: number; // e.g., 1.8 = 180% of average
  category: string | null;
}

export interface VendorTrend {
  vendor: string;
  category: string | null;
  trend: 'increasing' | 'decreasing' | 'stable';
  monthlyAverages: { month: string; avg: number }[];
  changePercent: number;
  transactionCount: number;
}

export interface DayPattern {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  dayName: string;
  totalSpend: number;
  avgSpend: number;
  transactionCount: number;
  topCategory: string | null;
}

export interface SeasonalPattern {
  month: string; // YYYY-MM
  totalSpend: number;
  avgPerTransaction: number;
  transactionCount: number;
  isOutlier: boolean;
  outlierType?: 'high' | 'low';
}

export interface VendorSummary {
  vendor: string;
  category: string | null;
  expenseType: 'fixed' | 'variable' | 'special';
  totalAmount: number;
  avgAmount: number;
  transactionCount: number;
  monthlyAvg: number;
  minAmount: number;
  maxAmount: number;
  firstDate: string;
  lastDate: string;
}

export interface BehaviorAnalysisResult {
  userId: string;
  analyzedAt: Date;
  periodMonths: number;
  transactionCount: number;
  
  // Detected patterns
  recurring: RecurringPattern[];
  spikes: SpikeDetection[];
  trends: VendorTrend[];
  dayPatterns: DayPattern[];
  seasonality: SeasonalPattern[];
  
  // Vendor summaries with auto-classification
  vendorSummaries: VendorSummary[];
  
  // Summary stats
  summary: {
    totalSpent: number;
    monthlyAverage: number;
    fixedExpenses: number;
    variableExpenses: number;
    specialExpenses: number;
    topVendors: { vendor: string; total: number }[];
    subscriptionTotal: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function calculateVariance(amounts: number[]): number {
  if (amounts.length < 2) return 0;
  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / amounts.length;
  return (Math.sqrt(variance) / avg) * 100; // Return as percentage
}

function normalizeVendor(vendor: string): string {
  return vendor
    .toLowerCase()
    .replace(/[0-9]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detect recurring payments (subscriptions, fixed charges)
 */
export async function detectRecurring(
  userId: string,
  transactions: any[]
): Promise<RecurringPattern[]> {
  const patterns: RecurringPattern[] = [];
  
  // Group by normalized vendor
  const vendorGroups = new Map<string, any[]>();
  for (const tx of transactions) {
    const key = normalizeVendor(tx.vendor || '');
    if (!key) continue;
    
    if (!vendorGroups.has(key)) {
      vendorGroups.set(key, []);
    }
    vendorGroups.get(key)!.push(tx);
  }
  
  for (const [vendorKey, txs] of Array.from(vendorGroups.entries())) {
    // Need at least 2 occurrences to detect pattern
    if (txs.length < 2) continue;
    
    const amounts = txs.map(t => t.amount);
    const variance = calculateVariance(amounts);
    
    // Low variance (< 15%) suggests recurring payment
    if (variance > 15) continue;
    
    // Check time intervals
    const dates = txs.map(t => new Date(t.tx_date || t.date)).sort((a, b) => a.getTime() - b.getTime());
    const intervals: number[] = [];
    
    for (let i = 1; i < dates.length; i++) {
      const daysDiff = Math.round((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(daysDiff);
    }
    
    if (intervals.length === 0) continue;
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // Determine frequency
    let frequency: 'weekly' | 'monthly' | 'quarterly' = 'monthly';
    if (avgInterval < 10) {
      frequency = 'weekly';
    } else if (avgInterval > 75) {
      frequency = 'quarterly';
    }
    
    // Calculate confidence based on variance and consistency
    const intervalVariance = calculateVariance(intervals);
    const confidence = Math.max(0, Math.min(1, 1 - (variance / 100) - (intervalVariance / 200)));
    
    if (confidence < 0.4) continue;
    
    const lastDate = dates[dates.length - 1];
    const daysToAdd = frequency === 'weekly' ? 7 : frequency === 'monthly' ? 30 : 90;
    const nextExpected = new Date(lastDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    patterns.push({
      vendor: txs[0].vendor,
      category: txs[0].category || txs[0].expense_category,
      avgAmount: amounts.reduce((a, b) => a + b, 0) / amounts.length,
      frequency,
      occurrences: txs.length,
      lastDate: lastDate.toISOString().split('T')[0],
      nextExpected: nextExpected.toISOString().split('T')[0],
      variance,
      confidence,
    });
  }
  
  return patterns.sort((a, b) => b.avgAmount - a.avgAmount);
}

/**
 * Detect spending spikes (unusual high amounts)
 */
export async function detectSpikes(
  userId: string,
  transactions: any[]
): Promise<SpikeDetection[]> {
  const spikes: SpikeDetection[] = [];
  
  // Group by normalized vendor
  const vendorGroups = new Map<string, any[]>();
  for (const tx of transactions) {
    const key = normalizeVendor(tx.vendor || '');
    if (!key) continue;
    
    if (!vendorGroups.has(key)) {
      vendorGroups.set(key, []);
    }
    vendorGroups.get(key)!.push(tx);
  }
  
  for (const [vendorKey, txs] of Array.from(vendorGroups.entries())) {
    if (txs.length < 3) continue; // Need enough data to determine average
    
    const amounts = txs.map(t => t.amount);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    
    // Find transactions that are 150%+ of average
    for (const tx of txs) {
      const ratio = tx.amount / avg;
      if (ratio >= 1.5) {
        spikes.push({
          transactionId: tx.id,
          vendor: tx.vendor,
          amount: tx.amount,
          date: tx.tx_date || tx.date,
          avgAmount: avg,
          spikeRatio: ratio,
          category: tx.category || tx.expense_category,
        });
      }
    }
  }
  
  return spikes.sort((a, b) => b.spikeRatio - a.spikeRatio);
}

/**
 * Detect spending trends per vendor
 */
export async function detectTrends(
  userId: string,
  transactions: any[]
): Promise<VendorTrend[]> {
  const trends: VendorTrend[] = [];
  
  // Group by normalized vendor
  const vendorGroups = new Map<string, any[]>();
  for (const tx of transactions) {
    const key = normalizeVendor(tx.vendor || '');
    if (!key) continue;
    
    if (!vendorGroups.has(key)) {
      vendorGroups.set(key, []);
    }
    vendorGroups.get(key)!.push(tx);
  }
  
  for (const [vendorKey, txs] of Array.from(vendorGroups.entries())) {
    if (txs.length < 3) continue;
    
    // Group by month
    const monthlyTotals = new Map<string, number[]>();
    for (const tx of txs) {
      const date = new Date(tx.tx_date || tx.date);
      const monthKey = getMonthKey(date);
      
      if (!monthlyTotals.has(monthKey)) {
        monthlyTotals.set(monthKey, []);
      }
      monthlyTotals.get(monthKey)!.push(tx.amount);
    }
    
    if (monthlyTotals.size < 2) continue;
    
    // Calculate monthly averages
    const monthlyAverages = Array.from(monthlyTotals.entries())
      .map(([month, amounts]) => ({
        month,
        avg: amounts.reduce((a, b) => a + b, 0) / amounts.length,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
    
    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let changePercent = 0;
    
    if (monthlyAverages.length >= 2) {
      const first = monthlyAverages[0].avg;
      const last = monthlyAverages[monthlyAverages.length - 1].avg;
      changePercent = ((last - first) / first) * 100;
      
      if (changePercent > 15) {
        trend = 'increasing';
      } else if (changePercent < -15) {
        trend = 'decreasing';
      }
    }
    
    trends.push({
      vendor: txs[0].vendor,
      category: txs[0].category || txs[0].expense_category,
      trend,
      monthlyAverages,
      changePercent,
      transactionCount: txs.length,
    });
  }
  
  return trends.filter(t => t.trend !== 'stable').sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

/**
 * Detect day-of-week spending patterns
 */
export async function detectDayPatterns(
  userId: string,
  transactions: any[]
): Promise<DayPattern[]> {
  const patterns: DayPattern[] = [];
  
  // Group by day of week
  const dayGroups: Map<number, any[]> = new Map();
  for (let i = 0; i < 7; i++) {
    dayGroups.set(i, []);
  }
  
  for (const tx of transactions) {
    const date = new Date(tx.tx_date || tx.date);
    const dayOfWeek = date.getDay();
    dayGroups.get(dayOfWeek)!.push(tx);
  }
  
  for (const [dayOfWeek, txs] of Array.from(dayGroups.entries())) {
    if (txs.length === 0) {
      patterns.push({
        dayOfWeek,
        dayName: HEBREW_DAYS[dayOfWeek],
        totalSpend: 0,
        avgSpend: 0,
        transactionCount: 0,
        topCategory: null,
      });
      continue;
    }
    
    const totalSpend = txs.reduce((sum, t) => sum + t.amount, 0);
    
    // Find top category for this day
    const categoryTotals = new Map<string, number>();
    for (const tx of txs) {
      const cat = tx.category || tx.expense_category || 'אחר';
      categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + tx.amount);
    }
    
    let topCategory: string | null = null;
    let maxAmount = 0;
    for (const [cat, total] of Array.from(categoryTotals.entries())) {
      if (total > maxAmount) {
        maxAmount = total;
        topCategory = cat;
      }
    }
    
    patterns.push({
      dayOfWeek,
      dayName: HEBREW_DAYS[dayOfWeek],
      totalSpend,
      avgSpend: totalSpend / txs.length,
      transactionCount: txs.length,
      topCategory,
    });
  }
  
  return patterns.sort((a, b) => b.totalSpend - a.totalSpend);
}

/**
 * Detect seasonal/monthly spending patterns
 */
export async function detectSeasonality(
  userId: string,
  transactions: any[]
): Promise<SeasonalPattern[]> {
  const patterns: SeasonalPattern[] = [];
  
  // Group by month
  const monthlyData = new Map<string, any[]>();
  for (const tx of transactions) {
    const date = new Date(tx.tx_date || tx.date);
    const monthKey = getMonthKey(date);
    
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, []);
    }
    monthlyData.get(monthKey)!.push(tx);
  }
  
  // Calculate stats for each month
  const monthlyStats: { month: string; total: number; count: number }[] = [];
  for (const [month, txs] of Array.from(monthlyData.entries())) {
    const total = txs.reduce((sum, t) => sum + t.amount, 0);
    monthlyStats.push({ month, total, count: txs.length });
  }
  
  if (monthlyStats.length < 2) {
    return monthlyStats.map(m => ({
      month: m.month,
      totalSpend: m.total,
      avgPerTransaction: m.count > 0 ? m.total / m.count : 0,
      transactionCount: m.count,
      isOutlier: false,
    }));
  }
  
  // Calculate overall average
  const overallAvg = monthlyStats.reduce((sum, m) => sum + m.total, 0) / monthlyStats.length;
  const stdDev = Math.sqrt(
    monthlyStats.reduce((sum, m) => sum + Math.pow(m.total - overallAvg, 2), 0) / monthlyStats.length
  );
  
  // Detect outliers (beyond 1.5 standard deviations)
  for (const m of monthlyStats) {
    const zScore = (m.total - overallAvg) / (stdDev || 1);
    const isOutlier = Math.abs(zScore) > 1.5;
    
    patterns.push({
      month: m.month,
      totalSpend: m.total,
      avgPerTransaction: m.count > 0 ? m.total / m.count : 0,
      transactionCount: m.count,
      isOutlier,
      outlierType: isOutlier ? (zScore > 0 ? 'high' : 'low') : undefined,
    });
  }
  
  return patterns.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Generate vendor summaries with auto expense type classification
 */
export async function generateVendorSummaries(
  userId: string,
  transactions: any[]
): Promise<VendorSummary[]> {
  const summaries: VendorSummary[] = [];
  
  // Group by normalized vendor
  const vendorGroups = new Map<string, any[]>();
  for (const tx of transactions) {
    const key = normalizeVendor(tx.vendor || '');
    if (!key) continue;
    
    if (!vendorGroups.has(key)) {
      vendorGroups.set(key, []);
    }
    vendorGroups.get(key)!.push(tx);
  }
  
  for (const [vendorKey, txs] of Array.from(vendorGroups.entries())) {
    const amounts = txs.map(t => t.amount);
    const dates = txs.map(t => new Date(t.tx_date || t.date)).sort((a, b) => a.getTime() - b.getTime());
    
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const monthSpan = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));
    
    const totalAmount = amounts.reduce((a, b) => a + b, 0);
    const category = txs[0].category || txs[0].expense_category;
    
    // Determine expense type from category
    let expenseType: 'fixed' | 'variable' | 'special' = 'variable';
    if (category) {
      const catDef = getCategoryByName(category);
      if (catDef) {
        expenseType = catDef.type;
      }
    }
    
    summaries.push({
      vendor: txs[0].vendor,
      category,
      expenseType,
      totalAmount,
      avgAmount: totalAmount / txs.length,
      transactionCount: txs.length,
      monthlyAvg: totalAmount / monthSpan,
      minAmount: Math.min(...amounts),
      maxAmount: Math.max(...amounts),
      firstDate: firstDate.toISOString().split('T')[0],
      lastDate: lastDate.toISOString().split('T')[0],
    });
  }
  
  return summaries.sort((a, b) => b.totalAmount - a.totalAmount);
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Run full behavior analysis for a user
 */
export async function runFullAnalysis(userId: string, periodMonths: number = 3): Promise<BehaviorAnalysisResult> {
  const supabase = createServiceClient();
  
  console.log(`[BehaviorEngine] Starting analysis for user ${userId}, period: ${periodMonths} months`);
  
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - periodMonths);
  
  // Fetch confirmed expense transactions
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .eq('type', 'expense')
    .gte('tx_date', startDate.toISOString().split('T')[0])
    .order('tx_date', { ascending: false });
  
  if (error) {
    console.error('[BehaviorEngine] Error fetching transactions:', error);
    throw error;
  }
  
  const txList = transactions || [];
  console.log(`[BehaviorEngine] Found ${txList.length} transactions`);
  
  if (txList.length === 0) {
    return createEmptyResult(userId, periodMonths);
  }
  
  // Run all detection algorithms in parallel
  const [recurring, spikes, trends, dayPatterns, seasonality, vendorSummaries] = await Promise.all([
    detectRecurring(userId, txList),
    detectSpikes(userId, txList),
    detectTrends(userId, txList),
    detectDayPatterns(userId, txList),
    detectSeasonality(userId, txList),
    generateVendorSummaries(userId, txList),
  ]);
  
  // Calculate summary stats
  const totalSpent = txList.reduce((sum, t) => sum + t.amount, 0);
  const fixedExpenses = vendorSummaries.filter(v => v.expenseType === 'fixed').reduce((sum, v) => sum + v.totalAmount, 0);
  const variableExpenses = vendorSummaries.filter(v => v.expenseType === 'variable').reduce((sum, v) => sum + v.totalAmount, 0);
  const specialExpenses = vendorSummaries.filter(v => v.expenseType === 'special').reduce((sum, v) => sum + v.totalAmount, 0);
  const subscriptionTotal = recurring.reduce((sum, r) => sum + r.avgAmount, 0);
  
  const result: BehaviorAnalysisResult = {
    userId,
    analyzedAt: new Date(),
    periodMonths,
    transactionCount: txList.length,
    recurring,
    spikes,
    trends,
    dayPatterns,
    seasonality,
    vendorSummaries,
    summary: {
      totalSpent,
      monthlyAverage: totalSpent / periodMonths,
      fixedExpenses,
      variableExpenses,
      specialExpenses,
      topVendors: vendorSummaries.slice(0, 5).map(v => ({ vendor: v.vendor, total: v.totalAmount })),
      subscriptionTotal,
    },
  };
  
  console.log(`[BehaviorEngine] Analysis complete:`, {
    recurring: recurring.length,
    spikes: spikes.length,
    trends: trends.length,
    vendorSummaries: vendorSummaries.length,
  });
  
  // Save insights to DB
  await saveAnalysisInsights(userId, result);
  
  return result;
}

/**
 * Create empty result when no data
 */
function createEmptyResult(userId: string, periodMonths: number): BehaviorAnalysisResult {
  return {
    userId,
    analyzedAt: new Date(),
    periodMonths,
    transactionCount: 0,
    recurring: [],
    spikes: [],
    trends: [],
    dayPatterns: [],
    seasonality: [],
    vendorSummaries: [],
    summary: {
      totalSpent: 0,
      monthlyAverage: 0,
      fixedExpenses: 0,
      variableExpenses: 0,
      specialExpenses: 0,
      topVendors: [],
      subscriptionTotal: 0,
    },
  };
}

/**
 * Save analysis insights to database
 */
async function saveAnalysisInsights(userId: string, analysis: BehaviorAnalysisResult): Promise<void> {
  const supabase = createServiceClient();
  
  const insights = [];
  
  // Add recurring patterns as insights
  for (const rec of analysis.recurring.slice(0, 5)) {
    insights.push({
      user_id: userId,
      insight_type: 'subscription_found',
      pattern: `recurring_${rec.vendor}`,
      title: `מנוי: ${rec.vendor}`,
      insight_text: `זיהיתי חיוב חוזר של ${rec.avgAmount.toFixed(0)}₪ ב${rec.frequency === 'monthly' ? 'כל חודש' : rec.frequency === 'weekly' ? 'כל שבוע' : 'כל רבעון'}`,
      priority: 'medium',
      data: rec,
      confidence: rec.confidence,
    });
  }
  
  // Add spikes as insights
  for (const spike of analysis.spikes.slice(0, 3)) {
    insights.push({
      user_id: userId,
      insight_type: 'spending_spike',
      pattern: `spike_${spike.vendor}_${spike.date}`,
      title: `קפיצה: ${spike.vendor}`,
      insight_text: `ב-${spike.date} הוצאת ${spike.amount.toFixed(0)}₪ - ${((spike.spikeRatio - 1) * 100).toFixed(0)}% יותר מהממוצע`,
      priority: spike.spikeRatio > 2 ? 'high' : 'medium',
      data: spike,
      confidence: 0.9,
    });
  }
  
  // Add trends as insights
  for (const trend of analysis.trends.slice(0, 3)) {
    if (trend.trend === 'increasing') {
      insights.push({
        user_id: userId,
        insight_type: 'category_trend',
        pattern: `trend_${trend.vendor}`,
        title: `מגמה עולה: ${trend.vendor}`,
        insight_text: `ההוצאות על ${trend.vendor} עלו ב-${trend.changePercent.toFixed(0)}%`,
        priority: trend.changePercent > 30 ? 'high' : 'medium',
        data: trend,
        confidence: 0.8,
      });
    }
  }
  
  if (insights.length > 0) {
    const { error } = await supabase
      .from('behavior_insights')
      .upsert(insights, { onConflict: 'user_id,pattern' });
    
    if (error) {
      console.error('[BehaviorEngine] Error saving insights:', error);
    } else {
      console.log(`[BehaviorEngine] Saved ${insights.length} insights`);
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  runFullAnalysis,
  detectRecurring,
  detectSpikes,
  detectTrends,
  detectDayPatterns,
  detectSeasonality,
  generateVendorSummaries,
};

