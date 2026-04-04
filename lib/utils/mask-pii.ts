/**
 * PII Masking Utilities
 * Prevent phone numbers, emails, and other PII from leaking into logs.
 */

/** Mask phone: 972541234567 → 972****4567 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '[no-phone]';
  const clean = phone.replace(/\D/g, '');
  if (clean.length <= 4) return '****';
  return clean.slice(0, 3) + '****' + clean.slice(-4);
}

/** Mask email: user@example.com → u***@example.com */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '[no-email]';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return local[0] + '***@' + domain;
}

/** Mask user ID: show first 8 chars */
export function maskId(id: string | null | undefined): string {
  if (!id) return '[no-id]';
  return id.substring(0, 8) + '...';
}
