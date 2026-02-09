import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * יצירת Service Role Client - עוקף RLS
 * להשתמש רק ב-API routes מאובטחים (webhooks, cron jobs)
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    console.error('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not defined!');
    console.error('   This will cause RLS to block all inserts from webhooks.');
    console.error('   Set SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.');
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
  }
  
  if (!serviceRoleKey.startsWith('eyJ')) {
    console.error('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY appears invalid (should start with eyJ)');
    throw new Error('Invalid SUPABASE_SERVICE_ROLE_KEY format');
  }
  
  console.log('✅ Service role client created (key present)');
  
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Alias for compatibility
export const createClientServerClient = createClient;