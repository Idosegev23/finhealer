/**
 * Credit Card Reconciliation Matcher
 *
 * מתאים בין תנועות סיכום של כרטיסי אשראי בדוח בנק
 * לבין הפירוט המלא מדוח האשראי, ומסמן את הכפילויות.
 *
 * לוגיקה:
 * 1. כשמעבדים דוח אשראי - מחפשים תנועת summary תואמת בבנק
 * 2. שתי שיטות: billing_info (מדויק) או sum-matching (fallback)
 * 3. מסמנים is_summary=true על חיוב הבנק (לא מוחקים!)
 */

// Israeli credit card companies - used to detect CC aggregate charges in bank statements
const CC_COMPANY_PATTERNS = [
  // Max (מקס)
  'מקס', 'max', 'מקס איט',
  // Isracard (ישראכרט)
  'ישראכרט', 'isracard',
  // Cal (כאל)
  'כאל', 'cal',
  // American Express (אמריקן אקספרס)
  'אמריקן אקספרס', 'אמריקן', 'amex', 'american express',
  // Visa (ויזה)
  'ויזה', 'ויזא', 'visa',
  // Mastercard
  'מסטרקארד', 'mastercard', 'מאסטרקארד',
  // Diners
  'דיינרס', 'diners',
  // Generic credit card
  'כרטיס אשראי', 'חיוב כרטיס', 'לאומי קארד', 'leumi card',
  // Poalim cards
  'פועלים אשראי', 'ישראכארט',
];

/**
 * Check if a vendor name matches a known credit card company
 */
export function isCreditCardCompany(vendor: string | null | undefined): boolean {
  if (!vendor) return false;
  const v = vendor.toLowerCase().trim();
  return CC_COMPANY_PATTERNS.some(pattern => v.includes(pattern.toLowerCase()));
}

/**
 * Main entry: match credit card statement against bank transactions
 */
export async function matchCreditTransactions(
  supabase: any,
  userId: string,
  documentId: string,
  documentType: string
) {
  if (!documentType.includes('credit')) return;

  console.log('🔗 Starting credit card reconciliation...');

  // Strategy 1: Use billing_info if available (most accurate)
  const matched = await matchViaBillingInfo(supabase, userId, documentId);

  if (!matched) {
    // Strategy 2: Sum credit transactions and match against bank CC charges
    await matchViaSumComparison(supabase, userId, documentId);
  }
}

/**
 * Strategy 1: Match using billing_info from the credit card statement
 */
async function matchViaBillingInfo(
  supabase: any,
  userId: string,
  creditDocId: string
): Promise<boolean> {
  const { data: creditDoc } = await supabase
    .from('uploaded_statements')
    .select('extracted_data, statement_month')
    .eq('id', creditDocId)
    .single();

  if (!creditDoc) return false;

  const billingInfo = creditDoc.extracted_data?.billing_info;
  if (!billingInfo?.next_billing_date || !billingInfo?.next_billing_amount) {
    console.log('⚠️ No billing_info — will try sum comparison');
    return false;
  }

  const { next_billing_date, next_billing_amount, card_last_digits } = billingInfo;

  // Parse date (DD/MM/YYYY or YYYY-MM-DD)
  let billingDateISO: string | null = null;
  if (next_billing_date.includes('/')) {
    const parts = next_billing_date.split('/');
    if (parts.length === 3) {
      billingDateISO = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  } else if (next_billing_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    billingDateISO = next_billing_date;
  }

  if (!billingDateISO) {
    console.log('⚠️ Invalid billing date format:', next_billing_date);
    return false;
  }

  console.log(`💳 Billing info: Date=${billingDateISO}, Amount=${next_billing_amount}, Card=${card_last_digits || 'N/A'}`);

  const match = await findBankCCCharge(supabase, userId, next_billing_amount, billingDateISO, card_last_digits, 3);

  if (match) {
    await markAsSummary(supabase, match.id, creditDocId);
    return true;
  }

  return false;
}

/**
 * Strategy 2: Sum all credit transactions and find matching bank charge
 */
async function matchViaSumComparison(
  supabase: any,
  userId: string,
  creditDocId: string
) {
  // Get all transactions from this credit statement
  const { data: creditTxs } = await supabase
    .from('transactions')
    .select('amount, tx_date')
    .eq('user_id', userId)
    .eq('document_id', creditDocId)
    .eq('type', 'expense');

  if (!creditTxs || creditTxs.length === 0) {
    console.log('⚠️ No credit transactions found for document');
    return;
  }

  // Sum all expenses from this CC statement
  const totalAmount = creditTxs.reduce((sum: number, tx: any) => sum + (parseFloat(tx.amount) || 0), 0);

  // Find the date range of the credit transactions
  const dates = creditTxs.map((tx: any) => tx.tx_date).filter(Boolean).sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  if (!firstDate || totalAmount <= 0) {
    console.log('⚠️ Cannot determine credit statement period or amount');
    return;
  }

  // The bank charge typically appears at the end of the billing cycle or start of next month
  // Search in a wider window: from the last CC transaction date to +15 days after
  const searchStart = lastDate;
  const endDate = new Date(lastDate);
  endDate.setDate(endDate.getDate() + 15);
  const searchEnd = endDate.toISOString().split('T')[0];

  console.log(`📊 Sum matching: Total=${totalAmount.toFixed(2)} ₪, CC period=${firstDate} to ${lastDate}, Search=${searchStart} to ${searchEnd}`);

  // Find bank CC charges in this window that match the sum (±3%)
  const tolerance = totalAmount * 0.03;
  const minAmount = totalAmount - tolerance;
  const maxAmount = totalAmount + tolerance;

  const { data: bankCharges } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('is_source_transaction', true)
    .or('is_summary.is.null,is_summary.eq.false')
    .gte('amount', minAmount)
    .lte('amount', maxAmount)
    .gte('tx_date', searchStart)
    .lte('tx_date', searchEnd);

  if (!bankCharges || bankCharges.length === 0) {
    console.log('⚠️ No matching bank charge found for sum comparison');
    return;
  }

  // Filter for known CC company vendors
  const ccCharges = bankCharges.filter((tx: any) => isCreditCardCompany(tx.vendor));

  if (ccCharges.length === 0) {
    // Also check transactions with category 'כרטיס אשראי' or payment_method hints
    const fallbackCharges = bankCharges.filter((tx: any) =>
      tx.category === 'כרטיס אשראי' ||
      tx.expense_category === 'כרטיס אשראי' ||
      tx.notes?.includes('כרטיס') ||
      tx.needs_details === true
    );

    if (fallbackCharges.length === 0) {
      console.log('⚠️ Found amount matches but no CC company vendors');
      return;
    }

    // Use closest amount match
    const best = findClosestMatch(fallbackCharges, totalAmount);
    await markAsSummary(supabase, best.id, creditDocId);
    return;
  }

  // Use closest amount match among CC charges
  const best = findClosestMatch(ccCharges, totalAmount);
  await markAsSummary(supabase, best.id, creditDocId);
}

/**
 * Find a bank CC aggregate charge matching the given amount and date
 */
async function findBankCCCharge(
  supabase: any,
  userId: string,
  amount: number,
  dateISO: string,
  cardLast4: string | undefined,
  dayRange: number
): Promise<any | null> {
  const tolerance = amount * 0.02;
  const minAmount = amount - tolerance;
  const maxAmount = amount + tolerance;

  const d = new Date(dateISO);
  const minDate = new Date(d);
  minDate.setDate(minDate.getDate() - dayRange);
  const maxDate = new Date(d);
  maxDate.setDate(maxDate.getDate() + dayRange);

  const { data: candidates } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('is_source_transaction', true)
    .or('is_summary.is.null,is_summary.eq.false')
    .gte('amount', minAmount)
    .lte('amount', maxAmount)
    .gte('tx_date', minDate.toISOString().split('T')[0])
    .lte('tx_date', maxDate.toISOString().split('T')[0]);

  if (!candidates || candidates.length === 0) return null;

  // Prefer CC company vendor match
  const ccMatches = candidates.filter((tx: any) => {
    if (!isCreditCardCompany(tx.vendor)) return false;
    if (cardLast4 && tx.vendor && !tx.vendor.includes(cardLast4) && tx.card_number_last4 !== cardLast4) {
      return false;
    }
    return true;
  });

  if (ccMatches.length > 0) {
    return findClosestMatch(ccMatches, amount);
  }

  // Fallback: any transaction with CC-like category or needs_details flag
  const fallback = candidates.filter((tx: any) =>
    tx.category === 'כרטיס אשראי' ||
    tx.needs_details === true ||
    tx.payment_method === 'credit_card'
  );

  return fallback.length > 0 ? findClosestMatch(fallback, amount) : null;
}

/**
 * Find the transaction with the closest amount match
 */
function findClosestMatch(transactions: any[], targetAmount: number): any {
  let best = transactions[0];
  let bestDiff = Math.abs(parseFloat(best.amount) - targetAmount);

  for (const tx of transactions) {
    const diff = Math.abs(parseFloat(tx.amount) - targetAmount);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = tx;
    }
  }

  return best;
}

/**
 * Mark a bank transaction as summary (DON'T delete — just hide from aggregations)
 */
async function markAsSummary(
  supabase: any,
  bankTxId: string,
  creditDocId: string
) {
  const { error } = await supabase
    .from('transactions')
    .update({
      is_summary: true,
      has_details: true,
      reconciliation_status: 'matched',
      notes: 'חיוב כרטיס אשראי - מוצג בפירוט מדוח האשראי',
    })
    .eq('id', bankTxId);

  if (error) {
    console.error('Error marking as summary:', error);
    return;
  }

  console.log(`✅ Marked bank transaction ${bankTxId} as summary (is_summary=true)`);

  // Link credit transactions to bank document
  const { data: creditTxs } = await supabase
    .from('transactions')
    .select('id')
    .eq('document_id', creditDocId);

  if (creditTxs && creditTxs.length > 0) {
    await supabase
      .from('transactions')
      .update({ reconciliation_status: 'matched' })
      .eq('document_id', creditDocId);

    console.log(`✅ Reconciliation complete! Marked summary, linked ${creditTxs.length} detail transactions`);
  }
}

/**
 * Retroactive deduplication: scan ALL user transactions for CC double-counting
 * Call this when user reports inflated expenses, or after uploading multiple documents
 */
export async function retroactiveDedup(
  supabase: any,
  userId: string
): Promise<{ matched: number; details: string[] }> {
  const results: string[] = [];
  let matchCount = 0;

  // 1. Get all credit card documents
  const { data: creditDocs } = await supabase
    .from('uploaded_statements')
    .select('id, statement_month, extracted_data, file_type, document_type')
    .eq('user_id', userId)
    .or('file_type.ilike.%credit%,document_type.ilike.%credit%');

  if (!creditDocs || creditDocs.length === 0) {
    return { matched: 0, details: ['No credit card documents found'] };
  }

  // 2. For each credit doc, check if reconciliation was already done
  for (const doc of creditDocs) {
    // Check if transactions from this doc are already reconciled
    const { data: reconciledTxs } = await supabase
      .from('transactions')
      .select('id')
      .eq('document_id', doc.id)
      .eq('reconciliation_status', 'matched')
      .limit(1);

    if (reconciledTxs && reconciledTxs.length > 0) {
      results.push(`Doc ${doc.id} (${doc.statement_month}): already reconciled`);
      continue;
    }

    // Try billing_info match first
    const billingInfo = doc.extracted_data?.billing_info;
    if (billingInfo?.next_billing_amount && billingInfo?.next_billing_date) {
      let dateISO: string | null = null;
      const d = billingInfo.next_billing_date;
      if (d.includes('/')) {
        const p = d.split('/');
        if (p.length === 3) dateISO = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
      } else if (d.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dateISO = d;
      }

      if (dateISO) {
        const match = await findBankCCCharge(
          supabase, userId,
          billingInfo.next_billing_amount,
          dateISO,
          billingInfo.card_last_digits,
          5
        );
        if (match) {
          await markAsSummary(supabase, match.id, doc.id);
          matchCount++;
          results.push(`Doc ${doc.id}: matched via billing_info → bank tx ${match.id} (${match.vendor} ${match.amount}₪)`);
          continue;
        }
      }
    }

    // Fallback: sum comparison
    const { data: creditTxs } = await supabase
      .from('transactions')
      .select('amount, tx_date')
      .eq('user_id', userId)
      .eq('document_id', doc.id)
      .eq('type', 'expense');

    if (!creditTxs || creditTxs.length === 0) {
      results.push(`Doc ${doc.id}: no expense transactions found`);
      continue;
    }

    const total = creditTxs.reduce((s: number, t: any) => s + (parseFloat(t.amount) || 0), 0);
    if (total <= 0) continue;

    // Find matching bank CC charge by scanning all bank source transactions
    const tolerance = total * 0.03;
    const { data: bankCCCharges } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .eq('is_source_transaction', true)
      .or('is_summary.is.null,is_summary.eq.false')
      .gte('amount', total - tolerance)
      .lte('amount', total + tolerance);

    if (!bankCCCharges || bankCCCharges.length === 0) {
      results.push(`Doc ${doc.id}: no matching bank charge for sum ${total.toFixed(0)}₪`);
      continue;
    }

    const ccMatch = bankCCCharges.find((tx: any) => isCreditCardCompany(tx.vendor));
    if (ccMatch) {
      await markAsSummary(supabase, ccMatch.id, doc.id);
      matchCount++;
      results.push(`Doc ${doc.id}: matched via sum ${total.toFixed(0)}₪ → bank tx ${ccMatch.id} (${ccMatch.vendor} ${ccMatch.amount}₪)`);
    } else {
      results.push(`Doc ${doc.id}: amount matches found but no CC vendor (${bankCCCharges.map((t: any) => t.vendor).join(', ')})`);
    }
  }

  // 3. Also scan for unmatched CC charges that look like duplicates
  // Find all bank transactions from CC companies that aren't yet marked as summary
  const { data: unmatchedCCCharges } = await supabase
    .from('transactions')
    .select('id, vendor, amount, tx_date, document_id')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('is_source_transaction', true)
    .or('is_summary.is.null,is_summary.eq.false');

  if (unmatchedCCCharges) {
    for (const charge of unmatchedCCCharges) {
      if (!isCreditCardCompany(charge.vendor)) continue;

      // Check if there are detailed CC transactions in the same month with similar total
      const chargeDate = new Date(charge.tx_date);
      const monthStart = new Date(chargeDate.getFullYear(), chargeDate.getMonth() - 1, 1).toISOString().split('T')[0];
      const monthEnd = new Date(chargeDate.getFullYear(), chargeDate.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data: detailTxs } = await supabase
        .from('transactions')
        .select('amount, document_id')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .eq('is_source_transaction', false)
        .gte('tx_date', monthStart)
        .lte('tx_date', monthEnd);

      if (!detailTxs || detailTxs.length === 0) continue;

      // Group by document_id and check if any group sums to this charge amount
      const byDoc: Record<string, number> = {};
      for (const tx of detailTxs) {
        const key = tx.document_id || 'none';
        byDoc[key] = (byDoc[key] || 0) + (parseFloat(tx.amount) || 0);
      }

      const chargeAmount = parseFloat(charge.amount);
      for (const [docId, docTotal] of Object.entries(byDoc)) {
        if (Math.abs(docTotal - chargeAmount) / chargeAmount < 0.05) {
          // Found a match!
          await markAsSummary(supabase, charge.id, docId !== 'none' ? docId : charge.document_id);
          matchCount++;
          results.push(`Scan: ${charge.vendor} ${chargeAmount.toFixed(0)}₪ matched detail sum ${docTotal.toFixed(0)}₪ from doc ${docId}`);
          break;
        }
      }
    }
  }

  return { matched: matchCount, details: results };
}
