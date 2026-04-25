import { NextRequest, NextResponse } from 'next/server';
import { dedupeUserTransactions } from '@/lib/finance/dedupe-transactions';

/**
 * POST /api/admin/dedupe-user
 *
 * Body: { userId: string, mode?: 'strict' | 'loose', dryRun?: boolean }
 * Auth: Bearer CRON_SECRET
 *
 * Returns: counts of duplicate groups, rows deleted, and any rows blocked by FK refs.
 *
 * After cleanup, callers should re-sync the user's budget (BudgetSyncService).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, mode = 'strict', dryRun = false } = body || {};
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  if (mode !== 'strict' && mode !== 'loose') {
    return NextResponse.json({ error: "mode must be 'strict' or 'loose'" }, { status: 400 });
  }

  try {
    const result = await dedupeUserTransactions(userId, { mode, dryRun });

    // Re-sync budget after a real (non-dry-run) cleanup
    if (!dryRun && result.rowsDeleted > 0) {
      try {
        const { syncBudgetSpending } = await import('@/lib/services/BudgetSyncService');
        await syncBudgetSpending(userId);
      } catch (syncErr) {
        console.error('[dedupe-user] budget resync failed (non-fatal):', syncErr);
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[dedupe-user] error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
