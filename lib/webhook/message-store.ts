// @ts-nocheck
import type { GreenAPIWebhookPayload } from './types';

/**
 * Save incoming WhatsApp message to wa_messages table.
 */
export async function storeMessage(
  supabase: any,
  userId: string,
  payload: GreenAPIWebhookPayload,
  messageId: string
): Promise<{ savedMessage: any; error: any }> {
  const messageType = payload.messageData?.typeMessage;

  const waMessageData = {
    user_id: userId,
    direction: 'incoming',
    msg_type: ({ imageMessage: 'image', documentMessage: 'document', audioMessage: 'audio', videoMessage: 'video', stickerMessage: 'sticker', interactiveButtonsResponse: 'button', buttonsResponseMessage: 'button', listResponseMessage: 'list_response' } as Record<string, string>)[messageType || ''] || 'text',
    payload: payload,
    provider_msg_id: messageId,
    status: 'delivered',
  };

  const { data: savedMessage, error } = await (supabase as any)
    .from('wa_messages')
    .insert(waMessageData)
    .select()
    .single();

  if (error) {
    console.error('❌ Error saving message:', error);
  }

  return { savedMessage, error };
}
