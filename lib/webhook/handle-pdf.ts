// @ts-nocheck
import { NextResponse } from 'next/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import type { WebhookContext } from './types';
import { safeParseDateToISO, startProgressUpdates, safeFetch } from './utils';
import {
  detectDocumentType,
  cleanAiJson,
  normalizeTransactions,
  saveDocumentRecord,
  calculateEffectivePeriod,
  postDocumentProcessing,
} from './document-common';

/**
 * Handle PDF documents: loan docs, bank/credit statements, payslips, etc.
 */
export async function handlePdf(
  ctx: WebhookContext,
  downloadUrl: string,
  fileName: string
): Promise<NextResponse> {
  const { userData, phoneNumber, supabase } = ctx;
  const greenAPI = getGreenAPIClient();

  // Detect document type from user state + filename
  const { data: userState } = await supabase
    .from('users')
    .select('onboarding_state, classification_context')
    .eq('id', userData.id)
    .single();

  const currentState = userState?.onboarding_state;

  // Special case: loan documents for consolidation
  if (currentState === 'waiting_for_loan_docs') {
    console.log('📄 Loan document received for consolidation');

    const { receiveLoanDocument } = await import('@/lib/loans/consolidation-handler');
    const response = await receiveLoanDocument(userData.id, phoneNumber, downloadUrl, fileName);

    await greenAPI.sendMessage({ phoneNumber, message: response });

    // Check if all documents received
    const { data: updatedRequest } = await supabase
      .from('loan_consolidation_requests')
      .select('id, status, documents_received, documents_needed')
      .eq('user_id', userData.id)
      .eq('status', 'documents_received')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (updatedRequest) {
      const { sendLeadToAdvisor } = await import('@/lib/loans/lead-generator');
      await sendLeadToAdvisor(updatedRequest.id);

      await greenAPI.sendMessage({
        phoneNumber,
        message: `✅ *הבקשה נשלחה לגדי!*\n\n` +
          `הוא יבדוק את המצב שלך ויחזור אליך בהקדם.\n\n` +
          `בינתיים, בוא נמשיך לנתח את ההתנהגות הפיננסית שלך 📊`,
      });

      // Clean loanConsolidation from context
      const { data: ctxUser } = await supabase
        .from('users')
        .select('classification_context')
        .eq('id', userData.id)
        .single();

      const existingCtx = ctxUser?.classification_context || {};
      const { loanConsolidation: _, ...restCtx } = existingCtx as any;

      await supabase
        .from('users')
        .update({
          onboarding_state: 'behavior',
          phase: 'behavior',
          classification_context: Object.keys(restCtx).length > 0 ? restCtx : null,
        })
        .eq('id', userData.id);
    }

    return NextResponse.json({ status: 'loan_document_received' });
  }

  // Regular document processing
  const { documentType, documentTypeHebrew } = detectDocumentType(userState, fileName);

  console.log(`📋 Document type detected: ${documentType} (state: ${currentState}, fileName: ${fileName})`);

  await greenAPI.sendMessage({
    phoneNumber,
    message: `📄 קיבלתי ${documentTypeHebrew}!\n\nמתחיל לנתח... זה יקח כדקה-שתיים.`,
  });

  const progressUpdater = startProgressUpdates(greenAPI, phoneNumber);

  try {
    // Download PDF (with timeout + status check)
    const pdfResponse = await safeFetch(downloadUrl, 60_000); // 60s for large PDFs
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const buffer = Buffer.from(pdfBuffer);

    console.log(`🤖 Starting PDF analysis (type: ${documentType}) with Gemini Flash...`);
    console.log(`[Webhook] PDF_ANALYSIS_START: docType=${documentType}, fileSize=${buffer.length} bytes, fileName=${fileName}`);
    const pdfStartTime = Date.now();

    // Load categories and get prompt
    const { getPromptForDocumentType } = await import('@/lib/ai/document-prompts');
    let expenseCategories: Array<{name: string; expense_type: string; category_group: string}> = [];

    if (documentType === 'credit' || documentType === 'bank') {
      const { data: categories } = await supabase
        .from('expense_categories')
        .select('name, expense_type, category_group')
        .eq('is_active', true);
      expenseCategories = categories || [];
      console.log(`📋 Loaded ${expenseCategories.length} expense categories`);
    }

    const prompt = getPromptForDocumentType(
      documentType === 'credit' ? 'credit_statement' :
      documentType === 'bank' ? 'bank_statement' :
      documentType,
      null,
      expenseCategories
    );

    console.log(`📝 Using prompt for document type: ${documentType} (${prompt.length} chars)`);

    // Gemini Flash Vision - direct PDF analysis
    let content = '';
    try {
      console.log('🔄 Analyzing PDF with Gemini Flash...');
      const base64Pdf = buffer.toString('base64');
      const { chatWithGeminiProVision } = await import('@/lib/ai/gemini-client');

      const aiPromise = chatWithGeminiProVision(base64Pdf, 'application/pdf', prompt);
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('PDF_AI_TIMEOUT')), 240000)
      );
      content = await Promise.race([aiPromise, timeoutPromise]);

      console.log('✅ Gemini Flash PDF analysis succeeded');
      console.log(`[Webhook] PDF_ANALYSIS_DONE: time=${Date.now() - pdfStartTime}ms, resultLength=${content.length} chars`);
    } catch (geminiError: any) {
      if (geminiError.message === 'PDF_AI_TIMEOUT') {
        console.error('⏱️ PDF AI call timed out after 240 seconds');
        progressUpdater.stop();
        await greenAPI.sendMessage({
          phoneNumber,
          message: `⏱️ המסמך גדול מדי ולוקח יותר מדי זמן לנתח.\n\nנסה לשלוח מסמך קצר יותר (עד 3 חודשים), או צלם את העמודים הרלוונטיים.`,
        });
        return NextResponse.json({ status: 'success', message: 'pdf timeout handled' });
      }
      console.log(`❌ Gemini Flash failed: ${geminiError.message}`);
      throw geminiError;
    }

    console.log('🎯 PDF OCR Result:', content);

    const ocrData = cleanAiJson(content);
    const allTransactions = normalizeTransactions(ocrData);

    const incomeCount = allTransactions.filter(tx => tx.type === 'income').length;
    const expenseCount = allTransactions.filter(tx => tx.type === 'expense').length;
    console.log(`📊 Parsed ${allTransactions.length} transactions (income: ${incomeCount}, expenses: ${expenseCount})`);

    if (allTransactions.length === 0) {
      progressUpdater.stop();
      await greenAPI.sendMessage({
        phoneNumber,
        message: 'לא הצלחתי לזהות תנועות ב-PDF 😕\n\nנסה לצלם את המסך או כתוב את הפרטים ידנית.',
      });
      return NextResponse.json({ status: 'no_data' });
    }

    // Duplicate check
    const { checkForDuplicateTransactions } = await import('@/lib/documents/period-tracker');
    const duplicateCheck = await checkForDuplicateTransactions(userData.id, allTransactions);

    if (duplicateCheck.isDuplicate) {
      console.log(`⚠️ Duplicate document detected! Overlap: ${duplicateCheck.overlapPercent}%`);
      progressUpdater.stop();
      await greenAPI.sendMessage({
        phoneNumber,
        message: `⚠️ שים לב - נראה שהמסמך הזה כבר הועלה!\n\nזיהיתי ${duplicateCheck.overlapPercent}% חפיפה עם תנועות קיימות.\n\n${duplicateCheck.overlappingPeriod ? `תקופה חופפת: ${duplicateCheck.overlappingPeriod}` : ''}\n\nרוצה להעלות מסמך אחר?`,
      });
      return NextResponse.json({ status: 'duplicate_detected' });
    }

    let partialOverlapWarning = '';
    if (duplicateCheck.hasPartialOverlap) {
      console.log(`⚠️ Partial overlap detected: ${duplicateCheck.overlapPercent}%`);
      partialOverlapWarning = `\n\n⚠️ *שים לב:* ${duplicateCheck.overlapPercent}% מהתנועות כבר קיימות במערכת.\nייתכן שחלק מהמסמך כבר הועלה קודם.`;
    }

    // Auto-detect financial account from extracted data
    let financialAccountId: string | null = null;
    try {
      const { detectAccountFromDocument } = await import('@/lib/services/AccountService');
      financialAccountId = await detectAccountFromDocument(supabase, userData.id, documentType, ocrData);
      if (financialAccountId) {
        console.log(`🏦 WA: Linked to account: ${financialAccountId}`);
      }
    } catch (accErr) {
      console.warn('⚠️ WA account detection failed (non-fatal):', accErr);
    }

    // Save transactions one-by-one with per-row dedup
    const pendingBatchId = `batch_${Date.now()}_${userData.id.substring(0, 8)}`;
    const insertedIds: string[] = [];
    const insertErrors: any[] = [];
    const duplicateSuspects: Array<{ vendor: string; amount: number; date: string }> = [];

    console.log(`💾 Saving ${allTransactions.length} transactions with batch_id: ${pendingBatchId}`);

    for (const tx of allTransactions) {
      const txDate = safeParseDateToISO(tx.date);
      const txType = tx.type || 'expense';
      const category = tx.expense_category || tx.income_category || tx.category ||
        (txType === 'income' ? 'הכנסה אחרת' : 'הוצאה אחרת');

      // Per-row duplicate detection
      if (tx.vendor && tx.amount) {
        const tolerance = Math.abs(tx.amount) * 0.02;
        const dateObj = new Date(txDate);
        const dayBefore = new Date(dateObj.getTime() - 86400000).toISOString().split('T')[0];
        const dayAfter = new Date(dateObj.getTime() + 86400000).toISOString().split('T')[0];

        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id, vendor, amount, tx_date')
          .eq('user_id', userData.id)
          .gte('tx_date', dayBefore)
          .lte('tx_date', dayAfter)
          .gte('amount', tx.amount - tolerance)
          .lte('amount', tx.amount + tolerance)
          .not('notes', 'ilike', '%חשד לכפל%')
          .limit(1);

        if (existingTx && existingTx.length > 0) {
          duplicateSuspects.push({ vendor: tx.vendor, amount: tx.amount, date: txDate });
          const { data: inserted, error: insertError } = await supabase
            .from('transactions')
            .insert({
              user_id: userData.id,
              type: txType,
              amount: tx.amount,
              vendor: tx.vendor,
              tx_date: txDate,
              category,
              expense_category: tx.expense_category || tx.income_category || null,
              expense_type: tx.expense_type || (txType === 'income' ? null : 'variable'),
              payment_method: tx.payment_method || (documentType === 'credit' ? 'credit_card' : 'bank_transfer'),
              source: 'ocr',
              status: 'pending',
              notes: `חשד לכפל: קיימת תנועה דומה (${existingTx[0].id})`,
              original_description: tx.description || '',
              auto_categorized: !!tx.expense_category,
              confidence_score: tx.confidence || 0.5,
              batch_id: pendingBatchId,
              financial_account_id: financialAccountId,
            })
            .select('id')
            .single();
          if (!insertError && inserted?.id) insertedIds.push(inserted.id);
          continue;
        }
      }

      const { data: inserted, error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: userData.id,
          type: txType,
          amount: tx.amount,
          vendor: tx.vendor,
          tx_date: txDate,
          category,
          expense_category: tx.expense_category || tx.income_category || null,
          expense_type: tx.expense_type || (txType === 'income' ? null : 'variable'),
          payment_method: tx.payment_method || (documentType === 'credit' ? 'credit_card' : 'bank_transfer'),
          source: 'ocr',
          status: 'pending',
          notes: tx.notes || tx.description || '',
          original_description: tx.description || '',
          auto_categorized: !!tx.expense_category,
          confidence_score: tx.confidence || 0.5,
          batch_id: pendingBatchId,
          financial_account_id: financialAccountId,
        })
        .select('id')
        .single();

      if (insertError) {
        insertErrors.push({ vendor: tx.vendor, error: insertError.message });
      } else if (inserted?.id) {
        insertedIds.push(inserted.id);
      }
    }

    console.log(`✅ Saved ${insertedIds.length}/${allTransactions.length} transactions`);
    console.log(`[Webhook] TX_INSERT_COMPLETE: saved=${insertedIds.length}/${allTransactions.length}, errors=${insertErrors.length}, batchId=${pendingBatchId}`);
    if (insertErrors.length > 0) {
      console.log(`[Webhook] TX_INSERT_ERRORS:`, JSON.stringify(insertErrors.slice(0, 5)));
    }

    // Notify about duplicate suspects
    if (duplicateSuspects.length > 0) {
      const dupList = duplicateSuspects.slice(0, 3).map(d =>
        `• ${d.vendor} - ₪${Math.abs(d.amount).toLocaleString('he-IL')} (${d.date})`
      ).join('\n');
      await greenAPI.sendMessage({
        phoneNumber,
        message: `⚠️ *חשד לכפל תשלום (${duplicateSuspects.length}):*\n\n${dupList}\n\nכתוב *"כפל תשלום"* לראות ולטפל`,
      });
    }

    if (insertErrors.length > 0) {
      console.error(`❌ ${insertErrors.length} transaction insert errors:`);
      insertErrors.slice(0, 5).forEach((err, idx) => {
        console.error(`   Error ${idx + 1}: ${err.vendor} - ${err.error}`);
      });
      if (insertedIds.length === 0) {
        console.error('🚨 CRITICAL: ALL transactions failed to insert!');
        console.error('   Sample error:', insertErrors[0].error);
      }
    }

    // Calculate period
    const { extractPeriodFromOCR } = await import('@/lib/documents/period-tracker');
    const { start: periodStart, end: periodEnd } = extractPeriodFromOCR(ocrData);
    const effectivePeriod = calculateEffectivePeriod(periodStart, periodEnd, allTransactions);

    console.log(`📅 Document period: ${effectivePeriod.start || 'unknown'} - ${effectivePeriod.end || 'unknown'}`);

    // Save document record
    const documentId = await saveDocumentRecord(supabase, userData.id, {
      fileName,
      downloadUrl,
      documentType,
      periodStart: effectivePeriod.start,
      periodEnd: effectivePeriod.end,
      transactionsExtracted: allTransactions.length,
      transactionsCreated: insertedIds.length,
    });

    // Post-processing
    if (documentId) {
      await postDocumentProcessing(supabase, userData.id, phoneNumber, {
        documentId,
        documentType,
        batchId: pendingBatchId,
        allTransactions,
        ocrData,
        periodStart,
        periodEnd,
      });
    }

    console.log(`✅ Document processed: ${allTransactions.length} transactions`);
    progressUpdater.stop();

  } catch (pdfError: any) {
    progressUpdater.stop();
    console.error('❌ PDF Error:', pdfError);
    await greenAPI.sendMessage({
      phoneNumber,
      message: 'משהו השתבש בניתוח. נסה לשלוח שוב או צלם את המסך.',
    });
  }

  return NextResponse.json({ status: 'success' });
}
