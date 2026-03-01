import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Require authenticated user for API routes.
 * Returns { user, supabase } on success, or a 401 NextResponse.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return { user, supabase };
}

/**
 * Require CRON_SECRET for cron job endpoints.
 * Returns true if authorized, or a 401 NextResponse.
 */
export function requireCronAuth(authHeader: string | null): true | NextResponse {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return true;
}

/**
 * Require internal secret for service-to-service calls.
 * Falls back to CRON_SECRET if INTERNAL_API_SECRET is not set.
 */
export function requireInternalAuth(secretHeader: string | null): true | NextResponse {
  const secret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
  if (!secret || secretHeader !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return true;
}
