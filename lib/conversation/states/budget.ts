// @ts-nocheck

import type { RouterContext, RouterResult } from '../shared';
import { isCommand } from '../shared';
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient, sendWhatsAppInteractiveButtons } from '@/lib/greenapi/client';

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

  // Check for auto budget commands
  if (command === 'auto_budget' || command === 'תקציב אוטומטי') {
    return createAutoBudget(ctx);
  }

  // Check for manual budget commands
  if (command === 'manual_budget' || command === 'הגדרה ידנית') {
    const manualMsg = `📝 *הגדרת תקציב ידנית*\n\nשלח לי את התקציב בפורמט:\n*שם קטגוריה: סכום*\n\nדוגמה:\n• מזון: 2000\n• תחזוקה: 1500\n• בידור: 800\n\nכתוב משהו כמו:\n"מזון: 2000"`;
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: manualMsg });
    return { success: true };
  }

  // Check for skip budget commands
  if (command === 'skip_budget' || command === 'דלג') {
    return skipBudget(ctx);
  }

  // Check for finish/confirm budget commands
  if (command === 'סיימתי' || command === 'finish' || command === 'confirm_budget') {
    return finishBudget(ctx);
  }

  // Check for category:amount pattern (e.g., "מזון: 2000")
  const categoryRegex = /^(.+?):\s*(\d+)$/;
  const match = msg.match(categoryRegex);
  if (match) {
    const category = match[1].trim();
    const amount = parseInt(match[2], 10);
    return setBudgetCategory(ctx, category, amount);
  }

  // Default: show help
  const helpMsg = `🎯 *ברוכים הבאים לשלב התקציב!*\n\nבחר אופציה:\n\n1️⃣ *auto_budget* - יצירת תקציב אוטומטי מהיסטוריה\n2️⃣ *manual_budget* - הגדרה ידנית של קטגוריות\n3️⃣ *skip_budget* - דילוג על שלב זה\n\nאו שלח לי: *סיימתי* כשתסיים`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: helpMsg });

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
      allocated_amount: Math.round(cat.amount * 0.95), spent_amount: cat.amount,
      remaining_amount: Math.round(cat.amount * 0.95) - cat.amount, percentage_used: cat.percentage
    }));
    if (budgetCategories.length > 0) {
      await supabase.from('budget_categories').insert(budgetCategories);
    }
  }

  // Send 4 messages: profile summary, expense breakdown, top vendors, target

  // Message 1
  let msg1 = `✨ *התקציב שלך מוכן!*\n\n`;
  msg1 += `👨‍👩‍👧‍👦 *הפרופיל שלך:*\n• ${profileContext.numPeople} נפשות\n• ${profileContext.housingType}\n• רמת הכנסה: ${profileContext.incomeLevel}\n\n`;
  msg1 += `📊 *ממוצע חודשי (12 חודשים):*\n• הכנסות: ₪${totalIncome.toLocaleString('he-IL')}\n• הוצאות: ₪${totalExpenses.toLocaleString('he-IL')}\n• יתרה: ₪${(totalIncome - totalExpenses).toLocaleString('he-IL')}`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg1 });

  // Message 2
  let msg2 = `📁 *הוצאות לפי סוג:*\n\n🔒 *קבועות:* ₪${profileContext.fixedExpenses.toLocaleString('he-IL')}\n`;
  categories.filter(c => c.expenseType === 'fixed').slice(0, 3).forEach(c => { msg2 += `   • ${c.name}: ₪${c.amount.toLocaleString('he-IL')}\n`; });
  msg2 += `\n🔄 *משתנות:* ₪${profileContext.variableExpenses.toLocaleString('he-IL')}\n`;
  categories.filter(c => c.expenseType === 'variable' || c.expenseType === 'temporary').slice(0, 3).forEach(c => { msg2 += `   • ${c.name}: ₪${c.amount.toLocaleString('he-IL')}\n`; });
  if (profileContext.specialExpenses > 0) msg2 += `\n⭐ *מיוחדות:* ₪${profileContext.specialExpenses.toLocaleString('he-IL')}`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg2 });

  // Message 3 - Top vendors
  if (vendorBreakdown.length > 0) {
    let msg3 = `💳 *הוצאות עיקריות (ממוצע חודשי):*\n\n`;
    vendorBreakdown.slice(0, 8).forEach(v => { msg3 += `• ${v.vendor}: ₪${v.avgAmount.toLocaleString('he-IL')}\n`; });
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg3 });
  }

  // Message 4 - Target
  const savingsPercentDisplay = Math.round(savingsPercent * 100);
  let msg4 = `🎯 *היעד שלך:*\n\n• יעד חיסכון (${savingsPercentDisplay}%): ₪${savingsTarget.toLocaleString('he-IL')}/חודש\n• תקציב זמין: ₪${availableBudget.toLocaleString('he-IL')}/חודש\n\n💡 *המלצת φ:*\n`;
  if (totalExpenses > totalIncome) msg4 += `⚠️ ההוצאות גבוהות מההכנסות!\nמומלץ לבדוק את ההוצאות המשתנות.`;
  else if (profileContext.variableExpenses > profileContext.fixedExpenses) msg4 += `ההוצאות המשתנות גבוהות.\nיש פוטנציאל לחיסכון משמעותי!`;
  else msg4 += `מצב טוב! רוב ההוצאות קבועות ויציבות.`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg4 });

  // Confirmation buttons
  try {
    await sendWhatsAppInteractiveButtons({
      phoneNumber: ctx.phone, message: 'מאשר את התקציב?',
      buttons: [{ buttonId: 'confirm_budget', buttonText: 'מאשר' }, { buttonId: 'manual_budget', buttonText: 'עריכה' }],
    });
  } catch {
    // Ignore button errors
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

  const confirmMsg = `✅ קטגוריה עדכנה: *${category}* - ₪${amount.toLocaleString('he-IL')}\n\nשלח עוד קטגוריה או כתוב *סיימתי*`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: confirmMsg });

  return { success: true };
}

export async function skipBudget(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Update user state
  await supabase.from('users')
    .update({
      onboarding_state: 'monitoring',
      phase: 'monitoring', phase_updated_at: new Date().toISOString()
    })
    .eq('id', ctx.userId);

  const farewellMsg = `👋 *הבנתי!*\n\nנעבור ישירות לשלב המעקב.\nאבדוק בשבילך את התקציב ואתן עדכונים קבועים! 📊`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: farewellMsg });

  return { success: true, nextPhase: 'monitoring' };
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

  // Update user state to monitoring
  await supabase.from('users')
    .update({
      onboarding_state: 'monitoring',
      phase: 'monitoring', phase_updated_at: new Date().toISOString()
    })
    .eq('id', ctx.userId);

  const completionMsg = `🎉 *התקציב שלך הוגדר בהצלחה!*\n\n📊 סה"כ ${categoryCount} קטגוריות\n\nעכשיו נעבור למעקב על התקציב שלך.\nאני אשלח לך עדכונים שבועיים ויומיים! 🚀`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: completionMsg });

  return { success: true, nextPhase: 'monitoring' };
}

export async function transitionToBudget(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Update user state
  await supabase.from('users')
    .update({
      onboarding_state: 'budget',
      phase: 'budget', phase_updated_at: new Date().toISOString()
    })
    .eq('id', ctx.userId);

  const introMsg = `🎯 *בואו נבנה תקציב!*\n\nתקציב הוא התוכנית המימונית שלך.\nאני אעזור לך להגדיר מטרות חסכון ועדכן אותך בהתקדמות.\n\nבחר אופציה:`;
  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: introMsg });

  try {
    await sendWhatsAppInteractiveButtons({
      phoneNumber: ctx.phone,
      message: 'איך תרצה להתחיל?',
      buttons: [
        { buttonId: 'auto_budget', buttonText: '🤖 אוטומטי' },
        { buttonId: 'manual_budget', buttonText: '✏️ ידנית' },
        { buttonId: 'skip_budget', buttonText: '⏭️ דלג' }
      ]
    });
  } catch {
    // Fallback if buttons fail
    const fallbackMsg = `שלח אחת מהאפשרויות:\n• auto_budget\n• manual_budget\n• skip_budget`;
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: fallbackMsg });
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
