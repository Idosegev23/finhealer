/**
 * φ Handler - מטפל בהודעות WhatsApp עם AI-first approach
 * 
 * כל ההחלטות מתקבלות ע"י AI עם context מלא
 */

import { thinkWithPhi, type PhiContext, type PhiAction, type PhiResponse } from './gpt52-client';
import { loadPhiContext } from './phi-brain';
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
  
  // 2. תן ל-AI (GPT-5.2 / Responses API) לחשוב ולהחליט
  const response = await thinkWithPhi(userMessage, context);
  
  // 3. בצע את הפעולות שה-AI החליט עליהן
  if (response.actions.length > 0) {
    await executePhiActions(response.actions, context);
  }
  
  // 3.5 אם אין הודעה אבל יש פעולות - בקש מה-AI לייצר הודעה
  let finalMessage = response.message;
  if (!finalMessage && response.actions.length > 0) {
    console.log('[φ Handler] No message from AI, requesting follow-up message...');
    
    // בנה תיאור של מה שבוצע
    const actionsSummary = response.actions
      .map(a => {
        if (a.type === 'save_user_name') return `שמרתי את השם: ${a.data?.name}`;
        if (a.type === 'request_document') return `ביקשתי מסמך: ${a.data?.document_type}`;
        if (a.type === 'classify_transaction') return `סיווגתי תנועה`;
        return `ביצעתי: ${a.type}`;
      })
      .join(', ');
    
    // קריאה נוספת ל-AI לייצר הודעה למשתמש
    const followUpResponse = await thinkWithPhi(
      `[מערכת] הפעולות הבאות בוצעו בהצלחה: ${actionsSummary}. עכשיו תן הודעה קצרה וחמה למשתמש שמסכמת מה קרה ומה הצעד הבא. אל תקרא לשום tool - רק החזר הודעת טקסט!`,
      { ...context, userName: (response.actions.find(a => a.type === 'save_user_name')?.data?.name as string) || context.userName }
    );
    
    finalMessage = followUpResponse.message || 'קיבלתי! 👍';
    console.log('[φ Handler] Got follow-up message from AI');
  }
  
  // 4. בדוק אם צריך לייצר גרף
  let imageToSend: GeneratedImage | undefined;
  const chartAction = response.actions.find(a => a.type === 'generate_chart');
  console.log('[φ Handler] Chart action found:', chartAction ? 'YES' : 'NO');
  
  if (chartAction && chartAction.data) {
    console.log('[φ Handler] 🎨 Starting chart generation:', chartAction.data);
    try {
      const result = await handleChartGeneration(
        chartAction.data.chartType as string,
        userId,
        chartAction.data.title as string | undefined,
        chartAction.data.description as string | undefined
      );
      console.log('[φ Handler] Chart generation result:', result ? 'SUCCESS' : 'FAILED');
      if (result) {
        imageToSend = result;
      }
    } catch (error) {
      console.error('[φ Handler] Chart generation error:', error);
    }
  }
  
  // 5. שמור את ההודעה ביומן
  await saveMessage(userId, 'incoming', userMessage);
  if (finalMessage) {
    await saveMessage(userId, 'outgoing', finalMessage);
  }
  
  return {
    message: finalMessage,
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
  const response = await thinkWithPhi(
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
 * יצירת גרף דינאמי לפי בקשת ה-AI
 */
async function handleChartGeneration(
  chartType: string,
  userId: string,
  title?: string,
  description?: string
): Promise<GeneratedImage | null> {
  const supabase = createServiceClient();
  
  console.log(`[φ Handler] Generating dynamic chart: ${chartType} for user ${userId}`);

  // טען נתוני המשתמש
  const userData = await loadUserFinancialData(userId, supabase);
  
  if (!userData) {
    console.log('[φ Handler] No financial data found');
    return null;
  }
  
  // בנה prompt דינאמי לפי סוג הגרף ותיאור
  const prompt = buildDynamicChartPrompt(chartType, userData, title, description);
  
  console.log('[φ Handler] Sending to Gemini with prompt length:', prompt.length);
  
  // שלח ל-Gemini
  return await generateChartWithGemini(prompt, `${chartType}_chart.png`);
}

/**
 * טוען נתוני פיננסים של המשתמש
 */
async function loadUserFinancialData(
  userId: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  // 3 חודשים אחרונים
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, type, category, vendor, tx_date, status')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .gte('tx_date', threeMonthsAgo.toISOString())
    .order('tx_date', { ascending: false });
    
  if (!transactions || transactions.length === 0) {
    return null;
  }
  
  // חישוב סטטיסטיקות
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);
    
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);
    
  // קיבוץ לפי קטגוריה
  const categoryTotals: Record<string, number> = {};
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const cat = t.category || 'אחר';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
    });
    
  // קיבוץ לפי חודש
  const monthlyData: Record<string, { income: number; expenses: number }> = {};
  transactions.forEach(t => {
    const month = new Date(t.tx_date).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    if (!monthlyData[month]) {
      monthlyData[month] = { income: 0, expenses: 0 };
    }
    if (t.type === 'income') {
      monthlyData[month].income += Number(t.amount);
    } else {
      monthlyData[month].expenses += Number(t.amount);
    }
  });
  
  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    categoryTotals,
    monthlyData,
    transactionCount: transactions.length,
  };
}

/**
 * בונה prompt דינאמי ל-Gemini
 */
function buildDynamicChartPrompt(
  chartType: string,
  data: NonNullable<Awaited<ReturnType<typeof loadUserFinancialData>>>,
  title?: string,
  description?: string
): string {
  const formatMoney = (n: number) => n.toLocaleString('he-IL');
  
  // בניית תיאור הנתונים
  const categoriesText = Object.entries(data.categoryTotals)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([cat, amount]) => `- ${cat}: ${formatMoney(amount)} ₪`)
    .join('\n');
    
  const monthlyText = Object.entries(data.monthlyData)
    .map(([month, d]) => `- ${month}: הכנסות ${formatMoney(d.income)} ₪, הוצאות ${formatMoney(d.expenses)} ₪`)
    .join('\n');
  
  const basePrompt = `צור אינפוגרפיקה/גרף בעברית עבור משתמש ישראלי.

🎨 *סגנון עיצוב:*
- מינימליסטי ומודרני
- צבעי מותג φ (Phi): זהב #A96B48, כהה #2E3440, רקע בהיר #ECEFF4
- כלול את סמל φ בפינה
- טקסט בעברית, RTL
- ברור וקריא

📊 *סוג הגרף המבוקש:* ${chartType}
${title ? `📌 *כותרת:* ${title}` : ''}
${description ? `📝 *תיאור:* ${description}` : ''}

💰 *הנתונים הפיננסיים:*
- סה"כ הכנסות: ${formatMoney(data.totalIncome)} ₪
- סה"כ הוצאות: ${formatMoney(data.totalExpenses)} ₪
- יתרה: ${formatMoney(data.balance)} ₪

📈 *התפלגות הוצאות לפי קטגוריה:*
${categoriesText}

📅 *נתונים חודשיים:*
${monthlyText}

צור תמונה ויזואלית יפה שמציגה את הנתונים בצורה ברורה ומעוצבת.`;

  return basePrompt;
}

/**
 * שולח prompt ל-Gemini ומקבל תמונה
 */
async function generateChartWithGemini(
  prompt: string,
  filename: string
): Promise<GeneratedImage | null> {
  try {
    const result = await generateChart('pie', { 
      title: 'Dynamic Chart',
      categories: [],
      customPrompt: prompt 
    });
    
    if (result) {
      return {
        ...result,
        filename,
      };
    }
    return null;
  } catch (error) {
    console.error('[φ Handler] Gemini generation error:', error);
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
  return handleChartGeneration(chartType, userId);
}

// ============================================================================
// Action Execution - ביצוע פעולות שה-AI החליט עליהן
// ============================================================================

/**
 * ביצוע פעולות שה-AI החליט עליהן
 */
async function executePhiActions(
  actions: PhiAction[],
  context: PhiContext
): Promise<void> {
  const supabase = createServiceClient();
  
  for (const action of actions) {
    console.log(`[φ Handler] Executing action: ${action.type}`);
    
    try {
      switch (action.type) {
        case 'save_user_name':
          // 🆕 שמירת שם המשתמש
          if (action.data?.name) {
            await supabase
              .from('users')
              .update({ 
                full_name: action.data.name,
                current_phase: 'document_upload', // העבר לשלב הבא
              })
              .eq('id', context.userId);
            console.log(`[φ Handler] ✅ User name saved: ${action.data.name}`);
          }
          break;
          
        case 'save_transaction':
          if (action.data) {
            await supabase.from('transactions').insert({
              user_id: context.userId,
              vendor: action.data.vendor,
              amount: action.data.amount,
              type: action.data.tx_type,
              category: action.data.category || 'לא מסווג',
              tx_date: action.data.date || new Date().toISOString(),
              notes: action.data.notes,
              source: 'manual',
              status: 'confirmed',
            });
            console.log(`[φ Handler] ✅ Transaction saved: ${action.data.vendor}`);
          }
          break;
          
        case 'classify_transaction':
          if (action.data?.transaction_id && action.data?.category) {
            // מצא category_id
            const { data: categoryData } = await supabase
              .from('budget_categories')
              .select('id')
              .eq('user_id', context.userId)
              .eq('name', action.data.category)
              .single();
            
            const updateData: Record<string, unknown> = {
              category: action.data.category,
              status: action.data.is_confirmed ? 'confirmed' : 'proposed',
            };
            
            if (categoryData?.id) {
              updateData.category_id = categoryData.id;
            }
            
            await supabase
              .from('transactions')
              .update(updateData)
              .eq('id', action.data.transaction_id);
              
            console.log(`[φ Handler] ✅ Transaction classified: ${action.data.transaction_id} → ${action.data.category}`);
          }
          break;
          
        case 'bulk_classify':
          if (action.data?.transaction_ids && action.data?.category) {
            const ids = action.data.transaction_ids as string[];
            await supabase
              .from('transactions')
              .update({
                category: action.data.category,
                status: 'confirmed',
              })
              .in('id', ids);
              
            console.log(`[φ Handler] ✅ Bulk classified: ${ids.length} transactions → ${action.data.category}`);
          }
          break;
          
        case 'save_pattern':
          if (action.data?.vendor && action.data?.category) {
            await supabase.from('user_patterns').upsert({
              user_id: context.userId,
              vendor: action.data.vendor,
              category: action.data.category,
              confidence: 1.0,
              usage_count: 1,
            }, {
              onConflict: 'user_id,vendor',
            });
            console.log(`[φ Handler] ✅ Pattern saved: ${action.data.vendor} → ${action.data.category}`);
          }
          break;
          
        case 'set_budget':
          if (action.data?.category && action.data?.amount) {
            await supabase.from('budget_categories').upsert({
              user_id: context.userId,
              name: action.data.category,
              monthly_limit: action.data.amount,
            }, {
              onConflict: 'user_id,name',
            });
            console.log(`[φ Handler] ✅ Budget set: ${action.data.category} = ${action.data.amount}₪`);
          }
          break;
          
        case 'set_goal':
          if (action.data?.goal_name && action.data?.target_amount) {
            await supabase.from('goals').insert({
              user_id: context.userId,
              name: action.data.goal_name,
              target_amount: action.data.target_amount,
              deadline: action.data.deadline,
              current_amount: 0,
              status: 'active',
            });
            console.log(`[φ Handler] ✅ Goal created: ${action.data.goal_name}`);
          }
          break;
          
        case 'move_to_phase':
          if (action.data?.phase) {
            await supabase
              .from('users')
              .update({ current_phase: action.data.phase })
              .eq('id', context.userId);
            console.log(`[φ Handler] ✅ Phase changed to: ${action.data.phase}`);
          }
          break;
          
        case 'get_financial_summary':
          // הסיכום הפיננסי כבר קיים ב-context.financial
          console.log(`[φ Handler] 📊 Financial summary requested for period: ${action.data?.period}`);
          // לא צריך לעשות כלום - ה-AI כבר קיבל את המידע ב-context
          break;
          
        case 'request_document':
          console.log(`[φ Handler] 📄 Document requested: ${action.data?.document_type}`);
          // המידע כבר נכלל בהודעת ה-AI למשתמש
          break;
          
        case 'calculate_phi_score':
          console.log(`[φ Handler] 🎯 Phi score calculation requested`);
          // TODO: implement phi score calculation
          break;
          
        case 'generate_chart':
          // הטיפול בגרף נעשה בנפרד ב-handleWithPhi
          console.log(`[φ Handler] 📊 Chart generation queued: ${action.data?.chart_description}`);
          break;
          
        default:
          console.log(`[φ Handler] ⚠️ Unknown action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`[φ Handler] ❌ Error executing action ${action.type}:`, error);
    }
  }
}

export default {
  handleWithPhi,
  handleDocumentWithPhi,
  shouldUsePhiOrchestrator,
  migrateToPhiContext,
  generateChartForUser,
};

