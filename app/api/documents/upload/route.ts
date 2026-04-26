import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkApiRateLimit } from '@/lib/utils/api-rate-limiter';

/**
 * API Route: /api/documents/upload
 * מטרה: העלאת מסמכים פיננסיים (דוחות בנק, אשראי, תלושים, וכו')
 */
export async function POST(request: NextRequest) {
  try {
    const limited = checkApiRateLimit(request, 10, 60_000);
    if (limited) return limited;
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
    const statementMonth = formData.get('statementMonth') as string; // ⭐ חודש המסמך (YYYY-MM) - חובה!

    console.log('📤 Upload request:', {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      documentType,
      statementMonth,
      userId: user.id,
    });

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // ✅ Validation: חודש המסמך הוא חובה!
    if (!statementMonth) {
      return NextResponse.json({ 
        error: 'חודש המסמך הוא חובה. אנא בחר את החודש של המסמך.' 
      }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['bank', 'credit', 'payslip', 'pension', 'pension_clearing', 'insurance', 'loan', 'investment', 'savings', 'receipt', 'mortgage', 'bank_statement', 'credit_statement'];
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
      'pension_clearing': 'pension_report',
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

    // Calculate period_start and period_end from statementMonth
    // statementMonth format: "YYYY-MM"
    const [year, month] = statementMonth.split('-').map(Number);
    // First day of month
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    // Last day of month
    const lastDay = new Date(year, month, 0).getDate(); // month is 1-based, so month+0 gives us last day of previous month+1
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    
    // Convert statementMonth to DATE format for database (YYYY-MM-DD, first day of month)
    const statementMonthDate = `${year}-${String(month).padStart(2, '0')}-01`;
    
    console.log('📅 Statement period:', { statementMonth, periodStart, periodEnd, statementMonthDate });

    // Determine if this is a source document (only bank statements are source)
    const isSourceDocument = documentType === 'bank' || documentType === 'bank_statement';

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
        period_start: periodStart, // ⭐ תחילת תקופת הדוח
        period_end: periodEnd,     // ⭐ סוף תקופת הדוח
        statement_month: statementMonthDate, // ⭐ חודש המסמך (DATE format)
        is_source_document: isSourceDocument, // ⭐ רק דוח בנק הוא source
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
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET || '',
        },
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

