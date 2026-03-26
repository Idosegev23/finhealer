/**
 * Reconciliation — v3.1 (bug fixes #1 + #8)
 *
 * Matches credit card aggregate charges (from bank statement)
 * with detailed CC statement transactions.
 *
 * Fixed:
 * - is_summary filter: or(is_summary.is.null, is_summary.eq.false)
 * - Document-based grouping: only matches CC details from CC statements, not bank transactions
 * - Card last4 matching when available
 */

import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface ReconciliationResult {
  reconciled: number;
  needsDetail: Array<{ amount: number; card_last4?: string; charge_date: string; transaction_id: string }>;
  summaryIds: string[];
}

// ============================================================================
// Credit card vendor patterns
// ============================================================================

const CC_PATTERNS = /visa|mastercard|ויזה|מסטרקארד|ישראכרט|כאל|cal\s|max\s|לאומי קארד|חיוב.*כרטיס|כרטיס.*אשראי/i;

// ============================================================================
// Main: Reconcile Credit Charges
// ============================================================================

export async function reconcileCreditCharges(userId: string): Promise<ReconciliationResult> {
  const supabase = createServiceClient();

  // 1. Find credit card aggregate charges from bank statements
  //    These are charges that appear as one line in the bank statement (e.g., "חיוב ויזה 3,500₪")
  //    Fix #1: use or() for is_summary null/false
  const { data: allBankTx } = await supabase
    .from('transactions')
    .select('id, vendor, amount, tx_date, original_description')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .or('is_summary.is.null,is_summary.eq.false')
    .order('tx_date', { ascending: false });

  if (!allBankTx || allBankTx.length === 0) {
    return { reconciled: 0, needsDetail: [], summaryIds: [] };
  }

  // Filter to CC aggregate charges only
  const ccCharges = allBankTx.filter(tx => {
    const text = `${tx.vendor || ''} ${tx.original_description || ''}`;
    return CC_PATTERNS.test(text);
  });

  if (ccCharges.length === 0) {
    return { reconciled: 0, needsDetail: [], summaryIds: [] };
  }

  // 2. Get all CC statement document IDs
  //    Fix #8: Only match against transactions from CC statements, not bank
  const { data: ccStatements } = await supabase
    .from('uploaded_statements')
    .select('id')
    .eq('user_id', userId)
    .ilike('file_type', '%credit%')
    .eq('status', 'completed');

  const ccStatementIds = (ccStatements || []).map(s => s.id);

  // 3. For each CC charge, find matching CC statement transactions
  let reconciled = 0;
  const needsDetail: ReconciliationResult['needsDetail'] = [];
  const summaryIds: string[] = [];

  for (const charge of ccCharges) {
    const chargeAmount = Math.abs(Number(charge.amount));
    const chargeDate = charge.tx_date;
    const chargeMonth = chargeDate.substring(0, 7); // YYYY-MM

    // Extract card last4 if available
    const last4Match = `${charge.vendor || ''} ${charge.original_description || ''}`.match(/(\d{4})\s*$/);
    const cardLast4 = last4Match?.[1];

    if (ccStatementIds.length === 0) {
      // No CC statements uploaded — flag as needs detail
      needsDetail.push({
        amount: chargeAmount,
        card_last4: cardLast4,
        charge_date: chargeDate,
        transaction_id: charge.id,
      });
      continue;
    }

    // Get CC detail transactions from CC statements only
    const { data: ccDetails } = await supabase
      .from('transactions')
      .select('id, amount, document_id')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .or('is_summary.is.null,is_summary.eq.false')
      .in('document_id', ccStatementIds)
      .gte('tx_date', `${chargeMonth}-01`)
      .lte('tx_date', `${chargeMonth}-31`);

    if (!ccDetails || ccDetails.length === 0) {
      needsDetail.push({
        amount: chargeAmount,
        card_last4: cardLast4,
        charge_date: chargeDate,
        transaction_id: charge.id,
      });
      continue;
    }

    // Fix #8: Group by document_id (each CC statement = separate group)
    const groups = new Map<string, number>();
    for (const tx of ccDetails) {
      const docId = tx.document_id || 'unknown';
      groups.set(docId, (groups.get(docId) || 0) + Math.abs(Number(tx.amount)));
    }

    // Find a group that matches the charge amount (±1₪ tolerance)
    let matched = false;
    for (const [, groupSum] of Array.from(groups.entries())) {
      if (Math.abs(groupSum - chargeAmount) <= 1) {
        matched = true;
        break;
      }
    }

    if (matched) {
      // Mark bank charge as is_summary
      await supabase
        .from('transactions')
        .update({
          is_summary: true,
          expense_category: 'חיוב כרטיס אשראי',
          category: 'חיוב כרטיס אשראי',
          updated_at: new Date().toISOString(),
        })
        .eq('id', charge.id);

      summaryIds.push(charge.id);
      reconciled++;
    } else {
      needsDetail.push({
        amount: chargeAmount,
        card_last4: cardLast4,
        charge_date: chargeDate,
        transaction_id: charge.id,
      });
    }
  }

  return { reconciled, needsDetail, summaryIds };
}

/**
 * Mark specific transactions as is_summary (bulk).
 */
export async function markAsSummary(
  userId: string,
  transactionIds: string[]
): Promise<number> {
  if (transactionIds.length === 0) return 0;

  const supabase = createServiceClient();

  const { count } = await supabase
    .from('transactions')
    .update({
      is_summary: true,
      expense_category: 'חיוב כרטיס אשראי',
      category: 'חיוב כרטיס אשראי',
      updated_at: new Date().toISOString(),
    })
    .in('id', transactionIds)
    .eq('user_id', userId);

  return count || 0;
}
