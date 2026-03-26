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
החזר JSON בלבד:
{
  "should_respond": true/false,
  "message": "ההודעה בעברית (או null אם should_respond=false)",
  "actions": ["classify", "update_state", "none"],
  "new_state": "monitoring/behavior/budget/goals/null",
  "profile_updates": {
    "tone": "...",
    "financial_personality": "...",
    "patterns": {},
    "last_coached_on": "...",
    "preferred_message_length": "short/medium/detailed"
  },
  "internal_reasoning": "מדוע החלטת כך (לא נשלח למשתמש)"
}

כללים:
1. אם האירוע הוא scheduled_check ואין סיבה טובה — should_respond=false. אל תמציא סיבה.
2. אם המשתמש שלח הודעה — תמיד should_respond=true.
3. הודעות קצרות. מקסימום 500 תווים. פסקה אחת או שתיים.
4. לא "חרגת ⚠️". אלא "שמתי לב ש..." בטון חברי.
5. אם המשתמש כתב הוצאה ("סופר 450") — רשום, אשר בקצרה, תן קונטקסט תקציבי.
6. אם יש תנועות pending — סווג אוטומטית ודווח בקצרה.
7. אם עבר דוח — תן סיכום חכם, לא דאטה.
8. עדכן profile_updates רק אם למדת משהו חדש על המשתמש.
9. אל תשתמש במילים: "בוא", "אתה" (זכר) — השתמש בשפה ניטרלית או פנייה אישית בשם.
10. החזר JSON בלבד, בלי markdown.`;
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

  // ── Build prompt and ask Gemini ──
  const prompt = buildBrainPrompt(ctx, event);

  let decision: any;
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
    // Fallback: if user sent a message, at least acknowledge
    if (event.type === 'whatsapp_message') {
      return {
        sendMessage: `קיבלתי! 😊 רגע מעבד...`,
      };
    }
    return { silent: true };
  }

  console.log(`[PhiBrain] Decision for ${ctx.userName}: should_respond=${decision.should_respond}, reasoning=${decision.internal_reasoning?.substring(0, 100)}`);

  // ── Execute decision ──
  const action: PhiAction = {};

  if (decision.should_respond && decision.message) {
    action.sendMessage = decision.message;
  } else {
    action.silent = true;
  }

  if (decision.actions?.includes('classify')) {
    action.classify = true;
  }

  if (decision.new_state) {
    action.updateState = decision.new_state;
  }

  if (decision.profile_updates && Object.keys(decision.profile_updates).length > 0) {
    action.updateProfile = decision.profile_updates;
  }

  // ── Apply actions ──
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  if (action.sendMessage) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: action.sendMessage,
    });

    // Log
    await supabase.from('alerts').insert({
      user_id: userId,
      type: `phi_brain_${event.type}`,
      message: action.sendMessage.substring(0, 200),
      status: 'sent',
    });
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
