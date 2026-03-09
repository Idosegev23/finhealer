import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// All tables with user_id foreign key that need migration during merge
const USER_CHILD_TABLES = [
  'transactions', 'transaction_details', 'goals', 'goal_allocations_history',
  'uploaded_statements', 'wa_messages', 'alerts', 'alerts_events', 'alerts_rules',
  'budgets', 'budget_history', 'behavior_insights', 'savings_accounts',
  'loans', 'loan_applications', 'loan_consolidation_requests',
  'insurance', 'investments', 'pension_insurance', 'income_sources',
  'receipts', 'recurring_patterns', 'reminders', 'user_category_rules',
  'user_patterns', 'user_preferences', 'user_settings', 'user_financial_profile',
  'user_income_forecast', 'conversation_context', 'conversation_history',
  'missing_documents', 'account_snapshots', 'bank_accounts', 'children',
  'dependents', 'user_data_sections', 'user_baselines', 'document_corrections',
  'document_matching_rules', 'chat_messages', 'payslips', 'audit_logs',
  'pattern_corrections', 'pending_tasks', 'reconciliation_issues',
  'subscriptions', 'user_custom_expenses', 'usage_logs',
];

/**
 * Create/Update Subscription + User Merge
 *
 * - New web users get `trial` status (7 days)
 * - If a WhatsApp-created user already exists with the same phone → merge data
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { plan, onboardingType, phone, waOptIn, referralCode } = body;

    if (!plan || !['basic', 'premium'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Admin client (bypasses RLS)
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

    // Clean phone number
    let cleanPhone = phone;
    if (phone !== '0000000000') {
      cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '972' + cleanPhone.substring(1);
      } else if (!cleanPhone.startsWith('972')) {
        cleanPhone = '972' + cleanPhone;
      }
    }

    // Check if auth user already exists in users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    // Phone-based merge: check if a WhatsApp-created user exists with this phone
    if (!existingUser && cleanPhone !== '0000000000') {
      const phoneVariants = [
        cleanPhone,
        cleanPhone.replace(/^972/, '0'),
        cleanPhone.replace(/^0/, '972'),
      ];

      const { data: waUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .in('phone', phoneVariants)
        .neq('id', user.id)
        .maybeSingle();

      if (waUser) {
        console.log(`🔄 Merging WhatsApp user ${waUser.id} → auth user ${user.id}`);

        // Migrate all child table data from old user to auth user
        for (const table of USER_CHILD_TABLES) {
          try {
            await supabaseAdmin
              .from(table)
              .update({ user_id: user.id })
              .eq('user_id', waUser.id);
          } catch {
            // Table might not exist or have no rows — skip silently
          }
        }

        // Delete old WhatsApp user (data already migrated)
        await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', waUser.id);

        console.log(`✅ Merge complete: ${waUser.id} → ${user.id}`);
      }
    }

    // OAuth name detection
    const nameFromOAuth = user.user_metadata?.name || user.user_metadata?.full_name || '';
    const hasNameFromOAuth = nameFromOAuth && nameFromOAuth.trim().length > 0;

    // Create/update user — trial status (not active)
    const { error: upsertUserError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        name: nameFromOAuth || user.email?.split('@')[0] || '',
        full_name: hasNameFromOAuth ? nameFromOAuth : null,
        phone: phone === '0000000000' ? null : cleanPhone,
        wa_opt_in: waOptIn !== undefined ? waOptIn : true,
        subscription_status: 'trial',
        trial_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        phase: 'data_collection',
        onboarding_state: hasNameFromOAuth ? 'waiting_for_document' : 'waiting_for_name',
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

    // Create subscription record (for future payment engine)
    const amount = plan === 'basic' ? 49 : plan === 'premium' ? 119 : 0;
    const { error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          user_id: user.id,
          plan,
          status: 'trial',
          provider: 'manual',
          started_at: new Date().toISOString(),
          amount,
          currency: 'ILS',
          billing_cycle: 'monthly',
          metadata: {
            onboarding_type: onboardingType || 'quick',
            payment_method: 'demo',
          },
        },
        {
          onConflict: 'user_id',
        }
      );

    if (subscriptionError) {
      console.error('Error creating subscription:', subscriptionError);
      // Non-fatal — user was created successfully
    }

    // Apply referral code if provided
    if (referralCode) {
      const normalizedRef = referralCode.trim().toUpperCase();
      const { data: referrer } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('referral_code', normalizedRef)
        .neq('id', user.id)
        .maybeSingle();

      if (referrer) {
        await supabaseAdmin
          .from('users')
          .update({ referred_by: normalizedRef })
          .eq('id', user.id);
        console.log(`🎁 Referral code ${normalizedRef} applied for user ${user.id}`);
      }
    }

    console.log(`✅ User ${user.id} created (trial). Phone: ${phone === '0000000000' ? 'temporary' : cleanPhone}`);

    return NextResponse.json({
      success: true,
      message: 'User created with trial subscription',
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
