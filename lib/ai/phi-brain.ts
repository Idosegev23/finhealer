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
  PHI_TOOL_USE_RULE,
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
    // Empty response → pick a deterministic handler that matches what the user
    // actually asked. The brain got stuck in a tool-call loop, but we can still
    // give a useful answer based on keywords.
    if (event.type === 'whatsapp_message') {
      const msg = (event.message || '').toLowerCase();
      let fallbackAction = 'show_money_flow';
      if (/יעד|יעדים|מטרה|מטרות/.test(msg)) fallbackAction = 'show_goals';
      else if (/תקציב/.test(msg)) fallbackAction = 'show_budget';
      else if (/ציון|phi|פאי/.test(msg)) fallbackAction = 'show_phi_score';
      else if (/תזרים|cashflow/.test(msg)) fallbackAction = 'show_cashflow';
      else if (/דפוסים|ניתוח|patterns/.test(msg)) fallbackAction = 'show_patterns';
      else if (/הלוואות|הלוואה/.test(msg)) fallbackAction = 'show_money_flow'; // no dedicated handler — use flow
      return {
        action: fallbackAction,
        should_respond: true,
        message: '',
        internal_reasoning: `empty_model_output_smart_fallback_to_${fallbackAction}`,
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

  // Try harder: if it looks like a truncated JSON object (starts with `{`),
  // attempt to recover the `message` field via regex. This rescues the case
  // where the model wrote a long internal_reasoning and got cut off.
  if (cleaned.startsWith('{')) {
    const messageMatch = cleaned.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (messageMatch && messageMatch[1]) {
      const recovered = messageMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      console.warn('[PhiBrain] Recovered message from truncated JSON');
      return {
        action: 'coaching',
        should_respond: true,
        message: recovered,
        internal_reasoning: 'recovered_from_truncated_json',
      };
    }
    // JSON-shaped but no extractable message → don't dump it on user.
    console.error('[PhiBrain] Truncated JSON, no recoverable message:', cleaned.substring(0, 300));
    if (event.type === 'whatsapp_message') {
      return {
        action: 'coaching',
        should_respond: true,
        message: 'רגע, אני מתבלבל קצת — תוכל לחזור על השאלה? 😅',
        internal_reasoning: 'truncated_json_no_message',
      };
    }
    return { action: 'none', should_respond: false, internal_reasoning: 'truncated_json_no_message' };
  }

  // Plain prose (rare) — treat as a coaching message.
  if (event.type === 'whatsapp_message' && cleaned.length > 0 && cleaned.length < 1500) {
    console.warn('[PhiBrain] Plain prose response, treating as coaching:', cleaned.substring(0, 100));
    return {
      action: 'coaching',
      should_respond: true,
      message: cleaned,
      internal_reasoning: 'prose_fallback',
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
  // Persistence — brain shapes the DB from conversation
  'create_goal', 'update_goal', 'delete_goal', 'define_income', 'add_recurring', 'pause_recurring',
  // Read-only views
  'show_money_flow', 'show_summary', 'show_chart', 'show_budget', 'show_goals',
  'show_cashflow', 'show_phi_score', 'show_patterns', 'check_duplicates', 'afford_check',
  // Onboarding flow controls (replace canned router handlers)
  'set_user_name', 'request_document', 'mark_skip_document',
  // Conversation
  'classify', 'coaching', 'greeting', 'help', 'general_chat', 'none',
] as const;

// Schema order matters: Gemini emits properties in schema order. We put `message`
// FIRST so it's always serialized before the model burns its token budget on
// internal_reasoning. Critical when output is truncated mid-stream.
const BRAIN_DECISION_SCHEMA: Record<string, any> = {
  type: 'object',
  properties: {
    message: {
      type: 'string',
      description: 'Hebrew text shown to the user. ALWAYS write something — even for view actions, the handler may still surface it. Empty string only if action=none.',
    },
    action: {
      type: 'string',
      enum: [...BRAIN_ACTIONS],
      description: 'The handler to invoke. Default to "coaching" for natural conversation. Use "none" only for scheduled checks with nothing to say.',
    },
    should_respond: { type: 'boolean', description: 'Whether to send the user a message right now.' },
    action_params: {
      type: 'object',
      properties: {
        // log_expense
        vendor: { type: 'string' },
        amount: { type: 'number' },
        category: { type: 'string' },
        description: { type: 'string' },
        // set_user_name
        name: { type: 'string', description: 'Human name — used only by set_user_name.' },
        // create_goal / update_goal
        goal_name: { type: 'string', description: 'Hebrew goal name e.g. "רכב", "דירה", "חופש".' },
        target_amount: { type: 'number', description: 'Goal target in ₪.' },
        deadline: { type: 'string', description: 'ISO date (YYYY-MM-DD) for goal deadline.' },
        monthly_allocation: { type: 'number', description: 'Monthly contribution toward the goal in ₪.' },
        priority: { type: 'number', description: 'Goal priority 1-10 (1=highest).' },
        // define_income
        source_name: { type: 'string', description: 'Hebrew label for the income source e.g. "משכורת", "פרילנס".' },
        employment_type: { type: 'string', description: 'salary | freelance | business | passive | other.' },
        net_amount: { type: 'number', description: 'Net monthly income in ₪.' },
        gross_amount: { type: 'number', description: 'Gross monthly income in ₪.' },
        employer_name: { type: 'string' },
        is_primary: { type: 'boolean', description: 'True if this is the main income source.' },
        // add_recurring
        expected_day: { type: 'number', description: 'Day-of-month the recurring charge hits (1-31).' },
        frequency: { type: 'string', description: 'monthly | yearly | weekly.' },
      },
    },
    new_state: {
      type: 'string',
      enum: ['monitoring', 'behavior', 'budget', 'goals', 'classification', ''],
      description: 'Optional — leave empty string if no state change needed.',
    },
    internal_reasoning: {
      type: 'string',
      description: 'KEEP UNDER 100 CHARACTERS. One short reason. Long reasoning blows the token budget and truncates the actual message.',
    },
  },
  required: ['message', 'action', 'should_respond'],
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
    PHI_TOOL_USE_RULE,
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
// Fast-path is now reserved for actions where the LLM offers no value:
// classification kickoff, undo, and help menu. Everything else (סיכום, יעדים,
// תקציב, etc.) goes through the brain so it can call tools and compose a
// natural answer based on actual data.
const COMMAND_MAP: Record<string, string> = {
  // Classification triggers — direct route to start the flow
  'נתחיל': 'classify', 'נמשיך': 'classify', 'סווג': 'classify', 'בוא נתחיל': 'classify',
  // Undo last expense — deterministic, no need for LLM
  'בטל': 'undo_expense',
  // Help menu — static
  'עזרה': 'help', 'תפריט': 'help',
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
  // Strict guardrails to avoid false positives — paragraphs about goals/plans
  // ending in a number ("...בתחילת 2027") were being mis-parsed as expenses.
  const match = trimmed.match(EXPENSE_PATTERN);
  if (match) {
    const vendor = (match[1] || match[4] || '').trim();
    const amountStr = (match[2] || match[3] || '').replace(/,/g, '');
    const amount = parseFloat(amountStr);

    // Words that strongly signal "this is a sentence about plans/goals/questions",
    // not a transaction record. If any appear, send to the brain instead.
    const PLAN_OR_GOAL_WORDS = [
      'רוצה', 'מטרה', 'יעד', 'לחסוך', 'תוכנית', 'לתכנן', 'תכנן', 'מתכנן',
      'אוטו', 'רכב', 'דירה', 'חופשה', 'חופש', 'טיול', 'נסיעה',
      'אבל', 'אם', 'כדי', 'אולי', 'בערך', 'בסביבות',
      'להגדיר', 'תגדיר', 'נתחיל', 'נציג', 'בוא', 'תוכל',
      'שנה', 'שנים', 'חודש', 'חודשים', 'שבוע', 'שבועות',
      'תחילת', 'סוף', 'אמצע', 'תחילה',
      'מה', 'מתי', 'איך', 'למה', 'איפה', 'כמה',
    ];
    const lowerVendor = vendor.toLowerCase();
    const looksLikePlan = PLAN_OR_GOAL_WORDS.some(w => lowerVendor.includes(w));
    // 4-digit number in year range looks like a year, not an amount
    const looksLikeYear = /^(19|20)\d{2}$/.test(amountStr);

    if (
      amount > 0 &&
      amount < 100000 &&
      vendor.length >= 2 &&
      vendor.length <= 25 && // real vendors are short
      !looksLikePlan &&
      !looksLikeYear
    ) {
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
      // Tools are ALWAYS available — even for new users, get_data_status is useful
      // ("anything in my account?"), and the persona explicitly tells the model
      // when not to call them (e.g. simple greetings).
      // enableWebTools=true gives the brain Google Search, URL Context, and
      // Code Execution — turning φ from a sandboxed coach into a fully-grounded
      // advisor that can pull current rates, read news, and run amortization math.
      const { chatWithTools } = await import('@/lib/ai/gemini-client');
      let groundingMeta: { citations: Array<{ title?: string; uri: string }>; webSearchQueries: string[] } | null = null;
      const raw = await chatWithTools({
        systemInstruction,
        history,
        userMessage: triggerMessage,
        tools: BRAIN_TOOL_DECLARATIONS as any,
        executeTool: (name, args) => executeBrainTool(userId, name, args),
        thinkingLevel: 'low',
        maxOutputTokens: 16000,
        maxToolHops: 5,
        responseJsonSchema: BRAIN_DECISION_SCHEMA,
        enableWebTools: true,
        onGroundingMetadata: (meta) => { groundingMeta = meta; },
      });
      decision = parseBrainResponse(raw, event);

      // Append citations to the user-visible message when Google Search was used.
      if (groundingMeta && decision.message && (groundingMeta as any).citations?.length > 0) {
        const cites = (groundingMeta as any).citations.slice(0, 3);
        const citeBlock = cites
          .map((c: any, i: number) => `${i + 1}. ${c.title || c.uri}`)
          .join('\n');
        decision.message = `${decision.message}\n\n📎 *מקורות:*\n${citeBlock}`;
      }
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

      // ── MARK SKIP DOCUMENT — user wants to move forward with what they have ──
      // Two scenarios:
      //  A) Brand new user with 0 transactions → "I don't have a doc right now"
      //     → state=monitoring so they can chat / log expenses manually
      //  B) Existing user with data, asked for more docs, says "מספיק / תמשיך"
      //     → skip the data_collection time-gate and advance phase MANUALLY.
      //     calculatePhase has time gates (14 days since signup) that block
      //     fresh users. Manual advance bypasses them: with ≥20 confirmed
      //     transactions we have enough signal to start coaching.
      case 'mark_skip_document': {
        const { count: txCount } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'confirmed');
        const confirmedCount = txCount || 0;

        let newState: string;
        let newPhase: string;
        if (confirmedCount >= 20) {
          // Manual advance — skip the time gate
          newPhase = 'behavior';
          newState = 'monitoring';
        } else if (confirmedCount > 0) {
          // Has some data but not enough — still classify what's there
          newState = 'classification';
          const { calculatePhase: calcPhaseSkip } = await import('@/lib/services/PhaseService');
          newPhase = await calcPhaseSkip(userId);
        } else {
          newState = 'monitoring';
          newPhase = 'data_collection';
        }

        await supabase.from('users')
          .update({ onboarding_state: newState, phase: newPhase, phase_updated_at: new Date().toISOString() })
          .eq('id', userId);

        action.sendMessage = decision.message ||
          (confirmedCount >= 20
            ? `מעולה. ${confirmedCount} תנועות מספיקות לי כדי להתחיל. בוא נסתכל יחד — כתוב *"סיכום"* או שאל אותי כל שאלה על הכסף שלך.`
            : confirmedCount > 0
              ? `בסדר! 😊 יש כבר תנועות שצריך לסדר. כתוב *"נתחיל"* כשתהיה מוכן.`
              : `בסדר! 😊 כשיהיה לך דוח — פשוט שלח. בינתיים אפשר לשאול אותי כל שאלה.`);
        action.updateState = newState;
        break;
      }

      // ── CREATE GOAL — persist user-stated goal to DB ──
      case 'create_goal': {
        const goalName = (params.goal_name || '').trim();
        const target = Number(params.target_amount);
        if (!goalName || !Number.isFinite(target) || target <= 0) {
          action.sendMessage = decision.message || 'לא הצלחתי להבין את היעד. תכתוב שוב — שם וסכום.';
          break;
        }
        const insertData: any = {
          user_id: userId,
          name: goalName,
          target_amount: target,
          status: 'active',
          priority: Number.isFinite(params.priority) ? Math.max(1, Math.min(10, Number(params.priority))) : 5,
        };
        if (params.deadline) insertData.deadline = params.deadline;
        if (Number.isFinite(params.monthly_allocation) && params.monthly_allocation > 0) {
          insertData.monthly_allocation = Number(params.monthly_allocation);
        }
        if (params.description) insertData.description = params.description;
        const { error: goalErr } = await supabase.from('goals').insert(insertData);
        if (goalErr) {
          console.error('[create_goal]', goalErr);
          action.sendMessage = 'נתקלתי בבעיה בשמירת היעד. אפשר לנסות שוב?';
          break;
        }
        cache.invalidate(userId);
        const targetStr = target.toLocaleString('he-IL');
        const deadlineStr = params.deadline
          ? new Date(params.deadline).toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })
          : null;
        action.sendMessage = decision.message ||
          `✅ יעד נשמר: *${goalName}* — ${targetStr}₪${deadlineStr ? ` עד ${deadlineStr}` : ''}.`;
        break;
      }

      // ── UPDATE GOAL — find by name match, update fields ──
      case 'update_goal': {
        const goalName = (params.goal_name || '').trim();
        if (!goalName) {
          action.sendMessage = decision.message || 'איזה יעד לעדכן?';
          break;
        }
        const { data: existing } = await supabase
          .from('goals')
          .select('id, name')
          .eq('user_id', userId)
          .eq('status', 'active')
          .ilike('name', `%${goalName}%`)
          .order('priority', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!existing) {
          action.sendMessage = `לא מצאתי יעד פעיל בשם "${goalName}". להוסיף יעד חדש?`;
          break;
        }
        const update: any = { updated_at: new Date().toISOString() };
        if (Number.isFinite(params.target_amount) && params.target_amount > 0) update.target_amount = Number(params.target_amount);
        if (params.deadline) update.deadline = params.deadline;
        if (Number.isFinite(params.monthly_allocation)) update.monthly_allocation = Number(params.monthly_allocation);
        if (Number.isFinite(params.priority)) update.priority = Math.max(1, Math.min(10, Number(params.priority)));
        if (Object.keys(update).length === 1) {
          // only updated_at — nothing real to change
          action.sendMessage = decision.message || 'מה לעדכן ביעד?';
          break;
        }
        const { error: updErr } = await supabase.from('goals').update(update).eq('id', existing.id);
        if (updErr) {
          console.error('[update_goal]', updErr);
          action.sendMessage = 'נתקלתי בבעיה בעדכון. ננסה שוב?';
          break;
        }
        cache.invalidate(userId);
        action.sendMessage = decision.message || `✅ עדכנתי את יעד *${(existing as any).name}*.`;
        break;
      }

      // ── DEFINE INCOME — persist a recurring income source ──
      case 'define_income': {
        const sourceName = (params.source_name || params.name || '').trim() || 'משכורת';
        const empType = (params.employment_type || 'salary').trim();
        const net = Number(params.net_amount);
        const gross = Number.isFinite(params.gross_amount) ? Number(params.gross_amount) : null;
        if (!Number.isFinite(net) || net <= 0) {
          action.sendMessage = decision.message || 'מה הסכום נטו?';
          break;
        }
        const insertData: any = {
          user_id: userId,
          source_name: sourceName,
          employment_type: empType,
          net_amount: net,
          payment_frequency: 'monthly',
          active: true,
          is_primary: params.is_primary !== false,
        };
        if (gross && gross > 0) insertData.gross_amount = gross;
        if (params.employer_name) insertData.employer_name = String(params.employer_name).trim();
        const { error: incErr } = await supabase.from('income_sources').insert(insertData);
        if (incErr) {
          console.error('[define_income]', incErr);
          action.sendMessage = 'לא הצלחתי לשמור את ההכנסה. ננסה שוב?';
          break;
        }
        cache.invalidate(userId);
        const netStr = net.toLocaleString('he-IL');
        action.sendMessage = decision.message ||
          `✅ הכנסה נשמרה: *${sourceName}* — ${netStr}₪ נטו לחודש.`;
        break;
      }

      // ── ADD RECURRING — subscription / fixed monthly charge ──
      case 'add_recurring': {
        const vendor = (params.vendor || '').trim();
        const amt = Number(params.amount || params.expected_amount);
        if (!vendor || !Number.isFinite(amt) || amt <= 0) {
          action.sendMessage = decision.message || 'איזה מנוי? מה הסכום?';
          break;
        }
        const day = Number.isFinite(params.expected_day) ? Math.max(1, Math.min(31, Number(params.expected_day))) : null;
        const freq = (params.frequency || 'monthly').trim();
        // Compute next_expected: same day next month (or first occurrence if day given)
        const today = new Date();
        const nextExpected = new Date(today.getFullYear(), today.getMonth() + 1, day ?? today.getDate());
        const insertData: any = {
          user_id: userId,
          vendor,
          expected_amount: amt,
          frequency: freq,
          next_expected: nextExpected.toISOString().split('T')[0],
          status: 'active',
          is_auto_detected: false,
          confidence: 1.0,
        };
        if (day) insertData.expected_day = day;
        if (params.category) insertData.category = String(params.category).trim();
        const { error: recErr } = await supabase.from('recurring_patterns').insert(insertData);
        if (recErr) {
          console.error('[add_recurring]', recErr);
          action.sendMessage = 'לא הצלחתי לשמור את המנוי. ננסה שוב?';
          break;
        }
        cache.invalidate(userId);
        const amtStr = amt.toLocaleString('he-IL');
        action.sendMessage = decision.message ||
          `✅ נשמר מנוי: *${vendor}* — ${amtStr}₪${day ? ` ב-${day} לחודש` : ''}.`;
        break;
      }

      // ── DELETE GOAL — soft delete by status='archived' ──
      case 'delete_goal': {
        const goalName = (params.goal_name || '').trim();
        if (!goalName) {
          action.sendMessage = decision.message || 'איזה יעד למחוק?';
          break;
        }
        const { data: existing } = await supabase
          .from('goals')
          .select('id, name')
          .eq('user_id', userId)
          .eq('status', 'active')
          .ilike('name', `%${goalName}%`)
          .limit(1)
          .maybeSingle();
        if (!existing) {
          action.sendMessage = `לא מצאתי יעד פעיל בשם "${goalName}".`;
          break;
        }
        const { error: delErr } = await supabase
          .from('goals')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', (existing as any).id);
        if (delErr) {
          console.error('[delete_goal]', delErr);
          action.sendMessage = 'נתקלתי בבעיה. ננסה שוב?';
          break;
        }
        cache.invalidate(userId);
        action.sendMessage = decision.message || `🗑️ הוצאתי את היעד *${(existing as any).name}* מהרשימה הפעילה.`;
        break;
      }

      // ── PAUSE / CANCEL RECURRING — find by vendor match ──
      case 'pause_recurring': {
        const vendor = (params.vendor || params.goal_name || '').trim();
        if (!vendor) {
          action.sendMessage = decision.message || 'איזה מנוי להפסיק?';
          break;
        }
        const { data: existing } = await supabase
          .from('recurring_patterns')
          .select('id, vendor')
          .eq('user_id', userId)
          .eq('status', 'active')
          .ilike('vendor', `%${vendor}%`)
          .limit(1)
          .maybeSingle();
        if (!existing) {
          action.sendMessage = `לא מצאתי מנוי פעיל "${vendor}".`;
          break;
        }
        const { error: pauseErr } = await supabase
          .from('recurring_patterns')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', (existing as any).id);
        if (pauseErr) {
          console.error('[pause_recurring]', pauseErr);
          action.sendMessage = 'נתקלתי בבעיה. ננסה שוב?';
          break;
        }
        cache.invalidate(userId);
        action.sendMessage = decision.message || `✅ סימנתי את *${(existing as any).vendor}* כבוטל. אם תראה אותו שוב — תספר לי.`;
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
