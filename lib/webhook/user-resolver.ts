// @ts-nocheck
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { maskPhone, maskUserId } from './utils';
import type { GreenAPIWebhookPayload } from './types';

export interface UserResolveResult {
  earlyReturn: boolean;
  statusCode?: number;
  response?: any;
  userData?: any;
  phoneNumber?: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\+]/g, '');
}

/**
 * Resolve user from webhook payload: normalize phone, lookup/create user, auto-enable wa_opt_in.
 * Returns earlyReturn=true if the webhook should return early (new user greeted, or error).
 */
export async function resolveUser(
  payload: GreenAPIWebhookPayload,
  supabase: any
): Promise<UserResolveResult> {
  // Extract and normalize phone number
  const rawPhoneNumber = payload.senderData.chatId.replace('@c.us', '');
  const phoneNumber = normalizePhone(rawPhoneNumber);
  const messageType = payload.messageData?.typeMessage;

  console.log('📞 Phone normalized:', maskPhone(phoneNumber));

  // Try multiple phone formats
  const phoneVariants = [
    phoneNumber,                                    // 972547667775
    phoneNumber.replace(/^972/, '0'),              // 0547667775
    phoneNumber.replace(/^0/, '972'),              // 972547667775 (from 0547667775)
  ];

  const { data: users } = await supabase
    .from('users')
    .select('id, name, wa_opt_in, phone')
    .in('phone', phoneVariants);

  const user = users?.[0];
  let userData: any;

  if (!user) {
    // Auto-create new user from WhatsApp
    console.log('🆕 New user from WhatsApp:', maskPhone(phoneNumber));

    const senderName = payload.senderData?.senderName || '';
    const cleanName = senderName && senderName !== phoneNumber && !/^\d+$/.test(senderName)
      ? senderName.trim()
      : '';

    const initialName = cleanName || 'משתמש חדש';
    const initialState = cleanName ? 'waiting_for_document' : 'waiting_for_name';
    console.log(`[Webhook] CREATE_USER: name="${initialName}", state=${initialState}, hasProfileName=${!!cleanName}`);

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        phone: phoneNumber,
        name: initialName,
        full_name: cleanName || null,
        wa_opt_in: true,
        onboarding_state: initialState,
        phase: 'data_collection',
      })
      .select('id, name, wa_opt_in, phone')
      .single();

    if (createError || !newUser) {
      console.error('❌ Failed to create new user:', createError);
      return {
        earlyReturn: true,
        statusCode: 500,
        response: { status: 'error', message: 'Failed to create user' },
      };
    }

    console.log('✅ New user created:', maskUserId(newUser.id));
    userData = newUser;

    // Send welcome message
    const greenAPI = getGreenAPIClient();

    if (cleanName) {
      await greenAPI.sendMessage({
        phoneNumber,
        message: `היי ${cleanName}! 👋\n\nאני *φ Phi* - העוזר הפיננסי שלך.\n\n📄 שלח לי דוח בנק או אשראי (PDF/Excel/תמונה) ואני אנתח את התנועות שלך.`,
      });
    } else {
      await greenAPI.sendMessage({
        phoneNumber,
        message: `היי! 👋\n\nאני *φ Phi* - העוזר הפיננסי שלך.\n\nאיך קוראים לך? 😊`,
      });
    }

    // If first message is a document/image, don't return early - process it
    if (messageType === 'documentMessage' || messageType === 'imageMessage') {
      console.log('[Webhook] FIRST_MSG_DOC: processing document from new user');
    } else {
      return {
        earlyReturn: true,
        response: { status: 'new_user_greeted', userId: newUser.id },
      };
    }
  } else {
    console.log('✅ User found:', maskUserId((user as any).id));
    userData = user as any;
    console.log(`[Webhook] USER: id=${maskUserId(userData.id)}, name=${userData.name || 'none'}, wa_opt_in=${userData.wa_opt_in}`);
  }

  // Auto-enable WhatsApp if not yet enabled
  if (!userData.wa_opt_in) {
    console.log('🚀 Auto-enabling WhatsApp for:', maskUserId(userData.id));

    const { error: updateError } = await supabase
      .from('users')
      .update({ wa_opt_in: true })
      .eq('id', userData.id);

    if (updateError) {
      console.error('❌ Error enabling WhatsApp:', updateError);
      return {
        earlyReturn: true,
        statusCode: 500,
        response: { status: 'error', message: 'Failed to enable WhatsApp' },
      };
    }

    userData.wa_opt_in = true;
    console.log('✅ WhatsApp auto-enabled for user');
  }

  return { earlyReturn: false, userData, phoneNumber };
}
