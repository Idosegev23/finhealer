/**
 * φ Handler - AI-First with Full Context
 * 
 * גישה חדשה: ה-AI מקבל את כל ה-context בכל קריאה ומחליט הכל.
 * אין State Machine נפרד - ה-AI מבין את המצב מתוך ההיסטוריה.
 */

import OpenAI from 'openai';
import { createServiceClient } from '@/lib/supabase/server';
import { loadFullContext, getCurrentState, formatCurrency, type PhiFullContext } from './phi-context-loader';
import { buildPrompt, parseAIResponse, type PhiAIResponse } from './phi-prompt-builder';
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

// ============================================================================
// Types
// ============================================================================

export interface PhiHandlerResult {
  message: string;
  actions: PhiAction[];
  shouldWaitForResponse: boolean;
  imageToSend?: GeneratedImage;
}

export interface PhiAction {
  type: string;
  data?: Record<string, unknown>;
  id?: string;
  category?: string;
  vendor?: string;
  reason?: string;
}

// ============================================================================
// OpenAI Client - Using GPT-5.2 with Responses API
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GPT-5.2 הוא המודל החדש ביותר עם Responses API
const MODEL = 'gpt-5.2';
const FALLBACK_MODEL = 'gpt-4o';

// ============================================================================
// Main Handler - AI-First Approach
// ============================================================================

/**
 * טיפול בהודעת טקסט - AI-First with Full Context
 * 
 * Flow:
 * 1. טען context מלא מה-DB (היסטוריה, תנועות, state)
 * 2. בנה prompt עשיר עם כל המידע
 * 3. שלח ל-GPT עם JSON mode
 * 4. פרש ובצע את הפעולות
 * 5. שמור הכל ל-DB
 */
export async function handleWithPhi(
  userId: string,
  userMessage: string,
  phoneNumber: string
): Promise<PhiHandlerResult> {
  console.log('[φ Handler] 🧠 AI-First: Processing message...');
  
  try {
    // 1. טען context מלא
    const context = await loadFullContext(userId);
    const currentState = getCurrentState(context);
    console.log(`[φ Handler] State: ${currentState}, User: ${context.user.name || 'unknown'}, Pending: ${context.pendingTransactions.length}`);
    
    // 2. בנה prompt
    const { systemPrompt, userMessage: fullUserMessage } = buildPrompt(context, userMessage);
    
    // 3. קרא ל-AI עם JSON mode
    console.log('[φ Handler] Calling GPT-4o with full context...');
    const response = await callAI(systemPrompt, fullUserMessage);
    
    // 4. פרש את התשובה
    const parsed = parseAIResponse(response);
    console.log(`[φ Handler] AI Response: ${parsed.message.substring(0, 50)}... | Actions: ${parsed.actions.length}`);
    
    // 5. בצע את הפעולות
    const executedActions = await executeActions(userId, parsed.actions, context);
    
    // 6. עדכן state אם צריך
    if (parsed.new_state) {
      await updateUserState(userId, parsed.new_state);
      console.log(`[φ Handler] State updated to: ${parsed.new_state}`);
    }
    
    // 7. טפל בגרפים אם יש
    // Note: Messages are saved by the webhook, not here (avoid duplication)
    let imageToSend: GeneratedImage | undefined;
    const chartAction = parsed.actions.find(a => a.type === 'generate_chart');
    if (chartAction) {
      try {
        imageToSend = await handleChartGeneration(
          chartAction.data?.chartType as string || 'pie',
          userId
        ) || undefined;
      } catch (error) {
        console.error('[φ Handler] Chart error:', error);
      }
    }
    
    console.log('[φ Handler] ✅ Done');
    
    return {
      message: parsed.message,
      actions: executedActions,
      shouldWaitForResponse: true,
      imageToSend,
    };
    
  } catch (error) {
    console.error('[φ Handler] ❌ Error:', error);
    
    // Emergency fallback - still try to respond
    const fallbackMessage = await getEmergencyFallback(userId, userMessage);
    
    return {
      message: fallbackMessage,
      actions: [],
      shouldWaitForResponse: true,
    };
  }
}

// ============================================================================
// AI Call - GPT-5.2 Responses API with fallback to GPT-4o
// ============================================================================

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  try {
    // נסה GPT-5.2 עם Responses API
    console.log('[φ Handler] Calling GPT-5.2 with Responses API...');
    
    const response = await openai.responses.create({
      model: MODEL,
      instructions: systemPrompt,
      input: userMessage,
      text: {
        format: {
          type: 'json_object',
        },
      },
    });
    
    console.log('[φ Handler] GPT-5.2 response received');
    
    // חילוץ התוכן מהתגובה
    const content = response.output_text || '';
    return content;
    
  } catch (error) {
    console.warn('[φ Handler] GPT-5.2 failed, falling back to GPT-4o:', (error as Error).message);
    
    // Fallback ל-GPT-4o עם Chat Completions API
    const completion = await openai.chat.completions.create({
      model: FALLBACK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1000,
    });
    
    console.log('[φ Handler] GPT-4o fallback response received');
    return completion.choices[0]?.message?.content || '{}';
  }
}

// ============================================================================
// Action Execution
// ============================================================================

async function executeActions(
  userId: string,
  actions: PhiAIResponse['actions'],
  context: PhiFullContext
): Promise<PhiAction[]> {
  const supabase = createServiceClient();
  const executed: PhiAction[] = [];
  
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'classify_transaction':
          if (action.id && action.category) {
            await supabase
              .from('transactions')
              .update({
                category: action.category,
                expense_category: action.category,
                status: 'confirmed',
              })
              .eq('id', action.id)
              .eq('user_id', userId);
            
            console.log(`[φ Handler] ✅ Classified: ${action.id} → ${action.category}`);
            executed.push({ type: action.type, id: action.id, category: action.category });
          }
          break;
          
        case 'save_pattern':
          if (action.vendor && action.category) {
            await supabase
              .from('user_patterns')
              .upsert({
                user_id: userId,
                vendor: action.vendor.toLowerCase(),
                category: action.category,
                confidence: 1.0,
                usage_count: 1,
              }, { onConflict: 'user_id,vendor' });
            
            console.log(`[φ Handler] ✅ Pattern saved: ${action.vendor} → ${action.category}`);
            executed.push({ type: action.type, vendor: action.vendor, category: action.category });
          }
          break;
          
        case 'skip_transaction':
          if (action.id) {
            // Mark as skipped by setting a special status or just move on
            console.log(`[φ Handler] ⏭️ Skipped: ${action.id} (${action.reason || 'user request'})`);
            executed.push({ type: action.type, id: action.id, reason: action.reason });
          }
          break;
          
        case 'request_document':
          console.log(`[φ Handler] 📄 Document requested: ${action.doc_type || 'any'}`);
          executed.push({ type: action.type, data: { doc_type: action.doc_type } });
          break;
          
        case 'update_state':
          if (action.state) {
            await updateUserState(userId, action.state);
            executed.push({ type: action.type, data: { state: action.state } });
          }
          break;
          
        case 'save_user_name':
          if (action.data?.name) {
            await supabase
              .from('users')
              .update({
                name: action.data.name,
                full_name: action.data.name,
                onboarding_state: 'waiting_for_document',
              })
              .eq('id', userId);
            
            console.log(`[φ Handler] ✅ Name saved: ${action.data.name}`);
            executed.push({ type: action.type, data: action.data });
          }
          break;
          
        default:
          console.log(`[φ Handler] Unknown action: ${action.type}`);
      }
    } catch (error) {
      console.error(`[φ Handler] Action error (${action.type}):`, error);
    }
  }
  
  return executed;
}

// ============================================================================
// State Management
// ============================================================================

async function updateUserState(userId: string, newState: string): Promise<void> {
  const supabase = createServiceClient();
  
  await supabase
    .from('users')
    .update({
      onboarding_state: newState,
      current_phase: newState,
    })
    .eq('id', userId);
}

// ============================================================================
// Message Saving
// ============================================================================

async function saveMessages(
  userId: string,
  userMessage: string,
  botResponse: string
): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  
  try {
    // Save user message
    await supabase.from('wa_messages').insert({
      user_id: userId,
      direction: 'incoming',
      payload: { text: userMessage },
      msg_type: 'text',
      status: 'delivered',
      created_at: now,
    });
    
    // Save bot response
    await supabase.from('wa_messages').insert({
      user_id: userId,
      direction: 'outgoing',
      payload: { text: botResponse },
      msg_type: 'text',
      status: 'delivered',
      created_at: now,
    });
  } catch (error) {
    console.error('[φ Handler] Message save error:', error);
  }
}

// ============================================================================
// Emergency Fallback
// ============================================================================

async function getEmergencyFallback(userId: string, userMessage: string): Promise<string> {
  try {
    // Try to load minimal context
    const supabase = createServiceClient();
    
    const { data: user } = await supabase
      .from('users')
      .select('name, full_name, onboarding_state')
      .eq('id', userId)
      .single();
    
    const userName = user?.full_name || user?.name;
    const state = user?.onboarding_state;
    
    // Check for pending transactions
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'proposed');
    
    if (state === 'classification' && (count || 0) > 0) {
      return `קיבלתי! 👍\n\nבוא נמשיך - יש עוד ${count} תנועות לסווג.\nמה הקטגוריה של התנועה האחרונה?`;
    }
    
    if (!userName) {
      return 'היי! 👋 מה שמך?';
    }
    
    return `קיבלתי, ${userName}! 😊\n\nמה תרצה לעשות?\n• שלח דוח בנק\n• כתוב "סיכום" לסטטוס`;
    
  } catch {
    return 'סליחה, משהו השתבש 😅 נסה שוב בבקשה!';
  }
}

// ============================================================================
// Document Handler (preserved from original)
// ============================================================================

export async function handleDocumentWithPhi(
  userId: string,
  documentUrl: string,
  documentType: 'pdf' | 'image',
  phoneNumber: string
): Promise<PhiHandlerResult> {
  console.log('[φ Handler] Processing document...');
  
  return {
    message: 'קיבלתי את המסמך! 📄 מנתח עכשיו... ⏳',
    actions: [],
    shouldWaitForResponse: false,
  };
}

// ============================================================================
// Chart Generation (preserved from original)
// ============================================================================

async function handleChartGeneration(
  chartType: string,
  userId: string,
  title?: string,
  description?: string
): Promise<GeneratedImage | null> {
  const supabase = createServiceClient();
  
  console.log(`[φ Handler] Generating chart: ${chartType}`);
  
  const userData = await loadUserFinancialData(userId, supabase);
  
  if (!userData) {
    console.log('[φ Handler] No financial data for chart');
    return null;
  }
  
  const prompt = buildDynamicChartPrompt(chartType, userData, title, description);
  
  return await generateChartWithGemini(prompt, `${chartType}_chart.png`);
}

async function loadUserFinancialData(
  userId: string,
  supabase: ReturnType<typeof createServiceClient>
) {
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
  
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);
    
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);
    
  const categoryTotals: Record<string, number> = {};
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const cat = t.category || 'אחר';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
    });
    
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

function buildDynamicChartPrompt(
  chartType: string,
  data: NonNullable<Awaited<ReturnType<typeof loadUserFinancialData>>>,
  title?: string,
  description?: string
): string {
  const formatMoney = (n: number) => n.toLocaleString('he-IL');
  
  const categoriesText = Object.entries(data.categoryTotals)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([cat, amount]) => `- ${cat}: ${formatMoney(amount)} ₪`)
    .join('\n');
    
  const monthlyText = Object.entries(data.monthlyData)
    .map(([month, d]) => `- ${month}: הכנסות ${formatMoney(d.income)} ₪, הוצאות ${formatMoney(d.expenses)} ₪`)
    .join('\n');
  
  return `צור אינפוגרפיקה/גרף בעברית עבור משתמש ישראלי.

🎨 *סגנון עיצוב:*
- מינימליסטי ומודרני
- צבעי מותג φ (Phi): זהב #A96B48, כהה #2E3440, רקע בהיר #ECEFF4
- כלול את סמל φ בפינה
- טקסט בעברית, RTL
- ברור וקריא

📊 *סוג הגרף:* ${chartType}
${title ? `📌 *כותרת:* ${title}` : ''}
${description ? `📝 *תיאור:* ${description}` : ''}

💰 *הנתונים:*
- סה"כ הכנסות: ${formatMoney(data.totalIncome)} ₪
- סה"כ הוצאות: ${formatMoney(data.totalExpenses)} ₪
- יתרה: ${formatMoney(data.balance)} ₪

📈 *התפלגות הוצאות:*
${categoriesText}

📅 *נתונים חודשיים:*
${monthlyText}

צור תמונה ויזואלית יפה שמציגה את הנתונים בצורה ברורה ומעוצבת.`;
}

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
    console.error('[φ Handler] Gemini error:', error);
    return null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export async function generateChartForUser(
  userId: string,
  chartType: ChartType
): Promise<GeneratedImage | null> {
  return handleChartGeneration(chartType, userId);
}

export function shouldUsePhiOrchestrator(): boolean {
  return true; // Always use AI-First now
}

export default {
  handleWithPhi,
  handleDocumentWithPhi,
  shouldUsePhiOrchestrator,
  generateChartForUser,
};
