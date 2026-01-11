/**
 * Income Forecaster - חיזוי הכנסות עתידיות
 * 
 * מחשב חיזויים להכנסות עתידיות על בסיס:
 * - ממוצע היסטורי
 * - דפוסים עונתיים
 * - מגמות
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { IncomeForecast, IncomeForecastBasis } from '@/types/goals';

interface ForecastOptions {
  months?: number; // כמה חודשים קדימה (ברירת מחדל: 12)
  includeSeasonality?: boolean; // האם לכלול עונתיות (ברירת מחדל: true)
  confidenceThreshold?: number; // רף ביטחון מינימלי (ברירת מחדל: 0.6)
}

/**
 * פונקציה ראשית - חיזוי הכנסות
 */
export async function forecastIncome(
  userId: string,
  options: ForecastOptions = {}
): Promise<IncomeForecast[]> {
  const {
    months = 12,
    includeSeasonality = true,
    confidenceThreshold = 0.6,
  } = options;
  
  const supabase = createServiceClient();
  
  // שלוף תנועות הכנסה היסטוריות (12 חודשים אחרונים)
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('amount, date, income_category')
    .eq('user_id', userId)
    .eq('type', 'income')
    .gte('date', getDateMonthsAgo(12))
    .order('date', { ascending: true });
  
  if (error || !transactions || transactions.length === 0) {
    // אין נתונים - נסה לשלוף מהצהרה
    return await generateForecastFromProfile(userId, months);
  }
  
  // קבץ לפי חודש
  const monthlyIncomes = groupByMonth(transactions);
  
  // חשב ממוצע, מגמה ועונתיות
  const average = calculateAverage(monthlyIncomes);
  const trend = calculateTrend(monthlyIncomes);
  const seasonality = includeSeasonality ? calculateSeasonality(monthlyIncomes) : {};
  
  // צור חיזויים
  const forecasts: IncomeForecast[] = [];
  const today = new Date();
  
  for (let i = 1; i <= months; i++) {
    const forecastMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const monthKey = forecastMonth.getMonth();
    
    // חיזוי בסיסי
    let forecasted_income = average + (trend * i);
    
    // התאם לעונתיות
    if (includeSeasonality && seasonality[monthKey]) {
      forecasted_income *= seasonality[monthKey];
    }
    
    // חשב ביטחון
    const confidence_score = calculateConfidence(monthlyIncomes.length, trend, i);
    
    // קבע בסיס
    let based_on: IncomeForecastBasis = 'historical_average';
    if (includeSeasonality && seasonality[monthKey]) {
      based_on = 'seasonal_pattern';
    }
    if (Math.abs(trend) > average * 0.05) { // מגמה משמעותית (5%+)
      based_on = trend > 0 ? 'trending_up' : 'trending_down';
    }
    
    // חשב טווח שונות
    const variance = calculateVariance(monthlyIncomes.map(m => m.total));
    const variance_range = Math.sqrt(variance);
    
    if (confidence_score >= confidenceThreshold) {
      forecasts.push({
        id: '', // יוצג בהוספה לDB
        user_id: userId,
        month: forecastMonth,
        forecasted_income: Math.round(forecasted_income),
        confidence_score,
        based_on,
        variance_range: Math.round(variance_range),
        metadata: {
          months_of_data: monthlyIncomes.length,
          seasonal_factors: seasonality,
          trend_direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
        },
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }
  
  return forecasts;
}

/**
 * חיזוי מפרופיל משתמש (אם אין נתוני עבר)
 */
async function generateForecastFromProfile(
  userId: string,
  months: number
): Promise<IncomeForecast[]> {
  const supabase = createServiceClient();
  
  const { data: profile } = await supabase
    .from('user_financial_profile')
    .select('total_monthly_income')
    .eq('user_id', userId)
    .single();
  
  const declared_income = profile?.total_monthly_income || 0;
  
  if (declared_income === 0) {
    return []; // אין נתונים כלל
  }
  
  const forecasts: IncomeForecast[] = [];
  const today = new Date();
  
  for (let i = 1; i <= months; i++) {
    const forecastMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
    
    forecasts.push({
      id: '',
      user_id: userId,
      month: forecastMonth,
      forecasted_income: declared_income,
      confidence_score: 0.7, // בטחון בינוני - מבוסס על הצהרה
      based_on: 'declared',
      variance_range: declared_income * 0.1, // 10% שונות
      metadata: {
        months_of_data: 0,
        trend_direction: 'stable',
      },
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
  
  return forecasts;
}

/**
 * קיבוץ תנועות לפי חודש
 */
function groupByMonth(transactions: any[]): Array<{ month: Date; total: number; count: number }> {
  const grouped = new Map<string, { month: Date; total: number; count: number }>();
  
  for (const tx of transactions) {
    const date = new Date(tx.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, {
        month: new Date(date.getFullYear(), date.getMonth(), 1),
        total: 0,
        count: 0,
      });
    }
    
    const entry = grouped.get(key)!;
    entry.total += Number(tx.amount);
    entry.count++;
  }
  
  return Array.from(grouped.values()).sort((a, b) => a.month.getTime() - b.month.getTime());
}

/**
 * חישוב ממוצע
 */
function calculateAverage(monthlyIncomes: Array<{ total: number }>): number {
  if (monthlyIncomes.length === 0) return 0;
  
  const sum = monthlyIncomes.reduce((acc, m) => acc + m.total, 0);
  return sum / monthlyIncomes.length;
}

/**
 * חישוב מגמה (Trend) - שיפוע ליניארי
 */
function calculateTrend(monthlyIncomes: Array<{ total: number }>): number {
  if (monthlyIncomes.length < 3) return 0; // לא מספיק נתונים
  
  const n = monthlyIncomes.length;
  const xMean = (n - 1) / 2;
  const yMean = calculateAverage(monthlyIncomes);
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = monthlyIncomes[i].total;
    numerator += (x - xMean) * (y - yMean);
    denominator += (x - xMean) ** 2;
  }
  
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * חישוב עונתיות (Seasonality)
 * מחזיר מקדם לכל חודש (0-11)
 */
function calculateSeasonality(
  monthlyIncomes: Array<{ month: Date; total: number }>
): Record<number, number> {
  if (monthlyIncomes.length < 12) return {}; // לא מספיק נתונים
  
  const average = calculateAverage(monthlyIncomes);
  const monthlyFactors: Record<number, number[]> = {};
  
  // קבץ לפי חודש בשנה
  for (const entry of monthlyIncomes) {
    const monthKey = entry.month.getMonth();
    if (!monthlyFactors[monthKey]) {
      monthlyFactors[monthKey] = [];
    }
    monthlyFactors[monthKey].push(entry.total / average);
  }
  
  // חשב ממוצע לכל חודש
  const seasonality: Record<number, number> = {};
  for (const [month, factors] of Object.entries(monthlyFactors)) {
    const avg = factors.reduce((sum, f) => sum + f, 0) / factors.length;
    seasonality[Number(month)] = avg;
  }
  
  return seasonality;
}

/**
 * חישוב שונות (Variance)
 */
function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  return squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
}

/**
 * חישוב רמת ביטחון
 */
function calculateConfidence(
  dataPoints: number,
  trend: number,
  monthsAhead: number
): number {
  // ביטחון בסיסי לפי כמות נתונים
  let confidence = Math.min(1, dataPoints / 12);
  
  // הפחת ביטחון ככל שמתרחקים בזמן
  confidence *= Math.exp(-monthsAhead / 12);
  
  // הפחת ביטחון אם יש מגמה חזקה (אי-יציבות)
  const trendFactor = Math.abs(trend) / 1000; // נרמול
  confidence *= Math.exp(-trendFactor);
  
  return Math.max(0.3, Math.min(0.95, confidence));
}

/**
 * שמירת חיזויים ב-DB
 */
export async function saveForecastsToDatabase(forecasts: IncomeForecast[]): Promise<void> {
  const supabase = createServiceClient();
  
  for (const forecast of forecasts) {
    const { error } = await supabase
      .from('user_income_forecast')
      .upsert({
        user_id: forecast.user_id,
        month: forecast.month.toISOString().split('T')[0],
        forecasted_income: forecast.forecasted_income,
        confidence_score: forecast.confidence_score,
        based_on: forecast.based_on,
        variance_range: forecast.variance_range,
        metadata: forecast.metadata,
      }, {
        onConflict: 'user_id,month',
      });
    
    if (error) {
      console.error('Failed to save forecast:', error);
    }
  }
}

/**
 * קבלת חיזוי לחודש ספציפי
 */
export async function getForecastForMonth(
  userId: string,
  month: Date
): Promise<IncomeForecast | null> {
  const supabase = createServiceClient();
  
  const monthKey = new Date(month.getFullYear(), month.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  
  const { data, error } = await supabase
    .from('user_income_forecast')
    .select('*')
    .eq('user_id', userId)
    .eq('month', monthKey)
    .single();
  
  if (error || !data) {
    // אין חיזוי - צור אחד חדש
    const forecasts = await forecastIncome(userId, { months: 1 });
    if (forecasts.length > 0) {
      await saveForecastsToDatabase(forecasts);
      return forecasts[0];
    }
    return null;
  }
  
  return data as IncomeForecast;
}

/**
 * עזר - תאריך לפני X חודשים
 */
function getDateMonthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}

