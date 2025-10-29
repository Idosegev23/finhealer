import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { getPromptForDocumentType } from '@/lib/ai/document-prompts';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import pdfParse from 'pdf-parse';

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

    // 4. Analyze with AI based on document type
    let result: any = {};
    let itemsProcessed = 0;
    
    if (stmt.mime_type?.includes('pdf')) {
      console.log(`🤖 Analyzing PDF (${stmt.file_type}) with GPT-5...`);
      result = await analyzePDFWithAI(buffer, stmt.file_type, stmt.file_name);
    } else if (stmt.mime_type?.includes('image')) {
      console.log('🤖 Analyzing image with GPT-5...');
      result = await analyzeImageWithAI(buffer, stmt.mime_type, stmt.file_type);
    } else if (stmt.mime_type?.includes('spreadsheet') || stmt.mime_type?.includes('excel')) {
      console.log('📊 Analyzing Excel...');
      // TODO: Excel parsing
      result = { transactions: [] };
    }

    console.log(`✅ AI analysis complete:`, result);

    // 5. Save data to appropriate table(s) based on document type
    const docType = stmt.file_type?.toLowerCase() || '';

    if (docType.includes('credit') || docType.includes('bank')) {
      // Credit/Bank statements → transactions table
      itemsProcessed = await saveTransactions(supabase, result, stmt.user_id, statementId);
    } else if (docType.includes('loan') || docType.includes('mortgage')) {
      // Loan/Mortgage statements → loans table
      itemsProcessed = await saveLoans(supabase, result, stmt.user_id, statementId);
    } else if (docType.includes('insurance')) {
      // Insurance statements → insurance table
      itemsProcessed = await saveInsurance(supabase, result, stmt.user_id, statementId);
    } else {
      console.warn(`Unknown document type: ${docType}, defaulting to transactions`);
      itemsProcessed = await saveTransactions(supabase, result, stmt.user_id, statementId);
    }

    // 6. Update statement status
    await supabase
      .from('uploaded_statements')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        transactions_extracted: itemsProcessed,
      })
      .eq('id', statementId);

    // 7. Send WhatsApp notification
    await sendWhatsAppNotification(stmt.user_id, itemsProcessed, docType);

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
  try {
    // 1. Extract text from PDF using pdf-parse
    console.log('📝 Extracting text from PDF...');
    const pdfData = await pdfParse(buffer);
    const extractedText = pdfData.text;
    
    console.log(`✅ Text extracted: ${extractedText.length} characters, ${pdfData.numpages} pages`);
    
    // 2. Get appropriate prompt for document type
    const prompt = getPromptForDocumentType(fileType, extractedText);
    
    // 3. Analyze with GPT-5 using Responses API
    console.log(`🤖 Analyzing with GPT-5 (${fileType})...`);
    
    const response = await (openai.responses as any).create({
      model: 'gpt-5',
      input: prompt,
      reasoning: { effort: 'medium' },
      text: { verbosity: 'medium' },
      max_output_tokens: 16000,
    });

    console.log(`✅ GPT-5 analysis complete`);
    
    const content = response.output_text || '{}';
    
    // Parse JSON
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (match) jsonStr = match[1];
    } else {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) jsonStr = match[0];
    }
    
    const result = JSON.parse(jsonStr);
    
    return result;
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
  try {
    console.log(`🖼️  Analyzing image with GPT-5 (${documentType})...`);
    
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    // Get appropriate prompt (images are usually credit/bank/receipt)
    const prompt = getPromptForDocumentType(documentType, '');
    
    // For images, we use input_image in Responses API
    const response = await (openai.responses as any).create({
      model: 'gpt-5',
      input: [
        {
          type: 'input_text',
          text: prompt,
        },
        {
          type: 'input_image',
          image_url: dataUrl,
        },
      ],
      reasoning: { effort: 'low' }, // Images usually simpler
      text: { verbosity: 'low' },
      max_output_tokens: 4000,
    });

    console.log(`✅ GPT-5 image analysis complete`);
    
    const content = response.output_text || '{}';
    
    // Parse JSON
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (match) jsonStr = match[1];
    } else {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) jsonStr = match[0];
    }
    
    const result = JSON.parse(jsonStr);
    
    return result;
  } catch (error: any) {
    console.error('❌ Image analysis error:', error);
    throw new Error(`Failed to analyze image: ${error?.message || 'Unknown error'}`);
  }
}

// ============================================================================
// Save Functions - Save to appropriate table based on document type
// ============================================================================

/**
 * Save transactions from credit/bank statements
 */
async function saveTransactions(supabase: any, result: any, userId: string, documentId: string): Promise<number> {
  try {
    // Extract transactions from various result formats
    let allTransactions: any[] = [];
    
    if (result.transactions && Array.isArray(result.transactions)) {
      // Credit statement format: { transactions: [...] }
      allTransactions = result.transactions;
    } else if (result.transactions && typeof result.transactions === 'object') {
      // Bank statement format: { transactions: { income: [...], expenses: [...], ... } }
      const { income, expenses, loan_payments, savings_transfers } = result.transactions;
      
      if (income) allTransactions.push(...income.map((tx: any) => ({ ...tx, type: 'income' })));
      if (expenses) allTransactions.push(...expenses.map((tx: any) => ({ ...tx, type: 'expense' })));
      if (loan_payments) allTransactions.push(...loan_payments.map((tx: any) => ({ ...tx, type: 'expense', category: 'loan_payment' })));
      if (savings_transfers) allTransactions.push(...savings_transfers.map((tx: any) => ({ ...tx, type: 'expense', category: 'savings' })));
    }

    if (allTransactions.length === 0) {
      console.log('No transactions to save');
      return 0;
    }

    const transactionsToInsert = allTransactions.map((tx: any) => {
      // Parse date from DD/MM/YYYY to YYYY-MM-DD
      let parsedDate = new Date().toISOString().split('T')[0];
      if (tx.date) {
        try {
          const parts = tx.date.split('/');
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            let year = parts[2];
            if (year.length === 2) {
              year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
            }
            parsedDate = `${year}-${month}-${day}`;
          }
        } catch (e) {
          console.warn(`Failed to parse date: ${tx.date}`, e);
        }
      }

      return {
        user_id: userId,
        type: tx.type || 'expense',
        amount: Math.abs(parseFloat(tx.amount)) || 0,
        category: tx.category || 'other',
        vendor: tx.vendor || tx.description || 'לא צוין',
        date: parsedDate,
        tx_date: parsedDate,
        source: 'ocr',
        status: 'proposed', // Pending user approval
        notes: tx.installment 
          ? `${tx.notes || tx.description || ''} ${tx.installment}`.trim() 
          : (tx.notes || tx.description || null),
        payment_method: tx.payment_method || 'credit_card',
        expense_type: tx.type === 'הוראת קבע' 
          ? 'fixed' 
          : tx.type === 'תשלום' || tx.type === 'קרדיט'
            ? 'installment'
            : 'variable',
        confidence_score: tx.confidence_score || 0.85,
        document_id: documentId,
        original_description: tx.vendor || tx.description,
        auto_categorized: true,
        is_recurring: tx.type === 'הוראת קבע',
        currency: 'ILS',
      };
    });

    const { error } = await supabase
      .from('transactions')
      .insert(transactionsToInsert);

    if (error) {
      console.error('Failed to insert transactions:', error);
      throw error;
    }

    console.log(`💾 Saved ${transactionsToInsert.length} transactions`);
    return transactionsToInsert.length;
  } catch (error) {
    console.error('Error in saveTransactions:', error);
    throw error;
  }
}

/**
 * Save loans from loan/mortgage statements
 */
async function saveLoans(supabase: any, result: any, userId: string, documentId: string): Promise<number> {
  try {
    let loansToInsert: any[] = [];
    
    // Check if it's a mortgage statement (with tracks) or regular loan statement
    if (result.tracks && Array.isArray(result.tracks)) {
      // Mortgage: multiple tracks → multiple loans
      loansToInsert = result.tracks.map((track: any) => {
        // Parse remaining_payments (format: "40/120")
        let remainingMonths = null;
        if (track.remaining_payments) {
          const match = track.remaining_payments.match(/(\d+)\/(\d+)/);
          if (match) {
            const paid = parseInt(match[1]);
            const total = parseInt(match[2]);
            remainingMonths = total - paid;
          }
        }

        return {
          user_id: userId,
          loan_type: 'mortgage',
          lender: 'בנק', // Could be extracted from report_info
          original_amount: parseFloat(track.original_amount) || 0,
          current_balance: parseFloat(track.current_balance) || 0,
          interest_rate: parseFloat(track.interest_rate) || 0,
          monthly_payment: parseFloat(track.monthly_payment) || 0,
          remaining_months: remainingMonths,
          status: 'active',
          metadata: {
            track_number: track.track_number,
            track_type: track.track_type,
            index_type: track.index_type,
            remaining_payments: track.remaining_payments,
            document_id: documentId,
            report_info: result.report_info,
          },
        };
      });
    } else if (result.loans && Array.isArray(result.loans)) {
      // Regular loan statement
      loansToInsert = result.loans.map((loan: any) => {
        let remainingMonths = null;
        if (loan.remaining_payments) {
          const match = loan.remaining_payments.match(/(\d+)\/(\d+)/);
          if (match) {
            const paid = parseInt(match[1]);
            const total = parseInt(match[2]);
            remainingMonths = total - paid;
          }
        }

        return {
          user_id: userId,
          loan_type: 'personal',
          lender: loan.loan_provider || 'לא צוין',
          original_amount: parseFloat(loan.original_amount) || 0,
          current_balance: parseFloat(loan.outstanding_balance) || 0,
          interest_rate: parseFloat(loan.annual_interest_rate) || 0,
          monthly_payment: parseFloat(loan.next_payment_amount) || 0,
          remaining_months: remainingMonths,
          status: 'active',
          metadata: {
            loan_number: loan.loan_number,
            loan_name: loan.loan_name,
            remaining_payments: loan.remaining_payments,
            document_id: documentId,
            report_info: result.report_info,
          },
        };
      });
    }

    if (loansToInsert.length === 0) {
      console.log('No loans to save');
      return 0;
    }

    const { error } = await supabase
      .from('loans')
      .insert(loansToInsert);

    if (error) {
      console.error('Failed to insert loans:', error);
      throw error;
    }

    console.log(`💾 Saved ${loansToInsert.length} loans`);
    return loansToInsert.length;
  } catch (error) {
    console.error('Error in saveLoans:', error);
    throw error;
  }
}

/**
 * Save insurance policies from insurance statements
 */
async function saveInsurance(supabase: any, result: any, userId: string, documentId: string): Promise<number> {
  try {
    if (!result.insurance_policies || result.insurance_policies.length === 0) {
      console.log('No insurance policies to save');
      return 0;
    }

    const policiesToInsert = result.insurance_policies.map((policy: any) => {
      // Parse coverage_period (format: "01/05/2025 - 30/04/2026" or "לכל החיים")
      let startDate = null;
      let endDate = null;
      if (policy.coverage_period && policy.coverage_period !== 'לכל החיים') {
        const dates = policy.coverage_period.split(' - ');
        if (dates.length === 2) {
          startDate = parseDateToISO(dates[0]);
          endDate = parseDateToISO(dates[1]);
        }
      }

      // Determine policy_type from main_branch
      let policyType = 'other';
      if (policy.main_branch?.includes('דירה')) policyType = 'property';
      else if (policy.main_branch?.includes('בריאות')) policyType = 'health';
      else if (policy.main_branch?.includes('חיים')) policyType = 'life';
      else if (policy.main_branch?.includes('סיעודי')) policyType = 'health';

      // Determine if premium is monthly or annual
      const isMonthly = policy.premium_type === 'חודשית';
      const monthlyPremium = isMonthly ? parseFloat(policy.premium_amount) || 0 : null;
      const annualPremium = !isMonthly ? parseFloat(policy.premium_amount) || 0 : null;

      return {
        user_id: userId,
        policy_type: policyType,
        provider: policy.insurance_company,
        policy_number: policy.policy_number || null,
        monthly_premium: monthlyPremium,
        annual_premium: annualPremium,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        coverage_details: {
          domain: policy.domain,
          main_branch: policy.main_branch,
          sub_branch: policy.sub_branch,
          product_type: policy.product_type,
          premium_type: policy.premium_type,
          document_id: documentId,
          report_info: result.report_info,
        },
        metadata: {
          document_id: documentId,
        },
      };
    });

    const { error } = await supabase
      .from('insurance')
      .insert(policiesToInsert);

    if (error) {
      console.error('Failed to insert insurance:', error);
      throw error;
    }

    console.log(`💾 Saved ${policiesToInsert.length} insurance policies`);
    return policiesToInsert.length;
  } catch (error) {
    console.error('Error in saveInsurance:', error);
    throw error;
  }
}

// Helper: Parse DD/MM/YYYY to YYYY-MM-DD
function parseDateToISO(dateStr: string): string | null {
  try {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) {
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    console.warn(`Failed to parse date: ${dateStr}`, e);
  }
  return null;
}

// ============================================================================
// WhatsApp Notification
// ============================================================================

async function sendWhatsAppNotification(userId: string, itemsCount: number, docType: string) {
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
    
    // Customize message based on document type
    let message = '';
    let url = 'https://finhealer.vercel.app/dashboard';
    
    if (docType.includes('credit') || docType.includes('bank')) {
      url = 'https://finhealer.vercel.app/dashboard/expenses/pending';
      message = `היי ${userName}! 🎉\n\nסיימתי לעבד את הדוח שהעלית.\nמצאתי ${itemsCount} תנועות שממתינות לאישור שלך.\n\n👉 היכנס לאתר כדי לאשר: ${url}\n\nתודה! 💙`;
    } else if (docType.includes('loan') || docType.includes('mortgage')) {
      message = `היי ${userName}! 🏦\n\nסיימתי לעבד את דוח ההלוואות.\nמצאתי ${itemsCount} הלוואות/מסלולים.\n\n👉 צפה בפירוט: ${url}\n\nתודה! 💙`;
    } else if (docType.includes('insurance')) {
      message = `היי ${userName}! 🛡️\n\nסיימתי לעבד את דוח הביטוחים.\nמצאתי ${itemsCount} פוליסות ביטוח.\n\n👉 צפה בפירוט: ${url}\n\nתודה! 💙`;
    } else {
      message = `היי ${userName}! 📄\n\nסיימתי לעבד את המסמך שהעלית.\nמצאתי ${itemsCount} פריטים.\n\n👉 צפה בפירוט: ${url}\n\nתודה! 💙`;
    }
    
    await greenAPI.sendMessage({
      phoneNumber: user.phone_number,
      message,
    });

    console.log(`✅ WhatsApp sent to ${user.phone_number}`);
  } catch (error) {
    console.error('Failed to send WhatsApp:', error);
  }
}

