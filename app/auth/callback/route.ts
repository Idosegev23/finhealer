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

      // תמיד הפנה לאונבורדינג - middleware יטפל בהפניה מדויקת
      console.log('🎯 מפנה לאונבורדינג (middleware יחליט על המסלול)')
      response = NextResponse.redirect(new URL('/onboarding', origin))
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

