import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
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

    console.log('🔐 User authentication:', { hasUser: !!user, userId: user?.id });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { plan, onboardingType, phone, waOptIn } = body;

    console.log('📦 Request body:', { plan, onboardingType, phone, waOptIn });

    if (!plan || !['basic', 'advanced'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // אפשר טלפון זמני (0000000000) - יעודכן בשלב הבא
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // צור admin client שעוקף RLS
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // בדוק אם המשתמש כבר קיים ב-users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    // נקה מספר טלפון (הוסף +972 אם אין) - אבל לא אם זה זמני
    let cleanPhone = phone;
    if (phone !== '0000000000') {
      cleanPhone = phone.replace(/\D/g, ''); // רק ספרות
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '972' + cleanPhone.substring(1);
      } else if (!cleanPhone.startsWith('972')) {
        cleanPhone = '972' + cleanPhone;
      }
    }

    // יצור/עדכן משתמש ב-users table (נוצר רק אחרי תשלום מוצלח!)
    const { error: upsertUserError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0] || '',
        phone: phone === '0000000000' ? null : cleanPhone, // null אם זמני
        wa_opt_in: waOptIn !== undefined ? waOptIn : true,
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
    const { error: subscriptionError } = await supabaseAdmin
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

    console.log(`✅ User ${user.id} created in DB and subscribed to ${plan}. Phone: ${phone === '0000000000' ? 'temporary' : cleanPhone}, WA Opt-in: ${waOptIn}`);

    return NextResponse.json({
      success: true,
      message: 'User created and subscription activated',
      onboardingType: onboardingType || 'quick',
      phone: phone === '0000000000' ? null : cleanPhone,
      waOptIn: waOptIn,
    });
  } catch (error: any) {
    console.error('Subscription creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

