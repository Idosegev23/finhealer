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
    .select('id, name, wa_opt_in, phone, subscription_status, trial_expires_at')
    .in('phone', phoneVariants);

  const user = users?.[0];
  let userData: any;

  if (!user) {
    // User not registered — direct them to the website
    console.log('🚫 Unknown WhatsApp user:', maskPhone(phoneNumber));

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://finhealer.vercel.app';
    const greenAPI = getGreenAPIClient();

    await greenAPI.sendMessage({
      phoneNumber,
      message:
        `היי! 👋\n\n` +
        `אני *φ Phi* - המאמן הפיננסי שלך.\n\n` +
        `כדי להתחיל, צריך להירשם קודם באתר:\n` +
        `🔗 ${siteUrl}/signup\n\n` +
        `ההרשמה לוקחת פחות מדקה — אחרי זה נמשיך כאן! 😊`,
    });

    return {
      earlyReturn: true,
      response: { status: 'unregistered_user_redirected' },
    };
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
