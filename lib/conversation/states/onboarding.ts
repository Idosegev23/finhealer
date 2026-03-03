// @ts-nocheck
import type { RouterContext, RouterResult } from '../shared';
import { parseStateIntent } from '@/lib/ai/state-intent';

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
        `יש לך הוצאות והכנסות שצריך לסדר.\n` +
        `כתוב *"נתחיל"* ונעבור עליהן ביחד 🎯`,
    });

    return { success: true, newState: 'classification' as any };
  }

  // Otherwise ask for document
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `היי ${ctx.userName || 'שם'}! 👋\n\n` +
      `אני φ Phi, העוזר הפיננסי שלך 😊\n\n` +
      `📄 כדי להתחיל, שלח לי דוח מהבנק או מחברת האשראי.\n` +
      `מתאים PDF, תמונה, או קובץ Excel.\n\n` +
      `💡 *איפה מוצאים את זה?*\nבאפליקציית הבנק → דוחות → ייצוא`,
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
      `אני φ Phi, ואני כאן לעזור לך לנהל את הכסף בקלות.\n\n` +
      `📄 שלח לי דוח מהבנק או מחברת האשראי (PDF/תמונה/Excel) ונתחיל!`,
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
  // Layer 0: Button IDs (instant, no AI)
  const buttonActions: Record<string, string> = {
    'start_classify': 'start_classify',
    '▶️ נתחיל לסווג': 'start_classify',
    'נתחיל לסווג ▶️': 'start_classify',
    '▶️ נמשיך לסווג': 'start_classify',
    'נמשיך לסווג ▶️': 'start_classify',
    'add_bank': 'add_document',
    'add_credit': 'add_document',
    'add_doc': 'add_document',
  };

  const buttonIntent = buttonActions[msg.trim()];
  if (buttonIntent === 'start_classify') {
    return await startClassification(ctx);
  }
  if (buttonIntent === 'add_document') {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📄 מעולה! שלח לי את המסמך.`,
    });
    return { success: true };
  }

  // Layer 1: AI Intent Detection
  let intent = { intent: 'unknown', confidence: 0, params: {} };
  try {
    intent = await parseStateIntent(msg, 'onboarding');
  } catch (intentErr) {
    console.warn(`[Onboarding] parseStateIntent failed:`, intentErr);
  }
  console.log(`[Onboarding] AI_INTENT: intent="${intent.intent}", confidence=${intent.confidence}`);

  if (intent.intent === 'start_classify' && intent.confidence >= 0.6) {
    return await startClassification(ctx);
  }

  if (intent.intent === 'add_document' && intent.confidence >= 0.6) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📄 מעולה! שלח לי את המסמך.`,
    });
    return { success: true };
  }

  // Skip - user doesn't have a document right now
  if (
    (intent.intent === 'skip' && intent.confidence >= 0.6) ||
    ctx.intent?.type === 'postpone' ||
    ctx.intent?.type === 'skip'
  ) {
    // Check if there are any existing transactions to work with
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', ctx.userId)
      .limit(1);

    if (existingTx && existingTx.length > 0) {
      // Has transactions - go to classification
      await supabase.from('users').update({ onboarding_state: 'classification' }).eq('id', ctx.userId);
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `בסדר! 😊\n\nיש לך הוצאות והכנסות שצריך לסדר.\nכתוב *"נתחיל"* כשתהיה מוכן.`,
      });
      return { success: true, newState: 'classification' as any };
    } else {
      // No transactions - go to monitoring with limited functionality
      // Use calculated phase (don't hardcode)
      const { calculatePhase: calcPhaseSkip } = await import('@/lib/services/PhaseService');
      const skipPhase = await calcPhaseSkip(ctx.userId);
      await supabase.from('users').update({ onboarding_state: 'monitoring', phase: skipPhase }).eq('id', ctx.userId);
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `בסדר! 😊\n\nתוכל לשלוח מסמכים בכל עת.\n\nבינתיים, אפשר לשאול אותי שאלות פיננסיות או לכתוב *"עזרה"* לראות מה אפשר לעשות.`,
      });
      return { success: true, newState: 'monitoring' as any };
    }
  }

  // Default - waiting for document, provide clear guidance
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `📄 אני מחכה לדוח מהבנק או מחברת האשראי.\n\n` +
      `*מה מתאים:*\n` +
      `• קובץ PDF\n` +
      `• תמונה (צילום מסך)\n` +
      `• קובץ Excel\n\n` +
      `💡 אפשר למצוא את זה באפליקציית הבנק בחלק של "דוחות".\n\n` +
      `אין לך עכשיו? כתוב *"דלג"* ונמשיך.`,
  });

  return { success: true };
}
