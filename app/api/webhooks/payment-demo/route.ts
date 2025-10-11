import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Webhook דמה לקבלת אישורי תשלום
 * בפרודקשן זה יהיה webhook אמיתי מחשבונית ירוקה
 * 
 * לבדיקה:
 * POST /api/webhooks/payment-demo
 * Body: { "user_id": "uuid", "amount": 49, "status": "paid" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, amount, status, plan = 'basic' } = body

    if (!user_id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    if (status === 'paid') {
      // עדכן את סטטוס המנוי של המשתמש
      const { error: updateError } = await supabase
        .from('users')
        .update({ subscription_status: 'active' })
        .eq('id', user_id)

      if (updateError) {
        console.error('Error updating user:', updateError)
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
      }

      // צור או עדכן מנוי
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id,
          plan,
          status: 'active',
          amount,
          currency: 'ILS',
          billing_cycle: 'monthly',
          started_at: new Date().toISOString(),
          provider: 'green_invoice',
        })

      if (subscriptionError) {
        console.error('Error creating subscription:', subscriptionError)
        return NextResponse.json(
          { error: 'Failed to create subscription' },
          { status: 500 }
        )
      }

      // שלח הודעת ברוכים הבאים (בעתיד - דרך WhatsApp)
      await supabase.from('alerts').insert({
        user_id,
        type: 'welcome',
        status: 'sent',
        message: 'ברוך הבא ל-FinHealer! אנחנו כאן כדי לעזור לך לשפר את המצב הפיננסי שלך 🎉',
      })

      return NextResponse.json({
        success: true,
        message: 'Payment processed successfully',
      })
    }

    if (status === 'cancelled') {
      // עדכן סטטוס ל-cancelled
      await supabase
        .from('users')
        .update({ subscription_status: 'cancelled' })
        .eq('id', user_id)

      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('user_id', user_id)

      return NextResponse.json({
        success: true,
        message: 'Subscription cancelled',
      })
    }

    return NextResponse.json(
      { error: 'Invalid status' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint לבדיקת סטטוס
 */
export async function GET() {
  return NextResponse.json({
    service: 'payment-webhook-demo',
    status: 'active',
    message: 'This is a demo webhook. In production, use Green Invoice webhook.',
  })
}

