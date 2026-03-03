// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { verifyAndParse } from '@/lib/webhook/guards';
import { resolveUser } from '@/lib/webhook/user-resolver';
import { storeMessage } from '@/lib/webhook/message-store';
import { checkRateLimit, maskUserId } from '@/lib/webhook/utils';
import { handleButton } from '@/lib/webhook/handle-button';
import { handleText } from '@/lib/webhook/handle-text';
import { handleImage } from '@/lib/webhook/handle-image';
import { handleDocument } from '@/lib/webhook/handle-document';
import { handleUnsupported } from '@/lib/webhook/handle-unsupported';
import { checkSubscription, isAllowedWhenBlocked } from '@/lib/webhook/subscription-gate';

/**
 * GreenAPI Webhook Handler
 * Thin dispatcher — all logic lives in lib/webhook/ modules.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify signature, parse, dedup, filter
    const guard = await verifyAndParse(request);
    if (guard.ignored) {
      return NextResponse.json(guard.response, { status: guard.statusCode || 200 });
    }

    const { payload, messageId, supabase } = guard;

    // 2. Resolve user (lookup / auto-create / wa_opt_in)
    const userResult = await resolveUser(payload!, supabase);
    if (userResult.earlyReturn) {
      return NextResponse.json(userResult.response, { status: userResult.statusCode || 200 });
    }

    const { userData, phoneNumber } = userResult;

    // 2.5 Subscription gate
    const subCheck = checkSubscription(userData);
    if (!subCheck.allowed) {
      const msgData = payload!.messageData;
      const rawText = msgData?.textMessageData?.textMessage || msgData?.extendedTextMessageData?.text || '';
      if (!isAllowedWhenBlocked(rawText)) {
        const greenAPI = getGreenAPIClient();
        await greenAPI.sendMessage({ phoneNumber: phoneNumber!, message: subCheck.message! });
        return NextResponse.json({ status: 'subscription_blocked' });
      }
    }

    // 3. Rate limiting
    if (checkRateLimit(userData.id)) {
      console.warn(`⚠️ Rate limited user ${maskUserId(userData.id)}`);
      const greenAPI = getGreenAPIClient();
      await greenAPI.sendMessage({
        phoneNumber,
        message: `⏳ שניה, אני עדיין מעבד... נסה שוב בעוד כמה שניות.`,
      });
      return NextResponse.json({ status: 'rate_limited' });
    }

    // 4. Save incoming message
    const messageType = payload!.messageData?.typeMessage;
    console.log('📨 MESSAGE TYPE:', messageType);

    const { savedMessage, error: msgError } = await storeMessage(supabase, userData.id, payload!, messageId!);
    if (msgError) {
      return NextResponse.json({ status: 'error', message: msgError.message }, { status: 500 });
    }

    // 4.5 Update last interaction timestamp (fire-and-forget)
    supabase.from('users').update({ last_wa_interaction: new Date().toISOString() }).eq('id', userData.id).then(() => {});

    // 5. Build context object for handlers
    const ctx = { userData, phoneNumber: phoneNumber!, payload: payload!, messageId: messageId!, supabase, greenAPI: getGreenAPIClient() };

    // 6. Dispatch by message type
    if (messageType === 'interactiveButtonsResponse' || messageType === 'buttonsResponseMessage') {
      return handleButton(ctx);
    }

    if (messageType === 'textMessage' || messageType === 'extendedTextMessage' || messageType === 'quotedMessage') {
      return handleText(ctx);
    }

    if (messageType === 'imageMessage') {
      return handleImage(ctx);
    }

    if (messageType === 'documentMessage') {
      return handleDocument(ctx);
    }

    // All other message types (audio, video, sticker, list response, etc.)
    return handleUnsupported(ctx, messageType);

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ status: 'error', message: 'שגיאה פנימית' }, { status: 500 });
  }
}

// Allow GET for testing
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'GreenAPI Webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
