/**
 * Cash Flow Projector - מנוע חיזוי תזרים מזומנים
 * מבוסס על נתונים היסטוריים + תחזית הכנסה
 */

import { createServiceClient } from '@/lib/supabase/server';

export interface CashFlowProjection {
  month: Date;
  month_name: string;
  projected_income: number;
  projected_expenses: number;
  projected_fixed_expenses?: number;
  projected_variable_expenses?: number;
  net_cash_flow: number;
  projected_balance: number;
  confidence_level: number;
  is_negative: boolean;
  warning_level: 'healthy' | 'caution' | 'warning' | 'critical';
}

export interface CashFlowRecommendation {
  recommendation_type: string;
  recommendation_text: string;
  impact_amount: number;
  priority: 'high' | 'medium' | 'low';
}

export interface CashFlowAnalysis {
  projections: CashFlowProjection[];
  warnings: string[];
  recommendations: CashFlowRecommendation[];
  negative_months: number[];
  summary: {
    total_months: number;
    negative_months_count: number;
    average_monthly_surplus: number;
    lowest_balance_month: string;
    lowest_balance_amount: number;
  };
}

/**
 * תחזית תזרים מזומנים למשתמש
 */
export async function projectCashFlow(
  userId: string,
  months: number = 12
): Promise<CashFlowAnalysis> {
  const supabase = createServiceClient();
  
  console.log(`[Cash Flow Projector] Projecting ${months} months for user ${userId}`);
  
  try {
    // שלוף תחזית מה-database (dynamic function - supports any number of months)
    const { data: projections, error } = await supabase
      .rpc('get_dynamic_cash_flow_projection', {
        p_user_id: userId,
        p_months: months,
      });
    
    if (error) {
      console.error('[Cash Flow Projector] Database error:', error);
      throw new Error('Failed to get cash flow projection');
    }
    
    if (!projections || projections.length === 0) {
      console.log('[Cash Flow Projector] No projection data available');
      return {
        projections: [],
        warnings: ['אין מספיק נתונים היסטוריים לתחזית'],
        recommendations: [],
        negative_months: [],
        summary: {
          total_months: 0,
          negative_months_count: 0,
          average_monthly_surplus: 0,
          lowest_balance_month: '',
          lowest_balance_amount: 0,
        },
      };
    }
    
    // עיבוד התחזית
    const cashFlowProjections: CashFlowProjection[] = projections.map((p: any) => ({
      month: new Date(p.month),
      month_name: p.month_name,
      projected_income: Number(p.projected_income),
      projected_expenses: Number(p.projected_expenses),
      net_cash_flow: Number(p.net_cash_flow),
      projected_balance: Number(p.projected_balance),
      confidence_level: Number(p.confidence_level),
      is_negative: p.is_negative,
      warning_level: p.warning_level,
    }));
    
    // איתור חודשים שליליים
    const negativeMonths = cashFlowProjections
      .map((p, index) => (p.is_negative ? index : -1))
      .filter(index => index !== -1);
    
    // בניית אזהרות
    const warnings = generateWarnings(cashFlowProjections, negativeMonths);
    
    // שלוף המלצות מה-database
    const { data: recommendations } = await supabase
      .rpc('get_cash_flow_recommendations', {
        p_user_id: userId,
      });
    
    const cashFlowRecommendations: CashFlowRecommendation[] = (recommendations || []).map((r: any) => ({
      recommendation_type: r.recommendation_type,
      recommendation_text: r.recommendation_text,
      impact_amount: Number(r.impact_amount),
      priority: r.priority,
    }));
    
    // חישוב סיכום
    const totalMonths = cashFlowProjections.length;
    const negativeMonthsCount = negativeMonths.length;
    const averageMonthlySurplus = cashFlowProjections.reduce((sum, p) => sum + p.net_cash_flow, 0) / totalMonths;
    
    const lowestBalanceProjection = cashFlowProjections.reduce((min, p) => 
      p.projected_balance < min.projected_balance ? p : min
    );
    
    const summary = {
      total_months: totalMonths,
      negative_months_count: negativeMonthsCount,
      average_monthly_surplus: averageMonthlySurplus,
      lowest_balance_month: lowestBalanceProjection.month_name,
      lowest_balance_amount: lowestBalanceProjection.projected_balance,
    };
    
    console.log(`[Cash Flow Projector] Complete: ${totalMonths} months, ${negativeMonthsCount} negative`);
    
    return {
      projections: cashFlowProjections,
      warnings,
      recommendations: cashFlowRecommendations,
      negative_months: negativeMonths,
      summary,
    };
    
  } catch (error) {
    console.error('[Cash Flow Projector] Error:', error);
    throw error;
  }
}

/**
 * בניית אזהרות מותאמות אישית
 */
function generateWarnings(
  projections: CashFlowProjection[],
  negativeMonths: number[]
): string[] {
  const warnings: string[] = [];
  
  if (negativeMonths.length === 0) {
    return warnings;
  }
  
  // אזהרה ראשית
  if (negativeMonths.length === 1) {
    const monthName = projections[negativeMonths[0]].month_name;
    warnings.push(`יתרה שלילית צפויה ב${monthName}`);
  } else {
    warnings.push(`יתרה שלילית צפויה ב-${negativeMonths.length} חודשים`);
  }
  
  // אזהרה על חודש ראשון שלילי
  if (negativeMonths[0] === 0) {
    warnings.push('⚠️ קריטי: יתרה שלילית צפויה כבר החודש!');
  } else if (negativeMonths[0] <= 2) {
    const monthName = projections[negativeMonths[0]].month_name;
    warnings.push(`⚠️ דחוף: יתרה שלילית תחל ב${monthName}`);
  }
  
  // אזהרה על חודשים רצופים
  const consecutiveMonths = findLongestConsecutiveSequence(negativeMonths);
  if (consecutiveMonths >= 3) {
    warnings.push(`⚠️ ${consecutiveMonths} חודשים רצופים עם יתרה שלילית`);
  }
  
  // אזהרה על גירעון גדול
  const maxNegative = Math.min(...projections.filter(p => p.is_negative).map(p => p.projected_balance));
  if (maxNegative < -10000) {
    warnings.push(`⚠️ גירעון משמעותי: עד ${Math.abs(maxNegative).toLocaleString('he-IL')} ₪`);
  }
  
  return warnings;
}

/**
 * מצא רצף רציף הארוך ביותר
 */
function findLongestConsecutiveSequence(arr: number[]): number {
  if (arr.length === 0) return 0;
  
  let maxLength = 1;
  let currentLength = 1;
  
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === arr[i - 1] + 1) {
      currentLength++;
      maxLength = Math.max(maxLength, currentLength);
    } else {
      currentLength = 1;
    }
  }
  
  return maxLength;
}

/**
 * חיזוי תזרים למספר משתמשים (לשימוש ב-cron)
 */
export async function projectCashFlowForAllUsers(): Promise<void> {
  const supabase = createServiceClient();
  
  console.log('[Cash Flow Projector] Projecting for all users...');
  
  const { data: users, error } = await supabase
    .from('users')
    .select('id, phone, name, full_name')
    .in('phase', ['monitoring', 'behavior', 'goals', 'budget']);
  
  if (error || !users) {
    console.error('[Cash Flow Projector] Failed to fetch users:', error);
    return;
  }
  
  console.log(`[Cash Flow Projector] Found ${users.length} active users`);
  
  for (const user of users) {
    try {
      await projectCashFlow(user.id, 3); // רק 3 חודשים קדימה לאזהרות
    } catch (error) {
      console.error(`[Cash Flow Projector] Error for user ${user.id}:`, error);
    }
  }
  
  console.log('[Cash Flow Projector] Completed for all users');
}
