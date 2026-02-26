// @ts-nocheck

import type { RouterContext, RouterResult } from '../shared';
import {
  isCommand,
  saveSuggestionsToCache,
  getSuggestionsFromCache,
  saveCurrentGroupToCache,
  getCurrentGroupFromCache,
  normalizeVendor,
} from '../shared';
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient, sendWhatsAppInteractiveButtons } from '@/lib/greenapi/client';
import { CATEGORIES, findBestMatch, findTopMatches } from '@/lib/finance/categories';
import { INCOME_CATEGORIES, findBestIncomeMatch, findTopIncomeMatches } from '@/lib/finance/income-categories';
import { chatWithGeminiFlashMinimal } from '@/lib/ai/gemini-client';

// ============================================================================
// handleClassificationState
// ============================================================================

/**
 * Handle generic 'classification' state.
 * Shown when user is in the classification state but no sub-type is active yet.
 */
export async function handleClassificationState(ctx: RouterContext, msg: string): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();

  if (isCommand(msg, [
    'נתחיל', 'נמשיך', 'התחל', 'לסווג', 'סיווג', 'start_classify',
    '▶️ נתחיל לסווג', 'נתחיל לסווג ▶️', '▶️ נמשיך לסווג', 'נמשיך לסווג ▶️',
  ])) {
    return await startClassification(ctx);
  }

  if (isCommand(msg, [
    'עוד דוח', 'דוח נוסף', 'add_bank', 'add_credit', 'add_doc',
    '📄 עוד דוח בנק', 'עוד דוח בנק 📄', '💳 דוח אשראי', 'דוח אשראי 💳',
    '📄 שלח עוד מסמך', 'שלח עוד מסמך 📄',
  ])) {
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: `📄 מעולה! שלח לי את המסמך.` });
    return { success: true };
  }

  // Default - show options with buttons
  try {
    await greenAPI.sendInteractiveButtons({
      phoneNumber: ctx.phone,
      message: `יש לי תנועות שמחכות לסיווג.\nמה תרצה לעשות?`,
      header: 'מה עכשיו?',
      buttons: [
        { buttonId: 'start_classify', buttonText: 'נמשיך' },
        { buttonId: 'add_doc', buttonText: 'עוד דוח' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `*מה עכשיו?*\n\n• כתוב *"נמשיך"* להתחיל לסווג תנועות\n• או שלח עוד מסמך PDF`,
    });
  }

  return { success: true };
}

// ============================================================================
// startClassification
// ============================================================================

/**
 * Entry point: check for documents, count pending, start flow.
 */
export async function startClassification(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Check if there are any uploaded statements at all
  const { count: uploadedDocs } = await supabase
    .from('uploaded_statements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId);

  if (!uploadedDocs || uploadedDocs === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📄 *אין עדיין דוחות במערכת!*\n\nשלח לי דוח בנק או דוח אשראי קודם.\n\n💡 אפשר לשלוח PDF, Excel או תמונה.`,
    });
    return { success: true };
  }

  // Auto-classify transactions using learned rules before showing manual flow
  const autoClassified = await autoClassifyWithRules(ctx.userId, supabase);
  if (autoClassified > 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `🧠 סיווגתי אוטומטית ${autoClassified} תנועות לפי מה שלמדתי ממך!`,
    });
  }

  // Use smart filtering function from classification-flow
  const { getClassifiableTransactions } = await import('../classification-flow');

  const incomeTransactions = await getClassifiableTransactions(ctx.userId, 'income');
  const expenseTransactions = await getClassifiableTransactions(ctx.userId, 'expense');

  const incomeCount = incomeTransactions.length;
  const expenseCount = expenseTransactions.length;

  console.log(`📊 Classifiable transactions: ${incomeCount} income, ${expenseCount} expense (${autoClassified} auto-classified)`);

  if (incomeCount === 0 && expenseCount === 0) {
    // Check if there are ANY transactions in the system (including confirmed)
    const { count: totalTransactions } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId);

    if (!totalTransactions || totalTransactions === 0) {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `אין תנועות לסיווג! 🤷\n\nשלח לי דוח בנק או דוח אשראי קודם.`,
      });
      return { success: true };
    }

    // There are transactions but all classified - check for missing documents
    const { checkAndRequestMissingDocuments } = await import('../classification-flow');
    const hasMoreDocs = await checkAndRequestMissingDocuments(ctx.userId, ctx.phone);

    if (!hasMoreDocs) {
      // All done - move to next phase
      await supabase
        .from('users')
        .update({ onboarding_state: 'goals_setup', phase: 'goals' })
        .eq('id', ctx.userId);

      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message:
          `✅ *סיימנו את הסיווג!*\n\nכל התנועות מסווגות 🎉\n\n` +
          `עכשיו בוא נגדיר את היעדים הפיננסיים שלך! 🎯\n` +
          `כתוב *"יעדים"* או *"הגדר יעד"* כדי להתחיל.`,
      });
    }

    return { success: true, newState: 'goals_setup' };
  }

  // Send intro message
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message:
      `🎯 *בוא נעבור על התנועות ביחד!*\n\n` +
      `יש לך ${incomeCount} הכנסות ו-${expenseCount} הוצאות.\n\n` +
      (incomeCount > 0 ? `נתחיל עם ההכנסות 💚` : `נתחיל עם ההוצאות 💸`),
  });

  // Set state and show first transaction
  const newState = incomeCount > 0 ? 'classification_income' : 'classification_expense';

  await supabase
    .from('users')
    .update({ onboarding_state: newState, phase: 'data_collection' })
    .eq('id', ctx.userId);

  await showNextTransaction({ ...ctx, state: newState }, newState === 'classification_income' ? 'income' : 'expense');

  return { success: true, newState };
}

// ============================================================================
// handleClassificationResponse
// ============================================================================

/**
 * Handle user response during classification.
 * type: 'income' | 'expense'
 */
export async function handleClassificationResponse(
  ctx: RouterContext,
  msg: string,
  type: 'income' | 'expense'
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // ---- FINISH EARLY (works in both income and expense) ----
  if (isCommand(msg, ['סיימתי', 'סיום', 'מספיק', 'finish', 'done', 'הספיק', 'נגמר'])) {
    // Mark all remaining pending as 'לא מסווג'
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId)
      .eq('status', 'pending')
      .eq('type', type);

    if (count && count > 0) {
      await supabase
        .from('transactions')
        .update({
          status: 'confirmed',
          category: 'לא מסווג',
          expense_category: type === 'expense' ? 'לא מסווג' : null,
          income_category: type === 'income' ? 'לא מסווג' : null,
          notes: 'דילג המשתמש - סיום מוקדם',
        })
        .eq('user_id', ctx.userId)
        .eq('status', 'pending')
        .eq('type', type);

      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `⏭️ דילגתי על ${count} תנועות שנשארו.`,
      });
    }

    return await moveToNextPhase(ctx, type);
  }

  // ---- EXPENSE ----
  if (type === 'expense') {
    // Group classification - get group from cache
    const txIds = await getCurrentGroupFromCache(ctx.userId);
    if (!txIds || txIds.length === 0) {
      return await showNextExpenseGroup(ctx);
    }

    // Skip command - mark entire group as confirmed with 'skipped' to avoid infinite loop
    if (isCommand(msg, ['דלג', 'skip', '⏭️ דלג', 'דלג ⏭️'])) {
      await supabase
        .from('transactions')
        .update({
          status: 'confirmed',
          category: 'לא מסווג',
          expense_category: 'לא מסווג',
          notes: 'דילג המשתמש',
        })
        .in('id', txIds);

      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: txIds.length > 1
          ? `⏭️ דילגתי על ${txIds.length} תנועות`
          : `⏭️ דילגתי`,
      });
      return await showNextExpenseGroup(ctx);
    }

    // Fix last classification - reopen the most recent confirmed transaction
    if (isCommand(msg, ['תקן', 'תיקון', 'fix', 'חזור', 'טעות', 'לא נכון'])) {
      const reopened = await reopenLastClassified(ctx.userId, 'expense', supabase);
      if (reopened) {
        await greenAPI.sendMessage({
          phoneNumber: ctx.phone,
          message: `↩️ פתחתי מחדש: *${reopened.vendor}* (${Math.abs(reopened.amount).toLocaleString('he-IL')} ₪)\nהיה: *${reopened.category}*\n\nכתוב קטגוריה חדשה:`,
        });
        return await showNextExpenseGroup(ctx);
      }
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `אין תנועה אחרונה לתקן.`,
      });
      return { success: true };
    }

    // Show categories list
    if (isCommand(msg, ['רשימה', 'list', '📋 רשימה', 'רשימה 📋', 'קטגוריות', 'אפשרויות', 'categories'])) {
      const groups = Array.from(new Set(CATEGORIES.map(c => c.group)));
      const messages: string[] = [];
      let currentMsg = `💸 *קטגוריות הוצאה:*\n\n`;

      for (const group of groups) {
        const groupCats = CATEGORIES.filter(c => c.group === group);
        const groupLine = `*${group}:* ${groupCats.map(c => c.name).join(', ')}\n`;
        if (currentMsg.length + groupLine.length > 3000) {
          messages.push(currentMsg);
          currentMsg = groupLine;
        } else {
          currentMsg += groupLine;
        }
      }
      currentMsg += `\n💡 כתוב את שם הקטגוריה או חלק ממנה`;
      messages.push(currentMsg);

      for (const m of messages) {
        await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: m });
      }
      return { success: true };
    }

    // ---- FAST INTENT: category match before confirm (prevents "הכנס" matching "כנ") ----
    if (msg.length > 3) {
      const earlyMatch = findBestMatch(msg);
      if (earlyMatch) {
        return await classifyGroup(ctx, txIds, earlyMatch.name, type);
      }
    }

    // Confirm suggestion ("כן")
    if (isCommand(msg, ['כן', 'כנ', 'נכון', 'אשר', 'אישור', 'ok', 'yes', '✅ כן', 'כן ✅', 'confirm'])) {
      const suggestions = await getSuggestionsFromCache(ctx.userId);
      if (suggestions && suggestions[0]) {
        return await classifyGroup(ctx, txIds, suggestions[0], type);
      }
    }

    // Numeric selection from suggestions cache (1, 2, 3)
    const numChoice = parseInt(msg);
    if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= 3) {
      const cachedSuggestions = await getSuggestionsFromCache(ctx.userId);
      if (cachedSuggestions && cachedSuggestions[numChoice - 1]) {
        return await classifyGroup(ctx, txIds, cachedSuggestions[numChoice - 1], type);
      }
      // Numeric from full CATEGORIES list
      if (numChoice >= 1 && numChoice <= CATEGORIES.length) {
        return await classifyGroup(ctx, txIds, CATEGORIES[numChoice - 1].name, type);
      }
    }

    // Try to match as category name (fallback for shorter inputs)
    const match = findBestMatch(msg);
    if (match) {
      return await classifyGroup(ctx, txIds, match.name, type);
    }

    // Try top matches and offer suggestions
    const topMatches = findTopMatches(msg, 3);
    if (topMatches.length > 0) {
      await saveSuggestionsToCache(ctx.userId, topMatches.map(m => m.name));
      const list = topMatches.map((m, i) => `${i + 1}. ${m.name}`).join('\n');
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `🤔 לא מצאתי "${msg}".\n\nאולי התכוונת ל:\n${list}\n\nכתוב מספר (1-3) או נסה שוב.`,
      });
      return { success: true };
    }

    // AI fallback - suggest (don't auto-classify) when rule-based fails
    if (msg.length >= 3 && msg.length <= 40) {
      const aiCategory = await matchCategoryWithAI(msg, 'expense');
      if (aiCategory) {
        console.log(`[AI Category] Suggesting expense: "${msg}" → "${aiCategory}"`);
        await saveSuggestionsToCache(ctx.userId, [aiCategory]);
        await greenAPI.sendMessage({
          phoneNumber: ctx.phone,
          message: `🤖 הבנתי *"${aiCategory}"* — נכון?\n\nכתוב *"כן"* לאשר, או כתוב קטגוריה אחרת.`,
        });
        return { success: true };
      }
    }

    // Use as-is if reasonable length
    if (msg.length >= 2 && msg.length <= 30) {
      return await classifyGroup(ctx, txIds, msg, type);
    }

    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❓ לא הבנתי. כתוב שם קטגוריה, או *"רשימה"* לאפשרויות.`,
    });
    return { success: true };
  }

  // ---- INCOME ----
  // Get current pending income transaction
  const { data: currentTx } = await supabase
    .from('transactions')
    .select('id, amount, vendor, tx_date, type, expense_category, income_category')
    .eq('user_id', ctx.userId)
    .eq('status', 'pending')
    .eq('type', 'income')
    .order('tx_date', { ascending: false })
    .limit(1)
    .single();

  if (!currentTx) {
    return await moveToNextPhase(ctx, 'income');
  }

  // Skip command - mark as confirmed with 'skipped' note to avoid infinite loop
  if (isCommand(msg, ['דלג', 'תדלג', 'הבא', 'skip', '⏭️ דלג', 'דלג ⏭️'])) {
    const { error: skipError } = await supabase
      .from('transactions')
      .update({
        status: 'confirmed',
        category: 'לא מסווג',
        income_category: 'לא מסווג',
        notes: 'דילג המשתמש',
      })
      .eq('id', currentTx.id);

    if (skipError) {
      console.error('[Classification] Failed to skip income transaction:', skipError, 'txId:', currentTx.id);
    }

    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `⏭️ דילגתי`,
    });
    return await showNextTransaction(ctx, type);
  }

  // Fix last classification
  if (isCommand(msg, ['תקן', 'תיקון', 'fix', 'חזור', 'טעות', 'לא נכון'])) {
    const reopened = await reopenLastClassified(ctx.userId, 'income', supabase);
    if (reopened) {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `↩️ פתחתי מחדש: *${reopened.vendor}* (${Math.abs(reopened.amount).toLocaleString('he-IL')} ₪)\nהיה: *${reopened.category}*\n\nכתוב קטגוריה חדשה:`,
      });
      return await showNextTransaction(ctx, type);
    }
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `אין תנועה אחרונה לתקן.`,
    });
    return { success: true };
  }

  // Show categories list
  if (isCommand(msg, ['רשימה', 'list', '📋 רשימה', 'רשימה 📋', 'קטגוריות', 'אפשרויות', 'categories'])) {
    const groups = Array.from(new Set(INCOME_CATEGORIES.map(c => c.group)));
    const messages: string[] = [];
    let currentMsg = `💚 *קטגוריות הכנסה:*\n\n`;

    for (const group of groups) {
      const groupCats = INCOME_CATEGORIES.filter(c => c.group === group);
      const groupLine = `*${group}:* ${groupCats.map(c => c.name).join(', ')}\n`;
      if (currentMsg.length + groupLine.length > 3000) {
        messages.push(currentMsg);
        currentMsg = groupLine;
      } else {
        currentMsg += groupLine;
      }
    }
    currentMsg += `\n💡 כתוב את שם הקטגוריה או חלק ממנה`;
    messages.push(currentMsg);

    for (const m of messages) {
      await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: m });
    }
    return { success: true };
  }

  // ---- FAST INTENT: category match before confirm (prevents "הכנס" matching "כנ") ----
  if (msg.length > 3) {
    const earlyIncomeMatch = findBestIncomeMatch(msg);
    if (earlyIncomeMatch) {
      return await classifyTransaction(ctx, currentTx.id, earlyIncomeMatch.name, type);
    }
  }

  // Confirm suggestion ("כן")
  if (isCommand(msg, ['כן', 'כנ', 'נכון', 'אשר', 'אישור', 'ok', 'yes', '✅ כן', 'כן ✅', 'confirm'])) {
    const suggestions = await getSuggestionsFromCache(ctx.userId);
    if (suggestions && suggestions[0]) {
      return await classifyTransaction(ctx, currentTx.id, suggestions[0], type);
    }
  }

  // Numeric selection (1, 2, 3) from suggestions cache
  const numIncome = parseInt(msg);
  if (!isNaN(numIncome) && numIncome >= 1 && numIncome <= 3) {
    const cachedSuggestions = await getSuggestionsFromCache(ctx.userId);
    if (cachedSuggestions && cachedSuggestions[numIncome - 1]) {
      return await classifyTransaction(ctx, currentTx.id, cachedSuggestions[numIncome - 1], type);
    }
    // Numeric from full INCOME_CATEGORIES list
    if (numIncome >= 1 && numIncome <= INCOME_CATEGORIES.length) {
      return await classifyTransaction(ctx, currentTx.id, INCOME_CATEGORIES[numIncome - 1].name, type);
    }
  }

  // Try to match as income category name (fallback for shorter inputs)
  const incomeMatch = findBestIncomeMatch(msg);
  if (incomeMatch) {
    return await classifyTransaction(ctx, currentTx.id, incomeMatch.name, type);
  }

  // Try top income matches and offer suggestions
  const topIncomeMatches = findTopIncomeMatches(msg, 3);
  if (topIncomeMatches.length > 0) {
    await saveSuggestionsToCache(ctx.userId, topIncomeMatches.map(m => m.name));
    const list = topIncomeMatches.map((m, i) => `${i + 1}. ${m.name}`).join('\n');
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `🤔 לא מצאתי "${msg}".\n\nאולי התכוונת ל:\n${list}\n\nכתוב מספר (1-3) או נסה שוב.`,
    });
    return { success: true };
  }

  // AI fallback - suggest (don't auto-classify) when rule-based fails
  if (msg.length >= 3 && msg.length <= 40) {
    const aiCategory = await matchCategoryWithAI(msg, 'income');
    if (aiCategory) {
      console.log(`[AI Category] Suggesting income: "${msg}" → "${aiCategory}"`);
      await saveSuggestionsToCache(ctx.userId, [aiCategory]);
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `🤖 הבנתי *"${aiCategory}"* — נכון?\n\nכתוב *"כן"* לאשר, או כתוב קטגוריה אחרת.`,
      });
      return { success: true };
    }
  }

  // Use as-is if reasonable length
  if (msg.length >= 2 && msg.length <= 30) {
    return await classifyTransaction(ctx, currentTx.id, msg, type);
  }

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `❓ לא הבנתי. כתוב שם קטגוריה, או *"רשימה"* לאפשרויות.`,
  });
  return { success: true };
}

// ============================================================================
// classifyTransaction
// ============================================================================

/**
 * Classify a single transaction: set status=confirmed, set category fields,
 * learn the rule, send confirmation, and show the next transaction.
 */
export async function classifyTransaction(
  ctx: RouterContext,
  txId: string,
  category: string,
  type: 'income' | 'expense'
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Fetch vendor for learning
  const { data: tx } = await supabase
    .from('transactions')
    .select('vendor')
    .eq('id', txId)
    .single();

  // Save classification
  const { error } = await supabase
    .from('transactions')
    .update({
      status: 'confirmed',
      category,
      expense_category: type === 'expense' ? category : null,
      income_category: type === 'income' ? category : null,
      learned_from_pattern: false, // manually classified by user
    })
    .eq('id', txId);

  if (error) {
    console.error('[Classification] Failed to classify transaction:', error);
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ משהו השתבש. נסה שוב.`,
    });
    return { success: false };
  }

  // Learn the rule
  if (tx?.vendor) {
    await learnUserRule(ctx.userId, tx.vendor, category, type);
  }

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `✅ *${category}*`,
  });

  return await showNextTransaction(ctx, type);
}

// ============================================================================
// classifyGroup
// ============================================================================

/**
 * Classify a group of transactions (same vendor) in batch.
 * Updates all txIds at once, sends a confirmation, then shows next group.
 */
export async function classifyGroup(
  ctx: RouterContext,
  txIds: string[],
  category: string,
  type: 'income' | 'expense'
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Fetch vendor from first transaction for learning
  const { data: firstTx } = await supabase
    .from('transactions')
    .select('vendor')
    .eq('id', txIds[0])
    .single();

  // Classify all transactions in the group
  const { error } = await supabase
    .from('transactions')
    .update({
      status: 'confirmed',
      category,
      expense_category: type === 'expense' ? category : null,
      income_category: type === 'income' ? category : null,
      learned_from_pattern: false, // manually classified by user
    })
    .in('id', txIds);

  if (error) {
    console.error('[Classification] Failed to classify group:', error);
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ משהו השתבש. נסה שוב.`,
    });
    return { success: false };
  }

  // Learn the rule from the vendor
  if (firstTx?.vendor) {
    await learnUserRule(ctx.userId, firstTx.vendor, category, type);
  }

  const count = txIds.length;
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: count > 1
      ? `✅ *${category}* (${count} תנועות)`
      : `✅ *${category}*`,
  });

  return await showNextTransaction(ctx, type);
}

// ============================================================================
// showNextTransaction
// ============================================================================

/**
 * Show next income (one-by-one) or expense (grouped by vendor) transaction.
 */
export async function showNextTransaction(
  ctx: RouterContext,
  type: 'income' | 'expense'
): Promise<RouterResult> {
  // Expenses are handled as groups by vendor
  if (type === 'expense') {
    return await showNextExpenseGroup(ctx);
  }

  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Get the next pending income transaction
  const { data: nextTx } = await supabase
    .from('transactions')
    .select('id, amount, vendor, tx_date, income_category')
    .eq('user_id', ctx.userId)
    .eq('status', 'pending')
    .eq('type', 'income')
    .order('tx_date', { ascending: false })
    .limit(1)
    .single();

  if (!nextTx) {
    return await moveToNextPhase(ctx, 'income');
  }

  // Count remaining
  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .eq('status', 'pending')
    .eq('type', 'income');

  const remaining = count || 0;

  // Get suggestion: user rules first, then system suggestion
  const userRule = await getUserRuleSuggestion(ctx.userId, nextTx.vendor);
  const systemSuggestion = findBestIncomeMatch(nextTx.vendor)?.name;
  const suggestion = nextTx.income_category || userRule || systemSuggestion;
  const isLearnedSuggestion = !!userRule;

  let message = `💚 *${nextTx.vendor}*\n`;
  message += `${Math.abs(nextTx.amount).toLocaleString('he-IL')} ₪ | ${nextTx.tx_date}\n\n`;

  if (suggestion) {
    const learnedEmoji = isLearnedSuggestion ? '🧠' : '💡';
    message += `${learnedEmoji} נראה כמו: *${suggestion}*\n`;
    message += `כתוב "כן" לאשר, או כתוב קטגוריה אחרת.`;
  } else {
    message += `מה הקטגוריה?`;
  }

  message += `\n\n(נשארו ${remaining})`;

  // Save suggestion to cache for quick confirmation
  if (suggestion) {
    await saveSuggestionsToCache(ctx.userId, [suggestion]);
  }

  // Send with interactive buttons
  if (suggestion) {
    try {
      await greenAPI.sendInteractiveButtons({
        phoneNumber: ctx.phone,
        message,
        buttons: [
          { buttonId: 'confirm', buttonText: 'כן' },
          { buttonId: 'skip', buttonText: 'דלג' },
          { buttonId: 'list', buttonText: 'רשימה' },
        ],
      });
    } catch {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: message + `\n\n💡 *"רשימה"* לראות קטגוריות`,
      });
    }
  } else {
    try {
      await greenAPI.sendInteractiveButtons({
        phoneNumber: ctx.phone,
        message,
        buttons: [
          { buttonId: 'skip', buttonText: 'דלג' },
          { buttonId: 'list', buttonText: 'רשימה' },
        ],
      });
    } catch {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: message + `\n\n💡 *"רשימה"* לראות קטגוריות`,
      });
    }
  }

  return { success: true };
}

// ============================================================================
// showNextExpenseGroup
// ============================================================================

/**
 * Show the next expense group (grouped by vendor).
 * Credit card charges (visa/mastercard/etc.) are skipped and marked as needs_credit_detail.
 */
export async function showNextExpenseGroup(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Get all pending expense transactions
  const { data: expenses } = await supabase
    .from('transactions')
    .select('id, amount, vendor, tx_date, expense_category')
    .eq('user_id', ctx.userId)
    .eq('status', 'pending')
    .eq('type', 'expense')
    .order('tx_date', { ascending: false });

  if (!expenses || expenses.length === 0) {
    return await moveToNextPhase(ctx, 'expense');
  }

  // Check if first transaction is a credit card charge - skip it
  const firstTx = expenses[0];
  const isCredit = /visa|mastercard|ויזה|מסטרקארד|אשראי|כרטיס.*\d{4}$/i.test(firstTx.vendor);

  if (isCredit) {
    // Find all credit transactions and skip them in batch
    const creditTxs = expenses.filter(e =>
      /visa|mastercard|ויזה|מסטרקארד|אשראי|כרטיס.*\d{4}$/i.test(e.vendor)
    );

    const creditIds = creditTxs.map(t => t.id);

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'needs_credit_detail',
        notes: 'ממתין לדוח פירוט אשראי',
      })
      .in('id', creditIds);

    if (updateError) {
      console.error('[Classification] Failed to mark credit transactions:', updateError);
      // Fallback: mark as confirmed to avoid infinite loop
      await supabase
        .from('transactions')
        .update({ status: 'confirmed', notes: 'חיוב אשראי - דילג אוטומטית' })
        .in('id', creditIds);
    }

    if (creditTxs.length > 1) {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `⏭️ דילגתי על ${creditTxs.length} חיובי אשראי.\nשלח דוח פירוט אשראי אחרי שנסיים.`,
      });
    } else {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message:
          `⏭️ *${firstTx.vendor}* - ${Math.abs(firstTx.amount).toLocaleString('he-IL')} ₪\n` +
          `זה חיוב אשראי - צריך דוח פירוט. דילגתי.`,
      });
    }

    // Continue to next group (credit transactions already updated)
    return await showNextExpenseGroup(ctx);
  }

  // Group by vendor - take all transactions with the same vendor as the first
  const vendor = firstTx.vendor;
  const vendorTxs = expenses.filter(e => e.vendor === vendor);
  const totalAmount = vendorTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Count how many groups remain
  const uniqueVendors = new Set(expenses.map(e => e.vendor));
  const groupsRemaining = uniqueVendors.size;

  // Get suggestion: user rules first, then system suggestion
  const userRule = await getUserRuleSuggestion(ctx.userId, vendor);
  const suggestion = firstTx.expense_category || userRule || findBestMatch(vendor)?.name;
  const isLearnedSuggestion = !!userRule;

  let message = '';

  if (vendorTxs.length === 1) {
    message = `💸 *${vendor}*\n`;
    message += `${totalAmount.toLocaleString('he-IL')} ₪ | ${firstTx.tx_date}\n\n`;
  } else {
    message = `💸 *${vendor}* (${vendorTxs.length} תנועות)\n`;
    message += `סה"כ: ${totalAmount.toLocaleString('he-IL')} ₪\n\n`;

    // Show up to 3 transactions
    vendorTxs.slice(0, 3).forEach(t => {
      message += `   • ${Math.abs(t.amount).toLocaleString('he-IL')} ₪ (${t.tx_date.slice(5)})\n`;
    });
    if (vendorTxs.length > 3) {
      message += `   ...ועוד ${vendorTxs.length - 3}\n`;
    }
    message += '\n';
  }

  if (suggestion) {
    const learnedEmoji = isLearnedSuggestion ? '🧠' : '💡';
    message += `${learnedEmoji} נראה כמו: *${suggestion}*\n`;
    message += `כתוב "כן" לאשר${vendorTxs.length > 1 ? ' את כולן' : ''}, או כתוב קטגוריה אחרת.`;
  } else {
    message += `מה הקטגוריה?`;
  }

  message += `\n\n(${groupsRemaining} קבוצות נשארו)`;

  // Save current group to cache for batch classification
  await saveCurrentGroupToCache(ctx.userId, vendorTxs.map(t => t.id));

  if (suggestion) {
    await saveSuggestionsToCache(ctx.userId, [suggestion]);
  }

  // Send with interactive buttons
  if (suggestion) {
    try {
      await greenAPI.sendInteractiveButtons({
        phoneNumber: ctx.phone,
        message,
        buttons: [
          { buttonId: 'confirm', buttonText: 'כן' },
          { buttonId: 'skip', buttonText: 'דלג' },
          { buttonId: 'list', buttonText: 'רשימה' },
        ],
      });
    } catch {
      await greenAPI.sendMessage({ phoneNumber: ctx.phone, message });
    }
  } else {
    try {
      await greenAPI.sendInteractiveButtons({
        phoneNumber: ctx.phone,
        message,
        buttons: [
          { buttonId: 'skip', buttonText: 'דלג' },
          { buttonId: 'list', buttonText: 'רשימה' },
        ],
      });
    } catch {
      await greenAPI.sendMessage({ phoneNumber: ctx.phone, message });
    }
  }

  return { success: true };
}

// ============================================================================
// moveToNextPhase
// ============================================================================

/**
 * After completing income classification → check for expenses.
 * After completing expense classification → check missing documents → check needs_credit_detail → goals setup.
 */
export async function moveToNextPhase(
  ctx: RouterContext,
  completedType: 'income' | 'expense'
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const { getClassifiableTransactions, checkAndRequestMissingDocuments } = await import(
    '../classification-flow'
  );

  if (completedType === 'income') {
    // Check if there are any classifiable expenses
    const expenseTransactions = await getClassifiableTransactions(ctx.userId, 'expense');

    if (expenseTransactions.length > 0) {
      await supabase
        .from('users')
        .update({ onboarding_state: 'classification_expense' })
        .eq('id', ctx.userId);

      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `✅ *סיימנו את ההכנסות!*\n\nעכשיו נעבור על ההוצאות 💸`,
      });

      return await showNextExpenseGroup({ ...ctx, state: 'classification_expense' });
    }
  }

  // Check for missing documents first
  const hasMoreDocs = await checkAndRequestMissingDocuments(ctx.userId, ctx.phone);

  if (hasMoreDocs) {
    // Still waiting for missing documents
    return { success: true };
  }

  // No missing documents - check for pending credit transactions
  const { count: pendingCreditCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .eq('status', 'needs_credit_detail');

  if (pendingCreditCount && pendingCreditCount > 0) {
    // Credit detail required - ask user to upload credit statements
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message:
        `🎉 *סיימנו את הסיווג!*\n\n` +
        `⚠️ *רגע!* זיהיתי ${pendingCreditCount} חיובי אשראי.\n\n` +
        `📄 *שלח לי את דוחות האשראי* כדי שאראה לאן הכסף הלך.\n\n` +
        `💡 יש לך מספר כרטיסים? שלח כל אחד בנפרד.`,
    });

    // Merge into classification_context (do not overwrite other keys)
    const { data: existingUserCtx } = await supabase
      .from('users')
      .select('classification_context')
      .eq('id', ctx.userId)
      .single();

    const existingCtx = existingUserCtx?.classification_context || {};

    await supabase
      .from('users')
      .update({
        onboarding_state: 'waiting_for_document',
        classification_context: {
          ...existingCtx,
          waitingForDocument: 'credit',
          waitingReason: 'pending_credit_charges',
        },
      })
      .eq('id', ctx.userId);

    return { success: true };
  }

  // All done - move to goals setup
  return await moveToGoalsSetup(ctx);
}

// ============================================================================
// moveToGoalsSetup (internal helper)
// ============================================================================

/**
 * Transition to goals_setup state after completing classification.
 * Sends a summary message and kicks off advanced goal creation.
 */
async function moveToGoalsSetup(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Calculate totals for summary
  const { data: confirmed } = await supabase
    .from('transactions')
    .select('amount, type, category')
    .eq('user_id', ctx.userId)
    .eq('status', 'confirmed');

  const totalIncome = (confirmed || [])
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalExpenses = (confirmed || [])
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const balance = totalIncome - totalExpenses;
  const balanceEmoji = balance >= 0 ? '✨' : '📉';

  // Update state to goals_setup
  await supabase
    .from('users')
    .update({
      onboarding_state: 'goals_setup',
      phase: 'goals',
      phase_updated_at: new Date().toISOString(),
    })
    .eq('id', ctx.userId);

  // Send summary message
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
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
  await startAdvancedGoal(ctx.userId, ctx.phone);

  return { success: true, newState: 'goals_setup' };
}

// ============================================================================
// learnUserRule
// ============================================================================

/**
 * Save a learned classification rule for a vendor.
 * If the rule already exists, increment learn_count.
 * Auto-approves after 3 uses.
 */
export async function learnUserRule(
  userId: string,
  vendor: string,
  category: string,
  type: 'income' | 'expense'
): Promise<void> {
  const supabase = createServiceClient();

  // Normalize vendor - remove trailing numbers, lowercase
  const vendorPattern = normalizeVendor(vendor);

  if (!vendorPattern || vendorPattern.length < 2) {
    return; // Too short - don't save
  }

  // Check if a rule already exists for this vendor
  const { data: existingRule } = await supabase
    .from('user_category_rules')
    .select('id, category, learn_count, times_used')
    .eq('user_id', userId)
    .eq('vendor_pattern', vendorPattern)
    .single();

  if (existingRule) {
    // Update existing rule
    const newLearnCount = (existingRule.learn_count || 1) + 1;
    const autoApproved = newLearnCount >= 3; // auto-approve after 3 times

    await supabase
      .from('user_category_rules')
      .update({
        category,
        learn_count: newLearnCount,
        auto_approved: autoApproved,
        times_used: (existingRule.times_used || 0) + 1,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRule.id);

    console.log(
      `🧠 [Learning] Updated rule: "${vendorPattern}" → "${category}" (count: ${newLearnCount}, auto: ${autoApproved})`
    );
  } else {
    // Create a new rule
    await supabase.from('user_category_rules').insert({
      user_id: userId,
      vendor_pattern: vendorPattern,
      category,
      expense_frequency: type === 'expense' ? 'temporary' : null,
      confidence: 1.0,
      learn_count: 1,
      times_used: 1,
      last_used_at: new Date().toISOString(),
      auto_approved: false,
    });

    console.log(`🧠 [Learning] New rule: "${vendorPattern}" → "${category}"`);
  }
}

// ============================================================================
// getUserRuleSuggestion
// ============================================================================

/**
 * Look up a category suggestion from the user's learned rules.
 * Checks for exact vendor match first, then similar (contains) match.
 */
export async function getUserRuleSuggestion(
  userId: string,
  vendor: string
): Promise<string | null> {
  const supabase = createServiceClient();
  const vendorPattern = normalizeVendor(vendor);

  if (!vendorPattern || vendorPattern.length < 2) {
    return null;
  }

  // Try exact match
  const { data: exactRule } = await supabase
    .from('user_category_rules')
    .select('category, confidence, auto_approved')
    .eq('user_id', userId)
    .eq('vendor_pattern', vendorPattern)
    .single();

  if (exactRule) {
    console.log(`🧠 [Learning] Found exact rule: "${vendorPattern}" → "${exactRule.category}"`);
    return exactRule.category;
  }

  // Try similar match (contains)
  const { data: similarRules } = await supabase
    .from('user_category_rules')
    .select('vendor_pattern, category, confidence')
    .eq('user_id', userId)
    .order('times_used', { ascending: false })
    .limit(50);

  if (similarRules) {
    for (const rule of similarRules) {
      if (
        vendorPattern.includes(rule.vendor_pattern) ||
        rule.vendor_pattern.includes(vendorPattern)
      ) {
        console.log(
          `🧠 [Learning] Found similar rule: "${rule.vendor_pattern}" → "${rule.category}"`
        );
        return rule.category;
      }
    }
  }

  return null;
}

// ============================================================================
// autoClassifyWithRules
// ============================================================================

/**
 * Auto-classify pending transactions using learned rules (auto_approved=true).
 * Runs before manual classification to reduce the work for the user.
 * Returns the number of transactions auto-classified.
 */
async function autoClassifyWithRules(userId: string, supabase: any): Promise<number> {
  // Get auto-approved rules
  const { data: rules } = await supabase
    .from('user_category_rules')
    .select('vendor_pattern, category')
    .eq('user_id', userId)
    .eq('auto_approved', true);

  if (!rules || rules.length === 0) return 0;

  // Get pending transactions
  const { data: pending } = await supabase
    .from('transactions')
    .select('id, vendor, type')
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (!pending || pending.length === 0) return 0;

  let classified = 0;

  for (const tx of pending) {
    const txVendor = normalizeVendor(tx.vendor || '');
    if (!txVendor) continue;

    const matchingRule = rules.find((r: any) =>
      txVendor === r.vendor_pattern ||
      txVendor.includes(r.vendor_pattern) ||
      r.vendor_pattern.includes(txVendor)
    );

    if (matchingRule) {
      await supabase
        .from('transactions')
        .update({
          status: 'confirmed',
          category: matchingRule.category,
          expense_category: tx.type === 'expense' ? matchingRule.category : null,
          income_category: tx.type === 'income' ? matchingRule.category : null,
          learned_from_pattern: true,
          classified_at: new Date().toISOString(),
        })
        .eq('id', tx.id);

      classified++;
    }
  }

  return classified;
}

// ============================================================================
// AI Category Matcher (fallback when rule-based fails)
// ============================================================================

// Cache category name lists to avoid rebuilding on every call
const _expenseCategoryNames = CATEGORIES.map(c => c.name);
const _incomeCategoryNames = INCOME_CATEGORIES.map(c => c.name);

/**
 * Use Gemini Flash to match user input to a known category.
 * Only called as fallback when rule-based matching fails.
 * Has a 3-second timeout to avoid blocking the conversation.
 * Returns the matched category name or null.
 */
async function matchCategoryWithAI(
  userInput: string,
  type: 'income' | 'expense'
): Promise<string | null> {
  const categoryNames = type === 'income' ? _incomeCategoryNames : _expenseCategoryNames;

  const prompt = `אתה מנוע סיווג פיננסי. המשתמש כתב: "${userInput}"
הקטגוריות האפשריות:
${categoryNames.join(', ')}

אם ההודעה מתאימה לאחת הקטגוריות, החזר את שם הקטגוריה בדיוק כפי שהוא ברשימה.
אם ההודעה היא פקודה (כמו כן, לא, דלג, רשימה) או שאינה קטגוריה - החזר null.
החזר רק את שם הקטגוריה או null, בלי הסבר.`;

  try {
    const result = await Promise.race([
      chatWithGeminiFlashMinimal(prompt, ''),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('AI timeout')), 3000)
      ),
    ]);

    const cleaned = result.trim().replace(/^["']|["']$/g, '');

    if (cleaned === 'null' || cleaned === '' || cleaned.length > 50) {
      return null;
    }

    // Verify the AI returned an actual category from our list
    const exactMatch = categoryNames.find(n => n === cleaned);
    if (exactMatch) return exactMatch;

    // Fuzzy verify - AI might slightly vary the name
    const fuzzyMatch = categoryNames.find(n =>
      n.includes(cleaned) || cleaned.includes(n)
    );
    if (fuzzyMatch) return fuzzyMatch;

    console.log(`[AI Category] AI returned "${cleaned}" which is not in the list, ignoring`);
    return null;
  } catch (error) {
    console.log(`[AI Category] Fallback failed (${(error as Error).message}), skipping`);
    return null;
  }
}

// ============================================================================
// reopenLastClassified - undo last classification
// ============================================================================

/**
 * Reopen the most recently classified transaction (set back to pending).
 * Returns the transaction info for display, or null if nothing to reopen.
 */
async function reopenLastClassified(
  userId: string,
  type: 'income' | 'expense',
  supabase: any
): Promise<{ vendor: string; amount: number; category: string } | null> {
  // Find the most recently classified transaction (by classified_at or updated timestamp)
  const { data: lastTx } = await supabase
    .from('transactions')
    .select('id, vendor, amount, category')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .eq('type', type)
    .eq('learned_from_pattern', false)
    .order('classified_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .single();

  if (!lastTx) return null;

  // Reopen it
  await supabase
    .from('transactions')
    .update({
      status: 'pending',
      category: null,
      expense_category: null,
      income_category: null,
      notes: null,
    })
    .eq('id', lastTx.id);

  console.log(`[Classification] Reopened tx ${lastTx.id}: "${lastTx.vendor}" was "${lastTx.category}"`);

  return {
    vendor: lastTx.vendor,
    amount: lastTx.amount,
    category: lastTx.category,
  };
}
