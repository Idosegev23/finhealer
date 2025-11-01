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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: EXPENSE_CATEGORIES_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 16000,
    });

    const content = response.choices[0].message.content || '{"transactions":[]}';
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

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: EXPENSE_CATEGORIES_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `${userPrompt}\n\nטקסט הדוח:\n${text}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 16000,
    });

    const content = response.choices[0].message.content || '{"transactions":[]}';
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
    console.log('🤖 Analyzing image with GPT-4o Vision...');
    
    // המר את ה-Buffer ל-base64 data URL
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: EXPENSE_CATEGORIES_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0].message.content || '{"transactions":[]}';
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

