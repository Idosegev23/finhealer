import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // אימות משתמש
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // קבלת נתונים מהבקשה
    const body = await request.json();
    const { dependents, incomeSources, ...profile } = body;

    // בדיקה אם כבר קיים פרופיל
    const { data: existing } = await supabase
      .from('user_financial_profile')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result;

    if (existing) {
      // עדכון
      const { data, error } = await (supabase as any)
        .from('user_financial_profile')
        .update({
          ...profile,
          user_id: user.id,
          completed_at: profile.completed ? new Date().toISOString() : null
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json(
          { error: 'Failed to update profile' },
          { status: 500 }
        );
      }

      result = data;
    } else {
      // יצירה חדשה
      const { data, error } = await (supabase as any)
        .from('user_financial_profile')
        .insert({
          ...profile,
          user_id: user.id,
          completed_at: profile.completed ? new Date().toISOString() : null
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        return NextResponse.json(
          { error: 'Failed to create profile' },
          { status: 500 }
        );
      }

      result = data;
    }

    // שמירת תלויים (dependents)
    if (dependents && Array.isArray(dependents)) {
      // מחיקת תלויים קיימים
      await supabase
        .from('dependents')
        .delete()
        .eq('user_id', user.id);

      // הוספת תלויים חדשים
      if (dependents.length > 0) {
        const dependentsToInsert = dependents.map((dep: any) => ({
          user_id: user.id,
          name: dep.name,
          birth_date: dep.birthDate,
          gender: dep.gender,
          relationship_type: dep.relationshipType,
          is_financially_supported: dep.isFinanciallySupported || false
        }));

        const { error: depsError } = await (supabase as any)
          .from('dependents')
          .insert(dependentsToInsert);

        if (depsError) {
          console.error('Error saving dependents:', depsError);
          // לא נכשיל את כל הבקשה בגלל זה
        }
      }
    }

    // שמירת מקורות הכנסה (incomeSources)
    if (incomeSources && Array.isArray(incomeSources)) {
      // מחיקת מקורות הכנסה קיימים
      await supabase
        .from('income_sources')
        .delete()
        .eq('user_id', user.id);

      // הוספת מקורות הכנסה חדשים
      if (incomeSources.length > 0) {
        const sourcesToInsert = incomeSources.map((source: any) => ({
          user_id: user.id,
          source_name: source.sourceName,
          employment_type: source.employmentType,
          gross_amount: source.grossAmount || 0,
          net_amount: source.netAmount || 0,
          actual_bank_amount: source.actualBankAmount || source.netAmount || 0,
          employer_name: source.employerName,
          pension_contribution: source.pensionContribution || 0,
          advanced_study_fund: source.advancedStudyFund || 0,
          other_deductions: source.otherDeductions || 0,
          is_primary: source.isPrimary || false,
          payment_frequency: 'monthly',
          active: true
        }));

        const { error: incomeError } = await (supabase as any)
          .from('income_sources')
          .insert(sourcesToInsert);

        if (incomeError) {
          console.error('Error saving income sources:', incomeError);
          // לא נכשיל את כל הבקשה בגלל זה
        }
      }
    }

    return NextResponse.json({
      success: true,
      profile: result
    });

  } catch (error) {
    console.error('Profile save error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - קבלת פרופיל
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_financial_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error fetching profile:', error);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    return NextResponse.json({ profile: data || null });

  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


