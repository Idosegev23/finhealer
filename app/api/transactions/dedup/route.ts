import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { retroactiveDedup } from '@/lib/reconciliation/credit-matcher';

/**
 * POST /api/transactions/dedup
 * Run retroactive deduplication to fix double-counted CC transactions.
 * Marks bank CC aggregate charges as is_summary=true when detailed CC statement exists.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Dedup] Starting retroactive dedup for user ${user.id}`);
    const result = await retroactiveDedup(supabase, user.id);
    console.log(`[Dedup] Completed: ${result.matched} matches found`);

    return NextResponse.json({
      success: true,
      matched: result.matched,
      details: result.details,
    });
  } catch (error: any) {
    console.error('[Dedup] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Dedup failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transactions/dedup
 * Check how many potential duplicates exist (dry run info)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Count transactions marked as summary
    const { count: summaryCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_summary', true);

    // Count credit card documents
    const { count: creditDocs } = await supabase
      .from('uploaded_statements')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .or('file_type.ilike.%credit%,document_type.ilike.%credit%');

    // Count bank source transactions from CC companies
    const { data: ccCharges } = await supabase
      .from('transactions')
      .select('id, vendor, amount')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .eq('is_source_transaction', true)
      .or('is_summary.is.null,is_summary.eq.false');

    // Filter for CC company vendors
    const CC_PATTERNS = ['מקס', 'max', 'ישראכרט', 'isracard', 'כאל', 'cal', 'אמריקן', 'amex', 'ויזה', 'ויזא', 'visa', 'כרטיס אשראי', 'דיינרס', 'מסטרקארד'];
    const potentialDupes = (ccCharges || []).filter((tx: any) => {
      if (!tx.vendor) return false;
      const v = tx.vendor.toLowerCase();
      return CC_PATTERNS.some(p => v.includes(p.toLowerCase()));
    });

    return NextResponse.json({
      alreadyMarked: summaryCount || 0,
      creditDocuments: creditDocs || 0,
      potentialDuplicates: potentialDupes.length,
      potentialDuplicateDetails: potentialDupes.map((tx: any) => ({
        id: tx.id,
        vendor: tx.vendor,
        amount: tx.amount,
      })),
    });
  } catch (error: any) {
    console.error('[Dedup] Check error:', error);
    return NextResponse.json(
      { error: error.message || 'Check failed' },
      { status: 500 }
    );
  }
}
