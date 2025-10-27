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

    // יצירת Signed URL (תקף ל-1 שעה)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('financial-documents')
      .createSignedUrl(sanitizedFileName, 3600); // 1 hour

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Signed URL error:', signedUrlError);
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 });
    }

    const fileUrl = signedUrlData.signedUrl;
    console.log('✅ Signed URL created (valid for 1 hour)');

    // שלב 2: יצירת רשומה ב-uploaded_statements
    const { data: statement, error: statementError } = await supabase
      .from('uploaded_statements')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_type: fileType || 'bank_statement',
        file_url: fileUrl,
        file_size: file.size,
        status: 'processing',
      })
      .select()
      .single();

    if (statementError) {
      console.error('DB error:', statementError);
      return NextResponse.json({ error: 'Failed to create statement record' }, { status: 500 });
    }

    // שלב 3: שליחת event ל-Inngest לעיבוד ברקע
    console.log(`🚀 Sending statement to Inngest: ${statement.id}`);
    
    const { inngest } = await import('@/lib/inngest/client');
    
    await inngest.send({
      name: 'statement.process',
      data: {
        statementId: statement.id,
        userId: user.id,
        mimeType: file.type,
        fileName: file.name,
        fileType: fileType || 'bank_statement',
      },
    });

    console.log(`✅ Event sent to Inngest for statement: ${statement.id}`);

    // החזרת תגובה מיידית
    return NextResponse.json({
      success: true,
      message: 'הקובץ מעובד כעת... תקבל עדכון כשמוכן 🚀',
      statementId: statement.id,
      status: 'processing',
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to process file' 
    }, { status: 500 });
  }
}
