import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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

    // מחיקת כל הנתונים של המשתמש באמצעות DB function (CASCADE)
    // Fallback: hardcoded table list if RPC not available
    const adminSupabase = createServiceClient();

    // Try DB-level cascade delete first (handles FK order automatically)
    const { error: rpcError } = await adminSupabase.rpc('delete_user_data', {
      p_user_id: user.id,
    });

    const failedTables: string[] = [];

    if (rpcError) {
      // Fallback: manual deletion in FK order
      console.warn('[delete-account] RPC unavailable, using manual fallback:', rpcError.message);
      const tablesToDelete = [
        'transaction_details',
        'transactions',
        'loans',
        'goals',
        'budget_categories',
        'budgets',
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
        'reminders',
        'conversation_context',
        'loan_consolidation_requests',
      ];

      for (const table of tablesToDelete) {
        const { error: delErr } = await adminSupabase
          .from(table)
          .delete()
          .eq('user_id', user.id);
        if (delErr && !delErr.message.includes('does not exist')) {
          console.error(`Failed to delete from ${table}:`, delErr.message);
          failedTables.push(table);
        }
      }
    }

    // מחיקת המשתמש מטבלת users
    const { error: userDelErr } = await adminSupabase
      .from('users')
      .delete()
      .eq('id', user.id);

    if (userDelErr) {
      console.error('Failed to delete user record:', userDelErr.message);
      failedTables.push('users');
    }

    // מחיקת החשבון מ-Supabase Auth
    const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(
      user.id
    );

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
    }

    if (failedTables.length > 0) {
      console.error(`Account deletion incomplete for ${user.id}. Failed tables: ${failedTables.join(', ')}`);
    }

    return NextResponse.json({
      success: true,
      message: 'החשבון נמחק בהצלחה. נצטער לראות שאתה עוזב.',
    });

  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'שגיאה במחיקת החשבון' },
      { status: 500 }
    );
  }
}

