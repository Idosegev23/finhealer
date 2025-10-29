import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { EXPENSE_CATEGORIES_SYSTEM_PROMPT, buildStatementAnalysisPrompt } from '@/lib/ai/expense-categories-prompt';
import { getGreenAPIClient } from '@/lib/greenapi/client';

// ⚡️ Vercel Background Function Configuration
export const maxDuration = 300; // 5 minutes (Pro plan)
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Vercel Background Function לעיבוד מסמכים
 * מחליף את Inngest - פשוט יותר ומהיר יותר!
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { statementId } = await request.json();
    
    console.log(`🚀 [BG] Processing document: ${statementId}`);

    // Create service role client (bypass RLS)
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Get statement info
    const { data: statement, error: stmtError } = await supabase
      .from('uploaded_statements')
      .select('*')
      .eq('id', statementId)
      .single();

    if (stmtError || !statement) {
      throw new Error(`Statement not found: ${statementId}`);
    }

    const stmt = statement as any;
    console.log(`📄 Processing: ${stmt.file_name} (${stmt.file_type})`);

    // 2. Update status to processing
    await supabase
      .from('uploaded_statements')
      .update({ status: 'processing' })
      .eq('id', statementId);

    // 3. Download file from Storage
    console.log(`📥 Downloading from Storage: ${stmt.file_url}`);
    
    const url = new URL(stmt.file_url);
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/[^\/]+\/(.+)$/);
    if (!pathMatch) {
      throw new Error('Invalid file URL format');
    }
    const filePath = pathMatch[1];

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('financial-documents')
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    console.log(`✅ Downloaded: ${buffer.length} bytes`);

    // 4. Analyze with AI
    let transactions: any[] = [];
    
    if (stmt.mime_type?.includes('pdf')) {
      console.log('🤖 Analyzing PDF with GPT-5...');
      transactions = await analyzePDFWithAI(buffer, stmt.file_type, stmt.file_name);
    } else if (stmt.mime_type?.includes('image')) {
      console.log('🤖 Analyzing image with GPT-5...');
      const result = await analyzeImageWithAI(buffer, stmt.mime_type, stmt.document_type);
      transactions = result.transactions;
    } else if (stmt.mime_type?.includes('spreadsheet') || stmt.mime_type?.includes('excel')) {
      console.log('📊 Analyzing Excel...');
      // TODO: Excel parsing
      transactions = [];
    }

    console.log(`✅ AI found ${transactions.length} transactions`);

    // 5. Save transactions
    if (transactions.length > 0) {
      const transactionsToInsert = transactions.map((tx: any) => ({
        user_id: stmt.user_id,
        type: 'expense',
        amount: Math.abs(parseFloat(tx.amount)) || 0,
        category: tx.category || 'other',
        vendor: tx.vendor || tx.description || 'לא צוין',
        date: tx.date || new Date().toISOString(),
        source: 'ocr',
        status: 'proposed', // ממתין לאישור!
        notes: tx.notes || tx.description,
        payment_method: tx.payment_method || 'credit_card',
        expense_category: tx.expense_category || tx.category,
        expense_type: tx.expense_type || 'variable',
        confidence_score: tx.confidence_score || 0.8,
      }));

      const { error: insertError } = await (supabase as any)
        .from('transactions')
        .insert(transactionsToInsert);

      if (insertError) {
        console.error('Failed to insert transactions:', insertError);
      } else {
        console.log(`💾 Saved ${transactions.length} transactions`);
      }
    }

    // 6. Update statement status
    await supabase
      .from('uploaded_statements')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        transactions_extracted: transactions.length,
      })
      .eq('id', statementId);

    // 7. Send WhatsApp notification
    await sendWhatsAppNotification(stmt.user_id, transactions.length);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [BG] Completed in ${duration}s`);

    return NextResponse.json({
      success: true,
      transactions: transactions.length,
      duration: `${duration}s`,
    });

  } catch (error: any) {
    console.error('❌ [BG] Processing error:', error);
    
    // Update status to failed
    if (request.json) {
      const { statementId } = await request.json();
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      await supabase
        .from('uploaded_statements')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', statementId);
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// AI Analysis Functions
// ============================================================================

async function analyzePDFWithAI(buffer: Buffer, fileType: string, fileName: string) {
  const userPrompt = buildStatementAnalysisPrompt(
    fileType as 'bank_statement' | 'credit_statement',
    'PDF'
  );

  try {
    // וידוא שהשם מסתיים ב-.pdf
    const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    const simpleFileName = safeName.split('/').pop() || 'document.pdf';
    
    console.log('📁 File name for OpenAI:', simpleFileName);
    
    const file = await openai.files.create({
      file: new File([new Uint8Array(buffer)], simpleFileName, { type: 'application/pdf' }),
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

    // Delete file from OpenAI
    try {
      await openai.files.delete(file.id);
      console.log('🗑️ File deleted from OpenAI');
    } catch (deleteError) {
      console.warn('Failed to delete file:', deleteError);
    }

    const content = response.output_text || '{"transactions":[]}';
    const result = JSON.parse(content);
    
    return result.transactions || [];
  } catch (error: any) {
    console.error('❌ PDF analysis error:', error);
    console.error('Error details:', {
      message: error?.message,
      status: error?.status,
      type: error?.type,
    });
    throw new Error(`Failed to analyze PDF: ${error?.message || 'Unknown error'}`);
  }
}

async function analyzeImageWithAI(buffer: Buffer, mimeType: string, documentType: string) {
  const userPrompt = buildStatementAnalysisPrompt(
    documentType as 'bank_statement' | 'credit_statement',
    'תמונה'
  );

  try {
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
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
            { type: 'input_image', image_url: dataUrl },
          ],
        },
      ],
    });

    const content = response.output_text || '{"transactions":[]}';
    const result = JSON.parse(content);
    
    return {
      transactions: result.transactions || [],
      extractedText: 'תמונה מנותחת',
    };
  } catch (error: any) {
    console.error('❌ Image analysis error:', error);
    throw new Error(`Failed to analyze image: ${error?.message || 'Unknown error'}`);
  }
}

async function sendWhatsAppNotification(userId: string, transactionsCount: number) {
  try {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: userData } = await supabase
      .from('users')
      .select('phone_number, name')
      .eq('id', userId)
      .single();

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

    console.log(`✅ WhatsApp sent to ${user.phone_number}`);
  } catch (error) {
    console.error('Failed to send WhatsApp:', error);
  }
}

