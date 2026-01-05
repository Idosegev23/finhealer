/**
 * φ Router - Clean conversation router
 * 
 * States:
 * - waiting_for_name: צריך שם מהמשתמש
 * - waiting_for_document: מחכה למסמך PDF
 * - classification_income: מסווגים הכנסות
 * - classification_expense: מסווגים הוצאות  
 * - monitoring: סיימנו, משיבים על שאלות
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient, sendWhatsAppImage } from '@/lib/greenapi/client';
import { CATEGORIES, findBestMatch, findTopMatches } from '@/lib/finance/categories';
import { INCOME_CATEGORIES, findBestIncomeMatch, findTopIncomeMatches } from '@/lib/finance/income-categories';
import { generatePieChart } from '@/lib/ai/gemini-image-client';
import type { CategoryData } from '@/lib/ai/chart-prompts';

// ============================================================================
// Types
// ============================================================================

type UserState = 
  | 'waiting_for_name'
  | 'waiting_for_document'
  | 'classification'          // Generic classification (auto-detect income/expense)
  | 'classification_income'
  | 'classification_expense'
  | 'monitoring';

interface Transaction {
  id: string;
  amount: number;
  vendor: string;
  date: string;
  type: 'income' | 'expense';
  category?: string;
}

interface TransactionGroup {
  vendor: string;
  transactions: Transaction[];
  totalAmount: number;
}

interface RouterContext {
  userId: string;
  phone: string;
  state: UserState;
  userName: string | null;
}

interface RouterResult {
  success: boolean;
  newState?: UserState;
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
  
  console.log(`[φ Router] userId=${userId}, message="${msg}"`);
  
  // Load user
  const { data: user } = await supabase
    .from('users')
    .select('name, full_name, onboarding_state')
    .eq('id', userId)
    .single();
  
  const userName = user?.full_name || user?.name || null;
  const state = (user?.onboarding_state || 'waiting_for_name') as UserState;
  
  const ctx: RouterContext = { userId, phone, state, userName };
  
  console.log(`[φ Router] state=${state}, userName=${userName}`);
  
  // ──────────────────────────────────────────────────────────────────────────
  // STATE: waiting_for_name
  // ──────────────────────────────────────────────────────────────────────────
  if (state === 'waiting_for_name') {
    // שמור את השם
    await supabase
      .from('users')
      .update({ 
        name: msg, 
        full_name: msg,
        onboarding_state: 'waiting_for_document' 
      })
      .eq('id', userId);
    
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `נעים להכיר, ${msg}! 😊\n\n` +
        `📄 שלח לי דוח בנק (PDF) ואני אנתח את התנועות שלך.`,
    });
    
    return { success: true, newState: 'waiting_for_document' };
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // STATE: waiting_for_document
  // ──────────────────────────────────────────────────────────────────────────
  if (state === 'waiting_for_document') {
    // אם המשתמש רוצה להתחיל לסווג
    if (isCommand(msg, ['נתחיל', 'נמשיך', 'התחל', 'לסווג', 'סיווג'])) {
      return await startClassification(ctx);
    }
    
    // אחרת - מחכים למסמך
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `📄 מחכה לדוח בנק!\n\nשלח לי קובץ PDF ואני אנתח אותו.`,
    });
    
    return { success: true };
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // STATE: classification (generic - auto-detect income/expense)
  // ──────────────────────────────────────────────────────────────────────────
  if (state === 'classification') {
    // אם המשתמש רוצה להתחיל לסווג
    if (isCommand(msg, ['נתחיל', 'נמשיך', 'התחל', 'לסווג', 'סיווג', 'start_classify'])) {
      return await startClassification(ctx);
    }
    
    // אם המשתמש רוצה להוסיף עוד מסמך
    if (isCommand(msg, ['עוד דוח', 'דוח נוסף', 'add_bank', 'add_credit'])) {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `📄 מעולה! שלח לי את המסמך.`,
      });
      return { success: true };
    }
    
    // ברירת מחדל - הצג הודעת עזרה
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `*מה עכשיו?*\n\n` +
        `• כתוב *"נמשיך"* להתחיל לסווג תנועות\n` +
        `• או שלח עוד מסמך PDF`,
    });
    return { success: true };
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // STATE: classification_income
  // ──────────────────────────────────────────────────────────────────────────
  if (state === 'classification_income') {
    return await handleClassificationResponse(ctx, msg, 'income');
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // STATE: classification_expense
  // ──────────────────────────────────────────────────────────────────────────
  if (state === 'classification_expense') {
    return await handleClassificationResponse(ctx, msg, 'expense');
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // STATE: monitoring
  // ──────────────────────────────────────────────────────────────────────────
  if (state === 'monitoring') {
    // עזרה - הצג כל הפקודות
    if (isCommand(msg, ['עזרה', 'פקודות', 'help', 'תפריט', 'מה אפשר', '?'])) {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `📋 *הפקודות שלי:*\n\n` +
          `📄 *מסמכים:*\n` +
          `• שלח קובץ PDF לניתוח\n\n` +
          `📊 *גרפים:*\n` +
          `• *"גרף הוצאות"* - התפלגות הוצאות 💸\n` +
          `• *"גרף הכנסות"* - התפלגות הכנסות 💚\n\n` +
          `📋 *ניתוח:*\n` +
          `• *"סיכום"* - סיכום כללי\n` +
          `• *"רשימה"* - רשימת קטגוריות\n\n` +
          `💰 *שאלות:*\n` +
          `• "כמה הוצאתי על [קטגוריה]?"\n` +
          `• "כמה אוכל?" / "כמה רכב?"\n\n` +
          `🔄 *ניווט:*\n` +
          `• *"נמשיך"* - להמשיך תהליך\n` +
          `• *"דלג"* - לדלג על תנועה\n\n` +
          `φ *Phi - היחס הזהב של הכסף שלך*`,
      });
      return { success: true };
    }
    
    // שאלה על קטגוריה
    const categoryMatch = findBestMatch(msg);
    if (categoryMatch) {
      return await answerCategoryQuestion(ctx, categoryMatch.name);
    }
    
    // סיכום
    if (isCommand(msg, ['סיכום', 'מצב', 'סטטוס'])) {
      return await showFinalSummary(ctx);
    }
    
    // גרפים - בדיקה מפורשת
    const msgLower = msg.trim().toLowerCase();
    
    if (msgLower === 'גרף הכנסות' || msgLower === 'הכנסות גרף' || msgLower === 'income chart') {
      return await generateAndSendIncomeChart(ctx);
    }
    
    if (msgLower === 'גרף הוצאות' || msgLower === 'הוצאות גרף' || msgLower === 'גרף' || msgLower === 'expense chart') {
      return await generateAndSendExpenseChart(ctx);
    }
    
    // ברירת מחדל - הפנה לעזרה
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `לא הבנתי 🤔\n\n` +
        `כתוב *"עזרה"* לראות את כל הפקודות`,
    });
    
    return { success: true };
  }
  
  return { success: false };
}

// ============================================================================
// Classification Logic
// ============================================================================

async function startClassification(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // ספור הכנסות והוצאות
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, type')
    .eq('user_id', ctx.userId)
    .eq('status', 'proposed');
  
  const incomeCount = transactions?.filter(t => t.type === 'income').length || 0;
  const expenseCount = transactions?.filter(t => t.type === 'expense').length || 0;
  
  if (incomeCount === 0 && expenseCount === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `אין תנועות לסיווג! 🤷\n\nשלח לי דוח בנק חדש.`,
    });
    return { success: true };
  }
  
  // הודעת פתיחה
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `🎯 *בוא נעבור על התנועות ביחד!*\n\n` +
      `יש לך ${incomeCount} הכנסות ו-${expenseCount} הוצאות.\n\n` +
      (incomeCount > 0 ? `נתחיל עם ההכנסות 💚` : `נתחיל עם ההוצאות 💸`),
  });
  
  // עדכן state והצג תנועה ראשונה
  const newState = incomeCount > 0 ? 'classification_income' : 'classification_expense';
  
  await supabase
    .from('users')
    .update({ onboarding_state: newState })
    .eq('id', ctx.userId);
  
  // הצג תנועה ראשונה
  await showNextTransaction({ ...ctx, state: newState }, newState === 'classification_income' ? 'income' : 'expense');
  
  return { success: true, newState };
}

async function handleClassificationResponse(
  ctx: RouterContext, 
  msg: string,
  type: 'income' | 'expense'
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // קבל תנועה נוכחית
  const { data: currentTx } = await supabase
    .from('transactions')
    .select('id, amount, vendor, tx_date, type, expense_category')
    .eq('user_id', ctx.userId)
    .eq('status', 'proposed')
    .eq('type', type)
    .order('tx_date', { ascending: false })
    .limit(1)
    .single();
  
  if (!currentTx) {
    // אין יותר תנועות מסוג זה
    return await moveToNextPhase(ctx, type);
  }
  
  // פקודת דילוג
  if (isCommand(msg, ['דלג', 'תדלג', 'הבא', 'skip'])) {
    // בדוק אם זה אשראי
    const isCredit = /visa|mastercard|ויזה|מסטרקארד|אשראי|\d{4}$/i.test(currentTx.vendor);
    
    await supabase
      .from('transactions')
      .update({ 
        status: isCredit ? 'needs_credit_detail' : 'skipped',
        notes: isCredit ? 'ממתין לדוח פירוט אשראי' : 'דילוג משתמש'
      })
      .eq('id', currentTx.id);
    
    if (isCredit) {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `⏭️ זה חיוב כרטיס אשראי - צריך דוח פירוט לסווג.\n` +
          `שלח לי דוח אשראי אחרי שנסיים.`,
      });
    }
    
    return await showNextTransaction(ctx, type);
  }
  
  // אישור הצעה (כן / 1)
  if (isCommand(msg, ['כן', 'כנ', 'נכון', 'אשר', 'אישור', 'ok', 'yes'])) {
    const suggestions = await getSuggestionsFromCache(ctx.userId);
    if (suggestions && suggestions[0]) {
      // If it's expense grouping, classify all in group
      if (type === 'expense') {
        const groupIds = await getCurrentGroupFromCache(ctx.userId);
        if (groupIds && groupIds.length > 0) {
          return await classifyGroup(ctx, groupIds, suggestions[0], type);
        }
      }
      return await classifyTransaction(ctx, currentTx.id, suggestions[0], type);
    }
  }
  
  // בחירה מספרית (1, 2, 3)
  const numChoice = parseInt(msg);
  if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= 3) {
    const suggestions = await getSuggestionsFromCache(ctx.userId);
    if (suggestions && suggestions[numChoice - 1]) {
      // If it's expense grouping and choice is 1, classify all in group
      if (type === 'expense' && numChoice === 1) {
        const groupIds = await getCurrentGroupFromCache(ctx.userId);
        if (groupIds && groupIds.length > 0) {
          return await classifyGroup(ctx, groupIds, suggestions[numChoice - 1], type);
        }
      }
      return await classifyTransaction(ctx, currentTx.id, suggestions[numChoice - 1], type);
    }
  }
  
  // הצגת רשימת קטגוריות זמינות
  if (isCommand(msg, ['רשימה', 'קטגוריות', 'איזה קטגוריות', 'אפשרויות', 'list', 'categories'])) {
    const categories = type === 'income' ? INCOME_CATEGORIES : CATEGORIES;
    const groups = type === 'income' 
      ? Array.from(new Set(INCOME_CATEGORIES.map(c => c.group)))
      : Array.from(new Set(CATEGORIES.map(c => c.group)));
    
    // שולח כמה הודעות כדי לא לחרוג מהגבלת אורך
    const messages: string[] = [];
    let currentMsg = type === 'income' ? '💚 *קטגוריות הכנסה:*\n\n' : '💸 *קטגוריות הוצאה:*\n\n';
    
    for (const group of groups) {
      const groupCats = categories.filter(c => c.group === group);
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
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: m,
      });
    }
    return { success: true };
  }
  
  // ניסיון התאמה לקטגוריה - משתמשים בפונקציה הנכונה לפי סוג
  const match = type === 'income' 
    ? findBestIncomeMatch(msg) 
    : findBestMatch(msg);
  
  if (match) {
    // בהוצאות - סווג את כל הקבוצה
    if (type === 'expense') {
      const groupIds = await getCurrentGroupFromCache(ctx.userId);
      if (groupIds && groupIds.length > 0) {
        return await classifyGroup(ctx, groupIds, match.name, type);
      }
    }
    return await classifyTransaction(ctx, currentTx.id, match.name, type);
  }
  
  // לא מצאנו - הצע אפשרויות מהסוג הנכון
  const topMatches = type === 'income'
    ? findTopIncomeMatches(msg, 3)
    : findTopMatches(msg, 3);
    
  if (topMatches.length > 0) {
    await saveSuggestionsToCache(ctx.userId, topMatches.map(m => m.name));
    
    const list = topMatches.map((m, i) => `${i + 1}. ${m.name}`).join('\n');
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `🤔 לא מצאתי "${msg}".\n\nאולי התכוונת ל:\n${list}\n\nכתוב מספר (1-3) או נסה שוב.`,
    });
    return { success: true };
  }
  
  // באמת לא מצאנו כלום
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `🤷 לא הצלחתי למצוא קטגוריה.\n\nנסה מילה אחרת או כתוב "דלג".`,
  });
  
  return { success: true };
}

async function classifyTransaction(
  ctx: RouterContext,
  txId: string,
  category: string,
  type: 'income' | 'expense'
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // קבל את התנועה כדי לשמור את הספק ללמידה
  const { data: tx } = await supabase
    .from('transactions')
    .select('vendor')
    .eq('id', txId)
    .single();
  
  // שמור
  const { error } = await supabase
    .from('transactions')
    .update({ 
      status: 'confirmed',
      category,
      expense_category: type === 'expense' ? category : null,
      income_category: type === 'income' ? category : null,
      learned_from_pattern: false, // סומן ידנית על ידי המשתמש
    })
    .eq('id', txId);
  
  if (error) {
    console.error('[φ Router] Failed to classify:', error);
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ משהו השתבש. נסה שוב.`,
    });
    return { success: false };
  }
  
  // 🧠 למידה - שמור את הכלל ב-user_category_rules
  if (tx?.vendor) {
    await learnUserRule(ctx.userId, tx.vendor, category, type);
  }
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `✅ *${category}*`,
  });
  
  // הצג תנועה הבאה
  return await showNextTransaction(ctx, type);
}

async function classifyGroup(
  ctx: RouterContext,
  txIds: string[],
  category: string,
  type: 'income' | 'expense'
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // קבל את הספק מהתנועה הראשונה ללמידה
  const { data: firstTx } = await supabase
    .from('transactions')
    .select('vendor')
    .eq('id', txIds[0])
    .single();
  
  // סווג את כל התנועות בקבוצה
  const { error } = await supabase
    .from('transactions')
    .update({ 
      status: 'confirmed',
      category,
      expense_category: type === 'expense' ? category : null,
      income_category: type === 'income' ? category : null,
      learned_from_pattern: false, // סומן ידנית על ידי המשתמש
    })
    .in('id', txIds);
  
  if (error) {
    console.error('[φ Router] Failed to classify group:', error);
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ משהו השתבש. נסה שוב.`,
    });
    return { success: false };
  }
  
  // 🧠 למידה - שמור את הכלל ב-user_category_rules
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
  
  // הצג קבוצה הבאה
  return await showNextTransaction(ctx, type);
}

async function showNextTransaction(
  ctx: RouterContext,
  type: 'income' | 'expense'
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // בהוצאות - קבץ לפי ספק
  if (type === 'expense') {
    return await showNextExpenseGroup(ctx);
  }
  
  // בהכנסות - אחת אחת
  const { data: nextTx } = await supabase
    .from('transactions')
    .select('id, amount, vendor, tx_date, income_category')
    .eq('user_id', ctx.userId)
    .eq('status', 'proposed')
    .eq('type', 'income')
    .order('tx_date', { ascending: false })
    .limit(1)
    .single();
  
  if (!nextTx) {
    return await moveToNextPhase(ctx, 'income');
  }
  
  // ספור כמה נשארו
  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .eq('status', 'proposed')
    .eq('type', 'income');
  
  const remaining = count || 0;
  
  // 🧠 הצעת קטגוריה - קודם כללי משתמש, אחר כך כללי מערכת (הכנסות!)
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
  
  // שמור הצעה לאישור מהיר
  if (suggestion) {
    await saveSuggestionsToCache(ctx.userId, [suggestion]);
  }
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message,
  });
  
  return { success: true };
}

async function showNextExpenseGroup(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // קבל את כל ההוצאות הממתינות
  const { data: expenses } = await supabase
    .from('transactions')
    .select('id, amount, vendor, tx_date, expense_category')
    .eq('user_id', ctx.userId)
    .eq('status', 'proposed')
    .eq('type', 'expense')
    .order('tx_date', { ascending: false });
  
  if (!expenses || expenses.length === 0) {
    return await moveToNextPhase(ctx, 'expense');
  }
  
  // בדוק אם התנועה הראשונה היא אשראי - דלג אוטומטית
  const firstTx = expenses[0];
  const isCredit = /visa|mastercard|ויזה|מסטרקארד|אשראי|כרטיס.*\d{4}$/i.test(firstTx.vendor);
  
  if (isCredit) {
    // עדכן סטטוס עם בדיקת שגיאה
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ 
        status: 'needs_credit_detail',
        notes: 'ממתין לדוח פירוט אשראי'
      })
      .eq('id', firstTx.id);
    
    if (updateError) {
      console.error('[φ Router] Failed to update credit transaction:', updateError);
      // אם נכשל - סמן כ-confirmed ולא להיתקע בלולאה
      await supabase
        .from('transactions')
        .update({ status: 'confirmed', notes: 'חיוב אשראי - דילג אוטומטית' })
        .eq('id', firstTx.id);
    }
    
    // שלח הודעה רק פעם אחת (לא בכל איטרציה)
    // בדוק אם יש עוד תנועות אשראי ברצף
    const creditTxs = expenses.filter(e => 
      /visa|mastercard|ויזה|מסטרקארד|אשראי|כרטיס.*\d{4}$/i.test(e.vendor)
    );
    
    if (creditTxs.length > 1) {
      // דלג על כולם בבת אחת
      const creditIds = creditTxs.map(t => t.id);
      await supabase
        .from('transactions')
        .update({ 
          status: 'needs_credit_detail',
          notes: 'ממתין לדוח פירוט אשראי'
        })
        .in('id', creditIds);
      
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `⏭️ דילגתי על ${creditTxs.length} חיובי אשראי.\nשלח דוח פירוט אשראי אחרי שנסיים.`,
      });
    } else {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `⏭️ *${firstTx.vendor}* - ${Math.abs(firstTx.amount).toLocaleString('he-IL')} ₪\n` +
        `זה חיוב אשראי - צריך דוח פירוט. דילגתי.`,
    });
    }
    
    // המשך לבאה (התנועות כבר עודכנו)
    return await showNextExpenseGroup(ctx);
  }
  
  // קבץ לפי ספק
  const vendor = firstTx.vendor;
  const vendorTxs = expenses.filter(e => e.vendor === vendor);
  const totalAmount = vendorTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  // ספור כמה קבוצות נשארו
  const uniqueVendors = new Set(expenses.map(e => e.vendor));
  const groupsRemaining = uniqueVendors.size;
  
  // 🧠 הצעת קטגוריה - קודם כללי משתמש, אחר כך כללי מערכת
  const userRule = await getUserRuleSuggestion(ctx.userId, vendor);
  const suggestion = firstTx.expense_category || userRule || findBestMatch(vendor)?.name;
  const isLearnedSuggestion = !!userRule;
  
  let message = '';
  
  if (vendorTxs.length === 1) {
    // תנועה בודדת
    message = `💸 *${vendor}*\n`;
    message += `${totalAmount.toLocaleString('he-IL')} ₪ | ${firstTx.tx_date}\n\n`;
  } else {
    // קבוצה
    message = `💸 *${vendor}* (${vendorTxs.length} תנועות)\n`;
    message += `סה"כ: ${totalAmount.toLocaleString('he-IL')} ₪\n\n`;
    
    // הצג עד 3 תנועות
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
  
  // שמור מזהי התנועות ב-cache לסיווג קבוצתי
  await saveCurrentGroupToCache(ctx.userId, vendorTxs.map(t => t.id));
  
  if (suggestion) {
    await saveSuggestionsToCache(ctx.userId, [suggestion]);
  }
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message,
  });
  
  return { success: true };
}

async function moveToNextPhase(
  ctx: RouterContext,
  completedType: 'income' | 'expense'
): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  if (completedType === 'income') {
    // בדוק אם יש הוצאות
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId)
      .eq('status', 'proposed')
      .eq('type', 'expense');
    
    if (count && count > 0) {
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
  
  // סיימנו הכל!
  return await showFinalSummary(ctx);
}

async function showFinalSummary(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // עדכן state
  await supabase
    .from('users')
    .update({ onboarding_state: 'monitoring' })
    .eq('id', ctx.userId);
  
  // חשב סיכומים
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
  
  // קטגוריות גדולות
  const categoryTotals: Record<string, number> = {};
  (confirmed || [])
    .filter(t => t.type === 'expense' && t.category)
    .forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
    });
  
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amount]) => `• ${cat}: ${amount.toLocaleString('he-IL')} ₪`)
    .join('\n');
  
  // ספור ממתינים לפירוט
  const { count: pendingCredit } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .eq('status', 'needs_credit_detail');
  
  let message = `🎉 *סיימנו לסווג!*\n\n`;
  message += `📊 *הסיכום שלך:*\n`;
  message += `💚 הכנסות: ${totalIncome.toLocaleString('he-IL')} ₪\n`;
  message += `💸 הוצאות: ${totalExpenses.toLocaleString('he-IL')} ₪\n`;
  message += `${balanceEmoji} יתרה: ${balance.toLocaleString('he-IL')} ₪\n\n`;
  
  if (topCategories) {
    message += `*הקטגוריות הגדולות:*\n${topCategories}\n\n`;
  }
  
  if (pendingCredit && pendingCredit > 0) {
    message += `⏳ ${pendingCredit} חיובי אשראי ממתינים לדוח פירוט\n\n`;
  }
  
  message += `*מה עכשיו?*\n`;
  message += `• שלח עוד מסמך\n`;
  message += `• שאל "כמה הוצאתי על X?"\n`;
  message += `• כתוב "גרף" לראות התפלגות`;
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message,
  });
  
  return { success: true, newState: 'monitoring' };
}

/**
 * Generate and send an expense distribution pie chart
 */
async function generateAndSendExpenseChart(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // הודעת המתנה
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: '🎨 מכין את הגרף שלך...',
  });
  
  // קבל נתוני הוצאות מאושרות
  const { data: expenses } = await supabase
    .from('transactions')
    .select('category, amount')
    .eq('user_id', ctx.userId)
    .eq('status', 'confirmed')
    .eq('type', 'expense');
  
  if (!expenses || expenses.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: '😕 אין לי מספיק נתונים ליצירת גרף. שלח דוח בנק קודם.',
    });
    return { success: false };
  }
  
  // קבץ לפי קטגוריות
  const categoryTotals: Record<string, number> = {};
  let total = 0;
  
  expenses.forEach(t => {
    const cat = t.category || 'אחר';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(t.amount);
    total += Math.abs(t.amount);
  });
  
  // הכן נתונים לגרף
  const categories: CategoryData[] = Object.entries(categoryTotals)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: Math.round((amount / total) * 100),
    }));
  
  // צור את הגרף
  const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const now = new Date();
  const subtitle = `${hebrewMonths[now.getMonth()]} ${now.getFullYear()}`;
  
  try {
    const image = await generatePieChart('התפלגות הוצאות', categories, {
      subtitle,
      note: {
        title: 'φ',
        text: `סה"כ: ${total.toLocaleString('he-IL')} ₪`
      }
    });
    
    if (image && image.base64) {
      // שלח את התמונה
      await sendWhatsAppImage(
        ctx.phone,
        image.base64,
        `📊 התפלגות הוצאות - ${subtitle}\nסה"כ: ${total.toLocaleString('he-IL')} ₪`,
        image.mimeType
      );
      
      console.log('✅ Chart sent successfully');
      return { success: true };
    } else {
      throw new Error('No image generated');
    }
  } catch (error) {
    console.error('❌ Failed to generate chart:', error);
    
    // Fallback: שלח סיכום טקסטואלי
    const textSummary = categories
      .map(c => `• ${c.name}: ${c.amount.toLocaleString('he-IL')} ₪ (${c.percentage}%)`)
      .join('\n');
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📊 *התפלגות הוצאות*\n\n${textSummary}\n\n💰 סה"כ: ${total.toLocaleString('he-IL')} ₪`,
    });
    
    return { success: true };
  }
}

async function generateAndSendIncomeChart(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // שליפת הכנסות מסווגות
  const { data: incomes } = await supabase
    .from('transactions')
    .select('amount, income_category, category')
    .eq('user_id', ctx.userId)
    .eq('type', 'income')
    .eq('status', 'confirmed');
  
  if (!incomes || incomes.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: '💚 אין הכנסות מסווגות עדיין.\n\nסווג קודם כמה הכנסות!',
    });
    return { success: true };
  }
  
  // סיכום לפי קטגוריה
  const categoryTotals: Record<string, number> = {};
  incomes.forEach(inc => {
    const cat = inc.income_category || inc.category || 'אחר';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(Number(inc.amount));
  });
  
  const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
  
  // צבעי Phi למנטה/ירוקים להכנסות
  const incomeColors = ['#8FBCBB', '#88C0D0', '#81A1C1', '#5E81AC', '#A3BE8C', '#EBCB8B'];
  
  const categories: CategoryData[] = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, amount], idx) => ({
      name,
      amount,
      percentage: Math.round((amount / total) * 100),
      color: incomeColors[idx % incomeColors.length],
    }));
  
  // הודעת "מכין גרף"
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: '💚 מכין גרף הכנסות...',
  });
  
  try {
    const image = await generatePieChart(
      'התפלגות הכנסות',
      categories,
      { aspectRatio: '16:9' }
    );
    
    if (image) {
      await sendWhatsAppImage(
        ctx.phone,
        image.base64,
        `💚 *התפלגות הכנסות*\n\n💰 סה"כ: ${total.toLocaleString('he-IL')} ₪`,
        image.mimeType
      );
      
      return { success: true };
    } else {
      throw new Error('No image generated');
    }
  } catch (error) {
    console.error('❌ Failed to generate income chart:', error);
    
    // Fallback: טקסט
    const textSummary = categories
      .map(c => `• ${c.name}: ${c.amount.toLocaleString('he-IL')} ₪ (${c.percentage}%)`)
      .join('\n');
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `💚 *התפלגות הכנסות*\n\n${textSummary}\n\n💰 סה"כ: ${total.toLocaleString('he-IL')} ₪`,
    });
    
    return { success: true };
  }
}

async function answerCategoryQuestion(ctx: RouterContext, category: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  const { data: txs } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', ctx.userId)
    .eq('status', 'confirmed')
    .ilike('category', `%${category}%`);
  
  const total = (txs || []).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const count = txs?.length || 0;
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `📊 *${category}*\n\n` +
      `${count} תנועות\n` +
      `סה"כ: ${total.toLocaleString('he-IL')} ₪`,
  });
  
  return { success: true };
}

// ============================================================================
// Helpers
// ============================================================================

function isCommand(msg: string, commands: string[]): boolean {
  const lower = msg.toLowerCase().trim();
  return commands.some(cmd => lower === cmd || lower.includes(cmd));
}

// DB-based cache (persists across serverless invocations)
async function saveSuggestionsToCache(userId: string, suggestions: string[]): Promise<void> {
  const supabase = createServiceClient();
  
  // קודם נקרא את ה-context הקיים כדי לא לדרוס את group_ids
  const { data: existing } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();
  
  await supabase
    .from('users')
    .update({ 
      classification_context: { 
        ...existing?.classification_context,
        suggestions,
        updated_at: new Date().toISOString()
      }
    })
    .eq('id', userId);
}

async function getSuggestionsFromCache(userId: string): Promise<string[] | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();
  
  return data?.classification_context?.suggestions || null;
}

async function saveCurrentGroupToCache(userId: string, txIds: string[]): Promise<void> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();
  
  await supabase
    .from('users')
    .update({ 
      classification_context: {
        ...existing?.classification_context,
        group_ids: txIds,
        updated_at: new Date().toISOString()
      }
    })
    .eq('id', userId);
}

async function getCurrentGroupFromCache(userId: string): Promise<string[] | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();
  
  return data?.classification_context?.group_ids || null;
}

// ============================================================================
// Learning System - כללי משתמש
// ============================================================================

/**
 * לומד מהמשתמש - שומר כלל סיווג לספק
 * אם הספק כבר קיים - מעדכן את המונה ואת הקטגוריה
 */
async function learnUserRule(
  userId: string, 
  vendor: string, 
  category: string,
  type: 'income' | 'expense'
): Promise<void> {
  const supabase = createServiceClient();
  
  // נרמל את הספק - הסר מספרים בסוף, הפוך לאותיות קטנות
  const vendorPattern = normalizeVendor(vendor);
  
  if (!vendorPattern || vendorPattern.length < 2) {
    return; // ספק קצר מדי - לא שומרים
  }
  
  // בדוק אם יש כבר כלל לספק הזה
  const { data: existingRule } = await supabase
    .from('user_category_rules')
    .select('id, category, learn_count, times_used')
    .eq('user_id', userId)
    .eq('vendor_pattern', vendorPattern)
    .single();
  
  if (existingRule) {
    // עדכן כלל קיים
    const newLearnCount = (existingRule.learn_count || 1) + 1;
    const autoApproved = newLearnCount >= 3; // אחרי 3 פעמים - אישור אוטומטי
    
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
    
    console.log(`🧠 [Learning] Updated rule: "${vendorPattern}" → "${category}" (count: ${newLearnCount}, auto: ${autoApproved})`);
  } else {
    // צור כלל חדש
    await supabase
      .from('user_category_rules')
      .insert({
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

/**
 * מחפש הצעה מכללי המשתמש
 */
async function getUserRuleSuggestion(
  userId: string, 
  vendor: string
): Promise<string | null> {
  const supabase = createServiceClient();
  const vendorPattern = normalizeVendor(vendor);
  
  if (!vendorPattern || vendorPattern.length < 2) {
    return null;
  }
  
  // חפש כלל מדויק
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
  
  // חפש כלל דומה (contains)
  const { data: similarRules } = await supabase
    .from('user_category_rules')
    .select('vendor_pattern, category, confidence')
    .eq('user_id', userId)
    .order('times_used', { ascending: false })
    .limit(50);
  
  if (similarRules) {
    for (const rule of similarRules) {
      if (vendorPattern.includes(rule.vendor_pattern) || 
          rule.vendor_pattern.includes(vendorPattern)) {
        console.log(`🧠 [Learning] Found similar rule: "${rule.vendor_pattern}" → "${rule.category}"`);
        return rule.category;
      }
    }
  }
  
  return null;
}

/**
 * נרמול שם ספק לשמירה ככלל
 */
function normalizeVendor(vendor: string): string {
  return vendor
    .trim()
    .toLowerCase()
    // הסר מספרים בסוף (כמו מספרי סניף)
    .replace(/\s*\d+\s*$/, '')
    // הסר תווים מיוחדים
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, '')
    // הסר רווחים כפולים
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// Document Processing Hook
// ============================================================================

/**
 * Called after document processing completes
 */
export async function onDocumentProcessed(userId: string, phone: string): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // קבל את הדוח האחרון שהועלה
  const { data: latestDoc } = await supabase
    .from('uploaded_statements')
    .select('period_start, period_end, document_type, transactions_extracted')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  // ספור תנועות ממתינות
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, type, amount')
    .eq('user_id', userId)
    .eq('status', 'proposed');
  
  const incomeCount = transactions?.filter(t => t.type === 'income').length || 0;
  const expenseCount = transactions?.filter(t => t.type === 'expense').length || 0;
  const totalIncome = transactions?.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0) || 0;
  const totalExpenses = transactions?.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0) || 0;
  
  // זיהוי תקופה
  let periodText = '';
  if (latestDoc?.period_start && latestDoc?.period_end) {
    const startDate = new Date(latestDoc.period_start);
    const endDate = new Date(latestDoc.period_end);
    const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    
    const startMonth = hebrewMonths[startDate.getMonth()];
    const endMonth = hebrewMonths[endDate.getMonth()];
    const year = endDate.getFullYear();
    
    if (startDate.getMonth() === endDate.getMonth()) {
      periodText = `📅 תקופה: *${endMonth} ${year}*\n`;
    } else {
      periodText = `📅 תקופה: *${startMonth} - ${endMonth} ${year}*\n`;
    }
  }
  
  // חשב כמה חודשים יש בסך הכל
  const { data: allDocs } = await supabase
    .from('uploaded_statements')
    .select('period_start, period_end')
    .eq('user_id', userId)
    .eq('status', 'completed');
  
  // חשב כמה חודשים שונים מכוסים
  const coveredMonths = new Set<string>();
  (allDocs || []).forEach(doc => {
    if (doc.period_start && doc.period_end) {
      const start = new Date(doc.period_start);
      const end = new Date(doc.period_end);
      let current = new Date(start);
      while (current <= end) {
        coveredMonths.add(`${current.getFullYear()}-${current.getMonth()}`);
        current.setMonth(current.getMonth() + 1);
      }
    }
  });
  
  const monthsCovered = coveredMonths.size;
  const monthsNeeded = Math.max(0, 6 - monthsCovered);
  
  let progressText = '';
  if (monthsCovered >= 6) {
    progressText = `✨ יש לי ${monthsCovered} חודשים - מספיק לתמונה מלאה!`;
  } else {
    progressText = `📊 יש לי ${monthsCovered} חודשים. עוד ${monthsNeeded} ל-6 חודשים.`;
  }
  
  const message = `📊 *קיבלתי את הדוח!*\n\n` +
    periodText +
    `📝 ${incomeCount + expenseCount} תנועות\n` +
    `💚 ${incomeCount} הכנסות (${totalIncome.toLocaleString('he-IL')} ₪)\n` +
    `💸 ${expenseCount} הוצאות (${totalExpenses.toLocaleString('he-IL')} ₪)\n\n` +
    `${progressText}\n\n` +
    `*מה עכשיו?*\n` +
    `• יש לי עוד דוח בנק\n` +
    `• יש לי דוח אשראי\n` +
    `• נתחיל לסווג`;
  
  await greenAPI.sendMessage({
    phoneNumber: phone,
    message,
  });
}

