/**
 * Rigid Router - לוגיקה קשיחה לניתוב הודעות
 * 
 * אין כאן AI - רק לוגיקה deterministic.
 * AI משמש רק לניסוח הודעות, לא להחלטות.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { CATEGORIES, SUPER_GROUPS, findBestMatch, findTopMatches, getCategoriesByGroup, getCategoryByName } from '@/lib/finance/categories';

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
const SUMMARY_COMMANDS = ['סיכום', 'מצב', 'מה המצב', 'סטטוס', 'status'];
const LIST_COMMANDS = ['רשימה', 'רשימה מלאה', 'תפריט', 'קטגוריות'];

// Cache for recent suggestions (simple in-memory, resets on deploy)
const recentSuggestions = new Map<string, { id: string; name: string }[]>();

function matchesCommand(text: string, commands: string[]): boolean {
  const normalized = text.trim().toLowerCase();
  return commands.some(cmd => normalized.includes(cmd.toLowerCase()));
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
    // 🆕 כפתור "נתחיל לסווג" או "נמשיך"
    if ((message === 'start_classify' || matchesCommand(message, CONTINUE_COMMANDS)) && ctx.pendingTransactionsCount > 0) {
      // עבור לסיווג
      await supabase
        .from('users')
        .update({ onboarding_state: 'classification' })
        .eq('id', userId);
      
      // הצג תנועה ראשונה עם כפתורים
      return await showNextTransaction(ctx, true);
    }
    
    // 🆕 כפתורים "יש עוד דוח" - פשוט אישור
    if (message === 'add_bank' || message === 'add_credit') {
      const docType = message === 'add_bank' ? 'דוח בנק' : 'דוח אשראי';
      await greenAPI.sendMessage({
        phoneNumber,
        message: `📄 מעולה! שלח לי את ה${docType}.`,
      });
      return { success: true };
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
    if (matchesCommand(message, SKIP_COMMANDS) || message === 'skip') {
      return await skipTransaction(ctx);
    }

    // בקשה לרשימה מלאה
    if (message === 'full_list' || matchesCommand(message, LIST_COMMANDS)) {
      return await showFullCategoryList(ctx);
    }
    
    // אישור קטגוריה מוצעת
    if (matchesCommand(message, YES_COMMANDS) && ctx.currentTransaction.suggestedCategory) {
      return await classifyTransaction(ctx, ctx.currentTransaction.suggestedCategory);
    }
    
    // בחירה מספרית מהצעות קודמות (1, 2, 3)
    const numChoice = parseInt(message.trim());
    if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= 3) {
      const suggestions = recentSuggestions.get(ctx.userId);
      if (suggestions && suggestions[numChoice - 1]) {
        return await classifyTransaction(ctx, suggestions[numChoice - 1].name);
      }
    }

    // בחירה מתוך רשימת קבוצות (List Message response)
    if (message.startsWith('group_')) {
      const groupName = message.replace('group_', '').replace(/_/g, ' ');
      return await showCategoriesInGroup(ctx, groupName);
    }
    
    // בדיקה אם זה buttonId (מכפתור) או rowId (מרשימה)
    if (message.startsWith('cat_')) {
      const categoryId = message; // e.g. cat_104
      // מצא את השם האמיתי לפי ID
      const catDef = CATEGORIES.find(c => c.id === categoryId);
      if (catDef) {
        return await classifyTransaction(ctx, catDef.name);
      }
      
      // fallback לניסיון פענוח שם מהטקסט (אם זה לא ID אלא שם)
      const categoryName = message.replace('cat_', '').replace(/_/g, ' ');
      return await classifyTransaction(ctx, categoryName);
    }
    
    // חיפוש קטגוריה בהודעה (טקסט חופשי)
    const foundCategory = findBestMatch(message);
    if (foundCategory) {
      return await classifyTransaction(ctx, foundCategory.name);
    }
    
    // לא מצאנו התאמה מדויקת - נחפש הצעות קרובות
    const topMatches = findTopMatches(message, 3);
    if (topMatches.length > 0) {
      // יש הצעות! נציע אותן למשתמש
      return await suggestCategories(ctx, message, topMatches);
    }
    
    // באמת לא הבנו - תן הודעה מועילה
    return await showHelpMessage(ctx, message);
  }
  
  // ============================================
  // STATE: monitoring
  // ============================================
  if (ctx.state === 'monitoring') {
    // 🆕 כפתור/פקודה סיכום
    if (message === 'summary' || matchesCommand(message, SUMMARY_COMMANDS)) {
      return await showSummary(ctx);
    }
    
    // 🆕 כפתור הוספת מסמך - חזור ל-waiting_for_document
    if (message === 'add_doc') {
      await supabase
        .from('users')
        .update({ onboarding_state: 'waiting_for_document' })
        .eq('id', userId);
      
      await greenAPI.sendMessage({
        phoneNumber,
        message: `📄 מעולה! שלח לי את המסמך.`,
      });
      return { success: true, newState: 'waiting_for_document' };
    }
    
    // 🆕 כפתור שאלה
    if (message === 'ask') {
      await greenAPI.sendMessage({
        phoneNumber,
        message: `❓ מה תרצה לדעת?\n\nלמשל:\n• "כמה הוצאתי על אוכל?"\n• "מה היתרה שלי?"\n• "איפה אני מבזבז הכי הרבה?"`,
      });
      return { success: true };
    }
    
    // שאלות טבעיות - חיפוש קטגוריה
    if (message.includes('כמה') || message.includes('הוצאתי')) {
      return await answerCategoryQuestion(ctx, message);
    }
    
    // ברירת מחדל
    await greenAPI.sendMessage({
      phoneNumber,
      message: `📊 אני כאן לעזור!\n\n• שלח *מסמך* להוספה\n• שאל "כמה הוצאתי על X?"\n• כתוב "סיכום"`,
    });
    
    return { success: true };
  }
  
  return { success: false };
}

// ============================================================================
// Helper Functions
// ============================================================================

// הצעת קטגוריות קרובות למשתמש
async function suggestCategories(
  ctx: RouterContext, 
  userInput: string, 
  suggestions: { id: string; name: string; group: string }[]
): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();
  
  const tx = ctx.currentTransaction;
  if (!tx) return await showSummary(ctx);
  
  // שמור את ההצעות ב-cache לבחירה מספרית
  recentSuggestions.set(ctx.userId, suggestions.map(s => ({ id: s.id, name: s.name })));
  
  const suggestionList = suggestions
    .map((s, i) => `${i + 1}. ${s.name}`)
    .join('\n');
  
  const message = `🤔 לא מצאתי "${userInput}" בדיוק.\n\n` +
    `אולי התכוונת ל:\n${suggestionList}\n\n` +
    `כתוב את המספר (1, 2, 3) או "רשימה" לרשימה מלאה.`;
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phoneNumber,
    message,
  });
  
  return { success: true };
}

// הודעת עזרה כשלא הבנו
async function showHelpMessage(ctx: RouterContext, userInput: string): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();
  
  const tx = ctx.currentTransaction;
  if (!tx) return await showSummary(ctx);
  
  const message = `🤷 לא הבנתי "${userInput}".\n\n` +
    `💡 נסה:\n` +
    `• לכתוב שם קטגוריה (למשל: "מזון", "דלק", "ביטוח")\n` +
    `• לכתוב "רשימה" לראות את כל הקטגוריות\n` +
    `• לכתוב "דלג" לדלג על התנועה הזו\n\n` +
    `📌 *התנועה:* ${tx.amount.toLocaleString('he-IL')} ₪ | ${tx.vendor}`;
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phoneNumber,
    message,
  });
  
  return { success: true };
}

async function showNextTransaction(ctx: RouterContext, isFirst: boolean): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();
  
  if (!ctx.currentTransaction) {
    return await showSummary(ctx);
  }
  
  const tx = ctx.currentTransaction;
  const emoji = tx.type === 'income' ? '💚' : '💸';
  const suggested = findBestMatch(tx.vendor); // שימוש בלוגיקה החדשה לחיפוש
  
  // בניית הודעה
  let message = isFirst 
    ? `🎯 *מתחילים לסווג!*\n\n`
    : ``;
  
  message += `${emoji} *${tx.amount.toLocaleString('he-IL')} ₪* | ${tx.vendor}\n`;
  message += `📅 ${tx.date}\n\n`;
  
  if (suggested) {
    message += `💡 נראה לי כמו *${suggested.name}*\n`;
    message += `זה נכון?`;
  } else {
    message += `מה הקטגוריה?`;
  }
  
  // Build buttons (Hybrid Flow)
  const buttons = [];
  
  // 1. כפתור הצעה (אם יש)
  if (suggested) {
    buttons.push({
      buttonId: suggested.id, // e.g. cat_104
      buttonText: `✅ ${suggested.name.substring(0, 18)}` // הגבלת אורך
    });
  } else {
    // או קטגוריות פופולריות אם אין זיהוי (מזון, תחבורה)
    const defaults = [getCategoryByName('קניות סופר'), getCategoryByName('מסעדות')];
    defaults.forEach(c => {
      if(c) buttons.push({ buttonId: c.id, buttonText: c.name.substring(0, 20) });
    });
  }
  
  // 2. כפתור רשימה מלאה
  buttons.push({
    buttonId: 'full_list',
    buttonText: '📂 רשימה מלאה'
  });
  
  // 3. כפתור דלג
  buttons.push({
    buttonId: 'skip',
    buttonText: '⏭️ דלג'
  });
  
  // ניסיון לשלוח עם כפתורים
  try {
    const btnResult = await greenAPI.sendButtons({
      phoneNumber: ctx.phoneNumber,
      message,
      buttons: buttons.slice(0, 3),
    });
    console.log('✅ Buttons sent successfully:', btnResult?.idMessage);
  } catch (error: any) {
    // Fallback if buttons fail - שלח הודעה רגילה עם הוראות
    console.error('❌ Buttons failed, using text fallback:', error?.message || error);
    
    // בניית הודעה טקסטואלית עם אפשרויות
    let textMessage = message + '\n\n';
    textMessage += '📝 *אפשרויות:*\n';
    
    if (suggested) {
      textMessage += `• כתוב "${suggested.name}" לאישור\n`;
    }
    textMessage += `• כתוב שם קטגוריה (למשל: "מזון", "דלק")\n`;
    textMessage += `• כתוב "רשימה" לכל הקטגוריות\n`;
    textMessage += `• כתוב "דלג" לדלג`;
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message: textMessage
    });
  }
  
  return { success: true };
}

async function showFullCategoryList(ctx: RouterContext): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();
  
  // בניית סקשנים לפי SUPER_GROUPS
  const sections = Object.entries(SUPER_GROUPS).map(([superGroup, subGroups]) => {
    return {
      title: superGroup,
      rows: subGroups.map(subGroup => ({
        rowId: `group_${subGroup.replace(/ /g, '_')}`,
        title: `📂 ${subGroup}`,
        description: 'פתח רשימה'
      }))
    };
  });

  await greenAPI.sendListMessage({
    phoneNumber: ctx.phoneNumber,
    message: 'בחר קבוצת קטגוריות:',
    buttonText: 'פתח רשימה מלאה',
    title: 'קטגוריות הוצאות',
    sections: sections
  });

  return { success: true };
}

async function showCategoriesInGroup(ctx: RouterContext, groupName: string): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();
  
  // שליפת הקטגוריות בקבוצה הזו
  const categories = getCategoriesByGroup(groupName);
  
  if (categories.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message: 'לא נמצאו קטגוריות בקבוצה זו. נסה שוב.'
    });
    return await showNextTransaction(ctx, false);
  }

  // בניית List Message עם הקטגוריות
  // חלוקה לסקשנים אם יש יותר מ-10 (וואטסאפ מגביל)
  // אבל בקבוצה בודדת בדרך כלל אין יותר מ-20
  // List Message יכול להכיל עד 10 סקשנים וסה"כ פריטים.
  // אם יש הרבה, נחלק ל-2 סקשנים
  
  const sections = [{
    title: groupName,
    rows: categories.map(c => ({
      rowId: c.id,
      title: c.name,
      description: ''
    }))
  }];

  await greenAPI.sendListMessage({
    phoneNumber: ctx.phoneNumber,
    message: `בחר קטגוריה מתוך *${groupName}*:`,
    buttonText: 'בחר קטגוריה',
    title: groupName,
    sections: sections
  });

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

async function answerCategoryQuestion(ctx: RouterContext, question: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  const matched = findBestMatch(question);
  
  if (!matched) {
    // לא מצאנו קטגוריה - הצג סיכום כללי
    return await showSummary(ctx);
  }
  
  // חפש סכום לקטגוריה
  const { data: txs } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', ctx.userId)
    .eq('status', 'confirmed')
    .eq('type', 'expense')
    .ilike('category', `%${matched.name}%`);
  
  const total = (txs || []).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phoneNumber,
    message: `💸 *${matched.name}*\n\nהוצאת ${total.toLocaleString('he-IL')} ₪`,
  });
  
  return { success: true };
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
      (topCategories ? `*הקטגוריות הגדולות:*\n${topCategories}` : ''),
  });
  
  // 🆕 כפתורים לפעולות הבאות
  try {
    await greenAPI.sendButtons({
      phoneNumber: ctx.phoneNumber,
      message: '*מה עכשיו?*',
      buttons: [
        { buttonId: 'add_doc', buttonText: '📄 להוסיף מסמך' },
        { buttonId: 'summary', buttonText: '📊 סיכום מפורט' },
        { buttonId: 'ask', buttonText: '❓ לשאול שאלה' },
      ],
    });
  } catch (btnError) {
    console.error('⚠️ Failed to send summary buttons:', btnError);
  }
  
  return { success: true, newState: 'monitoring' };
}

