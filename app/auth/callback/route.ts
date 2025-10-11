import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      console.log('✅ התחברות הצליחה:', data.user.id)

      // המתן רגע קצר כדי שה-trigger יפעל (יצירת רשומה ב-users)
      await new Promise(resolve => setTimeout(resolve, 500))

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

      // אם אין מספר טלפון - הפנה ל-onboarding
      if (!userData?.phone) {
        console.log('📱 אין מספר טלפון, מפנה ל-onboarding')
        return NextResponse.redirect(`${origin}/onboarding`)
      }

      // אם יש מספר אבל אין מנוי פעיל - הפנה ל-payment
      if (userData.subscription_status !== 'active') {
        console.log('💳 יש מספר אבל אין מנוי פעיל, מפנה לתשלום')
        return NextResponse.redirect(`${origin}/payment`)
      }

      // אם יש הכל - הפנה ל-dashboard
      console.log('✅ הכל תקין, מפנה ל-dashboard')
      return NextResponse.redirect(`${origin}/dashboard`)
    }

    if (error) {
      console.error('❌ שגיאה בהתחברות:', error)
    }
  }

  // אם יש שגיאה - הפנה בחזרה ל-login עם הודעת שגיאה
  return NextResponse.redirect(`${origin}/login?error=authentication_failed`)
}

