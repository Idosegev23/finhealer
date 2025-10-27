// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { newPassword } = body

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    console.log('🔐 Changing password for user:', user.id)

    // שינוי סיסמה
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      console.error('❌ Error changing password:', updateError)
      return NextResponse.json(
        { error: 'Failed to change password', details: updateError.message },
        { status: 500 }
      )
    }

    console.log('✅ Password changed successfully')
    return NextResponse.json({ success: true, message: 'Password changed successfully' })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

