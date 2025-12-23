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
  totalTransactions: number;       // Total including already classified
  currentIndex: number;            // 1-based position in classification
  currentTransaction: PendingTransaction | null;
  isInSearchMode?: boolean;        // True when user clicked "Other" and is searching
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

// Track users in search mode (clicked "Other" button)
const searchModeUsers = new Map<string, boolean>();

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
  
  // Load pending transactions (proposed status)
  const { data: pendingTx } = await supabase
    .from('transactions')
    .select('id, amount, vendor, tx_date, type, expense_category')
    .eq('user_id', userId)
    .eq('status', 'proposed')
    .order('tx_date', { ascending: false });
  
  // Count total transactions in current batch (for progress indicator)
  const { count: totalInBatch } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['proposed', 'confirmed', 'skipped', 'needs_credit_detail']);
  
  const pendingCount = pendingTx?.length || 0;
  const totalTransactions = totalInBatch || pendingCount;
  const classifiedCount = totalTransactions - pendingCount;
  const currentIndex = classifiedCount + 1; // 1-based
  
  // Build current transaction with pattern-based suggestion
  let currentTransaction: PendingTransaction | null = null;
  
  if (pendingTx && pendingTx.length > 0) {
    const tx = pendingTx[0];
    const vendor = tx.vendor || 'לא ידוע';
    
    // Check user_patterns for this vendor (learned from previous classifications)
    let suggestedCategory = tx.expense_category || null;
    
    if (!suggestedCategory && vendor !== 'לא ידוע') {
      const { data: pattern } = await supabase
        .from('user_patterns')
        .select('category')
        .eq('user_id', userId)
        .eq('vendor', vendor.toLowerCase())
        .single();
      
      if (pattern?.category) {
        suggestedCategory = pattern.category;
        console.log(`📚 Found pattern for "${vendor}": ${suggestedCategory}`);
      }
    }
    
    // If still no suggestion, try AI-based matching from categories
    if (!suggestedCategory) {
      const aiMatch = findBestMatch(vendor);
      if (aiMatch) {
        suggestedCategory = aiMatch.name;
        console.log(`🤖 AI matched "${vendor}" to: ${suggestedCategory}`);
      }
    }
    
    currentTransaction = {
      id: tx.id,
      amount: Math.abs(tx.amount),
      vendor: vendor,
      date: tx.tx_date,
      type: tx.type as 'income' | 'expense',
      suggestedCategory,
    };
  }
  
  // Determine state
  let state: UserState = 'waiting_for_name';
  const userName = user?.full_name || user?.name || null;
  
  if (user?.onboarding_state) {
    state = user.onboarding_state as UserState;
  } else if (userName) {
    state = pendingTx && pendingTx.length > 0 ? 'classification' : 'waiting_for_document';
  }
  
  // Check if user is in search mode
  const isInSearchMode = searchModeUsers.get(userId) || false;
  
  return {
    userId,
    phoneNumber,
    state,
    userName,
    pendingTransactionsCount: pendingCount,
    totalTransactions,
    currentIndex,
    currentTransaction,
    isInSearchMode,
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

    // כפתור "אחר" - כניסה למצב חיפוש
    if (message === 'other' || message === 'search') {
      searchModeUsers.set(ctx.userId, true);
      await greenAPI.sendMessage({
        phoneNumber,
        message: `🔍 *מצב חיפוש*\n\nכתוב שם קטגוריה או מילת חיפוש.\nלמשל: "ביטוח", "רכב", "מזון"\n\n💡 או כתוב "דלג" לדלג.`,
      });
      return { success: true };
    }

    // בקשה לרשימה מלאה
    if (message === 'full_list' || matchesCommand(message, LIST_COMMANDS)) {
      return await showFullCategoryList(ctx);
    }
    
    // אישור קטגוריה מוצעת (כפתור או טקסט "כן")
    if (matchesCommand(message, YES_COMMANDS) && ctx.currentTransaction.suggestedCategory) {
      return await classifyTransaction(ctx, ctx.currentTransaction.suggestedCategory);
    }
    
    // בחירה מספרית מהצעות קודמות (1-10)
    const numChoice = parseInt(message.trim());
    if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= 10) {
      // קודם בדוק אם יש בחירת קבוצות
      const groupSuggestions = recentSuggestions.get(ctx.userId + '_groups');
      if (groupSuggestions && groupSuggestions[numChoice - 1]) {
        const selectedGroup = groupSuggestions[numChoice - 1].name;
        // מצא תת-קבוצות בקבוצה הראשית
        const subGroups = SUPER_GROUPS[selectedGroup as keyof typeof SUPER_GROUPS];
        if (subGroups && subGroups.length > 0) {
          // הצג תת-קטגוריות מהקבוצה הראשונה
          return await showCategoriesInGroup(ctx, subGroups[0]);
        }
      }
      
      // אחרת, בדוק הצעות רגילות
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
    
    // אם במצב חיפוש - הצג תוצאות כהצעות
    if (ctx.isInSearchMode) {
      const topMatches = findTopMatches(message, 5);
      if (topMatches.length > 0) {
        // Store suggestions for number selection
        recentSuggestions.set(ctx.userId, topMatches.map(s => ({ id: s.id, name: s.name })));
        
        const list = topMatches.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
        try {
          await greenAPI.sendMessage({
            phoneNumber,
            message: `🔍 מצאתי ${topMatches.length} קטגוריות:\n\n${list}\n\n💡 כתוב מספר לבחירה (1-${topMatches.length})`,
          });
        } catch (e) {
          console.error('Failed to send search results:', e);
        }
        return { success: true };
      } else {
        try {
          await greenAPI.sendMessage({
            phoneNumber,
            message: `🤷 לא מצאתי "${message}".\n\nנסה מילה אחרת או כתוב "דלג".`,
          });
        } catch (e) {
          console.error('Failed to send no-match message:', e);
        }
        return { success: true };
      }
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
    `💡 כתוב מספר (1-${suggestions.length}) לבחירה`;
  
  try {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message,
    });
  } catch (error: any) {
    console.error('❌ Failed to send suggestions:', error?.message);
    return { success: false };
  }
  
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
  
  try {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message,
    });
  } catch (error: any) {
    console.error('❌ Failed to send help message:', error?.message);
    return { success: false };
  }
  
  return { success: true };
}

async function showNextTransaction(ctx: RouterContext, isFirst: boolean): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();
  
  if (!ctx.currentTransaction) {
    return await showSummary(ctx);
  }
  
  const tx = ctx.currentTransaction;
  const typeEmoji = tx.type === 'income' ? '💚' : '💸';
  const typeLabel = tx.type === 'income' ? 'הכנסה' : 'הוצאה';
  
  // Use suggestion from context (includes patterns + AI matching)
  const suggested = tx.suggestedCategory 
    ? getCategoryByName(tx.suggestedCategory) || { id: 'suggested', name: tx.suggestedCategory }
    : null;
  
  // בניית הודעה עם מונה וסוג
  const counter = `*${typeLabel} ${ctx.currentIndex} מתוך ${ctx.totalTransactions}*`;
  
  let message = isFirst 
    ? `🎯 *מתחילים לסווג!*\n\n`
    : ``;
  
  message += `${typeEmoji} ${counter}\n\n`;
  message += `*${tx.amount.toLocaleString('he-IL')} ₪* | ${tx.vendor}\n`;
  message += `📅 ${tx.date}\n\n`;
  
  // TEXT-ONLY approach (buttons are disabled by GreenAPI)
  if (suggested) {
    message += `💡 *הצעה:* ${suggested.name}\n`;
    message += `   כתוב *"כן"* לאישור\n\n`;
  }
  
  message += `📝 *אפשרויות:*\n`;
  message += `• כתוב שם קטגוריה (למשל: "מזון", "דלק", "ייעוץ")\n`;
  message += `• כתוב *"דלג"* לדלג`;
  
  // Clear search mode when showing new transaction
  searchModeUsers.delete(ctx.userId);
  
  try {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message,
    });
  } catch (error: any) {
    console.error('❌ Failed to send transaction message:', error?.message);
    return { success: false };
  }
  
  return { success: true };
}

async function showFullCategoryList(ctx: RouterContext): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();
  
  // TEXT-ONLY: הצג את הקבוצות הראשיות
  let message = `📂 *קטגוריות לבחירה:*\n\n`;
  
  // הצג את הקבוצות הראשיות עם מספרים
  const groups = Object.keys(SUPER_GROUPS);
  groups.forEach((group, i) => {
    message += `${i + 1}. ${group}\n`;
  });
  
  message += `\n💡 כתוב מספר (1-${groups.length}) לראות תת-קטגוריות`;
  message += `\nאו כתוב ישירות שם קטגוריה`;
  
  // שמור את הקבוצות לבחירה
  const groupsForSelection = groups.map((g, i) => ({ id: `group_${i}`, name: g }));
  recentSuggestions.set(ctx.userId + '_groups', groupsForSelection);
  
  try {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message,
    });
  } catch (error: any) {
    console.error('❌ Failed to send category list:', error?.message);
    return { success: false };
  }

  return { success: true };
}

async function showCategoriesInGroup(ctx: RouterContext, groupName: string): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();
  
  // שליפת הקטגוריות בקבוצה הזו
  const categories = getCategoriesByGroup(groupName);
  
  if (categories.length === 0) {
    try {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phoneNumber,
        message: 'לא נמצאו קטגוריות בקבוצה זו. נסה שוב.'
      });
    } catch (e) {
      console.error('Failed to send message:', e);
    }
    return await showNextTransaction(ctx, false);
  }

  // TEXT-ONLY: הצג את הקטגוריות ברשימה ממוספרת
  let message = `📂 *${groupName}:*\n\n`;
  
  categories.slice(0, 10).forEach((cat, i) => {
    message += `${i + 1}. ${cat.name}\n`;
  });
  
  if (categories.length > 10) {
    message += `...ועוד ${categories.length - 10} קטגוריות\n`;
  }
  
  message += `\n💡 כתוב מספר או שם קטגוריה`;
  
  // שמור לבחירה מספרית
  recentSuggestions.set(ctx.userId, categories.slice(0, 10).map(c => ({ id: c.id, name: c.name })));

  try {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message,
    });
  } catch (error: any) {
    console.error('❌ Failed to send categories in group:', error?.message);
    return { success: false };
  }

  return { success: true };
}

async function classifyTransaction(ctx: RouterContext, category: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  if (!ctx.currentTransaction) {
    return await showSummary(ctx);
  }
  
  const txId = ctx.currentTransaction.id;
  const vendor = ctx.currentTransaction.vendor;
  
  console.log(`📝 Classifying transaction ${txId} as "${category}"`);
  
  // Update transaction with error handling
  const { data: updatedTx, error: updateError } = await supabase
    .from('transactions')
    .update({
      status: 'confirmed',
      category: category,
      expense_category: category,
    })
    .eq('id', txId)
    .select('id, status')
    .single();
  
  if (updateError) {
    console.error(`❌ Failed to classify transaction ${txId}:`, updateError);
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message: `⚠️ אופס, משהו השתבש. נסה שוב.`,
    });
    return { success: false };
  }
  
  console.log(`✅ Transaction ${txId} classified as "${category}":`, updatedTx);
  
  // Save pattern for future (ignore errors - not critical)
  const { error: patternError } = await supabase
    .from('user_patterns')
    .upsert({
      user_id: ctx.userId,
      vendor: vendor.toLowerCase(),
      category: category,
    }, { onConflict: 'user_id,vendor' });
  
  if (patternError) {
    console.warn(`⚠️ Failed to save pattern for "${vendor}":`, patternError);
    // Don't fail the operation - pattern saving is nice-to-have
  } else {
    console.log(`📚 Saved pattern: "${vendor}" → "${category}"`);
  }
  
  // Clear search mode if active
  searchModeUsers.delete(ctx.userId);
  
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
  const newStatus = isCredit ? 'needs_credit_detail' : 'skipped';
  
  console.log(`⏭️ Skipping transaction ${tx.id} (${isCredit ? 'credit' : 'regular'})`);
  
  const { error: skipError } = await supabase
    .from('transactions')
    .update({
      status: newStatus,
      notes: isCredit ? 'צריך פירוט אשראי' : 'דילוג משתמש',
    })
    .eq('id', tx.id);
  
  if (skipError) {
    console.error(`❌ Failed to skip transaction ${tx.id}:`, skipError);
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message: `⚠️ אופס, משהו השתבש. נסה שוב.`,
    });
    return { success: false };
  }
  
  console.log(`✅ Transaction ${tx.id} skipped with status: ${newStatus}`);
  
  // Clear search mode if active
  searchModeUsers.delete(ctx.userId);
  
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
  
  try {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message: `💸 *${matched.name}*\n\nהוצאת ${total.toLocaleString('he-IL')} ₪`,
    });
  } catch (error: any) {
    console.error('❌ Failed to send category answer:', error?.message);
    return { success: false };
  }
  
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
  
  try {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phoneNumber,
      message: `🎉 *סיימנו לסווג!*\n\n` +
        `📊 *הסיכום שלך:*\n` +
        `💚 הכנסות: ${totalIncome.toLocaleString('he-IL')} ₪\n` +
        `💸 הוצאות: ${totalExpenses.toLocaleString('he-IL')} ₪\n` +
        `${balanceEmoji} יתרה: ${balance.toLocaleString('he-IL')} ₪\n\n` +
        (topCategories ? `*הקטגוריות הגדולות:*\n${topCategories}\n\n` : '') +
        `📝 *מה עכשיו?*\n` +
        `• שלח מסמך נוסף לניתוח\n` +
        `• כתוב "סיכום" לסיכום מפורט\n` +
        `• שאל "כמה הוצאתי על X?"`,
    });
  } catch (error: any) {
    console.error('❌ Failed to send summary:', error?.message);
    return { success: false };
  }
  
  return { success: true, newState: 'monitoring' };
}

