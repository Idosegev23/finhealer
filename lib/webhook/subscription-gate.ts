// @ts-nocheck

export interface SubscriptionCheckResult {
  allowed: boolean;
  message?: string;
}

/**
 * Check if user can use the bot.
 * Currently: free access for everyone — no subscription gating.
 */
export function checkSubscription(_userData: any): SubscriptionCheckResult {
  return { allowed: true };
}

/**
 * Check if a message text is an allowed command even when subscription is blocked.
 * With free access this is unused, but kept for future payment integration.
 */
export function isAllowedWhenBlocked(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return /^(עזרה|שדרג|help|upgrade|cancel|ביטול)$/i.test(trimmed);
}
