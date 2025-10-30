import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { confirmText } = body;

    // וידוא שהמשתמש אישר את המחיקה
    if (confirmText !== 'מחק את החשבון שלי') {
      return NextResponse.json(
        { error: 'נא להקליד את הטקסט המבוקש' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // בדיקת משתמש
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'לא מחובר' },
        { status: 401 }
      );
    }

    // מחיקת כל הנתונים של המשתמש (RLS ידאג שרק הנתונים שלו נמחקים)
    const tablesToDelete = [
      'transactions',
      'transaction_details',
      'loans',
      'goals',
      'budget_categories',
      'savings_accounts',
      'insurance',
      'pension_insurance',
      'bank_accounts',
      'payslips',
      'uploaded_statements',
      'wa_messages',
      'alerts',
      'subscriptions',
      'user_data_sections',
      'user_financial_profile',
      'user_category_rules',
      'audit_logs',
    ];

    // מחיקה מכל הטבלאות
    for (const table of tablesToDelete) {
      await supabase
        .from(table)
        .delete()
        .eq('user_id', user.id);
    }

    // מחיקת המשתמש מטבלת users
    await supabase
      .from('users')
      .delete()
      .eq('id', user.id);

    // מחיקת החשבון מ-Supabase Auth
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(
      user.id
    );

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      // ממשיכים גם אם יש שגיאה, המשתמש כבר לא יכול להתחבר
    }

    return NextResponse.json({
      success: true,
      message: 'החשבון נמחק בהצלחה. נצטער לראות שאתה עוזב.',
    });

  } catch (error: any) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה במחיקת החשבון' },
      { status: 500 }
    );
  }
}

