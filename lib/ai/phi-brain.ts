/**
 * Phi Brain — The One AI Engine
 *
 * Replaces: router.ts state machine, 15 cron jobs, classification flow,
 * monitoring handlers, and all hardcoded WhatsApp messages.
 *
 * One function receives ALL events. One AI decides everything.
 * Personal. Contextual. Smart about when to talk and when to shut up.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { chatWithGeminiFlash } from '@/lib/ai/gemini-client';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { classifyAllTransactions, applyClassifications, learnFromClassifications, formatSummaryForWhatsApp } from '@/lib/classification/ai-classifier';
import { cache } from '@/lib/utils/cache';
import { log } from '@/lib/utils/logger';

// ============================================================================
// Types
// ============================================================================

export type PhiEvent =
  | { type: 'whatsapp_message'; message: string }
  | { type: 'document_processed'; documentId: string; transactionCount: number; documentType: string }
  | { type: 'scheduled_check' }  // replaces ALL cron jobs
  | { type: 'transaction_created'; vendor: string; amount: number; source: string }
  | { type: 'expense_logged'; vendor: string; amount: number; category: string }
  | { type: 'salary_detected'; amount: number }
  | { type: 'budget_exceeded'; category: string; spent: number; budget: number }
  | { type: 'goal_milestone'; goalName: string; percentage: number };

export interface PhiAction {
  sendMessage?: string;
  sendButtons?: { message: string; buttons: Array<{ buttonId: string; buttonText: string }> };
  classify?: boolean;
  updateProfile?: Partial<UserPersonalProfile>;
  updateState?: string;
  silent?: boolean;  // brain decided not to act
}

export interface UserPersonalProfile {
  tone: string;
  active_hours: string;
  communication_style: string;
  financial_personality: string;
  patterns: Record<string, any>;
  goals_discussed: string[];
  last_coached_on: string;
  coaching_results: Record<string, string>;
  streak: { days_logging: number; record: number };
  dont_repeat: string[];  // topics already covered recently
  preferred_message_length: 'short' | 'medium' | 'detailed';
}

interface BrainContext {
  userId: string;
  phone: string;
  userName: string;
  profile: UserPersonalProfile;
  phase: string;
  state: string;
  // Financial snapshot
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyBalance: number;
  budgetRemaining: number;
  pendingCount: number;
  // Recent activity
  todayExpenses: Array<{ vendor: string; amount: number; category: string }>;
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  // Goals
  activeGoals: Array<{ name: string; target: number; current: number; percentage: number }>;
  // Timing
  lastMessageSentAt: string | null;
  hoursSinceLastContact: number;
  currentHour: number;
  dayOfWeek: number;
}

// ============================================================================
// Default Profile
// ============================================================================

const DEFAULT_PROFILE: UserPersonalProfile = {
  tone: 'friendly_professional',
  active_hours: '8:00-22:00',
  communication_style: 'balanced',
  financial_personality: 'unknown',
  patterns: {},
  goals_discussed: [],
  last_coached_on: '',
  coaching_results: {},
  streak: { days_logging: 0, record: 0 },
  dont_repeat: [],
  preferred_message_length: 'medium',
};

// ============================================================================
// Load Full Context
// ============================================================================

async function loadBrainContext(userId: string): Promise<BrainContext> {
  // Cache for 30 seconds — same user won't trigger 8 DB queries per message
  return cache.getOrSet(`brain_ctx:${userId}`, 30, () => _loadBrainContextImpl(userId));
}

async function _loadBrainContextImpl(userId: string): Promise<BrainContext> {
  const supabase = createServiceClient();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentMonth = now.toISOString().substring(0, 7);
  const firstOfMonth = `${currentMonth}-01`;

  // Parallel data loading
  const [
    { data: user },
    { data: monthlyTx },
    { data: todayTx },
    { data: goals },
    { data: budget },
    { count: pendingCount },
    { data: recentAlerts },
    { data: recentMessages },
  ] = await Promise.all([
    supabase.from('users').select('id, name, phone, phase, onboarding_state, classification_context').eq('id', userId).single(),
    supabase.from('transactions').select('type, amount').eq('user_id', userId).eq('status', 'confirmed').or('is_summary.is.null,is_summary.eq.false').gte('tx_date', firstOfMonth).lte('tx_date', today),
    supabase.from('transactions').select('vendor, amount, expense_category, source').eq('user_id', userId).eq('status', 'confirmed').eq('type', 'expense').or('is_summary.is.null,is_summary.eq.false').eq('tx_date', today),
    supabase.from('goals').select('name, target_amount, current_amount, status').eq('user_id', userId).eq('status', 'active').limit(5),
    supabase.from('budgets').select('total_budget, total_spent').eq('user_id', userId).eq('month', currentMonth).in('status', ['active', 'warning', 'exceeded']).limit(1).maybeSingle(),
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'pending'),
    supabase.from('alerts').select('created_at, type').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('wa_messages').select('body, direction, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
  ]);

  const txList = (monthlyTx || []) as any[];
  const monthlyIncome = txList.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
  const monthlyExpenses = txList.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);

  const lastAlert = recentAlerts?.[0];
  const lastMessageTime = lastAlert?.created_at ? new Date(lastAlert.created_at) : null;
  const hoursSinceLastContact = lastMessageTime
    ? (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60)
    : 999;

  // Load or create personal profile
  const classCtx = user?.classification_context || {};
  const profile: UserPersonalProfile = classCtx.phi_profile || { ...DEFAULT_PROFILE };

  return {
    userId,
    phone: user?.phone || '',
    userName: user?.name || '',
    profile,
    phase: user?.phase || 'data_collection',
    state: user?.onboarding_state || 'start',
    monthlyIncome,
    monthlyExpenses,
    monthlyBalance: monthlyIncome - monthlyExpenses,
    budgetRemaining: budget ? (Number(budget.total_budget) - Number(budget.total_spent)) : 0,
    pendingCount: pendingCount || 0,
    todayExpenses: (todayTx || []).map((t: any) => ({
      vendor: t.vendor || t.expense_category || '',
      amount: Math.abs(Number(t.amount)),
      category: t.expense_category || '',
    })),
    recentMessages: (recentMessages || []).map((m: any) => ({
      role: m.direction === 'incoming' ? 'user' as const : 'assistant' as const,
      content: m.body || '',
      timestamp: m.created_at,
    })).reverse(),
    activeGoals: (goals || []).map((g: any) => ({
      name: g.name,
      target: Number(g.target_amount),
      current: Number(g.current_amount),
      percentage: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0,
    })),
    lastMessageSentAt: lastAlert?.created_at || null,
    hoursSinceLastContact,
    currentHour: now.getHours(),
    dayOfWeek: now.getDay(),
  };
}

// ============================================================================
// The Master Prompt
// ============================================================================

function buildBrainPrompt(ctx: BrainContext, event: PhiEvent): string {
  const todayExpStr = ctx.todayExpenses.length > 0
    ? ctx.todayExpenses.map(e => `${e.vendor}: ${e.amount}₪`).join(', ')
    : 'לא נרשמו';

  const goalsStr = ctx.activeGoals.length > 0
    ? ctx.activeGoals.map(g => `${g.name}: ${g.percentage}% (${g.current}/${g.target}₪)`).join(', ')
    : 'אין יעדים';

  const recentChat = ctx.recentMessages.slice(-6).map(m =>
    `${m.role === 'user' ? 'משתמש' : 'φ'}: ${m.content.substring(0, 100)}`
  ).join('\n');

  const budgetStr = ctx.budgetRemaining > 0
    ? `נותר ${Math.round(ctx.budgetRemaining).toLocaleString('he-IL')}₪ מהתקציב החודשי`
    : ctx.budgetRemaining < 0
    ? `חריגת תקציב: ${Math.abs(Math.round(ctx.budgetRemaining)).toLocaleString('he-IL')}₪`
    : 'אין תקציב מוגדר';

  let eventDescription = '';
  switch (event.type) {
    case 'whatsapp_message':
      eventDescription = `המשתמש שלח הודעה: "${event.message}"`;
      break;
    case 'document_processed':
      eventDescription = `עובד דוח ${event.documentType}. ${event.transactionCount} תנועות חדשות.`;
      break;
    case 'scheduled_check':
      eventDescription = `בדיקה תקופתית (${ctx.currentHour}:00). האם יש סיבה לפנות?`;
      break;
    case 'expense_logged':
      eventDescription = `נרשמה הוצאה: ${event.vendor} ${event.amount}₪ (${event.category})`;
      break;
    case 'salary_detected':
      eventDescription = `זוהתה משכורת: ${event.amount.toLocaleString('he-IL')}₪ נכנסו לחשבון`;
      break;
    case 'budget_exceeded':
      eventDescription = `חריגת תקציב בסעיף ${event.category}: ${event.spent}/${event.budget}₪`;
      break;
    case 'goal_milestone':
      eventDescription = `יעד "${event.goalName}" הגיע ל-${event.percentage}%!`;
      break;
    default:
      eventDescription = `אירוע: ${(event as any).type}`;
  }

  return `אתה φ (פי) — מאמן פיננסי אישי בוואטסאפ. לא בוט. מאמן.

== מי אתה ==
- מדבר בעברית טבעית, בגובה העיניים
- לא מציק. לא שולח הודעות סתם. כל הודעה חייבת לתת ערך.
- מתאים את הטון למשתמש: ${ctx.profile.tone}
- אורך הודעה מועדף: ${ctx.profile.preferred_message_length}
- לא חוזר על דברים שכבר אמרת. נושאים שכבר כיסית: ${ctx.profile.dont_repeat.slice(-5).join(', ') || 'אין'}

== מי ${ctx.userName || 'המשתמש'} ==
אישיות פיננסית: ${ctx.profile.financial_personality}
שעות פעילות: ${ctx.profile.active_hours}
דפוסים שזיהית: ${JSON.stringify(ctx.profile.patterns)}
אימון אחרון: ${ctx.profile.last_coached_on || 'לא היה'}
תוצאות אימון: ${JSON.stringify(ctx.profile.coaching_results)}

== מצב פיננסי ==
הכנסות החודש: ${Math.round(ctx.monthlyIncome).toLocaleString('he-IL')}₪
הוצאות החודש: ${Math.round(ctx.monthlyExpenses).toLocaleString('he-IL')}₪
יתרה: ${Math.round(ctx.monthlyBalance).toLocaleString('he-IL')}₪
תקציב: ${budgetStr}
יעדים: ${goalsStr}
הוצאות היום: ${todayExpStr}
תנועות ממתינות: ${ctx.pendingCount}

== שיחה אחרונה ==
${recentChat || 'אין היסטוריה'}

== שעות מאז הודעה אחרונה ==
${Math.round(ctx.hoursSinceLastContact)} שעות

== אירוע נוכחי ==
${eventDescription}

== מה לעשות ==
בחר פעולה אחת מהרשימה וכתוב ב-action. החזר JSON בלבד:
{
  "should_respond": true/false,
  "action": "log_expense|undo_expense|show_money_flow|afford_check|show_summary|show_chart|show_budget|show_goals|show_cashflow|show_phi_score|classify|coaching|greeting|help|general_chat|none",
  "action_params": {
    "vendor": "...", "amount": 0, "category": "..."
  },
  "message": "ההודעה בעברית (רק אם action=coaching/greeting/general_chat, אחרת null)",
  "new_state": "monitoring/behavior/budget/goals/null",
  "profile_updates": {},
  "internal_reasoning": "מדוע (לא נשלח למשתמש)"
}

actions אפשריות:
- log_expense: המשתמש רושם הוצאה. חובה: action_params.vendor + action_params.amount. אופציונלי: action_params.category.
  דוגמאות: "סופר 450", "קפה 15", "200 נעליים", "דלק 300"
- undo_expense: המשתמש רוצה לבטל. "בטל", "טעות", "מחק"
- show_money_flow: "כמה יש לי", "כמה חופשי", "מצב כסף", "כמה אפשר להוציא היום", "יומי", "שבועי"
- afford_check: "אפשר לקנות X?", "יש לי כסף ל-X?", "אני רוצה לקנות". חובה: action_params.amount + action_params.description
- show_summary: "סיכום", "מצב", "סטטוס"
- show_chart: "גרף", "תרשים", "תראה לי גרף"
- show_budget: "תקציב", "כמה נשאר", "כמה אפשר להוציא"
- show_goals: "יעדים", "מטרות", "חיסכון"
- show_cashflow: "תזרים", "תחזית"
- show_phi_score: "ציון", "דירוג", "בריאות פיננסית"
- classify: "סווג", "תנועות ממתינות"
- coaching: הודעה יזומה/תגובה כללית — כתוב ב-message
- greeting: שלום, היי
- help: עזרה, תפריט
- general_chat: שאלה חופשית
- none: scheduled_check ואין מה להגיד

כללים:
1. scheduled_check ואין סיבה → action=none
2. הודעה מהמשתמש → תמיד action (לא none)
3. "סופר 450" → action=log_expense, action_params={vendor:"סופר",amount:450}
4. "200 נעליים" → action=log_expense, action_params={vendor:"נעליים",amount:200}
5. message רק כש-action=coaching/greeting/general_chat/help. לשאר ה-handler מייצר הודעה.
6. שפה ניטרלית מגדרית. פנייה בשם.
7. JSON בלבד, בלי markdown.`;
}

// ============================================================================
// Fast Path — Rule-based decisions, no Gemini (~100ms instead of ~4s)
// ============================================================================

const EXPENSE_PATTERN = /^(.+?)\s+(\d[\d,.]*)\s*$|^(\d[\d,.]*)\s+(.+?)$/;
const COMMAND_MAP: Record<string, string> = {
  'סיכום': 'show_summary', 'מצב': 'show_money_flow', 'סטטוס': 'show_money_flow',
  'גרף': 'show_chart', 'תרשים': 'show_chart',
  'תקציב': 'show_budget', 'כמה נשאר': 'show_money_flow',
  'יעדים': 'show_goals', 'מטרות': 'show_goals',
  'תזרים': 'show_cashflow', 'תחזית': 'show_cashflow',
  'ציון': 'show_phi_score', 'דירוג': 'show_phi_score',
  'ניתוח': 'show_summary', 'בטל': 'undo_expense',
  'עזרה': 'help', 'תפריט': 'help',
  'כמה יש לי': 'show_money_flow', 'כמה חופשי': 'show_money_flow',
  'יומי': 'show_money_flow', 'שבועי': 'show_money_flow',
};

function tryFastPath(message: string, ctx: BrainContext): any | null {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // 1. Exact command match
  for (const [cmd, action] of Object.entries(COMMAND_MAP)) {
    if (lower === cmd || lower.startsWith(cmd + ' ')) {
      return { should_respond: true, action, action_params: {}, message: null, internal_reasoning: `fast_path: ${cmd}` };
    }
  }

  // 2. Greeting
  if (/^(היי|שלום|הי|בוקר טוב|ערב טוב|מה נשמע|אהלן)$/i.test(trimmed)) {
    return { should_respond: true, action: 'greeting', message: `היי ${ctx.userName || ''}! 😊 מה תרצו לעשות?`, internal_reasoning: 'fast_path: greeting' };
  }

  // 3. Expense pattern: "סופר 450" or "450 סופר"
  const match = trimmed.match(EXPENSE_PATTERN);
  if (match) {
    const vendor = (match[1] || match[4] || '').trim();
    const amountStr = (match[2] || match[3] || '').replace(/,/g, '');
    const amount = parseFloat(amountStr);
    if (amount > 0 && amount < 100000 && vendor.length >= 2) {
      return {
        should_respond: true,
        action: 'log_expense',
        action_params: { vendor, amount },
        message: null,
        internal_reasoning: `fast_path: expense ${vendor} ${amount}`,
      };
    }
  }

  // 4. "Can I afford?" pattern: "אפשר לקנות X ב-Y"
  const affordMatch = trimmed.match(/אפשר\s+(?:לקנות|לרכוש)?\s*(.+?)\s+ב?-?(\d[\d,.]*)/);
  if (affordMatch) {
    const description = affordMatch[1].trim();
    const amount = parseFloat(affordMatch[2].replace(/,/g, ''));
    if (amount > 0) {
      return {
        should_respond: true,
        action: 'afford_check',
        action_params: { description, amount },
        message: null,
        internal_reasoning: `fast_path: afford_check ${description} ${amount}`,
      };
    }
  }

  // 5. Scheduled check — always silent unless Gemini decides otherwise
  // (returns null → goes to Gemini)

  // No fast path match → let Gemini handle
  return null;
}

// ============================================================================
// PhiBrain — Main Entry Point
// ============================================================================

export async function phiBrain(
  userId: string,
  event: PhiEvent
): Promise<PhiAction> {
  const ctx = await loadBrainContext(userId);

  // If no phone, can't send WhatsApp
  if (!ctx.phone) {
    return { silent: true };
  }

  // ── Special handling: classify pending transactions if needed ──
  if (ctx.pendingCount > 0 && (event.type === 'document_processed' || event.type === 'whatsapp_message')) {
    try {
      const result = await classifyAllTransactions(userId);
      if (result.classified.length > 0) {
        await applyClassifications(userId, result.classified);
        await learnFromClassifications(userId, result.classified);
      }
    } catch (err) {
      console.warn('[PhiBrain] Classification failed:', err);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // FAST PATH — Rule-based decisions, no Gemini call (~100ms)
  // 80% of messages are handled here. Gemini only for complex/ambiguous.
  // ══════════════════════════════════════════════════════════════

  let decision: any = null;

  if (event.type === 'whatsapp_message') {
    decision = tryFastPath(event.message, ctx);
  }

  // ══════════════════════════════════════════════════════════════
  // SLOW PATH — Gemini AI for complex messages (~2-4 seconds)
  // Only reached if fast path returned null
  // ══════════════════════════════════════════════════════════════

  if (!decision) {
    const prompt = buildBrainPrompt(ctx, event);
    try {
      const response = await chatWithGeminiFlash(
        prompt,
        'אתה φ — מאמן פיננסי אישי. החזר JSON בלבד.',
        ''
      );
      const cleaned = response.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
      decision = JSON.parse(cleaned);
    } catch (err) {
      console.error('[PhiBrain] Gemini error:', err);
      if (event.type === 'whatsapp_message') {
        return { sendMessage: `קיבלתי! 😊 רגע מעבד...` };
      }
      return { silent: true };
    }
  }

  const brainAction = decision.action || 'none';
  const params = decision.action_params || {};
  const isFastPath = decision.internal_reasoning?.startsWith('fast_path');
  log.info('phi_brain_decision', {
    userId, action: brainAction, fastPath: isFastPath,
    reasoning: decision.internal_reasoning?.substring(0, 100),
  });

  // ── Execute action via specialized handlers ──
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  const action: PhiAction = {};

  try {
    switch (brainAction) {
      // ── LOG EXPENSE ──
      case 'log_expense': {
        const vendor = params.vendor || 'הוצאה';
        const amount = Number(params.amount) || 0;
        if (amount <= 0) {
          action.sendMessage = 'לא הצלחתי לזהות סכום. נסו שוב: "סופר 450"';
          break;
        }
        // Create transaction
        const category = params.category || 'אחר';
        const { error } = await supabase.from('transactions').insert({
          user_id: userId,
          vendor,
          amount,
          type: 'expense',
          status: 'confirmed',
          source: 'whatsapp',
          tx_date: new Date().toISOString().split('T')[0],
          expense_category: category,
          category,
          auto_categorized: !!params.category,
        });
        if (error) {
          action.sendMessage = 'שגיאה בשמירה. נסו שוב.';
          break;
        }
        // Sync budget
        // Invalidate caches after expense
        cache.invalidate(userId);
        try {
          const { syncBudgetSpending } = await import('@/lib/services/BudgetSyncService');
          await syncBudgetSpending(userId);
        } catch {}
        // Build response with budget context
        const amountStr = amount.toLocaleString('he-IL');
        let response = `✅ ${amountStr}₪ ${vendor}`;
        if (ctx.budgetRemaining > 0) {
          const newRemaining = ctx.budgetRemaining - amount;
          response += `. נותר ${Math.max(0, Math.round(newRemaining)).toLocaleString('he-IL')}₪ מהתקציב`;
        }
        action.sendMessage = response;
        break;
      }

      // ── UNDO EXPENSE ──
      case 'undo_expense': {
        const { data: lastTx } = await supabase
          .from('transactions')
          .select('id, vendor, amount')
          .eq('user_id', userId)
          .eq('source', 'whatsapp')
          .eq('status', 'confirmed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (!lastTx) {
          action.sendMessage = 'לא מצאתי הוצאה אחרונה לביטול.';
          break;
        }
        await supabase.from('transactions').delete().eq('id', lastTx.id).eq('user_id', userId);
        try {
          const { syncBudgetSpending } = await import('@/lib/services/BudgetSyncService');
          await syncBudgetSpending(userId);
        } catch {}
        action.sendMessage = `🗑️ בוטל: ${Math.abs(Number(lastTx.amount)).toLocaleString('he-IL')}₪ ${lastTx.vendor}`;
        break;
      }

      // ── SHOW SUMMARY ──
      // ── MONEY FLOW ──
      case 'show_money_flow': {
        const { calculateMoneyFlow, formatMoneyFlowForWhatsApp } = await import('@/lib/finance/money-flow');
        const flow = await calculateMoneyFlow(userId);
        action.sendMessage = formatMoneyFlowForWhatsApp(flow, ctx.userName);
        break;
      }

      // ── AFFORD CHECK ──
      case 'afford_check': {
        const checkAmount = Number(params.amount) || 0;
        if (checkAmount <= 0) {
          action.sendMessage = 'כמה עולה הפריט? כתבו למשל: "אפשר לקנות טלוויזיה ב-3000?"';
          break;
        }
        const { canIAfford, formatAffordabilityForWhatsApp } = await import('@/lib/finance/money-flow');
        const affordResult = await canIAfford(userId, checkAmount, params.description || params.vendor);
        action.sendMessage = formatAffordabilityForWhatsApp(affordResult, checkAmount, params.description || params.vendor);
        break;
      }

      // ── SHOW SUMMARY ──
      case 'show_summary': {
        const { handleMonitoring } = await import('@/lib/conversation/states/monitoring');
        const monCtx = { userId, phone: ctx.phone, state: 'monitoring' as any, userName: ctx.userName };
        await handleMonitoring(monCtx, 'summary', ctx.userName, async (c) => ({ success: true }));
        action.silent = true; // monitoring handler already sent the message
        break;
      }

      // ── SHOW CHART ──
      case 'show_chart': {
        const { handleMonitoring } = await import('@/lib/conversation/states/monitoring');
        const monCtx = { userId, phone: ctx.phone, state: 'monitoring' as any, userName: ctx.userName };
        await handleMonitoring(monCtx, 'expense_chart', ctx.userName, async (c) => ({ success: true }));
        action.silent = true;
        break;
      }

      // ── SHOW BUDGET ──
      case 'show_budget': {
        const { handleMonitoring } = await import('@/lib/conversation/states/monitoring');
        const monCtx = { userId, phone: ctx.phone, state: 'monitoring' as any, userName: ctx.userName };
        await handleMonitoring(monCtx, 'budget_status', ctx.userName, async (c) => ({ success: true }));
        action.silent = true;
        break;
      }

      // ── SHOW GOALS ──
      case 'show_goals': {
        const { handleMonitoring } = await import('@/lib/conversation/states/monitoring');
        const monCtx = { userId, phone: ctx.phone, state: 'monitoring' as any, userName: ctx.userName };
        await handleMonitoring(monCtx, 'to_goals', ctx.userName, async (c) => ({ success: true }));
        action.silent = true;
        break;
      }

      // ── SHOW CASH FLOW ──
      case 'show_cashflow': {
        const { handleMonitoring } = await import('@/lib/conversation/states/monitoring');
        const monCtx = { userId, phone: ctx.phone, state: 'monitoring' as any, userName: ctx.userName };
        await handleMonitoring(monCtx, 'cash_flow', ctx.userName, async (c) => ({ success: true }));
        action.silent = true;
        break;
      }

      // ── SHOW PHI SCORE ──
      case 'show_phi_score': {
        const { handleMonitoring } = await import('@/lib/conversation/states/monitoring');
        const monCtx = { userId, phone: ctx.phone, state: 'monitoring' as any, userName: ctx.userName };
        await handleMonitoring(monCtx, 'phi_score', ctx.userName, async (c) => ({ success: true }));
        action.silent = true;
        break;
      }

      // ── CLASSIFY ──
      case 'classify': {
        action.classify = true;
        action.sendMessage = decision.message || 'מסווג תנועות...';
        break;
      }

      // ── HELP ──
      case 'help': {
        action.sendMessage =
          `📋 *מה אפשר לעשות:*\n\n` +
          `💸 רישום הוצאה: *"סופר 450"*\n` +
          `🗑️ ביטול: *"בטל"*\n` +
          `📊 סיכום: *"סיכום"*\n` +
          `📈 גרף: *"גרף"*\n` +
          `💰 תקציב: *"תקציב"*\n` +
          `🎯 יעדים: *"יעדים"*\n` +
          `📉 תזרים: *"תזרים"*\n` +
          `⭐ ציון: *"ציון"*\n` +
          `📄 שליחת דוח: שלחו PDF/תמונה`;
        break;
      }

      // ── COACHING / GREETING / GENERAL CHAT ──
      case 'coaching':
      case 'greeting':
      case 'general_chat': {
        action.sendMessage = decision.message;
        break;
      }

      // ── NONE (silent) ──
      case 'none':
      default: {
        action.silent = true;
        break;
      }
    }
  } catch (handlerErr) {
    console.error(`[PhiBrain] Handler error for action=${brainAction}:`, handlerErr);
    // Fallback: use Gemini's message if handler failed
    if (decision.message) {
      action.sendMessage = decision.message;
    }
  }

  // ── Send message if handler produced one ──
  if (action.sendMessage && !action.silent) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: action.sendMessage,
    });

    // Log to alerts (short summary)
    await supabase.from('alerts').insert({
      user_id: userId,
      type: `phi_brain_${brainAction}`,
      message: action.sendMessage.substring(0, 200),
      status: 'sent',
    });

    // Log FULL message to wa_messages (conversation history)
    await supabase.from('wa_messages').insert({
      user_id: userId,
      direction: 'outgoing',
      msg_type: 'text',
      payload: {
        body: action.sendMessage,
        action: brainAction,
        fast_path: isFastPath || false,
      },
      status: 'sent',
    });

    // Invalidate brain context cache (new message = stale context)
    cache.invalidate(userId);
  }

  if (decision.new_state) {
    action.updateState = decision.new_state;
  }
  if (decision.profile_updates && Object.keys(decision.profile_updates).length > 0) {
    action.updateProfile = decision.profile_updates;
  }

  if (action.updateState) {
    await supabase
      .from('users')
      .update({ onboarding_state: action.updateState })
      .eq('id', userId);
  }

  if (action.updateProfile) {
    const existing = ctx.profile;
    const merged = {
      ...existing,
      ...action.updateProfile,
      patterns: { ...existing.patterns, ...(action.updateProfile.patterns || {}) },
      dont_repeat: [...(existing.dont_repeat || []), ...(action.updateProfile.last_coached_on ? [action.updateProfile.last_coached_on] : [])].slice(-20),
    };

    const { data: userData } = await supabase
      .from('users')
      .select('classification_context')
      .eq('id', userId)
      .single();

    const classCtx = userData?.classification_context || {};
    await supabase
      .from('users')
      .update({ classification_context: { ...classCtx, phi_profile: merged } })
      .eq('id', userId);
  }

  return action;
}

// ============================================================================
// Convenience: handle WhatsApp message via PhiBrain
// ============================================================================

export async function handleMessageWithBrain(
  userId: string,
  message: string
): Promise<{ responded: boolean; message?: string }> {
  const action = await phiBrain(userId, { type: 'whatsapp_message', message });
  return {
    responded: !action.silent,
    message: action.sendMessage,
  };
}

// ============================================================================
// Convenience: scheduled check (replaces all cron outreach)
// ============================================================================

export async function scheduledBrainCheck(userId: string): Promise<void> {
  await phiBrain(userId, { type: 'scheduled_check' });
}
