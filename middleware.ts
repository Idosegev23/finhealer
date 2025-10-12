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
  const protectedPaths = ['/dashboard', '/onboarding', '/payment', '/reflection', '/transactions', '/goals', '/budget', '/reports', '/settings']
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))
  
  if (!user && isProtectedPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // אם המשתמש מחובר (קיים ב-Supabase Auth)
  if (user) {
    const currentPath = request.nextUrl.pathname

    // בדוק אם המשתמש קיים ב-users table (נוצר רק אחרי תשלום)
    const { data: userData } = await supabase
      .from('users')
      .select('name, phone, subscription_status, created_at')
      .eq('id', user.id)
      .single()

    const userExistsInDB = !!userData
    const hasActiveSubscription = userData?.subscription_status === 'active'
    const hasCompletedOnboarding = !!userData?.name || !!userData?.phone

    // תהליך: login (auth) → payment (בחירת תוכנית בתוכו) → users table נוצר → onboarding → dashboard

    // 1. משתמש מאומת אבל לא קיים ב-users (טרם שילם)
    if (!userExistsInDB) {
      // הרשה גישה רק ל-payment (בחירת תוכנית בתוך דף התשלום)
      if (currentPath !== '/payment' &&
          currentPath !== '/login' &&
          currentPath !== '/signup') {
        return NextResponse.redirect(new URL('/payment', request.url))
      }
    }

    // 2. משתמש קיים ב-DB אבל טרם השלים onboarding
    if (userExistsInDB && !hasCompletedOnboarding) {
      if (!currentPath.startsWith('/onboarding') && 
          currentPath !== '/payment') {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }

    // 3. משתמש השלים onboarding אבל אין מנוי פעיל (לא אמור לקרות, אבל...)
    if (userExistsInDB && hasCompletedOnboarding && !hasActiveSubscription) {
      if (currentPath !== '/payment') {
        return NextResponse.redirect(new URL('/payment', request.url))
      }
    }

    // 4. משתמש עם הכל - אסור לחזור ל-login/signup/payment
    if (userExistsInDB && hasCompletedOnboarding && hasActiveSubscription) {
      if (currentPath === '/login' || 
          currentPath === '/signup') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      // מנע גישה ל-payment/onboarding אלא אם כן רוצה לעדכן
      if ((currentPath === '/payment' || currentPath.startsWith('/onboarding')) &&
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

