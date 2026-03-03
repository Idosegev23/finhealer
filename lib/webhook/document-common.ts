// @ts-nocheck
import { safeParseDateToISO } from './utils';

// ============================================================================
// Document type labels (Hebrew)
// ============================================================================
export const DOC_TYPE_LABELS: Record<string, string> = {
  'bank': 'דוח בנק',
  'credit': 'דוח אשראי',
  'payslip': 'תלוש משכורת',
  'loan': 'דוח הלוואות',
  'mortgage': 'דוח משכנתא',
  'pension': 'דוח פנסיה',
  'pension_clearing': 'דוח מסלקה פנסיונית (כל הפנסיות!)',
  'insurance': 'דוח ביטוח',
  'har_bituach': 'דוח הר הביטוח (כל הביטוחים!)',
  'savings': 'דוח חסכונות',
  'investment': 'דוח השקעות',
};

// ============================================================================
// Detect document type from user state + filename
// ============================================================================
export function detectDocumentType(
  userState: { onboarding_state?: string; classification_context?: any } | null,
  fileName: string
): { documentType: string; documentTypeHebrew: string } {
  const currentState = userState?.onboarding_state;
  const explicitDocType = userState?.classification_context?.waitingForDocument;
  const lowerFileName = fileName.toLowerCase();

  let documentType = 'bank';

  if (explicitDocType && explicitDocType !== 'pending_type_selection') {
    documentType = explicitDocType;
  } else if (currentState === 'onboarding_income' || currentState === 'data_collection') {
    documentType = 'bank';
  }
  // === דוחות כוללים (עדיפות גבוהה!) ===
  else if (lowerFileName.includes('מסלקה') || lowerFileName.includes('clearing') ||
           lowerFileName.includes('פנסיוני') || lowerFileName.includes('pension_report')) {
    documentType = 'pension_clearing';
  }
  else if (lowerFileName.includes('הר הביטוח') || lowerFileName.includes('har') ||
           lowerFileName.includes('all_insurance') || lowerFileName.includes('כל הביטוחים')) {
    documentType = 'har_bituach';
  }
  // === דוחות רגילים ===
  else if (lowerFileName.includes('אשראי') || lowerFileName.includes('credit') ||
           lowerFileName.includes('ויזה') || lowerFileName.includes('ויזא') ||
           lowerFileName.includes('כאל') || lowerFileName.includes('מקס') ||
           lowerFileName.includes('visa') || lowerFileName.includes('mastercard') ||
           lowerFileName.includes('ישראכרט') || lowerFileName.includes('דיינרס')) {
    documentType = 'credit';
  }
  else if (lowerFileName.includes('בנק') || lowerFileName.includes('bank') ||
           lowerFileName.includes('עוש') || lowerFileName.includes('תנועות') ||
           lowerFileName.includes('חשבון')) {
    documentType = 'bank';
  }
  else if (lowerFileName.includes('תלוש') || lowerFileName.includes('משכורת') ||
           lowerFileName.includes('שכר') || lowerFileName.includes('payslip') ||
           lowerFileName.includes('salary')) {
    documentType = 'payslip';
  }
  else if (lowerFileName.includes('הלוואה') || lowerFileName.includes('loan') ||
           lowerFileName.includes('הלוואות')) {
    documentType = 'loan';
  }
  else if (lowerFileName.includes('משכנתא') || lowerFileName.includes('mortgage') ||
           lowerFileName.includes('דיור')) {
    documentType = 'mortgage';
  }
  else if (lowerFileName.includes('פנסיה') || lowerFileName.includes('pension') ||
           lowerFileName.includes('גמל') || lowerFileName.includes('השתלמות')) {
    documentType = 'pension';
  }
  else if (lowerFileName.includes('ביטוח') || lowerFileName.includes('insurance') ||
           lowerFileName.includes('פוליסה') || lowerFileName.includes('פרמיה')) {
    documentType = 'insurance';
  }
  else if (lowerFileName.includes('חסכון') || lowerFileName.includes('savings') ||
           lowerFileName.includes('פיקדון') || lowerFileName.includes('deposit')) {
    documentType = 'savings';
  }
  else if (lowerFileName.includes('השקעות') || lowerFileName.includes('investment') ||
           lowerFileName.includes('תיק') || lowerFileName.includes('portfolio') ||
           lowerFileName.includes('מניות') || lowerFileName.includes('ני"ע')) {
    documentType = 'investment';
  }

  return {
    documentType,
    documentTypeHebrew: DOC_TYPE_LABELS[documentType] || documentType,
  };
}

// ============================================================================
// Determine transaction type (income vs expense)
// ============================================================================
export function determineTransactionType(tx: any): 'income' | 'expense' {
  if (tx.type === 'income') return 'income';
  if (tx.type === 'expense') return 'expense';
  if (tx.income_category) return 'income';
  if (tx.expense_category || tx.expense_type) return 'expense';

  if (tx.balance_before !== undefined && tx.balance_after !== undefined) {
    const balanceBefore = typeof tx.balance_before === 'string'
      ? parseFloat(tx.balance_before.replace(/[^\d.-]/g, ''))
      : tx.balance_before;
    const balanceAfter = typeof tx.balance_after === 'string'
      ? parseFloat(tx.balance_after.replace(/[^\d.-]/g, ''))
      : tx.balance_after;
    if (!isNaN(balanceBefore) && !isNaN(balanceAfter)) {
      return balanceAfter > balanceBefore ? 'income' : 'expense';
    }
  }

  const amountStr = String(tx.amount || tx.original_amount || '');
  if (amountStr.includes('-') || amountStr.endsWith('-')) return 'expense';

  const desc = (tx.description || tx.vendor || '').toLowerCase();
  const expenseKeywords = ['חיוב', 'תשלום', 'ויזה', 'ויזא', 'מסטרקארד', 'משיכה', 'הו"ק', 'ארנונה', 'חשמל', 'מים', 'גז'];
  if (expenseKeywords.some(kw => desc.includes(kw))) return 'expense';

  const incomeKeywords = ['משכורת', 'שכר', 'העברה ל', 'זיכוי', 'החזר', 'קצבה', 'גמלה'];
  if (incomeKeywords.some(kw => desc.includes(kw))) return 'income';

  console.log(`⚠️ Could not determine type for: "${desc}" (${tx.amount}) - defaulting to expense`);
  return 'expense';
}

// ============================================================================
// Clean & parse AI JSON response
// ============================================================================
export function cleanAiJson(content: string): any {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let jsonStr = jsonMatch ? jsonMatch[0] : content;

    // Fix common AI JSON errors
    jsonStr = jsonStr.replace(/:\s*[\d.]+\s*-\s*null/g, ': null');
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    jsonStr = jsonStr.replace(/"null"/g, 'null');

    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('❌ JSON parse error:', parseError);
    console.log('📝 Raw content (first 500 chars):', content.substring(0, 500));
    console.log('📝 Raw content (last 300 chars):', content.substring(Math.max(0, content.length - 300)));

    // Try to recover truncated JSON
    try {
      let jsonStr = content.match(/\{[\s\S]*/)?.[0] || content;
      jsonStr = jsonStr.replace(/,\s*\{[^}]*$/s, '');
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      const openBrackets = (jsonStr.match(/\[/g) || []).length;
      const closeBrackets = (jsonStr.match(/\]/g) || []).length;
      jsonStr += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
      jsonStr += '}'.repeat(Math.max(0, openBraces - closeBraces));
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      const recovered = JSON.parse(jsonStr);
      console.log(`✅ JSON recovery succeeded: ${recovered.transactions?.length || 0} transactions salvaged`);
      return recovered;
    } catch {
      console.error('❌ JSON recovery also failed');
      return { document_type: 'unknown', transactions: [] };
    }
  }
}

// ============================================================================
// Normalize transactions: array or object → flat array with types
// ============================================================================
export function normalizeTransactions(ocrData: any): any[] {
  if (Array.isArray(ocrData.transactions)) {
    return ocrData.transactions.map((tx: any) => ({
      ...tx,
      type: determineTransactionType(tx),
    }));
  }

  if (ocrData.transactions && typeof ocrData.transactions === 'object') {
    const { income = [], expenses = [], loan_payments = [], savings_transfers = [] } = ocrData.transactions;
    return [
      ...income.map((tx: any) => ({ ...tx, type: 'income' })),
      ...expenses.map((tx: any) => ({ ...tx, type: 'expense' })),
      ...loan_payments.map((tx: any) => ({ ...tx, type: 'expense', expense_category: tx.expense_category || 'החזר הלוואה' })),
      ...savings_transfers.map((tx: any) => ({ ...tx, type: 'expense', expense_category: tx.expense_category || 'חיסכון' })),
    ];
  }

  return [];
}

// ============================================================================
// Save document record to uploaded_statements
// ============================================================================
export async function saveDocumentRecord(
  supabase: any,
  userId: string,
  opts: {
    fileName: string;
    downloadUrl: string;
    documentType: string;
    periodStart: string | null;
    periodEnd: string | null;
    transactionsExtracted: number;
    transactionsCreated: number;
  }
): Promise<string | null> {
  const { data: docRecord, error: docError } = await supabase
    .from('uploaded_statements')
    .insert({
      user_id: userId,
      file_name: opts.fileName,
      file_url: opts.downloadUrl,
      file_type: opts.documentType === 'credit' ? 'credit_statement' : 'bank_statement',
      document_type: opts.documentType,
      status: 'completed',
      processed: true,
      period_start: opts.periodStart,
      period_end: opts.periodEnd,
      transactions_extracted: opts.transactionsExtracted,
      transactions_created: opts.transactionsCreated,
    })
    .select('id')
    .single();

  if (docError) {
    console.error('❌ Error saving document:', docError);
    return null;
  }

  console.log(`✅ Document saved with id: ${docRecord.id}`);
  return docRecord.id;
}

// ============================================================================
// Calculate effective period from OCR data or transaction dates
// ============================================================================
export function calculateEffectivePeriod(
  ocrPeriodStart: Date | null,
  ocrPeriodEnd: Date | null,
  allTransactions: any[]
): { start: string | null; end: string | null } {
  let effectiveStart = ocrPeriodStart;
  let effectiveEnd = ocrPeriodEnd;

  if (!effectiveStart || !effectiveEnd) {
    const txDates = allTransactions
      .map((tx: any) => new Date(tx.tx_date || tx.date))
      .filter((d: Date) => !isNaN(d.getTime()));
    if (txDates.length > 0) {
      txDates.sort((a: Date, b: Date) => a.getTime() - b.getTime());
      if (!effectiveStart) effectiveStart = txDates[0];
      if (!effectiveEnd) effectiveEnd = txDates[txDates.length - 1];
      console.log(`📅 Period fallback from transactions: ${effectiveStart?.toISOString?.().split('T')[0]} - ${effectiveEnd?.toISOString?.().split('T')[0]}`);
    }
  }

  return {
    start: effectiveStart?.toISOString?.().split('T')[0] || null,
    end: effectiveEnd?.toISOString?.().split('T')[0] || null,
  };
}

// ============================================================================
// Post-document processing: state update, markDocumentAsUploaded, credit reconciliation
// ============================================================================
export async function postDocumentProcessing(
  supabase: any,
  userId: string,
  phoneNumber: string,
  opts: {
    documentId: string;
    documentType: string;
    batchId: string;
    allTransactions: any[];
    ocrData?: any;
    periodStart?: Date | null;
    periodEnd?: Date | null;
  }
): Promise<void> {
  // Link transactions to document
  await supabase
    .from('transactions')
    .update({ document_id: opts.documentId })
    .eq('batch_id', opts.batchId);

  // Update user state to classification
  await supabase
    .from('users')
    .update({ onboarding_state: 'classification', phase: 'data_collection' })
    .eq('id', userId);
  console.log(`✅ User state updated to classification`);

  // Mark missing_document as uploaded (for credit/bank)
  if (opts.documentType === 'credit' || opts.documentType === 'bank') {
    const { markDocumentAsUploaded } = await import('@/lib/conversation/classification-flow');

    let cardLast4: string | null = null;
    if (opts.documentType === 'credit') {
      for (const tx of opts.allTransactions) {
        const text = `${tx.vendor || ''} ${tx.description || ''}`;
        const cardMatch = text.match(/\d{4}$/);
        const starMatch = text.match(/\*{4}(\d{4})/);
        if (cardMatch) { cardLast4 = cardMatch[0]; break; }
        else if (starMatch) { cardLast4 = starMatch[1]; break; }
      }
    }

    await markDocumentAsUploaded(userId, opts.documentType, cardLast4, opts.documentId);
  }

  // Credit card linking: link skipped transactions
  if (opts.documentType === 'credit') {
    const cardLast4Set = new Set<string>();
    for (const tx of opts.allTransactions) {
      const text = `${tx.vendor || ''} ${tx.description || ''}`;
      const cardMatch = text.match(/\d{4}$/);
      if (cardMatch) cardLast4Set.add(cardMatch[0]);
      const starMatch = text.match(/\*{4}(\d{4})/);
      if (starMatch) cardLast4Set.add(starMatch[1]);
    }

    if (cardLast4Set.size > 0) {
      const cardNumbers = Array.from(cardLast4Set);
      console.log(`💳 Found credit card numbers: ${cardNumbers.join(', ')}`);

      for (const cardLast4 of cardNumbers) {
        const { data: skippedTx } = await supabase
          .from('transactions')
          .select('id, vendor, amount')
          .eq('user_id', userId)
          .eq('status', 'needs_credit_detail')
          .or(`vendor.ilike.%${cardLast4}%,vendor.ilike.%ויזה ${cardLast4}%,vendor.ilike.%visa ${cardLast4}%`);

        if (skippedTx && skippedTx.length > 0) {
          console.log(`🔗 Found ${skippedTx.length} skipped transactions for card ${cardLast4}`);

          await supabase
            .from('transactions')
            .update({ status: 'confirmed', notes: `קושר לדוח אשראי ${cardLast4}` })
            .eq('user_id', userId)
            .eq('status', 'needs_credit_detail')
            .or(`vendor.ilike.%${cardLast4}%,vendor.ilike.%ויזה ${cardLast4}%,vendor.ilike.%visa ${cardLast4}%`);

          console.log(`✅ Linked ${skippedTx.length} transactions to credit statement`);
        }
      }
    }
  }

  // Credit reconciliation
  if (opts.documentType === 'credit') {
    try {
      const { matchCreditTransactions } = await import('@/lib/reconciliation/credit-matcher');
      await matchCreditTransactions(supabase, userId, opts.documentId, 'credit_statement');
      console.log('✅ Credit reconciliation completed');
    } catch (reconErr) {
      console.error('⚠️ Credit reconciliation error:', reconErr);
    }
  }

  // Period coverage check
  await new Promise(resolve => setTimeout(resolve, 100));

  const { getUserPeriodCoverage, calculateCoverage } = await import('@/lib/documents/period-tracker');
  const periodCoverage = await getUserPeriodCoverage(userId);

  let actualCoverage = periodCoverage;
  if (opts.periodStart && opts.periodEnd && periodCoverage.totalMonths === 0) {
    console.log('⚠️ Document not in coverage yet - calculating manually');
    actualCoverage = calculateCoverage([{
      start: opts.periodStart,
      end: opts.periodEnd,
      source: 'bank' as const,
      documentType: opts.documentType,
      uploadedAt: new Date(),
    }]);
  }

  console.log(`📊 Period coverage: ${actualCoverage.totalMonths} months, covered: ${actualCoverage.coveredMonths.join(', ')}, missing: ${actualCoverage.missingMonths.join(', ')}`);

  // Notify via φ Router
  try {
    const { onDocumentProcessed } = await import('@/lib/conversation/phi-router');
    await onDocumentProcessed(userId, phoneNumber);
    console.log('✅ φ Router sent document summary message');
  } catch (routerErr) {
    console.error('❌ onDocumentProcessed failed (document was saved):', routerErr);
    // Document is saved — don't let router failure break the flow
    const { getGreenAPIClient } = await import('@/lib/greenapi/client');
    try {
      await getGreenAPIClient().sendMessage({
        phoneNumber,
        message: `✅ הדוח התקבל!\n\nכתוב *"נתחיל"* כדי לסדר את ההוצאות וההכנסות.`,
      });
    } catch { /* best effort */ }
  }

  // Save missing documents from OCR
  if (opts.ocrData?.missing_documents?.length > 0) {
    for (const missingDoc of opts.ocrData.missing_documents) {
      await supabase
        .from('missing_documents')
        .upsert({
          user_id: userId,
          document_type: missingDoc.type,
          card_last_4: missingDoc.card_last_4 || null,
          charge_date: missingDoc.charge_date || missingDoc.payment_date || missingDoc.salary_date || null,
          period_start: missingDoc.period_start || null,
          period_end: missingDoc.period_end || null,
          expected_amount: missingDoc.charge_amount || missingDoc.salary_amount || missingDoc.payment_amount || null,
          description: missingDoc.description || null,
          status: 'pending',
          priority: missingDoc.type === 'credit' ? 10 : (missingDoc.type === 'payslip' ? 5 : 1),
        }, {
          onConflict: 'user_id,document_type,card_last_4',
          ignoreDuplicates: true,
        });
    }
    console.log(`📋 Saved ${opts.ocrData.missing_documents.length} missing documents requests`);
  }
}
