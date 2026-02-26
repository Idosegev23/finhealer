// @ts-nocheck
/**
 * φ Router - Thin conversation router
 *
 * ~200 lines. All business logic lives in:
 *   - states/onboarding.ts
 *   - states/classification.ts
 *   - states/behavior.ts
 *   - states/goals.ts
 *   - states/budget.ts
 *   - states/monitoring.ts
 *
 * Services layer at:
 *   - lib/services/PhaseService.ts
 *   - lib/services/TransactionService.ts
 *   - lib/services/NotificationService.ts
 *   - lib/services/GoalService.ts
 *   - lib/services/ClassificationService.ts
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { getOrCreateContext, updateContext, isContextStale, resumeStaleContext } from './context-manager';

import type { RouterContext, RouterResult, UserState } from './shared';
import { isCommand } from './shared';

// State handlers (lazy imports for tree-shaking)
import { handleStart, handleWaitingForName, handleWaitingForDocument } from './states/onboarding';
import { handleClassificationState, handleClassificationResponse, startClassification } from './states/classification';
import { handleBehaviorPhase } from './states/behavior';
import { handleGoalsSetup, handleGoalsPhase } from './states/goals';
import { handleBudgetPhase } from './states/budget';
import { handleMonitoring, handleLoanConsolidationOffer, handleWaitingForLoanDocs } from './states/monitoring';

// Re-export types for consumers
export type { RouterContext, RouterResult, UserState };

// ============================================================================
// Main Router
// ============================================================================

export async function routeMessage(
  userId: string,
  phone: string,
  message: string
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const msg = message.trim();

  console.log(`[Router] ═══════════════════════════════════════`);
  console.log(`[Router] INCOMING: userId=${userId.substring(0,8)}..., phone=${phone.substring(0,6)}..., msg="${msg.substring(0, 80)}"`);

  // Load conversation context for continuity
  const conversationCtx = await getOrCreateContext(userId);

  // Check if context is stale (no interaction for 24+ hours)
  if (isContextStale(conversationCtx)) {
    const { context: resumedCtx, message: resumeMsg } = await resumeStaleContext(userId);
    console.log(`[Router] STALE_CONTEXT: resumed for userId=${userId.substring(0,8)}...`);
    if (resumeMsg) {
      await greenAPI.sendMessage({ phoneNumber: phone, message: resumeMsg });
    }
  }

  // Load user
  const { data: user } = await supabase
    .from('users')
    .select('name, full_name, onboarding_state')
    .eq('id', userId)
    .single();

  const userName = user?.name || user?.full_name || null;
  const state = (user?.onboarding_state || 'waiting_for_name') as UserState;
  const ctx: RouterContext = { userId, phone, state, userName };

  console.log(`[Router] USER_STATE: state=${state}, name=${userName || 'null'}, raw_onboarding=${user?.onboarding_state || 'null'}`);

  // ══════════════════════════════════════════════════════════════════════════
  // UNIVERSAL: "עזרה" / "תפריט" works in ALL states (escape hatch)
  // ══════════════════════════════════════════════════════════════════════════
  const helpKeywords = ['עזרה', 'help', 'תפריט', 'מה אפשר', 'פקודות'];
  if (helpKeywords.some(k => msg === k || msg.startsWith(k))) {
    const stateLabels: Record<string, string> = {
      start: 'התחלה',
      waiting_for_name: 'המתנה לשם',
      waiting_for_document: 'המתנה למסמך',
      classification: 'סיווג תנועות',
      classification_income: 'סיווג הכנסות',
      classification_expense: 'סיווג הוצאות',
      goals_setup: 'הגדרת יעדים',
      behavior: 'ניתוח התנהגות',
      goals: 'ניהול יעדים',
      budget: 'תקציב',
      monitoring: 'ניטור',
      loan_consolidation_offer: 'איחוד הלוואות',
      waiting_for_loan_docs: 'המתנה למסמכי הלוואה',
    };
    const currentLabel = stateLabels[state] || state;

    let helpText = `🆘 *עזרה - φ Phi*\n\n`;
    helpText += `📍 אתה נמצא בשלב: *${currentLabel}*\n\n`;

    if (state === 'waiting_for_document' || state === 'start') {
      helpText += `*מה אפשר לעשות:*\n`;
      helpText += `📄 שלח תמונה או PDF של דוח בנק/אשראי\n`;
      helpText += `✏️ כתוב *"נתחיל"* - לסווג תנועות קיימות\n`;
      helpText += `📊 כתוב *"סיכום"* - לראות מצב כללי\n`;
    } else if (state === 'classification_income' || state === 'classification_expense') {
      helpText += `*מה אפשר לעשות:*\n`;
      helpText += `✅ כתוב שם קטגוריה (כמו "משכורת" או "מכולת")\n`;
      helpText += `⏭️ כתוב *"דלג"* - לדלג על תנועה\n`;
      helpText += `📋 כתוב *"רשימה"* - לראות קטגוריות אפשריות\n`;
    } else if (state === 'goals_setup' || state === 'goals') {
      helpText += `*מה אפשר לעשות:*\n`;
      helpText += `🎯 כתוב *"יעד חדש"* - ליצור יעד\n`;
      helpText += `📋 כתוב *"יעדים"* - לראות יעדים קיימים\n`;
      helpText += `✅ כתוב *"סיימתי"* - לעבור לשלב הבא\n`;
    } else if (state === 'monitoring') {
      helpText += `*מה אפשר לעשות:*\n`;
      helpText += `📊 *"סיכום"* - סיכום חודשי\n`;
      helpText += `📄 *שלח מסמך* - להוסיף דוח\n`;
      helpText += `🎯 *"יעדים"* - לראות יעדים\n`;
      helpText += `💰 *"תקציב"* - לראות תקציב\n`;
      helpText += `📈 *"תזרים"* - תחזית 3 חודשים\n`;
      helpText += `🏆 *"ציון"* - ציון בריאות פיננסית\n`;
      helpText += `📈 *"ניתוח"* - ניתוח התנהגות\n`;
    } else {
      helpText += `*פקודות כלליות:*\n`;
      helpText += `📄 שלח מסמך - להוסיף דוח\n`;
      helpText += `⏭️ *"דלג"* / *"נמשיך"* - לדלג קדימה\n`;
      helpText += `📊 *"סיכום"* - סיכום מצב\n`;
    }

    helpText += `\n💬 תמיד אפשר לכתוב *"עזרה"*`;

    await greenAPI.sendMessage({ phoneNumber: phone, message: helpText });
    return { success: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATE DISPATCH
  // ══════════════════════════════════════════════════════════════════════════

  if (state === 'start') {
    console.log(`[Router] DISPATCH: state=start → handleStart()`);
    const result = await handleStart(ctx, supabase, greenAPI);
    console.log(`[Router] RESULT: state=start, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  if (state === 'waiting_for_name') {
    console.log(`[Router] DISPATCH: state=waiting_for_name → handleWaitingForName()`);
    const result = await handleWaitingForName(ctx, msg, supabase, greenAPI);
    console.log(`[Router] RESULT: state=waiting_for_name, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  if (state === 'waiting_for_document') {
    console.log(`[Router] DISPATCH: state=waiting_for_document → handleWaitingForDocument()`);
    const result = await handleWaitingForDocument(ctx, msg, supabase, greenAPI, startClassification);
    console.log(`[Router] RESULT: state=waiting_for_document, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  if (state === 'classification') {
    console.log(`[Router] DISPATCH: state=classification → handleClassificationState()`);
    const result = await handleClassificationState(ctx, msg);
    console.log(`[Router] RESULT: state=classification, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  if (state === 'classification_income') {
    console.log(`[Router] DISPATCH: state=classification_income → handleClassificationResponse(type=income)`);
    const result = await handleClassificationResponse(ctx, msg, 'income');
    console.log(`[Router] RESULT: state=classification_income, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  if (state === 'classification_expense') {
    console.log(`[Router] DISPATCH: state=classification_expense → handleClassificationResponse(type=expense)`);
    const result = await handleClassificationResponse(ctx, msg, 'expense');
    console.log(`[Router] RESULT: state=classification_expense, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  if (state === 'behavior') {
    console.log(`[Router] DISPATCH: state=behavior → handleBehaviorPhase()`);
    const result = await handleBehaviorPhase(ctx, msg);
    console.log(`[Router] RESULT: state=behavior, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  if (state === 'goals_setup') {
    console.log(`[Router] DISPATCH: state=goals_setup → handleGoalsSetup()`);
    const result = await handleGoalsSetup(ctx, msg);
    console.log(`[Router] RESULT: state=goals_setup, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  if (state === 'goals') {
    console.log(`[Router] DISPATCH: state=goals → handleGoalsPhase()`);
    const result = await handleGoalsPhase(ctx, msg);
    console.log(`[Router] RESULT: state=goals, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  if (state === 'budget') {
    console.log(`[Router] DISPATCH: state=budget → handleBudgetPhase()`);
    const result = await handleBudgetPhase(ctx, msg);
    console.log(`[Router] RESULT: state=budget, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  if (state === 'loan_consolidation_offer') {
    console.log(`[Router] DISPATCH: state=loan_consolidation_offer → handleLoanConsolidationOffer()`);
    const result = await handleLoanConsolidationOffer(ctx, msg);
    console.log(`[Router] RESULT: state=loan_consolidation_offer, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  if (state === 'waiting_for_loan_docs') {
    console.log(`[Router] DISPATCH: state=waiting_for_loan_docs → handleWaitingForLoanDocs()`);
    const result = await handleWaitingForLoanDocs(ctx, msg);
    console.log(`[Router] RESULT: state=waiting_for_loan_docs, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  if (state === 'monitoring') {
    console.log(`[Router] DISPATCH: state=monitoring → handleMonitoring()`);
    const result = await handleMonitoring(ctx, msg, userName, startClassification);
    console.log(`[Router] RESULT: state=monitoring, success=${result.success}, newState=${result.newState || 'unchanged'}`);
    return result;
  }

  // Update conversation context on every message
  await updateContext(userId, { currentState: state as any, lastInteraction: new Date() });

  console.log(`[Router] NO_MATCH: state="${state}" did not match any handler. msg="${msg.substring(0, 50)}"`);
  return { success: false };
}

// ============================================================================
// Hooks (called by webhook and document processing)
// ============================================================================

export async function onClassificationComplete(userId: string, phone: string): Promise<void> {
  console.log(`[Router] HOOK: onClassificationComplete userId=${userId.substring(0,8)}...`);
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Check if user already has goals - if so, go to behavior; otherwise goals_setup
  const { data: existingGoals } = await supabase
    .from('goals')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);

  if (existingGoals && existingGoals.length > 0) {
    console.log(`[Router] TRANSITION: classification → behavior (has ${existingGoals.length} existing goals)`);
    await supabase
      .from('users')
      .update({
        onboarding_state: 'behavior',
        phase: 'behavior',
        phase_updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `🎉 *סיימנו לסווג!*\n\nעכשיו φ ינתח את דפוסי ההוצאות שלך.\n\nכתוב *"ניתוח"* להתחיל`,
    });
  } else {
    console.log(`[Router] TRANSITION: classification → goals_setup (no existing goals)`);
    await supabase
      .from('users')
      .update({
        onboarding_state: 'goals_setup',
        phase: 'goals',
        phase_updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `🎉 *סיימנו לסווג!*\n\nעכשיו בוא נגדיר יעדים פיננסיים 🎯\n\nכתוב *"יעד חדש"* או *"דלג"* לשלב הבא.`,
    });
  }
}

export async function onDocumentProcessed(userId: string, phone: string, documentId?: string): Promise<void> {
  console.log(`[Router] HOOK: onDocumentProcessed userId=${userId.substring(0,8)}..., docId=${documentId || 'none'}`);
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const { data: userData } = await supabase
    .from('users')
    .select('onboarding_state, classification_context')
    .eq('id', userId)
    .single();

  const wasWaitingForDocument = userData?.onboarding_state === 'waiting_for_document';

  const { data: latestDoc } = await supabase
    .from('uploaded_statements')
    .select('period_start, period_end, document_type, transactions_extracted')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Count pending transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, type, amount')
    .eq('user_id', userId)
    .eq('status', 'pending');

  const incomeCount = transactions?.filter(t => t.type === 'income').length || 0;
  const expenseCount = transactions?.filter(t => t.type === 'expense').length || 0;
  const totalIncome = transactions?.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0) || 0;
  const totalExpenses = transactions?.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0) || 0;

  console.log(`[Router] DOC_PROCESSED: wasWaiting=${wasWaitingForDocument}, incomeCount=${incomeCount}, expenseCount=${expenseCount}, totalIncome=${totalIncome}, totalExpenses=${totalExpenses}`);

  // If we were waiting for a document - start classification
  if (wasWaitingForDocument && (incomeCount > 0 || expenseCount > 0)) {
    console.log(`[Router] DOC_ACTION: starting interactive classification for ${incomeCount + expenseCount} pending transactions`);

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `✅ *קיבלתי את הדוח!*\n\n` +
        `📝 ${incomeCount + expenseCount} תנועות\n` +
        `💚 ${incomeCount} הכנסות (${totalIncome.toLocaleString('he-IL')} ₪)\n` +
        `💸 ${expenseCount} הוצאות (${totalExpenses.toLocaleString('he-IL')} ₪)\n\n` +
        `🎯 *בוא נעבור עליהן ביחד!*`,
    });

    await supabase
      .from('users')
      .update({ onboarding_state: 'classification' })
      .eq('id', userId);

    await startClassification({ userId, phone, state: 'classification' as any, userName: null });
    return;
  }

  // If it's a bank doc and not waiting - check for credit charges
  if (latestDoc?.document_type === 'bank' && !wasWaitingForDocument) {
    const { data: pendingCreditDocs } = await supabase
      .from('missing_documents')
      .select('id, card_last_4, expected_amount')
      .eq('user_id', userId)
      .eq('document_type', 'credit')
      .eq('status', 'pending')
      .order('priority', { ascending: false });

    if (pendingCreditDocs && pendingCreditDocs.length > 0) {
      let creditMsg = `📄 *הדוח התקבל!*\n\n`;
      creditMsg += `🔍 זיהיתי ${pendingCreditDocs.length} כרטיסי אשראי:\n`;
      pendingCreditDocs.forEach(doc => {
        creditMsg += `• כרטיס ${doc.card_last_4}: ₪${doc.expected_amount?.toLocaleString('he-IL') || '?'}\n`;
      });
      creditMsg += `\n📤 שלח את דוחות האשראי לפירוט מלא.`;

      await greenAPI.sendMessage({ phoneNumber: phone, message: creditMsg });
      return;
    }
  }

  // Default: send confirmation
  const txCount = (incomeCount + expenseCount);
  const docType = latestDoc?.document_type === 'credit' ? 'אשראי' : 'בנק';

  let confirmMsg = `✅ *דוח ${docType} התקבל!*\n\n`;
  if (txCount > 0) {
    confirmMsg += `📝 ${txCount} תנועות חדשות נוספו.\n`;
    confirmMsg += `כתוב *"נתחיל"* כדי לסווג אותן.`;
  } else {
    confirmMsg += `לא נמצאו תנועות חדשות בדוח.`;
  }

  await greenAPI.sendMessage({ phoneNumber: phone, message: confirmMsg });
}
