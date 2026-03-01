// @ts-nocheck

import type { RouterContext, RouterResult } from '../shared';
import { mergeGoalCreationContext } from '../shared';
import { parseStateIntent } from '@/lib/ai/state-intent';
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient, sendWhatsAppInteractiveButtons } from '@/lib/greenapi/client';
import { findBestMatch } from '@/lib/finance/categories';
import { findBestIncomeMatch } from '@/lib/finance/income-categories';

// ============================================================================
// Handle goals_setup state (first time goal creation after classification)
// ============================================================================

export async function handleGoalsSetup(ctx: RouterContext, msg: string): Promise<RouterResult> {
  console.log(`[Goals] ═══════════════════════════════════════`);
  console.log(`[Goals] handleGoalsSetup: userId=${ctx.userId.substring(0,8)}..., msg="${msg.substring(0, 80)}"`);
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;

  // Fetch current classification_context
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const classCtx = user?.classification_context || {};
  const advancedGoalCreation = classCtx.advancedGoalCreation;
  console.log(`[Goals] USER_CONTEXT (setup): advancedGoalCreation=${advancedGoalCreation ? JSON.stringify(advancedGoalCreation).substring(0, 200) : 'none'}, classCtx keys=${Object.keys(classCtx).join(',') || 'empty'}`);

  // --- Active advancedGoalCreation flow ---
  if (advancedGoalCreation) {
    console.log(`[Goals] SETUP_ACTIVE_FLOW: step=${advancedGoalCreation.step}, goalType=${advancedGoalCreation.goalType || 'none'}, goalName=${advancedGoalCreation.goalName || 'none'}, targetAmount=${advancedGoalCreation.targetAmount || 'none'}`);

    // ── AI Intent for cancel/skip detection ──
    const intent = await parseStateIntent(msg, 'goals_setup');
    console.log(`[Goals] AI_INTENT (setup): intent="${intent.intent}", confidence=${intent.confidence}`);

    // Cancel at any step
    if (intent.intent === 'cancel' && intent.confidence >= 0.6) {
      console.log(`[Goals] STEP_TRANSITION: ${advancedGoalCreation.step} → CANCELLED`);
      const { advancedGoalCreation: _removed, ...restCtx } = classCtx as any;
      await supabase
        .from('users')
        .update({ classification_context: Object.keys(restCtx).length > 0 ? restCtx : null })
        .eq('id', userId);

      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `✅ *בוטל*\n\nיצירת היעד בוטלה.\n\nכתוב *"יעד חדש"* אם תרצה להתחיל שוב.`,
      });
      return { success: true };
    }

    // Skip / finish → move on to loan detection
    if (intent.intent === 'skip' && intent.confidence >= 0.6) {
      console.log(`[Goals] STEP_TRANSITION: ${advancedGoalCreation.step} → SKIP/DONE (loan detection)`);
      const { advancedGoalCreation: _removed, ...restCtx } = classCtx as any;
      await supabase
        .from('users')
        .update({ classification_context: Object.keys(restCtx).length > 0 ? restCtx : null })
        .eq('id', userId);

      return await detectLoansFromClassifiedTransactions(ctx);
    }

    // Confirmation step — use AI to understand yes/no
    if (advancedGoalCreation.step === 'confirm') {
      console.log(`[Goals] CONFIRM_STEP: intent="${intent.intent}", context=`, JSON.stringify(advancedGoalCreation).substring(0, 300));
      const isAffirmative = ['new_goal', 'confirm'].includes(intent.intent) && intent.confidence >= 0.6;
      const isNegative = ['cancel', 'decline'].includes(intent.intent) && intent.confidence >= 0.6;

      if (isAffirmative) {
        console.log(`[Goals] STEP_TRANSITION: confirm → CREATE_GOAL`);
        const { createAdvancedGoal } = await import('../advanced-goals-handler');
        await createAdvancedGoal(userId, phone, advancedGoalCreation);
        return { success: true };
      } else if (isNegative) {
        const { advancedGoalCreation: _removed, ...restCtx } = classCtx as any;
        await supabase
          .from('users')
          .update({ classification_context: Object.keys(restCtx).length > 0 ? restCtx : null })
          .eq('id', userId);

        await greenAPI.sendMessage({
          phoneNumber: phone,
          message: `✅ *בוטל*\n\nיצירת היעד בוטלה.\n\nכתוב *"יעד חדש"* אם תרצה להוסיף יעד.`,
        });
        return { success: true };
      } else {
        await greenAPI.sendMessage({
          phoneNumber: phone,
          message: `❓ לא הבנתי.\n\n• כתוב *"כן"* לאישור\n• כתוב *"ביטול"* לביטול`,
        });
        return { success: true };
      }
    }

    // Child selection step
    if (advancedGoalCreation.step === 'child') {
      const { handleChildSelection } = await import('../advanced-goals-handler');
      await handleChildSelection(userId, phone, msg, advancedGoalCreation);
      return { success: true };
    }

    // Budget source step
    if (advancedGoalCreation.step === 'budget_source') {
      const { handleBudgetSourceSelection } = await import('../advanced-goals-handler');
      await handleBudgetSourceSelection(userId, phone, msg, advancedGoalCreation);
      return { success: true };
    }

    // Amount step
    if (advancedGoalCreation.step === 'amount') {
      const amount = parseGoalAmount(msg);
      console.log(`[Goals] AMOUNT_STEP (setup): input="${msg}", parsed=${amount}`);
      if (isNaN(amount) || amount <= 0) {
        console.log(`[Goals] AMOUNT_STEP: INVALID amount, staying on amount step`);
        await greenAPI.sendMessage({
          phoneNumber: phone,
          message: `❌ סכום לא תקין.\n\nדוגמאות: *15000*, *50 אלף*, *100K*`,
        });
        return { success: true };
      }

      // Move to deadline step
      console.log(`[Goals] STEP_TRANSITION: amount → deadline (amount=${amount})`);
      const updatedCtx = {
        ...advancedGoalCreation,
        step: 'deadline' as const,
        targetAmount: amount,
      };

      const { data: existingUser } = await supabase
        .from('users')
        .select('classification_context')
        .eq('id', userId)
        .single();
      const existing = existingUser?.classification_context || {};
      await supabase
        .from('users')
        .update({ classification_context: { ...existing, advancedGoalCreation: updatedCtx } })
        .eq('id', userId);

      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `📅 *מועד יעד*\n\nמתי תרצה להשיג את היעד?\n\nדוגמאות:\n• 31/12/2026\n• דצמבר 2026\n• עוד 6 חודשים\n• עוד שנה\n• *"אין"* - ללא מועד`,
      });
      return { success: true };
    }

    // Deadline step
    if (advancedGoalCreation.step === 'deadline') {
      const deadline = parseGoalDeadline(msg);
      console.log(`[Goals] DEADLINE_STEP (setup): input="${msg}", parsed=${deadline || 'null'}`);
      console.log(`[Goals] STEP_TRANSITION: deadline → confirm`);

      const updatedCtx = {
        ...advancedGoalCreation,
        step: 'confirm' as const,
        deadline,
      };

      const { data: existingUser } = await supabase
        .from('users')
        .select('classification_context')
        .eq('id', userId)
        .single();
      const existing = existingUser?.classification_context || {};
      await supabase
        .from('users')
        .update({ classification_context: { ...existing, advancedGoalCreation: updatedCtx } })
        .eq('id', userId);

      const { confirmAndCreateGoal } = await import('../advanced-goals-handler');
      await confirmAndCreateGoal(userId, phone, updatedCtx);
      return { success: true };
    }

    // All other steps → delegate to type selection handler
    console.log(`[Goals] SETUP_DELEGATE: step=${advancedGoalCreation.step} → handleAdvancedGoalTypeSelection`);
    const { handleAdvancedGoalTypeSelection } = await import('../advanced-goals-handler');
    await handleAdvancedGoalTypeSelection(userId, phone, msg);
    return { success: true };
  }

  // --- No active context ---
  console.log(`[Goals] SETUP_NO_ACTIVE_CONTEXT: checking commands for msg="${msg.substring(0, 40)}"`);

  // ── AI Intent ──
  const intent = await parseStateIntent(msg, 'goals_setup');
  console.log(`[Goals] AI_INTENT (setup/no-ctx): intent="${intent.intent}", confidence=${intent.confidence}`);

  if ((intent.intent === 'skip' || intent.intent === 'decline' || intent.intent === 'cancel') && intent.confidence >= 0.6) {
    return await detectLoansFromClassifiedTransactions(ctx);
  }

  if (intent.intent === 'new_goal' && intent.confidence >= 0.6) {
    const { startAdvancedGoal } = await import('../advanced-goals-handler');
    await startAdvancedGoal(userId, phone);
    return { success: true };
  }

  if (intent.intent === 'show_goals' && intent.confidence >= 0.6) {
    const { showGoalsWithAllocations } = await import('../goals-wa-handler');
    await showGoalsWithAllocations(ctx);
    return { success: true };
  }

  // Default → treat as type selection attempt
  const { handleAdvancedGoalTypeSelection } = await import('../advanced-goals-handler');
  await handleAdvancedGoalTypeSelection(userId, phone, msg);
  return { success: true };
}

// ============================================================================
// Handle goals state (ongoing goal management)
// ============================================================================

export async function handleGoalsPhase(ctx: RouterContext, msg: string): Promise<RouterResult> {
  console.log(`[Goals] ═══════════════════════════════════════`);
  console.log(`[Goals] handleGoalsPhase: userId=${ctx.userId.substring(0,8)}..., msg="${msg.substring(0, 80)}"`);
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;

  // Fetch classification_context
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const classCtx = user?.classification_context || {};
  console.log(`[Goals] USER_CONTEXT (phase): classCtx keys=${Object.keys(classCtx).join(',') || 'empty'}`);

  // --- advancedGoalCreation flow ---
  const advancedGoalCreation = classCtx.advancedGoalCreation;
  if (advancedGoalCreation) {
    console.log(`[Goals] PHASE_ACTIVE_FLOW: step=${advancedGoalCreation.step}, goalType=${advancedGoalCreation.goalType || 'none'}, goalName=${advancedGoalCreation.goalName || 'none'}, targetAmount=${advancedGoalCreation.targetAmount || 'none'}`);

    // ── AI Intent for cancel/skip/confirm ──
    const goalIntent = await parseStateIntent(msg, 'goals');
    console.log(`[Goals] AI_INTENT (phase/creation): intent="${goalIntent.intent}", confidence=${goalIntent.confidence}`);

    if (goalIntent.intent === 'cancel' && goalIntent.confidence >= 0.6) {
      const { advancedGoalCreation: _removed, ...restCtx } = classCtx as any;
      await supabase
        .from('users')
        .update({ classification_context: Object.keys(restCtx).length > 0 ? restCtx : null })
        .eq('id', userId);

      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `✅ *בוטל*\n\nיצירת היעד בוטלה.\n\nכתוב *"יעד חדש"* אם תרצה להוסיף יעד.`,
      });
      return { success: true };
    }

    switch (advancedGoalCreation.step) {
      case 'type': {
        console.log(`[Goals] PHASE_SWITCH: type → handleAdvancedGoalTypeSelection`);
        const { handleAdvancedGoalTypeSelection } = await import('../advanced-goals-handler');
        await handleAdvancedGoalTypeSelection(userId, phone, msg);
        return { success: true };
      }
      case 'child': {
        console.log(`[Goals] PHASE_SWITCH: child → handleChildSelection`);
        const { handleChildSelection } = await import('../advanced-goals-handler');
        await handleChildSelection(userId, phone, msg, advancedGoalCreation);
        return { success: true };
      }
      case 'amount': {
        const amount = parseFloat(msg.replace(/[^\d.]/g, ''));
        console.log(`[Goals] PHASE_AMOUNT: input="${msg}", parsed=${amount}`);
        if (isNaN(amount) || amount <= 0) {
          console.log(`[Goals] PHASE_AMOUNT: INVALID, staying on amount step`);
          await greenAPI.sendMessage({
            phoneNumber: phone,
            message: `❌ סכום לא תקין. כתוב מספר חיובי בשקלים.`,
          });
          return { success: true };
        }
        console.log(`[Goals] STEP_TRANSITION: amount → deadline (amount=${amount})`);
        const updatedCtx = { ...advancedGoalCreation, step: 'deadline' as const, targetAmount: amount };
        const { data: eu } = await supabase.from('users').select('classification_context').eq('id', userId).single();
        const ex = eu?.classification_context || {};
        await supabase.from('users').update({ classification_context: { ...ex, advancedGoalCreation: updatedCtx } }).eq('id', userId);
        await greenAPI.sendMessage({
          phoneNumber: phone,
          message: `📅 *מועד יעד*\n\nמתי תרצה להשיג את היעד?\n\nדוגמאות:\n• 31/12/2026\n• עוד 6 חודשים\n• עוד שנה\n• *"אין"* - ללא מועד`,
        });
        return { success: true };
      }
      case 'deadline': {
        const deadline = parseGoalDeadline(msg);
        console.log(`[Goals] PHASE_DEADLINE: input="${msg}", parsed=${deadline || 'null'}`);
        console.log(`[Goals] STEP_TRANSITION: deadline → confirm`);
        const updatedCtx = { ...advancedGoalCreation, step: 'confirm' as const, deadline };
        const { data: eu } = await supabase.from('users').select('classification_context').eq('id', userId).single();
        const ex = eu?.classification_context || {};
        await supabase.from('users').update({ classification_context: { ...ex, advancedGoalCreation: updatedCtx } }).eq('id', userId);
        const { confirmAndCreateGoal } = await import('../advanced-goals-handler');
        await confirmAndCreateGoal(userId, phone, updatedCtx);
        return { success: true };
      }
      case 'budget_source': {
        const { handleBudgetSourceSelection } = await import('../advanced-goals-handler');
        await handleBudgetSourceSelection(userId, phone, msg, advancedGoalCreation);
        return { success: true };
      }
      case 'confirm': {
        console.log(`[Goals] PHASE_CONFIRM: intent="${goalIntent.intent}", context=`, JSON.stringify(advancedGoalCreation).substring(0, 300));
        const isAffirmative = ['confirm', 'new_goal'].includes(goalIntent.intent) && goalIntent.confidence >= 0.6;
        const isNegative = ['cancel', 'decline'].includes(goalIntent.intent) && goalIntent.confidence >= 0.6;

        if (isAffirmative) {
          console.log(`[Goals] STEP_TRANSITION: confirm → CREATE_GOAL`);
          const { createAdvancedGoal } = await import('../advanced-goals-handler');
          await createAdvancedGoal(userId, phone, advancedGoalCreation);
        } else if (isNegative) {
          console.log(`[Goals] STEP_TRANSITION: confirm → CANCELLED`);
          const { advancedGoalCreation: _removed, ...restCtx } = classCtx as any;
          await supabase
            .from('users')
            .update({ classification_context: Object.keys(restCtx).length > 0 ? restCtx : null })
            .eq('id', userId);
          await greenAPI.sendMessage({
            phoneNumber: phone,
            message: `✅ *בוטל*\n\nיצירת היעד בוטלה.`,
          });
        } else {
          await greenAPI.sendMessage({
            phoneNumber: phone,
            message: `❓ לא הבנתי.\n\n• כתוב *"כן"* לאישור\n• כתוב *"ביטול"* לביטול`,
          });
        }
        return { success: true };
      }
      default: {
        const { handleAdvancedGoalTypeSelection } = await import('../advanced-goals-handler');
        await handleAdvancedGoalTypeSelection(userId, phone, msg);
        return { success: true };
      }
    }
  }

  // --- editGoal flow ---
  const editGoal = classCtx.editGoal;
  if (editGoal) {
    switch (editGoal.step) {
      case 'select_goal': {
        const { handleGoalSelection } = await import('../edit-goal-handler');
        await handleGoalSelection(userId, phone, msg, editGoal);
        return { success: true };
      }
      case 'select_action': {
        const { handleActionSelection } = await import('../edit-goal-handler');
        await handleActionSelection(userId, phone, msg, editGoal);
        return { success: true };
      }
      case 'edit_field': {
        const { handleFieldEdit } = await import('../edit-goal-handler');
        await handleFieldEdit(userId, phone, msg, editGoal);
        return { success: true };
      }
      case 'confirm_delete': {
        const { confirmGoalDeletion } = await import('../edit-goal-handler');
        await confirmGoalDeletion(userId, phone, msg, editGoal);
        return { success: true };
      }
      default:
        break;
    }
  }

  // --- autoAdjust flow ---
  const autoAdjust = classCtx.autoAdjust;
  if (autoAdjust?.pending) {
    const msgLower = msg.toLowerCase().trim();
    if (msgLower.includes('אשר') || msgLower === 'כן' || msgLower === 'yes') {
      const { confirmAndApplyAdjustments } = await import('../../goals/auto-adjust-handler');
      await confirmAndApplyAdjustments(userId, phone);
      return { success: true };
    } else if (msgLower.includes('ביטול') || msgLower === 'לא' || msgLower === 'no') {
      const { cancelAdjustments } = await import('../../goals/auto-adjust-handler');
      await cancelAdjustments(userId, phone);
      return { success: true };
    } else if (msgLower.includes('פרטים') || msgLower.includes('detail')) {
      // Show more details about the adjustment plan
      const plan = autoAdjust.plan;
      let details = `📊 *פרטי ההתאמה*\n\n`;
      if (plan?.adjustments) {
        for (const adj of plan.adjustments) {
          const sign = adj.changeAmount > 0 ? '+' : '';
          details += `• *${adj.goalName}*: ${sign}${adj.changeAmount.toLocaleString('he-IL')} ₪\n  ${adj.reason}\n`;
        }
      }
      details += `\n*אשר* לאישור | *ביטול* לביטול`;
      await greenAPI.sendMessage({ phoneNumber: phone, message: details });
      return { success: true };
    }
    // Fall through to regular handling if not a recognized response
  }

  // ── Layer 0: Button IDs (instant) ──
  const goalButtonActions: Record<string, string> = {
    'new_goal': 'new_goal',
    'show_goals': 'show_goals',
    'finish_goals': 'finish',
    'simulate': 'simulate',
    'optimize': 'optimize',
  };
  const buttonIntent = goalButtonActions[msg.trim()];

  // --- Legacy goalCreation context routing ---
  const goalCreation = classCtx.goalCreation;
  if (!buttonIntent && goalCreation) {
    switch (goalCreation.step) {
      case 'type':
        return await handleGoalTypeSelection(ctx, msg);
      case 'name':
        return await handleGoalNameInput(ctx, msg);
      case 'amount':
        return await handleGoalAmountInput(ctx, msg);
      case 'deadline':
        return await handleGoalDeadlineInput(ctx, msg);
      case 'confirm':
        return await handleGoalConfirmation(ctx, msg);
      default:
        break;
    }
  }

  // ── Layer 0: Numbers 1-4 → goal type selection ──
  if (['1', '2', '3', '4'].includes(msg.trim())) {
    const { data: goalPhaseUser } = await supabase
      .from('users')
      .select('classification_context')
      .eq('id', userId)
      .single();

    const existingGoalCtx = goalPhaseUser?.classification_context || {};
    await supabase
      .from('users')
      .update({
        classification_context: {
          ...existingGoalCtx,
          goalCreation: { step: 'type' },
        },
      })
      .eq('id', userId);

    return await handleGoalTypeSelection(ctx, msg);
  }

  // ── Layer 1: AI Intent ──
  const intent = buttonIntent
    ? { intent: buttonIntent, confidence: 1.0, params: {} }
    : await parseStateIntent(msg, 'goals');
  console.log(`[Goals] AI_INTENT (phase): intent="${intent.intent}", confidence=${intent.confidence}`);

  if (intent.intent === 'new_goal' && intent.confidence >= 0.6) {
    const { startAdvancedGoal } = await import('../advanced-goals-handler');
    await startAdvancedGoal(userId, phone);
    return { success: true };
  }

  if (intent.intent === 'edit_goal' && intent.confidence >= 0.6) {
    const { startEditGoal } = await import('../edit-goal-handler');
    await startEditGoal(userId, phone);
    return { success: true };
  }

  if (intent.intent === 'show_goals' && intent.confidence >= 0.6) {
    const { showGoalsWithAllocations } = await import('../goals-wa-handler');
    await showGoalsWithAllocations(ctx);
    return { success: true };
  }

  if (intent.intent === 'simulate' && intent.confidence >= 0.6) {
    const { runSimulation } = await import('../goals-wa-handler');
    await runSimulation(ctx);
    return { success: true };
  }

  if (intent.intent === 'optimize' && intent.confidence >= 0.6) {
    const { runOptimization } = await import('../goals-wa-handler');
    await runOptimization(ctx);
    return { success: true };
  }

  if (intent.intent === 'confirm' && intent.confidence >= 0.6) {
    if (classCtx.optimization?.pending) {
      const { confirmOptimization } = await import('../goals-wa-handler');
      await confirmOptimization(ctx);
      return { success: true };
    }
  }

  if (intent.intent === 'next_phase' && intent.confidence >= 0.6) {
    const { transitionToBudget } = await import('./budget');
    return await transitionToBudget(ctx);
  }

  if (intent.intent === 'finish' && intent.confidence >= 0.6) {
    return await finishGoalsSetting(ctx);
  }

  if (intent.intent === 'help') {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message:
        `🎯 *שלב 3: ניהול יעדים*\n\n` +
        `*מה אני יכול לעשות:*\n` +
        `• *יעד חדש* - הוסף יעד חדש\n` +
        `• *יעדים* - הצג יעדים + הקצאות מחושבות\n` +
        `• *עריכה* - ערוך או מחק יעד\n` +
        `• *סימולציה* - בדוק תרחישי "מה יקרה אם"\n` +
        `• *אופטימיזציה* - קבל המלצות\n` +
        `• *סיימתי* - סיום והמשך לתקציב`,
    });
    return { success: true };
  }

  // --- Default: show action buttons ---
  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `🎯 *ניהול יעדים*\n\nמה תרצה לעשות?`,
  });

  try {
    await sendWhatsAppInteractiveButtons({
      phoneNumber: phone,
      message: 'בחר פעולה:',
      buttons: [
        { buttonId: 'new_goal', buttonText: '➕ יעד חדש' },
        { buttonId: 'show_goals', buttonText: '📊 הצג יעדים' },
        { buttonId: 'finish_goals', buttonText: '✅ סיימתי' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message:
        `• *"יעד חדש"* - הוסף יעד\n` +
        `• *"יעדים"* - ראה יעדים\n` +
        `• *"סיימתי"* - המשך לתקציב`,
    });
  }

  return { success: true };
}

// ============================================================================
// Start new goal creation flow
// ============================================================================

export async function startNewGoal(ctx: RouterContext): Promise<RouterResult> {
  const { startAdvancedGoal } = await import('../advanced-goals-handler');
  await startAdvancedGoal(ctx.userId, ctx.phone);
  return { success: true };
}

// ============================================================================
// Handle goal type selection (1-4 / text)
// ============================================================================

export async function handleGoalTypeSelection(ctx: RouterContext, msg: string): Promise<RouterResult> {
  console.log(`[Goals] handleGoalTypeSelection: msg="${msg}"`);
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;
  const msgLower = msg.toLowerCase().trim();

  let goalType: string;
  let goalName: string;
  let autoTarget: number | null = null;

  if (msg === '1' || msgLower.includes('קרן חירום') || msgLower.includes('חירום')) {
    goalType = 'emergency_fund';
    goalName = 'קרן חירום';
  } else if (msg === '2' || msgLower.includes('חובות') || msgLower.includes('debt')) {
    goalType = 'debt_payoff';
    goalName = 'סגירת חובות';
  } else if (msg === '3' || msgLower.includes('חיסכון')) {
    goalType = 'savings_goal';
    goalName = 'חיסכון למטרה';
    // For savings, ask for a name first
    await mergeGoalCreationContext(userId, { step: 'name', goalType });
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `🎯 *חיסכון למטרה*\n\nמה שם היעד?\n\nדוגמה: "חופשה", "רכב", "שיפוצים"`,
    });
    return { success: true };
  } else if (msg === '4' || msgLower.includes('שיפור') || msgLower.includes('איזון')) {
    goalType = 'general_improvement';
    goalName = 'שיפור תקציבי';
  } else {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❌ לא הבנתי. כתוב מספר 1-4:\n\n1️⃣ קרן חירום\n2️⃣ סגירת חובות\n3️⃣ חיסכון\n4️⃣ שיפור כללי`,
    });
    return { success: true };
  }

  // For emergency_fund: auto-calculate target from 3 months expenses
  if (goalType === 'emergency_fund') {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateFilter = threeMonthsAgo.toISOString().split('T')[0];

    const { data: expenses } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .eq('status', 'confirmed')
      .gte('tx_date', dateFilter);

    const totalExpenses = (expenses || []).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const monthlyExpenses = totalExpenses / 3;
    autoTarget = Math.round(monthlyExpenses * 3);
  }

  // Save to goalCreation context and ask for amount
  await mergeGoalCreationContext(userId, {
    step: 'amount',
    goalType,
    goalName,
    ...(autoTarget ? { suggestedAmount: autoTarget } : {}),
  });

  const emoji = goalType === 'emergency_fund' ? '🛡️' : goalType === 'debt_payoff' ? '💳' : '⚖️';
  let amountMsg = `${emoji} *${goalName}*\n\n`;
  if (autoTarget) {
    amountMsg += `💡 המלצה: ${autoTarget.toLocaleString('he-IL')} ₪ (3 חודשי הוצאות)\n\n`;
  }
  amountMsg += `כמה כסף צריך ליעד הזה?\n(כתוב סכום בשקלים)`;

  await greenAPI.sendMessage({ phoneNumber: phone, message: amountMsg });
  return { success: true };
}

// ============================================================================
// Handle name input
// ============================================================================

export async function handleGoalNameInput(ctx: RouterContext, msg: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;

  const name = msg.trim();
  if (!name || name.length < 2) {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❌ שם לא תקין. כתוב שם קצר ליעד שלך.`,
    });
    return { success: true };
  }

  await mergeGoalCreationContext(userId, {
    ...(await getGoalCreationCtx(userId)),
    step: 'amount',
    goalName: name,
  });

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `🎯 *${name}*\n\nכמה כסף צריך ליעד הזה?\n(כתוב סכום בשקלים)`,
  });

  return { success: true };
}

// ============================================================================
// Handle amount input
// ============================================================================

export async function handleGoalAmountInput(ctx: RouterContext, msg: string): Promise<RouterResult> {
  console.log(`[Goals] handleGoalAmountInput: msg="${msg}"`);
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;

  const amount = parseGoalAmount(msg);
  console.log(`[Goals] LEGACY_AMOUNT: input="${msg}", parsed=${amount}`);
  if (isNaN(amount) || amount <= 0) {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❌ סכום לא תקין.\n\nדוגמאות: *15000*, *50 אלף*, *100K*`,
    });
    return { success: true };
  }

  const currentCtx = await getGoalCreationCtx(userId);
  await mergeGoalCreationContext(userId, {
    ...currentCtx,
    step: 'deadline',
    targetAmount: amount,
  });

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message:
      `📅 *מועד יעד*\n\n` +
      `מתי תרצה להשיג את היעד?\n\n` +
      `דוגמאות:\n` +
      `• 31/12/2026\n` +
      `• עוד 6 חודשים\n` +
      `• עוד שנה\n` +
      `• *"אין"* - ללא מועד קבוע`,
  });

  return { success: true };
}

// ============================================================================
// Handle deadline input
// ============================================================================

export async function handleGoalDeadlineInput(ctx: RouterContext, msg: string): Promise<RouterResult> {
  console.log(`[Goals] handleGoalDeadlineInput: msg="${msg}"`);
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;

  const deadline = parseGoalDeadline(msg);
  console.log(`[Goals] LEGACY_DEADLINE: input="${msg}", parsed=${deadline || 'null'}`);

  const currentCtx = await getGoalCreationCtx(userId);
  const updatedCtx = { ...currentCtx, step: 'confirm', deadline };
  await mergeGoalCreationContext(userId, updatedCtx);

  // Show confirmation
  const emoji = currentCtx.goalType === 'emergency_fund' ? '🛡️'
    : currentCtx.goalType === 'debt_payoff' ? '💳'
    : currentCtx.goalType === 'savings_goal' ? '🎯'
    : '⚖️';

  let confirmMsg = `${emoji} *אישור יעד*\n\n`;
  confirmMsg += `📝 *שם:* ${currentCtx.goalName}\n`;
  confirmMsg += `💰 *סכום:* ${(currentCtx.targetAmount || 0).toLocaleString('he-IL')} ₪\n`;
  if (deadline) {
    const deadlineDate = new Date(deadline);
    confirmMsg += `📅 *מועד:* ${deadlineDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })}\n`;
  } else {
    confirmMsg += `📅 *מועד:* ללא הגבלת זמן\n`;
  }
  confirmMsg += `\n✅ כתוב *"כן"* לאישור\n❌ כתוב *"לא"* לביטול`;

  await greenAPI.sendMessage({ phoneNumber: phone, message: confirmMsg });
  return { success: true };
}

// ============================================================================
// Handle confirmation
// ============================================================================

export async function handleGoalConfirmation(ctx: RouterContext, msg: string): Promise<RouterResult> {
  console.log(`[Goals] handleGoalConfirmation: msg="${msg}"`);
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;
  const msgLower = msg.toLowerCase().trim();

  const currentCtx = await getGoalCreationCtx(userId);
  console.log(`[Goals] LEGACY_CONFIRM: msgLower="${msgLower}", context=`, JSON.stringify(currentCtx).substring(0, 300));

  if (msgLower === 'כן' || msgLower === 'yes' || msgLower.includes('אשר')) {
    // Validate required fields
    const goalName = currentCtx.goalName || currentCtx.goalType || 'יעד חדש';
    const targetAmount = currentCtx.targetAmount || 0;

    if (targetAmount <= 0) {
      console.error('[Goals State] Missing targetAmount in context:', currentCtx);
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `❌ חסר סכום יעד. כתוב *"יעד חדש"* להתחיל שוב.`,
      });
      return { success: true };
    }

    // Build payload with only defined fields
    const insertPayload: Record<string, any> = {
      user_id: userId,
      name: goalName,
      target_amount: targetAmount,
      current_amount: 0,
      priority: 5,
      status: 'active',
      is_flexible: true,
      min_allocation: 0,
      monthly_allocation: 0,
      auto_adjust: true,
    };
    if (currentCtx.goalType) insertPayload.goal_type = currentCtx.goalType;
    if (currentCtx.deadline) insertPayload.deadline = currentCtx.deadline;

    console.log(`[Goals] DB_INSERT: table=goals, payload=`, JSON.stringify(insertPayload).substring(0, 500));
    const { data: insertData, error } = await supabase.from('goals').insert(insertPayload).select('id').single();
    console.log(`[Goals] DB_RESULT: success=${!error}, id=${insertData?.id || 'none'}, error=${error?.message || 'none'}`);

    if (error) {
      console.error('[Goals State] Error creating goal:', error, 'payload:', JSON.stringify(insertPayload));
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `❌ שגיאה בשמירת היעד.\n\nפרטים: ${error.message || 'שגיאת מסד נתונים'}\n\nכתוב *"יעד חדש"* לנסות שוב.`,
      });
      return { success: true };
    }

    // Clean goalCreation from context
    const { data: ctxUser } = await supabase.from('users').select('classification_context').eq('id', userId).single();
    const ctxData = ctxUser?.classification_context || {};
    const { goalCreation: _removed, ...restCtx } = ctxData as any;
    await supabase
      .from('users')
      .update({ classification_context: Object.keys(restCtx).length > 0 ? restCtx : null })
      .eq('id', userId);

    const emoji = currentCtx.goalType === 'emergency_fund' ? '🛡️'
      : currentCtx.goalType === 'debt_payoff' ? '💳'
      : currentCtx.goalType === 'savings_goal' ? '🎯'
      : '⚖️';

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message:
        `✅ *נוצר בהצלחה!*\n\n` +
        `${emoji} *${currentCtx.goalName}*\n` +
        `💰 ${(currentCtx.targetAmount || 0).toLocaleString('he-IL')} ₪\n\n` +
        `רוצה להוסיף עוד יעד?\n\n` +
        `• *"כן"* / *"יעד חדש"* - הוסף יעד נוסף\n` +
        `• *"סיימתי"* - המשך לתקציב`,
    });
    return { success: true };
  } else if (msgLower === 'לא' || msgLower === 'no' || msgLower.includes('ביטול')) {
    // Cancel - clean goalCreation context
    const { data: ctxUser } = await supabase.from('users').select('classification_context').eq('id', userId).single();
    const ctxData = ctxUser?.classification_context || {};
    const { goalCreation: _removed, ...restCtx } = ctxData as any;
    await supabase
      .from('users')
      .update({ classification_context: Object.keys(restCtx).length > 0 ? restCtx : null })
      .eq('id', userId);

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `✅ בוטל.\n\n• *"יעד חדש"* - נסה שוב\n• *"סיימתי"* - המשך לתקציב`,
    });
    return { success: true };
  } else {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❓ לא הבנתי.\n\n• כתוב *"כן"* לאישור\n• כתוב *"לא"* לביטול`,
    });
    return { success: true };
  }
}

// ============================================================================
// Show all active goals with progress
// ============================================================================

export async function showUserGoals(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;

  const { data: goals, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('priority', { ascending: true });

  if (error || !goals || goals.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message:
        `🎯 *היעדים שלך*\n\n` +
        `אין עדיין יעדים מוגדרים.\n\n` +
        `כתוב *"יעד חדש"* להתחיל`,
    });
    return { success: true };
  }

  let message = `🎯 *היעדים שלך*\n\n`;

  for (let i = 0; i < goals.length; i++) {
    const goal = goals[i];
    const progress = goal.target_amount > 0
      ? Math.round((goal.current_amount / goal.target_amount) * 100)
      : 0;

    const filledBars = Math.round(progress / 10);
    const progressBar = '▓'.repeat(filledBars) + '░'.repeat(10 - filledBars);
    const emoji = i === 0 ? '1️⃣' : i === 1 ? '2️⃣' : i === 2 ? '3️⃣' : i === 3 ? '4️⃣' : `${i + 1}.`;

    message += `${emoji} *${goal.name}*\n`;
    message += `   ${progressBar} ${progress}%\n`;
    message += `   ${goal.current_amount.toLocaleString('he-IL')} / ${goal.target_amount.toLocaleString('he-IL')} ₪\n`;

    if (goal.deadline) {
      const deadlineDate = new Date(goal.deadline);
      const now = new Date();
      const monthsLeft = Math.max(
        0,
        Math.round((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
      );
      if (monthsLeft > 0) {
        message += `   📅 עוד ${monthsLeft} חודשים\n`;
      } else {
        message += `   📅 ${deadlineDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })}\n`;
      }
    }

    if (goal.monthly_allocation && goal.monthly_allocation > 0) {
      message += `   💸 הקצאה: ${goal.monthly_allocation.toLocaleString('he-IL')} ₪/חודש\n`;
    }

    message += `\n`;
  }

  message += `• *"יעד חדש"* - הוסף יעד\n`;
  message += `• *"עריכה"* - ערוך יעד\n`;
  message += `• *"סיימתי"* - המשך לתקציב`;

  await greenAPI.sendMessage({ phoneNumber: phone, message });
  return { success: true };
}

// ============================================================================
// Finish goals setting → move to budget
// ============================================================================

export async function finishGoalsSetting(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;

  // Count active goals
  const { count } = await supabase
    .from('goals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  const goalCount = count || 0;

  // Update state to budget
  await supabase
    .from('users')
    .update({
      onboarding_state: 'budget',
      current_phase: 'budget',
      phase: 'budget',
      phase_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  // Send summary
  let summaryMsg = `✅ *סיכום יעדים*\n\n`;
  if (goalCount > 0) {
    summaryMsg += `הגדרת ${goalCount} יעד${goalCount > 1 ? 'ות' : ''} 🎯\n\n`;
  } else {
    summaryMsg += `לא הגדרת יעדים בשלב זה.\nתוכל להוסיף יעדים בכל עת.\n\n`;
  }
  summaryMsg += `עכשיו נבנה את התקציב שלך! 💰`;

  await greenAPI.sendMessage({ phoneNumber: phone, message: summaryMsg });

  // Transition to budget
  const { transitionToBudget } = await import('./budget');
  return await transitionToBudget(ctx);
}

// ============================================================================
// Detect loan patterns from classified transactions, offer consolidation
// ============================================================================

export async function detectLoansFromClassifiedTransactions(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;

  console.log(`🔍 [Goals State] Looking for loans in classified transactions for user ${userId}`);

  // Find all transactions classified as loans or mortgage (confirmed only)
  const { data: loanTransactions } = await supabase
    .from('transactions')
    .select('id, amount, vendor, category, expense_category, tx_date')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .eq('type', 'expense')
    .or(
      'expense_category.ilike.%הלוואה%,' +
      'expense_category.ilike.%משכנתא%,' +
      'category.ilike.%הלוואה%,' +
      'category.ilike.%משכנתא%'
    );

  console.log(`💰 [Goals State] Found ${loanTransactions?.length || 0} loan payment transactions`);

  if (!loanTransactions || loanTransactions.length === 0) {
    // No loans → move to final summary (behavior/monitoring)
    console.log(`✅ [Goals State] No loans detected - moving to final summary`);
    return await showFinalSummaryAndMonitoring(ctx);
  }

  // Group by vendor (each vendor = one loan)
  const loansByVendor = new Map<string, typeof loanTransactions>();
  loanTransactions.forEach((tx) => {
    const vendor = tx.vendor;
    if (!loansByVendor.has(vendor)) {
      loansByVendor.set(vendor, []);
    }
    loansByVendor.get(vendor)!.push(tx);
  });

  // Calculate total monthly payments (average per vendor)
  const totalMonthly = Array.from(loansByVendor.values())
    .map((txs) => {
      const sum = txs.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      return sum / txs.length;
    })
    .reduce((sum, avg) => sum + avg, 0);

  const loanCount = loansByVendor.size;

  console.log(`💰 [Goals State] Detected ${loanCount} loans with total monthly payment of ${totalMonthly.toFixed(2)} ₪`);

  // Build loans list
  const loansList = Array.from(loansByVendor.entries())
    .map(([vendor, txs]) => {
      const avgPayment = txs.reduce((s, t) => s + Math.abs(Number(t.amount)), 0) / txs.length;
      return `• ${vendor}: ${avgPayment.toLocaleString('he-IL')} ₪/חודש`;
    })
    .join('\n');

  // Send consolidation offer
  if (loanCount === 1) {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message:
        `💳 *שמתי לב שיש לך הלוואה*\n\n` +
        `${loansList}\n\n` +
        `🎯 *גדי, היועץ הפיננסי שלנו, יכול לבדוק אם יש אפשרות לריבית טובה יותר!*\n\n` +
        `זה יכול לחסוך לך כסף 💸\n\n` +
        `מעוניין? (כן/לא)`,
    });
  } else {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message:
        `💳 *שמתי לב שיש לך ${loanCount} הלוואות!*\n\n` +
        `${loansList}\n\n` +
        `💰 סה"כ תשלום חודשי: ${totalMonthly.toLocaleString('he-IL')} ₪\n\n` +
        `💡 *איחוד הלוואות יכול לחסוך לך כסף* - הפחתת ריבית וניהול קל יותר.\n\n` +
        `🎯 גדי, היועץ הפיננסי שלנו, יכול לבדוק את האפשרויות שלך בחינם!\n\n` +
        `מעוניין? (כן/לא)`,
    });
  }

  // Merge loan consolidation context (don't overwrite other keys)
  const { data: existingUser } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const existingContext = existingUser?.classification_context || {};

  await supabase
    .from('users')
    .update({
      onboarding_state: 'loan_consolidation_offer',
      classification_context: {
        ...existingContext,
        loanConsolidation: {
          pending: true,
          count: loanCount,
          total_monthly: totalMonthly,
          loans: Array.from(loansByVendor.keys()),
        },
      },
    })
    .eq('id', userId);

  return { success: true, newState: 'loan_consolidation_offer' };
}

// ============================================================================
// Transition to goals_setup after classification
// ============================================================================

export async function moveToGoalsSetup(ctx: RouterContext): Promise<RouterResult> {
  console.log(`[Goals] ═══════════════════════════════════════`);
  console.log(`[Goals] moveToGoalsSetup: userId=${ctx.userId.substring(0,8)}...`);
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;

  // Calculate confirmed totals
  const { data: confirmed } = await supabase
    .from('transactions')
    .select('amount, type, category')
    .eq('user_id', userId)
    .eq('status', 'confirmed');

  const totalIncome = (confirmed || [])
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalExpenses = (confirmed || [])
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const balance = totalIncome - totalExpenses;
  const balanceEmoji = balance >= 0 ? '✨' : '📉';

  // Update state
  await supabase
    .from('users')
    .update({
      onboarding_state: 'goals_setup',
      phase: 'goals',
      current_phase: 'goals',
      phase_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  // Send summary
  await greenAPI.sendMessage({
    phoneNumber: phone,
    message:
      `🎉 *סיימנו את הסיווג!*\n\n` +
      `📊 *הסיכום שלך:*\n` +
      `💚 הכנסות: ${totalIncome.toLocaleString('he-IL')} ₪\n` +
      `💸 הוצאות: ${totalExpenses.toLocaleString('he-IL')} ₪\n` +
      `${balanceEmoji} יתרה: ${balance.toLocaleString('he-IL')} ₪\n\n` +
      `🎯 *עכשיו בוא נגדיר מטרות!*`,
  });

  // Start advanced goal creation flow
  const { startAdvancedGoal } = await import('../advanced-goals-handler');
  await startAdvancedGoal(userId, phone);

  return { success: true, newState: 'goals_setup' };
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * 🆕 Parse amount from Hebrew text - handles K, אלף, commas, currency symbols
 */
function parseGoalAmount(msg: string): number {
  console.log(`[Goals] PARSE_AMOUNT: raw input="${msg}"`);
  // Remove currency symbols and whitespace
  let cleaned = msg.replace(/[₪ש״ח]/g, '').replace(/שקל(ים)?/g, '').trim();
  console.log(`[Goals] PARSE_AMOUNT: cleaned="${cleaned}"`);

  // Handle "X אלף" (X thousand)
  const elefMatch = cleaned.match(/(\d[\d,.]*)\s*אלף/);
  if (elefMatch) {
    const result = parseFloat(elefMatch[1].replace(/,/g, '')) * 1000;
    console.log(`[Goals] PARSE_AMOUNT: input="${msg}", parsed=${result} (אלף match)`);
    return result;
  }

  // Handle "Xk" or "XK"
  const kMatch = cleaned.match(/(\d[\d,.]*)\s*[kK]/);
  if (kMatch) {
    const result = parseFloat(kMatch[1].replace(/,/g, '')) * 1000;
    console.log(`[Goals] PARSE_AMOUNT: input="${msg}", parsed=${result} (K match)`);
    return result;
  }

  // Handle "X מיליון" (X million)
  const milMatch = cleaned.match(/(\d[\d,.]*)\s*מיליון/);
  if (milMatch) {
    const result = parseFloat(milMatch[1].replace(/,/g, '')) * 1000000;
    console.log(`[Goals] PARSE_AMOUNT: input="${msg}", parsed=${result} (מיליון match)`);
    return result;
  }

  // Standard number with possible commas
  const numMatch = cleaned.match(/(\d[\d,.]*)/);
  if (numMatch) {
    const result = parseFloat(numMatch[1].replace(/,/g, ''));
    console.log(`[Goals] PARSE_AMOUNT: input="${msg}", parsed=${result} (standard number)`);
    return result;
  }

  console.log(`[Goals] PARSE_AMOUNT: input="${msg}", parsed=NaN (no match)`);
  return NaN;
}

/**
 * 🆕 Parse deadline from Hebrew text
 */
function parseGoalDeadline(msg: string): string | null {
  console.log(`[Goals] PARSE_DEADLINE: raw input="${msg}"`);
  const msgLower = msg.toLowerCase().trim();

  // "אין" / "ללא" / "no"
  if (/^(אין|ללא|no|none|לא|בלי)$/i.test(msgLower)) {
    console.log(`[Goals] PARSE_DEADLINE: input="${msg}", parsed=null (no deadline requested)`);
    return null;
  }

  // "עוד X חודשים/שנים"
  const relativeMatch = msg.match(/(?:עוד|בעוד|תוך)\s+(\d+)\s*(חודשים?|שנים?|שנה)/);
  if (relativeMatch) {
    const num = parseInt(relativeMatch[1]);
    const d = new Date();
    if (relativeMatch[2].includes('שנ')) {
      d.setFullYear(d.getFullYear() + num);
    } else {
      d.setMonth(d.getMonth() + num);
    }
    const result = d.toISOString().split('T')[0];
    console.log(`[Goals] PARSE_DEADLINE: input="${msg}", parsed=${result} (relative: ${num} ${relativeMatch[2]})`);
    return result;
  }

  // "עוד שנה" without number
  if (/עוד שנה/.test(msgLower)) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    const result = d.toISOString().split('T')[0];
    console.log(`[Goals] PARSE_DEADLINE: input="${msg}", parsed=${result} (עוד שנה)`);
    return result;
  }

  // "עוד חצי שנה"
  if (/חצי שנה/.test(msgLower)) {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    const result = d.toISOString().split('T')[0];
    console.log(`[Goals] PARSE_DEADLINE: input="${msg}", parsed=${result} (חצי שנה)`);
    return result;
  }

  // Hebrew month names
  const hebrewMonths: Record<string, number> = {
    'ינואר': 0, 'פברואר': 1, 'מרץ': 2, 'אפריל': 3,
    'מאי': 4, 'יוני': 5, 'יולי': 6, 'אוגוסט': 7,
    'ספטמבר': 8, 'אוקטובר': 9, 'נובמבר': 10, 'דצמבר': 11,
  };

  for (const [monthName, monthNum] of Object.entries(hebrewMonths)) {
    if (msgLower.includes(monthName)) {
      const yearMatch = msg.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
      const d = new Date(year, monthNum, 1);
      // If date is in the past, push to next year
      if (d < new Date()) d.setFullYear(d.getFullYear() + 1);
      const result = d.toISOString().split('T')[0];
      console.log(`[Goals] PARSE_DEADLINE: input="${msg}", parsed=${result} (Hebrew month: ${monthName} ${year})`);
      return result;
    }
  }

  // "סוף השנה"
  if (/סוף (ה)?שנה/.test(msgLower)) {
    const result = `${new Date().getFullYear()}-12-31`;
    console.log(`[Goals] PARSE_DEADLINE: input="${msg}", parsed=${result} (סוף השנה)`);
    return result;
  }

  // DD/MM/YYYY or DD.MM.YYYY
  const ddmmyyyy = msg.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (ddmmyyyy) {
    const d = new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
    if (!isNaN(d.getTime())) {
      const result = d.toISOString().split('T')[0];
      console.log(`[Goals] PARSE_DEADLINE: input="${msg}", parsed=${result} (DD/MM/YYYY)`);
      return result;
    }
  }

  // Generic date parse
  const parsed = new Date(msg);
  if (!isNaN(parsed.getTime())) {
    const result = parsed.toISOString().split('T')[0];
    console.log(`[Goals] PARSE_DEADLINE: input="${msg}", parsed=${result} (generic Date parse)`);
    return result;
  }

  console.log(`[Goals] PARSE_DEADLINE: input="${msg}", parsed=null (no match found)`);
  return null;
}

/**
 * Get the current goalCreation context for a user
 */
async function getGoalCreationCtx(userId: string): Promise<Record<string, any>> {
  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();
  return user?.classification_context?.goalCreation || {};
}

/**
 * After no loans found → transition to behavior/monitoring phase as final summary
 */
async function showFinalSummaryAndMonitoring(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const { userId, phone } = ctx;

  // Update state to monitoring (final phase)
  await supabase
    .from('users')
    .update({
      onboarding_state: 'monitoring',
      phase: 'monitoring',
      phase_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  // Calculate summary
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const dateFilter = threeMonthsAgo.toISOString().split('T')[0];

  const { data: confirmed } = await supabase
    .from('transactions')
    .select('amount, type, category')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .gte('tx_date', dateFilter);

  const totalIncome = (confirmed || [])
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalExpenses = (confirmed || [])
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const balance = totalIncome - totalExpenses;
  const balanceEmoji = balance >= 0 ? '✨' : '📉';

  // Top categories
  const categoryTotals: Record<string, number> = {};
  (confirmed || [])
    .filter((t) => t.type === 'expense' && t.category)
    .forEach((t) => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
    });

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  let message =
    `🎉 *סיימנו את ההגדרה הראשונית!*\n\n` +
    `📊 *סיכום 3 חודשים אחרונים:*\n` +
    `💚 הכנסות: ${totalIncome.toLocaleString('he-IL')} ₪\n` +
    `💸 הוצאות: ${totalExpenses.toLocaleString('he-IL')} ₪\n` +
    `${balanceEmoji} יתרה: ${balance.toLocaleString('he-IL')} ₪\n\n`;

  if (topCategories.length > 0) {
    message += `📌 *הוצאות עיקריות:*\n`;
    topCategories.forEach(([cat, amount]) => {
      message += `• ${cat}: ${amount.toLocaleString('he-IL')} ₪\n`;
    });
    message += `\n`;
  }

  message +=
    `✅ *φ Phi מוכן לעזור לך!*\n\n` +
    `אשלח לך תזכורות ועדכונים שבועיים.\n` +
    `תוכל לשאול אותי כל שאלה פיננסית.\n\n` +
    `φ *Phi - היחס הזהב של הכסף שלך*`;

  await greenAPI.sendMessage({ phoneNumber: phone, message });

  return { success: true, newState: 'behavior' };
}
