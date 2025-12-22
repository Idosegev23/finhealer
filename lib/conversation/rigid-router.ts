/**
 * Rigid Router - לוגיקה קשיחה לניתוב הודעות
 * 
 * אין כאן AI - רק לוגיקה deterministic.
 * AI משמש רק לניסוח הודעות, לא להחלטות.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';

// ============================================================================
// Types
// ============================================================================

export type UserState = 
  | 'waiting_for_name'
  | 'waiting_for_document'
  | 'classification'
  | 'monitoring';

export interface RouterContext {
  userId: string;
  phoneNumber: string;
  state: UserState;
  userName: string | null;
  pendingTransactionsCount: number;
  currentTransaction: PendingTransaction | null;
}

export interface PendingTransaction {
  id: string;
  amount: number;
  vendor: string;
  date: string;
  type: 'income' | 'expense';
  suggestedCategory: string | null;
}

export interface RouterResult {
  success: boolean;
  newState?: UserState;
  messageSent?: boolean;
}

// ============================================================================
// Quick Commands - זיהוי מהיר של פקודות
// ============================================================================

const CONTINUE_COMMANDS = ['נמשיך', 'נמשיל', 'המשך', 'להמשיך', 'כן נמשיך', 'יאללה'];
const SKIP_COMMANDS = ['דלג', 'תדלג', 'לדלג', 'דילוג', 'עבור', 'הבא', 'skip'];
const YES_COMMANDS = ['כן', 'כנ', 'נכון', 'אוקי', 'ok', 'yes', 'בסדר', 'מאשר', 'אשר'];
const NO_COMMANDS = ['לא', 'לא נכון', 'טעות', 'שגוי', 'wrong', 'no'];
const SUMMARY_COMMANDS = ['סיכום', 'מצב', 'מה המצב', 'סטטוס', 'status'];

function matchesCommand(text: string, commands: string[]): boolean {
  const normalized = text.trim().toLowerCase();
  return commands.some(cmd => normalized.includes(cmd.toLowerCase()));
}

// ============================================================================
// Category Mapping - קטגוריות קבועות
// ============================================================================

const EXPENSE_CATEGORIES = [
  { name: 'מזון וסופר', emoji: '🍎', keywords: ['רמי לוי', 'שופרסל', 'מזון', 'סופר', 'אוכל'] },
  { name: 'מסעדות וקפה', emoji: '☕', keywords: ['קפה', 'מסעדה', 'אוכל מוכן', 'פיצה', 'המבורגר'] },
  { name: 'דיור ומשכנתא', emoji: '🏠', keywords: ['שכירות', 'משכנתא', 'ועד בית', 'ארנונה'] },
  { name: 'חשבונות קבועים', emoji: '📱', keywords: ['חשמל', 'מים', 'גז', 'אינטרנט', 'סלולר', 'בזק', 'הוט', 'פרטנר'] },
  { name: 'תחבורה ודלק', emoji: '🚗', keywords: ['דלק', 'סונול', 'פז', 'דור אלון', 'רכבת', 'אגד', 'דן'] },
  { name: 'בריאות', emoji: '🏥', keywords: ['רופא', 'בית מרקחת', 'סופר פארם', 'קופת חולים', 'מכבי', 'כללית'] },
  { name: 'ביגוד והנעלה', emoji: '👕', keywords: ['בגדים', 'נעליים', 'זארה', 'H&M', 'קסטרו', 'גולף'] },
  { name: 'בילויים ופנאי', emoji: '🎬', keywords: ['קולנוע', 'הופעה', 'בילוי', 'נטפליקס', 'ספוטיפי'] },
  { name: 'חינוך', emoji: '📚', keywords: ['גן', 'בית ספר', 'חוגים', 'קורס', 'לימודים'] },
  { name: 'ביטוח ופנסיה', emoji: '🛡️', keywords: ['ביטוח', 'פנסיה', 'מגדל', 'הראל', 'כלל'] },
];

const INCOME_CATEGORIES = [
  { name: 'משכורת', emoji: '💰', keywords: ['משכורת', 'שכר'] },
  { name: 'העברה נכנסת', emoji: '🔄', keywords: ['העברה'] },
  { name: 'הכנסה אחרת', emoji: '💵', keywords: [] },
];

function suggestCategory(vendor: string, type: 'income' | 'expense'): { name: string; emoji: string } | null {
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const vendorLower = vendor.toLowerCase();
  
  for (const cat of categories) {
    for (const keyword of cat.keywords) {
      if (vendorLower.includes(keyword.toLowerCase())) {
        return { name: cat.name, emoji: cat.emoji };
      }
    }
  }
  
  return null;
}

function findCategoryByText(text: string, type: 'income' | 'expense'): { name: string; emoji: string } | null {
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const textLower = text.toLowerCase();
  
  for (const cat of categories) {
    if (textLower.includes(cat.name.toLowerCase()) || textLower.includes(cat.emoji)) {
      return { name: cat.name, emoji: cat.emoji };
    }
  }
  
  return null;
}

// ============================================================================
// Context Loader
// ============================================================================

export async function loadRouterContext(userId: string, phoneNumber: string): Promise<RouterContext> {
  const supabase = createServiceClient();
  
  // Load user data
  const { data: user } = await supabase
    .from('users')
    .select('id, name, full_name, onboarding_state')
    .eq('id', userId)
    .single();
  
  // Load pending transactions
  const { data: pendingTx } = await supabase
    .from('transactions')
    .select('id, amount, vendor, tx_date, type, expense_category')
    .eq('user_id', userId)
    .eq('status', 'proposed')
    .order('tx_date', { ascending: false });
  
  const currentTransaction = pendingTx && pendingTx.length > 0 ? {
    id: pendingTx[0].id,
    amount: Math.abs(pendingTx[0].amount),
    vendor: pendingTx[0].vendor || 'לא ידוע',
    date: pendingTx[0].tx_date,
    type: pendingTx[0].type as 'income' | 'expense',
    suggestedCategory: pendingTx[0].expense_category || null,
  } : null;
  
  // Determine state
  let state: UserState = 'waiting_for_name';
  const userName = user?.full_name || user?.name || null;
  
  if (user?.onboarding_state) {
    state = user.onboarding_state as UserState;
  } else if (userName) {
    state = pendingTx && pendingTx.length > 0 ? 'classification' : 'waiting_for_document';
  }
  
  return {
    userId,
    phoneNumber,
    state,
    userName,
    pendingTransactionsCount: pendingTx?.length || 0,
    currentTransaction,
  };
}

// ============================================================================
// Main Router - הלוגיקה הקשיחה
// ============================================================================

export async function routeMessage(
  userId: string,
  phoneNumber: string,
  message: string
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const ctx = await loadRouterContext(userId, phoneNumber);
  
  console.log(`[Router] State: ${ctx.state}, Message: "${message.substring(0, 50)}..."`);
  
  // ============================================
  // STATE: waiting_for_name
  // ============================================
  if (ctx.state === 'waiting_for_name') {
    // כל טקסט = השם של המשתמש
    const name = message.trim();
    
    if (name.length < 2 || name.length > 50) {
      await greenAPI.sendMessage({
        phoneNumber,
        message: 'לא הצלחתי להבין את השם 🤔\n\nאפשר לכתוב את השם שלך?',
      });
      return { success: true };
    }
    
    // Save name
    await supabase
      .from('users')
      .update({ 
        name: name, 
        full_name: name,
        onboarding_state: 'waiting_for_document',
      })
      .eq('id', userId);
    
    await greenAPI.sendMessage({
      phoneNumber,
      message: `שלום ${name}! 👋\n\n` +
        `אני *φ (פאי)* - המאמן הפיננסי שלך.\n\n` +
        `📄 *עכשיו שלח לי דוח בנק* (PDF)\n` +
        `אני אנתח את התנועות ונבין ביחד לאן הכסף הולך.`,
    });
    
    return { success: true, newState: 'waiting_for_document' };
  }
  
  // ============================================
  // STATE: waiting_for_document
  // ============================================
  if (ctx.state === 'waiting_for_document') {
    // בדוק אם יש תנועות ממתינות והמשתמש רוצה להמשיך
    if (matchesCommand(message, CONTINUE_COMMANDS) && ctx.pendingTransactionsCount > 0) {
      // עבור לסיווג
      await supabase
        .from('users')
        .update({ onboarding_state: 'classification' })
        .eq('id', userId);
      
      // הצג תנועה ראשונה עם כפתורים
      return await showNextTransaction(ctx, true);
    }
    
    // הודעת עידוד לשלוח מסמך
    await greenAPI.sendMessage({
      phoneNumber,
      message: `📄 מחכה לדוח בנק!\n\n` +
        `שלח לי PDF של דוח בנק או כרטיס אשראי.\n` +
        `אני אנתח אותו ונתחיל לסווג ביחד.`,
    });
    
    return { success: true };
  }
  
  // ============================================
  // STATE: classification
  // ============================================
  if (ctx.state === 'classification') {
    // אין יותר תנועות → סיכום
    if (!ctx.currentTransaction) {
      return await showSummary(ctx);
    }
    
    // דילוג
    if (matchesCommand(message, SKIP_COMMANDS)) {
      return await skipTransaction(ctx);
    }
    
    // אישור קטגוריה מוצעת
    if (matchesCommand(message, YES_COMMANDS) && ctx.currentTransaction.suggestedCategory) {
      return await classifyTransaction(ctx, ctx.currentTransaction.suggestedCategory);
    }
    
    // חיפוש קטגוריה בהודעה
    const foundCategory = findCategoryByText(message, ctx.currentTransaction.type);
    if (foundCategory) {
      return await classifyTransaction(ctx, foundCategory.name);
    }
    
    // בדיקה אם זה buttonId (מכפתור)
    if (message.startsWith('cat_')) {
      const categoryName = message.replace('cat_', '').replace(/_/g, ' ');
      return await classifyTransaction(ctx, categoryName);
    }
    
    if (message === 'skip') {
      return await skipTransaction(ctx);
    }
    
    // לא הבנו - שאל שוב
    return await showNextTransaction(ctx, false);
  }
  
  // ============================================
  // STATE: monitoring
  // ============================================
  if (ctx.state === 'monitoring') {
    // סיכום
    if (matchesCommand(message, SUMMARY_COMMANDS)) {
      return await showSummary(ctx);
    }
    
    // שאלות אחרות - כאן נשתמש ב-AI (TODO)
    await greenAPI.sendMessage({
      phoneNumber,
      message: `📊 אני במצב ניטור.\n\n` +
        `• כתוב *"סיכום"* לסטטוס\n` +
        `• שלח *מסמך* להוספה\n` +
        `• שאל אותי שאלות על הכסף שלך`,
    });
    
    return { success: true };
  }
  
  return { success: false };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function showNextTransaction(ctx: RouterContext, isFirst: boolean): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();
  
  if (!ctx.currentTransaction) {
    return await showSummary(ctx);
  }
  
  const tx = ctx.currentTransaction;
  const emoji = tx.type === 'income' ? '💚' : '💸';
  const suggested = suggestCategory(tx.vendor, tx.type);
  
  // בניית הודעה
  let message = isFirst 
    ? `🎯 *מתחילים לסווג!*\n\n`
    : ``;
  
  message += `${emoji} *${tx.amount.toLocaleString('he-IL')} ₪* | ${tx.vendor}\n`;
  message += `📅 ${tx.date}\n\n`;
  
  if (suggested) {
    message += `💡 נראה לי כמו *${suggested.name}* ${suggested.emoji}\n`;
    message += `זה נכון?`;
  } else {
    message += `מה הקטגוריה?`;
  }
  
  // Build buttons
  const categories = tx.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES.slice(0, 3);
  const buttons = categories.map(cat => ({
    buttonId: `cat_${cat.name.replace(/ /g, '_')}`,
    buttonText: `${cat.emoji} ${cat.name}`,
  }));
  
  // Add skip button
  buttons.push({
    buttonId: 'skip',
    buttonText: '⏭️ דלג',
  });
  
  try {
    await greenAPI.sendButtons({
      phoneNumber: ctx.phoneNumber,
      message,
      buttons: buttons.slice(0, 3), // WhatsApp limits to 3 buttons
    });
  } catch (error) {
    // Fallback to text if buttons fail
    console.error('Buttons failed, falling back to text:', error);
    const buttonText = categories.map(c => `• ${c.emoji} ${c.name}`).join('\n');
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message: message + `\n\n${buttonText}\n• ⏭️ דלג`,
    });
  }
  
  return { success: true };
}

async function classifyTransaction(ctx: RouterContext, category: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  if (!ctx.currentTransaction) {
    return await showSummary(ctx);
  }
  
  // Update transaction
  await supabase
    .from('transactions')
    .update({
      status: 'confirmed',
      category: category,
      expense_category: category,
    })
    .eq('id', ctx.currentTransaction.id);
  
  // Save pattern for future
  await supabase
    .from('user_patterns')
    .upsert({
      user_id: ctx.userId,
      vendor: ctx.currentTransaction.vendor.toLowerCase(),
      category: category,
    }, { onConflict: 'user_id,vendor' });
  
  // Reload context and show next
  const newCtx = await loadRouterContext(ctx.userId, ctx.phoneNumber);
  
  if (newCtx.pendingTransactionsCount === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message: `✅ ${category}!`,
    });
    return await showSummary(newCtx);
  }
  
  // Combine confirmation with next transaction
  const remaining = newCtx.pendingTransactionsCount;
  await greenAPI.sendMessage({
    phoneNumber: ctx.phoneNumber,
    message: `✅ ${category}! (נשארו ${remaining})`,
  });
  
  return await showNextTransaction(newCtx, false);
}

async function skipTransaction(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  if (!ctx.currentTransaction) {
    return await showSummary(ctx);
  }
  
  const tx = ctx.currentTransaction;
  
  // Check if it's a credit card charge
  const isCredit = /visa|mastercard|ויזה|מסטרקארד|אשראי|\d{4}$/i.test(tx.vendor);
  
  await supabase
    .from('transactions')
    .update({
      status: isCredit ? 'needs_credit_detail' : 'skipped',
      notes: isCredit ? 'צריך פירוט אשראי' : 'דילוג משתמש',
    })
    .eq('id', tx.id);
  
  // Reload context and show next
  const newCtx = await loadRouterContext(ctx.userId, ctx.phoneNumber);
  
  if (newCtx.pendingTransactionsCount === 0) {
    if (isCredit) {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phoneNumber,
        message: `⏭️ דילגנו!\n\n💳 זה נראה כמו חיוב אשראי.\nשלח דוח כרטיס אשראי לפירוט.`,
      });
    }
    return await showSummary(newCtx);
  }
  
  const remaining = newCtx.pendingTransactionsCount;
  const skipMsg = isCredit 
    ? `⏭️ דילגנו (אשראי - צריך פירוט)`
    : `⏭️ דילגנו!`;
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phoneNumber,
    message: `${skipMsg} (נשארו ${remaining})`,
  });
  
  return await showNextTransaction(newCtx, false);
}

async function showSummary(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // Get confirmed transactions
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
  
  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  (confirmed || [])
    .filter(t => t.type === 'expense' && t.category)
    .forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
    });
  
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amount], i) => `${i + 1}. ${cat}: ${amount.toLocaleString('he-IL')} ₪`)
    .join('\n');
  
  // Update state to monitoring
  await supabase
    .from('users')
    .update({ onboarding_state: 'monitoring' })
    .eq('id', ctx.userId);
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phoneNumber,
    message: `🎉 *סיימנו לסווג!*\n\n` +
      `📊 *הסיכום שלך:*\n` +
      `💚 הכנסות: ${totalIncome.toLocaleString('he-IL')} ₪\n` +
      `💸 הוצאות: ${totalExpenses.toLocaleString('he-IL')} ₪\n` +
      `${balanceEmoji} יתרה: ${balance.toLocaleString('he-IL')} ₪\n\n` +
      (topCategories ? `*הקטגוריות הגדולות:*\n${topCategories}\n\n` : '') +
      `🎯 *עכשיו אני מכיר את התמונה!*\n` +
      `• שלח עוד מסמכים להשלמה\n` +
      `• כתוב "סיכום" לסטטוס\n` +
      `• שאל אותי שאלות`,
  });
  
  return { success: true, newState: 'monitoring' };
}

