// @ts-nocheck

/**
 * Monitoring State Handler
 *
 * Covers states: 'monitoring', 'loan_consolidation_offer', 'waiting_for_loan_docs'
 *
 * This is the largest handler - the ongoing monitoring phase where users
 * interact with their financial data, ask questions, view summaries, manage
 * goals and budget, see charts, and get AI-powered financial coaching.
 */

import type { RouterContext, RouterResult } from '../shared';
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient, sendWhatsAppInteractiveButtons, sendWhatsAppImage } from '@/lib/greenapi/client';
import { findBestMatch } from '@/lib/finance/categories';
import { chatWithGeminiFlash } from '@/lib/ai/gemini-client';
import { generatePieChart } from '@/lib/ai/gemini-image-client';
import type { CategoryData } from '@/lib/ai/chart-prompts';
import { loadConversationHistory } from '../history-loader';
import { getUserPeriodCoverage } from '@/lib/documents/period-tracker';
import { projectCashFlow } from '@/lib/finance/cash-flow-projector';
import { parseMonitoringIntent, type MonitoringIntent, type MonitoringIntentType } from '@/lib/ai/monitoring-intent';
import { parseStateIntent } from '@/lib/ai/state-intent';
import { buildUserSnapshot } from '@/lib/ai/user-snapshot';

// ============================================================================
// Main Monitoring Handler
// ============================================================================

/**
 * handleMonitoring - Main dispatcher for the 'monitoring' state.
 *
 * @param ctx            - Router context (userId, phone, state, userName)
 * @param msg            - Raw user message
 * @param userName       - Display name for the user (may be null)
 * @param startClassification - Callback to kick off the classification flow
 */
export async function handleMonitoring(
  ctx: RouterContext,
  msg: string,
  userName: string | null,
  startClassification: (ctx: RouterContext) => Promise<RouterResult>
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const userId = ctx.userId;
  const phone = ctx.phone;

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 0: Structural checks (no AI, no latency)
  // Handles system-generated inputs: loan context, button/list IDs, regex patterns
  // ══════════════════════════════════════════════════════════════════════════

  // 0a. Loan consolidation context – pending decision
  const { data: userData } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const loanContext = userData?.classification_context?.loanConsolidation;

  if (loanContext?.pending) {
    const { handleConsolidationResponse } = await import('@/lib/loans/consolidation-handler');
    let loanIntent = { intent: 'unknown', confidence: 0, params: {} };
    try {
      loanIntent = await parseStateIntent(msg, 'loan_decision');
    } catch (intentErr) {
      console.warn(`[Monitoring] parseStateIntent (loan_decision) failed:`, intentErr);
    }
    console.log(`[Monitoring] LOAN_INTENT: intent="${loanIntent.intent}", confidence=${loanIntent.confidence}`);

    if (loanIntent.intent === 'yes' && loanIntent.confidence >= 0.6) {
      const response = await handleConsolidationResponse(userId, phone, 'yes');
      await greenAPI.sendMessage({ phoneNumber: phone, message: response });
      return { success: true };
    }

    if ((loanIntent.intent === 'no' || loanIntent.intent === 'skip') && loanIntent.confidence >= 0.6) {
      const response = await handleConsolidationResponse(userId, phone, 'no');
      await greenAPI.sendMessage({ phoneNumber: phone, message: response });
      return { success: true };
    }
  }

  // 0b. Button/list IDs from WhatsApp UI (exact matches for system-generated rowIds)
  const listRowActions: Record<string, () => Promise<RouterResult>> = {
    'summary': () => showMonitoringSummary(ctx),
    'expense_chart': () => generateAndSendExpenseChart(ctx),
    'income_chart': () => generateAndSendIncomeChart(ctx),
    'cash_flow': () => showCashFlowProjection(ctx),
    'phi_score': () => showPhiScore(ctx),
    'budget_status': () => showBudgetStatus(ctx),
    'to_goals': async () => {
      const { transitionToGoals } = await import('./behavior');
      return await transitionToGoals(ctx);
    },
    'unclassified': () => showUnclassifiedTransactions(ctx),
    'add_doc': async () => {
      await greenAPI.sendMessage({ phoneNumber: phone, message: `📄 מעולה! שלח לי את המסמך.` });
      return { success: true };
    },
    'advisor': () => showAdvisorCTA(ctx),
    'available_months': () => showAvailableMonths(ctx),
    'duplicates': () => showDuplicateSuspects(ctx),
    'credit_pending': () => showNeedsCreditDetail(ctx),
  };

  // 0c. Legacy button/command IDs (merged into listRowActions)
  const addDocHandler = async () => {
    await greenAPI.sendMessage({ phoneNumber: phone, message: `📄 מעולה! שלח לי את המסמך.` });
    return { success: true } as RouterResult;
  };
  const classifyHandler = () => startClassification(ctx);

  const legacyActions: Record<string, () => Promise<RouterResult>> = {
    'add_bank': addDocHandler,
    'add_credit': addDocHandler,
    'add_more': addDocHandler,
    'add_docs': addDocHandler,
    'start_classify': classifyHandler,
    'נתחיל לסווג': classifyHandler,
    '▶️ נתחיל לסווג': classifyHandler,
    'נתחיל לסווג ▶️': classifyHandler,
    '▶️ נמשיך לסווג': classifyHandler,
    'נמשיך לסווג ▶️': classifyHandler,
  };

  const allActions = { ...listRowActions, ...legacyActions };
  const msgTrimmed = msg.trim();
  if (allActions[msgTrimmed]) {
    console.log(`[Monitoring] BUTTON_ID: "${msgTrimmed}" → direct handler`);
    return await allActions[msgTrimmed]();
  }

  // 0d. Regex patterns with parameters (can't be handled by AI)
  const monthReportMatch = msg.match(/^דוח\s+(\d{1,2})[\/\-](\d{4})$/);
  const monthReportMatch2 = msg.match(/^דוח\s+(\d{4})[\/\-](\d{1,2})$/);
  if (monthReportMatch) {
    const month = monthReportMatch[1].padStart(2, '0');
    const year = monthReportMatch[2];
    return await showMonitoringSummary(ctx, `${year}-${month}`);
  }
  if (monthReportMatch2) {
    const year = monthReportMatch2[1];
    const month = monthReportMatch2[2].padStart(2, '0');
    return await showMonitoringSummary(ctx, `${year}-${month}`);
  }

  const cancelCreditMatch = msg.match(/^בטל אשראי\s+(\d+)$/);
  if (cancelCreditMatch) {
    const idx = parseInt(cancelCreditMatch[1]) - 1;
    const { data: pendingTx } = await supabase
      .from('transactions')
      .select('id, vendor, amount')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .ilike('notes', '%ממתין לדוח פירוט%')
      .order('tx_date', { ascending: false });

    if (pendingTx && pendingTx[idx]) {
      await supabase
        .from('transactions')
        .update({ notes: 'סומן ידנית - ללא פירוט אשראי' })
        .eq('id', pendingTx[idx].id);
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `✅ התנועה "${pendingTx[idx].vendor}" (₪${Math.abs(pendingTx[idx].amount).toLocaleString('he-IL')}) סומנה כמאושרת.`,
      });
    } else {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `❌ מספר לא תקין. כתוב *"אשראי"* לראות את הרשימה.`,
      });
    }
    return { success: true };
  }

  const confirmDupMatch = msg.match(/^אשר כפל\s+(\d+)$/);
  if (confirmDupMatch) {
    const idx = parseInt(confirmDupMatch[1]) - 1;
    const { data: dupTx } = await supabase
      .from('transactions')
      .select('id, vendor, amount')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .ilike('notes', '%חשד לכפל%')
      .order('tx_date', { ascending: false });

    if (dupTx && dupTx[idx]) {
      await supabase.from('transactions').delete().eq('id', dupTx[idx].id);
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `🗑️ הכפילות "${dupTx[idx].vendor}" (₪${Math.abs(dupTx[idx].amount).toLocaleString('he-IL')}) נמחקה.`,
      });
    } else {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `❌ מספר לא תקין. כתוב *"כפל תשלום"* לראות את הרשימה.`,
      });
    }
    return { success: true };
  }

  const denyDupMatch = msg.match(/^לא כפל\s+(\d+)$/);
  if (denyDupMatch) {
    const idx = parseInt(denyDupMatch[1]) - 1;
    const { data: dupTx } = await supabase
      .from('transactions')
      .select('id, vendor, amount')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .ilike('notes', '%חשד לכפל%')
      .order('tx_date', { ascending: false });

    if (dupTx && dupTx[idx]) {
      await supabase
        .from('transactions')
        .update({ notes: 'אושר כתנועה נפרדת' })
        .eq('id', dupTx[idx].id);
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `✅ התנועה "${dupTx[idx].vendor}" אושרה כתנועה נפרדת וממתינה לסיווג.`,
      });
    } else {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `❌ מספר לא תקין. כתוב *"כפל תשלום"* לראות את הרשימה.`,
      });
    }
    return { success: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 1: Rule-based intent from router (free, instant)
  // ══════════════════════════════════════════════════════════════════════════
  let resolvedIntent: MonitoringIntent | null = null;

  if (ctx.intent && ctx.intent.confidence > 0.8) {
    resolvedIntent = mapRouterIntentToMonitoring(ctx.intent);
    if (resolvedIntent) {
      console.log(`[Monitoring] RULE_INTENT: ${ctx.intent.type} → ${resolvedIntent.intent} (${resolvedIntent.confidence})`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 2: AI Intent Detection (Gemini Flash - THE MAIN BRAIN)
  // Only fires if rule-based didn't resolve or had low confidence
  // ══════════════════════════════════════════════════════════════════════════
  if (!resolvedIntent || resolvedIntent.confidence < 0.7) {
    const aiIntent = await parseMonitoringIntent(msg);
    console.log(`[Monitoring] AI_INTENT: ${aiIntent.intent} (${aiIntent.confidence}) params=${JSON.stringify(aiIntent.params || {})}`);

    if (!resolvedIntent || aiIntent.confidence > resolvedIntent.confidence) {
      resolvedIntent = aiIntent;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DISPATCH: Map resolved intent to handler
  // ══════════════════════════════════════════════════════════════════════════
  if (resolvedIntent && resolvedIntent.confidence >= 0.6) {
    const result = await dispatchMonitoringIntent(
      resolvedIntent, ctx, msg, userName, startClassification
    );
    if (result) return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 3: AI Chat Fallback (Gemini Flash with FULL financial context)
  // The AI gets the complete user snapshot — knows everything about the user
  // ══════════════════════════════════════════════════════════════════════════
  try {
    const [history, snapshot] = await Promise.all([
      loadConversationHistory(userId, 10),
      buildUserSnapshot(userId),
    ]);

    const phiSystemPrompt =
      `אתה φ (פי) - עוזר פיננסי אישי חם ומקצועי בוואטסאפ. ענה בעברית, בקצרה ובחום.\n\n` +
      `יש לך גישה לנתונים הפיננסיים המלאים של המשתמש (למטה).\n` +
      `ענה על סמך הנתונים האמיתיים - אל תמציא מספרים.\n` +
      `אם המשתמש רוצה פעולה - תציע לו ישירות (למשל "רוצה שאראה לך סיכום?").\n` +
      `אם יש פעולות ממתינות - הזכר אותן בעדינות.\n` +
      `תשובה קצרה - עד 4 משפטים. חם ואישי.`;

    const aiResponse = await chatWithGeminiFlash(
      msg,
      phiSystemPrompt,
      snapshot.contextText,
      history
    );

    if (aiResponse) {
      await greenAPI.sendMessage({ phoneNumber: phone, message: aiResponse });
      return { success: true };
    }
  } catch (aiError) {
    console.error('[Monitoring] Gemini Flash fallback error:', aiError);
  }

  // Final fallback
  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `לא הבנתי 🤔\n\nכתוב *"עזרה"* לראות תפריט, או שאל אותי בחופשיות!`,
  });

  return { success: true };
}

// ============================================================================
// Intent Mapping & Dispatch Helpers
// ============================================================================

/**
 * Maps the router's rule-based IntentType to MonitoringIntentType
 */
function mapRouterIntentToMonitoring(
  intent: { type: string; confidence: number }
): MonitoringIntent | null {
  const map: Record<string, MonitoringIntentType> = {
    'summary_request': 'summary',
    'chart_request': 'expense_chart',
    'budget_request': 'budget_status',
    'goal_request': 'goals',
    'loan_consolidation': 'loans',
    'continue': 'continue',
    'upload_document': 'add_document',
    'question_spending': 'category_question',
  };

  const mapped = map[intent.type];
  if (mapped) {
    return { intent: mapped, confidence: intent.confidence };
  }
  return null;
}

/**
 * Dispatches a resolved MonitoringIntent to the appropriate handler function.
 * Returns null if the intent should fall through to AI chat.
 */
async function dispatchMonitoringIntent(
  intent: MonitoringIntent,
  ctx: RouterContext,
  msg: string,
  userName: string | null,
  startClassification: (ctx: RouterContext) => Promise<RouterResult>
): Promise<RouterResult | null> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  console.log(`[Monitoring] DISPATCH: intent=${intent.intent}, confidence=${intent.confidence}`);

  switch (intent.intent) {
    case 'summary':
      return await showMonitoringSummary(ctx);

    case 'summary_month':
      return await showMonitoringSummary(ctx, intent.params?.month);

    case 'available_months':
      return await showAvailableMonths(ctx);

    case 'expense_chart':
      return await generateAndSendExpenseChart(ctx);

    case 'income_chart':
      return await generateAndSendIncomeChart(ctx);

    case 'budget_status':
      return await showBudgetStatus(ctx);

    case 'cash_flow':
      return await showCashFlowProjection(ctx);

    case 'phi_score':
      return await showPhiScore(ctx);

    case 'advisor':
      return await showAdvisorCTA(ctx);

    case 'goals': {
      const { transitionToGoals } = await import('./behavior');
      return await transitionToGoals(ctx);
    }

    case 'goal_deposit':
      return await handleGoalDeposit(ctx, msg);

    case 'add_expense':
      return await handleAddExpense(ctx, intent);

    case 'undo_expense':
      return await handleUndoExpense(ctx);

    case 'unclassified':
      return await showUnclassifiedTransactions(ctx);

    case 'credit_pending':
      return await showNeedsCreditDetail(ctx);

    case 'duplicates':
      return await showDuplicateSuspects(ctx);

    case 'loans': {
      const { data: activeRequest } = await supabase
        .from('loan_consolidation_requests')
        .select('id, documents_received, documents_needed')
        .eq('user_id', ctx.userId)
        .eq('status', 'pending_documents')
        .single();

      if (activeRequest) {
        await greenAPI.sendMessage({
          phoneNumber: ctx.phone,
          message:
            `💡 יש לך בקשת איחוד פעילה - ממתין למסמכי ההלוואות שלך ` +
            `(${activeRequest.documents_received || 0}/${activeRequest.documents_needed}).\n\n` +
            `שלח לי את המסמכים כדי שאוכל להעביר לגדי את הבקשה! 📄`,
        });
        return { success: true };
      }
      // No active request - fall through to AI chat
      return null;
    }

    case 'add_document':
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `📄 מעולה! שלח לי את המסמך (PDF או תמונה).`,
      });
      return { success: true };

    case 'start_classify':
      return await startClassification(ctx);

    case 'continue': {
      const { getClassifiableTransactions } = await import('../classification-flow');
      const pendingIncome = await getClassifiableTransactions(ctx.userId, 'income');
      const pendingExpense = await getClassifiableTransactions(ctx.userId, 'expense');

      if (pendingIncome.length > 0 || pendingExpense.length > 0) {
        return await startClassification(ctx);
      }

      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `✅ כל התנועות מסווגות!\n\nמה תרצה לעשות? כתוב *"עזרה"* לראות תפריט 😊`,
      });
      return { success: true };
    }

    case 'analyze': {
      // Use calculated phase (don't hardcode)
      const { calculatePhase: calcPhaseAnalyze } = await import('@/lib/services/PhaseService');
      const analyzePhase = await calcPhaseAnalyze(ctx.userId);

      await supabase
        .from('users')
        .update({ onboarding_state: 'behavior', phase: analyzePhase })
        .eq('id', ctx.userId);

      const { handleBehaviorPhase } = await import('./behavior');
      return await handleBehaviorPhase({ ...ctx, state: 'behavior' }, msg);
    }

    case 'category_question': {
      // Try AI-extracted category first, then findBestMatch fallback
      const category = intent.params?.category;
      if (category) {
        // Try exact match first
        const match = findBestMatch(category);
        if (match) {
          return await answerCategoryQuestion(ctx, match.name);
        }
        // Use the AI-extracted category name directly
        return await answerCategoryQuestion(ctx, category);
      }
      // Try findBestMatch on the original message
      const msgMatch = findBestMatch(msg);
      if (msgMatch) {
        return await answerCategoryQuestion(ctx, msgMatch.name);
      }
      return null; // Fall to AI chat
    }

    case 'general_question':
    case 'unknown':
    default:
      return null; // Fall through to AI chat (Layer 3)
  }
}

// ============================================================================
// Quick Expense from WhatsApp
// ============================================================================

/**
 * handleAddExpense - Creates a confirmed expense from free-text WhatsApp message.
 * User says "הוצאתי 150 בסופר" → creates transaction + confirms via WhatsApp.
 */
async function handleAddExpense(
  ctx: RouterContext,
  intent: MonitoringIntent
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const amount = intent.params?.amount;

  if (!amount || amount <= 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `לא הצלחתי לזהות סכום 🤔\nנסה שוב, למשל: *"סופר 450"* או *"קפה 15"*`,
    });
    return { success: true };
  }

  // Try to match category from AI-extracted category or vendor
  const categoryName = intent.params?.category || null;
  const vendorName = intent.params?.vendor || null;

  let expenseCategory = 'כללי';
  let expenseType: 'fixed' | 'variable' | 'special' = 'variable';
  let categoryGroup: string | null = null;

  // Try vendor as category hint if no explicit category
  const categoryHint = categoryName || vendorName;
  if (categoryHint) {
    const match = findBestMatch(categoryHint);
    if (match) {
      expenseCategory = match.name;
      expenseType = (match as any).expense_type || 'variable';
      categoryGroup = (match as any).category_group || null;
    } else if (categoryName) {
      expenseCategory = categoryName;
    }
  }

  // Create the transaction
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase
    .from('transactions')
    .insert({
      user_id: ctx.userId,
      type: 'expense',
      amount: amount,
      category: expenseCategory,
      expense_category: expenseCategory,
      expense_type: expenseType,
      category_group: categoryGroup,
      vendor: vendorName,
      tx_date: today,
      source: 'whatsapp',
      status: 'confirmed',
      auto_categorized: !!categoryHint,
    });

  if (error) {
    console.error('[Monitoring] add_expense error:', error);
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ שגיאה בשמירת ההוצאה. נסה שוב.`,
    });
    return { success: true };
  }

  // Sync budget spending after adding expense
  const { syncBudgetSpending } = await import('@/lib/services/BudgetSyncService');
  syncBudgetSpending(ctx.userId).catch(err => console.error('[BudgetSync] whatsapp-expense error:', err));

  // Fetch weekly spending context for immediate feedback
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const { data: weekTxs } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', ctx.userId)
    .eq('type', 'expense')
    .eq('status', 'confirmed')
    .or('is_summary.is.null,is_summary.eq.false')
    .gte('tx_date', weekStartStr);

  const weekTotal = (weekTxs || []).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount) || 0), 0);

  // Build confirmation with context
  const amountStr = amount.toLocaleString('he-IL');
  let msg_out = `✅ *${amountStr} ₪*`;
  if (vendorName) msg_out += ` ב${vendorName}`;
  msg_out += ` (${expenseCategory}) נרשם!`;
  msg_out += `\n📊 השבוע: ${weekTotal.toLocaleString('he-IL')} ₪`;

  // Check budget if available
  const { data: activeBudget } = await supabase
    .from('budgets')
    .select('total_budget')
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .single();

  if (activeBudget?.total_budget) {
    // Monthly budget → approximate weekly = monthly / 4.3
    const weeklyBudget = Math.round(activeBudget.total_budget / 4.3);
    const remaining = weeklyBudget - weekTotal;
    if (remaining > 0) {
      msg_out += ` מתוך ~${weeklyBudget.toLocaleString('he-IL')} ₪`;
    } else {
      msg_out += `\n⚠️ חרגת מהתקציב השבועי!`;
    }
  }

  msg_out += `\n\n_טעות? כתוב *"בטל"*_`;

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: msg_out,
  });

  return { success: true };
}

// ============================================================================
// Undo Last WhatsApp Expense
// ============================================================================

async function handleUndoExpense(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Find the last WhatsApp-added expense (within last 24 hours)
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const { data: lastExpense } = await supabase
    .from('transactions')
    .select('id, amount, vendor, expense_category, tx_date, created_at')
    .eq('user_id', ctx.userId)
    .eq('source', 'whatsapp')
    .eq('type', 'expense')
    .eq('status', 'confirmed')
    .gte('created_at', oneDayAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!lastExpense) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `לא מצאתי הוצאה שנרשמה ב-24 השעות האחרונות מוואטסאפ 🤔`,
    });
    return { success: true };
  }

  // Delete it
  await supabase
    .from('transactions')
    .delete()
    .eq('id', lastExpense.id)
    .eq('user_id', ctx.userId);

  // Sync budget
  const { syncBudgetSpending } = await import('@/lib/services/BudgetSyncService');
  syncBudgetSpending(ctx.userId).catch(err => console.error('[BudgetSync] undo error:', err));

  const amountStr = Math.abs(Number(lastExpense.amount)).toLocaleString('he-IL');
  const vendor = lastExpense.vendor || lastExpense.expense_category || '';

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `🗑️ בוטל: *${amountStr} ₪*${vendor ? ` ב${vendor}` : ''}\n\nההוצאה נמחקה והתקציב עודכן.`,
  });

  return { success: true };
}

// ============================================================================
// Loan Consolidation Offer Handler
// ============================================================================

/**
 * handleLoanConsolidationOffer - Handles the 'loan_consolidation_offer' state.
 * Processes the user's yes/no/unclear response to a loan consolidation offer.
 */
export async function handleLoanConsolidationOffer(
  ctx: RouterContext,
  msg: string
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;

  // ── AI Intent Detection ──────────────────────────────────────────────────
  let loanIntent = { intent: 'unknown', confidence: 0, params: {} };
  try {
    loanIntent = await parseStateIntent(msg, 'loan_decision');
  } catch (intentErr) {
    console.warn(`[LoanOffer] parseStateIntent failed:`, intentErr);
  }
  console.log(`[LoanOffer] AI_INTENT: intent="${loanIntent.intent}", confidence=${loanIntent.confidence}`);

  // ── Yes – create a consolidation request and move to waiting_for_loan_docs ─
  if (loanIntent.intent === 'yes' && loanIntent.confidence >= 0.6) {
    const { data: contextData } = await supabase
      .from('users')
      .select('classification_context')
      .eq('id', userId)
      .single();

    const loanContext = contextData?.classification_context?.loanConsolidation;

    const { data: request, error: createError } = await supabase
      .from('loan_consolidation_requests')
      .insert({
        user_id: userId,
        status: 'pending_documents',
        total_monthly_payment: loanContext?.total_monthly || 0,
        num_loans: loanContext?.count || 0,
      })
      .select('id')
      .single();

    if (createError || !request) {
      console.error('[Monitoring] Failed to create consolidation request:', createError);
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `אופס! משהו השתבש. נסה שוב מאוחר יותר.`,
      });
      return await showFinalSummary(ctx);
    }

    console.log(`[Monitoring] Created consolidation request: ${request.id}`);

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message:
        `מעולה! 🎉\n\n` +
        `📄 *שלח לי את פרטי ההלוואות:*\n` +
        `• דוחות הלוואה מהבנק\n` +
        `• הסכמי הלוואה\n` +
        `• כל מסמך שמראה יתרת חוב וריבית\n\n` +
        `גדי יקבל את זה ויחזור אליך עם הצעות! 💰\n\n` +
        `*או כתוב "המשך" אם אין לך מסמכים כרגע.*`,
    });

    // Merge context – never overwrite existing keys
    const existingContext = contextData?.classification_context || {};
    await supabase
      .from('users')
      .update({
        onboarding_state: 'waiting_for_loan_docs',
        classification_context: {
          ...existingContext,
          loanConsolidation: {
            ...loanContext,
            requestId: request.id,
            waitingForDocs: true,
          },
        },
      })
      .eq('id', userId);

    return { success: true, newState: 'waiting_for_loan_docs' };
  }

  // ── No / skip ──────────────────────────────────────────────────────────────
  if ((loanIntent.intent === 'no' || loanIntent.intent === 'skip') && loanIntent.confidence >= 0.6) {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `בסדר גמור! 👍\n\nאם תרצה בעתיד - תמיד אפשר לחזור לזה.`,
    });
    return await showFinalSummary(ctx);
  }

  // ── Unclear ────────────────────────────────────────────────────────────────
  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `מעוניין באיחוד הלוואות?\n\n• *כן* - גדי יבדוק לך הצעות\n• *לא* / *נמשיך* - להמשיך הלאה`,
  });

  return { success: true };
}

// ============================================================================
// Waiting for Loan Documents Handler
// ============================================================================

/**
 * handleWaitingForLoanDocs - Handles the 'waiting_for_loan_docs' state.
 * If the user wants to continue without documents, transitions to final summary.
 * Otherwise instructs them to send the documents (actual file receipt is
 * handled by the webhook).
 */
export async function handleWaitingForLoanDocs(
  ctx: RouterContext,
  msg: string
): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();

  let docsIntent = { intent: 'unknown', confidence: 0, params: {} };
  try {
    docsIntent = await parseStateIntent(msg, 'waiting_for_docs');
  } catch (intentErr) {
    console.warn(`[WaitingForLoanDocs] parseStateIntent failed:`, intentErr);
  }
  console.log(`[WaitingForLoanDocs] AI_INTENT: intent="${docsIntent.intent}", confidence=${docsIntent.confidence}`);

  if (docsIntent.intent === 'skip' && docsIntent.confidence >= 0.6) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `בסדר! גדי ייצור קשר בהמשך לקבלת המסמכים. 👍`,
    });
    return await showFinalSummary(ctx);
  }

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `📄 מחכה למסמכי ההלוואות!\n\nשלח PDF או תמונה של המסמכים.`,
  });

  return { success: true };
}

// ============================================================================
// Monthly Summary
// ============================================================================

/**
 * showMonitoringSummary - Monthly financial summary with:
 * - Income / expense totals and balance
 * - Top expense categories
 * - Active goals progress
 * - Budget status
 *
 * @param ctx   - Router context
 * @param month - Optional YYYY-MM string (defaults to current month)
 */
export async function showMonitoringSummary(
  ctx: RouterContext,
  month?: string
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // If caller didn't pin a month, find the most recent month that has data.
  // Without this, requesting "summary" right after uploading a 2025 statement
  // returns 0/0/0 because the current month (today's month) has no tx.
  let targetMonth = month;
  let isAutoSelected = false;
  if (!targetMonth) {
    const { data: latest } = await supabase
      .from('transactions')
      .select('tx_date')
      .eq('user_id', ctx.userId)
      .eq('status', 'confirmed')
      .order('tx_date', { ascending: false })
      .limit(1);
    const latestDate = latest?.[0]?.tx_date;
    const currentMonth = new Date().toISOString().substring(0, 7);
    if (latestDate) {
      const latestMonth = latestDate.substring(0, 7);
      // If current month has data, prefer it. Otherwise, use the latest month
      // that has any data (so user always sees real numbers).
      const { count: currentCount } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', ctx.userId)
        .eq('status', 'confirmed')
        .gte('tx_date', `${currentMonth}-01`);
      if (currentCount && currentCount > 0) {
        targetMonth = currentMonth;
      } else {
        targetMonth = latestMonth;
        isAutoSelected = true;
      }
    } else {
      targetMonth = currentMonth;
    }
  }
  const [year, mon] = targetMonth.split('-');
  const monthStart = `${targetMonth}-01`;
  const nextMonth = new Date(Number(year), Number(mon), 1);
  const monthEnd = nextMonth.toISOString().split('T')[0];

  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, type, category, tx_date')
    .eq('user_id', ctx.userId)
    .eq('status', 'confirmed')
    .gte('tx_date', monthStart)
    .lt('tx_date', monthEnd);

  const totalIncome = (transactions || [])
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalExpenses = (transactions || [])
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const balance = totalIncome - totalExpenses;

  // Category breakdown – top 5 expense categories
  const categoryTotals: Record<string, number> = {};
  (transactions || [])
    .filter(t => t.type === 'expense' && t.category)
    .forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
    });

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amount]) => `• ${cat}: ₪${amount.toLocaleString('he-IL')}`)
    .join('\n');

  // Goals progress
  const { data: goals } = await supabase
    .from('goals')
    .select('name, target_amount, current_amount')
    .eq('user_id', ctx.userId)
    .eq('status', 'active');

  const goalsText = (goals || [])
    .map(g => {
      const progress = Math.round((g.current_amount / g.target_amount) * 100);
      return (
        `• ${g.name}: ${progress}% ` +
        `(₪${g.current_amount.toLocaleString('he-IL')}/${g.target_amount.toLocaleString('he-IL')})`
      );
    })
    .join('\n');

  // Budget status for target month
  const { data: budget } = await supabase
    .from('budgets')
    .select('total_budget, savings_goal, total_spent')
    .eq('user_id', ctx.userId)
    .eq('month', targetMonth)
    .single();

  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
  ];
  const monthLabel = `${monthNames[Number(mon) - 1]} ${year}`;

  let message = isAutoSelected
    ? `📊 *סיכום ${monthLabel}* _(החודש האחרון עם נתונים)_\n\n`
    : `📊 *סיכום ${monthLabel}*\n\n`;
  message += `💚 הכנסות: ₪${totalIncome.toLocaleString('he-IL')}\n`;
  message += `💸 הוצאות: ₪${totalExpenses.toLocaleString('he-IL')}\n`;
  message += `${balance >= 0 ? '✨' : '📉'} יתרה: ₪${balance.toLocaleString('he-IL')}\n\n`;

  if (topCategories) {
    message += `*🏷️ ההוצאות הגדולות:*\n${topCategories}\n\n`;
  }

  if (goalsText) {
    message += `*🎯 יעדים:*\n${goalsText}\n\n`;
  }

  if (budget) {
    const budgetUsed = Math.round(
      (Number(budget.total_spent) / Number(budget.total_budget)) * 100
    );
    message += `*💰 תקציב:*\n`;
    message += `• תקציב: ₪${Number(budget.total_budget).toLocaleString('he-IL')}\n`;
    message += `• הוצא: ₪${Number(budget.total_spent).toLocaleString('he-IL')} (${budgetUsed}%)\n`;
    message += `• חיסכון: ₪${Number(budget.savings_goal).toLocaleString('he-IL')}\n`;
  }

  message += `\nכתוב *"חודשים"* לראות חודשים נוספים`;

  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message });
  return { success: true };
}

// ============================================================================
// Available Months
// ============================================================================

/**
 * showAvailableMonths - Lists all covered months from the period tracker.
 * Instructs the user on how to request a specific month's report.
 */
export async function showAvailableMonths(ctx: RouterContext): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();

  const coverage = await getUserPeriodCoverage(ctx.userId);

  if (coverage.coveredMonths.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📅 אין עדיין נתונים חודשיים.\n\nשלח דוח בנק או כרטיס אשראי כדי להתחיל.`,
    });
    return { success: true };
  }

  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
  ];

  const monthsList = coverage.coveredMonths
    .slice()
    .sort()
    .reverse()
    .map(m => {
      const [y, mo] = m.split('-');
      return `• *דוח ${mo}/${y}* - ${monthNames[Number(mo) - 1]} ${y}`;
    })
    .join('\n');

  let message = `📅 *חודשים זמינים (${coverage.totalMonths}):*\n\n`;
  message += monthsList;
  message += `\n\nכתוב *"דוח MM/YYYY"* לראות סיכום של חודש ספציפי`;
  message += `\nלדוגמה: *דוח 12/2025*`;

  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message });
  return { success: true };
}

// ============================================================================
// Duplicate Suspects
// ============================================================================

/**
 * showDuplicateSuspects - Lists transactions flagged as 'duplicate_suspect'.
 * Offers confirmation or rejection commands for each entry.
 */
export async function showDuplicateSuspects(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const { data: dupTx } = await supabase
    .from('transactions')
    .select('id, vendor, amount, tx_date, notes')
    .eq('user_id', ctx.userId)
    .eq('status', 'pending')
    .ilike('notes', '%חשד לכפל%')
    .order('tx_date', { ascending: false });

  if (!dupTx || dupTx.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `✅ אין חשד לכפל תשלום. הכל תקין!`,
    });
    return { success: true };
  }

  const txList = dupTx
    .slice(0, 10)
    .map((tx, i) => {
      const date = tx.tx_date
        ? new Date(tx.tx_date).toLocaleDateString('he-IL')
        : '?';
      return `${i + 1}. ${tx.vendor || 'ללא ספק'} - ₪${Math.abs(tx.amount).toLocaleString('he-IL')} (${date})`;
    })
    .join('\n');

  let message = `⚠️ *חשד לכפל תשלום (${dupTx.length}):*\n\n`;
  message += txList;
  message += `\n\nכתוב *"אשר כפל [מספר]"* למחוק כפילות`;
  message += `\nכתוב *"לא כפל [מספר]"* לאשר כתנועה נפרדת`;

  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message });
  return { success: true };
}

// ============================================================================
// Unclassified Transactions
// ============================================================================

/**
 * showUnclassifiedTransactions - Shows pending (unclassified) transactions.
 * Offers a shortcut to start the classification flow.
 */
export async function showUnclassifiedTransactions(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const { data: pendingTx } = await supabase
    .from('transactions')
    .select('id, vendor, amount, tx_date, type')
    .eq('user_id', ctx.userId)
    .eq('status', 'pending')
    .order('tx_date', { ascending: false });

  if (!pendingTx || pendingTx.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `✅ כל התנועות מסווגות! אין תנועות ממתינות.`,
    });
    return { success: true };
  }

  const incomeCount = pendingTx.filter(t => t.type === 'income').length;
  const expenseCount = pendingTx.filter(t => t.type === 'expense').length;

  const txList = pendingTx
    .slice(0, 5)
    .map((tx, i) => {
      const date = tx.tx_date
        ? new Date(tx.tx_date).toLocaleDateString('he-IL')
        : '?';
      const typeIcon = tx.type === 'income' ? '💚' : '💸';
      return `${i + 1}. ${typeIcon} ${tx.vendor || 'ללא ספק'} - ₪${Math.abs(tx.amount).toLocaleString('he-IL')} (${date})`;
    })
    .join('\n');

  let message = `📋 *תנועות לא מסווגות (${pendingTx.length}):*\n`;
  if (incomeCount > 0) message += `💚 ${incomeCount} הכנסות | `;
  if (expenseCount > 0) message += `💸 ${expenseCount} הוצאות`;
  message += `\n\n${txList}`;
  if (pendingTx.length > 5) {
    message += `\n... ועוד ${pendingTx.length - 5} תנועות`;
  }
  message += `\n\nכתוב *"נתחיל"* כדי להתחיל לסווג`;

  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message });
  return { success: true };
}

// ============================================================================
// Needs Credit Detail
// ============================================================================

/**
 * showNeedsCreditDetail - Shows credit card charges waiting for an itemized statement.
 */
export async function showNeedsCreditDetail(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const { data: pendingTx } = await supabase
    .from('transactions')
    .select('id, vendor, amount, tx_date')
    .eq('user_id', ctx.userId)
    .eq('status', 'confirmed')
    .ilike('notes', '%ממתין לדוח פירוט%')
    .order('tx_date', { ascending: false });

  if (!pendingTx || pendingTx.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `✅ אין תנועות שממתינות לפירוט אשראי.\n\nכל התנועות מקושרות!`,
    });
    return { success: true };
  }

  const txList = pendingTx
    .slice(0, 10)
    .map((tx, i) => {
      const date = tx.tx_date
        ? new Date(tx.tx_date).toLocaleDateString('he-IL')
        : '?';
      return `${i + 1}. ${tx.vendor || 'ללא ספק'} - ₪${Math.abs(tx.amount).toLocaleString('he-IL')} (${date})`;
    })
    .join('\n');

  let message = `💳 *תנועות ממתינות לפירוט אשראי (${pendingTx.length}):*\n\n`;
  message += txList;
  if (pendingTx.length > 10) {
    message += `\n... ועוד ${pendingTx.length - 10} תנועות`;
  }
  message += `\n\nשלח *דוח אשראי* כדי לקשר אוטומטית`;
  message += `\nאו כתוב *"בטל אשראי [מספר]"* לסמן כמסווג`;

  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message });
  return { success: true };
}

// ============================================================================
// Budget Status
// ============================================================================

/**
 * showBudgetStatus - Shows the current month's budget with per-category
 * allocation vs. spent, remaining amount, and a status message.
 */
export async function showBudgetStatus(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const currentMonth = new Date().toISOString().substring(0, 7);

  const { data: budget } = await supabase
    .from('budgets')
    .select('id, total_budget, savings_goal, total_spent')
    .eq('user_id', ctx.userId)
    .eq('month', currentMonth)
    .single();

  if (!budget) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message:
        `❌ אין תקציב מוגדר לחודש זה.\n\n` +
        `כתוב *"תקציב אוטומטי"* ליצירת תקציב.`,
    });
    return { success: true };
  }

  // Ensure budget spending is up-to-date
  const { syncBudgetSpending } = await import('@/lib/services/BudgetSyncService');
  await syncBudgetSpending(ctx.userId, currentMonth);

  // Re-fetch budget with updated totals
  const { data: freshBudget } = await supabase
    .from('budgets')
    .select('id, total_budget, savings_goal, total_spent')
    .eq('user_id', ctx.userId)
    .eq('month', currentMonth)
    .single();

  if (freshBudget) {
    Object.assign(budget, freshBudget);
  }

  const { data: categories } = await supabase
    .from('budget_categories')
    .select('category_name, allocated_amount, spent_amount')
    .eq('budget_id', budget.id)
    .order('allocated_amount', { ascending: false });

  const totalBudget = Number(budget.total_budget);
  const totalSpent = Number(budget.total_spent);
  const remaining = totalBudget - totalSpent;
  const percentUsed = Math.round((totalSpent / totalBudget) * 100);

  let message = `💰 *תקציב ${currentMonth}*\n\n`;
  message += `📊 *סיכום:*\n`;
  message += `• תקציב כולל: ₪${totalBudget.toLocaleString('he-IL')}\n`;
  message += `• הוצא: ₪${totalSpent.toLocaleString('he-IL')} (${percentUsed}%)\n`;
  message += `• נותר: ₪${remaining.toLocaleString('he-IL')}\n`;
  message += `• יעד חיסכון: ₪${Number(budget.savings_goal).toLocaleString('he-IL')}\n\n`;

  if (categories && categories.length > 0) {
    message += `*🏷️ קטגוריות:*\n`;
    categories.forEach(cat => {
      const allocated = Number(cat.allocated_amount);
      const spent = Number(cat.spent_amount);
      const catRemaining = allocated - spent;
      const emoji = catRemaining >= 0 ? '✅' : '🔴';
      message += `${emoji} ${cat.category_name}: ₪${spent.toLocaleString('he-IL')}/${allocated.toLocaleString('he-IL')}\n`;
    });
  }

  if (remaining < 0) {
    message += `\n⚠️ *חריגה מהתקציב!*\n`;
    message += `עברת את התקציב ב-₪${Math.abs(remaining).toLocaleString('he-IL')}`;
  } else if (percentUsed > 80) {
    message += `\n⚡ *קרוב לתקרה!*\n`;
    message += `נשארו לך רק ₪${remaining.toLocaleString('he-IL')} לחודש`;
  } else {
    message += `\n✨ *מצוין!*\n`;
    message += `נשארו לך ₪${remaining.toLocaleString('he-IL')} לחודש`;
  }

  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message });
  return { success: true };
}

// ============================================================================
// Chart Generation
// ============================================================================

/**
 * generateAndSendExpenseChart - Builds a pie chart of confirmed expense
 * distribution and sends it via WhatsApp.  Falls back to a text summary
 * if image generation fails.
 */
export async function generateAndSendExpenseChart(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: '🎨 מכין את הגרף שלך...',
  });

  const { data: expenses } = await supabase
    .from('transactions')
    .select('category, amount')
    .eq('user_id', ctx.userId)
    .eq('status', 'confirmed')
    .eq('type', 'expense');

  if (!expenses || expenses.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: '😕 אין לי מספיק נתונים ליצירת גרף. שלח דוח בנק קודם.',
    });
    return { success: false };
  }

  const categoryTotals: Record<string, number> = {};
  let total = 0;

  expenses.forEach(t => {
    const cat = t.category || 'אחר';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(t.amount);
    total += Math.abs(t.amount);
  });

  const categories: CategoryData[] = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: Math.round((amount / total) * 100),
    }));

  const hebrewMonths = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
  ];
  const now = new Date();
  const subtitle = `${hebrewMonths[now.getMonth()]} ${now.getFullYear()}`;

  try {
    const image = await generatePieChart('התפלגות הוצאות', categories, {
      subtitle,
      note: {
        title: 'φ',
        text: `סה"כ: ${total.toLocaleString('he-IL')} ₪`,
      },
    });

    if (image && image.base64) {
      await sendWhatsAppImage(
        ctx.phone,
        image.base64,
        `📊 התפלגות הוצאות - ${subtitle}\nסה"כ: ${total.toLocaleString('he-IL')} ₪`,
        image.mimeType
      );
      console.log('[Monitoring] Expense chart sent successfully');
      return { success: true };
    }
    throw new Error('No image generated');
  } catch (error) {
    console.error('[Monitoring] Failed to generate expense chart:', error);

    // Text fallback
    const textSummary = categories
      .map(c => `• ${c.name}: ${c.amount.toLocaleString('he-IL')} ₪ (${c.percentage}%)`)
      .join('\n');

    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📊 *התפלגות הוצאות*\n\n${textSummary}\n\n💰 סה"כ: ${total.toLocaleString('he-IL')} ₪`,
    });

    return { success: true };
  }
}

/**
 * generateAndSendIncomeChart - Builds a pie chart of confirmed income
 * distribution and sends it via WhatsApp.  Falls back to a text summary
 * if image generation fails.
 */
export async function generateAndSendIncomeChart(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const { data: incomes } = await supabase
    .from('transactions')
    .select('amount, income_category, category')
    .eq('user_id', ctx.userId)
    .eq('type', 'income')
    .eq('status', 'confirmed');

  if (!incomes || incomes.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: '💚 אין הכנסות מסווגות עדיין.\n\nסווג קודם כמה הכנסות!',
    });
    return { success: true };
  }

  const categoryTotals: Record<string, number> = {};
  incomes.forEach(inc => {
    const cat = inc.income_category || inc.category || 'אחר';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(Number(inc.amount));
  });

  const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  // Phi-brand green palette for income charts
  const incomeColors = ['#8FBCBB', '#88C0D0', '#81A1C1', '#5E81AC', '#A3BE8C', '#EBCB8B'];

  const categories: CategoryData[] = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, amount], idx) => ({
      name,
      amount,
      percentage: Math.round((amount / total) * 100),
      color: incomeColors[idx % incomeColors.length],
    }));

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: '💚 מכין גרף הכנסות...',
  });

  try {
    const image = await generatePieChart('התפלגות הכנסות', categories, {
      aspectRatio: '16:9',
    });

    if (image) {
      await sendWhatsAppImage(
        ctx.phone,
        image.base64,
        `💚 *התפלגות הכנסות*\n\n💰 סה"כ: ${total.toLocaleString('he-IL')} ₪`,
        image.mimeType
      );
      return { success: true };
    }
    throw new Error('No image generated');
  } catch (error) {
    console.error('[Monitoring] Failed to generate income chart:', error);

    // Text fallback
    const textSummary = categories
      .map(c => `• ${c.name}: ${c.amount.toLocaleString('he-IL')} ₪ (${c.percentage}%)`)
      .join('\n');

    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `💚 *התפלגות הכנסות*\n\n${textSummary}\n\n💰 סה"כ: ${total.toLocaleString('he-IL')} ₪`,
    });

    return { success: true };
  }
}

// ============================================================================
// Category Question
// ============================================================================

/**
 * answerCategoryQuestion - Sums all confirmed transactions matching the given
 * category name and replies with a concise breakdown.
 *
 * @param ctx      - Router context
 * @param category - Category name (from findBestMatch)
 */
export async function answerCategoryQuestion(
  ctx: RouterContext,
  category: string
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const { data: txs } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', ctx.userId)
    .eq('status', 'confirmed')
    .ilike('category', `%${category}%`);

  const total = (txs || []).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const count = txs?.length || 0;

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message:
      `📊 *${category}*\n\n` +
      `${count} תנועות\n` +
      `סה"כ: ${total.toLocaleString('he-IL')} ₪`,
  });

  return { success: true };
}

// ============================================================================
// Goal Deposit Handler
// ============================================================================

/**
 * handleGoalDeposit - Parses "הפקדה ליעד [name] [amount]" and records a
 * confirmed savings transaction, then shows the updated goal progress.
 *
 * Regex: /הפקדה\s*(?:ליעד|:)\s*(.+?)\s+(\d+\.?\d*)/i
 */
export async function handleGoalDeposit(
  ctx: RouterContext,
  msg: string
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Parse the message
  const match = msg.match(/הפקדה\s*(?:ליעד|:)\s*(.+?)\s+(\d+\.?\d*)/i);

  if (!match) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message:
        `❌ לא הצלחתי להבין.\n\n` +
        `הפורמט הנכון:\n*״הפקדה ליעד [שם] [סכום]״*\n\n` +
        `דוגמה:\n*״הפקדה ליעד קרן חירום 500״*`,
    });
    return { success: true };
  }

  const goalName = match[1].trim();
  const amount = parseFloat(match[2]);

  if (isNaN(amount) || amount <= 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ סכום לא תקין: ${match[2]}\n\nנסה שוב עם סכום חיובי.`,
    });
    return { success: true };
  }

  // Search for the goal by name (case-insensitive partial match)
  const { data: goals, error: goalsError } = await supabase
    .from('goals')
    .select('id, name, current_amount, target_amount')
    .eq('user_id', ctx.userId)
    .eq('status', 'active')
    .ilike('name', `%${goalName}%`);

  if (goalsError || !goals || goals.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message:
        `❌ לא מצאתי יעד בשם ״${goalName}״.\n\n` +
        `כתוב *״יעדים״* לראות את כל היעדים שלך.`,
    });
    return { success: true };
  }

  // Ambiguous name – ask for clarification
  if (goals.length > 1) {
    const goalsList = goals.map((g, i) => `${i + 1}. ${g.name}`).join('\n');
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message:
        `🤔 מצאתי כמה יעדים:\n\n${goalsList}\n\n` +
        `איזה מהם התכוונת? כתוב *״הפקדה ליעד [שם מלא] [סכום]״*`,
    });
    return { success: true };
  }

  const goal = goals[0];

  // Insert a confirmed savings transaction
  const { error: txError } = await supabase.from('transactions').insert({
    user_id: ctx.userId,
    goal_id: goal.id,
    type: 'income',
    amount,
    description: `הפקדה ליעד: ${goal.name}`,
    tx_date: new Date().toISOString().split('T')[0],
    status: 'confirmed',
    category: null,
    income_category: 'savings',
  });

  if (txError) {
    console.error('[Monitoring] Failed to create goal deposit:', txError);
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ שגיאה ביצירת ההפקדה. נסה שוב מאוחר יותר.`,
    });
    return { success: true };
  }

  // Calculate updated progress (DB trigger updates current_amount automatically)
  const newAmount = goal.current_amount + amount;
  const progress = Math.round((newAmount / goal.target_amount) * 100);
  const remaining = goal.target_amount - newAmount;

  let progressEmoji = '🚀 *התחלה מעולה!*';
  if (progress >= 100) progressEmoji = '🎉 *הגעת ליעד!*';
  else if (progress >= 75) progressEmoji = '🔥 *כמעט שם!*';
  else if (progress >= 50) progressEmoji = '💪 *חצי דרך!*';

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message:
      `✅ *הפקדה של ${amount.toLocaleString('he-IL')} ₪ נרשמה!*\n\n` +
      `🎯 *יעד:* ${goal.name}\n` +
      `💰 *יתרה חדשה:* ${newAmount.toLocaleString('he-IL')} ₪\n` +
      `📊 *התקדמות:* ${progress}%\n` +
      `📈 *נותר:* ${remaining.toLocaleString('he-IL')} ₪\n\n` +
      progressEmoji,
  });

  return { success: true };
}

// ============================================================================
// Final Summary (transition to behavior phase)
// ============================================================================

/**
 * showFinalSummary - Shown after loan consolidation is resolved (or skipped).
 * Transitions the user to the 'behavior' phase and shows a 3-month summary
 * with interactive buttons offering analysis or adding more documents.
 */
export async function showFinalSummary(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Use calculated phase (don't hardcode)
  const { calculatePhase: calcPhaseFinal } = await import('@/lib/services/PhaseService');
  const finalPhase = await calcPhaseFinal(ctx.userId);

  // Transition to behavior phase
  await supabase
    .from('users')
    .update({
      onboarding_state: 'behavior',
      phase: finalPhase,
      phase_updated_at: new Date().toISOString(),
    })
    .eq('id', ctx.userId);

  // Summarise last 3 months of confirmed transactions
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const dateFilter = threeMonthsAgo.toISOString().split('T')[0];

  const { data: confirmed } = await supabase
    .from('transactions')
    .select('amount, type, category')
    .eq('user_id', ctx.userId)
    .eq('status', 'confirmed')
    .gte('tx_date', dateFilter);

  const totalIncome = (confirmed || [])
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalExpenses = (confirmed || [])
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const balance = totalIncome - totalExpenses;
  const balanceEmoji = balance >= 0 ? '✨' : '📉';

  // Top expense categories
  const categoryTotals: Record<string, number> = {};
  (confirmed || [])
    .filter(t => t.type === 'expense' && t.category)
    .forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
    });

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amount]) => `• ${cat}: ${amount.toLocaleString('he-IL')} ₪`)
    .join('\n');

  let message = `🎉 *סיימנו לסווג!*\n\n`;
  message += `📊 *הסיכום שלך:*\n`;
  message += `💚 הכנסות: ${totalIncome.toLocaleString('he-IL')} ₪\n`;
  message += `💸 הוצאות: ${totalExpenses.toLocaleString('he-IL')} ₪\n`;
  message += `${balanceEmoji} יתרה: ${balance.toLocaleString('he-IL')} ₪\n\n`;

  if (topCategories) {
    message += `*הקטגוריות הגדולות:*\n${topCategories}\n\n`;
  }

  try {
    await sendWhatsAppInteractiveButtons(ctx.phone, {
      message,
      header: 'מה עכשיו?',
      buttons: [
        { buttonId: 'analyze', buttonText: 'בדוק הוצאות 🔍' },
        { buttonId: 'add_more', buttonText: 'שלח עוד דוח 📄' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message:
        message +
        `\n\n*מה עכשיו?*\n` +
        `• כתוב *"ניתוח"* לזיהוי דפוסי הוצאה\n` +
        `• או שלח עוד מסמכים לניתוח מדויק יותר`,
    });
  }

  return { success: true, newState: 'behavior' };
}

// ============================================================================
// Cash Flow Projection (Feature A)
// ============================================================================

/**
 * showCashFlowProjection - Shows a 3-month cash flow forecast via WhatsApp.
 * Uses the projectCashFlow engine and formats results as a readable message.
 */
async function showCashFlowProjection(ctx: RouterContext): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();

  try {
    const analysis = await projectCashFlow(ctx.userId, 3);

    if (analysis.projections.length === 0) {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `📈 *תחזית תזרים*\n\nאין מספיק נתונים לתחזית עדיין.\n\nשלח עוד דוחות בנק כדי שאוכל לחזות!`,
      });
      return { success: true };
    }

    let msg = `📈 *תחזית תזרים - 3 חודשים קדימה*\n\n`;

    for (const p of analysis.projections) {
      const emoji = p.is_negative ? '🔴' : '🟢';
      msg += `${emoji} *${p.month_name}*\n`;
      msg += `  💰 הכנסות: ${p.projected_income.toLocaleString('he-IL')} ₪\n`;
      msg += `  💸 הוצאות: ${p.projected_expenses.toLocaleString('he-IL')} ₪\n`;
      msg += `  ${p.net_cash_flow >= 0 ? '✅' : '📉'} יתרה: ${p.net_cash_flow.toLocaleString('he-IL')} ₪\n\n`;
    }

    // Warnings
    if (analysis.warnings.length > 0) {
      msg += `*אזהרות:*\n`;
      for (const w of analysis.warnings) {
        msg += `${w}\n`;
      }
      msg += `\n`;
    }

    // Recommendations
    const topRecs = analysis.recommendations.filter(r => r.priority === 'high').slice(0, 2);
    if (topRecs.length > 0) {
      msg += `💡 *המלצות φ:*\n`;
      for (const rec of topRecs) {
        const impact = rec.impact_amount > 0
          ? ` (חיסכון: ${rec.impact_amount.toLocaleString('he-IL')} ₪)`
          : '';
        msg += `• ${rec.recommendation_text}${impact}\n`;
      }
      msg += `\n`;
    }

    // Summary
    const { summary } = analysis;
    if (summary.negative_months_count > 0) {
      msg += `⚠️ *${summary.negative_months_count} חודשים עם תזרים שלילי*\n`;
      msg += `רוצה עזרה? כתוב *"ייעוץ"* לשיחה עם גדי 💼`;
    } else {
      msg += `✨ *התזרים שלך נראה טוב!*\n`;
      msg += `ממוצע עודף חודשי: ${Math.round(summary.average_monthly_surplus).toLocaleString('he-IL')} ₪`;
    }

    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg });
    return { success: true };
  } catch (error) {
    console.error('[Monitoring] Cash flow projection error:', error);
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `😕 לא הצלחתי ליצור תחזית כרגע.\n\nנסה שוב מאוחר יותר.`,
    });
    return { success: true };
  }
}

// ============================================================================
// Phi Financial Health Score (Feature E)
// ============================================================================

/**
 * showPhiScore - Shows the user's financial health score (0-100).
 * Calculates based on: savings rate, budget adherence, goal progress,
 * and expense stability.
 */
async function showPhiScore(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  try {
    // Try RPC first
    const { data: rpcScore, error: rpcError } = await supabase
      .rpc('calculate_financial_health', { p_user_id: ctx.userId });

    if (!rpcError && rpcScore !== null && rpcScore !== undefined) {
      const score = typeof rpcScore === 'object' ? rpcScore.score : Number(rpcScore);
      if (!isNaN(score)) {
        const msg = formatPhiScoreMessage(score);
        await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg });
        return { success: true };
      }
    }

    // Fallback: calculate locally from available data
    const score = await calculateLocalPhiScore(ctx.userId, supabase);
    const msg = formatPhiScoreMessage(score);
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg });
    return { success: true };
  } catch (error) {
    console.error('[Monitoring] Phi Score error:', error);
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `😕 לא הצלחתי לחשב את הציון כרגע.\n\nנסה שוב מאוחר יותר.`,
    });
    return { success: true };
  }
}

function formatPhiScoreMessage(score: number): string {
  const clampedScore = Math.min(100, Math.max(0, Math.round(score)));

  let grade: string;
  let emoji: string;
  let advice: string;

  if (clampedScore >= 80) {
    grade = 'מצוין';
    emoji = '🏆';
    advice = 'אתה מנהל את הכספים בצורה מעולה! המשך ככה.';
  } else if (clampedScore >= 60) {
    grade = 'טוב';
    emoji = '💪';
    advice = 'מצב טוב! יש מקום לשיפור קטן בחיסכון או בתקציב.';
  } else if (clampedScore >= 40) {
    grade = 'סביר';
    emoji = '⚡';
    advice = 'יש פוטנציאל לשיפור. נסה לצמצם הוצאות או להגדיר יעדים.';
  } else {
    grade = 'דורש שיפור';
    emoji = '⚠️';
    advice = 'בוא נעבוד יחד על שיפור! כתוב *"ייעוץ"* לקבל עזרה.';
  }

  // Visual score bar
  const filled = Math.round(clampedScore / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

  let msg = `${emoji} *ציון φ Phi Score: ${clampedScore}/100*\n\n`;
  msg += `${bar} ${grade}\n\n`;
  msg += `${advice}\n\n`;
  msg += `*פירוט:*\n`;

  return msg;
}

async function calculateLocalPhiScore(userId: string, supabase: any): Promise<number> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

  // Fetch transactions for last 3 months
  const { data: txs } = await supabase
    .from('transactions')
    .select('amount, type, tx_date, status')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .gte('tx_date', threeMonthsAgoStr);

  const income = (txs || []).filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  const expenses = (txs || []).filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Math.abs(t.amount), 0);

  // 1. Savings rate (0-25 points)
  const savingsRate = income > 0 ? (income - expenses) / income : 0;
  const savingsScore = Math.min(25, Math.max(0, Math.round(savingsRate * 83))); // 30% savings = 25 points

  // 2. Budget adherence (0-20 points)
  const currentMonth = now.toISOString().substring(0, 7);
  const { data: budget } = await supabase
    .from('budgets')
    .select('total_budget, total_spent')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .single();

  let budgetScore = 12; // neutral if no budget
  if (budget && Number(budget.total_budget) > 0) {
    const budgetUsed = Number(budget.total_spent) / Number(budget.total_budget);
    if (budgetUsed <= 0.8) budgetScore = 20;
    else if (budgetUsed <= 1.0) budgetScore = 15;
    else if (budgetUsed <= 1.2) budgetScore = 8;
    else budgetScore = 3;
  }

  // 3. Goal progress (0-20 points)
  const { data: goals } = await supabase
    .from('goals')
    .select('target_amount, current_amount')
    .eq('user_id', userId)
    .eq('status', 'active');

  let goalScore = 8; // neutral if no goals
  if (goals && goals.length > 0) {
    const avgProgress = goals.reduce((s: number, g: any) =>
      s + Math.min(1, g.current_amount / g.target_amount), 0) / goals.length;
    goalScore = Math.round(avgProgress * 20);
  }

  // 4. Consistency - classified transactions ratio (0-15 points)
  const { data: allTx } = await supabase
    .from('transactions')
    .select('status')
    .eq('user_id', userId)
    .gte('tx_date', threeMonthsAgoStr);

  const totalTx = allTx?.length || 1;
  const confirmedTx = (allTx || []).filter((t: any) => t.status === 'confirmed').length;
  const classifiedRatio = confirmedTx / totalTx;
  const consistencyScore = Math.round(classifiedRatio * 15);

  // 5. Debt health (0-20 points) — lower debt-to-income = higher score
  const { data: loans } = await supabase
    .from('loans')
    .select('monthly_payment')
    .eq('user_id', userId)
    .eq('status', 'active');

  const monthlyIncome = income / 3; // 3-month total → monthly
  let debtScore = 20; // full score if no debt
  if (loans && loans.length > 0 && monthlyIncome > 0) {
    const totalMonthlyDebt = loans.reduce((s: number, l: any) => s + (parseFloat(l.monthly_payment) || 0), 0);
    const debtToIncome = totalMonthlyDebt / monthlyIncome;
    // DTI ≤ 20% = 20 pts, 30% = 15, 40% = 10, 50% = 5, >50% = 2
    if (debtToIncome <= 0.2) debtScore = 20;
    else if (debtToIncome <= 0.3) debtScore = 15;
    else if (debtToIncome <= 0.4) debtScore = 10;
    else if (debtToIncome <= 0.5) debtScore = 5;
    else debtScore = 2;
  }

  return savingsScore + budgetScore + goalScore + consistencyScore + debtScore;
}

// ============================================================================
// Advisor CTA (Feature D partial - used in monitoring)
// ============================================================================

async function showAdvisorCTA(ctx: RouterContext): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();
  const supabase = createServiceClient();

  // Generate a short personalized summary
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const { data: txs } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('user_id', ctx.userId)
    .eq('status', 'confirmed')
    .gte('tx_date', monthStart);

  const monthExpenses = (txs || [])
    .filter((t: any) => t.type === 'expense')
    .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);

  const { WHATSAPP_ADVISOR_NUMBER } = await import('@/lib/constants');
  const waNumber = WHATSAPP_ADVISOR_NUMBER;

  let msg = `💼 *ייעוץ פיננסי עם גדי*\n\n`;
  msg += `גדי הוא יועץ פיננסי מוסמך שיכול לעזור לך:\n\n`;
  msg += `• 📊 ניתוח מצב פיננסי מקיף\n`;
  msg += `• 🏦 איחוד הלוואות וחסכון בריביות\n`;
  msg += `• 🎯 תכנון פיננסי לטווח ארוך\n`;
  msg += `• 💰 אסטרטגיות חיסכון והשקעה\n\n`;

  if (monthExpenses > 0) {
    msg += `📈 *הוצאות החודש שלך:* ${monthExpenses.toLocaleString('he-IL')} ₪\n\n`;
  }

  msg += `📞 *ליצירת קשר עם גדי:*\nhttps://wa.me/${waNumber}?text=היי%20גדי%2C%20הגעתי%20מהבוט\n\n`;
  msg += `🤝 *גדי - העוזר הפיננסי שלך*`;

  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg });
  return { success: true };
}
