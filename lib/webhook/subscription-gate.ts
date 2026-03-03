// @ts-nocheck

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://finhealer.vercel.app';

export interface SubscriptionCheckResult {
  allowed: boolean;
  message?: string;
}

/**
 * Check if user has an active subscription or valid trial.
 * Returns allowed=true if they can use the bot, or a message to send if blocked.
 */
export function checkSubscription(userData: any): SubscriptionCheckResult {
  const status = userData.subscription_status;

  // Active subscription — always allowed
  if (status === 'active') {
    return { allowed: true };
  }

  // Trial — check expiration
  if (status === 'trial') {
    const expires = userData.trial_expires_at ? new Date(userData.trial_expires_at) : null;
    if (expires && expires > new Date()) {
      return { allowed: true };
    }
    // Trial expired
    return {
      allowed: false,
      message:
        `⏰ *תקופת הנסיון הסתיימה!*\n\n` +
        `כדי להמשיך להשתמש ב-φ Phi, שדרג לתוכנית בתשלום.\n\n` +
        `💳 שדרג עכשיו: ${SITE_URL}/payment\n\n` +
        `כתוב *"עזרה"* לשאלות.`,
    };
  }

  // Cancelled / inactive / unknown
  return {
    allowed: false,
    message:
      `😔 *המנוי שלך לא פעיל.*\n\n` +
      `כדי לחזור, שדרג כאן:\n` +
      `💳 ${SITE_URL}/payment\n\n` +
      `הנתונים שלך שמורים ומחכים לך! 💰`,
  };
}

/**
 * Check if a message text is an allowed command even when subscription is blocked.
 */
export function isAllowedWhenBlocked(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return /^(עזרה|שדרג|help|upgrade|cancel|ביטול)$/i.test(trimmed);
}
