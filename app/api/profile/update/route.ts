// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { inferLoansFromProfile } from '@/lib/utils/inferLoansFromProfile'

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

    // Mortgage sync: when the user owns their home and entered a monthly
    // payment, ensure a `loans` row of type 'mortgage' exists so the
    // amount shows in fixed expenses, the loans page, and debt reports —
    // not just as a raw number on user_financial_profile. Renters get
    // their amount reflected via profile consumption alone (no loan).
    const ownsHomeBool = cleanBool(owns_home)
    const rentMortgageNum = cleanInt(rent_mortgage)
    if (ownsHomeBool === true && rentMortgageNum && rentMortgageNum > 0) {
      const { data: existingMortgage } = await supabase
        .from('loans')
        .select('id, monthly_payment')
        .eq('user_id', user.id)
        .eq('loan_type', 'mortgage')
        .eq('active', true)
        .maybeSingle()

      if (!existingMortgage) {
        const [inferred] = inferLoansFromProfile({ rent_mortgage: rentMortgageNum })
        if (inferred) {
          const { error: loanInsertError } = await supabase
            .from('loans')
            .insert({
              user_id: user.id,
              lender_name: inferred.lender_name,
              loan_type: inferred.loan_type,
              monthly_payment: inferred.monthly_payment,
              current_balance: inferred.current_balance,
              original_amount: inferred.current_balance,
              interest_rate: inferred.interest_rate,
              remaining_payments: inferred.remaining_payments,
              notes: inferred.notes,
              active: true,
            })
          if (loanInsertError) {
            console.error('❌ Error creating mortgage loan:', loanInsertError)
          } else {
            console.log('✅ Mortgage loan auto-created from profile')
          }
        }
      } else if (Number(existingMortgage.monthly_payment) !== rentMortgageNum) {
        const { error: loanUpdateError } = await supabase
          .from('loans')
          .update({ monthly_payment: rentMortgageNum })
          .eq('id', existingMortgage.id)
        if (loanUpdateError) {
          console.error('❌ Error updating mortgage payment:', loanUpdateError)
        } else {
          console.log('✅ Mortgage payment synced')
        }
      }
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

