import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { getPromptForDocumentType } from '@/lib/ai/document-prompts';
import { getGreenAPIClient } from '@/lib/greenapi/client';

// ⚡️ Vercel Background Function Configuration
export const runtime = 'nodejs'; // Force Node.js runtime
export const maxDuration = 300; // 5 minutes (Pro plan)
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 240000, // 4 minutes timeout for OpenAI (leave 1 min buffer)
  maxRetries: 2, // Retry twice on failure
});

/**
 * Vercel Background Function לעיבוד מסמכים
 * מחליף את Inngest - פשוט יותר ומהיר יותר!
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let statementId: string = '';
  
  try {
    const body = await request.json();
    statementId = body.statementId;
    
    if (!statementId) {
      throw new Error('Missing statementId in request body');
    }
    
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

    // 2. Update status to processing with progress
    await supabase
      .from('uploaded_statements')
      .update({ 
        status: 'processing',
        processing_stage: 'downloading',
        progress_percent: 10
      })
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

    // Update progress
    await supabase
      .from('uploaded_statements')
      .update({ 
        processing_stage: 'analyzing',
        progress_percent: 30
      })
      .eq('id', statementId);

    // 4. Analyze with AI based on document type
    let result: any = {};
    let itemsProcessed = 0;
    
    if (stmt.mime_type?.includes('pdf')) {
      console.log(`🤖 Analyzing PDF (${stmt.file_type}) with GPT-4o...`);
      result = await analyzePDFWithAI(buffer, stmt.file_type, stmt.file_name);
    } else if (stmt.mime_type?.includes('image')) {
      console.log('🤖 Analyzing image with GPT-4o Vision...');
      result = await analyzeImageWithAI(buffer, stmt.mime_type, stmt.file_type);
    } else if (stmt.mime_type?.includes('spreadsheet') || stmt.mime_type?.includes('excel')) {
      console.log('📊 Analyzing Excel...');
      // TODO: Excel parsing
      result = { transactions: [] };
    }

    console.log(`✅ AI analysis complete:`, result);

    // Update progress
    await supabase
      .from('uploaded_statements')
      .update({ 
        processing_stage: 'saving',
        progress_percent: 70
      })
      .eq('id', statementId);

    // 5. Save data to appropriate table(s) based on document type
    const docType = stmt.file_type?.toLowerCase() || '';

    if (docType.includes('credit')) {
      // Credit statements → transactions table only
      itemsProcessed = await saveTransactions(supabase, result, stmt.user_id, statementId as string, docType);
    } else if (docType.includes('bank')) {
      // Bank statements → transactions + bank_accounts + loans + update user profile
      const txCount = await saveTransactions(supabase, result, stmt.user_id, statementId as string, docType);
      const accountCount = await saveBankAccounts(supabase, result, stmt.user_id, statementId as string);
      const loanCount = await saveLoanPaymentsAsLoans(supabase, result, stmt.user_id);
      await updateUserFinancialProfile(supabase, result, stmt.user_id);
      itemsProcessed = txCount + accountCount + loanCount;
    } else if (docType.includes('payslip') || docType.includes('salary') || docType.includes('תלוש')) {
      // Payslips → payslips table + income transaction
      itemsProcessed = await savePayslips(supabase, result, stmt.user_id, statementId as string);
    } else if (docType.includes('loan') || docType.includes('mortgage')) {
      // Loan/Mortgage statements → loans table
      itemsProcessed = await saveLoans(supabase, result, stmt.user_id, statementId as string);
    } else if (docType.includes('insurance')) {
      // Insurance statements → insurance table
      itemsProcessed = await saveInsurance(supabase, result, stmt.user_id, statementId as string);
    } else if (docType.includes('pension') || docType.includes('פנסיה') || docType.includes('מסלקה')) {
      // Pension statements → pensions table
      itemsProcessed = await savePensions(supabase, result, stmt.user_id, statementId as string);
    } else {
      console.warn(`Unknown document type: ${docType}, defaulting to transactions`);
      itemsProcessed = await saveTransactions(supabase, result, stmt.user_id, statementId as string, docType);
    }

    // 6. Update statement status
    await supabase
      .from('uploaded_statements')
      .update({
        status: 'completed',
        processing_stage: 'completed',
        progress_percent: 100,
        processed_at: new Date().toISOString(),
        transactions_extracted: itemsProcessed,
        error_message: null,
        retry_count: 0,
      })
      .eq('id', statementId);

    // 7. Send WhatsApp notification
    await sendWhatsAppNotification(stmt.user_id, itemsProcessed, docType);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [BG] Completed in ${duration}s`);

    return NextResponse.json({
      success: true,
      itemsProcessed: itemsProcessed,
      duration: `${duration}s`,
    });

  } catch (error: any) {
    console.error('❌ [BG] Processing error:', error);
    
    // Update status to failed with retry logic
    if (statementId) {
      try {
        const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
        const supabase = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        // Get current retry count
        const { data: stmt } = await supabase
          .from('uploaded_statements')
          .select('retry_count')
          .eq('id', statementId)
          .single();
        
        const retryCount = (stmt?.retry_count || 0) + 1;
        const shouldRetry = retryCount <= 3;
        
        // Determine error type
        const isTimeout = error?.message?.includes('timeout') || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNABORTED';
        const errorMessage = isTimeout 
          ? `Timeout after ${Math.round((Date.now() - startTime) / 1000)}s - GPT-4o לקח יותר מדי זמן. נסה שוב בעוד 5 דקות.`
          : error?.message || 'Unknown error';
        
        await supabase
          .from('uploaded_statements')
          .update({
            status: shouldRetry ? 'pending' : 'failed',
            processing_stage: 'error',
            progress_percent: 0,
            retry_count: retryCount,
            error_message: errorMessage,
            next_retry_at: shouldRetry ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null, // Retry in 5 min
          })
          .eq('id', statementId);
        
        console.log(`📊 Retry count: ${retryCount}/3, Will retry: ${shouldRetry}`);
      } catch (updateError) {
        console.error('Failed to update statement status:', updateError);
      }
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
    // Extract text from PDF using unpdf (serverless-optimized)
    console.log('📝 Extracting text from PDF...');

    // Import unpdf - optimized for serverless/edge environments
    const { getDocumentProxy, extractText } = await import('unpdf');

    // Create document proxy from buffer
    const pdf = await getDocumentProxy(new Uint8Array(buffer));

    // Extract text with merged pages
    const { totalPages, text: extractedText } = await extractText(pdf, { mergePages: true });

    console.log(`✅ Text extracted: ${extractedText.length} characters, ${totalPages} pages`);

    // Load expense categories from database (for bank & credit statements)
    let expenseCategories: Array<{name: string; expense_type: string; category_group: string}> = [];
    if (fileType === 'bank_statement' || fileType === 'credit_statement') {
      // Use the supabase client created at the top of the function
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
      const supabaseClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: categories } = await supabaseClient
        .from('expense_categories')
        .select('name, expense_type, category_group')
        .eq('is_active', true)
        .order('expense_type, category_group, display_order, name');
      
      expenseCategories = categories || [];
      console.log(`📋 Loaded ${expenseCategories.length} expense categories from database`);
    }

    // Get appropriate prompt for document type
    const prompt = getPromptForDocumentType(fileType, extractedText, expenseCategories);
    
    // Analyze with GPT-5 (high reasoning + thinking for complex financial documents)
    console.log(`🤖 Analyzing with GPT-5 (high reasoning + thinking)...`);
    
    const response = await openai.responses.create({
      model: 'gpt-5',
      input: prompt,
      reasoning: { effort: 'high' }, // High reasoning for complex financial analysis
      thinking: true, // Enable thinking/reasoning visibility
      max_output_tokens: 16000,
    });

    console.log(`✅ GPT-5 analysis complete (with reasoning)`);
    
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
    console.log(`🖼️  Analyzing image with GPT-4o Vision (${documentType})...`);
    
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    // Get appropriate prompt (images are usually credit/bank/receipt)
    const prompt = getPromptForDocumentType(documentType, '');
    
    // Note: GPT-5 doesn't support vision yet, so we still use GPT-4o for images
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    console.log(`✅ GPT-4o Vision analysis complete`);
    
    const content = response.choices[0].message.content || '{}';
    
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
async function saveTransactions(supabase: any, result: any, userId: string, documentId: string, documentType: string): Promise<number> {
  try {
    // Extract transactions from various result formats
    let allTransactions: any[] = [];
    let isBankStatement = false;
    
    if (result.transactions && Array.isArray(result.transactions)) {
      // Credit statement format: { transactions: [...] }
      allTransactions = result.transactions;
    } else if (result.transactions && typeof result.transactions === 'object') {
      // Bank statement format: { transactions: { income: [...], expenses: [...], ... } }
      const { income, expenses, loan_payments, savings_transfers } = result.transactions;
      isBankStatement = true; // Bank statements have structured format
      
      if (income) allTransactions.push(...income.map((tx: any) => ({ ...tx, type: 'income' })));
      if (expenses) allTransactions.push(...expenses.map((tx: any) => ({ ...tx, type: 'expense' })));
      if (loan_payments) allTransactions.push(...loan_payments.map((tx: any) => ({ ...tx, type: 'expense', category: 'loan_payment' })));
      if (savings_transfers) allTransactions.push(...savings_transfers.map((tx: any) => ({ ...tx, type: 'expense', category: 'savings' })));
    }

    if (allTransactions.length === 0) {
      console.log('No transactions to save');
      return 0;
    }

    // Get existing loans for matching (for loan payment detection)
    const { data: existingLoans } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true);

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

      // Determine payment method based on transaction type
      const transactionType = tx.type || 'expense';
      let paymentMethod = tx.payment_method;
      
      // Translate Hebrew payment methods to English
      const paymentMethodMap: Record<string, string> = {
        'העברה בנקאית': 'bank_transfer',
        'כרטיס אשראי': 'credit_card',
        'כרטיס חיוב': 'debit_card',
        'מזומן': 'cash',
        'המחאה': 'check',
        'הוראת קבע': 'standing_order',
        'חיוב ישיר': 'direct_debit',
        'ארנק דיגיטלי': 'digital_wallet',
        'ביט': 'bit',
        'פייבוקס': 'paybox',
        'paypal': 'paypal',
        'אחר': 'other',
      };
      
      // Translate if Hebrew
      if (paymentMethod && paymentMethodMap[paymentMethod]) {
        paymentMethod = paymentMethodMap[paymentMethod];
      }
      
      if (!paymentMethod || !['cash', 'credit_card', 'debit_card', 'bank_transfer', 'digital_wallet', 'check', 'paypal', 'bit', 'paybox', 'direct_debit', 'standing_order', 'other'].includes(paymentMethod)) {
        // Default payment methods by transaction type
        if (transactionType === 'income') {
          paymentMethod = 'bank_transfer'; // Income usually comes via bank transfer
        } else if (tx.category === 'loan_payment') {
          paymentMethod = 'direct_debit'; // Loan payments usually direct debit
        } else {
          paymentMethod = 'credit_card'; // Default for expenses
        }
      }

      // Detect loan payment and try to match with existing loan
      let linkedLoanId = null;
      if (tx.category === 'loan_payment' && existingLoans && existingLoans.length > 0) {
        const txAmount = Math.abs(parseFloat(tx.amount));
        
        // Try to match by monthly payment amount (within 2% tolerance)
        const matchedLoan = existingLoans.find((loan: any) => {
          const loanPayment = parseFloat(loan.monthly_payment);
          const diff = Math.abs(txAmount - loanPayment);
          const percentDiff = (diff / loanPayment) * 100;
          return percentDiff <= 2;
        });
        
        if (matchedLoan) {
          linkedLoanId = matchedLoan.id;
          console.log(`🔗 Linked loan payment ${txAmount} to loan ${matchedLoan.id}`);
        }
      }

      return {
        user_id: userId,
        type: transactionType,
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
        payment_method: paymentMethod,
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
        // Linking fields
        is_summary: isBankStatement, // Bank transactions are summaries that may be detailed later
        linked_loan_id: linkedLoanId,
      };
    });

    const { error } = await supabase
      .from('transactions')
      .insert(transactionsToInsert as any);

    if (error) {
      console.error('Failed to insert transactions:', error);
      throw error;
    }

    console.log(`💾 Saved ${transactionsToInsert.length} transactions`);
    
    // Update linked loans with new payment info
    const linkedTransactions = transactionsToInsert.filter((tx: any) => tx.linked_loan_id);
    if (linkedTransactions.length > 0) {
      for (const tx of linkedTransactions) {
        // Update loan's current_balance (deduct payment amount)
        const { data: loan } = await supabase
          .from('loans')
          .select('current_balance, remaining_payments')
          .eq('id', tx.linked_loan_id)
          .single();
        
        if (loan) {
          const newBalance = parseFloat(loan.current_balance) - parseFloat(String(tx.amount));
          const newRemaining = loan.remaining_payments ? loan.remaining_payments - 1 : null;
          
          await supabase
            .from('loans')
            .update({
              current_balance: Math.max(0, newBalance), // Never negative
              remaining_payments: newRemaining,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tx.linked_loan_id);
          
          console.log(`💰 Updated loan ${tx.linked_loan_id}: balance ${newBalance.toFixed(2)}, remaining ${newRemaining}`);
        }
      }
    }
    
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
        // Parse next_payment_date
        const nextPaymentDate = track.next_payment_date ? parseDateToISO(track.next_payment_date) : null;
        
        return {
          user_id: userId,
          loan_type: 'mortgage',
          lender: result.report_info?.bank_name || 'בנק',
          original_amount: parseFloat(track.original_amount) || 0,
          current_balance: parseFloat(track.current_balance) || 0,
          interest_rate: parseFloat(track.interest_rate) || 0,
          monthly_payment: parseFloat(track.monthly_payment) || 0,
          remaining_payments: parseInt(track.remaining_payments) || null,
          next_payment_date: nextPaymentDate,
          status: 'active',
          metadata: {
            track_number: track.track_number,
            track_type: track.track_type,
            index_type: track.index_type,
            paid_payments: parseInt(track.paid_payments) || null,
            document_id: documentId,
            report_info: result.report_info,
          },
        };
      });
    } else if (result.loans && Array.isArray(result.loans)) {
      // Regular loan statement
      loansToInsert = result.loans.map((loan: any) => {
        // Parse next_payment_date
        const nextPaymentDate = loan.next_payment_date ? parseDateToISO(loan.next_payment_date) : null;
        
        return {
          user_id: userId,
          loan_type: 'personal',
          lender: result.report_info?.bank_name || loan.loan_provider || 'לא צוין',
          original_amount: parseFloat(loan.original_amount) || 0,
          current_balance: parseFloat(loan.current_balance) || 0,
          interest_rate: parseFloat(loan.interest_rate) || 0,
          monthly_payment: parseFloat(loan.monthly_payment) || 0,
          remaining_payments: parseInt(loan.remaining_payments) || null,
          next_payment_date: nextPaymentDate,
          status: 'active',
          metadata: {
            loan_number: loan.loan_number,
            loan_name: loan.loan_name,
            index_type: loan.index_type,
            paid_payments: parseInt(loan.paid_payments) || null,
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

/**
 * Save pension plans from pension clearinghouse reports
 */
async function savePensions(supabase: any, result: any, userId: string, documentId: string): Promise<number> {
  try {
    if (!result.pension_plans || result.pension_plans.length === 0) {
      console.log('No pension plans to save');
      return 0;
    }

    const pensionsToInsert = result.pension_plans.map((plan: any) => {
      // Parse start_date
      const startDate = parseDateToISO(plan.start_date);

      // Map plan_type to pension_type
      const typeMap: Record<string, string> = {
        'pension_fund': 'pension_fund',
        'provident_fund': 'provident_fund',
        'study_fund': 'study_fund',
        'insurance_policy': 'insurance',
      };
      const pensionType = typeMap[plan.plan_type] || 'other';

      return {
        user_id: userId,
        pension_type: pensionType,
        provider: plan.provider,
        policy_number: plan.policy_number || null,
        current_balance: parseFloat(plan.current_balance) || 0,
        monthly_deposit: parseFloat(plan.monthly_deposit) || 0,
        employer_deposit: parseFloat(plan.employer_deposit) || 0,
        management_fees: parseFloat(plan.management_fees) || null,
        annual_return: null, // Not in clearinghouse report
        start_date: startDate,
        metadata: {
          plan_name: plan.plan_name,
          status: plan.status,
          retirement_age: plan.retirement_age,
          pension_savings: plan.pension_savings,
          capital_savings: plan.capital_savings,
          retirement_forecast: plan.retirement_forecast,
          investment_track: plan.investment_track,
          insurance_coverage: plan.insurance_coverage,
          employee_deposit: plan.employee_deposit,
          document_id: documentId,
          report_info: result.report_info,
        },
      };
    });

    const { error } = await supabase
      .from('pensions')
      .insert(pensionsToInsert);

    if (error) {
      console.error('Failed to insert pensions:', error);
      throw error;
    }

    console.log(`💾 Saved ${pensionsToInsert.length} pension plans`);
    return pensionsToInsert.length;
  } catch (error) {
    console.error('Error in savePensions:', error);
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
// Bank Account Snapshots
// ============================================================================

/**
 * Save bank account snapshots from bank statements
 */
async function saveBankAccounts(supabase: any, result: any, userId: string, documentId: string): Promise<number> {
  try {
    // Extract account_info from bank statement
    if (!result.account_info) {
      console.log('No account_info found in bank statement');
      return 0;
    }

    const accountInfo = result.account_info;
    const reportInfo = result.report_info || {};
    
    // Mark all previous snapshots as not current
    await supabase
      .from('bank_accounts')
      .update({ is_current: false })
      .eq('user_id', userId);
    
    // Parse statement period end date
    let snapshotDate = new Date().toISOString().split('T')[0];
    if (reportInfo.period_end) {
      const parsed = parseDateToISO(reportInfo.period_end);
      if (parsed) snapshotDate = parsed;
    }
    
    const accountToInsert = {
      user_id: userId,
      bank_name: accountInfo.bank_name || reportInfo.bank_name || 'לא צוין',
      account_number: accountInfo.account_number || 'לא צוין',
      account_type: accountInfo.account_type || 'checking',
      branch_number: accountInfo.branch_number || null,
      current_balance: parseFloat(accountInfo.current_balance || '0'),
      available_balance: parseFloat(accountInfo.available_balance || accountInfo.current_balance || '0'),
      overdraft_limit: parseFloat(accountInfo.overdraft_limit || '0'),
      snapshot_date: snapshotDate,
      is_current: true,
      document_id: documentId,
      currency: 'ILS',
    };

    const { error } = await supabase
      .from('bank_accounts')
      .insert([accountToInsert]);

    if (error) {
      console.error('Failed to insert bank account:', error);
      throw error;
    }

    console.log(`💰 Saved bank account snapshot: ${accountInfo.current_balance} ₪`);
    return 1;
  } catch (error) {
    console.error('Error in saveBankAccounts:', error);
    // Don't throw - this is optional data
    return 0;
  }
}

// ============================================================================
// Update User Financial Profile
// ============================================================================

/**
 * Update user_financial_profile with current account balance from bank statement
 */
async function updateUserFinancialProfile(supabase: any, result: any, userId: string): Promise<void> {
  try {
    if (!result.account_info || !result.account_info.current_balance) {
      console.log('No account balance to update in user profile');
      return;
    }

    const currentBalance = parseFloat(result.account_info.current_balance);
    
    const { error } = await supabase
      .from('user_financial_profile')
      .upsert({
        user_id: userId,
        current_account_balance: currentBalance,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Failed to update user financial profile:', error);
      // Don't throw - this is optional
    } else {
      console.log(`📊 Updated user profile: current_account_balance = ${currentBalance} ₪`);
    }
  } catch (error) {
    console.error('Error in updateUserFinancialProfile:', error);
    // Don't throw - this is optional
  }
}

/**
 * Save loan payments identified in bank statement as loans
 */
async function saveLoanPaymentsAsLoans(supabase: any, result: any, userId: string): Promise<number> {
  try {
    if (!result.transactions || !result.transactions.loan_payments) {
      return 0;
    }

    const loanPayments = result.transactions.loan_payments;
    if (!Array.isArray(loanPayments) || loanPayments.length === 0) {
      return 0;
    }

    // Group loan payments by lender/provider to identify unique loans
    const loansByProvider: Record<string, any[]> = {};
    
    loanPayments.forEach((payment: any) => {
      const provider = payment.loan_provider || payment.vendor || 'לא צוין';
      if (!loansByProvider[provider]) {
        loansByProvider[provider] = [];
      }
      loansByProvider[provider].push(payment);
    });

    let loansCreated = 0;

    // For each provider, check if loan already exists, if not create it
    for (const [provider, payments] of Object.entries(loansByProvider)) {
      // Check if loan already exists for this provider
      const { data: existingLoan } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', userId)
        .eq('lender_name', provider)
        .eq('active', true)
        .single();

      if (!existingLoan) {
        // Create new loan record
        const payment = payments[0]; // Use first payment as reference
        const monthlyPayment = parseFloat(payment.amount || 0);

        const { error: insertError } = await supabase
          .from('loans')
          .insert({
            user_id: userId,
            loan_type: 'personal',
            lender_name: provider,
            monthly_payment: monthlyPayment,
            active: true,
            interest_rate: payment.interest_rate ? parseFloat(payment.interest_rate) : null,
            current_balance: payment.principal ? parseFloat(payment.principal) : null,
            metadata: {
              identified_from: 'bank_statement',
              payment_count: payments.length,
            },
          });

        if (!insertError) {
          loansCreated++;
          console.log(`💳 Created loan record for ${provider} (${monthlyPayment} ₪/month)`);
        }
      } else {
        console.log(`ℹ️  Loan already exists for ${provider}`);
      }
    }

    return loansCreated;
  } catch (error) {
    console.error('Error in saveLoanPaymentsAsLoans:', error);
    return 0;
  }
}

// ============================================================================
// Payslips (תלושי שכר)
// ============================================================================

/**
 * Save payslip data from salary slips
 */
async function savePayslips(supabase: any, result: any, userId: string, documentId: string): Promise<number> {
  try {
    // Extract payslip info
    if (!result.payslip_info && !result.salary_info) {
      console.log('No payslip info found');
      return 0;
    }

    const info = result.payslip_info || result.salary_info;
    
    // Parse month/year
    let monthYear = new Date().toISOString().split('T')[0];
    if (info.month || info.month_year) {
      const monthStr = info.month || info.month_year;
      // Try to parse various formats: "01/2025", "January 2025", etc.
      const parsed = parseDateToISO(monthStr);
      if (parsed) {
        monthYear = parsed.substring(0, 7) + '-01'; // YYYY-MM-01
      }
    }
    
    // Parse pay date
    let payDate = null;
    if (info.pay_date) {
      payDate = parseDateToISO(info.pay_date);
    }
    
    const payslipToInsert = {
      user_id: userId,
      employer_name: info.employer_name || 'לא צוין',
      employer_id: info.employer_id || null,
      month_year: monthYear,
      pay_date: payDate,
      gross_salary: parseFloat(info.gross_salary || '0'),
      net_salary: parseFloat(info.net_salary || '0'),
      tax_deducted: parseFloat(info.tax || info.tax_deducted || '0'),
      social_security: parseFloat(info.social_security || info.bituach_leumi || '0'),
      health_tax: parseFloat(info.health_tax || info.briut_tax || '0'),
      pension_employee: parseFloat(info.pension_employee || '0'),
      pension_employer: parseFloat(info.pension_employer || '0'),
      advanced_study_fund: parseFloat(info.advanced_study_fund || info.keren_hishtalmut || '0'),
      overtime_hours: parseFloat(info.overtime_hours || '0'),
      overtime_pay: parseFloat(info.overtime_pay || '0'),
      bonus: parseFloat(info.bonus || '0'),
      document_id: documentId,
      metadata: result,
    };

    // Insert payslip
    const { data: insertedPayslip, error } = await supabase
      .from('payslips')
      .insert([payslipToInsert])
      .select()
      .single();

    if (error) {
      console.error('Failed to insert payslip:', error);
      throw error;
    }

    // Create income transaction linked to this payslip
    const netSalary = parseFloat(info.net_salary || '0');
    if (netSalary > 0) {
      const incomeTransaction = {
        user_id: userId,
        type: 'income',
        amount: netSalary,
        category: 'salary',
        vendor: info.employer_name || 'משכורת',
        date: payDate || monthYear,
        tx_date: payDate || monthYear,
        source: 'ocr',
        status: 'proposed',
        notes: `תלוש שכר ${monthYear}`,
        payment_method: 'bank_transfer',
        confidence_score: 0.9,
        document_id: documentId,
        auto_categorized: true,
        currency: 'ILS',
      };

      const { error: txError } = await supabase
        .from('transactions')
        .insert([incomeTransaction]);

      if (txError) {
        console.warn('Failed to create income transaction from payslip:', txError);
      } else {
        console.log(`💸 Created income transaction for ${netSalary} ₪`);
      }
    }

    // Update linked pension funds if we have pension data
    if (info.pension_employee || info.pension_employer) {
      const totalPension = 
        parseFloat(info.pension_employee || '0') + 
        parseFloat(info.pension_employer || '0');
      
      // Try to find existing pension fund for this user
      const { data: existingPension } = await supabase
        .from('pension_insurance')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .limit(1)
        .single();

      if (existingPension) {
        // Update monthly_deposit
        await supabase
          .from('pension_insurance')
          .update({
            monthly_deposit: totalPension,
            employee_contribution: parseFloat(info.pension_employee || '0'),
            employer_contribution: parseFloat(info.pension_employer || '0'),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPension.id);
        
        console.log(`📊 Updated pension fund with ${totalPension} ₪ monthly deposit`);
      }
    }

    console.log(`💼 Saved payslip: ${info.employer_name} - ${netSalary} ₪`);
    return 1;
  } catch (error) {
    console.error('Error in savePayslips:', error);
    // Don't throw - this is optional data
    return 0;
  }
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
      .select('phone, name')
      .eq('id', userId)
      .single();

    const user = userData as any;

    if (!user?.phone) {
      console.log('⚠️ No phone number found for user - user needs to update profile');
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
    } else if (docType.includes('pension') || docType.includes('פנסיה') || docType.includes('מסלקה')) {
      message = `היי ${userName}! 🏦\n\nסיימתי לעבד את דוח המסלקה הפנסיונית.\nמצאתי ${itemsCount} תוכניות חיסכון פנסיוני.\n\n👉 צפה בפירוט: ${url}\n\nתודה! 💙`;
    } else {
      message = `היי ${userName}! 📄\n\nסיימתי לעבד את המסמך שהעלית.\nמצאתי ${itemsCount} פריטים.\n\n👉 צפה בפירוט: ${url}\n\nתודה! 💙`;
    }
    
    await greenAPI.sendMessage({
      phoneNumber: user.phone,
      message,
    });

    console.log(`✅ WhatsApp sent to ${user.phone}`);
  } catch (error) {
    console.error('Failed to send WhatsApp:', error);
  }
}

