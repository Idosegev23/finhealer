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

  const buttonId = interactiveData?.selectedButtonId || interactiveData?.selectedId || oldButtonData?.selectedButtonId || oldButtonData?.buttonId || '';
  const buttonText = interactiveData?.selectedButtonText || interactiveData?.selectedDisplayText || oldButtonData?.selectedButtonText || oldButtonData?.buttonText || '';

  console.log('🔘 Button pressed - selectedButtonId:', buttonId, 'selectedButtonText:', buttonText);

  // For receipt buttons use ID (contains tx UUID), for phi-router use display text (Hebrew)
  const messageToRoute = buttonId || buttonText;
  const routerMessage = buttonText || buttonId;
  console.log('🎯 Routing:', messageToRoute, '| Router text:', routerMessage);

  // Handle receipt confirm/edit buttons directly (ID format: confirm_<uuid> / edit_<uuid>)
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
      const { mergeClassificationContext } = await import('@/lib/conversation/shared');
      await mergeClassificationContext(userData.id, { editing_tx_id: txId });
    }

    const btnAction = messageToRoute.startsWith('confirm_') ? 'confirmed' : 'editing';
    console.log(`[Webhook] RESPONSE: receipt_button_handled action=${btnAction}`);
    return NextResponse.json({ status: 'receipt_button_handled', action: btnAction });
  }

  // All other buttons → route through φRouter
  try {
    const { routeMessage } = await import('@/lib/conversation/phi-router');
    const result = await routeMessage(userData.id, phoneNumber, routerMessage);

    console.log('[φ Router] Button result: success=' + result.success);

    return NextResponse.json({
      status: 'button_response',
      success: result.success,
    });
  } catch (err) {
    console.error('[Webhook] Button router error:', err);
    const greenAPI = getGreenAPIClient();
    await greenAPI.sendMessage({ phoneNumber, message: 'סליחה, משהו השתבש 😅 נסה שוב בבקשה' });
    return NextResponse.json({ status: 'error' });
  }
}
