import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { maskEmail } from '@/lib/utils/mask-pii';

/**
 * Green Invoice Webhook Handler
 * מטפל בעדכוני סטטוס תשלום מחשבונית ירוקה
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // אימות Webhook Signature (חשוב!)
    const signature = request.headers.get('x-gi-signature');
    const webhookSecret = process.env.GI_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('❌ GI_WEBHOOK_SECRET not configured — rejecting webhook');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }
    if (!signature) {
      console.error('❌ Missing webhook signature');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');
    if (signature !== expectedSignature) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { event, data } = body;

    console.log('🔔 Green Invoice Webhook:', event, data);

    // טפל באירועי תשלום
    if (event === 'payment.success' || event === 'subscription.created') {
      const {
        customer_email,
        customer_id,
        plan_id,
        subscription_id,
        amount,
        currency = 'ILS',
        metadata,
      } = data;

      const supabase = await createClient();

      // מצא את המשתמש לפי מייל
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', customer_email)
        .single();

      if (userError || !userRecord) {
        console.error('❌ User not found:', maskEmail(customer_email));
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const userRecordData = userRecord as any;
      const userId = userRecordData.id;

      // קבע את התוכנית לפי plan_id או amount
      let plan: 'basic' | 'advanced' = 'basic';
      if (plan_id === 'advanced' || amount >= 119) {
        plan = 'advanced';
      }

      // קבל את onboarding_type מ-metadata אם קיים
      const onboardingType = metadata?.onboarding_type || 'quick';

      // בדוק אם המשתמש כבר קיים ב-users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      // יצור/עדכן משתמש ב-users table
      const { error: upsertUserError } = await (supabase as any)
        .from('users')
        .upsert({
          id: userId,
          email: customer_email,
          name: metadata?.customer_name || customer_email.split('@')[0] || '',
          phone: metadata?.customer_phone || null,
          subscription_status: 'active',
          phase: 'data_collection',
          created_at: existingUser ? undefined : new Date().toISOString(),
        }, {
          onConflict: 'id',
        });

      if (upsertUserError) {
        console.error('❌ Error creating user:', upsertUserError);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }

      // יצור/עדכן מנוי
      const { error: subscriptionError } = await (supabase as any)
        .from('subscriptions')
        .upsert({
          user_id: userId,
          plan,
          status: 'active',
          provider: 'green_invoice',
          external_id: subscription_id || customer_id,
          started_at: new Date().toISOString(),
          amount: parseFloat(amount),
          currency,
          billing_cycle: 'monthly',
          metadata: {
            onboarding_type: onboardingType,
            gi_customer_id: customer_id,
            gi_subscription_id: subscription_id,
          },
        }, {
          onConflict: 'user_id',
        });

      if (subscriptionError) {
        console.error('❌ Error creating subscription:', subscriptionError);
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
      }

      console.log(`✅ User ${userId} subscribed via Green Invoice: ${plan}`);

      return NextResponse.json({ success: true, message: 'Subscription activated' });
    }

    // טפל בביטול מנוי
    if (event === 'subscription.cancelled') {
      const { customer_email, subscription_id } = data;

      const supabase = await createClient();

      // מצא משתמש
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', customer_email)
        .single();
      
      if (userError || !userRecord) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const cancelledUserData = userRecord as any;

      // עדכן סטטוס
      await (supabase as any)
        .from('users')
        .update({ subscription_status: 'inactive' })
        .eq('id', cancelledUserData.id);

      await (supabase as any)
        .from('subscriptions')
        .update({
          status: 'cancelled',
          canceled_at: new Date().toISOString(),
        })
        .eq('user_id', cancelledUserData.id);

      console.log(`🚫 Subscription cancelled for ${maskEmail(customer_email)}`);

      return NextResponse.json({ success: true, message: 'Subscription cancelled' });
    }

    // טפל בתשלום כושל
    if (event === 'payment.failed') {
      const { customer_email } = data;

      const supabase = await createClient();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', customer_email)
        .single();

      if (userRecord) {
        const failedUserData = userRecord as any;
        await (supabase as any)
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('user_id', failedUserData.id);

        console.log(`⚠️ Payment failed for ${maskEmail(customer_email)}`);
      }

      return NextResponse.json({ success: true, message: 'Payment failure recorded' });
    }

    // אירוע לא מזוהה
    console.log(`ℹ️ Unhandled webhook event: ${event}`);
    return NextResponse.json({ success: true, message: 'Event received' });

  } catch (error: any) {
    console.error('❌ Green Invoice webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

