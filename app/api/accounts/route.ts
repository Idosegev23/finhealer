import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/accounts — list user's financial accounts
 * Returns bank accounts + credit cards with transaction counts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: accounts, error } = await supabase
      .from('financial_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('account_type')
      .order('institution');

    if (error) {
      console.error('Failed to fetch accounts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get transaction counts per account
    const accountsWithCounts = await Promise.all(
      (accounts || []).map(async (acc: any) => {
        const { count } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('financial_account_id', acc.id)
          .or('is_summary.is.null,is_summary.eq.false');

        return { ...acc, transaction_count: count || 0 };
      })
    );

    return NextResponse.json({
      accounts: accountsWithCounts,
      total: accountsWithCounts.length,
    });
  } catch (err: any) {
    console.error('Accounts API error:', err);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}
