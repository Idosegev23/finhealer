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

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['bank', 'credit', 'payslip', 'pension', 'insurance', 'loan', 'investment', 'savings', 'receipt'];
    if (!validTypes.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('financial-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('financial-documents')
      .getPublicUrl(fileName);

    // Create uploaded_statements record
    const { data: statement, error: dbError } = await supabase
      .from('uploaded_statements')
      .insert({
        user_id: user.id,
        file_name: file.name,
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
      return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
    }

    // TODO: Trigger Inngest background processing
    // await inngest.send({
    //   name: 'document.process',
    //   data: {
    //     statementId: statement.id,
    //     userId: user.id,
    //     documentType,
    //   },
    // });

    return NextResponse.json({
      success: true,
      statementId: statement.id,
      fileName: file.name,
      fileSize: file.size,
      status: 'pending',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

