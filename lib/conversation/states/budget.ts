// @ts-nocheck

import type { RouterContext, RouterResult } from '../shared';
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient, sendWhatsAppInteractiveButtons } from '@/lib/greenapi/client';
import { parseStateIntent } from '@/lib/ai/state-intent';

interface BudgetData {
  totalIncome: number;
  totalExpenses: number;
  categories: Array<{ name: string; amount: number; percentage: number; expenseType: string }>;
  vendorBreakdown: Array<{ vendor: string; avgAmount: number; monthlyCount: number; category: string }>;
  profileContext: { numPeople: number; housingType: string; incomeLevel: string; fixedExpenses: number; variableExpenses: number; specialExpenses: number };
}

export async function handleBudgetPhase(ctx: RouterContext, msg: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const command = msg.toLowerCase().trim();

  // ── Layer 0: Button IDs (instant, no AI) ──
  const buttonActions: Record<string, string> = {
    'auto_budget': 'auto_budget',
    'manual_budget': 'manual_budget',
    'skip_budget': 'skip',
    'confirm_budget': 'finish',
  };

  let resolvedIntent = buttonActions[command] || null;

  // ── Layer 0b: Regex pattern for category:amount ──
  const categoryRegex = /^(.+?):\s*(\d+)$/;
  const categoryMatch = msg.match(categoryRegex);
  if (categoryMatch) {
    const category = categoryMatch[1].trim();
    const amount = parseInt(categoryMatch[2], 10);
    return setBudgetCategory(ctx, category, amount);
  }

  // ── Layer 1: AI Intent Detection ──
  if (!resolvedIntent) {
    let intent = { intent: 'unknown', confidence: 0, params: {} };
    try {
      intent = await parseStateIntent(msg, 'budget');
    } catch (intentErr) {
      console.warn(`[Budget] parseStateIntent failed:`, intentErr);
    }
    console.log(`[Budget] AI_INTENT: intent="${intent.intent}", confidence=${intent.confidence}`);

    if (intent.confidence >= 0.6) {
      resolvedIntent = intent.intent;

      // AI detected category_set with params
      if (intent.intent === 'category_set' && intent.params?.category && intent.params?.amount) {
        return setBudgetCategory(ctx, intent.params.category, intent.params.amount);
      }
    }
  }

  // ── Dispatch ──
  if (resolvedIntent === 'auto_budget') {
    return createAutoBudget(ctx);
  }

  if (resolvedIntent === 'manual_budget') {
    const manualMsg = `📝 *בוא נגדיר תקציב בעצמך*\n\nשלח לי כמה כסף מותר להוציא על כל נושא.\n\nכתוב ככה:\n*שם הנושא: סכום*\n\nלדוגמה:\n• מזון: 2000\n• חשבונות: 1500\n• בילויים: 800\n\nפשוט כתוב נושא ומספר, למשל:\n*"מזון: 2000"*`;
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: manualMsg });
    return { success: true };
  }

  if (resolvedIntent === 'skip') {
    return skipBudget(ctx);
  }

  if (resolvedIntent === 'finish') {
    return finishBudget(ctx);
  }

  // Default: show budget options with buttons
  try {
    await greenAPI.sendInteractiveButtons({
      phoneNumber: ctx.phone,
      message: `💰 *בוא נבנה תקציב!*\n\nתקציב = כמה כסף מותר להוציא כל חודש על כל נושא (אוכל, חשבונות וכו').\n\nאני יכול לבנות לך תקציב אוטומטי לפי הנתונים שכבר שלחת.`,
      buttons: [
        { buttonId: 'auto_budget', buttonText: 'בנה לי תקציב 🚀' },
        { buttonId: 'manual_budget', buttonText: 'אגדיר בעצמי ✏️' },
        { buttonId: 'skip_budget', buttonText: 'דלג לשלב הבא ⏭️' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `💰 *בוא נבנה תקציב!*\n\nתקציב = כמה כסף מותר להוציא כל חודש.\n\nכתוב:\n• *"אוטומטי"* — אני אבנה לך תקציב לפי הנתונים שלך\n• *"בעצמי"* — תגדיר בעצמך כמה לכל נושא\n• *"דלג"* — לעבור לשלב הבא`,
    });
  }

  return { success: true };
}

export async function createAutoBudget(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const budgetData = await calculateBudgetData(ctx.userId);
  const { totalIncome, totalExpenses, categories, vendorBreakdown, profileContext } = budgetData;

  // Savings target based on income level
  let savingsPercent = 0.10;
  if (profileContext.incomeLevel === 'גבוהה') savingsPercent = 0.15;
  if (profileContext.incomeLevel === 'נמוכה') savingsPercent = 0.05;

  const savingsTarget = Math.round(totalIncome * savingsPercent);
  const availableBudget = totalIncome - savingsTarget;
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Upsert budget
  const { data: existingBudget } = await supabase
    .from('budgets')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('month', currentMonth)
    .single();

  let budgetId: string;

  if (existingBudget) {
    budgetId = existingBudget.id;
    await supabase.from('budgets')
      .update({ total_budget: availableBudget, savings_goal: savingsTarget, is_auto_generated: true })
      .eq('id', budgetId);
  } else {
    const { data: newBudget } = await supabase
      .from('budgets')
      .insert({
        user_id: ctx.userId, month: currentMonth, total_budget: availableBudget,
        total_spent: totalExpenses, savings_goal: savingsTarget, is_auto_generated: true, status: 'active'
      })
      .select('id').single();
    budgetId = newBudget?.id;
  }

  if (!budgetId) {
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: '😕 לא הצלחתי ליצור את התקציב. נסה שוב מאוחר יותר.' });
    return { success: false };
  }

  // Save budget categories
  if (budgetId) {
    await supabase.from('budget_categories').delete().eq('budget_id', budgetId);
    const budgetCategories = categories.map(cat => ({
      budget_id: budgetId, category_name: cat.name, detailed_category: cat.name,
      allocated_amount: Math.round(cat.amount * 0.95), spent_amount: 0,
      remaining_amount: Math.round(cat.amount * 0.95), percentage_used: 0
    }));
    if (budgetCategories.length > 0) {
      await supabase.from('budget_categories').insert(budgetCategories);
    }
  }

  // Consolidated budget summary (2 messages instead of 4)

  // Message 1: Overview + expenses breakdown
  let msg1 = `✨ *התקציב שלך מוכן!*\n\n`;
  msg1 += `📊 *ממוצע חודשי:*\n`;
  msg1 += `💚 הכנסות: ₪${totalIncome.toLocaleString('he-IL')}\n`;
  msg1 += `💸 הוצאות: ₪${totalExpenses.toLocaleString('he-IL')}\n`;
  msg1 += `${totalIncome >= totalExpenses ? '✅' : '⚠️'} יתרה: ₪${(totalIncome - totalExpenses).toLocaleString('he-IL')}\n\n`;

  msg1 += `📁 *הוצאות:*\n`;
  msg1 += `🔒 קבועות: ₪${profileContext.fixedExpenses.toLocaleString('he-IL')}\n`;
  msg1 += `🔄 משתנות: ₪${profileContext.variableExpenses.toLocaleString('he-IL')}\n`;
  if (profileContext.specialExpenses > 0) msg1 += `⭐ מיוחדות: ₪${profileContext.specialExpenses.toLocaleString('he-IL')}\n`;

  if (vendorBreakdown.length > 0) {
    msg1 += `\n💳 *הוצאות עיקריות:*\n`;
    vendorBreakdown.slice(0, 5).forEach(v => { msg1 += `• ${v.vendor}: ₪${v.avgAmount.toLocaleString('he-IL')}\n`; });
  }
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg1 });

  // Message 2: Target + recommendation
  const savingsPercentDisplay = Math.round(savingsPercent * 100);
  let msg2 = `🎯 *היעד שלך:*\n\n`;
  msg2 += `• חיסכון (${savingsPercentDisplay}%): ₪${savingsTarget.toLocaleString('he-IL')}/חודש\n`;
  msg2 += `• תקציב זמין: ₪${availableBudget.toLocaleString('he-IL')}/חודש\n\n`;
  msg2 += `💡 *המלצת φ:* `;
  if (totalExpenses > totalIncome) msg2 += `ההוצאות גבוהות מההכנסות! מומלץ לבדוק את ההוצאות המשתנות.`;
  else if (profileContext.variableExpenses > profileContext.fixedExpenses) msg2 += `ההוצאות המשתנות גבוהות. יש פוטנציאל לחיסכון!`;
  else msg2 += `מצב טוב! רוב ההוצאות קבועות ויציבות.`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg2 });

  // Confirmation buttons
  try {
    await sendWhatsAppInteractiveButtons(ctx.phone, {
      message: 'מה דעתך על התקציב?',
      buttons: [{ buttonId: 'confirm_budget', buttonText: 'מתאים לי ✅' }, { buttonId: 'manual_budget', buttonText: 'אשנה בעצמי ✏️' }],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `כתוב *"מאשר"* אם התקציב מתאים, או *"בעצמי"* אם תרצה לשנות.`,
    });
  }

  return { success: true };
}

export async function setBudgetCategory(ctx: RouterContext, category: string, amount: number): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const currentMonth = new Date().toISOString().slice(0, 7);

  // Get or create budget
  const { data: existingBudget } = await supabase
    .from('budgets')
    .select('id, total_budget')
    .eq('user_id', ctx.userId)
    .eq('month', currentMonth)
    .single();

  let budgetId: string;

  if (existingBudget) {
    budgetId = existingBudget.id;
  } else {
    const { data: newBudget } = await supabase
      .from('budgets')
      .insert({
        user_id: ctx.userId,
        month: currentMonth,
        total_budget: 0,
        status: 'active'
      })
      .select('id').single();
    budgetId = newBudget?.id;
  }

  // Upsert budget category
  await supabase.from('budget_categories').upsert(
    {
      budget_id: budgetId,
      category_name: category,
      detailed_category: category,
      allocated_amount: amount,
      spent_amount: 0,
      remaining_amount: amount,
      percentage_used: 0
    },
    { onConflict: 'budget_id,category_name' }
  );

  const confirmMsg = `✅ נשמר: *${category}* — ₪${amount.toLocaleString('he-IL')} לחודש\n\nרוצה להוסיף עוד נושא? כתוב אותו באותו פורמט.\nסיימת? כתוב *"סיימתי"*.`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: confirmMsg });

  return { success: true };
}

export async function skipBudget(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Use calculated phase (don't hardcode)
  const { calculatePhase: calcPhaseSkip } = await import('@/lib/services/PhaseService');
  const skipPhase = await calcPhaseSkip(ctx.userId);

  // Update user state
  await supabase.from('users')
    .update({
      onboarding_state: 'monitoring',
      phase: skipPhase, phase_updated_at: new Date().toISOString()
    })
    .eq('id', ctx.userId);

  const farewellMsg = `👋 *בסדר, דילגנו על התקציב!*\n\nעוברים לשלב המעקב — אני אשלח לך עדכונים על ההוצאות שלך באופן קבוע 📊`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: farewellMsg });

  return { success: true, newState: 'monitoring' as any };
}

export async function finishBudget(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const currentMonth = new Date().toISOString().slice(0, 7);

  // Get current month's budget and count categories
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('month', currentMonth)
    .single();

  let categoryCount = 0;
  if (budget) {
    const { count } = await supabase
      .from('budget_categories')
      .select('*', { count: 'exact', head: true })
      .eq('budget_id', budget.id);
    categoryCount = count || 0;
  }

  // Use calculated phase (don't hardcode)
  const { calculatePhase: calcPhaseBudget } = await import('@/lib/services/PhaseService');
  const budgetPhase = await calcPhaseBudget(ctx.userId);

  // Update user state to monitoring
  await supabase.from('users')
    .update({
      onboarding_state: 'monitoring',
      phase: budgetPhase, phase_updated_at: new Date().toISOString()
    })
    .eq('id', ctx.userId);

  const completionMsg = `🎉 *מעולה, התקציב מוכן!*\n\n📊 הגדרת ${categoryCount} נושאים בתקציב.\n\nמעכשיו אני עוקב בשבילך — אשלח לך עדכונים כשצריך לשים לב למשהו 🚀`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: completionMsg });

  return { success: true, newState: 'monitoring' as any };
}

export async function transitionToBudget(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Use calculated phase (don't hardcode)
  const { calculatePhase: calcPhaseTrans } = await import('@/lib/services/PhaseService');
  const transPhase = await calcPhaseTrans(ctx.userId);

  // Update user state
  await supabase.from('users')
    .update({
      onboarding_state: 'budget',
      phase: transPhase, phase_updated_at: new Date().toISOString()
    })
    .eq('id', ctx.userId);

  const introMsg = `💰 *בוא נבנה תקציב חודשי!*\n\nתקציב = כמה כסף מותר להוציא כל חודש על כל נושא.\nאני אעזור לך לדעת בדיוק לאן הולך הכסף.`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: introMsg });

  try {
    await sendWhatsAppInteractiveButtons(ctx.phone, {
      message: 'איך תרצה להתחיל?',
      buttons: [
        { buttonId: 'auto_budget', buttonText: 'בנה לי תקציב 🚀' },
        { buttonId: 'manual_budget', buttonText: 'אגדיר בעצמי ✏️' },
        { buttonId: 'skip_budget', buttonText: 'דלג לשלב הבא ⏭️' }
      ]
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `כתוב:\n• *"אוטומטי"* — אני אבנה לך תקציב\n• *"בעצמי"* — תגדיר בעצמך\n• *"דלג"* — לעבור לשלב הבא`,
    });
  }

  return { success: true };
}

export async function calculateBudgetData(userId: string): Promise<BudgetData> {
  const supabase = createServiceClient();

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const startDate = twelveMonthsAgo.toISOString().split('T')[0];

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('tx_date', startDate);

  const { data: profile } = await supabase
    .from('user_financial_profile')
    .select('*')
    .eq('user_id', userId)
    .single();

  const { count: childrenCount } = await supabase
    .from('children')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const income = transactions?.filter(t => t.type === 'income') || [];
  const expenses = transactions?.filter(t => t.type === 'expense') || [];
  const monthsWithData = new Set(transactions?.map(t => t.tx_date?.substring(0, 7))).size || 1;

  const totalIncome = Math.round(income.reduce((sum, t) => sum + Math.abs(t.amount), 0) / monthsWithData);
  const totalExpenses = Math.round(expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0) / monthsWithData);

  // Vendor breakdown
  const vendorMap: Record<string, { total: number; count: number; category: string }> = {};
  expenses.forEach(t => {
    const vendor = t.vendor || t.original_description || 'לא ידוע';
    if (!vendorMap[vendor]) vendorMap[vendor] = { total: 0, count: 0, category: t.category || t.expense_category || 'אחר' };
    vendorMap[vendor].total += Math.abs(t.amount);
    vendorMap[vendor].count++;
  });

  const vendorBreakdown = Object.entries(vendorMap)
    .map(([vendor, data]) => ({
      vendor,
      avgAmount: Math.round(data.total / monthsWithData),
      monthlyCount: Math.round((data.count / monthsWithData) * 10) / 10,
      category: data.category
    }))
    .sort((a, b) => b.avgAmount - a.avgAmount)
    .slice(0, 20);

  // Category breakdown
  const categoryMap: Record<string, { amount: number; type: string }> = {};
  expenses.forEach(t => {
    const cat = t.category || t.expense_category || 'אחר';
    const expType = t.expense_frequency || t.expense_type || 'variable';
    if (!categoryMap[cat]) categoryMap[cat] = { amount: 0, type: expType };
    categoryMap[cat].amount += Math.abs(t.amount);
  });

  const categories = Object.entries(categoryMap)
    .map(([name, data]) => ({
      name,
      amount: Math.round(data.amount / monthsWithData),
      percentage: totalExpenses > 0 ? Math.round((data.amount / monthsWithData / totalExpenses) * 100) : 0,
      expenseType: data.type
    }))
    .sort((a, b) => b.amount - a.amount);

  const fixedExpenses = categories
    .filter(c => c.expenseType === 'fixed')
    .reduce((sum, c) => sum + c.amount, 0);

  const variableExpenses = categories
    .filter(c => c.expenseType === 'variable' || c.expenseType === 'temporary')
    .reduce((sum, c) => sum + c.amount, 0);

  const specialExpenses = categories
    .filter(c => c.expenseType === 'special' || c.expenseType === 'one_time')
    .reduce((sum, c) => sum + c.amount, 0);

  const numPeople = 1 + (profile?.marital_status === 'married' ? 1 : 0) + (childrenCount || 0);
  const housingType = profile?.owns_home ? 'בעלות' : 'שכירות';
  const incomeLevel = totalIncome > 20000 ? 'גבוהה' : totalIncome > 10000 ? 'בינונית' : 'נמוכה';

  return {
    totalIncome,
    totalExpenses,
    categories,
    vendorBreakdown,
    profileContext: {
      numPeople,
      housingType,
      incomeLevel,
      fixedExpenses,
      variableExpenses,
      specialExpenses
    }
  };
}
