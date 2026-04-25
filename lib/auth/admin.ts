/**
 * Admin authorization — single source of truth for "is this user an admin?".
 *
 * Sources, in order of precedence:
 *   1. Hardcoded ADMIN_EMAILS list (always admin)
 *   2. ADMIN_EMAILS env var (comma-separated, optional override/extension)
 *
 * Update the hardcoded list to add/remove admins without a redeploy of env vars.
 */

import { createClient as createAuthClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Permanent admins — always authorized regardless of env config.
 * Edit this list to grant/revoke admin access.
 */
const HARDCODED_ADMIN_EMAILS = new Set([
  'triroars@gmail.com',         // Ido (TriRoars)
  'gadi@barkai-finance.com',    // Gadi (Barkai Finance)
  'gadib1206@gmail.com',         // Gadi alternate
]);

/**
 * Is this email an admin?
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (HARDCODED_ADMIN_EMAILS.has(normalized)) return true;

  const envEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return envEmails.includes(normalized);
}

/**
 * Get the full admin email list (hardcoded ∪ env).
 */
export function getAdminEmails(): string[] {
  const envEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  const hardcoded = Array.from(HARDCODED_ADMIN_EMAILS);
  const combined = hardcoded.concat(envEmails);
  return Array.from(new Set(combined));
}

/**
 * Verify the currently-authenticated user is an admin.
 * Returns the auth result + a NextResponse to return immediately if not authorized.
 *
 * Usage in route handlers:
 *   const auth = await requireAdmin();
 *   if (!auth.ok) return auth.response;
 *   // proceed using auth.user, auth.email
 */
export async function requireAdmin(): Promise<
  | { ok: true; user: { id: string; email: string }; supabase: Awaited<ReturnType<typeof createAuthClient>> }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const email = user.email || '';
  if (!isAdminEmail(email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, user: { id: user.id, email }, supabase };
}
