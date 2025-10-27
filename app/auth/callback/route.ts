import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  
  // יצירת response שנחזיר עם cookies מעודכנים
  let response = NextResponse.next()

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
            cookieStore.set({ name, value, ...options })
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('🔐 exchangeCodeForSession result:', { 
      hasUser: !!data.user, 
      userId: data.user?.id,
      hasSession: !!data.session,
      error: error?.message 
    })

    if (!error && data.user) {
      console.log('✅ התחברות הצליחה:', data.user.id, 'email:', data.user.email)

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
        response = NextResponse.redirect(new URL('/payment', origin))
        return response
      }

      // אם יש רשומה אבל אין מנוי פעיל - הפנה לתשלום
      const userInfo = userData as any
      if (userInfo.subscription_status !== 'active') {
        console.log('💳 אין מנוי פעיל, מפנה לתשלום')
        response = NextResponse.redirect(new URL('/payment', origin))
        return response
      }

      // אם אין מספר טלפון (שילם אבל לא השלים onboarding) - הפנה ל-onboarding
      if (!userInfo.phone) {
        console.log('📱 אין מספר טלפון, מפנה ל-onboarding')
        response = NextResponse.redirect(new URL('/onboarding', origin))
        return response
      }

      // אם יש הכל - הפנה ל-dashboard
      console.log('✅ הכל תקין, מפנה ל-dashboard')
      response = NextResponse.redirect(new URL('/dashboard', origin))
      return response
    }

    if (error) {
      console.error('❌ שגיאה בהתחברות:', error)
    }
  }

  // אם יש שגיאה - הפנה בחזרה ל-login עם הודעת שגיאה
  response = NextResponse.redirect(new URL('/login?error=authentication_failed', origin))
  return response
}

