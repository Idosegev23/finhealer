// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/budget/create-smart
 * יצירת תקציב חכם בהתאם להיסטוריה, מטרות ומסוגלות המשתמש
 * 
 * Body:
 * {
 *   month: 'YYYY-MM',
 *   savingsGoalPercentage?: number (10-50)
 * }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { month, savingsGoalPercentage = 10 } = body;

    if (!month) {
      return NextResponse.json({ error: 'Missing month parameter' }, { status: 400 });
    }

    // 1. קבלת פרופיל פיננסי
    const { data: profile } = await supabase
      .from('user_financial_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // 2. ניתוח היסטוריה (3 חודשים אחרונים)
    const analysisResponse = await fetch(`${request.url.replace('/create-smart', '/analyze-history')}`, {
      headers: request.headers
    });
    const analysisData = await analysisResponse.json();

    if (!analysisData.canCreateBudget) {
      return NextResponse.json({
        success: false,
        error: 'אין מספיק נתונים ליצירת תקציב. נדרשות לפחות 30 תנועות מ-3 חודשים אחרונים.'
      }, { status: 400 });
    }

    // 3. קבלת מטרות פעילות
    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    // 4. חישוב הכנסה חודשית
    const monthlyIncome = calculateMonthlyIncome(profile);

    // 5. יצירת תקציב חכם עם AI
    const smartBudget = await generateSmartBudget({
      monthlyIncome,
      historicalAnalysis: analysisData.analysis,
      goals: goals || [],
      profile,
      savingsGoalPercentage
    });

    // 6. שמירה במסד נתונים
    const { data: budget, error: budgetError } = await (supabase as any)
      .from('budgets')
      .insert({
        user_id: user.id,
        month,
        total_budget: smartBudget.totalBudget,
        fixed_budget: smartBudget.byFrequency.fixed,
        temporary_budget: smartBudget.byFrequency.temporary,
        special_budget: smartBudget.byFrequency.special,
        one_time_budget: smartBudget.byFrequency.one_time,
        daily_budget: smartBudget.dailyBudget,
        weekly_budget: smartBudget.weeklyBudget,
        savings_goal: smartBudget.savingsGoal,
        available_for_spending: smartBudget.totalBudget,
        is_auto_generated: true,
        confidence_score: smartBudget.confidence,
        status: 'active'
      })
      .select()
      .single();

    if (budgetError) {
      console.error('Error creating budget:', budgetError);
      return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
    }

    // 7. שמירת תקציב לפי קטגוריות
    const categoryInserts = Object.entries(smartBudget.byCategory).map(([category, data]: [string, any]) => ({
      budget_id: budget.id,
      category_name: data.name,
      detailed_category: category,
      allocated_amount: data.amount,
      recommended_amount: data.amount,
      is_flexible: data.isFlexible,
      priority: data.priority
    }));

    await (supabase as any).from('budget_categories').insert(categoryInserts);

    // 8. שמירת תקציב לפי תדירות
    const frequencyInserts = [
      { budget_id: budget.id, expense_frequency: 'fixed', allocated_amount: smartBudget.byFrequency.fixed },
      { budget_id: budget.id, expense_frequency: 'temporary', allocated_amount: smartBudget.byFrequency.temporary },
      { budget_id: budget.id, expense_frequency: 'special', allocated_amount: smartBudget.byFrequency.special },
      { budget_id: budget.id, expense_frequency: 'one_time', allocated_amount: smartBudget.byFrequency.one_time }
    ];

    await (supabase as any).from('budget_frequency_types').insert(frequencyInserts);

    return NextResponse.json({
      success: true,
      budget,
      recommendations: smartBudget.recommendations,
      confidence: smartBudget.confidence
    });

  } catch (error) {
    console.error('Create smart budget error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function calculateMonthlyIncome(profile: any): number {
  if (!profile) return 0;
  
  const netSalary = profile.net_monthly_salary || 0;
  const additionalIncome = profile.additional_income || 0;
  
  return netSalary + additionalIncome;
}

async function generateSmartBudget(params: {
  monthlyIncome: number;
  historicalAnalysis: any;
  goals: any[];
  profile: any;
  savingsGoalPercentage: number;
}) {
  const { monthlyIncome, historicalAnalysis, goals, profile, savingsGoalPercentage } = params;

  // חישוב תקציב בסיסי - הכנסה פחות חיסכון מתוכנן
  const savingsGoal = Math.round(monthlyIncome * (savingsGoalPercentage / 100));
  const totalBudget = monthlyIncome - savingsGoal;

  // אם אין הכנסה רשומה, נשתמש בממוצע ההיסטורי + 10%
  const effectiveBudget = monthlyIncome > 0 
    ? totalBudget 
    : Math.round(historicalAnalysis.avgMonthlyTotal * 1.1);

  // חלוקה לפי תדירות (בהתבסס על היסטוריה)
  const byFrequency = {
    fixed: Math.round(historicalAnalysis.byFrequency.fixed?.avgMonthly || effectiveBudget * 0.5),
    temporary: Math.round(historicalAnalysis.byFrequency.temporary?.avgMonthly || effectiveBudget * 0.1),
    special: Math.round(historicalAnalysis.byFrequency.special?.avgMonthly || effectiveBudget * 0.15),
    one_time: Math.round(historicalAnalysis.byFrequency.one_time?.avgMonthly || effectiveBudget * 0.25)
  };

  // חלוקה לפי קטגוריות (בהתבסס על היסטוריה)
  const byCategory: Record<string, any> = {};
  
  Object.entries(historicalAnalysis.byCategory || {}).forEach(([category, data]: [string, any]) => {
    byCategory[category] = {
      name: getCategoryDisplayName(category),
      amount: Math.round(data.avgMonthly),
      isFlexible: isFlexibleCategory(category),
      priority: getCategoryPriority(category)
    };
  });

  // חישוב תקציב יומי ושבועי
  const dailyBudget = Math.round(effectiveBudget / 30);
  const weeklyBudget = Math.round(effectiveBudget / 4);

  // המלצות AI
  const recommendations = await generateRecommendations({
    monthlyIncome,
    totalBudget: effectiveBudget,
    historicalAnalysis,
    goals,
    profile
  });

  // ציון ביטחון
  const confidence = calculateConfidence(historicalAnalysis);

  return {
    totalBudget: effectiveBudget,
    savingsGoal,
    dailyBudget,
    weeklyBudget,
    byFrequency,
    byCategory,
    recommendations,
    confidence
  };
}

async function generateRecommendations(params: any) {
  const { monthlyIncome, totalBudget, historicalAnalysis, goals, profile } = params;

  const systemPrompt = `אתה יועץ פיננסי אישי מומחה. תפקידך לתת המלצות מותאמות אישית לניהול תקציב.
דבר בשפה חמה ומעודדת, תן המלצות מעשיות וברורות.`;

  const userPrompt = `נתוני המשתמש:
- הכנסה חודשית: ₪${monthlyIncome.toLocaleString()}
- תקציב מוצע: ₪${totalBudget.toLocaleString()}
- ממוצע הוצאות היסטורי: ₪${historicalAnalysis.avgMonthlyTotal.toLocaleString()}
- מגמה: ${historicalAnalysis.trends.trend}
- מטרות: ${goals.length} מטרות פעילות

תן 3-5 המלצות ספציפיות לשיפור ניהול התקציב.
החזר JSON array:
["המלצה 1", "המלצה 2", "המלצה 3"]`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{"recommendations":[]}';
    const result = JSON.parse(content);
    
    return result.recommendations || [];
  } catch (error) {
    console.error('AI recommendations error:', error);
    return [
      'עקוב אחר ההוצאות הקבועות שלך - הן חלק גדול מהתקציב',
      'נסה לצמצם הוצאות חד פעמיות ב-10-15%',
      'שמור לפחות 10% מההכנסה לחיסכון'
    ];
  }
}

function calculateConfidence(analysis: any): number {
  // ציון ביטחון מבוסס על:
  // 1. מספר חודשים עם נתונים
  // 2. מספר תנועות
  // 3. יציבות (מגמה stable = ביטחון גבוה יותר)
  
  let confidence = 0.5; // בסיס
  
  if (analysis.monthsWithData >= 3) confidence += 0.2;
  if (analysis.totalTransactions >= 50) confidence += 0.2;
  if (analysis.trends.trend === 'stable') confidence += 0.1;
  
  return Math.min(confidence, 0.95);
}

function getCategoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    food_beverages: '🍔 מזון ומשקאות',
    cellular_communication: '📱 סלולר ותקשורת',
    entertainment_leisure: '🎬 בילויים',
    transportation_fuel: '⛽ תחבורה',
    housing_maintenance: '🏠 דיור',
    clothing_footwear: '👕 ביגוד',
    health_medical: '💊 בריאות',
    education: '📚 חינוך',
    utilities: '⚡ שירותים',
    shopping_general: '🛒 קניות',
    subscriptions: '📺 מנויים',
    insurance: '🛡️ ביטוחים',
    loans_debt: '💳 חובות',
    other: '📦 אחר'
  };
  return names[category] || category;
}

function isFlexibleCategory(category: string): boolean {
  // קטגוריות גמישות (ניתנות לצמצום)
  const flexibleCategories = [
    'food_beverages',
    'entertainment_leisure',
    'clothing_footwear',
    'shopping_general'
  ];
  return flexibleCategories.includes(category);
}

function getCategoryPriority(category: string): number {
  // 1 = גבוה (חובה), 2 = בינוני, 3 = נמוך (ניתן לצמצום)
  const priorities: Record<string, number> = {
    housing_maintenance: 1,
    utilities: 1,
    insurance: 1,
    health_medical: 1,
    education: 1,
    loans_debt: 1,
    food_beverages: 2,
    transportation_fuel: 2,
    cellular_communication: 2,
    subscriptions: 2,
    entertainment_leisure: 3,
    clothing_footwear: 3,
    shopping_general: 3,
    other: 3
  };
  return priorities[category] || 2;
}

