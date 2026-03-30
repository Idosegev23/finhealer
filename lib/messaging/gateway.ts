/**
 * Phi Message Gateway — THE single exit point for ALL outgoing WhatsApp messages.
 *
 * Every message in the system goes through here. No exceptions.
 *
 * What it does:
 * 1. Sends via GreenAPI
 * 2. Logs to wa_messages (full conversation history)
 * 3. Checks silence rules for proactive messages
 * 4. Invalidates caches
 *
 * Usage:
 *   import { sendPhiMessage, sendPhiButtons, sendPhiList } from '@/lib/messaging/gateway';
 *   await sendPhiMessage(userId, phone, 'הודעה', { source: 'monitoring', action: 'show_summary' });
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { cache } from '@/lib/utils/cache';
import { log } from '@/lib/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface MessageMetadata {
  source: string;       // who sent: 'phi_brain', 'onboarding', 'monitoring', 'goals', 'webhook', etc.
  action?: string;      // what action: 'greeting', 'show_summary', 'log_expense', etc.
  isProactive?: boolean; // true = system-initiated (cron), false = response to user
  skipSilenceCheck?: boolean; // bypass silence rules (for critical system messages)
}

interface SendResult {
  sent: boolean;
  silenced?: boolean;
  reason?: string;
}

// ============================================================================
// Silence Rules
// ============================================================================

async function shouldSilence(userId: string, metadata: MessageMetadata): Promise<{ silence: boolean; reason?: string }> {
  // Only check silence for proactive messages (system-initiated)
  if (!metadata.isProactive || metadata.skipSilenceCheck) {
    return { silence: false };
  }

  const supabase = createServiceClient();
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Rule 1: Max 1 proactive message per day
  const { count: todayCount } = await supabase
    .from('wa_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('direction', 'outgoing')
    .gte('created_at', `${today}T00:00:00`)
    .contains('payload', { isProactive: true });

  if (todayCount && todayCount > 0) {
    return { silence: true, reason: 'already_sent_today' };
  }

  // Rule 2: Last proactive message not answered
  const { data: lastOutgoing } = await supabase
    .from('wa_messages')
    .select('created_at')
    .eq('user_id', userId)
    .eq('direction', 'outgoing')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastOutgoing) {
    const { data: responseAfter } = await supabase
      .from('wa_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('direction', 'incoming')
      .gt('created_at', lastOutgoing.created_at)
      .limit(1)
      .maybeSingle();

    if (!responseAfter) {
      return { silence: true, reason: 'last_message_unanswered' };
    }
  }

  // Rule 3: Cooldown active
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const profile = user?.classification_context?.phi_profile;
  if (profile?.cooldown_until && new Date(profile.cooldown_until) > now) {
    return { silence: true, reason: 'cooldown_active' };
  }

  // Rule 4: First week — no proactive messages
  const { data: userData } = await supabase
    .from('users')
    .select('created_at')
    .eq('id', userId)
    .single();

  if (userData?.created_at) {
    const daysSinceSignup = (now.getTime() - new Date(userData.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSignup < 7) {
      return { silence: true, reason: 'first_week' };
    }
  }

  return { silence: false };
}

// ============================================================================
// Core: Send Message
// ============================================================================

export async function sendPhiMessage(
  userId: string,
  phone: string,
  message: string,
  metadata: MessageMetadata = { source: 'unknown' }
): Promise<SendResult> {
  if (!phone || !message) {
    return { sent: false, reason: 'missing_phone_or_message' };
  }

  // Check silence rules for proactive messages
  if (metadata.isProactive) {
    const silenceCheck = await shouldSilence(userId, metadata);
    if (silenceCheck.silence) {
      log.info('message_silenced', { userId, source: metadata.source, reason: silenceCheck.reason });
      return { sent: false, silenced: true, reason: silenceCheck.reason };
    }
  }

  const greenAPI = getGreenAPIClient();
  const supabase = createServiceClient();

  try {
    // Send
    await greenAPI.sendMessage({ phoneNumber: phone, message });

    // Log to wa_messages (full conversation history)
    await supabase.from('wa_messages').insert({
      user_id: userId,
      direction: 'outgoing',
      msg_type: 'text',
      payload: {
        body: message,
        source: metadata.source,
        action: metadata.action || null,
        isProactive: metadata.isProactive || false,
      },
      status: 'sent',
    });

    // Invalidate caches
    cache.invalidate(userId);

    log.info('message_sent', {
      userId,
      source: metadata.source,
      action: metadata.action,
      proactive: metadata.isProactive || false,
      length: message.length,
    });

    return { sent: true };
  } catch (err: any) {
    log.error('message_send_failed', { userId, source: metadata.source, error: err.message });
    return { sent: false, reason: err.message };
  }
}

// ============================================================================
// Send with Buttons
// ============================================================================

export async function sendPhiButtons(
  userId: string,
  phone: string,
  message: string,
  buttons: Array<{ buttonId: string; buttonText: string }>,
  metadata: MessageMetadata = { source: 'unknown' }
): Promise<SendResult> {
  if (!phone || !message) {
    return { sent: false, reason: 'missing_phone_or_message' };
  }

  if (metadata.isProactive) {
    const silenceCheck = await shouldSilence(userId, metadata);
    if (silenceCheck.silence) {
      return { sent: false, silenced: true, reason: silenceCheck.reason };
    }
  }

  const greenAPI = getGreenAPIClient();
  const supabase = createServiceClient();

  try {
    await greenAPI.sendInteractiveButtons({
      phoneNumber: phone,
      message,
      buttons,
    });

    await supabase.from('wa_messages').insert({
      user_id: userId,
      direction: 'outgoing',
      msg_type: 'buttons',
      payload: {
        body: message,
        buttons: buttons.map(b => b.buttonText),
        source: metadata.source,
        action: metadata.action,
        isProactive: metadata.isProactive || false,
      },
      status: 'sent',
    });

    cache.invalidate(userId);
    return { sent: true };
  } catch {
    // Fallback to plain text
    return sendPhiMessage(userId, phone, message, metadata);
  }
}

// ============================================================================
// Send List Message
// ============================================================================

export async function sendPhiList(
  userId: string,
  phone: string,
  params: {
    message: string;
    buttonText: string;
    title: string;
    sections: Array<{
      title: string;
      rows: Array<{ rowId: string; title: string; description?: string }>;
    }>;
  },
  metadata: MessageMetadata = { source: 'unknown' }
): Promise<SendResult> {
  if (!phone) return { sent: false, reason: 'missing_phone' };

  const greenAPI = getGreenAPIClient();
  const supabase = createServiceClient();

  try {
    await greenAPI.sendListMessage({
      phoneNumber: phone,
      ...params,
    });

    await supabase.from('wa_messages').insert({
      user_id: userId,
      direction: 'outgoing',
      msg_type: 'list',
      payload: {
        body: params.message,
        sections: params.sections.length,
        source: metadata.source,
        action: metadata.action,
      },
      status: 'sent',
    });

    cache.invalidate(userId);
    return { sent: true };
  } catch {
    // Fallback to numbered text
    let fallback = params.message + '\n\n';
    let i = 1;
    for (const section of params.sections) {
      for (const row of section.rows) {
        fallback += `${i}. ${row.title}${row.description ? ` — ${row.description}` : ''}\n`;
        i++;
      }
    }
    return sendPhiMessage(userId, phone, fallback, metadata);
  }
}
