import { inngest } from './client';
import { createClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import * as XLSX from 'xlsx';
import OpenAI from 'openai';

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
    const { statementId, userId, mimeType, fileName } = event.data;

    console.log(`🚀 Starting background processing for statement: ${statementId}`);

    // שלב 1: קבלת הקובץ מ-Supabase
    const fileData = await step.run('fetch-file', async () => {
      const supabase = await createClient();
      
      const { data: statement } = await supabase
        .from('uploaded_statements')
        .select('file_url')
        .eq('id', statementId)
        .single();

      if (!statement?.file_url) {
        throw new Error('File not found');
      }

      // הורדת הקובץ
      const response = await fetch(statement.file_url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return { buffer, arrayBuffer };
    });

    // שלב 2: ניתוח הקובץ
    const transactions = await step.run('analyze-file', async () => {
      const { buffer, arrayBuffer } = fileData;
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

      await supabase
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
  const systemPrompt = `אתה מומחה לניתוח דוחות בנק ואשראי ישראליים.
תפקידך לחלץ תנועות פיננסיות מהמסמך ולסווג אותן.

עבור כל תנועה, זהה:
1. תאריך (YYYY-MM-DD)
2. תיאור/שם העסק
3. סכום
4. קטגוריה (food, transport, shopping, health, entertainment, education, housing, utilities, other)
5. קטגוריה מפורטת
6. תדירות (fixed/temporary/special/one_time)

החזר JSON:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "תיאור",
      "vendor": "שם עסק",
      "amount": 123.45,
      "category": "food",
      "detailed_category": "restaurants",
      "expense_frequency": "one_time",
      "confidence": 0.9
    }
  ]
}`;

  const userPrompt = `נתח את התדפיס הבא:

${text.substring(0, 8000)}

החזר JSON array עם כל התנועות שמצאת.`;

  try {
    const response = await openai.responses.create({
      model: 'gpt-5',
      input: [
        { role: 'system', content: systemPrompt },
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
  const prompt = `נתח את המסמך של ${fileType === 'credit_statement' ? 'דוח אשראי' : 'דוח בנק'} וחלץ את כל התנועות הפיננסיות.

עבור כל תנועה, זהה:
1. תאריך (YYYY-MM-DD)
2. תיאור/שם העסק
3. סכום
4. קטגוריה מפורטת
5. תדירות

החזר JSON:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "תיאור",
      "vendor": "שם עסק",
      "amount": 123.45,
      "category": "קטגוריה",
      "detailed_category": "food_beverages",
      "expense_frequency": "fixed",
      "confidence": 0.9
    }
  ]
}`;

  try {
    console.log('📤 Uploading PDF to OpenAI Files API...');
    const file = await openai.files.create({
      file: new File([buffer], fileName, { type: 'application/pdf' }),
      purpose: 'assistants',
    });

    console.log(`✅ File uploaded to OpenAI: ${file.id}`);

    const response = await openai.responses.create({
      model: 'gpt-5',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_file', file_id: file.id },
          ],
        },
      ],
    });

    try {
      await openai.files.del(file.id);
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
  const prompt = `נתח את התמונה של דוח בנק/אשראי וחלץ את כל התנועות הפיננסיות.

עבור כל תנועה, זהה:
1. תאריך (YYYY-MM-DD)
2. תיאור/שם העסק
3. סכום
4. קטגוריה מפורטת
5. תדירות

החזר JSON:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "תיאור",
      "vendor": "שם עסק",
      "amount": 123.45,
      "category": "קטגוריה",
      "detailed_category": "food_beverages",
      "expense_frequency": "fixed",
      "confidence": 0.9
    }
  ]
}`;

  try {
    console.log('🤖 Analyzing image with GPT-5...');
    
    const response = await openai.responses.create({
      model: 'gpt-5',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
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

    if (!userData?.phone_number) {
      console.log('No phone number found for user');
      return;
    }

    const greenAPI = getGreenAPIClient();
    
    await greenAPI.sendMessage({
      phoneNumber: userData.phone_number,
      message: `🎉 התדפיס שלך מוכן!\n\nזיהיתי ${transactionsCount} תנועות חדשות.\n\n👉 היכנס לאפליקציה כדי לראות אותן.`,
    });

    console.log(`✅ WhatsApp notification sent to ${userData.phone_number}`);
  } catch (error) {
    console.error('Failed to send WhatsApp notification:', error);
  }
}

