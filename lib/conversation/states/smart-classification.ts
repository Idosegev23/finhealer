/**
 * Smart Classification State — v3.1
 *
 * Replaces 1,742-line classification.ts with button-based flow:
 * 1. Auto-classify all → show summary with confidence split
 * 2. "אישור" → done
 * 3. "תיקון" → list of categories (buttons) → transactions (buttons) → alternatives (buttons)
 * Zero typing from user (except "אחר" free text).
 */

import type { RouterContext, RouterResult } from '../shared';
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient, sendWhatsAppInteractiveButtons } from '@/lib/greenapi/client';
import {
  classifyAllTransactions,
  applyClassifications,
  learnFromClassifications,
  formatSummaryForWhatsApp,
  type ClassifyAllResult,
} from '@/lib/classification/ai-classifier';
import { learnFromCorrectionV2 } from '@/lib/classification/learning-engine';
import { CATEGORIES } from '@/lib/finance/categories';

// ============================================================================
// Context keys in classification_context
// ============================================================================
const CTX_KEY = 'smart_classify';

interface SmartClassifyContext {
  result?: any; // light version of ClassifyAllResult
  mode?: 'summary' | 'category_select' | 'transaction_select' | 'alternative_select' | 'free_text';
  selectedCategory?: string;
  selectedTxId?: string;
  selectedTxVendor?: string;
  selectedTxAmount?: number;
  selectedTxOldCategory?: string;
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleSmartClassification(
  ctx: RouterContext,
  msg: string
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const trimmed = msg.trim();
  const lower = trimmed.toLowerCase();

  // Load context
  const { data: userData } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', ctx.userId)
    .single();

  const fullCtx = userData?.classification_context || {};
  const sc: SmartClassifyContext = fullCtx[CTX_KEY] || {};

  // ── START / CLASSIFY ──
  const isStart = /^(נתחיל|נמשיך|התחל|סווג|start|classify|קבל הכל|סדר הכל)$/i.test(trimmed)
    || ['start_classify', 'accept_all'].includes(lower);

  if (isStart || (!sc.result && !sc.mode)) {
    return await runClassification(ctx);
  }

  // ── APPROVE ALL ──
  if (/^(אישור|הכל נכון|מאשר|כן|אוקיי|ok|סבבה|confirm)$/i.test(trimmed)) {
    return await approveAndAdvance(ctx);
  }

  // ── START CORRECTION ──
  if (/^(תיקון|תקן|fix|לתקן|יש טעות)$/i.test(trimmed) || lower === 'fix') {
    return await showCategoryList(ctx, sc);
  }

  // ── DONE CORRECTING ──
  if (/^(סיימתי|done|חזרה|back|סיום)$/i.test(trimmed)) {
    return await approveAndAdvance(ctx);
  }

  // ── BUTTON CALLBACKS ──

  // Category selection (from list message): "cat_קניות סופר"
  if (lower.startsWith('cat_')) {
    const catName = trimmed.substring(4);
    return await showTransactionsInCategory(ctx, sc, catName);
  }

  // Transaction selection: "tx_<uuid>"
  if (lower.startsWith('tx_')) {
    const txId = trimmed.substring(3);
    return await showAlternatives(ctx, sc, txId);
  }

  // Alternative selection: "alt_<category_name>"
  if (lower.startsWith('alt_')) {
    const newCategory = trimmed.substring(4);
    return await applyCorrection(ctx, sc, newCategory);
  }

  // "More" button: "more_categories" or "more_transactions"
  if (lower === 'more_categories') {
    return await showCategoryList(ctx, sc, true);
  }

  // "Other" button → free text mode
  if (lower === 'alt_other' || lower === 'אחר') {
    await saveContext(supabase, ctx.userId, fullCtx, { ...sc, mode: 'free_text' });
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📝 כתבו שם קטגוריה (למשל: ביטוח בריאות, חיסכון, מתנה...)`,
    });
    return { success: true };
  }

  // ── FREE TEXT CATEGORY ──
  if (sc.mode === 'free_text' && sc.selectedTxId) {
    const { findBestMatch, findTopMatches } = await import('@/lib/finance/categories');
    const match = findBestMatch(trimmed);
    if (match) {
      return await applyCorrection(ctx, sc, match.name);
    }
    const top = findTopMatches(trimmed, 3);
    if (top.length > 0) {
      try {
        await sendWhatsAppInteractiveButtons(ctx.phone, {
          message: `לא מצאתי "${trimmed}". אולי:\n${top.map((t, i) => `${i + 1}. ${t.name}`).join('\n')}`,
          buttons: top.slice(0, 3).map(t => ({
            buttonId: `alt_${t.name}`,
            buttonText: t.name.substring(0, 20),
          })),
        });
      } catch {
        await greenAPI.sendMessage({
          phoneNumber: ctx.phone,
          message: `לא מצאתי "${trimmed}". נסו שם אחר.`,
        });
      }
      return { success: true };
    }
    // Use as-is if reasonable length
    if (trimmed.length >= 2 && trimmed.length <= 30) {
      return await applyCorrection(ctx, sc, trimmed);
    }
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❓ לא הצלחתי למצוא קטגוריה. נסו שם אחר, או כתבו *"סיימתי"*.`,
    });
    return { success: true };
  }

  // ── NUMERIC SELECTION (fallback for non-button environments) ──
  const num = parseInt(trimmed);
  if (!isNaN(num) && sc.mode === 'category_select' && sc.result) {
    const categories = Object.entries(sc.result.summary || {})
      .sort(([, a]: any, [, b]: any) => b.total - a.total);
    if (num >= 1 && num <= categories.length) {
      return await showTransactionsInCategory(ctx, sc, categories[num - 1][0]);
    }
  }

  // ── DEFAULT: run classification ──
  return await runClassification(ctx);
}

// ============================================================================
// Run Classification
// ============================================================================

async function runClassification(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .eq('status', 'pending');

  if (!count || count === 0) {
    const { count: totalCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId);

    if (!totalCount || totalCount === 0) {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `📄 *עוד לא קיבלתי דוחות!*\n\nשלחו דוח מהבנק או מחברת האשראי — PDF, תמונה או אקסל.`,
      });
      return { success: true };
    }
    return await approveAndAdvance(ctx);
  }

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `⏳ *מסווג ${count} תנועות...*`,
  });

  const result = await classifyAllTransactions(ctx.userId);
  await applyClassifications(ctx.userId, result.classified);
  await learnFromClassifications(ctx.userId, result.classified);

  // Save lightweight result to context
  const lightResult = {
    summary: result.summary,
    stats: result.stats,
    classified: result.classified.map(c => ({
      id: c.id, vendor: c.vendor, amount: c.amount,
      category: c.category, confidence: c.confidence,
      source: c.source, is_credit_charge: c.is_credit_charge,
    })),
    lowConfidence: result.lowConfidence.map(c => ({
      id: c.id, vendor: c.vendor, amount: c.amount, category: c.category,
    })),
  };

  const { data: userData } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', ctx.userId)
    .single();

  const fullCtx = userData?.classification_context || {};
  await saveContext(supabase, ctx.userId, fullCtx, {
    result: lightResult,
    mode: 'summary',
  });

  const summaryMsg = formatSummaryForWhatsApp(result);

  try {
    await sendWhatsAppInteractiveButtons(ctx.phone, {
      message: summaryMsg,
      buttons: [
        { buttonId: 'confirm', buttonText: 'הכל נכון ✅' },
        { buttonId: 'fix', buttonText: 'תיקון 🔧' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: summaryMsg });
  }

  return { success: true };
}

// ============================================================================
// Show Category List (button-based)
// ============================================================================

async function showCategoryList(
  ctx: RouterContext,
  sc: SmartClassifyContext,
  showAll = false
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  if (!sc.result?.summary) {
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: `אין מה לתקן 😊` });
    return { success: true };
  }

  const categories = Object.entries(sc.result.summary)
    .sort(([, a]: any, [, b]: any) => b.total - a.total);

  const maxItems = showAll ? categories.length : Math.min(8, categories.length);
  const sections = [{
    title: 'קטגוריות',
    rows: categories.slice(0, maxItems).map(([name, data]: any, i: number) => ({
      rowId: `cat_${name}`,
      title: `${name}`,
      description: `${Math.round(data.total).toLocaleString('he-IL')}₪ (${data.count})`,
    })),
  }];

  // Save mode
  const { data: userData } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', ctx.userId)
    .single();
  await saveContext(supabase, ctx.userId, userData?.classification_context || {}, {
    ...sc, mode: 'category_select',
  });

  try {
    await greenAPI.sendListMessage({
      phoneNumber: ctx.phone,
      message: '📝 בחרו קטגוריה לתיקון:',
      buttonText: 'בחירה',
      title: 'תיקון סיווג',
      sections,
    });
  } catch {
    // Fallback: numbered text
    let msg = `📝 *בחרו קטגוריה:*\n\n`;
    categories.slice(0, maxItems).forEach(([name, data]: any, i: number) => {
      msg += `${i + 1}. ${name} — ${Math.round(data.total).toLocaleString('he-IL')}₪ (${data.count})\n`;
    });
    msg += `\nשלחו מספר.`;
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg });
  }

  return { success: true };
}

// ============================================================================
// Show Transactions in Category
// ============================================================================

async function showTransactionsInCategory(
  ctx: RouterContext,
  sc: SmartClassifyContext,
  categoryName: string
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const txInCat = (sc.result?.classified || [])
    .filter((tx: any) => tx.category === categoryName && !tx.is_credit_charge)
    .slice(0, 10);

  if (txInCat.length === 0) {
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: `אין תנועות בקטגוריה "${categoryName}"` });
    return { success: true };
  }

  // Save context
  const { data: userData } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', ctx.userId)
    .single();
  await saveContext(supabase, ctx.userId, userData?.classification_context || {}, {
    ...sc, mode: 'transaction_select', selectedCategory: categoryName,
  });

  const sections = [{
    title: categoryName,
    rows: txInCat.map((tx: any) => ({
      rowId: `tx_${tx.id}`,
      title: tx.vendor || 'לא ידוע',
      description: `${Math.abs(tx.amount).toLocaleString('he-IL')}₪`,
    })),
  }];

  try {
    await greenAPI.sendListMessage({
      phoneNumber: ctx.phone,
      message: `📋 *${categoryName}:*\nבחרו תנועה לתיקון:`,
      buttonText: 'בחירה',
      title: categoryName,
      sections,
    });
  } catch {
    let msg = `📋 *${categoryName}:*\n\n`;
    txInCat.forEach((tx: any, i: number) => {
      msg += `${i + 1}. ${tx.vendor} — ${Math.abs(tx.amount).toLocaleString('he-IL')}₪\n`;
    });
    msg += `\nלתיקון: שלחו *מספר > קטגוריה חדשה*`;
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg });
  }

  return { success: true };
}

// ============================================================================
// Show Alternatives for Transaction
// ============================================================================

async function showAlternatives(
  ctx: RouterContext,
  sc: SmartClassifyContext,
  txId: string
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const tx = (sc.result?.classified || []).find((t: any) => t.id === txId);
  if (!tx) {
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: `לא מצאתי את התנועה.` });
    return { success: true };
  }

  // Generate 3 smart alternatives based on context
  const currentCat = CATEGORIES.find(c => c.name === tx.category);
  const sameGroup = currentCat
    ? CATEGORIES.filter(c => c.group === currentCat.group && c.name !== tx.category).slice(0, 2)
    : [];

  // Also add likely categories based on vendor keywords
  const { findTopMatches } = await import('@/lib/finance/categories');
  const vendorMatches = findTopMatches(tx.vendor, 3).filter(m => m.name !== tx.category);

  const alternatives = [...sameGroup, ...vendorMatches]
    .filter((v, i, arr) => arr.findIndex(a => a.name === v.name) === i) // dedupe
    .slice(0, 2);

  // Save context
  const { data: userData } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', ctx.userId)
    .single();
  await saveContext(supabase, ctx.userId, userData?.classification_context || {}, {
    ...sc,
    mode: 'alternative_select',
    selectedTxId: txId,
    selectedTxVendor: tx.vendor,
    selectedTxAmount: tx.amount,
    selectedTxOldCategory: tx.category,
  });

  const buttons = [
    ...alternatives.map(a => ({
      buttonId: `alt_${a.name}`,
      buttonText: a.name.substring(0, 20),
    })),
    { buttonId: 'alt_other', buttonText: 'אחר...' },
  ].slice(0, 3); // Max 3 buttons

  try {
    await sendWhatsAppInteractiveButtons(ctx.phone, {
      message: `🔧 *${tx.vendor}* — ${Math.abs(tx.amount).toLocaleString('he-IL')}₪\nמסווג כ: *${tx.category}*\n\nמה הסיווג הנכון?`,
      buttons,
    });
  } catch {
    let msg = `🔧 *${tx.vendor}* — ${Math.abs(tx.amount).toLocaleString('he-IL')}₪\nמסווג כ: *${tx.category}*\n\nחלופות:\n`;
    alternatives.forEach((a, i) => { msg += `${i + 1}. ${a.name}\n`; });
    msg += `\nכתבו שם קטגוריה או מספר.`;
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg });
  }

  return { success: true };
}

// ============================================================================
// Apply Correction
// ============================================================================

async function applyCorrection(
  ctx: RouterContext,
  sc: SmartClassifyContext,
  newCategory: string
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  if (!sc.selectedTxId) {
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: `❌ לא נבחרה תנועה. נסו שוב.` });
    return { success: true };
  }

  // Update DB
  await supabase
    .from('transactions')
    .update({
      category: newCategory,
      expense_category: newCategory,
      auto_categorized: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sc.selectedTxId)
    .eq('user_id', ctx.userId);

  // Learn with high confidence
  if (sc.selectedTxVendor) {
    await learnFromCorrectionV2(
      ctx.userId,
      sc.selectedTxVendor,
      sc.selectedTxAmount || 0,
      sc.selectedTxOldCategory || '',
      newCategory
    );
  }

  // Update result in context
  if (sc.result?.classified) {
    sc.result.classified = sc.result.classified.map((c: any) =>
      c.id === sc.selectedTxId ? { ...c, category: newCategory } : c
    );
    // Rebuild summary
    const newSummary: any = {};
    for (const c of sc.result.classified) {
      if (c.is_credit_charge) continue;
      if (!newSummary[c.category]) newSummary[c.category] = { total: 0, count: 0, items: [], refunds: 0 };
      newSummary[c.category].total += Math.abs(c.amount);
      newSummary[c.category].count++;
    }
    sc.result.summary = newSummary;
  }

  // Save updated context
  const { data: userData } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', ctx.userId)
    .single();
  await saveContext(supabase, ctx.userId, userData?.classification_context || {}, {
    ...sc, mode: 'summary', selectedTxId: undefined, selectedTxVendor: undefined,
  });

  try {
    await sendWhatsAppInteractiveButtons(ctx.phone, {
      message: `✅ *${sc.selectedTxVendor}* → *${newCategory}*\n\nבפעם הבאה יסווג אוטומטית.`,
      buttons: [
        { buttonId: 'fix', buttonText: 'עוד תיקון 🔧' },
        { buttonId: 'confirm', buttonText: 'סיימתי ✅' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `✅ *${sc.selectedTxVendor}* → *${newCategory}*\n\nעוד תיקון? או כתבו *"סיימתי"*`,
    });
  }

  return { success: true };
}

// ============================================================================
// Approve and Advance
// ============================================================================

async function approveAndAdvance(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // Clear context
  const { data: userData } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', ctx.userId)
    .single();
  const fullCtx = userData?.classification_context || {};
  const { [CTX_KEY]: _removed, ...restCtx } = fullCtx;
  await supabase
    .from('users')
    .update({ classification_context: Object.keys(restCtx).length > 0 ? restCtx : null })
    .eq('id', ctx.userId);

  // Calculate next phase (data-gating)
  const { calculatePhase } = await import('@/lib/services/PhaseService');
  const nextPhase = await calculatePhase(ctx.userId);

  const phaseToState: Record<string, string> = {
    data_collection: 'waiting_for_document',
    behavior: 'behavior',
    budget: 'budget',
    goals: 'goals_setup',
    monitoring: 'monitoring',
  };
  const nextState = phaseToState[nextPhase] || 'behavior';

  await supabase
    .from('users')
    .update({ onboarding_state: nextState, phase: nextPhase })
    .eq('id', ctx.userId);

  // Build smart next-step message based on data
  let msg = `✅ *הכל מסודר!*\n\n`;

  // Quick financial snapshot
  const { data: monthTx } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', ctx.userId)
    .eq('status', 'confirmed')
    .or('is_summary.is.null,is_summary.eq.false')
    .gte('tx_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);

  const income = (monthTx || []).filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);
  const expenses = (monthTx || []).filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);

  if (income > 0 || expenses > 0) {
    msg += `📊 *סיכום חודשי:*\n`;
    if (income > 0) msg += `💚 הכנסות: ${income.toLocaleString('he-IL')}₪\n`;
    msg += `💸 הוצאות: ${expenses.toLocaleString('he-IL')}₪\n`;
    if (income > 0) {
      const balance = income - expenses;
      msg += `${balance >= 0 ? '💰' : '⚠️'} יתרה: ${balance.toLocaleString('he-IL')}₪\n`;
    }
    msg += `\n`;
  }

  // Suggest next steps with clear CTAs
  if (nextPhase === 'data_collection') {
    msg += `📄 שלחו עוד דוחות — 3 חודשים אחרונים מומלץ.\nככל שיש יותר נתונים, הניתוח מדויק יותר.`;
  } else if (nextPhase === 'budget') {
    msg += `💡 *מה הלאה:*\n`;
    msg += `💰 *"תקציב"* — אבנה תקציב אוטומטי\n`;
    msg += `📊 *"סיכום"* — סיכום מלא\n`;
    msg += `✏️ *"סופר 450"* — רישום הוצאה`;
  } else {
    msg += `💡 *מה הלאה:*\n`;
    msg += `📊 *"סיכום"* — סיכום חודשי\n`;
    msg += `💰 *"תקציב"* — מצב תקציב\n`;
    msg += `🎯 *"יעדים"* — הגדרת יעדי חיסכון\n`;
    msg += `✏️ *"סופר 450"* — רישום הוצאה`;
  }

  try {
    const { sendWhatsAppInteractiveButtons } = await import('@/lib/greenapi/client');
    await sendWhatsAppInteractiveButtons(ctx.phone, {
      message: msg,
      buttons: nextPhase === 'data_collection'
        ? [{ buttonId: 'help', buttonText: 'עזרה 📋' }]
        : [
            { buttonId: 'summary', buttonText: 'סיכום 📊' },
            { buttonId: 'budget_status', buttonText: 'תקציב 💰' },
            { buttonId: 'help', buttonText: 'עזרה 📋' },
          ],
    });
  } catch {
    await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg });
  }

  return { success: true, newState: nextState as any };
}

// ============================================================================
// Context Helper
// ============================================================================

async function saveContext(
  supabase: any,
  userId: string,
  fullCtx: any,
  scData: SmartClassifyContext
): Promise<void> {
  await supabase
    .from('users')
    .update({ classification_context: { ...fullCtx, [CTX_KEY]: scData } })
    .eq('id', userId);
}
