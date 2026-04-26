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
import { type ChatTurn } from '@/lib/ai/gemini-client';
import { BRAIN_TOOL_DECLARATIONS, executeBrainTool } from '@/lib/ai/brain-tools';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { classifyAllTransactions, applyClassifications, learnFromClassifications, formatSummaryForWhatsApp } from '@/lib/classification/ai-classifier';
import { cache } from '@/lib/utils/cache';
import { log } from '@/lib/utils/logger';
import { getActiveThread, getThreadMessages } from '@/lib/conversation/threading';
import { getRecentSummaries, type StoredSummary } from '@/lib/ai/conversation-summarizer';
import { deriveAndStoreFocusIfMissing, renderFocusForPrompt, type CurrentFocus } from '@/lib/ai/current-focus';
import {
  PHI_IDENTITY,
  PHI_OPERATING_PRINCIPLES,
  PHI_ANTI_PATTERNS,
  PHI_FEW_SHOT_EXAMPLES,
  PHI_USE_CONTEXT_RULE,
  getPhaseGuidance,
  getStateGuidance,
  type Phase as PersonaPhase,
} from '@/lib/ai/persona';

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
  cooldown_until?: string | null;  // ISO timestamp — silence proactive nudges until this time
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
  // Anti-repeat: outgoing message bodies sent in last 72h (lowercased, trimmed)
  recentOutgoingBodies: string[];
  // True if user replied to bot in last 48h — warm conversation, prefer silence
  hasRecentUserReply: boolean;
  // Open thread (the active conversation): history that gets passed to chats.create
  threadHistory: ChatTurn[];
  // Persistent memory across past closed conversations (rolling 10)
  recentSummaries: StoredSummary[];
  // φ's current "theory" about what to coach on (stable across calls)
  currentFocus: CurrentFocus | null;
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
  const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const [
    { data: user },
    { data: monthlyTx },
    { data: todayTx },
    { data: goals },
    { data: budget },
    { count: pendingCount },
    { data: recentAlerts },
    { data: recentMessages },
    { data: recentOutgoing },
    { data: recentIncoming },
  ] = await Promise.all([
    supabase.from('users').select('id, name, phone, phase, onboarding_state, classification_context').eq('id', userId).single(),
    supabase.from('transactions').select('type, amount').eq('user_id', userId).eq('status', 'confirmed').or('is_summary.is.null,is_summary.eq.false').gte('tx_date', firstOfMonth).lte('tx_date', today),
    supabase.from('transactions').select('vendor, amount, expense_category, source').eq('user_id', userId).eq('status', 'confirmed').eq('type', 'expense').or('is_summary.is.null,is_summary.eq.false').eq('tx_date', today),
    supabase.from('goals').select('name, target_amount, current_amount, status').eq('user_id', userId).eq('status', 'active').limit(5),
    supabase.from('budgets').select('total_budget, total_spent').eq('user_id', userId).eq('month', currentMonth).in('status', ['active', 'warning', 'exceeded']).limit(1).maybeSingle(),
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'pending'),
    supabase.from('alerts').select('created_at, type').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('wa_messages').select('payload, direction, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('wa_messages').select('payload, created_at').eq('user_id', userId).eq('direction', 'outgoing').gte('created_at', seventyTwoHoursAgo).order('created_at', { ascending: false }).limit(50),
    supabase.from('wa_messages').select('id').eq('user_id', userId).eq('direction', 'incoming').gte('created_at', fortyEightHoursAgo).limit(1),
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
      content: extractMessageBody(m.payload) || '',
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
    recentOutgoingBodies: (recentOutgoing || [])
      .map((m: any) => extractMessageBody(m.payload).toLowerCase().trim())
      .filter((s: string) => s.length > 0),
    hasRecentUserReply: !!(recentIncoming && recentIncoming.length > 0),
    threadHistory: [],
    recentSummaries: [],
    currentFocus: null,
  };
}

/**
 * Load brain context AND populate the conversation memory pieces (active thread
 * + recent summaries). Kept separate from _loadBrainContextImpl so callers that
 * don't need memory (background jobs) can skip the extra IO.
 */
async function loadBrainContextWithMemory(userId: string, includeOpenThread: boolean): Promise<BrainContext> {
  const ctx = await loadBrainContext(userId);

  const [thread, summaries, focus] = await Promise.all([
    includeOpenThread ? getActiveThread(userId).then(t =>
      t.isActive && t.conversationId
        ? getThreadMessages(userId, t.conversationId, { limit: 50 })
        : Promise.resolve([])
    ) : Promise.resolve([]),
    getRecentSummaries(userId),
    deriveAndStoreFocusIfMissing(
      userId,
      ctx.phase,
      ctx.activeGoals.length > 0,
      ctx.budgetRemaining !== 0, // any non-zero budget means budget exists
      ctx.pendingCount,
    ),
  ]);

  ctx.threadHistory = thread.map(m => ({
    role: m.direction === 'incoming' ? 'user' as const : 'model' as const,
    text: m.body,
  }));
  ctx.recentSummaries = summaries;
  ctx.currentFocus = focus;
  return ctx;
}

/**
 * Pull the human-readable body out of the wa_messages.payload JSONB.
 * Outgoing messages: stored as { body: "..." } by sendPhiMessage / GreenAPI client.
 * Incoming messages: stored as raw GreenAPI webhook payload — drill into messageData.textMessageData.textMessage.
 */
function extractMessageBody(payload: any): string {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload.body === 'string') return payload.body;
  // Incoming GreenAPI shape
  const md = payload.messageData;
  if (md) {
    if (md.textMessageData?.textMessage) return md.textMessageData.textMessage;
    if (md.extendedTextMessageData?.text) return md.extendedTextMessageData.text;
  }
  return '';
}

/**
 * Was a similar message already sent in the last 72h?
 * Match on substring (case-insensitive) so paraphrases of the same nudge are detected.
 */
function wasRecentlyNudged(ctx: BrainContext, marker: string): boolean {
  const m = marker.toLowerCase().trim();
  return ctx.recentOutgoingBodies.some(b => b.includes(m));
}

// ============================================================================
// The Master Prompt
// ============================================================================

// ============================================================================
// Brain response parser — graceful fallback when model returns non-JSON
// ============================================================================

/**
 * Parse the raw model output. Two cases:
 *  1. Valid JSON matching our schema → use as-is.
 *  2. Plain text (model gave up on JSON, or output got mangled by tool calls) →
 *     wrap as a coaching message so we still respond to the user.
 *
 * The brain rarely fails this way, but when it does we don't want the user to
 * see silence. A graceful "here's what I have" reply beats a 30s timeout.
 */
function parseBrainResponse(raw: string, event: PhiEvent): any {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    // Empty response → silence on scheduled checks; gentle fallback on user message
    if (event.type === 'whatsapp_message') {
      return {
        action: 'general_chat',
        should_respond: true,
        message: 'רגע, מעבד את מה שאמרת… 😊',
        internal_reasoning: 'empty_model_output_fallback',
      };
    }
    return { action: 'none', should_respond: false, internal_reasoning: 'empty_model_output' };
  }

  // Strip markdown code fences if present
  const cleaned = trimmed.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && parsed.action) {
      return parsed;
    }
  } catch { /* fall through */ }

  // Try to extract an embedded JSON object (common when model adds preamble)
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === 'object' && parsed.action) {
        return parsed;
      }
    } catch { /* fall through */ }
  }

  // Last resort: treat the raw text as a coaching message. This is what
  // makes the bot graceful — instead of dying on a JSON parse, we send
  // whatever the model said. Better imperfect than silent.
  if (event.type === 'whatsapp_message' && cleaned.length > 0) {
    console.warn('[PhiBrain] Falling back to raw text as coaching message:', cleaned.substring(0, 200));
    return {
      action: 'coaching',
      should_respond: true,
      message: cleaned.substring(0, 1500),
      internal_reasoning: 'raw_text_fallback',
    };
  }

  return { action: 'none', should_respond: false, internal_reasoning: 'unparseable_output' };
}

// ============================================================================
// Brain Decision Schema — used as documentation in the system prompt
// (not enforced via responseJsonSchema in the chatWithTools path due to
// SDK fragility when combined with function calling)
// ============================================================================

const BRAIN_ACTIONS = [
  // Data + transactions
  'log_expense', 'undo_expense',
  // Read-only views
  'show_money_flow', 'show_summary', 'show_chart', 'show_budget', 'show_goals',
  'show_cashflow', 'show_phi_score', 'show_patterns', 'check_duplicates', 'afford_check',
  // Onboarding flow controls (replace canned router handlers)
  'set_user_name', 'request_document', 'mark_skip_document',
  // Conversation
  'classify', 'coaching', 'greeting', 'help', 'general_chat', 'none',
] as const;

// Simplified schema — no nullable types, no `null` in enums (those don't play nice
// with structured-output mode). Optional fields are just absent rather than null.
const BRAIN_DECISION_SCHEMA: Record<string, any> = {
  type: 'object',
  properties: {
    should_respond: { type: 'boolean', description: 'Whether to send the user a message right now.' },
    action: {
      type: 'string',
      enum: [...BRAIN_ACTIONS],
      description: 'The handler to invoke. Use "none" for silence on scheduled checks.',
    },
    action_params: {
      type: 'object',
      properties: {
        vendor: { type: 'string' },
        amount: { type: 'number' },
        category: { type: 'string' },
        description: { type: 'string' },
        name: { type: 'string', description: 'Used by set_user_name — the human name extracted from the user message.' },
      },
    },
    message: { type: 'string', description: 'Hebrew message to send. Required for coaching/greeting/general_chat/help/set_user_name/request_document/mark_skip_document. Empty string for view actions where the handler generates the message.' },
    new_state: {
      type: 'string',
      enum: ['monitoring', 'behavior', 'budget', 'goals', 'classification', ''],
      description: 'Optional — leave empty string if no state change needed.',
    },
    internal_reasoning: { type: 'string', description: 'Why this choice (for logs, not shown to user).' },
  },
  required: ['action', 'should_respond'],
};

// ============================================================================
// System Instruction Builder — sticky persona + memory + state
// ============================================================================

function buildSystemInstruction(ctx: BrainContext, event: PhiEvent): string {
  const todayExpStr = ctx.todayExpenses.length > 0
    ? ctx.todayExpenses.map(e => `${e.vendor}: ${e.amount}₪`).join(', ')
    : 'לא נרשמו';

  const goalsStr = ctx.activeGoals.length > 0
    ? ctx.activeGoals.map(g => `${g.name}: ${g.percentage}% (${g.current}/${g.target}₪)`).join(', ')
    : 'אין יעדים פעילים';

  const budgetStr = ctx.budgetRemaining > 0
    ? `נותר ${Math.round(ctx.budgetRemaining).toLocaleString('he-IL')}₪`
    : ctx.budgetRemaining < 0
    ? `חריגה: ${Math.abs(Math.round(ctx.budgetRemaining)).toLocaleString('he-IL')}₪`
    : 'אין תקציב מוגדר';

  // Past conversation memory — the actual continuity feature
  const memoryBlock = ctx.recentSummaries.length === 0
    ? 'אין שיחות קודמות מסוכמות.'
    : ctx.recentSummaries.slice(-5).map(s => {
        const date = new Date(s.ended_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
        const topics = s.topics.join(', ');
        const facts = s.key_facts.length > 0 ? `\n   עובדות: ${s.key_facts.join('; ')}` : '';
        const open = s.open_threads.length > 0 ? `\n   פתוח: ${s.open_threads.join('; ')}` : '';
        return `• ${date} — ${topics} (mood: ${s.user_mood}). ${s.outcome}${facts}${open}`;
      }).join('\n');

  // Cooldown / anti-repeat hints (so the AI knows what NOT to repeat)
  const dontRepeat = (ctx.profile.dont_repeat || []).slice(-5).join(', ') || 'אין';

  // State-specific guidance trumps phase guidance during onboarding sub-states
  // (waiting_for_name, waiting_for_document). Falls back to phase otherwise.
  const stateGuidance = getStateGuidance(ctx.state);
  const phaseGuidance = stateGuidance || getPhaseGuidance((ctx.phase as PersonaPhase) || 'data_collection');

  return [
    PHI_IDENTITY,
    '',
    PHI_OPERATING_PRINCIPLES,
    '',
    PHI_ANTI_PATTERNS,
    '',
    PHI_USE_CONTEXT_RULE,
    '',
    PHI_FEW_SHOT_EXAMPLES,
    '',
    phaseGuidance,
    '',
    `## מי ${ctx.userName || 'המשתמש'}`,
    `- אישיות פיננסית: ${ctx.profile.financial_personality}`,
    `- סגנון תקשורת: ${ctx.profile.communication_style}`,
    `- אורך הודעה מועדף: ${ctx.profile.preferred_message_length}`,
    `- שעות פעילות: ${ctx.profile.active_hours}`,
    `- נושאים שכבר כיסית לאחרונה (אל תחזור): ${dontRepeat}`,
    '',
    '## זיכרון משיחות קודמות',
    memoryBlock,
    '',
    '## פוקוס נוכחי',
    renderFocusForPrompt(ctx.currentFocus),
    '',
    '## מצב פיננסי נוכחי',
    `- הכנסות החודש: ${Math.round(ctx.monthlyIncome).toLocaleString('he-IL')}₪`,
    `- הוצאות החודש: ${Math.round(ctx.monthlyExpenses).toLocaleString('he-IL')}₪`,
    `- יתרה: ${Math.round(ctx.monthlyBalance).toLocaleString('he-IL')}₪`,
    `- תקציב: ${budgetStr}`,
    `- יעדים: ${goalsStr}`,
    `- הוצאות היום: ${todayExpStr}`,
    `- תנועות ממתינות: ${ctx.pendingCount}`,
    '',
    '## כללים טכניים לתשובה',
    '1. **החזר JSON בלבד** — בלי טקסט סביבו, בלי markdown fences. זו ההודעה האחרונה שלך, היא חייבת להיות JSON parseable.',
    '   הסכמה: { "action": "...", "should_respond": true|false, "action_params": {...}, "message": "...", "new_state": "...", "internal_reasoning": "..." }',
    '2. אם אתה צריך לבדוק נתונים (תנועות אחרונות, הלוואות, חריגות) — קודם תקרא ל-tools, ואז תרכיב את ה-JSON הסופי עם המסקנה.',
    '3. whatsapp_message → תמיד action ≠ none. scheduled_check ללא סיבה משמעותית → action=none.',
    '4. message חובה רק עבור coaching / greeting / general_chat / help / set_user_name / request_document / mark_skip_document. עבור פעולות תצוגה אחרות (show_*, log_expense, וכו\') ה-handler מייצר את ההודעה.',
    `5. השעה הנוכחית: ${ctx.currentHour}:00.`,
    '',
    'דוגמה ל-JSON תקני:',
    '{"action":"coaching","should_respond":true,"message":"היי דני! בוא נתחיל...","internal_reasoning":"greeting_with_context"}',
  ].join('\n');
}

/**
 * The "user message" sent to chat.sendMessage — varies by event type.
 * Conversational triggers send the user's actual text; other triggers send a
 * synthetic system-style prompt describing what just happened.
 */
function buildBrainTriggerMessage(event: PhiEvent, ctx: BrainContext): string {
  switch (event.type) {
    case 'whatsapp_message':
      return event.message;
    case 'scheduled_check':
      return `(בדיקה תקופתית, ${ctx.currentHour}:00. החלט אם יש סיבה משמעותית לפנות עכשיו או להישאר שקט.)`;
    case 'document_processed':
      return `(עובד דוח ${event.documentType}: ${event.transactionCount} תנועות נוספו.)`;
    case 'expense_logged':
      return `(נרשמה הוצאה: ${event.vendor} ${event.amount}₪ — ${event.category}.)`;
    case 'salary_detected':
      return `(זוהתה משכורת: ${event.amount.toLocaleString('he-IL')}₪.)`;
    case 'budget_exceeded':
      return `(חריגת תקציב בסעיף ${event.category}: ${event.spent}/${event.budget}₪.)`;
    case 'goal_milestone':
      return `(יעד "${event.goalName}" הגיע ל-${event.percentage}%.)`;
    default:
      return `(אירוע: ${(event as any).type})`;
  }
}

// (Legacy buildBrainPrompt was removed — replaced by buildSystemInstruction +
//  buildBrainTriggerMessage, which use chats.create with responseJsonSchema.)

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
  // ניתוח = real pattern/insights analysis (User Guide promise: "ניתוח דפוסי הוצאות — איפה אפשר לחסוך")
  'ניתוח': 'show_patterns', 'דפוסים': 'show_patterns', 'תובנות': 'show_patterns',
  // כפילויות = User Guide promise: "בדיקת חשד לכפל תשלום"
  'כפילויות': 'check_duplicates', 'כפל': 'check_duplicates', 'כפל תשלום': 'check_duplicates',
  // Classification triggers — direct route, no LLM needed
  'נתחיל': 'classify', 'נמשיך': 'classify', 'סווג': 'classify', 'בוא נתחיל': 'classify',
  'בטל': 'undo_expense',
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

  // 2. Greeting — always with clear guidance, never open-ended
  if (/^(היי|שלום|הי|בוקר טוב|ערב טוב|מה נשמע|אהלן)$/i.test(trimmed)) {
    // Build a useful greeting, not an open question
    const name = ctx.userName || '';
    let greetMsg = `היי ${name}! 😊\n\n`;

    if (ctx.monthlyIncome > 0 || ctx.monthlyExpenses > 0) {
      const balance = ctx.monthlyIncome - ctx.monthlyExpenses;
      greetMsg += `📊 החודש: ${ctx.monthlyExpenses.toLocaleString('he-IL')}₪ הוצאות`;
      if (balance >= 0) greetMsg += ` | +${balance.toLocaleString('he-IL')}₪ 💚`;
      greetMsg += `\n`;
    }

    greetMsg += `\n💡 מה אפשר לעשות:\n`;
    greetMsg += `📊 *"סיכום"* — סיכום חודשי\n`;
    greetMsg += `💰 *"תקציב"* — מצב תקציב\n`;
    greetMsg += `✏️ *"סופר 450"* — רישום הוצאה\n`;
    greetMsg += `📋 *"עזרה"* — תפריט מלא`;

    return { should_respond: true, action: 'greeting', message: greetMsg, internal_reasoning: 'fast_path: greeting_with_guidance' };
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
// Scheduled Check Fast Path — rule-based, no Gemini
// ============================================================================

async function tryScheduledFastPath(ctx: BrainContext): Promise<any | null> {
  // Rule: cooldown active (set after a friendly conversation) → silent
  const cooldownUntil = ctx.profile?.cooldown_until;
  if (cooldownUntil && new Date(cooldownUntil) > new Date()) {
    return { should_respond: false, action: 'none', internal_reasoning: 'scheduled: cooldown_active' };
  }

  // Rule: if user has pending transactions, nudge — but not if we already nudged in last 72h
  if (ctx.pendingCount > 5) {
    if (wasRecentlyNudged(ctx, 'תנועות שממתינות לסיווג')) {
      return { should_respond: false, action: 'none', internal_reasoning: 'scheduled: pending_recent_nudge_sent' };
    }
    return {
      should_respond: true,
      action: 'coaching',
      message: `היי ${ctx.userName || ''}! יש ${ctx.pendingCount} תנועות שממתינות לסיווג.\nכתבו *"נמשיך"* ואסדר הכל 😊`,
      internal_reasoning: 'scheduled: pending_transactions',
    };
  }

  // Rule: budget exceeded — only warn if (a) it's a new condition and (b) we didn't already say it this week
  if (ctx.budgetRemaining < 0) {
    if (wasRecentlyNudged(ctx, 'שמתי לב שחרגתם מהתקציב')) {
      return { should_respond: false, action: 'none', internal_reasoning: 'scheduled: budget_exceeded_recent_nudge_sent' };
    }
    return {
      should_respond: true,
      action: 'coaching',
      message: `${ctx.userName || ''}, שמתי לב שחרגתם מהתקציב החודשי.\nכתבו *"כמה יש לי"* לראות את המצב.`,
      internal_reasoning: 'scheduled: budget_exceeded',
    };
  }

  // Rule: today's expenses unusually high — only fire once per day max
  if (ctx.todayExpenses.length >= 5) {
    const todayTotal = ctx.todayExpenses.reduce((s, e) => s + e.amount, 0);
    if (wasRecentlyNudged(ctx, 'יום פעיל')) {
      return { should_respond: false, action: 'none', internal_reasoning: 'scheduled: busy_day_recent_nudge_sent' };
    }
    return {
      should_respond: true,
      action: 'coaching',
      message: `יום פעיל! ${ctx.todayExpenses.length} הוצאות, ${todayTotal.toLocaleString('he-IL')}₪.\nכתבו *"סיכום"* לראות את התמונה.`,
      internal_reasoning: 'scheduled: busy_spending_day',
    };
  }

  // Activate the insights engine — surface a high-priority insight if one exists
  // and we haven't already shared it recently. Only for users in active phases.
  if (ctx.phase === 'behavior' || ctx.phase === 'goals' || ctx.phase === 'budget' || ctx.phase === 'monitoring') {
    try {
      const { generateInsights } = await import('@/lib/proactive/insights-generator');
      const insights = await generateInsights(ctx.userId);
      const highPriority = insights.find(i => i.priority === 'high');
      if (highPriority && !wasRecentlyNudged(ctx, highPriority.message.substring(0, 30))) {
        return {
          should_respond: true,
          action: 'coaching',
          message: `💡 ${highPriority.message}${highPriority.suggestedAction ? `\n\n${highPriority.suggestedAction}` : ''}`,
          internal_reasoning: `scheduled: insight_${highPriority.type}`,
        };
      }
    } catch (err) {
      console.warn('[PhiBrain] insight generation failed (non-fatal):', err);
    }
  }

  // Default: silent — nothing interesting to report
  return { should_respond: false, action: 'none', internal_reasoning: 'scheduled: nothing_to_report' };
}

// ============================================================================
// PhiBrain — Main Entry Point
// ============================================================================

export async function phiBrain(
  userId: string,
  event: PhiEvent,
  opts: { skipChannelSend?: boolean } = {}
): Promise<PhiAction> {
  // Memory-aware context: open thread for whatsapp_message, summaries always.
  // For scheduled_check we don't include the open thread (cron decides based on
  // state, not on what the user just said).
  const wantsThread = event.type === 'whatsapp_message' || event.type === 'document_processed';
  const ctx = await loadBrainContextWithMemory(userId, wantsThread);

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

  // Fast path for scheduled_check — rule-based, no Gemini
  if (event.type === 'scheduled_check') {
    decision = await tryScheduledFastPath(ctx);
  }

  // ══════════════════════════════════════════════════════════════
  // SLOW PATH — Gemini AI for complex messages (~2-4 seconds)
  // Only reached if fast path returned null
  // ══════════════════════════════════════════════════════════════

  if (!decision) {
    const systemInstruction = buildSystemInstruction(ctx, event);
    const triggerMessage = buildBrainTriggerMessage(event, ctx);

    // Drop the very last incoming message from threadHistory if the trigger IS
    // that same message — chats.create wants history WITHOUT the new turn.
    let history = ctx.threadHistory;
    if (event.type === 'whatsapp_message' && history.length > 0) {
      const last = history[history.length - 1];
      if (last.role === 'user' && last.text === event.message) {
        history = history.slice(0, -1);
      }
    }

    try {
      // Tools are only useful when the user already has data to ground answers in.
      // For new users (no transactions), the brain should respond directly — adding
      // tools causes degenerate "call → no data → call another → ..." loops where
      // the model exhausts maxToolHops without producing text.
      const userHasData = ctx.monthlyExpenses > 0 || ctx.monthlyIncome > 0 || ctx.pendingCount > 0;

      let raw: string;
      if (userHasData) {
        const { chatWithTools } = await import('@/lib/ai/gemini-client');
        raw = await chatWithTools({
          systemInstruction,
          history,
          userMessage: triggerMessage,
          tools: BRAIN_TOOL_DECLARATIONS as any,
          executeTool: (name, args) => executeBrainTool(userId, name, args),
          thinkingLevel: 'low',
          maxOutputTokens: 2000,
          maxToolHops: 4,
          responseJsonSchema: BRAIN_DECISION_SCHEMA,
        });
      } else {
        // No data → no tools. Plain memory chat with strict schema.
        const { chatWithMemory } = await import('@/lib/ai/gemini-client');
        raw = await chatWithMemory({
          systemInstruction,
          history,
          userMessage: triggerMessage,
          thinkingLevel: 'low',
          maxOutputTokens: 1500,
          responseJsonSchema: BRAIN_DECISION_SCHEMA,
        });
      }
      decision = parseBrainResponse(raw, event);
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
        // Classify using hard rules + learned rules (no Gemini needed)
        let category = params.category || '';
        let expenseType = 'variable';
        if (!category) {
          // Try hard rules first
          const { findBestMatch } = await import('@/lib/finance/categories');
          const hardMatch = findBestMatch(vendor);
          if (hardMatch) {
            category = hardMatch.name;
            expenseType = hardMatch.type;
          }
        }
        if (!category) {
          // Try user's learned rules
          const { data: userRule } = await supabase
            .from('user_category_rules')
            .select('category')
            .eq('user_id', userId)
            .ilike('vendor_pattern', `%${vendor.toLowerCase().trim()}%`)
            .order('confidence', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (userRule?.category) category = userRule.category;
        }
        if (!category) category = 'אחר';

        const { error } = await supabase.from('transactions').insert({
          user_id: userId,
          vendor,
          amount,
          type: 'expense',
          status: 'confirmed',
          source: 'whatsapp',
          tx_date: new Date().toISOString().split('T')[0],
          expense_category: category,
          expense_type: expenseType,
          category,
          auto_categorized: category !== 'אחר',
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
        // Build response with category + budget context
        const amountStr = amount.toLocaleString('he-IL');
        let response = `✅ ${amountStr}₪ ${vendor}`;
        if (category !== 'אחר') response += ` (${category})`;
        if (ctx.budgetRemaining > 0) {
          const newRemaining = ctx.budgetRemaining - amount;
          response += `\nנותר ${Math.max(0, Math.round(newRemaining)).toLocaleString('he-IL')}₪ מהתקציב`;
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

      // ── SHOW PATTERNS / INSIGHTS ──
      // User Guide promise: "ניתוח | ניתוח דפוסי הוצאות — איפה אפשר לחסוך"
      case 'show_patterns': {
        const { generateInsights } = await import('@/lib/proactive/insights-generator');
        const insights = await generateInsights(userId);

        if (insights.length === 0) {
          action.sendMessage = `🔍 *ניתוח דפוסים*\n\nעדיין לא זיהיתי דפוסים מובהקים. תמשיך להעלות דוחות ולרשום הוצאות, ואחרי שיהיה לי מספיק דאטה אזהה את ההזדמנויות לחסוך.`;
        } else {
          // Show top 5 highest-priority insights
          const top = insights.slice(0, 5);
          let msg = `🔍 *ניתוח דפוסים והזדמנויות:*\n\n`;
          for (const ins of top) {
            const emoji = ins.priority === 'high' ? '🔴' : ins.priority === 'medium' ? '🟡' : '🟢';
            msg += `${emoji} ${ins.message}\n`;
            if (ins.suggestedAction) msg += `   💡 ${ins.suggestedAction}\n`;
            msg += `\n`;
          }
          msg += `_כתוב *"תקציב"* כדי לראות איך זה משפיע, או *"יעדים"* כדי לכוון את החיסכון._`;
          action.sendMessage = msg;
        }
        break;
      }

      // ── CHECK DUPLICATES ──
      // User Guide promise: "כפילויות | בדיקת חשד לכפל תשלום"
      case 'check_duplicates': {
        const { handleMonitoring } = await import('@/lib/conversation/states/monitoring');
        const monCtx = { userId, phone: ctx.phone, state: 'monitoring' as any, userName: ctx.userName };
        await handleMonitoring(monCtx, 'duplicates', ctx.userName, async (c) => ({ success: true }));
        action.silent = true;
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // ONBOARDING actions — replace canned router handlers
      // ══════════════════════════════════════════════════════════════

      // ── SET USER NAME — extracts name from natural language and advances state ──
      case 'set_user_name': {
        const candidate = (params.name || '').toString().trim();
        // Sanity: 1-40 chars, no @ or URL, not numbers
        if (!candidate || candidate.length < 2 || candidate.length > 40 ||
            /[@<>]|http/i.test(candidate) || /^\d+$/.test(candidate)) {
          // Fallback: ask again, naturally — let Gemini compose
          action.sendMessage = decision.message || 'איך קוראים לך?';
          break;
        }
        await supabase.from('users')
          .update({ name: candidate, full_name: candidate, onboarding_state: 'waiting_for_document' })
          .eq('id', userId);
        action.sendMessage = decision.message || `נעים מאוד, ${candidate}! 👋\n\nכדי להתחיל, תוכל לשלוח לי דוח עו״ש מהבנק (PDF או תמונה) של החודשים האחרונים?`;
        action.updateState = 'waiting_for_document';
        break;
      }

      // ── REQUEST DOCUMENT — natural-language doc request, message comes from Gemini ──
      case 'request_document': {
        // Gemini composes the message contextually (mentioning what we'll do with it)
        action.sendMessage = decision.message ||
          `🏦 כדי שאוכל לעזור לך באמת, אני צריך דוח בנק או אשראי.\n\n` +
          `שלח לי PDF/תמונה של דוח עו״ש מהחודשים האחרונים — אני אנתח, אסווג, וניתן לך תמונה ברורה. כל שלוקח לי דקה-שתיים 🙂`;
        break;
      }

      // ── MARK SKIP DOCUMENT — user said "I don't have one right now" ──
      case 'mark_skip_document': {
        // Same logic as the legacy skip path, but with brain-composed message
        const { count: txCount } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);

        const newState = (txCount || 0) > 0 ? 'classification' : 'monitoring';
        const { calculatePhase: calcPhaseSkip } = await import('@/lib/services/PhaseService');
        const skipPhase = await calcPhaseSkip(userId);
        await supabase.from('users')
          .update({ onboarding_state: newState, phase: skipPhase, phase_updated_at: new Date().toISOString() })
          .eq('id', userId);
        action.sendMessage = decision.message ||
          (newState === 'classification'
            ? `בסדר! 😊 יש כבר תנועות שצריך לסדר. כתוב *"נתחיל"* כשתהיה מוכן.`
            : `בסדר! 😊 כשיהיה לך דוח — פשוט שלח. בינתיים אפשר לשאול אותי כל שאלה.`);
        action.updateState = newState;
        break;
      }

      // ── CLASSIFY — actually delegate to the classification flow ──
      case 'classify': {
        const { startClassification } = await import('@/lib/conversation/states/classification');
        const ctxForClass = { userId, phone: ctx.phone, state: 'classification' as any, userName: ctx.userName };
        await startClassification(ctxForClass);
        action.silent = true; // startClassification sends its own message
        break;
      }

      // ── HELP ──
      case 'help': {
        action.sendMessage =
          `📋 *מה אפשר לעשות:*\n\n` +
          `💸 רישום הוצאה: *"סופר 450"*\n` +
          `🗑️ ביטול: *"בטל"*\n` +
          `📊 סיכום חודשי: *"סיכום"*\n` +
          `📈 גרף הוצאות: *"גרף"*\n` +
          `💰 מצב תקציב: *"תקציב"*\n` +
          `🎯 התקדמות יעדים: *"יעדים"*\n` +
          `📉 תזרים 3 חודשים: *"תזרים"*\n` +
          `⭐ ציון φ: *"ציון"*\n` +
          `🔍 ניתוח דפוסים: *"ניתוח"*\n` +
          `⚠️ בדיקת כפילויות: *"כפילויות"*\n` +
          `🛒 *"אפשר לקנות X ב-Y"* — בדיקת יכולת לרכישה\n` +
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
  // For WhatsApp: sent via GreenAPI (auto-logged to wa_messages by the client).
  // For web (skipChannelSend=true): caller is responsible for storing/displaying.
  if (action.sendMessage && !action.silent && !opts.skipChannelSend) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: action.sendMessage,
    });

    // Log to alerts (short summary for dashboard)
    await supabase.from('alerts').insert({
      user_id: userId,
      type: `phi_brain_${brainAction}`,
      message: action.sendMessage.substring(0, 200),
      status: 'sent',
    });

    cache.invalidate(userId);
  }

  // Empty string means "no change" — schema uses '' instead of null because
  // structured-output mode doesn't reliably accept null as an enum value.
  if (decision.new_state && decision.new_state !== '') {
    action.updateState = decision.new_state;
  }
  // Profile updates are NOT taken from the model — too easy to corrupt cooldown_until
  // or rewrite personality fields. Profile mutations happen only via deterministic
  // code paths (cooldown writes below, classifier-driven personality, etc).

  // Cooldown: when responding to an incoming user message conversationally,
  // silence proactive cron nudges for 48h. Prevents the cron from piling on
  // while the user is actively chatting with the bot.
  const conversationalActions = new Set(['coaching', 'greeting', 'general_chat', 'help']);
  if (event.type === 'whatsapp_message' && conversationalActions.has(brainAction) && !action.silent) {
    const cooldownUntil = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    action.updateProfile = { ...(action.updateProfile || {}), cooldown_until: cooldownUntil };
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

    const { mergeClassificationContext } = await import('../conversation/shared');
    await mergeClassificationContext(userId, { phi_profile: merged });
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
