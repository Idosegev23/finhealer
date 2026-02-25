// @ts-nocheck
import type { RouterContext, RouterResult } from '../shared';
import { isCommand } from '../shared';

/**
 * Handles the 'start' onboarding state.
 * Transitions to 'waiting_for_document' and checks for pending transactions.
 * If pending transactions exist, signals classification flow instead.
 */
export async function handleStart(
  ctx: RouterContext,
  supabase: any,
  greenAPI: any
): Promise<RouterResult> {
  // Transition to waiting_for_document
  await supabase
    .from('users')
    .update({ onboarding_state: 'waiting_for_document' })
    .eq('id', ctx.userId);

  // Check if there are pending transactions - if so, go to classification
  const { data: pendingTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('status', 'pending')
    .limit(1);

  if (pendingTx && pendingTx.length > 0) {
    // Update state to classification and inform the user
    await supabase
      .from('users')
      .update({ onboarding_state: 'classification' })
      .eq('id', ctx.userId);

    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `היי ${ctx.userName || ''}! 👋\n\n` +
        `יש לך תנועות שמחכות לסיווג.\n` +
        `כתוב *"נתחיל"* כדי לעבור עליהן ביחד 🎯`,
    });

    return { success: true, newState: 'classification' as any };
  }

  // Otherwise ask for document
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `היי ${ctx.userName || 'שם'}! 👋\n\n` +
      `📄 שלח לי דוח בנק או אשראי (PDF/Excel) ואני אנתח את התנועות שלך.`,
  });

  return { success: true, newState: 'waiting_for_document' as any };
}

/**
 * Handles the 'waiting_for_name' onboarding state.
 * Updates user name in database and transitions to 'waiting_for_document'.
 */
export async function handleWaitingForName(
  ctx: RouterContext,
  msg: string,
  supabase: any,
  greenAPI: any
): Promise<RouterResult> {
  await supabase
    .from('users')
    .update({
      name: msg,
      full_name: msg,
      onboarding_state: 'waiting_for_document'
    })
    .eq('id', ctx.userId);

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `נעים להכיר, ${msg}! 😊\n\n` +
      `📄 שלח לי דוח בנק (PDF) ואני אנתח את התנועות שלך.`,
  });

  return { success: true, newState: 'waiting_for_document' as any };
}

/**
 * Handles the 'waiting_for_document' onboarding state.
 * Processes document uploads and start classification commands.
 * Accepts a callback function to transition to classification flow.
 */
export async function handleWaitingForDocument(
  ctx: RouterContext,
  msg: string,
  supabase: any,
  greenAPI: any,
  startClassification: (ctx: RouterContext) => Promise<RouterResult>
): Promise<RouterResult> {
  // Check for start classification commands
  if (isCommand(msg, [
    'נתחיל',
    'נמשיך',
    'התחל',
    'לסווג',
    'סיווג',
    'start_classify',
    '▶️ נתחיל לסווג',
    'נתחיל לסווג ▶️',
    '▶️ נמשיך לסווג',
    'נמשיך לסווג ▶️'
  ])) {
    return await startClassification(ctx);
  }

  // Check for add document commands
  if (isCommand(msg, [
    'עוד דוח',
    'דוח נוסף',
    'add_bank',
    'add_credit',
    'add_doc',
    '📄 עוד דוח בנק',
    '💳 דוח אשראי',
    '📄 שלח עוד מסמך'
  ])) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📄 מעולה! שלח לי את המסמך.`,
    });
    return { success: true };
  }

  // Default - waiting for document
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `📄 מחכה לדוח בנק!\n\nשלח לי קובץ PDF ואני אנתח אותו.`,
  });

  return { success: true };
}
