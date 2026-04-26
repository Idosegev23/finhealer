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
      children_count,
      owns_home,
      rent_mortgage,
    } = body

    console.log('📝 Updating profile for user:', user.id, body)

    // Postgres rejects '' for date / integer columns. Normalize empty
    // strings to null so the upsert doesn't 500 when the form leaves a
    // field blank.
    const cleanStr = (v: any) => (v === '' || v === undefined ? null : v)
    const cleanInt = (v: any) => {
      if (v === '' || v === null || v === undefined) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    const cleanDate = (v: any) => {
      if (!v || v === '') return null
      const d = new Date(v)
      return Number.isNaN(d.getTime()) ? null : v
    }
    const cleanBool = (v: any) => {
      if (v === null || v === undefined || v === '') return null
      if (typeof v === 'boolean') return v
      if (v === 'true') return true
      if (v === 'false') return false
      return null
    }

    const { error: usersUpdateError } = await supabase
      .from('users')
      .update({
        name: cleanStr(name),
        phone: cleanStr(phone),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (usersUpdateError) {
      console.error('❌ Error updating users table:', usersUpdateError)
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('user_financial_profile')
      .upsert({
        user_id: user.id,
        birth_date: cleanDate(birth_date),
        city: cleanStr(city),
        marital_status: cleanStr(marital_status),
        children_count: cleanInt(children_count),
        owns_home: cleanBool(owns_home),
        rent_mortgage: cleanInt(rent_mortgage),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })
      .select()
      .maybeSingle()

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

