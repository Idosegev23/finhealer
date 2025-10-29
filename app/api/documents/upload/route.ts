import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route: /api/documents/upload
 * מטרה: העלאת מסמכים פיננסיים (דוחות בנק, אשראי, תלושים, וכו')
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string;

    console.log('📤 Upload request:', {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      documentType,
      userId: user.id,
    });

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['bank', 'credit', 'payslip', 'pension', 'insurance', 'loan', 'investment', 'savings', 'receipt', 'mortgage', 'bank_statement', 'credit_statement'];
    if (!validTypes.includes(documentType)) {
      console.error('Invalid document type:', documentType);
      return NextResponse.json({ error: `Invalid document type: ${documentType}` }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('📦 Buffer created:', buffer.length, 'bytes');

    // Upload to Supabase Storage
    // יצירת שם קובץ safe (בלי תווים מיוחדים)
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const timestamp = Date.now();
    const safeFileName = `${user.id}/${timestamp}.${fileExtension}`;
    
    console.log('☁️ Uploading to Storage:', {
      bucket: 'financial-documents',
      path: safeFileName,
      originalName: file.name,
      size: buffer.length,
      contentType: file.type,
    });

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('financial-documents')
      .upload(safeFileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ 
        error: 'Failed to upload file', 
        details: uploadError.message || uploadError 
      }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('financial-documents')
      .getPublicUrl(safeFileName);

    // Map documentType to file_type
    const fileTypeMap: Record<string, string> = {
      'bank': 'bank_statement',
      'credit': 'credit_statement',
      'payslip': 'salary_slip',
      'pension': 'pension_report',
      'insurance': 'insurance_report',
      'loan': 'loan_statement',
      'investment': 'investment_report',
      'savings': 'savings_statement',
      'receipt': 'receipt',
      'mortgage': 'loan_statement', // משכנתא זה סוג של הלוואה
      'bank_statement': 'bank_statement',
      'credit_statement': 'credit_statement',
    };
    const fileType = fileTypeMap[documentType] || 'other';

    // Create uploaded_statements record
    const { data: statement, error: dbError } = await (supabase as any)
      .from('uploaded_statements')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_type: fileType,
        document_type: documentType,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ 
        error: 'Failed to create record',
        details: dbError.message || dbError.code || dbError 
      }, { status: 500 });
    }

    console.log('✅ Upload completed:', {
      statementId: statement.id,
      fileName: file.name,
      fileType: fileType,
      status: 'processing',
    });

    // 🚀 Trigger Vercel Background Function
    console.log('🔔 Starting background processing:', {
      statementId: statement.id,
      fileUrl: publicUrl,
    });

    try {
      // קריאה אסינכרונית ל-Background Function (לא ממתינים לתוצאה)
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://finhealer.vercel.app'}/api/documents/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementId: statement.id }),
      }).catch((error) => {
        console.error('Failed to trigger background processing:', error);
      });
      
      console.log('✅ Background processing started');
    } catch (error: any) {
      console.error('❌ Failed to start background processing:', error);
      // Continue - don't fail the upload
    }

    return NextResponse.json({
      success: true,
      statementId: statement.id,
      fileName: file.name,
      fileSize: file.size,
      status: 'processing',
      message: 'קובץ הועלה ונשלח לעיבוד',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

