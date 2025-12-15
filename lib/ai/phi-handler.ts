/**
 * φ Handler - מטפל בהודעות WhatsApp עם AI-first approach
 * 
 * כל ההחלטות מתקבלות ע"י AI עם context מלא
 */

import { thinkAndRespond, executeActions, loadPhiContext, type PhiContext, type PhiAction } from './phi-brain';
import { createServiceClient } from '@/lib/supabase/server';
import {
  generateChart,
  type ChartType,
  type GeneratedImage,
} from './gemini-image-client';
import type {
  CategoryData,
  MonthlyTrendData,
  PhiScoreData,
  MonthlySummaryData,
} from './chart-prompts';

// Feature flag - האם להשתמש ב-AI Orchestrator
const USE_AI_ORCHESTRATOR = process.env.USE_AI_ORCHESTRATOR === 'true';

export interface PhiHandlerResult {
  message: string;
  actions: PhiAction[];
  shouldWaitForResponse: boolean;
  imageToSend?: GeneratedImage;
}

/**
 * טיפול בהודעת טקסט עם AI Orchestrator
 */
export async function handleWithPhi(
  userId: string,
  userMessage: string,
  phoneNumber: string
): Promise<PhiHandlerResult> {
  console.log('[φ Handler] Processing message with AI Orchestrator');

  // 1. טען context מלא
  const context = await loadPhiContext(userId);
  
  // 2. תן ל-AI לחשוב ולהחליט
  const response = await thinkAndRespond(userMessage, context);
  
  // 3. בצע את הפעולות שה-AI החליט עליהן
  if (response.actions.length > 0) {
    await executeActions(response.actions, context);
  }
  
  // 4. בדוק אם צריך לייצר גרף
  let imageToSend: GeneratedImage | undefined;
  const chartAction = response.actions.find(a => a.type === 'generate_chart');
  if (chartAction && chartAction.data) {
    try {
      const result = await handleChartGeneration(
        chartAction.data.chartType as ChartType,
        userId
      );
      if (result) {
        imageToSend = result;
      }
    } catch (error) {
      console.error('[φ Handler] Chart generation error:', error);
    }
  }
  
  // 5. שמור את ההודעה ביומן
  await saveMessage(userId, 'incoming', userMessage);
  if (response.message) {
    await saveMessage(userId, 'outgoing', response.message);
  }
  
  return {
    message: response.message,
    actions: response.actions,
    shouldWaitForResponse: response.shouldWaitForResponse,
    imageToSend,
  };
}

/**
 * טיפול במסמך (PDF/תמונה) עם AI
 */
export async function handleDocumentWithPhi(
  userId: string,
  documentUrl: string,
  documentType: 'pdf' | 'image',
  phoneNumber: string
): Promise<PhiHandlerResult> {
  console.log('[φ Handler] Processing document with AI Orchestrator');

  // כאן נטפל במסמך
  // לעכשיו נשתמש בלוגיקה הקיימת ורק נשלח הודעת אישור דרך AI
  
  const context = await loadPhiContext(userId);
  
  // הודעה זמנית - נשפר אחר כך
  const response = await thinkAndRespond(
    `המשתמש שלח מסמך מסוג ${documentType}. עדכן אותו שקיבלת ושאתה מנתח.`,
    context
  );
  
  return {
    message: response.message || 'קיבלתי את המסמך! מנתח עכשיו... ⏳',
    actions: response.actions,
    shouldWaitForResponse: false,
  };
}

/**
 * בדיקה האם להשתמש ב-AI Orchestrator
 */
export function shouldUsePhiOrchestrator(): boolean {
  return USE_AI_ORCHESTRATOR;
}

/**
 * שמירת הודעה ביומן
 */
async function saveMessage(
  userId: string,
  direction: 'incoming' | 'outgoing',
  content: string
): Promise<void> {
  const supabase = createServiceClient();
  
  try {
    await supabase
      .from('wa_messages')
      .insert({
        user_id: userId,
        direction,
        content,
        message_type: 'text',
        status: 'delivered',
      });
  } catch (error) {
    console.error('[φ Handler] Error saving message:', error);
  }
}

/**
 * 🔄 המרת context ישן לחדש
 * לשימוש במעבר הדרגתי
 */
export async function migrateToPhiContext(
  userId: string,
  oldContext: Record<string, unknown>
): Promise<PhiContext> {
  const baseContext = await loadPhiContext(userId);
  
  // שילוב מידע מה-context הישן אם יש
  if (oldContext.classificationSession) {
    const session = oldContext.classificationSession as Record<string, unknown>;
    baseContext.classificationProgress = {
      done: (session.totalClassified as number) || 0,
      total: ((session.highConfidenceIncome as unknown[])?.length || 0) + 
             ((session.highConfidenceExpenses as unknown[])?.length || 0) +
             ((session.lowConfidenceIncome as unknown[])?.length || 0) +
             ((session.lowConfidenceExpenses as unknown[])?.length || 0),
      highConfidenceCount: ((session.highConfidenceIncome as unknown[])?.length || 0) +
                           ((session.highConfidenceExpenses as unknown[])?.length || 0),
      lowConfidenceCount: ((session.lowConfidenceIncome as unknown[])?.length || 0) +
                          ((session.lowConfidenceExpenses as unknown[])?.length || 0),
    };
  }
  
  return baseContext;
}

// ============================================================================
// Chart Generation Logic
// ============================================================================

/**
 * יצירת גרף לפי סוג ונתוני המשתמש
 */
async function handleChartGeneration(
  chartType: ChartType,
  userId: string
): Promise<GeneratedImage | null> {
  const supabase = createServiceClient();
  
  console.log(`[φ Handler] Generating ${chartType} chart for user ${userId}`);

  switch (chartType) {
    case 'pie':
      return await generatePieChartForUser(userId, supabase);
    case 'trend':
      return await generateTrendChartForUser(userId, supabase);
    case 'phi_score':
      return await generatePhiScoreForUser(userId, supabase);
    case 'monthly_infographic':
      return await generateMonthlyInfographicForUser(userId, supabase);
    default:
      console.warn(`[φ Handler] Unknown chart type: ${chartType}`);
      return null;
  }
}

/**
 * יצירת גרף עוגה של התפלגות הוצאות
 */
async function generatePieChartForUser(
  userId: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<GeneratedImage | null> {
  // טען תנועות מסווגות של החודש הנוכחי
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, budget_categories(name)')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('status', 'confirmed')
    .gte('tx_date', startOfMonth.toISOString());

  if (!transactions || transactions.length === 0) {
    console.log('[φ Handler] No transactions for pie chart');
    return null;
  }

  // קבץ לפי קטגוריה
  const categoryTotals = new Map<string, number>();
  let total = 0;

  for (const tx of transactions) {
    // budget_categories יכול להיות array או object בהתאם ל-query
    const budgetCat = tx.budget_categories as unknown;
    let categoryName = 'אחר';
    if (Array.isArray(budgetCat) && budgetCat.length > 0) {
      categoryName = (budgetCat[0] as { name: string }).name || 'אחר';
    } else if (budgetCat && typeof budgetCat === 'object' && 'name' in budgetCat) {
      categoryName = (budgetCat as { name: string }).name || 'אחר';
    }
    const current = categoryTotals.get(categoryName) || 0;
    categoryTotals.set(categoryName, current + tx.amount);
    total += tx.amount;
  }

  // המר ל-CategoryData
  const categories: CategoryData[] = [];
  categoryTotals.forEach((amount, name) => {
    categories.push({
      name,
      amount,
      percentage: Math.round((amount / total) * 100),
    });
  });

  // מיין לפי סכום (יורד)
  categories.sort((a, b) => b.amount - a.amount);

  const monthName = new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  
  return await generateChart('pie', {
    title: `התפלגות הוצאות - ${monthName}`,
    categories,
  });
}

/**
 * יצירת גרף מגמות חודשי
 */
async function generateTrendChartForUser(
  userId: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<GeneratedImage | null> {
  // טען נתונים של 6 חודשים אחרונים
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, type, tx_date')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .gte('tx_date', sixMonthsAgo.toISOString());

  if (!transactions || transactions.length === 0) {
    console.log('[φ Handler] No transactions for trend chart');
    return null;
  }

  // קבץ לפי חודש
  const monthlyData = new Map<string, { income: number; expenses: number }>();

  for (const tx of transactions) {
    const date = new Date(tx.tx_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('he-IL', { month: 'short' });
    
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { income: 0, expenses: 0 });
    }
    
    const current = monthlyData.get(monthKey)!;
    if (tx.type === 'income') {
      current.income += tx.amount;
    } else {
      current.expenses += tx.amount;
    }
  }

  // המר לפורמט הנדרש
  const trendData: MonthlyTrendData[] = [];
  const sortedKeys = Array.from(monthlyData.keys()).sort();
  
  for (const key of sortedKeys) {
    const [year, month] = key.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthName = date.toLocaleDateString('he-IL', { month: 'short' });
    const data = monthlyData.get(key)!;
    
    trendData.push({
      month: monthName,
      income: data.income,
      expenses: data.expenses,
    });
  }

  return await generateChart('trend', {
    title: 'מגמות הכנסות והוצאות',
    monthlyData: trendData,
  });
}

/**
 * יצירת ויזואליזציה של ציון φ
 */
async function generatePhiScoreForUser(
  userId: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<GeneratedImage | null> {
  // חשב ציון φ
  const { data: stats } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('user_id', userId)
    .eq('status', 'confirmed');

  if (!stats || stats.length === 0) {
    return null;
  }

  const totalIncome = stats.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = stats.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  
  // חישוב ציון פשוט (לשפר בהמשך)
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;
  const score = Math.max(0, Math.min(100, 50 + savingsRate)); // ציון בסיסי

  const phiScoreData: PhiScoreData = {
    score,
    breakdown: {
      savingsRate: Math.max(0, savingsRate),
      budgetAdherence: 75, // TODO: חשב מנתונים אמיתיים
      debtRatio: 20, // TODO: חשב מנתונים אמיתיים
      emergencyFund: 50, // TODO: חשב מנתונים אמיתיים
    },
    trend: savingsRate > 10 ? 'up' : savingsRate < 0 ? 'down' : 'stable',
  };

  return await generateChart('phi_score', phiScoreData as unknown as Record<string, unknown>);
}

/**
 * יצירת אינפוגרפיקה חודשית
 */
async function generateMonthlyInfographicForUser(
  userId: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<GeneratedImage | null> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, type, budget_categories(name)')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .gte('tx_date', startOfMonth.toISOString());

  if (!transactions || transactions.length === 0) {
    return null;
  }

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  
  // קבץ קטגוריות
  const categoryTotals = new Map<string, number>();
  for (const tx of transactions.filter(t => t.type === 'expense')) {
    const budgetCat = tx.budget_categories as unknown;
    let categoryName = 'אחר';
    if (Array.isArray(budgetCat) && budgetCat.length > 0) {
      categoryName = (budgetCat[0] as { name: string }).name || 'אחר';
    } else if (budgetCat && typeof budgetCat === 'object' && 'name' in budgetCat) {
      categoryName = (budgetCat as { name: string }).name || 'אחר';
    }
    const current = categoryTotals.get(categoryName) || 0;
    categoryTotals.set(categoryName, current + tx.amount);
  }

  const topCategories: CategoryData[] = [];
  categoryTotals.forEach((amount, name) => {
    topCategories.push({
      name,
      amount,
      percentage: Math.round((amount / totalExpenses) * 100),
    });
  });
  topCategories.sort((a, b) => b.amount - a.amount);

  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;
  const phiScore = Math.max(0, Math.min(100, 50 + savingsRate));

  const now = new Date();
  const summaryData: MonthlySummaryData = {
    month: now.toLocaleDateString('he-IL', { month: 'long' }),
    year: now.getFullYear(),
    totalIncome,
    totalExpenses,
    savings: totalIncome - totalExpenses,
    topCategories: topCategories.slice(0, 5),
    phiScore,
    highlights: [
      savingsRate > 20 ? '🌟 חסכת יותר מ-20% החודש!' : '',
      topCategories[0] ? `📊 ההוצאה הגדולה: ${topCategories[0].name}` : '',
      phiScore >= 70 ? '💪 ציון φ מעולה!' : '',
    ].filter(Boolean),
  };

  return await generateChart('monthly_infographic', summaryData as unknown as Record<string, unknown>);
}

/**
 * יצירת גרף מבחוץ (לשימוש ב-cron jobs וכו')
 */
export async function generateChartForUser(
  userId: string,
  chartType: ChartType
): Promise<GeneratedImage | null> {
  const supabase = createServiceClient();
  return handleChartGeneration(chartType, userId);
}

export default {
  handleWithPhi,
  handleDocumentWithPhi,
  shouldUsePhiOrchestrator,
  migrateToPhiContext,
  generateChartForUser,
};

