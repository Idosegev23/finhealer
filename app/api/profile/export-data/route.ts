import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // בדיקת משתמש
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'לא מחובר' },
        { status: 401 }
      );
    }

    // אסוף את כל הנתונים
    const [
      { data: profile },
      { data: transactions },
      { data: loans },
      { data: goals },
      { data: budgets },
      { data: savings },
      { data: insurance },
      { data: pensions },
      { data: bankAccounts },
    ] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('transactions').select('*').eq('user_id', user.id),
      supabase.from('loans').select('*').eq('user_id', user.id),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase.from('budget_categories').select('*').eq('user_id', user.id),
      supabase.from('savings_accounts').select('*').eq('user_id', user.id),
      supabase.from('insurance').select('*').eq('user_id', user.id),
      supabase.from('pension_insurance').select('*').eq('user_id', user.id),
      supabase.from('bank_accounts').select('*').eq('user_id', user.id),
    ]);

    const profileData = profile as any;
    
    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        name: profileData?.name,
        email: profileData?.email,
        phone: profileData?.phone,
        city: profileData?.city,
        birth_date: profileData?.birth_date,
        marital_status: profileData?.marital_status,
        children_count: profileData?.children_count,
      },
      financial_data: {
        transactions: transactions || [],
        loans: loans || [],
        goals: goals || [],
        budgets: budgets || [],
        savings: savings || [],
        insurance: insurance || [],
        pensions: pensions || [],
        bank_accounts: bankAccounts || [],
      },
      statistics: {
        total_transactions: transactions?.length || 0,
        total_loans: loans?.length || 0,
        total_goals: goals?.length || 0,
        total_budgets: budgets?.length || 0,
      },
    };

    // יצירת קובץ JSON להורדה
    const fileName = `finhealer-data-${user.id.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.json`;
    
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה בייצוא הנתונים' },
      { status: 500 }
    );
  }
}

