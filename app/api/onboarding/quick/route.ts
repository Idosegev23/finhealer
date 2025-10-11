import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      primaryGoal,
      monthlyIncome,
      hasDebts,
      debtAmount,
      hasSavings,
      savingsAmount,
      startMethod,
    } = body;

    // Update user's name and phase
    const { error: updateUserError } = await supabase
      .from('users')
      .update({
        name: name || user.user_metadata?.name || user.email?.split('@')[0],
        phase: 'behavior', // Quick onboarding goes straight to behavior
      })
      .eq('id', user.id);

    if (updateUserError) {
      console.error('Error updating user:', updateUserError);
      return NextResponse.json(
        { error: 'Failed to update user profile' },
        { status: 500 }
      );
    }

    // Create or update user_financial_profile with quick data
    const { error: profileError } = await supabase
      .from('user_financial_profile')
      .upsert(
        {
          user_id: user.id,
          monthly_income: monthlyIncome || null,
          credit_card_debt: hasDebts ? debtAmount || 0 : 0,
          current_savings: hasSavings ? savingsAmount || 0 : 0,
          short_term_goal: primaryGoal || null,
          completed: false, // Quick onboarding is NOT complete
        },
        { onConflict: 'user_id' }
      );

    if (profileError) {
      console.error('Error updating financial profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to update financial profile' },
        { status: 500 }
      );
    }

    // Store the start method in user_settings
    const { error: settingsError } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          preferences: {
            onboarding_type: 'quick',
            start_method: startMethod,
            primary_goal: primaryGoal,
          },
        },
        { onConflict: 'user_id' }
      );

    if (settingsError) {
      console.error('Error updating user settings:', settingsError);
      // Don't fail the request for this
    }

    return NextResponse.json({
      success: true,
      message: 'Quick onboarding completed',
      startMethod,
    });
  } catch (error: any) {
    console.error('Quick onboarding error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

