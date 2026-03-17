/**
 * Behavior Analyzer - שלב 2 של Phi
 * 
 * מנתח דפוסי הוצאות ויוצר תובנות אישיות
 * כולל AI-powered tips מותאמים אישית
 */

import { createServiceClient } from '@/lib/supabase/server';
import { detectPatterns, savePatterns, Pattern } from '@/lib/learning/pattern-detector';
import { chatWithGeminiFlash } from '@/lib/ai/gemini-client';

/**
 * AI chat for tips generation using Gemini Flash
 */
async function generateAIResponse(prompt: string): Promise<string | null> {
  try {
    const systemPrompt = 'אתה מאמן פיננסי בשם φ (פי). ענה בעברית, בקצרה ובחום.';
    const response = await chatWithGeminiFlash(prompt, systemPrompt, '');
    return response || null;
  } catch (error) {
    console.error('[BehaviorAnalyzer] Gemini Flash error:', error);
    return null;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface BehaviorInsight {
  type: 'spending_spike' | 'category_trend' | 'merchant_habit' | 'day_pattern' | 
        'subscription_found' | 'saving_opportunity' | 'positive_change' | 'warning';
  title: string;
  description: string;
  emoji: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestedAction?: string;
  data: Record<string, any>;
}

export interface BehaviorAnalysisResult {
  userId: string;
  analyzedAt: Date;
  daysAnalyzed: number;
  transactionCount: number;
  insights: BehaviorInsight[];
  patterns: Pattern[];
  summary: {
    totalSpent: number;
    totalIncome: number;
    avgDailySpend: number;
    topCategories: Array<{ category: string; amount: number; percent: number }>;
    spendingTrend: 'increasing' | 'decreasing' | 'stable';
  };
  shouldNotify: boolean;
  notificationMessage?: string;
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * ניתוח התנהגות מלא למשתמש
 */
export async function analyzeBehavior(userId: string): Promise<BehaviorAnalysisResult> {
  const supabase = createServiceClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  console.log(`[BehaviorAnalyzer] Starting analysis for user ${userId}`);
  
  // 1. קבל תנועות 30 יום אחרונים
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, tx_date, amount, type, category, expense_category, vendor, is_recurring')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .or('is_summary.is.null,is_summary.eq.false')
    .gte('tx_date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('tx_date', { ascending: false });
  
  if (!transactions || transactions.length < 5) {
    console.log(`[BehaviorAnalyzer] Not enough transactions (${transactions?.length || 0})`);
    return createEmptyResult(userId);
  }
  
  // 2. זיהוי דפוסים
  const patterns = await detectPatterns(userId);
  await savePatterns(patterns);
  
  // 3. חישוב סיכומים
  const expenses = transactions.filter(t => t.amount < 0);
  const income = transactions.filter(t => t.amount > 0);
  
  const totalSpent = Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0));
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  
  const daysWithData = new Set(transactions.map(t => t.tx_date)).size;
  const avgDailySpend = totalSpent / Math.max(daysWithData, 1);
  
  // 4. קטגוריות מובילות
  const categoryTotals: Record<string, number> = {};
  for (const tx of expenses) {
    const cat = tx.expense_category || 'אחר';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(tx.amount);
  }
  
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: Math.round((amount / totalSpent) * 100),
    }));
  
  // 5. מגמת הוצאות (השוואה לשבוע קודם)
  const spendingTrend = calculateSpendingTrend(transactions);
  
  // 6. יצירת תובנות
  const insights = generateInsights(
    transactions,
    patterns,
    topCategories,
    avgDailySpend,
    spendingTrend
  );
  
  // 7. בדיקה אם צריך להודיע
  const highPriorityInsights = insights.filter(i => i.priority === 'high');
  const shouldNotify = highPriorityInsights.length > 0;
  const notificationMessage = shouldNotify 
    ? createNotificationMessage(highPriorityInsights[0])
    : undefined;
  
  // 8. שמירת תובנות ב-DB
  await saveInsights(userId, insights);
  
  const result: BehaviorAnalysisResult = {
    userId,
    analyzedAt: now,
    daysAnalyzed: daysWithData,
    transactionCount: transactions.length,
    insights,
    patterns,
    summary: {
      totalSpent,
      totalIncome,
      avgDailySpend,
      topCategories,
      spendingTrend,
    },
    shouldNotify,
    notificationMessage,
  };
  
  console.log(`[BehaviorAnalyzer] Analysis complete:`, {
    insights: insights.length,
    patterns: patterns.length,
    shouldNotify,
  });
  
  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

function createEmptyResult(userId: string): BehaviorAnalysisResult {
  return {
    userId,
    analyzedAt: new Date(),
    daysAnalyzed: 0,
    transactionCount: 0,
    insights: [],
    patterns: [],
    summary: {
      totalSpent: 0,
      totalIncome: 0,
      avgDailySpend: 0,
      topCategories: [],
      spendingTrend: 'stable',
    },
    shouldNotify: false,
  };
}

function calculateSpendingTrend(transactions: any[]): 'increasing' | 'decreasing' | 'stable' {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  const thisWeek = transactions.filter(t => {
    const date = new Date(t.tx_date);
    return date >= oneWeekAgo && t.amount < 0;
  });

  const lastWeek = transactions.filter(t => {
    const date = new Date(t.tx_date);
    return date >= twoWeeksAgo && date < oneWeekAgo && t.amount < 0;
  });
  
  const thisWeekTotal = Math.abs(thisWeek.reduce((sum, t) => sum + t.amount, 0));
  const lastWeekTotal = Math.abs(lastWeek.reduce((sum, t) => sum + t.amount, 0));
  
  if (lastWeekTotal === 0) return 'stable';
  
  const changePercent = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
  
  if (changePercent > 15) return 'increasing';
  if (changePercent < -15) return 'decreasing';
  return 'stable';
}

function generateInsights(
  transactions: any[],
  patterns: Pattern[],
  topCategories: Array<{ category: string; amount: number; percent: number }>,
  avgDailySpend: number,
  spendingTrend: string
): BehaviorInsight[] {
  const insights: BehaviorInsight[] = [];
  
  // 1. מגמת הוצאות
  if (spendingTrend === 'increasing') {
    insights.push({
      type: 'warning',
      title: 'עלייה בהוצאות',
      description: 'ההוצאות שלך עלו השבוע בהשוואה לשבוע שעבר',
      emoji: '📈',
      priority: 'high',
      actionable: true,
      suggestedAction: 'בוא נראה איפה אפשר לחסוך',
      data: { trend: spendingTrend },
    });
  } else if (spendingTrend === 'decreasing') {
    insights.push({
      type: 'positive_change',
      title: 'ירידה בהוצאות!',
      description: 'כל הכבוד! ההוצאות שלך ירדו השבוע',
      emoji: '🎉',
      priority: 'low',
      actionable: false,
      data: { trend: spendingTrend },
    });
  }
  
  // 2. קטגוריה דומיננטית
  if (topCategories.length > 0 && topCategories[0].percent > 40) {
    insights.push({
      type: 'category_trend',
      title: `${topCategories[0].category} - 40%+ מההוצאות`,
      description: `הוצאות על ${topCategories[0].category} מהוות ${topCategories[0].percent}% מהסך`,
      emoji: '🔍',
      priority: 'medium',
      actionable: true,
      suggestedAction: `לבדוק אם יש דרך לצמצם הוצאות ${topCategories[0].category}`,
      data: { category: topCategories[0].category, percent: topCategories[0].percent },
    });
  }
  
  // 3. מנויים שזוהו
  const subscriptions = patterns.filter(p => p.patternType === 'subscription');
  if (subscriptions.length > 0) {
    const totalSubscriptions = subscriptions.reduce(
      (sum, s) => sum + (s.patternValue.amount || 0), 0
    );
    
    insights.push({
      type: 'subscription_found',
      title: `${subscriptions.length} מנויים קבועים`,
      description: `זיהיתי ${subscriptions.length} הוצאות חוזרות בסך ${totalSubscriptions.toLocaleString('he-IL')} ₪/חודש`,
      emoji: '🔄',
      priority: subscriptions.length > 5 ? 'high' : 'medium',
      actionable: true,
      suggestedAction: 'לבדוק אם כל המנויים באמת נחוצים',
      data: { count: subscriptions.length, totalMonthly: totalSubscriptions },
    });
  }
  
  // 4. דפוס יום בשבוע
  const dayPatterns = patterns.filter(p => p.patternType === 'day_of_week' && p.confidenceScore > 0.6);
  if (dayPatterns.length > 0) {
    const strongestDay = dayPatterns[0];
    insights.push({
      type: 'day_pattern',
      title: `דפוס יום ${strongestDay.patternValue.day}`,
      description: `ביום ${strongestDay.patternValue.day} יש לך נטייה להוציא על ${strongestDay.patternValue.likely_category}`,
      emoji: '📅',
      priority: 'low',
      actionable: false,
      data: { day: strongestDay.patternValue.day, category: strongestDay.patternValue.likely_category },
    });
  }
  
  // 5. הזדמנות חיסכון
  const highSpendCategories = topCategories.filter(c => c.percent > 20 && c.category !== 'דיור');
  if (highSpendCategories.length > 0) {
    const savingsTarget = highSpendCategories[0];
    const potentialSavings = Math.round(savingsTarget.amount * 0.1); // 10% חיסכון פוטנציאלי
    
    insights.push({
      type: 'saving_opportunity',
      title: 'הזדמנות לחיסכון',
      description: `אם תצמצם 10% מהוצאות ${savingsTarget.category}, תחסוך ${potentialSavings.toLocaleString('he-IL')} ₪/חודש`,
      emoji: '💡',
      priority: 'medium',
      actionable: true,
      suggestedAction: `לנסות לצמצם הוצאות ${savingsTarget.category} ב-10%`,
      data: { category: savingsTarget.category, potentialSavings },
    });
  }
  
  // 6. הוצאה יומית ממוצעת
  insights.push({
    type: 'category_trend',
    title: 'ממוצע יומי',
    description: `אתה מוציא בממוצע ${Math.round(avgDailySpend).toLocaleString('he-IL')} ₪ ביום`,
    emoji: '📊',
    priority: 'low',
    actionable: false,
    data: { avgDailySpend },
  });
  
  return insights;
}

async function saveInsights(userId: string, insights: BehaviorInsight[]): Promise<void> {
  const supabase = createServiceClient();
  
  // שמור רק תובנות עם עדיפות גבוהה/בינונית
  const importantInsights = insights.filter(i => i.priority !== 'low');
  
  for (const insight of importantInsights) {
    await supabase
      .from('behavior_insights')
      .insert({
        user_id: userId,
        insight_type: insight.type,
        title: insight.title,
        description: insight.description,
        priority: insight.priority,
        data: insight.data,
        actionable: insight.actionable,
        suggested_action: insight.suggestedAction,
      });
  }
  
  console.log(`[BehaviorAnalyzer] Saved ${importantInsights.length} insights to DB`);
}

function createNotificationMessage(insight: BehaviorInsight): string {
  let message = `${insight.emoji} *${insight.title}*\n\n`;
  message += `${insight.description}\n`;
  
  if (insight.suggestedAction) {
    message += `\n💡 *טיפ:* ${insight.suggestedAction}`;
  }
  
  return message;
}

// ============================================================================
// AI-Powered Personal Tips
// ============================================================================

/**
 * יצירת טיפ אישי עם AI בהתאם לדפוסי ההוצאות
 */
export async function generateAITip(
  userId: string,
  topCategories: Array<{ category: string; amount: number; percent: number }>,
  avgDailySpend: number,
  spendingTrend: string
): Promise<BehaviorInsight | null> {
  try {
    const supabase = createServiceClient();
    
    // קבל פרופיל משתמש
    const { data: profile } = await supabase
      .from('user_financial_profile')
      .select('monthly_income, short_term_goal, children_count, marital_status')
      .eq('user_id', userId)
      .single();
    
    const prompt = `
אתה מאמן פיננסי אישי בשם φ (פי). צור טיפ קצר ומותאם אישית בעברית.

📊 נתונים על המשתמש:
- הכנסה חודשית: ${profile?.monthly_income?.toLocaleString('he-IL') || 'לא ידוע'} ₪
- ממוצע הוצאה יומי: ${Math.round(avgDailySpend).toLocaleString('he-IL')} ₪
- מגמה: ${spendingTrend === 'increasing' ? 'עלייה' : spendingTrend === 'decreasing' ? 'ירידה' : 'יציבה'}
- יעד: ${profile?.short_term_goal || 'לא הוגדר'}
- מצב משפחתי: ${profile?.marital_status || 'לא ידוע'}, ${profile?.children_count || 0} ילדים

📈 קטגוריות מובילות:
${topCategories.slice(0, 3).map(c => `- ${c.category}: ${c.amount.toLocaleString('he-IL')} ₪ (${c.percent}%)`).join('\n')}

יצר טיפ אחד בלבד:
1. קצר (עד 50 מילים)
2. פרקטי ומיידי
3. אישי ומעודד
4. עם אימוג'י אחד בתחילה

פורמט:
טיפ: [הטיפ שלך]
פעולה: [מה לעשות עכשיו - משפט אחד]
`;

    const aiResponse = await generateAIResponse(prompt);
    
    if (!aiResponse) return null;
    
    // Parse AI response
    const tipMatch = aiResponse.match(/טיפ:\s*(.+?)(?:\n|פעולה:)/);
    const actionMatch = aiResponse.match(/פעולה:\s*(.+)/);
    
    const tipText = tipMatch?.[1]?.trim() || aiResponse.slice(0, 100);
    const actionText = actionMatch?.[1]?.trim();
    
    // Extract emoji from start if exists
    const emojiMatch = tipText.match(/^([🎯💡✨🎉📊💰🏆⚡️🔥])/);
    const emoji = emojiMatch?.[1] || '💡';
    const cleanTip = tipText.replace(/^[🎯💡✨🎉📊💰🏆⚡️🔥]\s*/, '');
    
    return {
      type: 'saving_opportunity',
      title: 'טיפ אישי מ-φ',
      description: cleanTip,
      emoji,
      priority: 'medium',
      actionable: !!actionText,
      suggestedAction: actionText,
      data: { 
        source: 'ai',
        context: { avgDailySpend, spendingTrend, topCategory: topCategories[0]?.category }
      },
    };
    
  } catch (error) {
    console.error('[BehaviorAnalyzer] AI tip generation failed:', error);
    return null;
  }
}

/**
 * קבלת כל התובנות למשתמש (מה-DB)
 */
export async function getInsightsForUser(userId: string, limit = 5): Promise<BehaviorInsight[]> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('behavior_insights')
    .select('*')
    .eq('user_id', userId)
    .eq('seen', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('[BehaviorAnalyzer] Error fetching insights:', error);
    return [];
  }
  
  return (data || []).map(row => ({
    type: row.insight_type,
    title: row.title || row.pattern,
    description: row.description || row.insight_text,
    emoji: row.emoji || '💡',
    priority: row.priority || 'medium',
    actionable: row.actionable || false,
    suggestedAction: row.suggested_action,
    data: row.data || {},
  }));
}

/**
 * סימון תובנה כנקראה
 */
export async function markInsightAsSeen(insightId: string): Promise<void> {
  const supabase = createServiceClient();
  
  await supabase
    .from('behavior_insights')
    .update({ seen: true, seen_at: new Date().toISOString() })
    .eq('id', insightId);
}

/**
 * ניתוח מהיר - רק AI tip בלי ניתוח מלא
 */
export async function getQuickAITip(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // קבל נתונים בסיסיים
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, expense_category, tx_date')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .or('is_summary.is.null,is_summary.eq.false')
    .gte('tx_date', thirtyDaysAgo.toISOString().split('T')[0]);

  if (!transactions || transactions.length < 5) {
    return 'עדיין אין מספיק נתונים לטיפ אישי - המשך לעדכן הוצאות! 📊';
  }
  
  // חישוב מהיר
  const totalSpent = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const categoryTotals: Record<string, number> = {};
  
  for (const tx of transactions) {
    const cat = tx.expense_category || 'אחר';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(tx.amount);
  }
  
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: Math.round((amount / totalSpent) * 100),
    }));
  
  const avgDailySpend = totalSpent / 30;
  
  // קבל AI tip
  const tip = await generateAITip(userId, topCategories, avgDailySpend, 'stable');
  
  if (tip) {
    return `${tip.emoji} ${tip.description}${tip.suggestedAction ? `\n\n💡 ${tip.suggestedAction}` : ''}`;
  }
  
  return null;
}

// ============================================================================
// Phase Transition Check
// ============================================================================

/**
 * בדיקה אם המשתמש מוכן לעבור לשלב 3 (Budget)
 */
export async function checkReadyForBudget(userId: string): Promise<{
  ready: boolean;
  reason: string;
  daysInPhase: number;
  transactionCount: number;
}> {
  const supabase = createServiceClient();
  
  // 1. בדוק כמה זמן המשתמש בשלב behavior
  const { data: user } = await supabase
    .from('users')
    .select('phase, phase_updated_at')
    .eq('id', userId)
    .single();

  if (!user || user.phase !== 'behavior') {
    return {
      ready: false,
      reason: 'המשתמש לא בשלב behavior',
      daysInPhase: 0,
      transactionCount: 0,
    };
  }
  
  const phaseStart = user.phase_updated_at 
    ? new Date(user.phase_updated_at) 
    : new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // ברירת מחדל: 60 יום אחורה
  
  const daysInPhase = Math.floor(
    (Date.now() - phaseStart.getTime()) / (24 * 60 * 60 * 1000)
  );
  
  // 2. בדוק כמה תנועות יש
  const { count: transactionCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .or('is_summary.is.null,is_summary.eq.false');
  
  // 3. קריטריונים למעבר
  const MIN_DAYS = 30;
  const MIN_TRANSACTIONS = 50;
  
  if (daysInPhase < MIN_DAYS) {
    return {
      ready: false,
      reason: `צריך לפחות ${MIN_DAYS} ימים בשלב זה (עברו ${daysInPhase} ימים)`,
      daysInPhase,
      transactionCount: transactionCount || 0,
    };
  }
  
  if ((transactionCount || 0) < MIN_TRANSACTIONS) {
    return {
      ready: false,
      reason: `צריך לפחות ${MIN_TRANSACTIONS} תנועות (יש ${transactionCount || 0})`,
      daysInPhase,
      transactionCount: transactionCount || 0,
    };
  }
  
  return {
    ready: true,
    reason: 'מוכן לשלב הבא!',
    daysInPhase,
    transactionCount: transactionCount || 0,
  };
}

/**
 * מעבר לשלב 3 (Budget)
 */
export async function transitionToBudget(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { updateContext } = await import('@/lib/conversation/context-manager');
  
  const check = await checkReadyForBudget(userId);
  
  if (!check.ready) {
    console.log(`[BehaviorAnalyzer] User ${userId} not ready for budget: ${check.reason}`);
    return false;
  }
  
  // עדכון phase
  await supabase
    .from('users')
    .update({
      phase: 'budget',
      phase_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  
  // עדכון context
  await updateContext(userId, {
    currentState: 'budget_planning',
  });
  
  console.log(`[BehaviorAnalyzer] User ${userId} transitioned to budget phase!`);
  
  return true;
}

// ============================================================================
// Export
// ============================================================================

export default {
  analyzeBehavior,
  checkReadyForBudget,
  transitionToBudget,
};

