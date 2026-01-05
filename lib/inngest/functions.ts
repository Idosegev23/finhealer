import { inngest } from './client';
import { createClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import * as XLSX from 'xlsx';
import OpenAI from 'openai';
import { EXPENSE_CATEGORIES_SYSTEM_PROMPT, buildStatementAnalysisPrompt } from '@/lib/ai/expense-categories-prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * יצירת Supabase client עם service role לעקיפת RLS
 * זה נחוץ ב-Inngest functions שרצות ללא הקשר משתמש
 */
async function createServiceRoleClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// פונקציה לעיבוד statement ברקע
export const processStatement = inngest.createFunction(
  { 
    id: 'process-statement',
    name: 'Process Financial Statement',
    // אין timeout! יכול לרוץ כמה שצריך
  },
  { event: 'statement.process' },
  async ({ event, step }) => {
    const { statementId, userId, mimeType, fileName, fileData } = event.data;

    console.log(`🚀 Starting background processing for statement: ${statementId}`);

    // שלב 1: המרת הקובץ מ-base64 ל-Buffer
    const fileDataProcessed = await step.run('prepare-file', async () => {
      // המרה מbase64 לBuffer
      const buffer = Buffer.from(fileData, 'base64');
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );

      console.log(`✅ File prepared: ${buffer.length} bytes`);
      
      return { buffer, arrayBuffer };
    });

    // שלב 2: ניתוח הקובץ
    const transactions = await step.run('analyze-file', async () => {
      const { buffer: bufferData, arrayBuffer } = fileDataProcessed;
      
      // המרת Buffer מJSON חזרה ל-Buffer אמיתי
      // Inngest מסריאל Buffer ל-{type: "Buffer", data: number[]}
      const buffer = Buffer.isBuffer(bufferData) 
        ? bufferData 
        : Buffer.from((bufferData as any).data || bufferData);
      
      let extractedText = '';
      let txs: any[] = [];

      // Excel/CSV
      if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || 
          fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        console.log('📊 Processing Excel...');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        extractedText = XLSX.utils.sheet_to_csv(sheet);
        
        txs = await analyzeTransactionsWithAI(extractedText, 'bank_statement');
      }
      // PDF
      else if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
        console.log(`📄 Processing PDF with GPT-5...`);
        txs = await analyzePDFWithAI(buffer, 'bank_statement', fileName);
      }
      // Image
      else if (mimeType.startsWith('image/')) {
        console.log(`🖼️ Processing Image with GPT-5 Vision...`);
        const result = await analyzeImageWithAI(buffer, mimeType, 'bank_statement');
        txs = result.transactions;
        extractedText = result.extractedText;
      }

      return { transactions: txs, extractedText };
    });

    // שלב 3: עדכון ה-DB
    await step.run('update-database', async () => {
      const supabase = await createServiceRoleClient();
      const method = transactions.extractedText ? 'gpt5-text' : 'gpt5-vision';

      await (supabase as any)
        .from('uploaded_statements')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          status: 'completed',
          transactions_extracted: transactions.transactions.length,
          metadata: { 
            method,
            text_length: transactions.extractedText.length || 0,
            file_type: mimeType,
          },
        })
        .eq('id', statementId);

      console.log(`✅ Statement ${statementId} completed successfully`);
    });

    // שלב 4: שליחת הודעת WhatsApp
    await step.run('send-whatsapp', async () => {
      await sendWhatsAppNotification(userId, transactions.transactions.length);
    });

    return { 
      success: true, 
      transactions: transactions.transactions.length 
    };
  }
);

// פונקציות עזר (מהקוד המקורי)
async function analyzeTransactionsWithAI(text: string, fileType: string) {
  const userPrompt = buildStatementAnalysisPrompt(
    fileType as 'bank_statement' | 'credit_statement',
    text
  );

  try {
    // 🆕 GPT-5.2 with Responses API
    const response = await openai.responses.create({
      model: 'gpt-5.2-2025-12-11',
      input: `${EXPENSE_CATEGORIES_SYSTEM_PROMPT}\n\n${userPrompt}`,
      reasoning: { effort: 'medium' },
      max_output_tokens: 16000,
    });

    const content = response.output_text || '{"transactions":[]}';
    const result = JSON.parse(content);
    
    return result.transactions || [];
  } catch (error) {
    console.error('AI analysis error:', error);
    throw new Error('Failed to analyze transactions with AI');
  }
}

async function analyzePDFWithAI(buffer: Buffer, fileType: string, fileName: string) {
  const userPrompt = `נתח את מסמך ה-PDF של ${fileType === 'credit_statement' ? 'דוח אשראי' : 'דוח בנק'} וחלץ את כל תנועות ההוצאה.

סווג כל תנועה לפי רשימת הקטגוריות המדויקת שקיבלת.
החזר JSON עם כל התנועות שמצאת.`;

  try {
    console.log('📝 Extracting text from PDF...');
    
    // Extract text using unpdf
    const { getDocumentProxy, extractText } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });

    console.log(`✅ Text extracted: ${text.length} characters`);

    // 🆕 GPT-5.2 with Responses API
    const response = await openai.responses.create({
      model: 'gpt-5.2-2025-12-11',
      input: `${EXPENSE_CATEGORIES_SYSTEM_PROMPT}\n\n${userPrompt}\n\nטקסט הדוח:\n${text}`,
      reasoning: { effort: 'medium' },
      max_output_tokens: 16000,
    });

    const content = response.output_text || '{"transactions":[]}';
    const result = JSON.parse(content);
    
    return result.transactions || [];
  } catch (error: any) {
    console.error('❌ PDF analysis error:', error);
    console.error('Error details:', {
      message: error?.message,
      status: error?.status,
      type: error?.type,
      code: error?.code,
      response: error?.response?.data,
    });
    throw new Error(`Failed to analyze PDF with AI: ${error?.message || 'Unknown error'}`);
  }
}

async function analyzeImageWithAI(buffer: Buffer, mimeType: string, documentType: string) {
  const userPrompt = buildStatementAnalysisPrompt(
    documentType as 'bank_statement' | 'credit_statement',
    'תמונה של דוח'
  );

  try {
    console.log('🤖 Analyzing image with GPT-5.2 Vision...');
    
    // המר את ה-Buffer ל-base64 data URL
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    // 🆕 GPT-5.2 with Responses API
    const response = await openai.responses.create({
      model: 'gpt-5.2-2025-12-11',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: EXPENSE_CATEGORIES_SYSTEM_PROMPT + '\n\n' + userPrompt },
            { type: 'input_image', image_url: dataUrl, detail: 'high' },
          ]
        }
      ],
      reasoning: { effort: 'medium' },
    });

    const content = response.output_text || '{"transactions":[]}';
    const result = JSON.parse(content);
    
    return {
      transactions: result.transactions || [],
      extractedText: 'תמונה מנותחת',
    };
  } catch (error: any) {
    console.error('❌ Image analysis error:', error);
    console.error('Error details:', {
      message: error?.message,
      status: error?.status,
      type: error?.type,
      code: error?.code,
      response: error?.response?.data,
    });
    throw new Error(`Failed to analyze image with AI: ${error?.message || 'Unknown error'}`);
  }
}

async function sendWhatsAppNotification(userId: string, transactionsCount: number) {
  try {
    const supabase = await createServiceRoleClient();
    
    const { data: userData } = await supabase
      .from('users')
      .select('phone_number, name')
      .eq('id', userId)
      .single();

    // Type assertion
    const user = userData as any;

    if (!user?.phone_number) {
      console.log('No phone number found for user');
      return;
    }

    const greenAPI = getGreenAPIClient();
    
    const userName = user.name || 'שלום';
    const pendingUrl = 'https://finhealer.vercel.app/dashboard/expenses/pending';
    
    await greenAPI.sendMessage({
      phoneNumber: user.phone_number,
      message: `היי ${userName}! 🎉\n\nסיימתי לעבד את הדוח שהעלית.\nמצאתי ${transactionsCount} הוצאות שממתינות לאישור שלך.\n\n👉 היכנס לאתר כדי לאשר: ${pendingUrl}\n\nתודה! 💙`,
    });

    console.log(`✅ WhatsApp notification sent to ${user.phone_number}`);
  } catch (error) {
    console.error('Failed to send WhatsApp notification:', error);
  }
}

// ============================================================================
// פונקציה לעיבוד מסמך חדש (document.process)
// ============================================================================

export const processDocument = inngest.createFunction(
  {
    id: 'process-document',
    name: 'Process Financial Document',
  },
  { event: 'document.process' },
  async ({ event, step }) => {
    const { statementId, userId, documentType, fileName, mimeType, fileUrl } = event.data;

    console.log(`🚀 Processing document: ${statementId} (${documentType})`);

    // שלב 1: הורדת הקובץ מ-Storage
    const fileDataProcessed = await step.run('download-file', async () => {
      console.log(`📥 Downloading file from Storage: ${fileName}`);
      
      const supabase = await createServiceRoleClient();
      
      // חילוץ הנתיב מה-URL
      const url = new URL(fileUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/[^\/]+\/(.+)$/);
      if (!pathMatch) {
        throw new Error('Invalid file URL format');
      }
      const filePath = pathMatch[1];
      
      // הורדת הקובץ
      const { data, error } = await supabase.storage
        .from('financial-documents')
        .download(filePath);
      
      if (error) {
        console.error('Storage download error:', error);
        throw new Error(`Failed to download file: ${error.message}`);
      }
      
      // המרה ל-Buffer
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log(`✅ File downloaded: ${buffer.length} bytes`);
      
      return { buffer };
    });

    // שלב 2: ניתוח הקובץ
    const transactions = await step.run('analyze-file', async () => {
      const { buffer: bufferData } = fileDataProcessed;
      const buffer = Buffer.isBuffer(bufferData) 
        ? bufferData 
        : Buffer.from((bufferData as any).data || bufferData);

      let extractedText = '';
      let txs: any[] = [];

      // בחירת שיטת עיבוד לפי סוג
      if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet') || fileName?.endsWith('.xlsx')) {
        // Excel
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        extractedText = XLSX.utils.sheet_to_txt(worksheet);
        const result = await analyzeTransactionsWithAI(extractedText, documentType);
        txs = result.transactions;
      } else if (mimeType?.includes('pdf') || fileName?.endsWith('.pdf')) {
        // PDF
        const result = await analyzePDFWithAI(buffer, fileName, documentType);
        txs = result.transactions;
        extractedText = result.extractedText;
      } else {
        // Image
        const result = await analyzeImageWithAI(buffer, mimeType || 'image/jpeg', documentType);
        txs = result.transactions;
        extractedText = result.extractedText;
      }

      console.log(`✅ Extracted ${txs.length} transactions`);
      return { transactions: txs, extractedText };
    });

    // שלב 3: שמירת תנועות ב-DB
    const saved = await step.run('save-transactions', async () => {
      const supabase = await createServiceRoleClient();
      let successCount = 0;

      for (const tx of transactions.transactions) {
        try {
          const { error } = await (supabase as any).from('transactions').insert({
            user_id: userId,
            type: tx.type || 'expense',
            amount: tx.amount,
            category: tx.category || 'לא מסווג',
            vendor: tx.vendor || tx.description,
            date: tx.date,
            source: 'ocr',
            status: 'proposed',
            notes: tx.notes || tx.description,
            payment_method: tx.payment_method,
            expense_category: tx.expense_category,
            expense_type: tx.expense_type,
            confidence_score: tx.confidence_score || 0.8,
          });

          if (!error) successCount++;
        } catch (err) {
          console.error('Error saving transaction:', err);
        }
      }

      console.log(`✅ Saved ${successCount}/${transactions.transactions.length} transactions`);
      return successCount;
    });

    // שלב 4: עדכון סטטוס ב-DB
    await step.run('update-status', async () => {
      const supabase = await createServiceRoleClient();
      
      await (supabase as any).from('uploaded_statements').update({
        processed: true,
        processed_at: new Date().toISOString(),
        status: 'completed',
        transactions_extracted: transactions.transactions.length,
        metadata: {
          method: 'ai',
          text_length: transactions.extractedText?.length || 0,
          file_type: mimeType,
        },
      }).eq('id', statementId);

      console.log(`✅ Updated document status`);
    });

    // שלב 5: שליחת התראת WhatsApp
    await step.run('send-notification', async () => {
      await sendWhatsAppNotification(userId, transactions.transactions.length);
    });

    return { 
      success: true, 
      transactionsExtracted: transactions.transactions.length,
      transactionsSaved: saved,
    };
  }
);

// ===========================================================================
// 🆕 פונקציה לשמירת תנועות מ-Excel ברקע
// ===========================================================================
export const saveExcelTransactions = inngest.createFunction(
  { 
    id: 'save-excel-transactions',
    name: 'Save Excel Transactions',
    retries: 3, // מקסימום 3 ניסיונות
  },
  { event: 'excel/transactions.save' },
  async ({ event, step }) => {
    const { userId, phone, transactions, batchId, documentInfo } = event.data;
    
    console.log(`🚀 [Inngest] Starting to save ${transactions.length} transactions for user ${userId}`);
    
    // שלב 0: בדיקת כפילויות - האם batch כבר קיים?
    const existingCheck = await step.run('check-duplicates', async () => {
      const supabase = await createServiceRoleClient();
      
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('batch_id', batchId);
      
      if (count && count > 0) {
        console.log(`⚠️ [Inngest] Batch ${batchId} already exists with ${count} transactions, skipping`);
        return { skipped: true, existingCount: count };
      }
      
      return { skipped: false, existingCount: 0 };
    });
    
    if (existingCheck.skipped) {
      return { success: true, skipped: true, reason: 'batch_already_exists' };
    }
    
    // שלב 1: הכנת התנועות לשמירה
    const preparedTransactions = await step.run('prepare-transactions', async () => {
      // Helper to convert DD/MM/YYYY to YYYY-MM-DD
      const parseDate = (dateStr: string | undefined): string => {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        
        // Try DD/MM/YYYY format (Israeli)
        const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyy) {
          const [, day, month, year] = ddmmyyyy;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        // Already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        
        // Try to parse with Date
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
        
        return new Date().toISOString().split('T')[0];
      };
      
      const prepared = transactions
        .filter((tx: any) => Math.abs(tx.amount || 0) > 0)
        .map((tx: any) => {
          const isIncome = tx.type === 'income' || tx.amount > 0;
          return {
            user_id: userId,
            type: isIncome ? 'income' : 'expense',
            amount: Math.abs(tx.amount || 0),
            vendor: tx.vendor || tx.payee || tx.description || 'לא ידוע',
            original_description: tx.description || tx.vendor || '',
            notes: tx.notes || tx.description || '',
            tx_date: parseDate(tx.date),
            category: isIncome ? null : (tx.expense_category || tx.category || null),
            income_category: isIncome ? (tx.income_category || tx.category || null) : null,
            expense_type: tx.expense_type || (isIncome ? null : 'variable'),
            payment_method: tx.payment_method || (documentInfo.documentType === 'credit' ? 'credit_card' : 'bank_transfer'),
            source: 'excel',
            status: 'pending',
            batch_id: batchId,
            auto_categorized: !!tx.expense_category,
            confidence_score: tx.confidence || 0.5,
          };
        });
      
      console.log(`📦 [Inngest] Prepared ${prepared.length} transactions for batch insert`);
      return prepared;
    });
    
    // שלב 2: Batch insert של כל התנועות
    const insertResult = await step.run('batch-insert-transactions', async () => {
      const supabase = await createServiceRoleClient();
      
      // Batch insert - הרבה יותר מהיר מאחד אחד!
      const { data: inserted, error } = await supabase
        .from('transactions')
        .insert(preparedTransactions)
        .select('id');
      
      if (error) {
        console.error('❌ [Inngest] Batch insert error:', error);
        throw new Error(`Batch insert failed: ${error.message}`);
      }
      
      console.log(`✅ [Inngest] Batch inserted ${inserted?.length || 0} transactions`);
      return { insertedCount: inserted?.length || 0, insertedIds: inserted?.map((t: any) => t.id) || [] };
    });
    
    // שלב 3: חישוב תקופה ושמירת מסמך
    const documentId = await step.run('save-document', async () => {
      const supabase = await createServiceRoleClient();
      const { ocrData, fileName, downloadUrl, documentType } = documentInfo;
      
      // Helper for date parsing (same as above)
      const parseDate = (dateStr: string | undefined): string => {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyy) {
          const [, day, month, year] = ddmmyyyy;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
        return new Date().toISOString().split('T')[0];
      };
      
      // חישוב תקופה
      let periodStart: string | null = null;
      let periodEnd: string | null = null;
      
      if (ocrData?.period?.start_date && ocrData?.period?.end_date) {
        periodStart = parseDate(ocrData.period.start_date);
        periodEnd = parseDate(ocrData.period.end_date);
      } else if (ocrData?.report_info?.period_start && ocrData?.report_info?.period_end) {
        periodStart = parseDate(ocrData.report_info.period_start);
        periodEnd = parseDate(ocrData.report_info.period_end);
      } else if (transactions.length > 0) {
        const dates = transactions
          .map((tx: any) => new Date(parseDate(tx.date)))
          .filter((d: Date) => !isNaN(d.getTime()));
        
        if (dates.length > 0) {
          periodStart = new Date(Math.min(...dates.map((d: Date) => d.getTime()))).toISOString().split('T')[0];
          periodEnd = new Date(Math.max(...dates.map((d: Date) => d.getTime()))).toISOString().split('T')[0];
        }
      }
      
      // שמירת המסמך
      const { data: docRecord, error: docError } = await supabase
        .from('uploaded_statements')
        .insert({
          user_id: userId,
          file_url: downloadUrl,
          file_name: fileName,
          file_type: documentType === 'credit' ? 'credit_statement' : 'bank_statement',
          document_type: documentType,
          status: 'completed',
          processed: true,
          period_start: periodStart,
          period_end: periodEnd,
          transactions_extracted: transactions.length,
          transactions_created: insertResult.insertedCount,
        })
        .select('id')
        .single();
      
      if (docError) {
        console.error('❌ [Inngest] Document save error:', docError);
        // לא נזרוק שגיאה - התנועות כבר נשמרו
      }
      
      const docId = docRecord?.id;
      
      if (docId) {
        console.log(`✅ [Inngest] Document saved: ${docId}`);
        
        // עדכון התנועות עם document_id
        await supabase
          .from('transactions')
          .update({ document_id: docId })
          .eq('batch_id', batchId);
      }
      
      return docId;
    });
    
    // שלב 4: עדכון סטטוס המשתמש
    await step.run('update-user-state', async () => {
      const supabase = await createServiceRoleClient();
      
      await supabase
        .from('users')
        .update({ 
          onboarding_state: 'classification',
          current_phase: 'classification'
        })
        .eq('id', userId);
      
      console.log(`✅ [Inngest] User state updated to classification`);
    });
    
    // שלב 5: שליחת הודעה למשתמש
    await step.run('notify-user', async () => {
      const greenAPI = getGreenAPIClient();
      const { onDocumentProcessed } = await import('@/lib/conversation/phi-router');
      
      await onDocumentProcessed(userId, phone);
      
      console.log(`✅ [Inngest] User notified via WhatsApp`);
    });
    
    console.log(`🎉 [Inngest] Excel processing complete: ${insertResult.insertedCount} transactions saved`);
    
    return { 
      success: true, 
      transactionsSaved: insertResult.insertedCount,
      documentId,
    };
  }
);

