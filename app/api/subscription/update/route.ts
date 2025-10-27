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
    const { plan } = body

    if (!plan || !['basic', 'premium'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "basic" or "premium"' },
        { status: 400 }
      )
    }

    console.log('💳 Updating subscription for user:', user.id, 'to plan:', plan)

    // בדוק אם יש מנוי קיים
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching subscription:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch subscription', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!existingSubscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      )
    }

    // חישוב הסכום החדש
    const amount = plan === 'basic' ? 49 : 119

    // עדכון המנוי
    const { data: updatedSubscription, error: updateError } = await supabase
      .from('subscriptions')
      .update({
        plan,
        amount,
        metadata: {
          ...existingSubscription.metadata,
          plan_changed_at: new Date().toISOString(),
          previous_plan: existingSubscription.plan,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSubscription.id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating subscription:', updateError)
      return NextResponse.json(
        { error: 'Failed to update subscription', details: updateError.message },
        { status: 500 }
      )
    }

    // עדכון סטטוס מנוי ב-users
    await supabase
      .from('users')
      .update({ subscription_status: 'active' })
      .eq('id', user.id)

    console.log('✅ Subscription updated successfully')
    return NextResponse.json({ 
      success: true, 
      subscription: updatedSubscription,
      message: `Plan changed to ${plan} successfully!`
    })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

