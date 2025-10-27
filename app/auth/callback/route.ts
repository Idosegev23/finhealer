import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      console.log('✅ התחברות הצליחה:', data.user.id)

      // המתן רגע קצר כדי שה-trigger יפעל (יצירת רשומה ב-users)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // צור admin client לבדיקה
      const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )

      // בדוק מצב המשתמש
      const { data: userData, error: selectError } = await supabaseAdmin
        .from('users')
        .select('phone, subscription_status')
        .eq('id', data.user.id)
        .maybeSingle()

      console.log('🔍 בדיקת משתמש:', { userData, selectError })

      // אם אין רשומה ב-DB (טרם שילם) - הפנה לתשלום
      if (!userData) {
        console.log('💳 משתמש חדש, מפנה לתשלום')
        return NextResponse.redirect(new URL('/payment', origin))
      }

      // אם יש רשומה אבל אין מנוי פעיל - הפנה לתשלום
      const userInfo = userData as any
      if (userInfo.subscription_status !== 'active') {
        console.log('💳 אין מנוי פעיל, מפנה לתשלום')
        return NextResponse.redirect(new URL('/payment', origin))
      }

      // אם אין מספר טלפון (שילם אבל לא השלים onboarding) - הפנה ל-onboarding
      if (!userInfo.phone) {
        console.log('📱 אין מספר טלפון, מפנה ל-onboarding')
        return NextResponse.redirect(new URL('/onboarding', origin))
      }

      // אם יש הכל - הפנה ל-dashboard
      console.log('✅ הכל תקין, מפנה ל-dashboard')
      return NextResponse.redirect(new URL('/dashboard', origin))
    }

    if (error) {
      console.error('❌ שגיאה בהתחברות:', error)
    }
  }

  // אם יש שגיאה - הפנה בחזרה ל-login עם הודעת שגיאה
  return NextResponse.redirect(new URL('/login?error=authentication_failed', origin))
}

