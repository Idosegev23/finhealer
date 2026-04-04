// @ts-nocheck
import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { maskPhone } from '@/lib/utils/mask-pii';
import type { GreenAPIWebhookPayload } from './types';

// In-memory dedup cache (resets on deploy)
const processedMessages = new Set<string>();

export interface GuardResult {
  ignored: boolean;
  statusCode?: number;
  response?: any;
  payload?: GreenAPIWebhookPayload;
  messageId?: string;
  rawBody?: string;
  supabase?: any;
}

/**
 * Verify webhook signature, parse payload, deduplicate, filter non-incoming.
 * Returns ignored=true if the message should not be processed.
 */
export async function verifyAndParse(request: NextRequest): Promise<GuardResult> {
  const supabase = createServiceClient();

  // Read raw body for signature verification
  const rawBody = await request.text();
  const payload: GreenAPIWebhookPayload = JSON.parse(rawBody);

  // Token verification (URL-based: /api/wa/webhook?token=xxx)
  const webhookToken = process.env.WEBHOOK_TOKEN;
  if (webhookToken) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (token !== webhookToken) {
      console.warn('⚠️ Webhook token mismatch - rejecting');
      return { ignored: true, statusCode: 401, response: { status: 'unauthorized' } };
    }
  }

  // HMAC signature verification (if provider supports it)
  const webhookSecret = process.env.GREEN_API_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get('x-webhook-signature') || '';
    const { createHmac } = await import('crypto');
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (signature !== expected && signature !== `sha256=${expected}`) {
      console.warn('⚠️ Webhook signature mismatch - rejecting');
      return { ignored: true, statusCode: 401, response: { status: 'unauthorized' } };
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('❌ No webhook auth configured in production — rejecting');
    return { ignored: true, statusCode: 401, response: { status: 'no_auth_configured' } };
  }

  console.log(`[Webhook] ═══════════════════════════════════════`);
  console.log(`[Webhook] INCOMING: type=${payload.typeWebhook}, msgId=${payload.idMessage}`);
  console.log(`[Webhook] FROM: chatId=${maskPhone(payload.senderData?.chatId)}, name=${(payload.senderData?.senderName || 'unknown').substring(0, 2) + '***'}`);
  console.log(`[Webhook] MSG_TYPE: ${payload.messageData?.typeMessage || 'none'}`);
  console.log(`[Webhook] CONTENT: ${JSON.stringify(payload.messageData || {}).substring(0, 50)}...`);

  // Only process incoming messages
  if (payload.typeWebhook !== 'incomingMessageReceived') {
    console.log('🛡️ Ignoring non-incoming message:', payload.typeWebhook);
    return { ignored: true, response: { status: 'ignored', reason: payload.typeWebhook } };
  }

  const messageId = payload.idMessage;

  // DB dedup check
  if (messageId) {
    const { data: existingMsg } = await supabase
      .from('wa_messages')
      .select('id')
      .eq('provider_msg_id', messageId)
      .limit(1)
      .maybeSingle();

    if (existingMsg) {
      console.log('🛡️ Duplicate message ignored (DB check):', messageId);
      return { ignored: true, response: { status: 'ignored', reason: 'duplicate' } };
    }
  }

  // In-memory dedup check
  if (messageId && processedMessages.has(messageId)) {
    console.log('🛡️ Duplicate message ignored (memory):', messageId);
    return { ignored: true, response: { status: 'ignored', reason: 'duplicate' } };
  }
  if (messageId) {
    processedMessages.add(messageId);
    if (processedMessages.size > 1000) {
      const first = processedMessages.values().next().value;
      if (first) processedMessages.delete(first);
    }
  }

  // Ignore bot's own messages
  if (payload.messageData?.fromMe === true) {
    console.log('🛡️ Ignoring message from self (fromMe=true)');
    return { ignored: true, response: { status: 'ignored', reason: 'message from self' } };
  }

  return { ignored: false, payload, messageId, supabase };
}
