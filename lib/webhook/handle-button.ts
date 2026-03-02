// @ts-nocheck
import { NextResponse } from 'next/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import type { WebhookContext } from './types';
import { maskUserId } from './utils';

/**
 * Handle button press responses (confirm/edit receipt buttons + router delegation).
 */
export async function handleButton(ctx: WebhookContext): Promise<NextResponse> {
  const { userData, phoneNumber, payload, supabase } = ctx;

  // Support both interactive buttons and old-format buttons
  const interactiveData = payload.messageData?.interactiveButtonsResponse;
  const oldButtonData = payload.messageData?.buttonsResponseMessage;

  const buttonId = interactiveData?.selectedButtonId || oldButtonData?.selectedButtonId || oldButtonData?.buttonId || '';
  const buttonText = interactiveData?.selectedButtonText || oldButtonData?.selectedButtonText || oldButtonData?.buttonText || '';

  console.log('🔘 Button pressed - selectedButtonId:', buttonId, 'selectedButtonText:', buttonText);

  const messageToRoute = buttonId || buttonText;
  console.log('🎯 Routing:', messageToRoute);

  // Handle receipt confirm/edit buttons directly
  if (messageToRoute.startsWith('confirm_') || messageToRoute.startsWith('edit_')) {
    const greenAPI = getGreenAPIClient();
    const txId = messageToRoute.replace(/^(confirm_|edit_)/, '');

    if (messageToRoute.startsWith('confirm_')) {
      await supabase
        .from('transactions')
        .update({ status: 'confirmed' })
        .eq('id', txId)
        .eq('user_id', userData.id);

      await greenAPI.sendMessage({
        phoneNumber,
        message: `✅ ההוצאה אושרה ונשמרה! 👍`,
      });
    } else {
      await greenAPI.sendMessage({
        phoneNumber,
        message: `✏️ מה לתקן?\n\nכתוב בפורמט:\n*סכום:* 50\n*קטגוריה:* מכולת\n*תיאור:* קניות בסופר\n\nאו כתוב *"מחק"* למחיקת ההוצאה.`,
      });

      // Save edit context (merge, don't overwrite)
      const { data: ctxUser } = await supabase
        .from('users')
        .select('classification_context')
        .eq('id', userData.id)
        .single();

      const existingCtx = ctxUser?.classification_context || {};
      await supabase
        .from('users')
        .update({ classification_context: { ...existingCtx, editing_tx_id: txId } })
        .eq('id', userData.id);
    }

    const btnAction = messageToRoute.startsWith('confirm_') ? 'confirmed' : 'editing';
    console.log(`[Webhook] RESPONSE: receipt_button_handled action=${btnAction}`);
    return NextResponse.json({ status: 'receipt_button_handled', action: btnAction });
  }

  // All other buttons → route through φRouter
  const { routeMessage } = await import('@/lib/conversation/phi-router');
  const result = await routeMessage(userData.id, phoneNumber, messageToRoute);

  console.log('[φ Router] Button result: success=' + result.success);

  return NextResponse.json({
    status: 'button_response',
    success: result.success,
  });
}
