import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const importType = formData.get('importType') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!importType || !['expenses', 'debts'].includes(importType)) {
      return NextResponse.json({ error: 'Invalid import type' }, { status: 400 });
    }

    console.log(`📄 Analyzing file: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} KB)`);

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
    }

    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    const isImage = fileType.startsWith('image/');
    const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf');
    const isExcel = fileType.includes('spreadsheet') || fileType.includes('excel') ||
                    fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv');

    if (!isImage && !isPDF && !isExcel) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please use PDF, Excel/CSV, or image (JPG/PNG)' },
        { status: 400 }
      );
    }

    // Excel/CSV
    if (isExcel) {
      console.log('📊 Processing Excel/CSV...');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const csvText = XLSX.utils.sheet_to_csv(worksheet);
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const extractedText = `Excel Data:\n${csvText}\n\nRows: ${jsonData.length}`;
      console.log(`✅ Excel parsed: ${jsonData.length} rows`);

      return await analyzeTextWithAI(extractedText, importType, 'excel');
    }

    // PDF & Images - Use GPT-4o Vision for both
    console.log(`🤖 Analyzing ${isPDF ? 'PDF' : 'image'} with GPT-4o Vision...`);
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${fileType};base64,${base64}`;

    return await analyzeImageWithAI(dataUrl, importType, isPDF ? 'pdf' : 'image');

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// ניתוח טקסט (PDF/Excel) עם GPT-4o
async function analyzeTextWithAI(text: string, importType: string, source: 'pdf' | 'excel') {
  const systemPrompt = `אתה מומחה לניתוח דוחות פיננסיים ישראליים.
החזר ONLY JSON תקני. confidence: 0.9 = בטוח, 0.7 = סביר, 0.5 = לא בטוח.`;

  const userPrompt = importType === 'expenses'
    ? `נתח את הטקסט הבא וחלץ הוצאות קבועות חודשיות:

${text.substring(0, 5000)}

זהה: דיור, ביטוחים, פנסיה, ליסינג, חינוך, תקשורת, מנויים.

החזר JSON:
{
  "rent_mortgage": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "insurance": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "cellular": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "pension_funds": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "leasing": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "education": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "subscriptions": {"value": <number>, "confidence": <0-1>, "source": "<text>"}
}`
    : `נתח את הטקסט הבא וחלץ חובות ונכסים:

${text.substring(0, 5000)}

החזר JSON:
{
  "current_account_balance": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "credit_card_debt": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "bank_loans": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "current_savings": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "investments": {"value": <number>, "confidence": <0-1>, "source": "<text>"}
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    const detected = JSON.parse(content);
    
    console.log(`✅ GPT-4o (${source}) Analysis:`, detected);

    return NextResponse.json({
      success: true,
      detected,
      confidence: calculateConfidence(detected),
      model: 'gpt-4o',
      tokens: response.usage?.total_tokens || 0,
      source
    });
  } catch (error: any) {
    console.error('❌ AI error:', error);
    return NextResponse.json({ error: error.message || 'AI analysis failed' }, { status: 400 });
  }
}

// ניתוח תמונה/PDF עם GPT-4o Vision
async function analyzeImageWithAI(dataUrl: string, importType: string, source: 'image' | 'pdf' = 'image') {
  const systemPrompt = `אתה מומחה לניתוח דוחות פיננסיים ישראליים.
החזר ONLY JSON תקני. confidence: 0.9 = בטוח, 0.7 = סביר, 0.5 = לא בטוח.`;

  const userPrompt = importType === 'expenses'
    ? `נתח את דוח הבנק בתמונה וחלץ הוצאות קבועות חודשיות.

זהה: דיור, ביטוחים, פנסיה, ליסינג, חינוך, תקשורת, מנויים.

החזר JSON:
{
  "rent_mortgage": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "insurance": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "cellular": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "pension_funds": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "leasing": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "education": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "subscriptions": {"value": <number>, "confidence": <0-1>, "source": "<text>"}
}`
    : `נתח את דוח הבנק בתמונה וחלץ חובות ונכסים.

החזר JSON:
{
  "current_account_balance": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "credit_card_debt": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "bank_loans": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "current_savings": {"value": <number>, "confidence": <0-1>, "source": "<text>"},
  "investments": {"value": <number>, "confidence": <0-1>, "source": "<text>"}
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    const detected = JSON.parse(content);
    
    console.log('✅ GPT-4o Vision Analysis:', detected);

    return NextResponse.json({
      success: true,
      detected,
      confidence: calculateConfidence(detected),
      model: 'gpt-4o-vision',
      tokens: response.usage?.total_tokens || 0,
      source
    });
  } catch (error: any) {
    console.error('❌ Vision error:', error);
    
    if (error.code === 'invalid_api_key') {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }
    if (error.code === 'insufficient_quota') {
      return NextResponse.json({ error: 'OpenAI quota exceeded' }, { status: 429 });
    }
    
    return NextResponse.json({ error: error.message || 'Vision analysis failed' }, { status: 400 });
  }
}

function calculateConfidence(detected: any): number {
  const confidences = Object.values(detected)
    .map((item: any) => item?.confidence || 0)
    .filter(c => c > 0);
  
  if (confidences.length === 0) return 0;
  return Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100;
}
