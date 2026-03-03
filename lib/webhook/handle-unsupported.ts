// @ts-nocheck
import { NextResponse } from 'next/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import type { WebhookContext } from './types';

/**
 * Handle unsupported message types: audio, video, sticker, location, contact, list response, etc.
 */
export async function handleUnsupported(ctx: WebhookContext, messageType: string | undefined): Promise<NextResponse> {
  const { userData, phoneNumber } = ctx;
  const greenAPI = getGreenAPIClient();

  if (messageType === 'audioMessage' || messageType === 'voiceMessage') {
    await greenAPI.sendMessage({
      phoneNumber,
      message: `🎤 קיבלתי הודעה קולית!\n\nלצערי אני עדיין לא תומך בהודעות קוליות.\n\n💡 כתוב לי טקסט או שלח תמונה/PDF.`,
    });
  } else if (messageType === 'videoMessage') {
    await greenAPI.sendMessage({
      phoneNumber,
      message: `🎬 קיבלתי וידאו!\n\nאני לא יכול לעבד וידאו.\n\n💡 שלח תמונה של הקבלה/דוח במקום.`,
    });
  } else if (messageType === 'listResponseMessage') {
    const selectedRowId = ctx.payload.messageData?.listResponseMessage?.selectedRowId || '';
    console.log('[Webhook] LIST_RESPONSE: rowId=' + selectedRowId);

    if (selectedRowId) {
      try {
        const { routeMessage } = await import('@/lib/conversation/phi-router');
        const routerResult = await routeMessage(userData.id, phoneNumber, selectedRowId);

        return NextResponse.json({
          status: 'list_response',
          success: routerResult.success,
        });
      } catch (err) {
        console.error('[Webhook] List response router error:', err);
        await greenAPI.sendMessage({ phoneNumber, message: 'סליחה, משהו השתבש 😅 נסה שוב בבקשה' });
        return NextResponse.json({ status: 'error' });
      }
    }
  } else if (messageType === 'stickerMessage' || messageType === 'contactMessage' ||
             messageType === 'locationMessage' || messageType === 'pollMessage') {
    await greenAPI.sendMessage({
      phoneNumber,
      message: `👋 קיבלתי!\n\nאני עובד עם טקסט, תמונות ומסמכים (PDF/Excel).\n\n💡 כתוב *"עזרה"* לראות מה אפשר לעשות.`,
    });
  } else if (messageType) {
    console.log(`⚠️ Unknown message type: ${messageType}`);
    await greenAPI.sendMessage({
      phoneNumber,
      message: `👋 קיבלתי!\n\nכתוב לי טקסט, שלח תמונה או מסמך ואני אטפל בזה.\n\nכתוב *"עזרה"* לעוד אפשרויות.`,
    });
  }

  return NextResponse.json({ status: 'success' });
}
