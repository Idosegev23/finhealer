import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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
    
    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
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
        console.error('❌ User not found:', customer_email);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const userId = userRecord.id;

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
      const { error: upsertUserError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: customer_email,
          name: metadata?.customer_name || customer_email.split('@')[0] || '',
          phone: metadata?.customer_phone || null,
          subscription_status: 'active',
          phase: 'reflection',
          created_at: existingUser ? undefined : new Date().toISOString(),
        }, {
          onConflict: 'id',
        });

      if (upsertUserError) {
        console.error('❌ Error creating user:', upsertUserError);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }

      // יצור/עדכן מנוי
      const { error: subscriptionError } = await supabase
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

      // עדכן סטטוס
      await supabase
        .from('users')
        .update({ subscription_status: 'inactive' })
        .eq('id', userRecord.id);

      await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          canceled_at: new Date().toISOString(),
        })
        .eq('user_id', userRecord.id);

      console.log(`🚫 Subscription cancelled for ${customer_email}`);

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
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('user_id', userRecord.id);

        console.log(`⚠️ Payment failed for ${customer_email}`);
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

