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
import { getGreenAPIClient, sendWhatsAppImage, sendWhatsAppInteractiveButtons } from '@/lib/greenapi/client';
import { CATEGORIES, findBestMatch, findTopMatches } from '@/lib/finance/categories';
import { INCOME_CATEGORIES, findBestIncomeMatch, findTopIncomeMatches } from '@/lib/finance/income-categories';
import { generatePieChart } from '@/lib/ai/gemini-image-client';
import type { CategoryData } from '@/lib/ai/chart-prompts';

// ============================================================================
// Types
// ============================================================================

type UserState = 
  | 'start'                   // Initial state after reset
  | 'waiting_for_name'
  | 'waiting_for_document'
  | 'classification'          // Generic classification (auto-detect income/expense)
  | 'classification_income'
  | 'classification_expense'
  | 'behavior'                // Phase 2: Behavior analysis
  | 'goals'                   // Phase 3: Goal setting
  | 'budget'                  // Phase 4: Budget creation
  | 'monitoring';

// Goal types for Phase 3
interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  priority: number;
  status: 'active' | 'completed' | 'cancelled';
  child_name?: string;
}

type GoalType = 'emergency_fund' | 'debt_payoff' | 'savings_goal' | 'general_improvement';

interface GoalCreationContext {
  step: 'type' | 'name' | 'amount' | 'deadline' | 'confirm';
  goalType?: GoalType;
  goalName?: string;
  targetAmount?: number;
  deadline?: string;
}

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
  // STATE: start (initial state after reset)
  // ──────────────────────────────────────────────────────────────────────────
  if (state === 'start') {
    // כל לחיצה/הודעה ב-state "start" מעבירה למצב המתנה למסמך
    console.log(`[φ Router] State is 'start' - transitioning to waiting_for_document`);
    
    // עדכון ל-waiting_for_document
    await supabase
      .from('users')
      .update({ onboarding_state: 'waiting_for_document' })
      .eq('id', userId);
    
    // אם יש כבר תנועות ממתינות - עבור לסיווג
    const { data: pendingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .limit(1);
    
    if (pendingTx && pendingTx.length > 0) {
      return await startClassification({ ...ctx, state: 'waiting_for_document' });
    }
    
    // אחרת - בקש מסמך
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `היי ${userName || 'שם'}! 👋\n\n` +
        `📄 שלח לי דוח בנק או אשראי (PDF/Excel) ואני אנתח את התנועות שלך.`,
    });
    
    return { success: true, newState: 'waiting_for_document' };
  }
  
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
    // אם המשתמש רוצה להתחיל לסווג (כולל טקסט כפתור ו-buttonId)
    if (isCommand(msg, ['נתחיל', 'נמשיך', 'התחל', 'לסווג', 'סיווג', 'start_classify', '▶️ נתחיל לסווג', 'נתחיל לסווג ▶️', '▶️ נמשיך לסווג', 'נמשיך לסווג ▶️'])) {
      return await startClassification(ctx);
    }
    
    // אם המשתמש רוצה להוסיף עוד מסמך (כולל buttonId)
    if (isCommand(msg, ['עוד דוח', 'דוח נוסף', 'add_bank', 'add_credit', 'add_doc', '📄 עוד דוח בנק', '💳 דוח אשראי', '📄 שלח עוד מסמך'])) {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `📄 מעולה! שלח לי את המסמך.`,
      });
      return { success: true };
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
    // אם המשתמש רוצה להתחיל לסווג (כולל טקסט כפתור)
    if (isCommand(msg, ['נתחיל', 'נמשיך', 'התחל', 'לסווג', 'סיווג', 'start_classify', '▶️ נתחיל לסווג', 'נתחיל לסווג ▶️', '▶️ נמשיך לסווג', 'נמשיך לסווג ▶️'])) {
      return await startClassification(ctx);
    }
    
    // אם המשתמש רוצה להוסיף עוד מסמך (כולל טקסט כפתור)
    if (isCommand(msg, ['עוד דוח', 'דוח נוסף', 'add_bank', 'add_credit', 'add_doc', '📄 עוד דוח בנק', 'עוד דוח בנק 📄', '💳 דוח אשראי', 'דוח אשראי 💳', '📄 שלח עוד מסמך', 'שלח עוד מסמך 📄'])) {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `📄 מעולה! שלח לי את המסמך.`,
      });
      return { success: true };
    }
    
    // ברירת מחדל - הצג הודעת עזרה עם כפתורים
    try {
      await greenAPI.sendInteractiveButtons({
        phoneNumber: phone,
        message: `יש לי תנועות שמחכות לסיווג.\nמה תרצה לעשות?`,
        header: 'מה עכשיו?',
        buttons: [
          { buttonId: 'start_classify', buttonText: 'נמשיך' },
          { buttonId: 'add_doc', buttonText: 'עוד דוח' },
        ],
      });
    } catch {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `*מה עכשיו?*\n\n` +
        `• כתוב *"נמשיך"* להתחיל לסווג תנועות\n` +
        `• או שלח עוד מסמך PDF`,
    });
    }
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
  // STATE: behavior (Phase 2)
  // ──────────────────────────────────────────────────────────────────────────
  if (state === 'behavior') {
    return await handleBehaviorPhase(ctx, msg);
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // STATE: goals (Phase 3)
  // ──────────────────────────────────────────────────────────────────────────
  if (state === 'goals') {
    return await handleGoalsPhase(ctx, msg);
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // STATE: budget (Phase 4)
  // ──────────────────────────────────────────────────────────────────────────
  if (state === 'budget') {
    return await handleBudgetPhase(ctx, msg);
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // STATE: monitoring
  // ──────────────────────────────────────────────────────────────────────────
  if (state === 'monitoring') {
    // טיפול בכפתורים - מסמכים
    if (isCommand(msg, ['add_bank', 'add_credit', 'add_doc', 'add_more', 'add_docs', '📄 עוד דוח בנק', '💳 דוח אשראי', '📄 שלח עוד מסמך', '📄 עוד מסמכים', '📄 עוד דוחות'])) {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `📄 מעולה! שלח לי את המסמך.`,
      });
      return { success: true };
    }
    
    // טיפול בכפתורים - סיווג (כולל אישור/דילוג)
    if (isCommand(msg, ['start_classify', 'נתחיל', 'נמשיך', '▶️ נתחיל לסווג', '▶️ נמשיך לסווג', 'confirm', 'skip', 'list', '✅ כן', '⏭️ דלג', '📋 רשימה', 'כן', 'דלג', 'רשימה'])) {
      return await startClassification(ctx);
    }
    
    // טיפול בכפתורים - ניתוח
    if (isCommand(msg, ['analyze', 'ניתוח', '🔍 ניתוח התנהגות'])) {
      // עבור ל-behavior ותפעיל ניתוח
      const supabase = createServiceClient();
      await supabase
        .from('users')
        .update({ onboarding_state: 'behavior' })
        .eq('id', ctx.userId);
      return await handleBehaviorPhase({ ...ctx, state: 'behavior' }, msg);
    }
    
    // טיפול בכפתורים - יעדים
    if (isCommand(msg, ['to_goals', 'יעדים', '▶️ המשך ליעדים'])) {
      return await transitionToGoals(ctx);
    }
    
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
    
    // סיכום ב-monitoring - לא משנה state!
    if (isCommand(msg, ['סיכום', 'מצב', 'סטטוס', 'summary'])) {
      return await showMonitoringSummary(ctx);
    }
    
    // תקציב - הצג יתרות
    if (isCommand(msg, ['תקציב', 'budget', 'יתרות'])) {
      return await showBudgetStatus(ctx);
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
  
  // ספור הכנסות והוצאות (pending או proposed)
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, type')
    .eq('user_id', ctx.userId)
    .in('status', ['pending', 'proposed']);
  
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
    .in('status', ['pending', 'proposed'])
    .eq('type', type)
    .order('tx_date', { ascending: false })
    .limit(1)
    .single();
  
  if (!currentTx) {
    // אין יותר תנועות מסוג זה
    return await moveToNextPhase(ctx, type);
  }
  
  // פקודת דילוג (כולל טקסט כפתור)
  if (isCommand(msg, ['דלג', 'תדלג', 'הבא', 'skip', '⏭️ דלג', 'דלג ⏭️'])) {
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
  
  // אישור הצעה (כן / 1) - כולל טקסט כפתור ו-buttonId
  if (isCommand(msg, ['כן', 'כנ', 'נכון', 'אשר', 'אישור', 'ok', 'yes', '✅ כן', 'כן ✅', 'confirm'])) {
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
  
  // הצגת רשימת קטגוריות זמינות (כולל טקסט כפתור)
  if (isCommand(msg, ['רשימה', 'קטגוריות', 'איזה קטגוריות', 'אפשרויות', 'list', 'categories', '📋 רשימה', 'רשימה 📋'])) {
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
    .in('status', ['pending', 'proposed'])
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
    .in('status', ['pending', 'proposed'])
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
  
  // 🆕 שימוש בכפתורים לסיווג הכנסות
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
      await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: message + `\n\n💡 *"רשימה"* לראות קטגוריות` });
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
      await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: message + `\n\n💡 *"רשימה"* לראות קטגוריות` });
    }
  }
  
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
    .in('status', ['pending', 'proposed'])
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
  
  // 🆕 שימוש בכפתורים לסיווג
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
    // אין הצעה - שלח רק עם כפתור רשימה
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
      .in('status', ['pending', 'proposed'])
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
  
  // עדכן state - עובר לשלב behavior (Phase 2)
  await supabase
    .from('users')
    .update({ 
      onboarding_state: 'behavior',
      current_phase: 'behavior',
      phase_updated_at: new Date().toISOString()
    })
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
  
  // 🆕 שימוש בכפתורים
  try {
    await greenAPI.sendInteractiveButtons({
      phoneNumber: ctx.phone,
      message,
      header: 'מה עכשיו?',
      buttons: [
        { buttonId: 'analyze', buttonText: 'ניתוח' },
        { buttonId: 'add_more', buttonText: 'עוד דוח' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: message + `\n\n*מה עכשיו?*\n` +
        `• כתוב *"ניתוח"* לזיהוי דפוסי הוצאה\n` +
        `• או שלח עוד מסמכים לניתוח מדויק יותר`,
    });
  }
  
  return { success: true, newState: 'behavior' };
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
  
  // לוג לדיבאג
  console.log('[isCommand] Checking: "' + lower + '" (length=' + lower.length + ')');
  
  // בדיקה ישירה
  if (commands.some(cmd => lower === cmd || lower.includes(cmd))) {
    console.log('[isCommand] Direct match found');
    return true;
  }
  
  // 🆕 בדיקה ללא אימוג'ים - מסיר הכל חוץ מעברית ואנגלית
  const textOnly = lower.replace(/[^\u0590-\u05FFa-z0-9\s]/g, '').trim();
  console.log('[isCommand] Text only: "' + textOnly + '"');
  
  if (textOnly && commands.some(cmd => {
    const cmdLower = cmd.toLowerCase();
    const cmdTextOnly = cmdLower.replace(/[^\u0590-\u05FFa-z0-9\s]/g, '').trim();
    const match = textOnly === cmdTextOnly || 
           textOnly.includes(cmdTextOnly) || 
           cmdTextOnly.includes(textOnly);
    if (match) console.log('[isCommand] Text-only match with "' + cmd + '"');
    return match;
  })) {
    return true;
  }
  
  console.log('[isCommand] No match found');
  return false;
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

// ============================================================================
// Phase 2: Behavior Analysis
// ============================================================================

import { 
  runFullAnalysis, 
  type BehaviorAnalysisResult,
  type RecurringPattern,
  type VendorTrend,
  type SpikeDetection,
  type DayPattern
} from '@/lib/analysis/behavior-engine';

/**
 * Handle behavior phase interactions
 */
async function handleBehaviorPhase(ctx: RouterContext, msg: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // פקודת ניתוח (כולל טקסט כפתור ו-buttonId)
  if (isCommand(msg, ['נתח', 'ניתוח', 'analyze', 'התחל', 'start', '🔍 ניתוח התנהגות', 'ניתוח התנהגות 🔍', 'add_more', 'add_docs'])) {
    // add_more ו-add_docs מפנים לשלוח עוד מסמכים
    if (msg === 'add_more' || msg === 'add_docs') {
      const greenAPI = getGreenAPIClient();
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `📄 מעולה! שלח לי עוד מסמך.`,
      });
      return { success: true };
    }
    return await startBehaviorAnalysis(ctx);
  }
  
  // הצגת סיכום
  if (isCommand(msg, ['סיכום', 'תובנות', 'insights', 'summary'])) {
    return await showBehaviorSummary(ctx);
  }
  
  // מעבר לשלב הבא (goals) - כולל טקסט כפתור ו-buttonId
  if (isCommand(msg, ['המשך', 'נמשיך', 'הבא', 'next', 'יעדים', 'goals', '▶️ המשך ליעדים', 'המשך ליעדים ▶️', 'to_goals'])) {
    return await transitionToGoals(ctx);
  }
  
  // עזרה
  if (isCommand(msg, ['עזרה', 'help', '?'])) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📊 *שלב 2: ניתוח התנהגות*\n\n` +
        `*פקודות:*\n` +
        `• *"ניתוח"* - הרץ ניתוח מלא\n` +
        `• *"סיכום"* - הצג תובנות\n` +
        `• *"המשך"* - עבור לשלב היעדים\n\n` +
        `φ מזהה דפוסים בהוצאות שלך`,
    });
    return { success: true };
  }
  
  // ברירת מחדל - הפעל ניתוח
  return await startBehaviorAnalysis(ctx);
}

/**
 * Start behavior analysis
 */
async function startBehaviorAnalysis(ctx: RouterContext): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `🔍 מנתח את ההתנהגות הפיננסית שלך...\n\n` +
      `זה יכול לקחת כמה שניות.`,
  });
  
  try {
    const analysis = await runFullAnalysis(ctx.userId, 3);
    return await sendBehaviorSummary(ctx, analysis);
  } catch (error) {
    console.error('[φ Router] Behavior analysis failed:', error);
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ משהו השתבש בניתוח.\n\nנסה שוב או כתוב "עזרה".`,
    });
    return { success: false };
  }
}

/**
 * Show behavior summary from existing analysis
 */
async function showBehaviorSummary(ctx: RouterContext): Promise<RouterResult> {
  try {
    const analysis = await runFullAnalysis(ctx.userId, 3);
    return await sendBehaviorSummary(ctx, analysis);
  } catch (error) {
    const greenAPI = getGreenAPIClient();
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ לא הצלחתי לטעון את הניתוח.\n\nכתוב "ניתוח" להפעיל מחדש.`,
    });
    return { success: false };
  }
}

/**
 * Send behavior summary via WhatsApp
 */
async function sendBehaviorSummary(
  ctx: RouterContext, 
  analysis: BehaviorAnalysisResult
): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();
  
  if (analysis.transactionCount === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📊 אין מספיק נתונים לניתוח.\n\n` +
        `שלח דוחות בנק וסווג את התנועות קודם.`,
    });
    return { success: true };
  }
  
  // הודעה ראשית
  let message = `📊 *ניתוח התנהגות - ${analysis.periodMonths} חודשים*\n\n`;
  
  // סיכום כללי
  message += `📈 *סיכום:*\n`;
  message += `• סה"כ הוצאות: ${analysis.summary.totalSpent.toLocaleString('he-IL')} ₪\n`;
  message += `• ממוצע חודשי: ${analysis.summary.monthlyAverage.toLocaleString('he-IL')} ₪\n`;
  message += `• קבועות: ${analysis.summary.fixedExpenses.toLocaleString('he-IL')} ₪\n`;
  message += `• משתנות: ${analysis.summary.variableExpenses.toLocaleString('he-IL')} ₪\n\n`;
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message,
  });
  
  // מנויים
  if (analysis.recurring.length > 0) {
    let recurringMsg = `🔄 *מנויים וחיובים קבועים:*\n\n`;
    
    for (const rec of analysis.recurring.slice(0, 5)) {
      const freq = rec.frequency === 'monthly' ? 'חודשי' : rec.frequency === 'weekly' ? 'שבועי' : 'רבעוני';
      recurringMsg += `• ${rec.vendor}\n`;
      recurringMsg += `   ${rec.avgAmount.toLocaleString('he-IL')} ₪/${freq}\n`;
    }
    
    recurringMsg += `\nסה"כ מנויים: ${analysis.summary.subscriptionTotal.toLocaleString('he-IL')} ₪/חודש`;
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: recurringMsg,
    });
  }
  
  // מגמות
  if (analysis.trends.length > 0) {
    let trendMsg = `📈 *מגמות:*\n\n`;
    
    for (const trend of analysis.trends.slice(0, 3)) {
      const arrow = trend.trend === 'increasing' ? '↑' : '↓';
      const emoji = trend.trend === 'increasing' ? '🔴' : '🟢';
      trendMsg += `${emoji} ${trend.vendor}: ${arrow} ${Math.abs(trend.changePercent).toFixed(0)}%\n`;
    }
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: trendMsg,
    });
  }
  
  // קפיצות
  if (analysis.spikes.length > 0) {
    let spikeMsg = `⚡ *קפיצות בולטות:*\n\n`;
    
    for (const spike of analysis.spikes.slice(0, 3)) {
      const percent = ((spike.spikeRatio - 1) * 100).toFixed(0);
      spikeMsg += `• ${spike.vendor}\n`;
      spikeMsg += `   ${spike.amount.toLocaleString('he-IL')} ₪ (${spike.date})\n`;
      spikeMsg += `   +${percent}% מהממוצע\n\n`;
    }
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: spikeMsg,
    });
  }
  
  // דפוסי יום
  const topDay = analysis.dayPatterns.find(d => d.transactionCount > 0);
  const bottomDay = [...analysis.dayPatterns].reverse().find(d => d.transactionCount > 0);
  
  if (topDay && bottomDay) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📅 *דפוסי יום:*\n\n` +
        `💸 יום ${topDay.dayName} - הכי יקר\n` +
        `   ${topDay.totalSpend.toLocaleString('he-IL')} ₪ (${topDay.topCategory || 'כללי'})\n\n` +
        `✨ יום ${bottomDay.dayName} - הכי שקט\n` +
        `   ${bottomDay.totalSpend.toLocaleString('he-IL')} ₪`,
    });
  }
  
  // 🆕 הודעת סיום עם כפתורים
  try {
    await greenAPI.sendInteractiveButtons({
      phoneNumber: ctx.phone,
      message: `מוכן לשלב הבא?\n\nφ *Phi - היחס הזהב של הכסף שלך*`,
      header: 'מה עכשיו?',
      buttons: [
        { buttonId: 'to_goals', buttonText: 'המשך' },
        { buttonId: 'add_docs', buttonText: 'עוד דוח' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `*מה עכשיו?*\n\n` +
        `• כתוב *"המשך"* לעבור לשלב היעדים\n` +
        `• או שלח עוד דוחות לניתוח מדויק יותר\n\n` +
        `φ *Phi - היחס הזהב של הכסף שלך*`,
    });
  }
  
  return { success: true };
}

/**
 * Transition from behavior phase to goals phase
 */
async function transitionToGoals(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // עדכן phase
  await supabase
    .from('users')
    .update({ 
      onboarding_state: 'goals',
      current_phase: 'goals',
      phase_updated_at: new Date().toISOString()
    })
    .eq('id', ctx.userId);
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `🎯 *שלב 3: הגדרת יעדים*\n\n` +
      `עכשיו נגדיר את היעדים הפיננסיים שלך.\n\n` +
      `*מה חשוב לך?*\n` +
      `1. חיסכון לקרן חירום\n` +
      `2. סגירת חובות\n` +
      `3. חיסכון למטרה ספציפית\n` +
      `4. שיפור מצב פיננסי כללי\n\n` +
      `כתוב מספר או תאר את היעד שלך.`,
  });
  
  return { success: true, newState: 'goals' };
}

// ============================================================================
// Goals Phase Logic (Phase 3)
// ============================================================================

/**
 * Handle goals phase interactions
 */
async function handleGoalsPhase(ctx: RouterContext, msg: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // קבל context של יצירת יעד
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', ctx.userId)
    .single();
  
  const goalContext: GoalCreationContext | null = user?.classification_context?.goalCreation || null;
  
  // פקודת התחלת יעד חדש (כולל buttonId)
  if (isCommand(msg, ['יעד חדש', 'הוסף יעד', 'צור יעד', 'new goal', 'add goal', '➕ יעד חדש', 'new_goal'])) {
    return await startNewGoal(ctx);
  }
  
  // בחירת סוג יעד (1-4)
  if (goalContext?.step === 'type') {
    return await handleGoalTypeSelection(ctx, msg);
  }
  
  // קבלת שם היעד
  if (goalContext?.step === 'name') {
    return await handleGoalNameInput(ctx, msg);
  }
  
  // קבלת סכום יעד
  if (goalContext?.step === 'amount') {
    return await handleGoalAmountInput(ctx, msg);
  }
  
  // קבלת תאריך יעד
  if (goalContext?.step === 'deadline') {
    return await handleGoalDeadlineInput(ctx, msg);
  }
  
  // אישור יעד
  if (goalContext?.step === 'confirm') {
    return await handleGoalConfirmation(ctx, msg);
  }
  
  // הצגת יעדים קיימים (כולל buttonId)
  if (isCommand(msg, ['יעדים', 'הצג יעדים', 'goals', 'רשימה', 'list', 'show_goals'])) {
    return await showUserGoals(ctx);
  }
  
  // מעבר לשלב הבא (budget) - כולל buttonId
  if (isCommand(msg, ['המשך', 'נמשיך', 'הבא', 'next', 'תקציב', 'budget', '▶️ המשך לתקציב', 'to_budget'])) {
    return await transitionToBudget(ctx);
  }
  
  // סיום הגדרת יעדים (כולל buttonId)
  if (isCommand(msg, ['סיימתי', 'done', 'מספיק', 'finish', 'finish_goals'])) {
    return await finishGoalsSetting(ctx);
  }
  
  // 🆕 זיהוי מספרים 1-4 כבחירת סוג יעד (גם אם אין goalContext)
  if (['1', '2', '3', '4'].includes(msg.trim())) {
    // שמור context ועבור ישירות לטיפול בבחירה
    await supabase
      .from('users')
      .update({
        classification_context: {
          goalCreation: { step: 'type' }
        }
      })
      .eq('id', ctx.userId);
    
    return await handleGoalTypeSelection(ctx, msg);
  }
  
  // עזרה
  if (isCommand(msg, ['עזרה', 'help', '?'])) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `🎯 *שלב 3: הגדרת יעדים*\n\n` +
        `*פקודות:*\n` +
        `• *"יעד חדש"* - הוסף יעד חדש\n` +
        `• *"יעדים"* - הצג יעדים קיימים\n` +
        `• *"סיימתי"* - סיום והמשך לתקציב\n\n` +
        `*סוגי יעדים:*\n` +
        `1️⃣ קרן חירום - רשת ביטחון\n` +
        `2️⃣ סגירת חובות - הפחתת חוב\n` +
        `3️⃣ חיסכון למטרה - רכב, חופשה, דירה\n` +
        `4️⃣ שיפור כללי - איזון תקציבי\n\n` +
        `φ *Phi - היחס הזהב של הכסף שלך*`,
    });
    return { success: true };
  }
  
  // ברירת מחדל - הצג אפשרויות
  try {
    await sendWhatsAppInteractiveButtons(ctx.phone, {
      message: `🎯 *הגדרת יעדים*\n\n` +
        `מה תרצה לעשות?`,
      header: 'שלב 3: יעדים',
      buttons: [
        { buttonId: 'new_goal', buttonText: 'יעד חדש' },
        { buttonId: 'show_goals', buttonText: 'יעדים' },
        { buttonId: 'finish_goals', buttonText: 'סיימתי' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `🎯 *הגדרת יעדים*\n\n` +
        `*אפשרויות:*\n` +
        `• כתוב *"יעד חדש"* להוספת יעד\n` +
        `• כתוב *"יעדים"* לראות את היעדים שלך\n` +
        `• כתוב *"סיימתי"* להמשיך לתקציב`,
    });
  }
  
  return { success: true };
}

/**
 * Start creating a new goal
 */
async function startNewGoal(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // שמור context
  await supabase
    .from('users')
    .update({
      classification_context: {
        goalCreation: { step: 'type' }
      }
    })
    .eq('id', ctx.userId);
  
  try {
    await sendWhatsAppInteractiveButtons(ctx.phone, {
      message: `🎯 *יעד חדש*\n\n` +
        `איזה סוג יעד?\n\n` +
        `1️⃣ *קרן חירום* - 3-6 חודשי הוצאות\n` +
        `2️⃣ *סגירת חובות* - הפחתת חוב\n` +
        `3️⃣ *חיסכון למטרה* - רכב, חופשה, דירה\n` +
        `4️⃣ *שיפור כללי* - איזון תקציבי`,
      header: 'בחר סוג יעד',
      buttons: [
        { buttonId: 'goal_emergency', buttonText: 'קרן חירום' },
        { buttonId: 'goal_debt', buttonText: 'סגירת חובות' },
        { buttonId: 'goal_savings', buttonText: 'חיסכון' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `🎯 *יעד חדש*\n\n` +
        `איזה סוג יעד?\n\n` +
        `1️⃣ *קרן חירום* - 3-6 חודשי הוצאות\n` +
        `2️⃣ *סגירת חובות* - הפחתת חוב\n` +
        `3️⃣ *חיסכון למטרה* - רכב, חופשה, דירה\n` +
        `4️⃣ *שיפור כללי* - איזון תקציבי\n\n` +
        `כתוב מספר (1-4) או תאר את היעד`,
    });
  }
  
  return { success: true };
}

/**
 * Handle goal type selection
 */
async function handleGoalTypeSelection(ctx: RouterContext, msg: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  let goalType: GoalType;
  let goalName: string;
  
  const msgLower = msg.toLowerCase();
  
  // זיהוי סוג יעד
  if (msg === '1' || isCommand(msg, ['קרן חירום', 'חירום', 'emergency', 'goal_emergency', '🛡️ קרן חירום'])) {
    goalType = 'emergency_fund';
    goalName = 'קרן חירום';
  } else if (msg === '2' || isCommand(msg, ['סגירת חובות', 'חובות', 'debt', 'goal_debt', '💳 סגירת חובות'])) {
    goalType = 'debt_payoff';
    goalName = 'סגירת חובות';
  } else if (msg === '3' || isCommand(msg, ['חיסכון', 'מטרה', 'savings', 'goal_savings', '🎯 חיסכון למטרה'])) {
    goalType = 'savings_goal';
    // נבקש שם ספציפי
    await supabase
      .from('users')
      .update({
        classification_context: {
          goalCreation: { step: 'name', goalType: 'savings_goal' }
        }
      })
      .eq('id', ctx.userId);
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `🎯 *חיסכון למטרה*\n\n` +
        `למה אתה חוסך?\n\n` +
        `דוגמאות:\n` +
        `• רכב חדש 🚗\n` +
        `• חופשה משפחתית ✈️\n` +
        `• מקדמה לדירה 🏠\n` +
        `• לימודים 📚\n` +
        `• חתונה / אירוע 💒\n\n` +
        `כתוב את שם המטרה:`,
    });
    return { success: true };
  } else if (msg === '4' || isCommand(msg, ['שיפור', 'כללי', 'general', 'איזון'])) {
    goalType = 'general_improvement';
    goalName = 'שיפור מצב פיננסי';
  } else {
    // לא זוהה - נקח את הטקסט כשם יעד
    goalType = 'savings_goal';
    goalName = msg;
  }
  
  // עבור ליעד עם סכום קבוע או בקש סכום
  if (goalType === 'emergency_fund') {
    // חשב סכום מומלץ לקרן חירום
    const { data: profile } = await supabase
      .from('user_financial_profile')
      .select('total_fixed_expenses')
      .eq('user_id', ctx.userId)
      .single();
    
    const monthlyExpenses = profile?.total_fixed_expenses || 10000;
    const recommendedAmount = Math.round(monthlyExpenses * 3);
    
    await supabase
      .from('users')
      .update({
        classification_context: {
          goalCreation: { 
            step: 'amount', 
            goalType,
            goalName,
            recommendedAmount
          }
        }
      })
      .eq('id', ctx.userId);
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `🛡️ *קרן חירום*\n\n` +
        `מומלץ: 3-6 חודשי הוצאות\n` +
        `הערכה לפי הנתונים שלך: *${recommendedAmount.toLocaleString('he-IL')} ₪*\n\n` +
        `כמה תרצה לחסוך?\n` +
        `(כתוב סכום או *"אשר"* לסכום המומלץ)`,
    });
  } else if (goalType === 'debt_payoff') {
    // הצג חובות קיימים
    const { data: loans } = await supabase
      .from('loans')
      .select('id, lender_name, current_balance, monthly_payment')
      .eq('user_id', ctx.userId)
      .eq('active', true);
    
    let debtMessage = `💳 *סגירת חובות*\n\n`;
    
    if (loans && loans.length > 0) {
      debtMessage += `החובות שלך:\n`;
      let totalDebt = 0;
      for (const loan of loans) {
        debtMessage += `• ${loan.lender_name}: ${loan.current_balance?.toLocaleString('he-IL')} ₪\n`;
        totalDebt += loan.current_balance || 0;
      }
      debtMessage += `\n*סה"כ: ${totalDebt.toLocaleString('he-IL')} ₪*\n\n`;
      debtMessage += `כמה תרצה לסגור?\n(כתוב סכום)`;
      
      await supabase
        .from('users')
        .update({
          classification_context: {
            goalCreation: { 
              step: 'amount', 
              goalType,
              goalName,
              totalDebt
            }
          }
        })
        .eq('id', ctx.userId);
    } else {
      debtMessage += `לא מצאתי הלוואות במערכת.\n\n`;
      debtMessage += `כמה חוב תרצה לסגור?\n(כתוב סכום)`;
      
      await supabase
        .from('users')
        .update({
          classification_context: {
            goalCreation: { step: 'amount', goalType, goalName }
          }
        })
        .eq('id', ctx.userId);
    }
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: debtMessage,
    });
  } else if (goalType === 'general_improvement') {
    // יעד כללי - אין צורך בסכום ספציפי
    await supabase
      .from('goals')
      .insert({
        user_id: ctx.userId,
        name: goalName,
        target_amount: 0,
        current_amount: 0,
        priority: 1,
        status: 'active',
      });
    
    // נקה context
    await supabase
      .from('users')
      .update({ classification_context: {} })
      .eq('id', ctx.userId);
    
    try {
      await sendWhatsAppInteractiveButtons(ctx.phone, {
        message: `✅ *נרשם!*\n\n` +
          `יעד: *${goalName}*\n\n` +
          `זה יעד כיווני - φ יעזור לך להשתפר בהדרגה.`,
        header: 'יעד נוסף?',
        buttons: [
          { buttonId: 'new_goal', buttonText: 'יעד חדש' },
          { buttonId: 'finish_goals', buttonText: 'סיימתי' },
        ],
      });
    } catch {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `✅ *נרשם!*\n\n` +
          `יעד: *${goalName}*\n\n` +
          `זה יעד כיווני - φ יעזור לך להשתפר בהדרגה.\n\n` +
          `• כתוב *"יעד חדש"* להוסיף עוד\n` +
          `• כתוב *"סיימתי"* להמשיך`,
      });
    }
  } else {
    // חיסכון למטרה ספציפית - כבר טופל למעלה
    await supabase
      .from('users')
      .update({
        classification_context: {
          goalCreation: { step: 'amount', goalType, goalName }
        }
      })
      .eq('id', ctx.userId);
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `🎯 *${goalName}*\n\n` +
        `כמה כסף צריך ליעד הזה?\n` +
        `(כתוב סכום בשקלים)`,
    });
  }
  
  return { success: true };
}

/**
 * Handle goal name input (for savings_goal)
 */
async function handleGoalNameInput(ctx: RouterContext, msg: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  const goalName = msg.trim();
  
  await supabase
    .from('users')
    .update({
      classification_context: {
        goalCreation: { 
          step: 'amount', 
          goalType: 'savings_goal',
          goalName
        }
      }
    })
    .eq('id', ctx.userId);
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `🎯 *${goalName}*\n\n` +
      `כמה כסף צריך?\n` +
      `(כתוב סכום בשקלים)`,
  });
  
  return { success: true };
}

/**
 * Handle goal amount input
 */
async function handleGoalAmountInput(ctx: RouterContext, msg: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', ctx.userId)
    .single();
  
  const goalContext = user?.classification_context?.goalCreation;
  
  let targetAmount: number;
  
  // אישור סכום מומלץ
  if (isCommand(msg, ['אשר', 'אישור', 'confirm', 'ok', 'כן'])) {
    targetAmount = goalContext?.recommendedAmount || 30000;
  } else {
    // חילוץ מספר מהטקסט
    const numberMatch = msg.replace(/[^\d]/g, '');
    targetAmount = parseInt(numberMatch, 10);
    
    if (isNaN(targetAmount) || targetAmount <= 0) {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `❌ לא הבנתי את הסכום.\n\n` +
          `כתוב מספר בשקלים, למשל: *50000*`,
      });
      return { success: true };
    }
  }
  
  await supabase
    .from('users')
    .update({
      classification_context: {
        goalCreation: { 
          ...goalContext,
          step: 'deadline',
          targetAmount
        }
      }
    })
    .eq('id', ctx.userId);
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `💰 *${targetAmount.toLocaleString('he-IL')} ₪*\n\n` +
      `עד מתי תרצה להגיע ליעד?\n\n` +
      `דוגמאות:\n` +
      `• *"שנה"* - 12 חודשים\n` +
      `• *"שנתיים"* - 24 חודשים\n` +
      `• *"6 חודשים"*\n` +
      `• *"12/2026"* - תאריך ספציפי\n` +
      `• *"ללא"* - יעד כללי ללא דדליין`,
  });
  
  return { success: true };
}

/**
 * Handle goal deadline input
 */
async function handleGoalDeadlineInput(ctx: RouterContext, msg: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', ctx.userId)
    .single();
  
  const goalContext = user?.classification_context?.goalCreation;
  const msgLower = msg.toLowerCase();
  
  let deadline: string | null = null;
  let deadlineText: string = '';
  
  // פרשנות תאריך
  const now = new Date();
  
  if (isCommand(msg, ['ללא', 'אין', 'no deadline', 'none', 'כללי'])) {
    deadline = null;
    deadlineText = 'ללא דדליין';
  } else if (msgLower.includes('שנה') && !msgLower.includes('שנתיים')) {
    deadline = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    deadlineText = 'שנה';
  } else if (msgLower.includes('שנתיים')) {
    deadline = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    deadlineText = 'שנתיים';
  } else if (msgLower.includes('חודש')) {
    const monthsMatch = msg.match(/(\d+)/);
    const months = monthsMatch ? parseInt(monthsMatch[1], 10) : 6;
    deadline = new Date(now.getFullYear(), now.getMonth() + months, now.getDate()).toISOString().split('T')[0];
    deadlineText = `${months} חודשים`;
  } else {
    // נסה לפרש כתאריך
    const dateMatch = msg.match(/(\d{1,2})[\/\-](\d{4})/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1], 10);
      const year = parseInt(dateMatch[2], 10);
      deadline = `${year}-${month.toString().padStart(2, '0')}-01`;
      deadlineText = `${month}/${year}`;
    } else {
      // ברירת מחדל - שנה
      deadline = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
      deadlineText = 'שנה';
    }
  }
  
  // חישוב סכום חודשי נדרש
  const targetAmount = goalContext?.targetAmount || 0;
  let monthlyRequired = 0;
  let monthsToGoal = 12;
  
  if (deadline) {
    const deadlineDate = new Date(deadline);
    monthsToGoal = Math.max(1, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    monthlyRequired = Math.ceil(targetAmount / monthsToGoal);
  }
  
  await supabase
    .from('users')
    .update({
      classification_context: {
        goalCreation: { 
          ...goalContext,
          step: 'confirm',
          deadline,
          deadlineText,
          monthlyRequired,
          monthsToGoal
        }
      }
    })
    .eq('id', ctx.userId);
  
  let confirmMessage = `📋 *סיכום היעד:*\n\n` +
    `🎯 *${goalContext?.goalName}*\n` +
    `💰 סכום: *${targetAmount.toLocaleString('he-IL')} ₪*\n`;
  
  if (deadline) {
    confirmMessage += `📅 עד: *${deadlineText}*\n`;
    confirmMessage += `💵 חודשי: *${monthlyRequired.toLocaleString('he-IL')} ₪*\n`;
  } else {
    confirmMessage += `📅 ללא דדליין\n`;
  }
  
  confirmMessage += `\n*לאשר?*`;
  
  try {
    await sendWhatsAppInteractiveButtons(ctx.phone, {
      message: confirmMessage,
      header: 'אישור יעד',
      buttons: [
        { buttonId: 'confirm_goal', buttonText: 'אשר' },
        { buttonId: 'cancel_goal', buttonText: 'בטל' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: confirmMessage + `\n\nכתוב *"אשר"* או *"בטל"*`,
    });
  }
  
  return { success: true };
}

/**
 * Handle goal confirmation
 */
async function handleGoalConfirmation(ctx: RouterContext, msg: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', ctx.userId)
    .single();
  
  const goalContext = user?.classification_context?.goalCreation;
  
  if (isCommand(msg, ['אשר', 'כן', 'yes', 'confirm', 'ok', 'confirm_goal', '✅ אשר'])) {
    // שמור יעד
    await supabase
      .from('goals')
      .insert({
        user_id: ctx.userId,
        name: goalContext?.goalName || 'יעד',
        target_amount: goalContext?.targetAmount || 0,
        current_amount: 0,
        deadline: goalContext?.deadline,
        priority: 1,
        status: 'active',
      });
    
    // נקה context
    await supabase
      .from('users')
      .update({ classification_context: {} })
      .eq('id', ctx.userId);
    
    // ספור יעדים
    const { count } = await supabase
      .from('goals')
      .select('id', { count: 'exact' })
      .eq('user_id', ctx.userId)
      .eq('status', 'active');
    
    try {
      await sendWhatsAppInteractiveButtons(ctx.phone, {
        message: `✅ *נשמר!*\n\n` +
          `יעד: *${goalContext?.goalName}*\n` +
          `סכום: *${(goalContext?.targetAmount || 0).toLocaleString('he-IL')} ₪*\n\n` +
          `יש לך *${count || 1} יעדים* פעילים.`,
        header: 'עוד יעד?',
        buttons: [
          { buttonId: 'new_goal', buttonText: 'יעד חדש' },
          { buttonId: 'show_goals', buttonText: 'יעדים' },
          { buttonId: 'finish_goals', buttonText: 'סיימתי' },
        ],
      });
    } catch {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `✅ *נשמר!*\n\n` +
          `יעד: *${goalContext?.goalName}*\n` +
          `סכום: *${(goalContext?.targetAmount || 0).toLocaleString('he-IL')} ₪*\n\n` +
          `יש לך *${count || 1} יעדים* פעילים.\n\n` +
          `• כתוב *"יעד חדש"* להוסיף עוד\n` +
          `• כתוב *"יעדים"* לראות הכל\n` +
          `• כתוב *"סיימתי"* להמשיך`,
      });
    }
  } else if (isCommand(msg, ['בטל', 'לא', 'no', 'cancel', 'cancel_goal', '❌ בטל'])) {
    // בטל ונקה context
    await supabase
      .from('users')
      .update({ classification_context: {} })
      .eq('id', ctx.userId);
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ בוטל.\n\n` +
        `כתוב *"יעד חדש"* לנסות שוב`,
    });
  } else {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `כתוב *"אשר"* או *"בטל"*`,
    });
  }
  
  return { success: true };
}

/**
 * Show user's goals
 */
async function showUserGoals(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('status', 'active')
    .order('priority', { ascending: false });
  
  if (!goals || goals.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📋 *היעדים שלך:*\n\n` +
        `אין עדיין יעדים מוגדרים.\n\n` +
        `כתוב *"יעד חדש"* להתחיל!`,
    });
    return { success: true };
  }
  
  let message = `📋 *היעדים שלך:*\n\n`;
  
  for (let i = 0; i < goals.length; i++) {
    const goal = goals[i];
    const progress = goal.target_amount > 0 
      ? Math.round((goal.current_amount / goal.target_amount) * 100)
      : 0;
    
    const progressBar = createProgressBar(progress);
    
    message += `${i + 1}. *${goal.name}*\n`;
    message += `   ${progressBar} ${progress}%\n`;
    message += `   ${goal.current_amount.toLocaleString('he-IL')}/${goal.target_amount.toLocaleString('he-IL')} ₪\n`;
    
    if (goal.deadline) {
      const deadline = new Date(goal.deadline);
      const now = new Date();
      const monthsLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
      message += `   📅 נשארו ${monthsLeft} חודשים\n`;
    }
    
    message += `\n`;
  }
  
  message += `*סה"כ: ${goals.length} יעדים*`;
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message,
  });
  
  return { success: true };
}

/**
 * Create a text-based progress bar
 */
function createProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Finish goals setting and move to budget phase
 */
async function finishGoalsSetting(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // ספור יעדים
  const { data: goals } = await supabase
    .from('goals')
    .select('name, target_amount')
    .eq('user_id', ctx.userId)
    .eq('status', 'active');
  
  const totalGoalAmount = goals?.reduce((sum, g) => sum + (g.target_amount || 0), 0) || 0;
  
  try {
    await sendWhatsAppInteractiveButtons(ctx.phone, {
      message: `🎯 *סיימנו להגדיר יעדים!*\n\n` +
        `📊 *${goals?.length || 0} יעדים*\n` +
        `💰 סה"כ: *${totalGoalAmount.toLocaleString('he-IL')} ₪*\n\n` +
        `עכשיו נבנה תקציב שתומך ביעדים האלה.`,
      header: 'המשך לתקציב?',
      buttons: [
        { buttonId: 'to_budget', buttonText: 'המשך' },
        { buttonId: 'new_goal', buttonText: 'יעד חדש' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `🎯 *סיימנו להגדיר יעדים!*\n\n` +
        `📊 *${goals?.length || 0} יעדים*\n` +
        `💰 סה"כ: *${totalGoalAmount.toLocaleString('he-IL')} ₪*\n\n` +
        `עכשיו נבנה תקציב שתומך ביעדים האלה.\n\n` +
        `כתוב *"המשך"* לעבור לתקציב`,
    });
  }
  
  return { success: true };
}

// ============================================================================
// Budget Phase (Phase 4)
// ============================================================================

interface BudgetData {
  totalIncome: number;
  totalExpenses: number;
  categories: { name: string; amount: number; percentage: number; expenseType: string }[];
  vendorBreakdown: { vendor: string; avgAmount: number; monthlyCount: number; category: string }[];
  profileContext: {
    numPeople: number;
    housingType: string;
    incomeLevel: string;
    fixedExpenses: number;
    variableExpenses: number;
    specialExpenses: number;
  };
}

/**
 * Calculate comprehensive budget data from user transactions (12 months)
 * Based on Gadi's methodology:
 * - ממוצע שורת הוצאה (by vendor, not category)
 * - ממוצע חודשי (12 months)
 * - יחס למספר נפשות, סוג מגורים, רמת הכנסה
 */
async function calculateBudgetData(userId: string): Promise<BudgetData> {
  const supabase = createServiceClient();
  
  // Get last 12 months of data
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const startDate = twelveMonthsAgo.toISOString().split('T')[0];
  
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate);
  
  // Get user profile for context
  const { data: profile } = await supabase
    .from('user_financial_profile')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  // Get dependents count
  const { count: childrenCount } = await supabase
    .from('children')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  
  const income = transactions?.filter(t => t.type === 'income') || [];
  const expenses = transactions?.filter(t => t.type === 'expense') || [];
  
  // Calculate monthly averages (divide by number of months with data)
  const monthsWithData = new Set(transactions?.map(t => t.date?.substring(0, 7))).size || 1;
  
  const totalIncome = Math.round(income.reduce((sum, t) => sum + Math.abs(t.amount), 0) / monthsWithData);
  const totalExpenses = Math.round(expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0) / monthsWithData);
  
  // 📊 Vendor breakdown (ממוצע שורת הוצאה)
  const vendorMap: Record<string, { total: number; count: number; category: string }> = {};
  expenses.forEach(t => {
    const vendor = t.vendor || t.original_description || 'לא ידוע';
    if (!vendorMap[vendor]) {
      vendorMap[vendor] = { total: 0, count: 0, category: t.category || t.expense_category || 'אחר' };
    }
    vendorMap[vendor].total += Math.abs(t.amount);
    vendorMap[vendor].count++;
  });
  
  const vendorBreakdown = Object.entries(vendorMap)
    .map(([vendor, data]) => ({
      vendor,
      avgAmount: Math.round(data.total / monthsWithData),
      monthlyCount: Math.round(data.count / monthsWithData * 10) / 10,
      category: data.category
    }))
    .sort((a, b) => b.avgAmount - a.avgAmount)
    .slice(0, 20); // Top 20 vendors
  
  // 📁 Group by category with expense type (קבועות/משתנות/מיוחדות)
  const categoryMap: Record<string, { amount: number; type: string }> = {};
  expenses.forEach(t => {
    const cat = t.category || t.expense_category || 'אחר';
    const expType = t.expense_frequency || t.expense_type || 'variable';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { amount: 0, type: expType };
    }
    categoryMap[cat].amount += Math.abs(t.amount);
  });
  
  const categories = Object.entries(categoryMap)
    .map(([name, data]) => ({
      name,
      amount: Math.round(data.amount / monthsWithData),
      percentage: totalExpenses > 0 ? Math.round((data.amount / monthsWithData / totalExpenses) * 100) : 0,
      expenseType: data.type
    }))
    .sort((a, b) => b.amount - a.amount);
  
  // 🏠 Calculate expense types totals
  const fixedExpenses = categories
    .filter(c => c.expenseType === 'fixed')
    .reduce((sum, c) => sum + c.amount, 0);
  
  const variableExpenses = categories
    .filter(c => c.expenseType === 'variable' || c.expenseType === 'temporary')
    .reduce((sum, c) => sum + c.amount, 0);
  
  const specialExpenses = categories
    .filter(c => c.expenseType === 'special' || c.expenseType === 'one_time')
    .reduce((sum, c) => sum + c.amount, 0);
  
  // 👨‍👩‍👧‍👦 Profile context
  const numPeople = 1 + (profile?.marital_status === 'married' ? 1 : 0) + (childrenCount || 0);
  const housingType = profile?.owns_home ? 'בעלות' : 'שכירות';
  const incomeLevel = totalIncome > 20000 ? 'גבוהה' : totalIncome > 10000 ? 'בינונית' : 'נמוכה';
  
  return { 
    totalIncome, 
    totalExpenses, 
    categories,
    vendorBreakdown,
    profileContext: {
      numPeople,
      housingType,
      incomeLevel,
      fixedExpenses,
      variableExpenses,
      specialExpenses
    }
  };
}

/**
 * Handle budget phase messages
 */
async function handleBudgetPhase(ctx: RouterContext, msg: string): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // תקציב אוטומטי - יצירת תקציב מבוסס על היסטוריה
  if (isCommand(msg, ['auto_budget', 'תקציב אוטומטי', 'אוטומטי', 'auto'])) {
    return await createAutoBudget(ctx);
  }
  
  // הגדרה ידנית
  if (isCommand(msg, ['manual_budget', 'הגדרה ידנית', 'ידני', 'manual'])) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `✏️ *הגדרה ידנית*\n\n` +
        `כתוב את התקציב לכל קטגוריה בפורמט:\n` +
        `*קטגוריה: סכום*\n\n` +
        `לדוגמה:\n` +
        `מזון: 2000\n` +
        `תחבורה: 800\n\n` +
        `או כתוב *"סיימתי"* לסיום`,
    });
    return { success: true };
  }
  
  // דלג על תקציב
  if (isCommand(msg, ['skip_budget', 'דלג', 'skip'])) {
    return await skipBudget(ctx);
  }
  
  // סיום תקציב / אישור תקציב אוטומטי
  if (isCommand(msg, ['סיימתי', 'finish', 'done', 'confirm_budget', 'מאשר'])) {
    return await finishBudget(ctx);
  }
  
  // ניסיון לפרסר קטגוריה:סכום
  const budgetMatch = msg.match(/^(.+?):\s*(\d+)$/);
  if (budgetMatch) {
    const category = budgetMatch[1].trim();
    const amount = parseInt(budgetMatch[2]);
    return await setBudgetCategory(ctx, category, amount);
  }
  
  // ברירת מחדל - הצג עזרה
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `💰 *שלב התקציב*\n\n` +
      `פקודות:\n` +
      `• *"תקציב אוטומטי"* - φ יבנה לך תקציב\n` +
      `• *"הגדרה ידנית"* - הגדר בעצמך\n` +
      `• *"דלג"* - המשך בלי תקציב\n\n` +
      `φ *Phi - היחס הזהב של הכסף שלך*`,
  });
  
  return { success: true };
}

/**
 * Create automatic budget based on history
 * מתודולוגיית גדי:
 * - ממוצע 12 חודשים
 * - יחס למספר נפשות, סוג מגורים
 * - הפרדה לקבועות/משתנות/מיוחדות
 */
async function createAutoBudget(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  const budgetData = await calculateBudgetData(ctx.userId);
  const { totalIncome, totalExpenses, categories, vendorBreakdown, profileContext } = budgetData;
  
  // 🎯 יעד חיסכון לפי רמת הכנסה
  let savingsPercent = 0.10; // ברירת מחדל 10%
  if (profileContext.incomeLevel === 'גבוהה') savingsPercent = 0.15;
  if (profileContext.incomeLevel === 'נמוכה') savingsPercent = 0.05;
  
  const savingsTarget = Math.round(totalIncome * savingsPercent);
  const availableBudget = totalIncome - savingsTarget;
  
  // יצירת/עדכון תקציב ראשי
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  // בדוק אם יש תקציב לחודש הנוכחי
  const { data: existingBudget } = await supabase
    .from('budgets')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('month', currentMonth)
    .single();
  
  let budgetId: string;
  
  if (existingBudget) {
    budgetId = existingBudget.id;
    // עדכן תקציב קיים
    await supabase
      .from('budgets')
      .update({ 
        total_budget: availableBudget,
        savings_goal: savingsTarget,
        is_auto_generated: true
      })
      .eq('id', budgetId);
  } else {
    // צור תקציב חדש
    const { data: newBudget } = await supabase
      .from('budgets')
      .insert({
        user_id: ctx.userId,
        month: currentMonth,
        total_budget: availableBudget,
        total_spent: totalExpenses,
        savings_goal: savingsTarget,
        is_auto_generated: true,
        status: 'active'
      })
      .select('id')
      .single();
    
    budgetId = newBudget?.id;
  }
  
  // שמור קטגוריות תקציב
  if (budgetId) {
    // מחק קטגוריות ישנות
    await supabase
      .from('budget_categories')
      .delete()
      .eq('budget_id', budgetId);
    
    // הוסף קטגוריות חדשות
    const budgetCategories = categories.map(cat => ({
      budget_id: budgetId,
      category_name: cat.name,
      detailed_category: cat.name,
      allocated_amount: Math.round(cat.amount * 0.95),
      spent_amount: cat.amount,
      remaining_amount: Math.round(cat.amount * 0.95) - cat.amount,
      percentage_used: cat.percentage
    }));
    
    if (budgetCategories.length > 0) {
      await supabase
        .from('budget_categories')
        .insert(budgetCategories);
    }
  }
  
  // 📨 הודעה 1: סיכום כללי ופרופיל
  let msg1 = `✨ *התקציב שלך מוכן!*\n\n`;
  msg1 += `👨‍👩‍👧‍👦 *הפרופיל שלך:*\n`;
  msg1 += `• ${profileContext.numPeople} נפשות\n`;
  msg1 += `• ${profileContext.housingType}\n`;
  msg1 += `• רמת הכנסה: ${profileContext.incomeLevel}\n\n`;
  msg1 += `📊 *ממוצע חודשי (12 חודשים):*\n`;
  msg1 += `• הכנסות: ₪${totalIncome.toLocaleString('he-IL')}\n`;
  msg1 += `• הוצאות: ₪${totalExpenses.toLocaleString('he-IL')}\n`;
  msg1 += `• יתרה: ₪${(totalIncome - totalExpenses).toLocaleString('he-IL')}`;
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: msg1,
  });
  
  // 📨 הודעה 2: פירוט לפי סוג הוצאה
  let msg2 = `📁 *הוצאות לפי סוג:*\n\n`;
  msg2 += `🔒 *קבועות:* ₪${profileContext.fixedExpenses.toLocaleString('he-IL')}\n`;
  const fixedCats = categories.filter(c => c.expenseType === 'fixed').slice(0, 3);
  fixedCats.forEach(c => { msg2 += `   • ${c.name}: ₪${c.amount.toLocaleString('he-IL')}\n`; });
  
  msg2 += `\n🔄 *משתנות:* ₪${profileContext.variableExpenses.toLocaleString('he-IL')}\n`;
  const varCats = categories.filter(c => c.expenseType === 'variable' || c.expenseType === 'temporary').slice(0, 3);
  varCats.forEach(c => { msg2 += `   • ${c.name}: ₪${c.amount.toLocaleString('he-IL')}\n`; });
  
  if (profileContext.specialExpenses > 0) {
    msg2 += `\n⭐ *מיוחדות:* ₪${profileContext.specialExpenses.toLocaleString('he-IL')}`;
  }
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: msg2,
  });
  
  // 📨 הודעה 3: Top vendors (ממוצע שורת הוצאה)
  if (vendorBreakdown.length > 0) {
    let msg3 = `💳 *הוצאות עיקריות (ממוצע חודשי):*\n\n`;
    vendorBreakdown.slice(0, 8).forEach(v => {
      msg3 += `• ${v.vendor}: ₪${v.avgAmount.toLocaleString('he-IL')}\n`;
    });
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: msg3,
    });
  }
  
  // 📨 הודעה 4: יעד והמלצה
  const savingsPercentDisplay = Math.round(savingsPercent * 100);
  let msg4 = `🎯 *היעד שלך:*\n\n`;
  msg4 += `• יעד חיסכון (${savingsPercentDisplay}%): ₪${savingsTarget.toLocaleString('he-IL')}/חודש\n`;
  msg4 += `• תקציב זמין: ₪${availableBudget.toLocaleString('he-IL')}/חודש\n\n`;
  msg4 += `💡 *המלצת φ:*\n`;
  
  // המלצות מותאמות
  if (totalExpenses > totalIncome) {
    msg4 += `⚠️ ההוצאות גבוהות מההכנסות!\n`;
    msg4 += `מומלץ לבדוק את ההוצאות המשתנות.`;
  } else if (profileContext.variableExpenses > profileContext.fixedExpenses) {
    msg4 += `ההוצאות המשתנות גבוהות.\n`;
    msg4 += `יש פוטנציאל לחיסכון משמעותי!`;
  } else {
    msg4 += `מצב טוב! רוב ההוצאות קבועות ויציבות.`;
  }
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: msg4,
  });
  
  // שאל אם לאשר
  await greenAPI.sendInteractiveButtons({
    phoneNumber: ctx.phone,
    message: 'מאשר את התקציב?',
    buttons: [
      { buttonId: 'confirm_budget', buttonText: 'מאשר' },
      { buttonId: 'manual_budget', buttonText: 'עריכה' },
    ],
  });
  
  return { success: true };
}

/**
 * Set budget for a specific category
 */
async function setBudgetCategory(ctx: RouterContext, category: string, amount: number): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  try {
    await supabase
      .from('budget_categories')
      .upsert({
        user_id: ctx.userId,
        category_name: category,
        monthly_budget: amount,
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id,category_name' });
    
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `✅ נשמר: *${category}* - ₪${amount.toLocaleString('he-IL')}\n\n` +
        `המשך להגדיר קטגוריות נוספות או כתוב *"סיימתי"*`,
    });
  } catch (err) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ שגיאה בשמירה. נסה שוב.`,
    });
  }
  
  return { success: true };
}

/**
 * Skip budget phase
 */
async function skipBudget(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  await supabase
    .from('users')
    .update({ 
      onboarding_state: 'monitoring',
      current_phase: 'monitoring',
      phase_updated_at: new Date().toISOString()
    })
    .eq('id', ctx.userId);
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `🎉 *סיימנו את ההגדרות!*\n\n` +
      `אתה יכול תמיד לחזור ולהגדיר תקציב.\n\n` +
      `*מה עכשיו?*\n` +
      `• שלח מסמכים נוספים 📄\n` +
      `• כתוב "סיכום" לראות את המצב שלך\n` +
      `• שאל שאלות כמו "כמה הוצאתי על אוכל?"\n\n` +
      `φ *Phi - היחס הזהב של הכסף שלך*`,
  });
  
  return { success: true, newState: 'monitoring' };
}

/**
 * Finish budget phase and move to monitoring
 */
async function finishBudget(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // Get current month's budget
  const currentMonth = new Date().toISOString().substring(0, 7);
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('month', currentMonth)
    .single();
  
  // ספור קטגוריות תקציב דרך budget_id
  let count = 0;
  if (budget) {
    const { count: catCount } = await supabase
      .from('budget_categories')
      .select('*', { count: 'exact', head: true })
      .eq('budget_id', budget.id);
    count = catCount || 0;
  }
  
  await supabase
    .from('users')
    .update({ 
      onboarding_state: 'monitoring',
      current_phase: 'monitoring',
      phase_updated_at: new Date().toISOString()
    })
    .eq('id', ctx.userId);
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `🎉 *התקציב שלך מוכן!*\n\n` +
      `הגדרת ${count || 0} קטגוריות תקציב.\n\n` +
      `φ יעקוב אחרי ההוצאות שלך ויתריע אם אתה חורג.\n\n` +
      `*מה עכשיו?*\n` +
      `• שלח הוצאות חדשות 💸\n` +
      `• כתוב "סיכום" לראות את המצב\n` +
      `• כתוב "תקציב" לראות יתרות\n\n` +
      `φ *Phi - היחס הזהב של הכסף שלך*`,
  });
  
  return { success: true, newState: 'monitoring' };
}

/**
 * Transition from goals phase to budget phase
 */
async function transitionToBudget(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // עדכן phase
  await supabase
    .from('users')
    .update({ 
      onboarding_state: 'budget',
      current_phase: 'budget',
      phase_updated_at: new Date().toISOString()
    })
    .eq('id', ctx.userId);
  
  // חשב נתונים לתקציב
  const { totalIncome, totalExpenses, categories } = await calculateBudgetData(ctx.userId);
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `💰 *שלב 4: בניית תקציב*\n\n` +
      `φ מנתח את הנתונים שלך...\n\n` +
      `📊 *סיכום חודשי:*\n` +
      `• הכנסות: ₪${totalIncome.toLocaleString('he-IL')}\n` +
      `• הוצאות: ₪${totalExpenses.toLocaleString('he-IL')}\n` +
      `• יתרה: ₪${(totalIncome - totalExpenses).toLocaleString('he-IL')}\n\n` +
      `*מה תרצה לעשות?*`,
  });
  
  // שלח כפתורי פעולה
  await greenAPI.sendInteractiveButtons({
    phoneNumber: ctx.phone,
    message: 'בחר אפשרות:',
    buttons: [
      { buttonId: 'auto_budget', buttonText: 'תקציב אוטומטי' },
      { buttonId: 'manual_budget', buttonText: 'הגדרה ידנית' },
      { buttonId: 'skip_budget', buttonText: 'דלג' },
    ],
  });
  
  return { success: true, newState: 'budget' };
}

/**
 * Called after classification completes - move to behavior phase
 */
export async function onClassificationComplete(userId: string, phone: string): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // עדכן לשלב behavior
  await supabase
    .from('users')
    .update({ 
      onboarding_state: 'behavior',
      current_phase: 'behavior',
      phase_updated_at: new Date().toISOString()
    })
    .eq('id', userId);
  
  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `🎉 *סיימנו לסווג!*\n\n` +
      `עכשיו φ ינתח את דפוסי ההוצאות שלך.\n\n` +
      `כתוב *"ניתוח"* להתחיל`,
  });
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
  
  // ספור תנועות ממתינות (pending או proposed)
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, type, amount')
    .eq('user_id', userId)
    .in('status', ['pending', 'proposed']);
  
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
    `${progressText}`;
  
  // 🆕 שימוש בכפתורים במקום טקסט
  try {
    await greenAPI.sendInteractiveButtons({
    phoneNumber: phone,
    message,
      header: 'מה עכשיו?',
      buttons: [
        { buttonId: 'add_bank', buttonText: 'עוד דוח' },
        { buttonId: 'add_credit', buttonText: 'דוח אשראי' },
        { buttonId: 'start_classify', buttonText: 'נתחיל' },
      ],
    });
  } catch {
    // Fallback אם הכפתורים לא עובדים
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: message + `\n\n*מה עכשיו?*\n` +
        `• כתוב *"עוד בנק"* - להוסיף דוח בנק\n` +
        `• כתוב *"אשראי"* - להוסיף דוח אשראי\n` +
        `• כתוב *"נמשיך"* - להתחיל לסווג`,
    });
  }
}

// ============================================================================
// Monitoring Phase Helpers
// ============================================================================

/**
 * Show summary for monitoring phase - does NOT change state!
 */
async function showMonitoringSummary(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // Get all confirmed transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, type, category, tx_date')
    .eq('user_id', ctx.userId)
    .eq('status', 'confirmed');
  
  const totalIncome = (transactions || [])
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const totalExpenses = (transactions || [])
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const balance = totalIncome - totalExpenses;
  
  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  (transactions || [])
    .filter(t => t.type === 'expense' && t.category)
    .forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
    });
  
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amount]) => `• ${cat}: ₪${amount.toLocaleString('he-IL')}`)
    .join('\n');
  
  // Goals progress
  const { data: goals } = await supabase
    .from('goals')
    .select('name, target_amount, current_amount')
    .eq('user_id', ctx.userId)
    .eq('status', 'active');
  
  const goalsText = (goals || [])
    .map(g => {
      const progress = Math.round((g.current_amount / g.target_amount) * 100);
      return `• ${g.name}: ${progress}% (₪${g.current_amount.toLocaleString('he-IL')}/${g.target_amount.toLocaleString('he-IL')})`;
    })
    .join('\n');
  
  // Budget status
  const currentMonth = new Date().toISOString().substring(0, 7);
  const { data: budget } = await supabase
    .from('budgets')
    .select('total_budget, savings_goal, total_spent')
    .eq('user_id', ctx.userId)
    .eq('month', currentMonth)
    .single();
  
  let message = `📊 *הסיכום שלך*\n\n`;
  message += `💚 הכנסות: ₪${totalIncome.toLocaleString('he-IL')}\n`;
  message += `💸 הוצאות: ₪${totalExpenses.toLocaleString('he-IL')}\n`;
  message += `${balance >= 0 ? '✨' : '📉'} יתרה: ₪${balance.toLocaleString('he-IL')}\n\n`;
  
  if (topCategories) {
    message += `*🏷️ ההוצאות הגדולות:*\n${topCategories}\n\n`;
  }
  
  if (goalsText) {
    message += `*🎯 יעדים:*\n${goalsText}\n\n`;
  }
  
  if (budget) {
    const budgetUsed = Math.round((Number(budget.total_spent) / Number(budget.total_budget)) * 100);
    message += `*💰 תקציב החודש:*\n`;
    message += `• תקציב: ₪${Number(budget.total_budget).toLocaleString('he-IL')}\n`;
    message += `• הוצא: ₪${Number(budget.total_spent).toLocaleString('he-IL')} (${budgetUsed}%)\n`;
    message += `• חיסכון: ₪${Number(budget.savings_goal).toLocaleString('he-IL')}\n`;
  }
  
  message += `\nφ *Phi - היחס הזהב של הכסף שלך*`;
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message,
  });
  
  return { success: true };
}

/**
 * Show budget status with categories
 */
async function showBudgetStatus(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  const currentMonth = new Date().toISOString().substring(0, 7);
  
  // Get budget
  const { data: budget } = await supabase
    .from('budgets')
    .select('id, total_budget, savings_goal, total_spent')
    .eq('user_id', ctx.userId)
    .eq('month', currentMonth)
    .single();
  
  if (!budget) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ אין תקציב מוגדר לחודש זה.\n\n` +
        `כתוב *"תקציב אוטומטי"* ליצירת תקציב.`,
    });
    return { success: true };
  }
  
  // Get categories
  const { data: categories } = await supabase
    .from('budget_categories')
    .select('category_name, allocated_amount, spent_amount')
    .eq('budget_id', budget.id)
    .order('allocated_amount', { ascending: false });
  
  const totalBudget = Number(budget.total_budget);
  const totalSpent = Number(budget.total_spent);
  const remaining = totalBudget - totalSpent;
  const percentUsed = Math.round((totalSpent / totalBudget) * 100);
  
  let message = `💰 *תקציב ${currentMonth}*\n\n`;
  message += `📊 *סיכום:*\n`;
  message += `• תקציב כולל: ₪${totalBudget.toLocaleString('he-IL')}\n`;
  message += `• הוצא: ₪${totalSpent.toLocaleString('he-IL')} (${percentUsed}%)\n`;
  message += `• נותר: ₪${remaining.toLocaleString('he-IL')}\n`;
  message += `• יעד חיסכון: ₪${Number(budget.savings_goal).toLocaleString('he-IL')}\n\n`;
  
  if (categories && categories.length > 0) {
    message += `*🏷️ קטגוריות:*\n`;
    categories.forEach(cat => {
      const allocated = Number(cat.allocated_amount);
      const spent = Number(cat.spent_amount);
      const catRemaining = allocated - spent;
      const emoji = catRemaining >= 0 ? '✅' : '🔴';
      message += `${emoji} ${cat.category_name}: ₪${spent.toLocaleString('he-IL')}/${allocated.toLocaleString('he-IL')}\n`;
    });
  }
  
  // Status message
  if (remaining < 0) {
    message += `\n⚠️ *חריגה מהתקציב!*\n`;
    message += `עברת את התקציב ב-₪${Math.abs(remaining).toLocaleString('he-IL')}`;
  } else if (percentUsed > 80) {
    message += `\n⚡ *קרוב לתקרה!*\n`;
    message += `נשארו לך רק ₪${remaining.toLocaleString('he-IL')} לחודש`;
  } else {
    message += `\n✨ *מצוין!*\n`;
    message += `נשארו לך ₪${remaining.toLocaleString('he-IL')} לחודש`;
  }
  
  message += `\n\nφ *Phi - היחס הזהב של הכסף שלך*`;
  
  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message,
  });
  
  return { success: true };
}

