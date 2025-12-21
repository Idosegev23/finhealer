/**
 * φ Handler - Hybrid State Machine + AI
 * 
 * עקרון מפתח:
 * - Onboarding = קשיח (State Machine מחליט על הפעולה, AI רק מנסח)
 * - אחרי Onboarding = גמיש (AI מחליט הכל)
 */

import { thinkWithPhi, loadPhiContext, type PhiContext, type PhiAction, type PhiResponse } from './gpt52-client';
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
import {
  PhiStateManager,
  loadStateContext,
  saveStateContext,
  saveUserName,
  type ConversationPhase,
  type StateAction,
} from '@/lib/conversation/state-manager';

// Feature flag - האם להשתמש ב-AI Orchestrator
const USE_AI_ORCHESTRATOR = process.env.USE_AI_ORCHESTRATOR === 'true';

export interface PhiHandlerResult {
  message: string;
  actions: PhiAction[];
  shouldWaitForResponse: boolean;
  imageToSend?: GeneratedImage;
}

/**
 * טיפול בהודעת טקסט - Hybrid State Machine + AI
 * 
 * Flow:
 * 1. טען state context
 * 2. בדוק אם state קשיח (onboarding) או גמיש
 * 3. אם קשיח → State Machine מחליט, AI רק מנסח
 * 4. אם גמיש → AI מחליט הכל
 */
export async function handleWithPhi(
  userId: string,
  userMessage: string,
  phoneNumber: string
): Promise<PhiHandlerResult> {
  console.log('[φ Handler] 🧠 Processing message...');

  // 1. טען state context
  const stateCtx = await loadStateContext(userId);
  console.log(`[φ Handler] State: ${stateCtx.currentState}, User: ${stateCtx.userName || 'unknown'}`);
  
  // 2. צור State Manager
  const stateManager = new PhiStateManager(stateCtx);
  
  // 3. עבד את ההודעה לפי ה-state
  const transition = stateManager.processMessage(userMessage);
  console.log(`[φ Handler] Transition: ${stateCtx.currentState} → ${transition.newState}, Action: ${transition.action.type}`);
  
  // 4. בצע את הפעולה
  let finalMessage = '';
  let allActions: PhiAction[] = [];
  let imageToSend: GeneratedImage | undefined;
  
  switch (transition.action.type) {
    case 'send_message':
      // הודעה קבועה מה-State Machine
      finalMessage = transition.action.message;
      break;
      
    case 'save_name':
      // שמור שם ושלח הודעת הדרכה
      await saveUserName(userId, transition.action.name);
      finalMessage = getNameReceivedMessage(transition.action.name);
      allActions.push({ type: 'save_user_name', data: { name: transition.action.name } });
      break;
      
    case 'request_document':
      finalMessage = `📄 שלח לי דוח עו״ש מהבנק (PDF) של 3 חודשים אחרונים.\n\n💡 *טיפ:* אפשר להוריד מהאפליקציה או מאתר הבנק`;
      break;
      
    case 'start_classification':
      // התחל תהליך סיווג - הצג את התנועה הראשונה מיד!
      const classificationResult = await handleWithAI(
        userId, 
        userMessage, 
        `המשתמש ${stateCtx.userName || 'חבר'} רוצה להתחיל לסווג תנועות!
יש ${stateCtx.pendingTransactionCount} תנועות ממתינות.
הצג את התנועה הראשונה והצע קטגוריה לסיווג.
תציג תנועה אחת בכל פעם, בפורמט:
"*התנועה הראשונה:*
💳 AMOUNT ₪ ב-*VENDOR*
(DATE)

זה *CATEGORY*?"

אם יש תנועות דומות, אפשר להציע לסווג אותן ביחד.`
      );
      finalMessage = classificationResult.message || `מעולה! 🎯\n\nיש לי ${stateCtx.pendingTransactionCount} תנועות לסיווג.\nבוא נתחיל!`;
      allActions = classificationResult.actions;
      imageToSend = classificationResult.imageToSend;
      break;
      
    case 'ai_decide':
      // AI מחליט - השתמש בלוגיקה המקורית
      const result = await handleWithAI(userId, userMessage, transition.aiPrompt);
      finalMessage = result.message;
      allActions = result.actions;
      imageToSend = result.imageToSend;
      break;
      
    case 'none':
      // אין פעולה מיוחדת - AI מחליט
      const aiResult = await handleWithAI(userId, userMessage, stateManager.getAIPrompt());
      finalMessage = aiResult.message;
      allActions = aiResult.actions;
      imageToSend = aiResult.imageToSend;
      break;
  }
  
  // 5. שמור state חדש
  if (transition.newState !== stateCtx.currentState) {
    await saveStateContext(userId, transition.newState);
    console.log(`[φ Handler] State saved: ${transition.newState}`);
  }
  
  // 6. שמור הודעות ביומן
  await saveMessage(userId, 'incoming', userMessage);
  await saveMessage(userId, 'outgoing', finalMessage);
  
  console.log('[φ Handler] ✅ Done:', { message: finalMessage.substring(0, 50), actions: allActions.length });
  
  return {
    message: finalMessage,
    actions: allActions,
    shouldWaitForResponse: true,
    imageToSend,
  };
}

/**
 * הודעה אחרי קבלת שם - קבועה ומובנית
 */
function getNameReceivedMessage(name: string): string {
  return `נעים מאוד *${name}*! 😊

מעולה, אז בוא נתחיל.

*הצעד הראשון:*
שלח לי דוח עו״ש מהבנק שלך (PDF) של 3 חודשים אחרונים.

אני אנתח את התנועות ונתחיל לבנות את התמונה הפיננסית שלך 📊

💡 *טיפ:* אפשר להוריד את הדוח מהאפליקציה או מהאתר של הבנק`;
}

/**
 * טיפול עם AI - לשימוש כש-State Machine מחליט שAI צריך לענות
 */
async function handleWithAI(
  userId: string,
  userMessage: string,
  customPrompt?: string
): Promise<{ message: string; actions: PhiAction[]; imageToSend?: GeneratedImage }> {
  // טען context מלא
  let context = await loadPhiContext(userId);
  
  // הוסף prompt מיוחד אם יש
  let messageToSend = userMessage;
  if (customPrompt) {
    messageToSend = `[הנחיה: ${customPrompt}]\n\nהודעת המשתמש: ${userMessage}`;
  }
  
  // Agent Loop
  let finalMessage = '';
  let allActions: PhiAction[] = [];
  let imageToSend: GeneratedImage | undefined;
  let iterations = 0;
  const MAX_ITERATIONS = 3;
  
  while (!finalMessage && iterations < MAX_ITERATIONS) {
    iterations++;
    
    const response = await thinkWithPhi(
      iterations === 1 ? messageToSend : '[המשך - צריך הודעה למשתמש]',
      context
    );
    
    // אסוף פעולות
    if (response.actions.length > 0) {
      allActions.push(...response.actions);
      
      for (const action of response.actions) {
        console.log(`[φ Handler] Executing: ${action.type}`);
        await executeSingleAction(action, context);
        
        if (action.type === 'save_user_name' && action.data?.name) {
          context = { ...context, userName: action.data.name as string };
        }
      }
    }
    
    if (response.message) {
      finalMessage = response.message;
    }
    
    // בדוק גרף
    const chartAction = response.actions.find(a => a.type === 'generate_chart');
    if (chartAction && chartAction.data && !imageToSend) {
      try {
        imageToSend = await handleChartGeneration(
          chartAction.data.chartType as string || chartAction.data.chart_description as string,
          userId,
          chartAction.data.title as string | undefined,
          chartAction.data.description as string | undefined
        ) || undefined;
      } catch (error) {
        console.error('[φ Handler] Chart error:', error);
      }
    }
  }
  
  // Fallback
  if (!finalMessage) {
    finalMessage = context.userName 
      ? `היי ${context.userName}! איך אני יכול לעזור? 😊`
      : 'היי! מה שמך? 😊';
  }
  
  return { message: finalMessage, actions: allActions, imageToSend };
}

/**
 * ביצוע פעולה בודדת
 */
async function executeSingleAction(action: PhiAction, context: PhiContext): Promise<void> {
  const supabase = createServiceClient();
  
  switch (action.type) {
    case 'save_user_name':
      if (action.data?.name) {
        await supabase
          .from('users')
          .update({ 
            full_name: action.data.name,
            current_phase: 'document_upload',
          })
          .eq('id', context.userId);
        console.log(`[φ Handler] ✅ Saved name: ${action.data.name}`);
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
          source: 'manual',
          status: 'confirmed',
        });
      }
      break;
      
    case 'classify_transaction':
      if (action.data?.transaction_id && action.data?.category) {
        await supabase
          .from('transactions')
          .update({
            category: action.data.category,
            status: action.data.is_confirmed ? 'confirmed' : 'proposed',
          })
          .eq('id', action.data.transaction_id);
      }
      break;
      
    case 'bulk_classify':
      if (action.data?.transaction_ids && action.data?.category) {
        await supabase
          .from('transactions')
          .update({ category: action.data.category, status: 'confirmed' })
          .in('id', action.data.transaction_ids as string[]);
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
        }, { onConflict: 'user_id,vendor' });
      }
      break;
      
    case 'set_budget':
      if (action.data?.category && action.data?.amount) {
        await supabase.from('budget_categories').upsert({
          user_id: context.userId,
          name: action.data.category,
          monthly_limit: action.data.amount,
        }, { onConflict: 'user_id,name' });
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
      }
      break;
      
    case 'move_to_phase':
      if (action.data?.phase) {
        await supabase
          .from('users')
          .update({ current_phase: action.data.phase })
          .eq('id', context.userId);
      }
      break;
      
    case 'request_document':
    case 'get_financial_summary':
    case 'calculate_phi_score':
    case 'generate_chart':
      // פעולות אלה מטופלות בנפרד או רק לוגים
      console.log(`[φ Handler] Action noted: ${action.type}`);
      break;
      
    default:
      console.log(`[φ Handler] Unknown action: ${action.type}`);
  }
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
 * 
 * wa_messages משתמש ב-payload (JSONB) לשמירת תוכן ההודעה
 */
async function saveMessage(
  userId: string,
  direction: 'incoming' | 'outgoing',
  content: string
): Promise<void> {
  const supabase = createServiceClient();
  
  try {
    const { error } = await supabase
      .from('wa_messages')
      .insert({
        user_id: userId,
        direction,
        // payload הוא JSONB - שמור את התוכן בתוכו
        payload: { text: content },
        message_type: 'text',
        status: 'delivered',
      });
      
    if (error) {
      console.error('[φ Handler] Error saving message:', error);
    } else {
      console.log(`[φ Handler] ✅ Message saved: ${direction} - ${content.substring(0, 50)}...`);
    }
  } catch (error) {
    console.error('[φ Handler] Exception saving message:', error);
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

export default {
  handleWithPhi,
  handleDocumentWithPhi,
  shouldUsePhiOrchestrator,
  migrateToPhiContext,
  generateChartForUser,
};

