// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/expenses/upload-statement
 * העלאת דוח בנק/אשראי וחילוץ תנועות אוטומטי
 * 
 * מקבל: קובץ (PDF/Excel/תמונה)
 * מחזיר: רשימת תנועות מזוהות עם סיווג אוטומטי
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as string; // 'bank_statement' | 'credit_statement'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`📄 Processing statement: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    // שלב 1: שמירת הקובץ ב-Storage
    // הסרת תווים לא-ASCII משם הקובץ
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const sanitizedFileName = `${user.id}/${Date.now()}.${fileExtension}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('financial-documents')
      .upload(sanitizedFileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('financial-documents')
      .getPublicUrl(sanitizedFileName);

    // שלב 2: יצירת רשומה ב-uploaded_statements
    const { data: statement, error: statementError } = await supabase
      .from('uploaded_statements')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_type: fileType || 'bank_statement',
        file_url: publicUrl,
        file_size: file.size,
        status: 'processing',
      })
      .select()
      .single();

    if (statementError) {
      console.error('DB error:', statementError);
      return NextResponse.json({ error: 'Failed to create statement record' }, { status: 500 });
    }

    // שלב 3: עיבוד הקובץ וחילוץ תנועות
    let extractedText = '';
    const mimeType = file.type.toLowerCase();
    const fileName_ = file.name.toLowerCase();

    try {
      let transactions: any[] = [];

      // Excel/CSV - עיבוד טקסט ואז AI
      if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || 
          fileName_.endsWith('.xlsx') || fileName_.endsWith('.xls') || fileName_.endsWith('.csv')) {
        console.log('📊 Processing Excel...');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        extractedText = XLSX.utils.sheet_to_csv(sheet);
        
        // ניתוח עם AI
        transactions = await analyzeTransactionsWithAI(extractedText, fileType);
      }
      // PDF - שימוש ב-GPT-5 File Input עם URL מ-Supabase
      else if (mimeType === 'application/pdf' || fileName_.endsWith('.pdf')) {
        console.log(`📄 Processing PDF with GPT-5 using Supabase URL: ${publicUrl}`);
        
        transactions = await analyzePDFWithAI(publicUrl, fileType);
      }
      // Image - שימוש ב-GPT-5 Vision עם URL מ-Supabase
      else if (mimeType.startsWith('image/')) {
        console.log(`🖼️ Processing Image with GPT-5 Vision using Supabase URL: ${publicUrl}`);
        
        transactions = await analyzeImageWithAI(publicUrl);
      }
      else {
        // סוג קובץ לא נתמך
        await supabase
          .from('uploaded_statements')
          .update({
            status: 'failed',
            error_message: 'Unsupported file type. Please upload Excel, PDF, or image files.',
          })
          .eq('id', statement.id);

        return NextResponse.json({ 
          error: 'Unsupported file type. Please upload Excel (.xlsx, .xls, .csv), PDF, or image files.' 
        }, { status: 400 });
      }

      // עדכון סטטוס
      const method = extractedText ? 'gpt4-text' : 'gpt4-vision';
      await supabase
        .from('uploaded_statements')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          status: 'completed',
          transactions_extracted: transactions.length,
          metadata: { 
            method,
            text_length: extractedText.length || 0,
            file_type: mimeType,
          },
        })
        .eq('id', statement.id);

      return NextResponse.json({
        success: true,
        statement_id: statement.id,
        transactions,
        method,
      });

    } catch (error: any) {
      console.error('Processing error:', error);
      
      // עדכון סטטוס לכישלון
      await supabase
        .from('uploaded_statements')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', statement.id);

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error in upload-statement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ניתוח תנועות מטקסט עם GPT-4
async function analyzeTransactionsWithAI(text: string, fileType: string) {
  const systemPrompt = `אתה מומחה לניתוח דוחות בנק ואשראי ישראליים.
תפקידך לחלץ תנועות פיננסיות מהמסמך ולסווג אותן.

החזר JSON array עם התנועות בפורמט:
[
  {
    "date": "YYYY-MM-DD",
    "description": "תיאור המקור",
    "vendor": "שם העסק/ספק",
    "amount": 123.45,
    "category": "קטגוריה מפורטת",
    "detailed_category": "food_beverages | cellular_communication | entertainment_leisure | etc",
    "expense_frequency": "fixed | temporary | special | one_time",
    "confidence": 0.85
  }
]

קטגוריות מפורטות:
- food_beverages: מזון ומשקאות (סופר, מסעדות, קפה)
- cellular_communication: סלולר ותקשורת (פלאפון, סלקום, אינטרנט)
- entertainment_leisure: בילויים ופנאי (קולנוע, ספורט)
- transportation_fuel: תחבורה ודלק (דלק, חניה, תחבורה ציבורית)
- housing_maintenance: דיור ותחזוקה (ארנונה, ועד בית, תיקונים)
- clothing_footwear: ביגוד והנעלה
- health_medical: בריאות ותרופות (קופת חולים, תרופות, רופאים)
- education: חינוך והשכלה (לימודים, חוגים)
- utilities: חשמל, מים, גז
- shopping_general: קניות כלליות
- subscriptions: מנויים (Netflix, Spotify, חדר כושר)
- insurance: ביטוחים
- loans_debt: הלוואות וחובות
- other: אחר

תדירות הוצאה:
- fixed: קבועה (חוזרת כל חודש באותו סכום - ארנונה, ביטוח, מנויים)
- temporary: זמנית (מנוי לתקופה מוגבלת)
- special: מיוחדת (לא תכופה אך חשובה - ביטוח שנתי)
- one_time: חד פעמית

רק תנועות הוצאה (לא הכנסות)!`;

  const userPrompt = `נתח את התנועות מ${fileType === 'credit_statement' ? 'דוח אשראי' : 'דוח בנק'} הבא:

${text.substring(0, 8000)}

החזר JSON array עם כל התנועות שמצאת.`;

  try {
    const response = await openai.responses.create({
      model: 'gpt-5',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    });

    const content = response.output_text || '{"transactions":[]}';
    const result = JSON.parse(content);
    
    return result.transactions || [];
  } catch (error) {
    console.error('AI analysis error:', error);
    throw new Error('Failed to analyze transactions with AI');
  }
}

// ניתוח PDF עם GPT-5 File Input (עם URL מ-Supabase)
async function analyzePDFWithAI(fileUrl: string, fileType: string) {
  const prompt = `נתח את המסמך של ${fileType === 'credit_statement' ? 'דוח אשראי' : 'דוח בנק'} וחלץ את כל התנועות הפיננסיות.

עבור כל תנועה, זהה:
1. תאריך (YYYY-MM-DD)
2. תיאור/שם העסק
3. סכום
4. קטגוריה מפורטת (food_beverages, cellular_communication, entertainment_leisure, transportation_fuel, housing_maintenance, clothing_footwear, health_medical, education, utilities, shopping_general, subscriptions, insurance, loans_debt, other)
5. תדירות (fixed/temporary/special/one_time)

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
    console.log('🤖 Analyzing PDF with GPT-5 from URL...');
    
    const response = await openai.responses.create({
      model: 'gpt-5',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_file', file_url: fileUrl },
          ],
        },
      ],
      temperature: 0.1,
    });

    const content = response.output_text || '{"transactions":[]}';
    const result = JSON.parse(content);
    
    return result.transactions || [];
  } catch (error) {
    console.error('PDF analysis error:', error);
    throw new Error('Failed to analyze PDF with AI');
  }
}

// ניתוח תמונה עם GPT-5 Vision (עם URL מ-Supabase)
async function analyzeImageWithAI(imageUrl: string) {
  const prompt = `נתח את התמונה של דוח בנק/אשראי וחלץ את כל התנועות הפיננסיות.

עבור כל תנועה, זהה:
1. תאריך (YYYY-MM-DD)
2. תיאור/שם העסק
3. סכום
4. קטגוריה מפורטת (food_beverages, cellular_communication, entertainment_leisure, transportation_fuel, housing_maintenance, clothing_footwear, health_medical, education, utilities, shopping_general, subscriptions, insurance, loans_debt, other)
5. תדירות (fixed/temporary/special/one_time)

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
    console.log('🤖 Analyzing image with GPT-5 from URL...');
    
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
      temperature: 0.1,
    });

    const content = response.output_text || '{"transactions":[]}';
    const result = JSON.parse(content);
    
    return result.transactions || [];
  } catch (error) {
    console.error('Image analysis error:', error);
    throw new Error('Failed to analyze image with AI');
  }
}

