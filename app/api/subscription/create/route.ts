import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Create/Update Subscription
 * API endpoint שעוקף RLS issues
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // בדיקת אימות
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { plan, onboardingType } = body;

    if (!plan || !['basic', 'advanced'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // בדוק אם המשתמש כבר קיים ב-users table
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    // יצור/עדכן משתמש ב-users table (נוצר רק אחרי תשלום מוצלח!)
    const { error: upsertUserError } = await (supabase as any)
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0] || '',
        phone: user.user_metadata?.phone || user.phone || null,
        subscription_status: 'active',
        phase: 'reflection', // יתחיל תמיד מ-reflection
        created_at: existingUser ? undefined : new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (upsertUserError) {
      console.error('Error creating/updating user:', upsertUserError);
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // צור/עדכן מנוי
    const amount = plan === 'basic' ? 49 : 119;
    const { error: subscriptionError } = await (supabase as any)
      .from('subscriptions')
      .upsert(
        {
          user_id: user.id,
          plan,
          status: 'active',
          provider: 'demo',
          started_at: new Date().toISOString(),
          amount,
          currency: 'ILS',
          billing_cycle: 'monthly',
          metadata: {
            onboarding_type: onboardingType || 'quick',
          },
        },
        {
          onConflict: 'user_id',
        }
      );

    if (subscriptionError) {
      console.error('Error creating subscription:', subscriptionError);
      return NextResponse.json(
        { error: 'Failed to create subscription', details: subscriptionError.message },
        { status: 500 }
      );
    }

    console.log(`✅ User ${user.id} created in DB and subscribed to ${plan}`);

    return NextResponse.json({
      success: true,
      message: 'User created and subscription activated',
      onboardingType: onboardingType || 'quick',
    });
  } catch (error: any) {
    console.error('Subscription creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

