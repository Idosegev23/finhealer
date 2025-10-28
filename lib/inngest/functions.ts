import { inngest } from './client';
import { createClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import * as XLSX from 'xlsx';
import OpenAI from 'openai';
import { EXPENSE_CATEGORIES_SYSTEM_PROMPT, buildStatementAnalysisPrompt } from '@/lib/ai/expense-categories-prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;
        txs = await analyzeImageWithAI(dataUrl);
      }

      return { transactions: txs, extractedText };
    });

    // שלב 3: עדכון ה-DB
    await step.run('update-database', async () => {
      const supabase = await createClient();
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
    const response = await openai.responses.create({
      model: 'gpt-5',
      input: [
        { role: 'system', content: EXPENSE_CATEGORIES_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
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
    console.log('📤 Uploading PDF to OpenAI Files API...');
    const file = await openai.files.create({
      file: new File([new Uint8Array(buffer)], fileName, { type: 'application/pdf' }),
      purpose: 'assistants',
    });

    console.log(`✅ File uploaded to OpenAI: ${file.id}`);

    const response = await (openai.responses as any).create({
      model: 'gpt-5',
      input: [
        {
          role: 'system',
          content: EXPENSE_CATEGORIES_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: userPrompt },
            { type: 'input_file', file_id: file.id },
          ],
        },
      ],
    });

    try {
      await openai.files.delete(file.id);
      console.log('🗑️ File deleted from OpenAI');
    } catch (deleteError) {
      console.warn('Failed to delete file from OpenAI:', deleteError);
    }

    const content = response.output_text || '{"transactions":[]}';
    const result = JSON.parse(content);
    
    return result.transactions || [];
  } catch (error) {
    console.error('PDF analysis error:', error);
    throw new Error('Failed to analyze PDF with AI');
  }
}

async function analyzeImageWithAI(imageUrl: string) {
  const userPrompt = `נתח את התמונה של דוח בנק/אשראי/קבלה וחלץ את כל תנועות ההוצאה.

סווג כל תנועה לפי רשימת הקטגוריות המדויקת שקיבלת.
החזר JSON עם כל התנועות שמצאת.`;

  try {
    console.log('🤖 Analyzing image with GPT-5...');
    
    const response = await (openai.responses as any).create({
      model: 'gpt-5',
      input: [
        {
          role: 'system',
          content: EXPENSE_CATEGORIES_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: userPrompt },
            { type: 'input_image', image_url: imageUrl },
          ],
        },
      ],
    });

    const content = response.output_text || '{"transactions":[]}';
    const result = JSON.parse(content);
    
    return result.transactions || [];
  } catch (error) {
    console.error('Image analysis error:', error);
    throw new Error('Failed to analyze image with AI');
  }
}

async function sendWhatsAppNotification(userId: string, transactionsCount: number) {
  try {
    const supabase = await createClient();
    
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
    
    await greenAPI.sendMessage({
      phoneNumber: user.phone_number,
      message: `🎉 התדפיס שלך מוכן!\n\nזיהיתי ${transactionsCount} תנועות חדשות.\n\n👉 היכנס לאפליקציה כדי לראות אותן.`,
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
    const { statementId, userId, documentType, fileName, mimeType, fileData } = event.data;

    console.log(`🚀 Processing document: ${statementId} (${documentType})`);

    // שלב 1: המרת הקובץ
    const fileDataProcessed = await step.run('prepare-file', async () => {
      const buffer = Buffer.from(fileData, 'base64');
      console.log(`✅ File prepared: ${buffer.length} bytes`);
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
      const supabase = await createClient();
      let successCount = 0;

      for (const tx of transactions.transactions) {
        try {
          const { error } = await supabase.from('transactions').insert({
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
      const supabase = await createClient();
      
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
      await sendWhatsAppNotification(userId, statementId, transactions.transactions.length);
    });

    return { 
      success: true, 
      transactionsExtracted: transactions.transactions.length,
      transactionsSaved: saved,
    };
  }
);

