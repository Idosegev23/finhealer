/**
 * Transaction deduplication.
 *
 * Two duplicate definitions:
 *  - "strict": same user, tx_date, amount, normalized vendor, type
 *  - "loose":  same user, tx_date, amount, type — for OCR re-uploads where the
 *              vendor string drifts between extractions ("ויזה" vs "VISA כאל ****1234")
 *
 * Strategy: keep the oldest row in each group, delete the rest. Returns counts.
 * Safe for FK relationships — wa_messages/receipts/missing_documents/pattern_corrections
 * all have ON DELETE SET NULL. Self-references and other tables are checked up-front.
 */

import { createServiceClient } from '@/lib/supabase/server';

export interface DedupeResult {
  scanned: number;
  duplicateGroups: number;
  rowsDeleted: number;
  blocked: Array<{ reason: string; transactionId: string }>;
  /** Set true to compute and return groups without deleting anything */
  dryRun: boolean;
}

interface TxRow {
  id: string;
  tx_date: string;
  amount: number;
  vendor: string | null;
  type: string;
  created_at: string;
}

const norm = (s: string | null | undefined): string =>
  (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

const strictKey = (t: TxRow): string =>
  `${t.tx_date}|${Number(t.amount).toFixed(2)}|${norm(t.vendor)}|${t.type}`;

const looseKey = (t: TxRow): string =>
  `${t.tx_date}|${Number(t.amount).toFixed(2)}|${t.type}`;

/**
 * Find duplicate groups for a user.
 * mode='strict' is conservative; mode='loose' catches OCR drift but may collapse
 * legitimate same-day same-amount transactions (e.g. two ATM withdrawals).
 */
export async function findDuplicateGroups(
  userId: string,
  mode: 'strict' | 'loose' = 'strict'
): Promise<Map<string, TxRow[]>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('transactions')
    .select('id, tx_date, amount, vendor, type, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`findDuplicateGroups: ${error.message}`);

  const groups = new Map<string, TxRow[]>();
  for (const tx of (data || []) as TxRow[]) {
    const key = mode === 'strict' ? strictKey(tx) : looseKey(tx);
    const existing = groups.get(key);
    if (existing) existing.push(tx);
    else groups.set(key, [tx]);
  }

  // Only keep groups with > 1 row
  Array.from(groups.entries()).forEach(([k, v]) => {
    if (v.length < 2) groups.delete(k);
  });

  return groups;
}

/**
 * Delete duplicates, keeping the oldest row in each group.
 * Refuses to delete rows referenced by FK tables that don't have ON DELETE SET NULL.
 */
export async function dedupeUserTransactions(
  userId: string,
  opts: { mode?: 'strict' | 'loose'; dryRun?: boolean } = {}
): Promise<DedupeResult> {
  const supabase = createServiceClient();
  const mode = opts.mode || 'strict';
  const dryRun = !!opts.dryRun;

  const groups = await findDuplicateGroups(userId, mode);
  const idsToDelete: string[] = [];
  const blocked: Array<{ reason: string; transactionId: string }> = [];

  Array.from(groups.values()).forEach(rows => {
    // Keep oldest, mark rest for deletion
    const [, ...dupes] = rows;
    for (const dup of dupes) idsToDelete.push(dup.id);
  });

  if (idsToDelete.length === 0) {
    return { scanned: 0, duplicateGroups: 0, rowsDeleted: 0, blocked: [], dryRun };
  }

  // Block deletes that have FK refs in NO ACTION tables
  const safeIds: string[] = [];
  const checkChunks = chunk(idsToDelete, 200);
  for (const ids of checkChunks) {
    const [{ data: payslipRefs }, { data: pensionRefs }, { data: parentRefs }, { data: replacedRefs }] = await Promise.all([
      supabase.from('payslips').select('transaction_id').in('transaction_id', ids),
      supabase.from('pension_insurance').select('linked_transaction_id').in('linked_transaction_id', ids),
      supabase.from('transactions').select('parent_transaction_id').in('parent_transaction_id', ids),
      supabase.from('transactions').select('replaced_by_transaction_id').in('replaced_by_transaction_id', ids),
    ]);

    const blockedSet = new Set<string>();
    for (const r of payslipRefs || []) {
      if (r.transaction_id) {
        blockedSet.add(r.transaction_id);
        blocked.push({ reason: 'payslips_fk', transactionId: r.transaction_id });
      }
    }
    for (const r of pensionRefs || []) {
      if (r.linked_transaction_id) {
        blockedSet.add(r.linked_transaction_id);
        blocked.push({ reason: 'pension_insurance_fk', transactionId: r.linked_transaction_id });
      }
    }
    for (const r of parentRefs || []) {
      if (r.parent_transaction_id) {
        blockedSet.add(r.parent_transaction_id);
        blocked.push({ reason: 'tx_parent_fk', transactionId: r.parent_transaction_id });
      }
    }
    for (const r of replacedRefs || []) {
      if (r.replaced_by_transaction_id) {
        blockedSet.add(r.replaced_by_transaction_id);
        blocked.push({ reason: 'tx_replaced_by_fk', transactionId: r.replaced_by_transaction_id });
      }
    }

    for (const id of ids) {
      if (!blockedSet.has(id)) safeIds.push(id);
    }
  }

  if (dryRun || safeIds.length === 0) {
    return {
      scanned: idsToDelete.length,
      duplicateGroups: groups.size,
      rowsDeleted: 0,
      blocked,
      dryRun: true,
    };
  }

  // Delete in chunks to avoid hitting URL/payload limits
  let deleted = 0;
  for (const ids of chunk(safeIds, 200)) {
    const { error, count } = await supabase
      .from('transactions')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .in('id', ids);
    if (error) {
      console.error(`[dedupe] delete chunk failed: ${error.message}`);
      continue;
    }
    deleted += count || 0;
  }

  return {
    scanned: idsToDelete.length,
    duplicateGroups: groups.size,
    rowsDeleted: deleted,
    blocked,
    dryRun: false,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
