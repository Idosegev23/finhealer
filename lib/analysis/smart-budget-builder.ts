/**
 * Smart Budget Builder - AI בונה תקציב מותאם אישית
 * 
 * עיקרון מפתח:
 * - AI מנתח נתונים היסטוריים
 * - AI בונה תקציב מומלץ
 * - המשתמש מאשר/משנה
 * - לא שאלות "כמה תרצה להקצות"
 */

import { createClient } from '@/lib/supabase/server';
import { chatWithGPT5 } from '@/lib/ai/gpt5-client';

// ============================================================================
// Types
// ============================================================================

export interface BudgetRecommendation {
  categories: Array<{
    name: string;
    recommended: number;
    current: number;
    reasoning: string;
    changePercent: number;
  }>;
  savings: {
    amount: number;
    percentage: number;
    reasoning: string;
  };
  totalBudget: number;
  totalIncome: number;
  totalFixed: number;
  availableForVariable: number;
  savingsOpportunities: Array<{
    category: string;
    current: number;
    target: number;
    savings: number;
    tips: string[];
  }>;
  confidenceScore: number;
}

export interface UserFinancialData {
  userId: string;
  totalIncome: number;
  fixedExpenses: number;
  spendingHistory: Array<{
    category: string;
    monthlyAverage: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  goals: Array<{
    name: string;
    targetAmount: number;
    deadline: Date;
    monthlyRequired: number;
  }>;
  patterns: Array<{
    type: string;
    description: string;
    impact: number;
  }>;
}

// ============================================================================
// Main Function - Build Smart Budget
// ============================================================================

export async function buildSmartBudget(userId: string): Promise<BudgetRecommendation> {
  // 1. Collect all financial data
  const financialData = await collectFinancialData(userId);
  
  // 2. Calculate available budget
  const availableBudget = financialData.totalIncome - financialData.fixedExpenses;
  
  // 3. Generate AI recommendation
  const recommendation = await generateAIRecommendation(financialData, availableBudget);
  
  return recommendation;
}

// ============================================================================
// Data Collection
// ============================================================================

async function collectFinancialData(userId: string): Promise<UserFinancialData> {
  const supabase = await createClient();
  
  // Get user financial profile
  const { data: profile } = await supabase
    .from('user_financial_profile')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  // Get income sources
  const { data: incomeSources } = await supabase
    .from('income_sources')
    .select('actual_bank_amount')
    .eq('user_id', userId)
    .eq('active', true);
  
  const totalIncome = incomeSources?.reduce((sum, s) => sum + (s.actual_bank_amount || 0), 0) || 
                      profile?.monthly_income || 0;
  
  // Get fixed expenses from profile
  const fixedExpenses = (profile?.rent_mortgage || 0) + 
                        (profile?.insurance || 0) + 
                        (profile?.pension_funds || 0) + 
                        (profile?.education || 0) +
                        (profile?.other_fixed || 0);
  
  // Get spending history (last 3 months)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const { data: transactions } = await supabase
    .from('transactions')
    .select('expense_category, amount, tx_date')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('tx_date', threeMonthsAgo.toISOString().split('T')[0]);
  
  // Group by category and calculate monthly averages
  const categoryTotals: Record<string, { total: number; months: Set<string> }> = {};
  
  transactions?.forEach(t => {
    const cat = t.expense_category || 'אחר';
    const month = t.tx_date.substring(0, 7);
    
    if (!categoryTotals[cat]) {
      categoryTotals[cat] = { total: 0, months: new Set() };
    }
    
    categoryTotals[cat].total += t.amount;
    categoryTotals[cat].months.add(month);
  });
  
  const spendingHistory = Object.entries(categoryTotals).map(([category, data]) => ({
    category,
    monthlyAverage: Math.round(data.total / Math.max(data.months.size, 1)),
    trend: 'stable' as const, // TODO: Calculate actual trend
  }));
  
  // Get goals
  const { data: goalsData } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');
  
  const goals = goalsData?.map(g => {
    const deadline = new Date(g.deadline || g.target_date);
    const monthsUntil = Math.max(1, Math.ceil((deadline.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)));
    const remaining = (g.target_amount || 0) - (g.current_amount || 0);
    
    return {
      name: g.name,
      targetAmount: g.target_amount || 0,
      deadline,
      monthlyRequired: Math.round(remaining / monthsUntil),
    };
  }) || [];
  
  // Get patterns
  const { data: patternsData } = await supabase
    .from('user_patterns')
    .select('pattern_type, pattern_key, pattern_value')
    .eq('user_id', userId)
    .gte('confidence_score', 0.7);
  
  const patterns = patternsData?.map(p => ({
    type: p.pattern_type,
    description: p.pattern_key,
    impact: 0, // TODO: Calculate impact
  })) || [];
  
  return {
    userId,
    totalIncome,
    fixedExpenses,
    spendingHistory,
    goals,
    patterns,
  };
}

// ============================================================================
// AI Recommendation
// ============================================================================

async function generateAIRecommendation(
  data: UserFinancialData,
  availableBudget: number
): Promise<BudgetRecommendation> {
  const prompt = buildBudgetPrompt(data, availableBudget);
  
  try {
    const response = await chatWithGPT5(
      [{ role: 'user', content: prompt, timestamp: new Date() }],
      BUDGET_BUILDER_SYSTEM_PROMPT,
      { userId: data.userId, userName: '', phoneNumber: '' },
      { reasoningEffort: 'medium', maxOutputTokens: 2000 }
    );
    
    // Parse AI response
    const recommendation = parseAIResponse(response.response, data, availableBudget);
    return recommendation;
  } catch (error) {
    console.error('AI budget generation failed:', error);
    // Fallback to rule-based recommendation
    return generateFallbackRecommendation(data, availableBudget);
  }
}

const BUDGET_BUILDER_SYSTEM_PROMPT = `אתה יועץ תקציב מקצועי. בנה תקציב חודשי מותאם אישית.

כללים:
1. התקציב חייב להתאים לסכום הזמין
2. חייב לכלול חיסכון (לפחות 10% מההכנסה)
3. אל תשנה הכל בבת אחת - שינויים הדרגתיים
4. הסבר כל המלצה בקצרה
5. זהה הזדמנויות לחיסכון

פורמט תשובה - JSON בלבד:
{
  "categories": [
    { "name": "שם קטגוריה", "recommended": 1000, "reasoning": "הסבר קצר" }
  ],
  "savings": { "amount": 2000, "reasoning": "הסבר" },
  "opportunities": [
    { "category": "מסעדות", "current": 2000, "target": 1500, "savings": 500, "tips": ["טיפ 1", "טיפ 2"] }
  ],
  "confidence": 0.85
}`;

function buildBudgetPrompt(data: UserFinancialData, availableBudget: number): string {
  let prompt = `בנה תקציב חודשי עבור משתמש עם הנתונים הבאים:\n\n`;
  
  prompt += `💰 הכנסה חודשית: ${data.totalIncome} ₪\n`;
  prompt += `🏠 הוצאות קבועות: ${data.fixedExpenses} ₪\n`;
  prompt += `💵 זמין לחלוקה: ${availableBudget} ₪\n\n`;
  
  prompt += `📊 הוצאות ממוצעות (3 חודשים):\n`;
  for (const spending of data.spendingHistory) {
    prompt += `• ${spending.category}: ${spending.monthlyAverage} ₪\n`;
  }
  
  if (data.goals.length > 0) {
    prompt += `\n🎯 יעדים:\n`;
    for (const goal of data.goals) {
      prompt += `• ${goal.name}: ${goal.targetAmount} ₪ עד ${goal.deadline.toLocaleDateString('he-IL')} (צריך ${goal.monthlyRequired} ₪/חודש)\n`;
    }
  }
  
  if (data.patterns.length > 0) {
    prompt += `\n🔍 דפוסים שזוהו:\n`;
    for (const pattern of data.patterns.slice(0, 5)) {
      prompt += `• ${pattern.type}: ${pattern.description}\n`;
    }
  }
  
  prompt += `\nבנה תקציב מאוזן שמאפשר חיסכון ושמירה על איכות חיים.`;
  
  return prompt;
}

function parseAIResponse(
  response: string,
  data: UserFinancialData,
  availableBudget: number
): BudgetRecommendation {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Build full recommendation
    const categories = parsed.categories.map((cat: any) => {
      const current = data.spendingHistory.find(s => s.category === cat.name)?.monthlyAverage || 0;
      return {
        name: cat.name,
        recommended: cat.recommended,
        current,
        reasoning: cat.reasoning,
        changePercent: current > 0 ? Math.round(((cat.recommended - current) / current) * 100) : 0,
      };
    });
    
    return {
      categories,
      savings: {
        amount: parsed.savings?.amount || Math.round(availableBudget * 0.1),
        percentage: Math.round((parsed.savings?.amount || availableBudget * 0.1) / data.totalIncome * 100),
        reasoning: parsed.savings?.reasoning || 'חיסכון מומלץ',
      },
      totalBudget: availableBudget,
      totalIncome: data.totalIncome,
      totalFixed: data.fixedExpenses,
      availableForVariable: availableBudget,
      savingsOpportunities: parsed.opportunities || [],
      confidenceScore: parsed.confidence || 0.7,
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return generateFallbackRecommendation(data, availableBudget);
  }
}

// ============================================================================
// Fallback Recommendation (Rule-based)
// ============================================================================

function generateFallbackRecommendation(
  data: UserFinancialData,
  availableBudget: number
): BudgetRecommendation {
  // Standard budget allocation percentages
  const allocations: Record<string, number> = {
    'קניות סופר': 0.25,
    'מזון': 0.25,
    'מסעדות': 0.10,
    'תחבורה': 0.12,
    'דלק': 0.12,
    'בילויים': 0.08,
    'קניות': 0.08,
    'בריאות': 0.05,
    'אחר': 0.12,
  };
  
  const savingsTarget = Math.round(availableBudget * 0.20); // 20% savings
  const budgetAfterSavings = availableBudget - savingsTarget;
  
  const categories = data.spendingHistory.map(spending => {
    const allocation = allocations[spending.category] || 0.05;
    const recommended = Math.round(budgetAfterSavings * allocation);
    
    return {
      name: spending.category,
      recommended,
      current: spending.monthlyAverage,
      reasoning: recommended < spending.monthlyAverage ? 
        'הפחתה קלה מומלצת' : 
        'תקציב סביר',
      changePercent: spending.monthlyAverage > 0 ? 
        Math.round(((recommended - spending.monthlyAverage) / spending.monthlyAverage) * 100) : 
        0,
    };
  });
  
  // Find savings opportunities
  const opportunities = data.spendingHistory
    .filter(s => {
      const allocation = allocations[s.category] || 0.05;
      const recommended = budgetAfterSavings * allocation;
      return s.monthlyAverage > recommended * 1.3; // 30% over recommended
    })
    .map(s => ({
      category: s.category,
      current: s.monthlyAverage,
      target: Math.round(budgetAfterSavings * (allocations[s.category] || 0.05)),
      savings: Math.round(s.monthlyAverage - budgetAfterSavings * (allocations[s.category] || 0.05)),
      tips: ['תכנון מראש', 'השוואת מחירים'],
    }));
  
  return {
    categories,
    savings: {
      amount: savingsTarget,
      percentage: 20,
      reasoning: '20% מההכנסה - מומלץ לחיסכון יציב',
    },
    totalBudget: availableBudget,
    totalIncome: data.totalIncome,
    totalFixed: data.fixedExpenses,
    availableForVariable: budgetAfterSavings,
    savingsOpportunities: opportunities,
    confidenceScore: 0.6,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format budget recommendation as WhatsApp message
 */
export function formatBudgetMessage(recommendation: BudgetRecommendation): string {
  let message = `✨ הכנתי לך תוכנית תקציב מותאמת אישית!\n\n`;
  
  message += `📊 **סיכום:**\n`;
  message += `💰 הכנסה: ${formatCurrency(recommendation.totalIncome)}\n`;
  message += `🏠 קבועות: ${formatCurrency(recommendation.totalFixed)}\n`;
  message += `💵 זמין: ${formatCurrency(recommendation.availableForVariable)}\n\n`;
  
  message += `📋 **התקציב המומלץ:**\n\n`;
  
  for (const cat of recommendation.categories.slice(0, 8)) {
    const changeIcon = cat.changePercent < -5 ? '⬇️' : cat.changePercent > 5 ? '⬆️' : '➡️';
    message += `${changeIcon} ${cat.name}: ${formatCurrency(cat.recommended)}\n`;
    if (cat.changePercent !== 0) {
      message += `   (${cat.reasoning})\n`;
    }
  }
  
  message += `\n💰 **חיסכון:** ${formatCurrency(recommendation.savings.amount)} (${recommendation.savings.percentage}%)\n`;
  message += `   ${recommendation.savings.reasoning}\n`;
  
  if (recommendation.savingsOpportunities.length > 0) {
    message += `\n💡 **הזדמנויות לחיסכון:**\n`;
    for (const opp of recommendation.savingsOpportunities.slice(0, 3)) {
      message += `• ${opp.category}: חסוך ${formatCurrency(opp.savings)}/חודש\n`;
      message += `  ${opp.tips[0]}\n`;
    }
  }
  
  message += `\nמסכים? רוצה לשנות משהו?`;
  
  return message;
}

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL')}`;
}

// ============================================================================
// Save Budget to Database
// ============================================================================

export async function saveBudgetToDatabase(
  userId: string,
  recommendation: BudgetRecommendation
): Promise<boolean> {
  const supabase = await createClient();
  
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  try {
    // Create main budget
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .upsert({
        user_id: userId,
        month: currentMonth,
        total_budget: recommendation.totalBudget,
        total_spent: 0,
        savings_goal: recommendation.savings.amount,
        is_auto_generated: true,
        confidence_score: recommendation.confidenceScore,
        status: 'active',
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,month' })
      .select()
      .single();
    
    if (budgetError) throw budgetError;
    
    // Create budget categories
    for (const cat of recommendation.categories) {
      await supabase
        .from('budget_categories')
        .upsert({
          budget_id: budget.id,
          category_name: cat.name,
          allocated_amount: cat.recommended,
          spent_amount: 0,
          remaining_amount: cat.recommended,
          percentage_used: 0,
          status: 'ok',
          created_at: new Date().toISOString(),
        }, { onConflict: 'budget_id,category_name' });
    }
    
    // Update user phase
    await supabase
      .from('users')
      .update({ phase: 'budget' })
      .eq('id', userId);
    
    return true;
  } catch (error) {
    console.error('Failed to save budget:', error);
    return false;
  }
}

export default {
  buildSmartBudget,
  formatBudgetMessage,
  saveBudgetToDatabase,
};

