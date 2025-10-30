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
    const { 
      name, 
      phone, 
      birth_date, 
      city, 
      marital_status, 
      children_count 
    } = body

    console.log('📝 Updating profile for user:', user.id, body)

    // עדכון פרופיל בסיסי ב-users
    const { error: usersUpdateError } = await supabase
      .from('users')
      .update({
        name,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (usersUpdateError) {
      console.error('❌ Error updating users table:', usersUpdateError)
    }

    // עדכון פרטים אישיים ב-user_financial_profile
    const { data: updatedUser, error: updateError } = await supabase
      .from('user_financial_profile')
      .upsert({
        user_id: user.id,
        birth_date,
        city,
        marital_status,
        children_count,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating profile:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile', details: updateError.message },
        { status: 500 }
      )
    }

    console.log('✅ Profile updated successfully')
    return NextResponse.json({ success: true, user: updatedUser })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

