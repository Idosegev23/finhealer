// @ts-nocheck
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import type { WebhookContext } from './types';
import { startProgressUpdates, safeFetch } from './utils';
import {
  detectDocumentType,
  cleanAiJson,
  normalizeTransactions,
  saveDocumentRecord,
  postDocumentProcessing,
} from './document-common';

/**
 * Handle Excel/CSV documents: parse, AI analysis, save transactions.
 */
export async function handleExcel(
  ctx: WebhookContext,
  downloadUrl: string,
  fileName: string
): Promise<NextResponse> {
  const { userData, phoneNumber, supabase } = ctx;
  const greenAPI = getGreenAPIClient();

  // Detect document type
  const { data: userState } = await supabase
    .from('users')
    .select('onboarding_state, classification_context')
    .eq('id', userData.id)
    .single();

  const { documentType, documentTypeHebrew } = detectDocumentType(userState, fileName);

  console.log(`📋 Excel document type: ${documentType}`);

  await greenAPI.sendMessage({
    phoneNumber,
    message: `📊 קיבלתי ${documentTypeHebrew} (Excel)!\n\nמתחיל לנתח... זה יקח כדקה.`,
  });

  const progressUpdater = startProgressUpdates(greenAPI, phoneNumber);

  try {
    // Download file (with timeout + status check)
    const excelResponse = await safeFetch(downloadUrl);
    const excelBuffer = await excelResponse.arrayBuffer();
    const buffer = Buffer.from(excelBuffer);

    console.log(`📥 Excel downloaded: ${buffer.length} bytes`);

    // Parse Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    let excelText = '';
    let totalRows = 0;
    const MAX_ROWS_PER_SHEET = 100;
    let wasLimited = false;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];
      totalRows += jsonData.length;

      const rowsToProcess = jsonData.slice(0, MAX_ROWS_PER_SHEET);
      if (jsonData.length > MAX_ROWS_PER_SHEET) {
        wasLimited = true;
        console.log(`⚠️ Sheet "${sheetName}": limiting ${jsonData.length} rows → ${MAX_ROWS_PER_SHEET}`);
      }

      const limitedSheet = XLSX.utils.aoa_to_sheet(rowsToProcess);
      const csvData = XLSX.utils.sheet_to_csv(limitedSheet);

      excelText += `Sheet: ${sheetName}\n`;
      excelText += csvData + '\n\n';

      console.log(`📄 Sheet "${sheetName}": ${jsonData.length} rows (processed: ${rowsToProcess.length})`);
    }

    console.log(`✅ Excel parsed: ${workbook.SheetNames.length} sheets, ${totalRows} total rows, ${excelText.length} chars`);

    if (wasLimited) {
      await greenAPI.sendMessage({
        phoneNumber,
        message: `⚠️ הקובץ גדול (${totalRows} שורות).\nמעבד את 100 השורות הראשונות של כל גיליון.\n\n💡 לניתוח מלא, שלח מסמכים לפי חודש.`,
      });
    }

    if (excelText.length > 30000) {
      excelText = excelText.substring(0, 30000) + '\n...(truncated)';
      console.log('⚠️ Excel text truncated to 30000 chars');
    }

    // AI analysis
    const { getPromptForDocumentType } = await import('@/lib/ai/document-prompts');

    let expenseCategories: Array<{name: string; expense_type: string; category_group: string}> = [];
    if (documentType === 'credit' || documentType === 'bank') {
      const { data: categories } = await supabase
        .from('expense_categories')
        .select('name, expense_type, category_group')
        .eq('is_active', true);
      expenseCategories = categories || [];
    }

    const prompt = getPromptForDocumentType(
      documentType === 'credit' ? 'credit_statement' : 'bank_statement',
      excelText,
      expenseCategories
    );

    console.log(`🤖 Sending Excel data to Gemini Flash (${excelText.length} chars)...`);

    const { chatWithGeminiProDeep } = await import('@/lib/ai/gemini-client');

    const aiPromise = chatWithGeminiProDeep(prompt, '').then(text => ({ output_text: text }));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI_TIMEOUT')), 120000)
    );

    let aiResponse: any;
    try {
      aiResponse = await Promise.race([aiPromise, timeoutPromise]);
    } catch (timeoutError: any) {
      if (timeoutError.message === 'AI_TIMEOUT') {
        console.error('⏱️ AI call timed out after 120 seconds');
        progressUpdater.stop();
        await greenAPI.sendMessage({
          phoneNumber,
          message: `⏱️ הקובץ גדול מדי ולוקח יותר מדי זמן לעבד.\n\n` +
            `💡 נסה לשלוח קבצים קטנים יותר (עד 100 שורות).\n` +
            `📅 עדיף: מסמך אחד לכל חודש.`,
        });
        return NextResponse.json({ status: 'success', message: 'timeout handled' });
      }
      throw timeoutError;
    }

    const content = aiResponse.output_text || '{}';
    console.log('🎯 Excel OCR Result:', content.substring(0, 500));

    const ocrData = cleanAiJson(content);
    const allTransactions = normalizeTransactions(ocrData);

    console.log(`📊 Extracted ${allTransactions.length} transactions from Excel`);

    progressUpdater.stop();

    const incomeCount = allTransactions.filter(tx => tx.type === 'income').length;
    const expenseCount = allTransactions.filter(tx => tx.type === 'expense').length;

    await greenAPI.sendMessage({
      phoneNumber,
      message: `✅ מצוין! זיהיתי ${allTransactions.length} תנועות:\n\n` +
        `💚 ${incomeCount} הכנסות\n` +
        `💸 ${expenseCount} הוצאות\n\n` +
        `מסדר את הנתונים... זה יקח כמה שניות 📊`,
    });

    // Batch insert (Excel uses bulk insert unlike PDF's one-by-one)
    const pendingBatchId = `excel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Date parser with validation
    const parseDate = (dateStr: string | undefined): string => {
      if (!dateStr) return new Date().toISOString().split('T')[0];

      let year: number, month: number, day: number;

      const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (ddmmyyyy) {
        day = parseInt(ddmmyyyy[1], 10);
        month = parseInt(ddmmyyyy[2], 10);
        year = parseInt(ddmmyyyy[3], 10);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
        return new Date().toISOString().split('T')[0];
      }

      const maxDays = new Date(year, month, 0).getDate();
      if (day > maxDays) day = maxDays;

      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    console.log(`📦 Preparing ${allTransactions.length} transactions for batch insert...`);

    const transactionsToInsert = allTransactions
      .filter((tx: any) => Math.abs(tx.amount || 0) > 0)
      .map((tx: any) => {
        const isIncome = tx.type === 'income' || (tx.type !== 'expense' && tx.amount > 0);
        return {
          user_id: userData.id,
          type: isIncome ? 'income' : 'expense',
          amount: Math.abs(tx.amount || 0),
          vendor: tx.vendor || tx.payee || tx.description || 'לא ידוע',
          original_description: tx.description || tx.vendor || '',
          notes: tx.notes || '',
          tx_date: parseDate(tx.date),
          category: isIncome ? null : (tx.expense_category || tx.category || null),
          income_category: isIncome ? (tx.income_category || tx.category || null) : null,
          expense_type: tx.expense_type || (isIncome ? null : 'variable'),
          payment_method: tx.payment_method || (documentType === 'credit' ? 'credit_card' : 'bank_transfer'),
          source: 'excel',
          status: 'pending',
          batch_id: pendingBatchId,
          auto_categorized: !!tx.expense_category,
          confidence_score: tx.confidence || 0.5,
        };
      });

    // Try batch insert first; on failure, fall back to one-by-one
    let savedCount = 0;
    const { data: insertedTx, error: insertError } = await supabase
      .from('transactions')
      .insert(transactionsToInsert)
      .select('id');

    if (insertError) {
      console.warn('⚠️ Batch insert failed, falling back to one-by-one:', insertError.message);
      // Insert one-by-one to save as many as possible
      for (const tx of transactionsToInsert) {
        const { error: singleErr } = await supabase
          .from('transactions')
          .insert(tx);
        if (!singleErr) savedCount++;
        else console.error(`❌ Single insert failed: ${tx.vendor} - ${singleErr.message}`);
      }
      console.log(`✅ Fallback inserted ${savedCount}/${transactionsToInsert.length} transactions`);
    } else {
      savedCount = insertedTx?.length || 0;
      console.log(`✅ Batch inserted ${savedCount} transactions`);
    }

    if (savedCount === 0 && transactionsToInsert.length > 0) {
      await greenAPI.sendMessage({
        phoneNumber,
        message: '❌ לא הצלחתי לשמור את התנועות. נסה שוב או שלח מסמך אחר.',
      });
      return NextResponse.json({ status: 'insert_failed' });
    }

    // Calculate period from transaction dates
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    if (transactionsToInsert.length > 0) {
      const dates = transactionsToInsert
        .map((tx: any) => new Date(tx.tx_date))
        .filter((d: Date) => !isNaN(d.getTime()));

      if (dates.length > 0) {
        periodStart = new Date(Math.min(...dates.map((d: Date) => d.getTime()))).toISOString().split('T')[0];
        periodEnd = new Date(Math.max(...dates.map((d: Date) => d.getTime()))).toISOString().split('T')[0];
      }
    }

    console.log(`📅 Period calculated from transactions: ${periodStart} - ${periodEnd}`);

    // Save document record
    const documentId = await saveDocumentRecord(supabase, userData.id, {
      fileName,
      downloadUrl,
      documentType,
      periodStart,
      periodEnd,
      transactionsExtracted: allTransactions.length,
      transactionsCreated: savedCount,
    });

    // Post-processing (simplified — no period coverage deep check for Excel)
    if (documentId) {
      await postDocumentProcessing(supabase, userData.id, phoneNumber, {
        documentId,
        documentType,
        batchId: pendingBatchId,
        allTransactions: transactionsToInsert,
      });
    } else {
      // Even without document record, update state and notify
      await supabase
        .from('users')
        .update({ onboarding_state: 'classification', phase: 'data_collection' })
        .eq('id', userData.id);

      const { onDocumentProcessed } = await import('@/lib/conversation/phi-router');
      await onDocumentProcessed(userData.id, phoneNumber);
    }

    console.log(`✅ Excel processing complete: ${savedCount}/${allTransactions.length} transactions saved`);

  } catch (excelError: any) {
    progressUpdater.stop();
    console.error('❌ Excel Error:', excelError);
    await greenAPI.sendMessage({
      phoneNumber,
      message: 'משהו השתבש בניתוח ה-Excel 😕\n\nאפשר לנסות לשמור כ-PDF או לשלוח צילום מסך.',
    });
  }

  return NextResponse.json({ status: 'success' });
}
