import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // אם המשתמש לא מחובר ומנסה לגשת לדפים מוגנים
  const protectedPaths = ['/dashboard', '/onboarding', '/payment', '/transactions', '/goals', '/budget', '/reports', '/settings', '/loans-simulator', '/guide', '/admin']
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))
  
  if (!user && isProtectedPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // אם המשתמש מחובר (קיים ב-Supabase Auth)
  if (user) {
    const currentPath = request.nextUrl.pathname

    // בדוק אם המשתמש קיים ב-users table (נוצר רק אחרי תשלום)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('name, phone, subscription_status, created_at')
      .eq('id', user.id)
      .maybeSingle()

    const userExistsInDB = !!userData && !userError
    const hasActiveSubscription = userData?.subscription_status === 'active' || userData?.subscription_status === 'trial'
    // השלים אונבורדינג = יש מנוי פעיל/trial + יש טלפון (name מגיע אוטומטית מGoogle)
    const hasCompletedOnboarding = hasActiveSubscription && !!userData?.phone

    // Admin access — check email allowlist
    if (currentPath.startsWith('/admin')) {
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
      const userEmail = user.email?.toLowerCase() || ''
      if (!adminEmails.includes(userEmail)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    // תהליך: login/signup → onboarding (טלפון) → WhatsApp → dashboard

    // 1. משתמש מאומת אבל לא קיים ב-users (משתמש חדש לגמרי)
    if (!userExistsInDB) {
      if (!currentPath.startsWith('/onboarding') &&
          currentPath !== '/login' &&
          currentPath !== '/signup') {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }

    // 2. משתמש קיים ב-DB אבל טרם השלים onboarding (אין טלפון)
    if (userExistsInDB && !hasCompletedOnboarding) {
      if (!currentPath.startsWith('/onboarding') && !currentPath.startsWith('/payment')) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }

    // 3. משתמש עם הכל — אסור לחזור ל-login/signup
    if (userExistsInDB && hasCompletedOnboarding && hasActiveSubscription) {
      if (currentPath === '/login' ||
          currentPath === '/signup') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      // מנע גישה ל-onboarding אלא אם כן רוצה לעדכן
      if (currentPath.startsWith('/onboarding') &&
          !request.nextUrl.searchParams.has('update')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - auth (auth callbacks)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public|auth).*)',
  ],
}

