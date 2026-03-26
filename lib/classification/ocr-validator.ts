/**
 * OCR Validator — v3.1
 *
 * Validates OCR output before classification.
 * Flags anomalies without blocking the flow.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type OCRFlag =
  | 'refund'             // Negative amount = likely refund/credit
  | 'high_amount_review' // > 50,000₪ — probably wrong
  | 'date_out_of_range'  // Date outside document period
  | 'missing_vendor'     // Empty vendor
  | 'zero_amount'        // Amount = 0
  | 'total_mismatch';    // Sum of transactions ≠ reported total

export interface ValidatedTransaction {
  id?: string;
  vendor: string;
  amount: number;
  date: string;
  original_description?: string;
  flags: OCRFlag[];
}

export interface ValidationResult {
  validTransactions: ValidatedTransaction[];
  flaggedTransactions: ValidatedTransaction[];
  documentStatus: 'new' | 'exact_duplicate' | 'same_period';
  totalMismatch: boolean;
  totalMismatchPercent?: number;
}

// ============================================================================
// Validate Transactions
// ============================================================================

export function validateOCRTransactions(
  transactions: Array<{
    vendor?: string;
    amount?: number;
    date?: string;
    original_description?: string;
  }>,
  documentMetadata?: {
    period_start?: string;
    period_end?: string;
    reported_total?: number;
  }
): { valid: ValidatedTransaction[]; flagged: ValidatedTransaction[]; totalMismatch: boolean } {
  const valid: ValidatedTransaction[] = [];
  const flagged: ValidatedTransaction[] = [];

  for (const tx of transactions) {
    const flags: OCRFlag[] = [];
    const amount = Number(tx.amount) || 0;
    const vendor = (tx.vendor || '').trim();
    const date = tx.date || '';

    // Check flags
    if (amount < 0) flags.push('refund');
    if (Math.abs(amount) > 50000) flags.push('high_amount_review');
    if (amount === 0) flags.push('zero_amount');
    if (!vendor) flags.push('missing_vendor');

    // Date range check
    if (date && documentMetadata?.period_start && documentMetadata?.period_end) {
      if (date < documentMetadata.period_start || date > documentMetadata.period_end) {
        flags.push('date_out_of_range');
      }
    }

    const validated: ValidatedTransaction = {
      vendor,
      amount,
      date,
      original_description: tx.original_description,
      flags,
    };

    if (flags.length > 0 && !flags.every(f => f === 'refund')) {
      // Refund-only flags are fine, not truly "flagged"
      flagged.push(validated);
    } else {
      valid.push(validated);
    }
  }

  // Total mismatch check
  let totalMismatch = false;
  if (documentMetadata?.reported_total) {
    const sum = transactions.reduce((s, tx) => s + Math.abs(Number(tx.amount) || 0), 0);
    const diff = Math.abs(sum - documentMetadata.reported_total);
    const pct = documentMetadata.reported_total > 0 ? diff / documentMetadata.reported_total : 0;
    totalMismatch = pct > 0.05; // >5% gap
  }

  return { valid, flagged, totalMismatch };
}

// ============================================================================
// Detect Duplicate Documents
// ============================================================================

export function computeFileHash(fileBuffer: Buffer | ArrayBuffer): string {
  const buffer = fileBuffer instanceof ArrayBuffer ? Buffer.from(fileBuffer) : fileBuffer;
  return createHash('sha256').update(buffer).digest('hex');
}

export async function detectDuplicateDocument(
  userId: string,
  fileHash: string,
  month?: string,
  accountId?: string
): Promise<{
  status: 'new' | 'exact_duplicate' | 'same_period';
  existingDocumentId?: string;
}> {
  const supabase = createServiceClient();

  // Check exact hash match
  const { data: hashMatch } = await supabase
    .from('uploaded_statements')
    .select('id')
    .eq('user_id', userId)
    .eq('file_hash', fileHash)
    .limit(1)
    .maybeSingle();

  if (hashMatch) {
    return { status: 'exact_duplicate', existingDocumentId: hashMatch.id };
  }

  // Check same period + same account
  if (month) {
    let query = supabase
      .from('uploaded_statements')
      .select('id')
      .eq('user_id', userId)
      .eq('statement_month', month)
      .eq('status', 'completed');

    if (accountId) {
      query = query.eq('financial_account_id', accountId);
    }

    const { data: periodMatch } = await query.limit(1).maybeSingle();

    if (periodMatch) {
      return { status: 'same_period', existingDocumentId: periodMatch.id };
    }
  }

  return { status: 'new' };
}

// ============================================================================
// Replace Document (delete old transactions + re-process)
// ============================================================================

export async function replaceDocument(
  userId: string,
  oldDocumentId: string
): Promise<number> {
  const supabase = createServiceClient();

  // Delete transactions linked to old document
  const { count } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', userId)
    .eq('document_id', oldDocumentId);

  // Mark old document as replaced
  await supabase
    .from('uploaded_statements')
    .update({ status: 'replaced', updated_at: new Date().toISOString() })
    .eq('id', oldDocumentId);

  return count || 0;
}
