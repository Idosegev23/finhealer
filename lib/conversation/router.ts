/**
 * φ Router - AI-powered conversation router
 *
 * Architecture:
 *   1. Parse intent (rule-based first, AI fallback)
 *   2. Handle universal intents (greeting, help, thanks, frustration)
 *   3. Handle cross-state intents (e.g. goal_request from monitoring)
 *   4. Dispatch to state handler with intent context
 *
 * State handlers:
 *   - states/onboarding.ts
 *   - states/classification.ts
 *   - states/behavior.ts
 *   - states/goals.ts
 *   - states/budget.ts
 *   - states/monitoring.ts
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { getOrCreateContext, updateContext, isContextStale, resumeStaleContext } from './context-manager';
import { tryRuleBasedParsing, detectUserMood } from '@/lib/ai/intent-parser';
import { buildUserSnapshot } from '@/lib/ai/user-snapshot';

import type { RouterContext, RouterResult, UserState } from './shared';

// State handlers
import { handleStart, handleWaitingForName, handleWaitingForDocument } from './states/onboarding';
// classification.ts (old engine) is no longer imported — smart-classification.ts replaces it
import { handleSmartClassification } from './states/smart-classification';
import { phiBrain } from '@/lib/ai/phi-brain';
import { handleBehaviorPhase } from './states/behavior';
import { handleGoalsSetup, handleGoalsPhase } from './states/goals';
import { handleBudgetPhase } from './states/budget';
import { handleMonitoring, handleLoanConsolidationOffer, handleWaitingForLoanDocs } from './states/monitoring';

// Re-export types for consumers
export type { RouterContext, RouterResult, UserState };

// startClassification wrapper — uses new smart-classification engine
// Replaces the old classification.ts callback
async function startClassification(ctx: RouterContext): Promise<RouterResult> {
  return handleSmartClassification(ctx, 'נמשיך');
}

// ============================================================================
// State guidance messages (what to do next in each state)
// ============================================================================

function getStateGuidance(state: UserState, userName: string | null): string {
  const name = userName || '';
  switch (state) {
    case 'waiting_for_name':
      return `היי! 👋 איך קוראים לך?`;
    case 'waiting_for_document':
      return `היי ${name}! 👋\n\n📄 שלח לי דוח מהבנק או מחברת האשראי.\nמתאים: PDF, תמונה, או קובץ Excel.\n\n💡 *איפה מוצאים?* באפליקציה של הבנק ← דוחות ← שלח לי.\n\nאין לך עכשיו? כתוב *"דלג"* ונמשיך.`;
    case 'classification':
    case 'classification_income':
    case 'classification_expense':
    case 'smart_classification':
      return `📊 מסדרים את ההוצאות וההכנסות.\n\nכתבו *"נמשיך"* ואני אסווג הכל אוטומטית — אפשר לתקן אחר כך.`;
    case 'goals_setup':
    case 'goals':
      return `אנחנו מגדירים מטרות כספיות 🎯\nלמשל: לחסוך לחופשה, לסגור חוב, או לבנות קרן חירום.\n\nכתוב *"יעד חדש"* להוסיף מטרה, או *"סיימתי"* להמשיך.`;
    case 'behavior':
      return `אני בודק איך הכסף שלך מתנהל 📈\n\nכתוב *"ניתוח"* ואני אראה לך לאן הולך הכסף וטיפים לחסכון.\nאו כתוב *"המשך"* לעבור לשלב הבא.`;
    case 'budget':
      return `בוא נבנה תקציב חודשי 💰\n\nתקציב = כמה כסף מותר להוציא בכל נושא (אוכל, חשבונות, וכו').\n\nכתוב *"אוטומטי"* ואני אבנה לך, או *"דלג"* להמשיך.`;
    case 'monitoring':
      return `היי ${name}! 😊\n\nמה תרצה לעשות?\n📊 *סיכום* — לראות מצב כספי חודשי\n🎯 *יעדים* — לראות התקדמות למטרות\n💰 *תקציב* — לראות כמה הוצאת החודש\n📄 *שלח מסמך* — להוסיף דוח מהבנק`;
    default:
      return `היי ${name}! 👋 איך אפשר לעזור?\n\nכתוב *"עזרה"* לראות מה אני יכול לעשות.`;
  }
}

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

  // Guard: empty message (e.g. from failed button extraction)
  if (!msg) {
    console.log(`[Router] EMPTY_MSG: ignoring empty message`);
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `לא קיבלתי הודעה 🤔\nכתוב *"עזרה"* לראות מה אפשר לעשות.`,
    });
    return { success: true };
  }

  // Load conversation context for continuity
  const conversationCtx = await getOrCreateContext(userId);

  // Stale context — DON'T send a separate "שמח שחזרת" message.
  // The greeting handler below will handle it properly with buttons.
  if (isContextStale(conversationCtx)) {
    console.log(`[Router] STALE_CONTEXT: userId=${userId.substring(0,8)}, handled by greeting`);
  }

  // Load user
  const { data: user } = await supabase
    .from('users')
    .select('name, full_name, onboarding_state')
    .eq('id', userId)
    .single();

  const userName = user?.name || user?.full_name || null;
  const rawState = user?.onboarding_state;
  const state = (rawState || 'start') as UserState;

  // ══════════════════════════════════════════════════════════════════════════
  // AI INTENT DETECTION (rule-based, instant, no API call)
  // ══════════════════════════════════════════════════════════════════════════
  const intent = tryRuleBasedParsing(msg);
  const mood = detectUserMood(msg);

  console.log(`[Router] USER_STATE: state=${state}, name=${userName || 'null'}, intent=${intent?.type || 'none'}(${intent?.confidence?.toFixed(2) || '0'}), mood=${mood}`);

  // Pass intent to state handlers via context
  const ctx: RouterContext = { userId, phone, state, userName, intent };

  // ══════════════════════════════════════════════════════════════════════════
  // UNIVERSAL INTENTS (handled in ANY state, before state dispatch)
  // For PhiBrain states — skip universal intents, brain handles everything
  // ══════════════════════════════════════════════════════════════════════════

  // Only monitoring + classification are PhiBrain-managed for greetings
  // behavior/goals/budget have their own handlers that handle greetings
  const brainManagedStates = [
    'classification', 'classification_income', 'classification_expense', 'smart_classification',
    'monitoring',
  ];
  const isBrainManaged = brainManagedStates.includes(state);

  // Greeting - smart, context-aware response
  if (!isBrainManaged && intent?.type === 'greeting' && intent.confidence > 0.8) {
    // Don't intercept greetings during name collection (it might be a name like "שלום")
    if (state !== 'waiting_for_name') {
      console.log(`[Router] UNIVERSAL: greeting in state=${state}`);

      // Smart greeting with financial snapshot for ALL states
      try {
        const snapshot = await buildUserSnapshot(userId);
        const d = snapshot.data;
        let greeting = `היי ${d.name}! 😊\n\n`;

        // State-specific context
        if (state === 'monitoring') {
          if (d.currentMonthIncome > 0 || d.currentMonthExpenses > 0) {
            const balance = d.currentMonthIncome - d.currentMonthExpenses;
            greeting += `📊 החודש: הכנסות ₪${d.currentMonthIncome.toLocaleString('he-IL')} | הוצאות ₪${d.currentMonthExpenses.toLocaleString('he-IL')}`;
            greeting += balance >= 0 ? ` | +₪${balance.toLocaleString('he-IL')} 💚\n` : ` | ₪${balance.toLocaleString('he-IL')} ⚠️\n`;
          }
          if (d.pendingActions.length > 0) {
            greeting += `\n💡 ${d.pendingActions[0]}`;
            if (d.pendingCount > 0) greeting += ` — רוצה לטפל בזה?`;
            greeting += `\n`;
          }
          const closestGoal = d.activeGoals.sort((a, b) => b.progress - a.progress)[0];
          if (closestGoal && closestGoal.progress > 0) {
            greeting += `\n🎯 ${closestGoal.name}: ${closestGoal.progress}%`;
            if (closestGoal.progress >= 75) greeting += ` — כמעט שם! 🔥`;
            greeting += `\n`;
          }
          greeting += `\nמה נעשה?`;
          // Send with buttons — clear CTAs, no open questions
          try {
            await greenAPI.sendInteractiveButtons({
              phoneNumber: phone,
              message: greeting,
              buttons: [
                { buttonId: 'summary', buttonText: 'סיכום 📊' },
                { buttonId: 'budget_status', buttonText: 'תקציב 💰' },
                { buttonId: 'help', buttonText: 'עזרה 📋' },
              ],
            });
            return { success: true };
          } catch {
            // fallback below
          }
        } else if (state === 'classification' || state === 'classification_income' || state === 'classification_expense') {
          if (d.pendingCount > 0) {
            greeting += `📋 יש לך ${d.pendingCount} הוצאות/הכנסות שצריך לסדר.\n`;
            greeting += `${d.confirmedCount > 0 ? `כבר סידרת ${d.confirmedCount} — כל הכבוד! ` : ''}`;
            greeting += `\nכתוב *"נמשיך"* להתחיל`;
          } else {
            greeting += `✅ הכל מסודר! כל הכבוד.\nכתוב *"נמשיך"* להמשך`;
          }
        } else if (state === 'goals' || state === 'goals_setup') {
          if (d.activeGoals.length > 0) {
            greeting += `🎯 יש לך ${d.activeGoals.length} יעדים פעילים:\n`;
            d.activeGoals.slice(0, 3).forEach(g => {
              greeting += `• ${g.name}: ${g.progress}%\n`;
            });
            greeting += `\nמה תרצה לעשות?`;
          } else {
            greeting += `🎯 בוא נגדיר יעדי חיסכון!\nכתוב *"יעד חדש"* להתחלה`;
          }
        } else if (state === 'behavior') {
          greeting += `📊 בוא ננתח את ההתנהגות הפיננסית שלך.\nכתוב *"ניתוח"* להתחיל`;
        } else if (state === 'budget') {
          if (d.budgetUsedPercent !== null) {
            greeting += `💰 התקציב שלך: ${d.budgetUsedPercent}% נוצל`;
            if (d.budgetOverCategories.length > 0) {
              greeting += `\n⚠ חריגה ב: ${d.budgetOverCategories.join(', ')}`;
            }
            greeting += `\n`;
          }
          greeting += `מה תרצה לעשות?`;
        } else if (state === 'waiting_for_document') {
          greeting += `📄 *שלחו דוח מהבנק* — PDF, תמונה, או אקסל.\n`;
          greeting += `אני מסווג הכל אוטומטית ומראה סיכום תוך שניות.`;
        } else {
          greeting += getStateGuidance(state, d.name);
        }

        // Send with buttons when possible
        try {
          const buttons = state === 'waiting_for_document'
            ? [{ buttonId: 'help', buttonText: 'עזרה 📋' }]
            : [
                { buttonId: 'summary', buttonText: 'סיכום 📊' },
                { buttonId: 'help', buttonText: 'עזרה 📋' },
              ];
          await greenAPI.sendInteractiveButtons({
            phoneNumber: phone,
            message: greeting,
            buttons,
          });
          return { success: true };
        } catch {
          // Fallback to plain text
        }

        await greenAPI.sendMessage({ phoneNumber: phone, message: greeting });
        return { success: true };
      } catch (err) {
        console.error('[Router] Snapshot error in greeting:', err);
        // Fall through to simple greeting
      }

      await greenAPI.sendMessage({ phoneNumber: phone, message: getStateGuidance(state, userName) });
      return { success: true };
    }
  }

  // Thanks - respond warmly and guide
  if (!isBrainManaged && intent?.type === 'thanks' && intent.confidence > 0.8) {
    if (state !== 'waiting_for_name') {
      console.log(`[Router] UNIVERSAL: thanks in state=${state}`);
      const responses = [
        `בשמחה! 😊 ${getStateGuidance(state, userName)}`,
        `תמיד כאן בשבילך! 😊\n\n${getStateGuidance(state, userName)}`,
      ];
      await greenAPI.sendMessage({ phoneNumber: phone, message: responses[Math.floor(Math.random() * responses.length)] });
      return { success: true };
    }
  }

  // Help - context-sensitive help
  if (!isBrainManaged && intent?.type === 'help' && intent.confidence > 0.8) {
    console.log(`[Router] UNIVERSAL: help in state=${state}`);
    const stateLabels: Record<string, string> = {
      start: 'התחלה',
      waiting_for_name: 'המתנה לשם',
      waiting_for_document: 'העלאת מסמך',
      classification: 'מיון הוצאות והכנסות',
      classification_income: 'סיווג הכנסות',
      classification_expense: 'סיווג הוצאות',
      goals_setup: 'הגדרת יעדים',
      behavior: 'ניתוח התנהגות',
      goals: 'ניהול יעדים',
      budget: 'תקציב',
      monitoring: 'ניטור שוטף',
      loan_consolidation_offer: 'איחוד הלוואות',
      waiting_for_loan_docs: 'מסמכי הלוואה',
    };

    let helpText = `🆘 *עזרה - φ Phi*\n\n`;
    helpText += `📍 שלב: *${stateLabels[state] || state}*\n\n`;

    if (state === 'waiting_for_document' || state === 'start') {
      helpText += `📄 שלח לי דוח מהבנק (תמונה, PDF, או Excel)\n`;
      helpText += `✏️ כתוב *"נתחיל"* — לסדר הוצאות והכנסות קיימות\n`;
      helpText += `⏭️ כתוב *"דלג"* — אם אין לך מסמך עכשיו\n`;
    } else if (state === 'classification_income' || state === 'classification_expense') {
      helpText += `אני מראה לך כל הוצאה/הכנסה ואתה אומר לי מה זה.\n\n`;
      helpText += `✅ כתוב לאיזה נושא זה שייך (למשל: *"משכורת"*, *"מכולת"*, *"חשמל"*)\n`;
      helpText += `👍 כתוב *"כן"* — לאשר את ההצעה שלי\n`;
      helpText += `⏭️ כתוב *"דלג"* — לעבור לפעולה הבאה\n`;
      helpText += `🚀 כתוב *"קבל הכל"* — שאני אסדר את כולם\n`;
      helpText += `📋 כתוב *"רשימה"* — לראות את כל האפשרויות\n`;
      helpText += `🔙 כתוב *"תקן"* — לתקן את האחרון\n`;
    } else if (state === 'goals_setup' || state === 'goals') {
      helpText += `🎯 כתוב *"יעד חדש"* — להגדיר מטרה חדשה (למשל: חיסכון לחופשה)\n`;
      helpText += `📋 כתוב *"יעדים"* — לראות את המטרות שלך\n`;
      helpText += `✅ כתוב *"סיימתי"* — לעבור לשלב הבא\n`;
    } else if (state === 'monitoring') {
      // Send interactive list message instead of text wall
      try {
        await greenAPI.sendListMessage({
          phoneNumber: phone,
          message: `היי ${userName || ''}! 😊\nאיך אפשר לעזור?`,
          buttonText: 'בחר פעולה',
          title: 'φ Phi - תפריט',
          footer: 'או כתוב לי בחופשיות!',
          sections: [
            {
              title: 'סיכומים וגרפים',
              rows: [
                { rowId: 'summary', title: '📊 סיכום חודשי', description: 'הכנסות, הוצאות ויתרה' },
                { rowId: 'expense_chart', title: '📊 גרף הוצאות', description: 'התפלגות הוצאות ויזואלית' },
                { rowId: 'income_chart', title: '💚 גרף הכנסות', description: 'מקורות הכנסה' },
                { rowId: 'cash_flow', title: '📈 תזרים', description: 'תחזית 3 חודשים קדימה' },
                { rowId: 'phi_score', title: '🏆 ציון פיננסי', description: 'בריאות פיננסית' },
              ],
            },
            {
              title: 'ניהול כספים',
              rows: [
                { rowId: 'budget_status', title: '💰 תקציב', description: 'מצב תקציב חודשי' },
                { rowId: 'to_goals', title: '🎯 יעדים', description: 'ניהול יעדי חיסכון' },
                { rowId: 'unclassified', title: '📋 לא מסודר', description: 'הוצאות שצריך למיין' },
                { rowId: 'add_doc', title: '📄 מסמך חדש', description: 'שלח דוח בנק או אשראי' },
              ],
            },
            {
              title: 'עוד',
              rows: [
                { rowId: 'advisor', title: '💼 ייעוץ', description: 'שיחה עם גדי' },
                { rowId: 'available_months', title: '📅 חודשים', description: 'חודשים עם נתונים' },
              ],
            },
          ],
        });
      } catch (listError) {
        // Fallback handled by sendListMessage internally
        console.error('[Router] List message error:', listError);
      }
      return { success: true };
    } else {
      helpText += `📄 שלח מסמך - להוסיף דוח\n`;
      helpText += `⏭️ *"דלג"* / *"נמשיך"* - לדלג קדימה\n`;
      helpText += `📊 *"סיכום"* - סיכום מצב\n`;
    }

    helpText += `\n💬 תמיד אפשר לכתוב *"עזרה"*`;

    await greenAPI.sendMessage({ phoneNumber: phone, message: helpText });
    return { success: true };
  }

  // Cancel / Back — universal escape from any non-terminal state
  if (!isBrainManaged && intent?.type === 'cancel' && intent.confidence > 0.7) {
    const cancellableStates: UserState[] = ['goals_setup', 'behavior', 'budget', 'loan_consolidation_offer', 'waiting_for_loan_docs'];
    if (cancellableStates.includes(state)) {
      console.log(`[Router] UNIVERSAL: cancel in state=${state} → monitoring`);
      const { calculatePhase } = await import('@/lib/services/PhaseService');
      const currentPhase = await calculatePhase(userId);
      await supabase.from('users').update({
        onboarding_state: 'monitoring',
        phase: currentPhase,
      }).eq('id', userId);
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `🔙 חזרנו לתפריט הראשי.\n\nכתוב *"עזרה"* לראות מה אפשר לעשות.`,
      });
      return { success: true, newState: 'monitoring' };
    }
  }

  // Frustration / Tiredness - offer a break
  if (!isBrainManaged && mood === 'tired' && state !== 'waiting_for_name') {
    console.log(`[Router] UNIVERSAL: user seems tired/frustrated in state=${state}`);
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `אני כאן כשתרצה להמשיך 😊\n\nכתוב הודעה כשתהיה מוכן, ונמשיך מאיפה שעצרנו.`,
    });
    return { success: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CROSS-STATE ROUTING (intent-based state transitions)
  // Only in "free" states where the user isn't in the middle of a flow
  // ══════════════════════════════════════════════════════════════════════════

  const freeStates: UserState[] = ['monitoring', 'behavior', 'goals', 'budget'];
  if (freeStates.includes(state) && intent && intent.confidence > 0.8) {
    // Summary request from any free state → handle directly
    if (intent.type === 'summary_request' && state !== 'monitoring') {
      console.log(`[Router] CROSS_STATE: summary_request from ${state} → routing to monitoring handler`);
      const result = await handleMonitoring(ctx, 'סיכום', userName, startClassification);
      return result;
    }

    // Goal request from monitoring → go to goals
    if (intent.type === 'goal_request' && state === 'monitoring') {
      console.log(`[Router] CROSS_STATE: goal_request from monitoring → goals`);
      await supabase.from('users').update({ onboarding_state: 'goals' }).eq('id', userId);
      const goalsCtx = { ...ctx, state: 'goals' as UserState };
      const result = await handleGoalsPhase(goalsCtx, msg);
      return result;
    }

    // Budget request from monitoring → go to budget
    if (intent.type === 'budget_request' && state === 'monitoring') {
      console.log(`[Router] CROSS_STATE: budget_request from monitoring → budget`);
      await supabase.from('users').update({ onboarding_state: 'budget' }).eq('id', userId);
      const budgetCtx = { ...ctx, state: 'budget' as UserState };
      const result = await handleBudgetPhase(budgetCtx, msg);
      return result;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATE DISPATCH (existing handlers, now with intent in ctx)
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

  // ══════════════════════════════════════════════════════════════════════════
  // PHI BRAIN — All smart states go through the AI engine
  // Handles: classification, behavior, goals, budget, monitoring, loans
  // ══════════════════════════════════════════════════════════════════════════

  // PhiBrain handles: monitoring (daily usage) + classification
  // State handlers handle: behavior, goals, budget (have their own wizard flows)
  const brainStates = [
    'classification', 'classification_income', 'classification_expense', 'smart_classification',
    'monitoring',
  ];

  // Wizard states — these have their own multi-step flows, PhiBrain can't handle them
  if (state === 'behavior') {
    console.log(`[Router] DISPATCH: state=behavior → handleBehaviorPhase()`);
    return await handleBehaviorPhase(ctx, msg);
  }
  if (state === 'goals_setup') {
    console.log(`[Router] DISPATCH: state=goals_setup → handleGoalsSetup()`);
    return await handleGoalsSetup(ctx, msg);
  }
  if (state === 'goals') {
    console.log(`[Router] DISPATCH: state=goals → handleGoalsPhase()`);
    return await handleGoalsPhase(ctx, msg);
  }
  if (state === 'budget') {
    console.log(`[Router] DISPATCH: state=budget → handleBudgetPhase()`);
    return await handleBudgetPhase(ctx, msg);
  }
  if (state === 'loan_consolidation_offer') {
    return await handleLoanConsolidationOffer(ctx, msg);
  }
  if (state === 'waiting_for_loan_docs') {
    return await handleWaitingForLoanDocs(ctx, msg);
  }

  if (brainStates.includes(state)) {
    console.log(`[Router] DISPATCH: state=${state} → PhiBrain`);
    try {
      const action = await phiBrain(userId, { type: 'whatsapp_message', message: msg });
      console.log(`[Router] RESULT: PhiBrain responded=${!action.silent}, state_update=${action.updateState || 'none'}`);
      return { success: true, newState: action.updateState as any };
    } catch (brainErr) {
      console.error(`[Router] PhiBrain error, falling back to legacy handler:`, brainErr);
      if (state === 'monitoring') {
        return await handleMonitoring(ctx, msg, userName, startClassification);
      }
      if (state.startsWith('classification') || state === 'smart_classification') {
        return await handleSmartClassification(ctx, msg);
      }
    }
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

  // Clean up classification_context (no longer needed, prevents JSONB bloat)
  await supabase
    .from('users')
    .update({ classification_context: null })
    .eq('id', userId);
  console.log(`[Router] Cleaned classification_context for user ${userId.substring(0,8)}`);

  // Check if user already has goals - if so, go to behavior; otherwise goals_setup
  const { data: existingGoals } = await supabase
    .from('goals')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);

  // Use calculated phase (don't hardcode)
  const { calculatePhase } = await import('@/lib/services/PhaseService');
  const nextPhase = await calculatePhase(userId);

  if (existingGoals && existingGoals.length > 0) {
    console.log(`[Router] TRANSITION: classification → behavior (has ${existingGoals.length} existing goals)`);
    await supabase
      .from('users')
      .update({
        onboarding_state: 'behavior',
        phase: nextPhase,
        phase_updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `🎉 *סיימנו לסדר!*\n\nעכשיו φ ינתח את דפוסי ההוצאות שלך.\n\nכתוב *"ניתוח"* להתחיל`,
    });
  } else {
    console.log(`[Router] TRANSITION: classification → goals_setup (no existing goals)`);
    await supabase
      .from('users')
      .update({
        onboarding_state: 'goals_setup',
        phase: nextPhase,
        phase_updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `🎉 *סיימנו לסדר!*\n\nעכשיו בוא נגדיר מטרות חיסכון 🎯\n\nכתוב *"יעד חדש"* להתחיל, או *"דלג"* להמשיך.`,
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

    // AI already classified at import time (documents/process/route.ts)
    // Just trigger smart-classification to show summary
    await supabase
      .from('users')
      .update({ onboarding_state: 'smart_classification' })
      .eq('id', userId);

    await handleSmartClassification(
      { userId, phone, state: 'smart_classification' as any, userName: null },
      'נמשיך'
    );
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
    confirmMsg += `📝 ${txCount} הוצאות/הכנסות חדשות נוספו.\n`;
    confirmMsg += `כתוב *"נתחיל"* כדי לסדר אותן.`;
  } else {
    confirmMsg += `לא נמצאו הוצאות או הכנסות חדשות בדוח.`;
  }

  await greenAPI.sendMessage({ phoneNumber: phone, message: confirmMsg });
}
