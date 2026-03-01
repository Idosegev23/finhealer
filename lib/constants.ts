/**
 * Centralized constants for FinHealer
 * Eliminates hardcoded fallback values scattered across components
 */

/** WhatsApp bot phone number */
export const WHATSAPP_BOT_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '972544266506';

/** WhatsApp advisor phone number */
export const WHATSAPP_ADVISOR_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER ||
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
  '972544266506';

/** Site URL for links in messages */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://finhealer.vercel.app';

/** Advisor email for lead notifications */
export const ADVISOR_EMAIL =
  process.env.ADVISOR_EMAIL || 'gadi@example.com';
