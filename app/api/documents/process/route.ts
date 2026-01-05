import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { getPromptForDocumentType } from '@/lib/ai/document-prompts';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { matchCreditTransactions } from '@/lib/reconciliation/credit-matcher';
import { parseDate, parseDateWithFallback } from '@/lib/utils/date-parser';
import * as XLSX from 'xlsx';

// ⚡️ Vercel Background Function Configuration
export const runtime = 'nodejs'; // Force Node.js runtime
export const maxDuration = 600; // 10 minutes for large documents with GPT-5-nano
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 480000, // 8 minutes timeout for GPT-5.1 (which can take 3-4 min for large PDFs)
  maxRetries: 0, // No retries - let it complete on first try
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
    } else if (stmt.mime_type?.includes('spreadsheet') || stmt.mime_type?.includes('excel') || stmt.file_name?.match(/\.(xlsx|xls)$/i)) {
      console.log('📊 Analyzing Excel...');
      result = await analyzeExcelWithAI(buffer, stmt.file_type, stmt.file_name);
    }

    console.log(`✅ AI analysis complete:`, JSON.stringify(result, null, 2));

    // Validate and normalize categories from AI
    if (result.transactions) {
      if (Array.isArray(result.transactions)) {
        console.log(`📋 Processing array format: ${result.transactions.length} transactions`);
        result.transactions = await validateAndNormalizeCategories(supabase, result.transactions);
      } else if (typeof result.transactions === 'object') {
        // Bank statement format with sub-arrays
        console.log(`📋 Processing object format with income/expenses arrays`);
        if (result.transactions.expenses) {
          console.log(`💸 Processing ${result.transactions.expenses.length} expenses`);
          result.transactions.expenses = await validateAndNormalizeCategories(supabase, result.transactions.expenses);
        }
        if (result.transactions.income) {
          console.log(`💰 Processing ${result.transactions.income.length} income transactions`);
          result.transactions.income = await validateAndNormalizeCategories(supabase, result.transactions.income);
        }

        // Log a sample of each type to debug
        if (result.transactions.expenses && result.transactions.expenses.length > 0) {
          console.log(`🔍 Sample expense:`, result.transactions.expenses[0]);
        }
        if (result.transactions.income && result.transactions.income.length > 0) {
          console.log(`🔍 Sample income:`, result.transactions.income[0]);
        }
      }
    }

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
      // Credit statements → transaction_details (לא תנועות חדשות!)
      // דוח אשראי של חודש X-1 מתחבר לתנועות תשלום אשראי בחודש X
      itemsProcessed = await saveCreditDetails(supabase, result, stmt.user_id, statementId as string, stmt.statement_month);
    } else if (docType.includes('bank')) {
      // Bank statements → transactions עם is_source_transaction = true
      const txCount = await saveBankTransactions(supabase, result, stmt.user_id, statementId as string, docType, stmt.statement_month);
      const accountCount = await saveBankAccounts(supabase, result, stmt.user_id, statementId as string);
      const loanCount = await saveLoanPaymentsAsLoans(supabase, result, stmt.user_id);
      
      // 🎯 NEW: Detect missing documents and save account snapshot
      await saveAccountSnapshot(supabase, result, stmt.user_id, statementId as string);
      
      // Get inserted transactions for missing documents detection
      const { data: insertedTxs } = await supabase
        .from('transactions')
        .select('*')
        .eq('document_id', statementId)
        .eq('user_id', stmt.user_id);
      
      const missingDocsCount = await detectAndSaveMissingDocuments(
        supabase, 
        result, 
        stmt.user_id, 
        statementId as string,
        insertedTxs || []
      );
      
      // 🎯 NEW: Auto-detect credit card charges and create missing documents
      const creditCardMissingDocs = await autoDetectCreditCardCharges(
        supabase,
        stmt.user_id,
        insertedTxs || []
      );
      
      itemsProcessed = txCount + accountCount + loanCount + missingDocsCount + creditCardMissingDocs;
    } else if (docType.includes('payslip') || docType.includes('salary') || docType.includes('תלוש')) {
      // Payslips → payslips table + link to income transaction
      itemsProcessed = await savePayslips(supabase, result, stmt.user_id, statementId as string, stmt.statement_month);
    } else if (docType.includes('loan') || docType.includes('mortgage')) {
      // Loan/Mortgage statements → loans table
      itemsProcessed = await saveLoans(supabase, result, stmt.user_id, statementId as string);
    } else if (docType.includes('insurance')) {
      // Insurance statements → insurance table
      itemsProcessed = await saveInsurance(supabase, result, stmt.user_id, statementId as string);
    } else if (docType.includes('pension') || docType.includes('פנסיה') || docType.includes('מסלקה')) {
      // Pension statements → pension_insurance table + link to payslip and transactions
      itemsProcessed = await savePensions(supabase, result, stmt.user_id, statementId as string, stmt.statement_month);
    } else {
      console.warn(`Unknown document type: ${docType}, defaulting to transactions`);
      itemsProcessed = await saveTransactions(supabase, result, stmt.user_id, statementId as string, docType, stmt.statement_month);
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
        extracted_data: result, // ✨ שמור את ה-result המלא (כולל billing_info) למטרות reconciliation
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
// Category Validation & Normalization
// ============================================================================

/**
 * Validate and normalize expense categories from AI against database
 */
async function validateAndNormalizeCategories(
  supabase: any,
  transactions: any[]
): Promise<any[]> {
  try {
    // Load all valid categories from DB
    const { data: validCategories } = await supabase
      .from('expense_categories')
      .select('name, expense_type, category_group')
      .eq('is_active', true);
    
    if (!validCategories || validCategories.length === 0) {
      console.warn('⚠️ No expense categories found in database');
      return transactions;
    }
    
    // Create case-insensitive lookup map
    const categoryMap = new Map(
      validCategories.map((c: any) => [c.name.toLowerCase().trim(), c])
    );
    
    console.log(`📋 Validating ${transactions.length} transactions against ${validCategories.length} categories`);
    
    return transactions.map((tx: any) => {
      const expenseCategory = tx.expense_category?.trim();
      
      // No category provided - keep null
      if (!expenseCategory) {
        return {
          ...tx,
          expense_category: null,
          expense_type: null,
          category_group: null
        };
      }
      
      // Try exact match (case-insensitive)
      const match = categoryMap.get(expenseCategory.toLowerCase());
      
      if (match) {
        // Found exact match - use data from DB
        return {
          ...tx,
          expense_category: (match as any).name, // Exact name from DB
          expense_type: (match as any).expense_type,
          category_group: (match as any).category_group
        };
      }
      
      // No match found - keep null, let user categorize manually
      console.warn(`⚠️ Unknown category: "${expenseCategory}" → keeping null for manual categorization`);
      return {
        ...tx,
        expense_category: null,
        expense_type: null,
        category_group: null,
        confidence_score: (tx.confidence_score || 0.8) * 0.5 // Reduce confidence
      };
    });
  } catch (error) {
    console.error('Error in validateAndNormalizeCategories:', error);
    return transactions; // Return unchanged on error
  }
}

// ============================================================================
// AI Analysis Functions
// ============================================================================

/**
 * Fix RTL (Right-to-Left) text reversal issues from PDF extraction
 * unpdf often reverses English words and removes spaces in Hebrew
 */
function fixRTLTextFromPDF(text: string): string {
  try {
    console.log('🔧 Starting enhanced RTL processing...');

    // For very large texts, process in chunks to avoid memory issues
    if (text.length > 100000) {
      console.log('📏 Processing large text in chunks...');
      const chunks = [];
      const chunkSize = 50000;
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        chunks.push(fixRTLChunk(chunk));
      }
      return chunks.join('\n');
    }

    return fixRTLChunk(text);
  } catch (error) {
    console.error('Error in fixRTLTextFromPDF:', error);
    return text; // Return original on error
  }
}

// Special handling for large PDFs that GPT-4o can't process directly
async function analyzeLargePDF(buffer: Buffer, fileType: string, fileName: string) {
  try {
    console.log('🔄 Analyzing large PDF with text extraction + GPT-4o...');

    // Extract text using unpdf
    const { getDocumentProxy, extractText } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text: rawText } = await extractText(pdf, { mergePages: true });

    console.log(`✅ Extracted ${rawText.length} characters from ${totalPages} pages`);

    // Process the text with our enhanced RTL fixing
    const processedText = fixRTLTextFromPDF(rawText);
    console.log(`🔧 After RTL processing: ${processedText.length} characters`);

    // For large texts, we'll split into smaller chunks and analyze each chunk
    const MAX_CHUNK_SIZE = 100000; // 100K characters per chunk
    const chunks = [];

    if (processedText.length <= MAX_CHUNK_SIZE) {
      chunks.push(processedText);
    } else {
      // Split into chunks at logical break points
      let remaining = processedText;
      while (remaining.length > 0) {
        if (remaining.length <= MAX_CHUNK_SIZE) {
          chunks.push(remaining);
          break;
        }

        // Find a good break point (end of transaction line)
        let breakPoint = MAX_CHUNK_SIZE;
        const lastNewline = remaining.lastIndexOf('\n', MAX_CHUNK_SIZE - 1000);
        if (lastNewline > MAX_CHUNK_SIZE * 0.8) {
          breakPoint = lastNewline;
        }

        chunks.push(remaining.substring(0, breakPoint));
        remaining = remaining.substring(breakPoint);
      }
    }

    console.log(`📦 Split into ${chunks.length} chunks for analysis`);

    // Load expense categories
    let expenseCategories: Array<{name: string; expense_type: string; category_group: string}> = [];
    if (fileType === 'bank_statement' || fileType === 'credit_statement') {
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
      console.log(`📋 Loaded ${expenseCategories.length} expense categories`);
    }

    // Analyze each chunk
    const allResults = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`\n🔍 Analyzing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)...`);

      const chunkPrompt = getPromptForDocumentType(fileType, chunks[i], expenseCategories);

      const startChunk = Date.now();
      // 🆕 GPT-5.2 with Responses API
      const response = await openai.responses.create({
        model: 'gpt-5.2-2025-12-11',
        input: chunkPrompt,
        reasoning: { effort: 'medium' },
      });

      const chunkDuration = ((Date.now() - startChunk) / 1000).toFixed(1);
      console.log(`✅ Chunk ${i + 1} analyzed in ${chunkDuration}s`);

      const content = response.output_text || '{}';
      try {
        const chunkResult = JSON.parse(content);
        if (chunkResult.transactions) {
          allResults.push(chunkResult);
        }
      } catch (e) {
        console.error(`❌ Failed to parse chunk ${i + 1} JSON:`, e instanceof Error ? e.message : String(e));
      }

      // Small delay between chunks
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Merge all results
    console.log('\n🔀 Merging results from all chunks...');
    const mergedResult: {
      report_info: any;
      transactions: {
        income: any[];
        expenses: any[];
      };
    } = {
      report_info: allResults[0]?.report_info || {},
      transactions: {
        income: [],
        expenses: []
      }
    };

    // Combine all transactions
    allResults.forEach(result => {
      if (result.transactions?.income) {
        mergedResult.transactions.income.push(...result.transactions.income);
      }
      if (result.transactions?.expenses) {
        mergedResult.transactions.expenses.push(...result.transactions.expenses);
      }
    });

    console.log(`🎯 Final result: ${mergedResult.transactions.income.length} income, ${mergedResult.transactions.expenses.length} expenses`);
    return mergedResult;

  } catch (error) {
    console.error('❌ Error in analyzeLargePDF:', error);
    throw error;
  }
}

function fixRTLChunk(text: string): string {
  // Split into lines for processing
    const lines = text.split('\n');
  console.log(`🔧 Processing ${lines.length} lines...`);

  const fixedLines = lines.map((line, index) => {
    // Progress indicator for large files
    if (index > 0 && index % 1000 === 0) {
      console.log(`🔧 Processed ${index}/${lines.length} lines...`);
    }

    // Ultra-aggressive reversal for lines that look completely reversed
    if (line.match(/^\d{4}\//) || line.match(/\d{2}\/\d{2}\/\d{4}/) || line.match(/\d{1,3}(,\d{3})*\.\d{2}/)) {
      // This looks like a reversed transaction line - reverse the entire line
      line = line.split('').reverse().join('');
    }

    // Enhanced reversal logic - more aggressive for PDF text
      let fixedLine = line.replace(/[A-Za-z0-9._\-@\/]+/g, (match) => {
        const reversed = match.split('').reverse().join('');
        
      // Strong reversal indicators (expanded list)
        if (
        // Financial terms (Hebrew reversed)
        reversed.match(/^(תשלום|חיוב|זיכוי|יתרה|סכום|סה"כ|מע"מ|מס|עמלה|ריבית)/) ||
        // Bank names reversed
        reversed.match(/^(כאל|מקס|ישראכרט|לאומי|דיסקונט|פועלים|בנק|בנקאי)/) ||
          // Domain names
          reversed.match(/\.(com|net|org|il|co\.il|gov|edu|app|io|ai)$/i) ||
          // URLs
          reversed.match(/^(www|http|https|ftp)/i) ||
          // Email
          reversed.includes('@') ||
        // Tech companies
          reversed.match(/^(CURSOR|OPENAI|VERCEL|ANTHROPIC|GOOGLE|MICROSOFT|ADOBE|NETFLIX|ZOOM|APPLE|PAYPAL|AMAZON|STRIPE|GITHUB|GITLAB|SLACK|DISCORD|TELEGRAM|WHATSAPP|FACEBOOK|INSTAGRAM|TWITTER|LINKEDIN|YOUTUBE|SPOTIFY|DROPBOX|NOTION|FIGMA|CANVA)/i) ||
        // Financial terms
        reversed.match(/^(usage|subscription|payment|invoice|receipt|statement|report|summary|total|balance|credit|debit|account|customer|vendor|service|product|order|transaction|fee|charge|refund|discount|tax|vat|net|gross|atm|cash|check|transfer|deposit|withdrawal)/i) ||
        // Business categories
        reversed.match(/^(supermarket|pharmacy|restaurant|gas|fuel|electricity|water|internet|phone|mobile|telecom|insurance|bank|credit|card|loan|mortgage|shopping|grocery|food|dining|transport|travel|entertainment|health|medical|education|home|utilities|services)/i) ||
        // Date formats
        reversed.match(/^\d{1,4}\/\d{1,2}\/\d{1,4}$/) ||
        // Amount formats
        reversed.match(/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/) ||
        // Card names
        reversed.match(/^(ויזה|מסטרקארד|אמריקן|אקספרס|ויזה|מאסטר|אמריקן)/)
        ) {
          return reversed;
        }
        
      // Vowel-based heuristic - if reversed has more vowels, it's probably correct
      const reversedVowels = (reversed.match(/[aeiou]/gi) || []).length;
      const originalVowels = (match.match(/[aeiou]/gi) || []).length;

      // Additional heuristics for reversal
      if (reversedVowels > originalVowels ||
          match.match(/^\d/) || // Numbers at start
          reversed.match(/^\d/) || // Numbers after reversal
          match.match(/^\d{2,}/) || // Multi-digit numbers
          reversed.match(/^[A-Z]{2,}/)) { // Capital words
          return reversed;
        }
        
      return match;
      });
      
    // Enhanced Hebrew text processing
      fixedLine = fixedLine
      // Fix concatenated Hebrew business names (expanded)
      .replace(/(סופרפארם)(ברנע[^\s]*)/g, '$1 $2')
      .replace(/(שופרסל)([^\s]*)/g, '$1 $2')
      .replace(/(פז)([^\s]*)/g, '$1 $2')
      .replace(/(בנק)([^\s]*)/g, '$1 $2')
      .replace(/(מגדל)([^\s]*)/g, '$1 $2')
      .replace(/(הראל)([^\s]*)/g, '$1 $2')
      .replace(/(כלל)([^\s]*)/g, '$1 $2')
      .replace(/(פניקס)([^\s]*)/g, '$1 $2')
      .replace(/(קרן)([^\s]*מכבי[^\s]*)/g, '$1 $2')
      .replace(/(קרן)([^\s]*כלל[^\s]*)/g, '$1 $2')
      .replace(/(ויזה|מסטרקארד|אמריקן|אקספרס)/g, ' $1 ')
      // Fix amounts and dates
      .replace(/(\d+[,.]?\d*)\s*₪/g, '$1 ₪')
      .replace(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g, '$1/$2/$3')
      // Additional spacing fixes
        .replace(/(סופר)(דוידי|פארם|דיל)/g, '$1 $2')
        .replace(/(בזק|פלאפון|הוט|סלקום)(חשבון[^\s]*)/g, '$1 $2')
      .replace(/(קרן|ביטוח)(מכבי|כללית|לאומי|הראל|מגדל|פניקס)/g, '$1 $2')
      // Fix stuck city names
        .replace(/(מקדונלד'ס|ארקפה|בורגר[^\s]+|קפה[^\s]+)(תל[^\s]+|ירושל[^\s]+|חיפה|אשקלון|אשדוד|רחובות|פתח[^\s]+)/g, '$1 $2');
      
      return fixedLine;
    });
    
    return fixedLines.join('\n');
}

async function analyzePDFWithAI(buffer: Buffer, fileType: string, fileName: string) {
  try {
    console.log('📝 Analyzing PDF directly with GPT-4o using Files API...');

    // Check file size - for very large PDFs, we might need to split
    const fileSizeMB = buffer.length / (1024 * 1024);
    console.log(`📄 PDF size: ${fileSizeMB.toFixed(2)} MB`);

    // For very large PDFs (> 5MB), try a different approach
    if (fileSizeMB > 5) {
      console.log('📏 Large PDF detected, trying split approach...');
      return await analyzeLargePDF(buffer, fileType, fileName);
    }

    // Upload PDF directly to OpenAI Files API for analysis
    // Note: We write to temp file because Files API needs a file stream
    const tempFilePath = `/tmp/${Date.now()}-${fileName}`;
    await require('fs').promises.writeFile(tempFilePath, buffer);

    console.log(`📤 Uploading PDF to OpenAI Files API (${fileSizeMB.toFixed(2)} MB)...`);
    
    let fileUpload: any;
    try {
      fileUpload = await openai.files.create({
        file: require('fs').createReadStream(tempFilePath),
        purpose: 'assistants'
      });
      console.log(`✅ PDF uploaded to OpenAI Files API: ${fileUpload.id}`);
    } catch (uploadError: any) {
      console.error(`❌ Files API upload failed: ${uploadError.message}`);
      // Clean up temp file
      await require('fs').promises.unlink(tempFilePath).catch(() => {});
      throw new Error(`Failed to upload PDF to OpenAI Files API: ${uploadError.message}. Please try again.`);
    }
    
    // Clean up temp file
    await require('fs').promises.unlink(tempFilePath);

    // Load expense categories from database (for bank & credit statements)
    let expenseCategories: Array<{name: string; expense_type: string; category_group: string}> = [];
    if (fileType === 'bank_statement' || fileType === 'credit_statement') {
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

    // Get appropriate prompt for document type (direct PDF analysis - no text)
    const prompt = getPromptForDocumentType(fileType, null, expenseCategories);

    // Analyze with AI using direct PDF upload (GPT-5.1 Responses API or GPT-4o Chat Completions)
    console.log(`🤖 Analyzing PDF directly with AI (trying GPT-5.1 first, then GPT-4o)...`);
    console.log(`📊 Prompt length: ${prompt.length} chars (~${Math.ceil(prompt.length / 4)} tokens)`);

    const startAI = Date.now();

    // Try GPT-5.1 first with Responses API, then fallback to GPT-4o with Chat Completions
    let response: any;
    let usedModel = '';
    let content = '';

    // 🆕 GPT-5.2 with Responses API - Direct PDF file analysis
    try {
      console.log(`🔄 Trying GPT-5.2 with Responses API (direct PDF file)...`);
      
      const gpt52Response = await openai.responses.create({
        model: 'gpt-5.2-2025-12-11',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_file',
                file_id: fileUpload.id
              },
              {
                type: 'input_text',
                text: prompt
              }
            ]
          }
        ],
        reasoning: { effort: 'medium' },
        max_output_tokens: 32000
      });
      usedModel = 'gpt-5.2';
      content = gpt52Response.output_text || '{}';
      console.log(`✅ GPT-5.2 succeeded`);
    } catch (gpt52Error: any) {
      console.log(`❌ GPT-5.2 failed: ${gpt52Error.message}`);
      console.error('GPT-5.2 error details:', gpt52Error);
      
      // Re-throw - no fallback to older models
      throw new Error(`GPT-5.2 failed: ${gpt52Error.message}`);
    }
    
    // Legacy fallback code - kept for reference but should not be reached
    const modelsToTry: string[] = [];

      for (const model of modelsToTry) {
        try {
          console.log(`🔄 Trying model: ${model} (direct PDF file)...`);
          
          response = await openai.chat.completions.create({
            model: model,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'file',
                  file: { file_id: fileUpload.id }
                },
                {
                  type: 'text',
                  text: prompt
                }
              ]
            }],
      temperature: 0.1,
            max_tokens: 16384,
            response_format: { type: 'json_object' }
          });
          usedModel = model;
          content = response.choices[0]?.message?.content || '{}';
          console.log(`✅ Successfully used model: ${model}`);
          break;
        } catch (modelError: any) {
          console.log(`❌ Model ${model} failed: ${modelError.message}`);
          if (!modelError.message.includes('does not have access') &&
              !modelError.message.includes('not found')) {
            throw modelError; // Re-throw if it's not an access issue
          }
        }
      }

      if (!content) {
        throw new Error('All models failed to analyze the PDF');
      }
    }

    const aiDuration = ((Date.now() - startAI) / 1000).toFixed(1);
    console.log(`✅ ${usedModel} analysis complete (${aiDuration}s)`);
    
    // Parse JSON with improved error handling
    try {
      // First, try direct parsing
      const result = JSON.parse(content);
      return result;
    } catch (parseError: any) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.error('JSON String (first 1000 chars):', content.substring(0, 1000));
      
      // Try to extract JSON if it's wrapped in markdown or has extra text
      let jsonStr = content;
      
      // Remove markdown code blocks
      if (content.includes('```')) {
        const match = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (match) jsonStr = match[1];
      } else {
        // Extract JSON object from text
        const match = content.match(/\{[\s\S]*\}/);
        if (match) jsonStr = match[0];
      }
      
      // Clean up common JSON issues
      jsonStr = jsonStr
        .replace(/,\s*}/g, '}')     // Remove trailing commas in objects
        .replace(/,\s*\]/g, ']')    // Remove trailing commas in arrays
        .trim();
      
      // Try parsing the cleaned version
      try {
        const result = JSON.parse(jsonStr);
        console.log('✅ Successfully parsed JSON after cleanup');
        return result;
      } catch (secondError) {
        console.error('❌ Still failed after cleanup:', (secondError as Error).message);
        throw new Error(`Invalid JSON response from AI: ${parseError.message}`);
      }
    }
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
    console.log(`🖼️  Analyzing image with GPT-5.2 Vision (${documentType})...`);
    
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    // Get appropriate prompt (images are usually credit/bank/receipt)
    const prompt = getPromptForDocumentType(documentType, null);
    
    // 🆕 GPT-5.2 with Responses API
    const response = await openai.responses.create({
      model: 'gpt-5.2-2025-12-11',
      input: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
      reasoning: { effort: 'medium' },
    });

    console.log(`✅ GPT-5.2 Vision analysis complete`);
    
    const content = response.output_text || '{}';
    
    // With response_format: json_object, GPT-4o returns valid JSON directly
    try {
      const result = JSON.parse(content);
      return result;
    } catch (parseError: any) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.error('JSON String (first 500 chars):', content.substring(0, 500));
      
      // Try to extract JSON if it's wrapped in markdown
      let jsonStr = content;
      if (content.includes('```')) {
        const match = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (match) jsonStr = match[1];
      }
      
      // Last resort
      try {
        const result = JSON.parse(jsonStr);
        return result;
      } catch (secondError) {
        throw new Error(`Invalid JSON response from AI: ${parseError.message}`);
      }
    }
  } catch (error: any) {
    console.error('❌ Image analysis error:', error);
    throw new Error(`Failed to analyze image: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Analyze Excel/Spreadsheet files
 * קורא את הנתונים מה-Excel ושולח ל-GPT-4o (text, not vision)
 */
async function analyzeExcelWithAI(buffer: Buffer, documentType: string, fileName: string) {
  try {
    console.log(`📊 Analyzing Excel/Spreadsheet (${documentType})...`);
    
    // 1. Read Excel file using xlsx library
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // 2. Convert all sheets to structured data
    const sheetsData: any = {};
    let totalRows = 0;
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(sheet, { 
        header: 1, // Use first row as headers
        defval: '', // Default value for empty cells
        blankrows: false // Skip blank rows
      });
      
      if (jsonData.length > 0) {
        sheetsData[sheetName] = jsonData;
        totalRows += jsonData.length;
        console.log(`  📄 Sheet "${sheetName}": ${jsonData.length} rows`);
      }
    }
    
    console.log(`✅ Excel parsed: ${workbook.SheetNames.length} sheets, ${totalRows} total rows`);
    
    // 3. Convert to text format for GPT-4o
    let excelText = `File: ${fileName}\n\n`;
    
    for (const [sheetName, rows] of Object.entries(sheetsData)) {
      excelText += `Sheet: ${sheetName}\n`;
      excelText += `${'='.repeat(50)}\n\n`;
      
      const rowsArray = rows as any[];
      
      // If too many rows, limit to first 500 (to avoid token limits)
      const limitedRows = rowsArray.slice(0, 500);
      if (rowsArray.length > 500) {
        console.log(`  ⚠️  Limiting sheet "${sheetName}" from ${rowsArray.length} to 500 rows`);
      }
      
      // Format as table
      for (const row of limitedRows) {
        if (Array.isArray(row)) {
          excelText += row.join(' | ') + '\n';
        }
      }
      
      excelText += '\n\n';
    }
    
    console.log(`📝 Excel text generated: ${excelText.length} characters`);
    
    // 4. Get appropriate prompt
    const prompt = getPromptForDocumentType(documentType, excelText);
    
    // 5. Send to GPT-5-mini using Responses API (faster, smarter)
    console.log(`🤖 Analyzing with GPT-5-mini (Responses API)...`);
    
    // Combine system message with user prompt for Responses API
    const fullPrompt = `אתה מומחה בניתוח מסמכים פיננסיים. החזר תמיד JSON תקין בלבד, ללא טקסט נוסף.\n\n${prompt}`;
    
    // 🆕 GPT-5.2 with Responses API
    const response = await openai.responses.create({
      model: 'gpt-5.2-2025-12-11',
      input: fullPrompt,
      reasoning: { effort: 'medium' },
      max_output_tokens: 16000,
    });

    console.log(`✅ GPT-5-mini analysis complete`);
    
    const content = response.output_text || '{}';
    
    // Parse JSON response with improved error handling
    try {
      const result = JSON.parse(content);
      return result;
    } catch (parseError: any) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.error('JSON String (first 500 chars):', content.substring(0, 500));
      console.error('JSON String (last 200 chars):', content.substring(content.length - 200));
      
      // Try to fix incomplete JSON by adding missing closing brackets
      let jsonStr = content.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.includes('```')) {
        const match = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (match) jsonStr = match[1];
      }
      
      // Count brackets to see what's missing
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      const openBrackets = (jsonStr.match(/\[/g) || []).length;
      const closeBrackets = (jsonStr.match(/\]/g) || []).length;
      
      console.log(`🔍 Bracket analysis: { ${openBraces}/${closeBraces} } [ ${openBrackets}/${closeBrackets} ]`);
      
      // Try to close unterminated strings first
      if (jsonStr.match(/"[^"]*$/)) {
        console.log('🔧 Attempting to close unterminated string...');
        jsonStr += '"';
      }
      
      // Add missing closing brackets
      if (closeBrackets < openBrackets) {
        console.log(`🔧 Adding ${openBrackets - closeBrackets} missing ]`);
        jsonStr += ']'.repeat(openBrackets - closeBrackets);
      }
      
      // Add missing closing braces
      if (closeBraces < openBraces) {
        console.log(`🔧 Adding ${openBraces - closeBraces} missing }`);
        jsonStr += '}'.repeat(openBraces - closeBraces);
      }
      
      // Try parsing the fixed JSON
      try {
        const result = JSON.parse(jsonStr);
        console.log('✅ Successfully parsed JSON after repair');
        return result;
      } catch (secondError) {
        console.error('❌ Still failed after repair:', (secondError as Error).message);
        throw new Error(`Invalid JSON response from AI: ${parseError.message}`);
      }
    }
  } catch (error: any) {
    console.error('❌ Excel analysis error:', error);
    throw new Error(`Failed to analyze Excel: ${error?.message || 'Unknown error'}`);
  }
}

// ============================================================================
// Save Functions - Save to appropriate table based on document type
// ============================================================================

/**
 * Save bank transactions - source transactions (is_source_transaction = true)
 */
async function saveBankTransactions(supabase: any, result: any, userId: string, documentId: string, documentType: string, statementMonth?: string): Promise<number> {
  try {
    console.log(`💾 Saving bank transactions (source) for statement month: ${statementMonth || 'not provided'}`);
    
    // Extract transactions from bank statement format
    let allTransactions: any[] = [];
    
    if (result.transactions && typeof result.transactions === 'object') {
      // Bank statement format: { transactions: { income: [...], expenses: [...], ... } }
      const { income, expenses, loan_payments, savings_transfers } = result.transactions;
      
      if (income) allTransactions.push(...income.map((tx: any) => ({ ...tx, type: 'income' })));
      if (expenses) allTransactions.push(...expenses.map((tx: any) => ({ ...tx, type: 'expense' })));
      if (loan_payments) allTransactions.push(...loan_payments.map((tx: any) => ({ ...tx, type: 'expense', category: 'loan_payment' })));
      if (savings_transfers) allTransactions.push(...savings_transfers.map((tx: any) => ({ ...tx, type: 'expense', category: 'savings' })));
    }

    if (allTransactions.length === 0) {
      console.log('No bank transactions to save');
      return 0;
    }

    // Convert statementMonth to DATE format (YYYY-MM-DD, first day of month)
    let statementMonthDate: string | null = null;
    if (statementMonth) {
      const [year, month] = statementMonth.split('-').map(Number);
      statementMonthDate = `${year}-${String(month).padStart(2, '0')}-01`;
    }

    // Get existing loans for matching
    const { data: existingLoans } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true);

    // Track skipped transactions for logging
    let skippedCount = 0;
    
    const transactionsToInsert = allTransactions.filter((tx: any) => {
      // Parse date using improved date parser with fallback to statement month
      const statementMonthStr = statementMonth ? `${statementMonth}-01` : null;
      const parsedDate = parseDateWithFallback(tx.date, statementMonthStr);

      // 🚨 CRITICAL: Skip transaction if we can't parse date
      if (!parsedDate) {
        skippedCount++;
        console.warn(`⚠️  Skipping bank transaction #${skippedCount} - could not parse date: ${tx.date}, vendor: ${tx.vendor || tx.description}`);
        return false; // Filter out this transaction
      }
      
      // Store parsed date on the transaction object for later use
      (tx as any)._parsedDate = parsedDate;
      return true; // Keep this transaction
    }).map((tx: any) => {
      const parsedDate = (tx as any)._parsedDate;

      // Validate transaction type
      let transactionType = tx.type;
      if (!transactionType || !['income', 'expense'].includes(transactionType)) {
        transactionType = 'expense';
      }

      // Normalize payment method
      let paymentMethod = tx.payment_method;
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
      
      if (paymentMethod && paymentMethodMap[paymentMethod]) {
        paymentMethod = paymentMethodMap[paymentMethod];
      }
      
      if (!paymentMethod || !['cash', 'credit_card', 'debit_card', 'bank_transfer', 'digital_wallet', 'check', 'paypal', 'bit', 'paybox', 'direct_debit', 'standing_order', 'other'].includes(paymentMethod)) {
        if (transactionType === 'income') {
          paymentMethod = 'bank_transfer';
        } else if (tx.category === 'loan_payment') {
          paymentMethod = 'direct_debit';
        } else {
          paymentMethod = 'credit_card';
        }
      }

      // Extract card number last 4 digits if credit card payment
      let cardNumberLast4: string | null = null;
      if (paymentMethod === 'credit_card' && tx.vendor) {
        const cardMatch = tx.vendor.match(/(\d{4})/);
        if (cardMatch) {
          cardNumberLast4 = cardMatch[1];
        }
      }

      // Detect loan payment
      let linkedLoanId = null;
      if (tx.category === 'loan_payment' && existingLoans && existingLoans.length > 0) {
        const txAmount = Math.abs(parseFloat(tx.amount));
        const matchedLoan = existingLoans.find((loan: any) => {
          const loanPayment = parseFloat(loan.monthly_payment);
          const diff = Math.abs(txAmount - loanPayment);
          const percentDiff = (diff / loanPayment) * 100;
          return percentDiff <= 2;
        });
        if (matchedLoan) {
          linkedLoanId = matchedLoan.id;
        }
      }

      // Mark if needs details (credit card payments need credit statement details)
      const needsDetails = paymentMethod === 'credit_card';

      return {
        user_id: userId,
        type: transactionType,
        amount: Math.abs(parseFloat(tx.amount)) || 0,
        category: tx.category || 'other',
        expense_category: tx.expense_category || null,
        vendor: tx.vendor || tx.description || 'לא צוין',
        date: parsedDate,
        tx_date: parsedDate,
        source: 'ocr',
        status: 'proposed',
        notes: tx.notes || tx.description || null,
        payment_method: paymentMethod,
        expense_type: tx.expense_type || 'variable',
        confidence_score: tx.confidence_score || 0.85,
        document_id: documentId,
        original_description: tx.vendor || tx.description,
        auto_categorized: true,
        is_recurring: tx.type === 'הוראת קבע',
        currency: 'ILS',
        // ⭐ New hierarchy fields
        is_source_transaction: true, // Bank statements are source of truth
        statement_month: statementMonthDate, // Month of the statement
        needs_details: needsDetails, // Credit payments need details
        card_number_last4: cardNumberLast4,
        is_immediate_charge: false, // Will be determined later
        linked_loan_id: linkedLoanId,
        matching_status: 'not_matched',
      };
    });

    const { error } = await supabase
      .from('transactions')
      .insert(transactionsToInsert as any);

    if (error) {
      console.error('Failed to insert bank transactions:', error);
      throw error;
    }

    console.log(`💾 Saved ${transactionsToInsert.length} bank transactions (source)${skippedCount > 0 ? `, skipped ${skippedCount} with invalid dates` : ''}`);
    
    // Update linked loans
    const linkedTransactions = transactionsToInsert.filter((tx: any) => tx.linked_loan_id);
    if (linkedTransactions.length > 0) {
      for (const tx of linkedTransactions) {
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
              current_balance: Math.max(0, newBalance),
              remaining_payments: newRemaining,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tx.linked_loan_id);
        }
      }
    }
    
    return transactionsToInsert.length;
  } catch (error) {
    console.error('Error in saveBankTransactions:', error);
    throw error;
  }
}

/**
 * Detect and save missing documents based on bank statement analysis
 * זיהוי מסמכים חסרים על בסיס ניתוח דוח בנק
 */
async function detectAndSaveMissingDocuments(
  supabase: any, 
  result: any, 
  userId: string, 
  documentId: string,
  insertedTransactions: any[]
): Promise<number> {
  try {
    if (!result.missing_documents || !Array.isArray(result.missing_documents)) {
      console.log('ℹ️  No missing documents detected by AI');
      return 0;
    }

    console.log(`🔍 Detected ${result.missing_documents.length} missing documents`);

    const missingDocsToInsert = [];
    let priority = 1000; // Start with high priority, decrement for older items

    for (const doc of result.missing_documents) {
      // Find related transaction if exists
      let relatedTransactionId = null;
      if (doc.charge_date || doc.salary_date || doc.payment_date) {
        const searchDate = doc.charge_date || doc.salary_date || doc.payment_date;
        const searchAmount = doc.charge_amount || doc.salary_amount || doc.payment_amount;
        
        const relatedTx = insertedTransactions.find((tx: any) => 
          tx.date === searchDate && Math.abs(tx.amount - searchAmount) < 1
        );
        
        if (relatedTx) {
          // Get the transaction ID from database
          const { data: txData } = await supabase
            .from('transactions')
            .select('id')
            .eq('user_id', userId)
            .eq('date', searchDate)
            .eq('amount', searchAmount)
            .limit(1)
            .single();
          
          if (txData) {
            relatedTransactionId = txData.id;
          }
        }
      }

      // Build description and instructions
      let description = doc.description || '';
      let instructions = '';
      
      switch (doc.type) {
        case 'credit':
          description = description || `דוח אשראי ****${doc.card_last_4}`;
          instructions = `העלה את דוח כרטיס האשראי המלא לתקופה ${doc.period_start} עד ${doc.period_end}. הדוח צריך להכיל את כל העסקאות שבוצעו בכרטיס.`;
          break;
        case 'payslip':
          description = description || `תלוש משכורת ${doc.month}`;
          instructions = `העלה את תלוש המשכורת המלא לחודש ${doc.month}. התלוש צריך להכיל פירוט מלא של המשכורת ברוטו, ניכויים והמשכורת נטו.`;
          break;
        case 'mortgage':
          description = description || `דוח משכנתא ${doc.lender}`;
          instructions = `העלה את הדוח העדכני ביותר של המשכנתא מ${doc.lender}. הדוח צריך להכיל את יתרת ההלוואה, הריבית והתשלום החודשי.`;
          break;
      }

      missingDocsToInsert.push({
        user_id: userId,
        document_type: doc.type,
        status: 'pending',
        period_start: doc.period_start || null,
        period_end: doc.period_end || null,
        card_last_4: doc.card_last_4 || null,
        account_number: doc.account_number || null,
        related_transaction_id: relatedTransactionId,
        expected_amount: doc.charge_amount || doc.salary_amount || doc.payment_amount || null,
        priority: priority--,
        description,
        instructions,
      });
    }

    if (missingDocsToInsert.length === 0) {
      return 0;
    }

    // Insert missing documents
    const { error } = await supabase
      .from('missing_documents')
      .insert(missingDocsToInsert);

    if (error) {
      console.error('Failed to insert missing documents:', error);
      throw error;
    }

    console.log(`✅ Saved ${missingDocsToInsert.length} missing document requests`);
    return missingDocsToInsert.length;
  } catch (error) {
    console.error('Error in detectAndSaveMissingDocuments:', error);
    // Don't throw - missing documents detection is not critical
    return 0;
  }
}

/**
 * Auto-detect credit card charges and create missing document requests
 * זיהוי אוטומטי של חיובי כרטיס אשראי ויצירת בקשות למסמכים חסרים
 */
async function autoDetectCreditCardCharges(
  supabase: any,
  userId: string,
  insertedTransactions: any[]
): Promise<number> {
  try {
    // Filter transactions with "חיוב כרטיס אשראי" category
    const creditCardCharges = insertedTransactions.filter((tx: any) => 
      tx.expense_category === 'חיוב כרטיס אשראי' || 
      (tx.needs_details === true && tx.payment_method === 'credit_card')
    );

    if (creditCardCharges.length === 0) {
      console.log('ℹ️  No credit card charges detected');
      return 0;
    }

    console.log(`💳 Found ${creditCardCharges.length} credit card charge(s) - creating missing document requests`);

    const missingDocsToInsert = [];

    for (const charge of creditCardCharges) {
      // Extract card last 4 digits from vendor or notes
      let cardLast4 = charge.card_number_last4;
      if (!cardLast4) {
        const cardMatch = (charge.vendor || charge.notes || '').match(/(\d{4})/);
        if (cardMatch) {
          cardLast4 = cardMatch[1];
        }
      }

      // Calculate statement period (credit statement is usually for previous month)
      let periodStart = null;
      let periodEnd = null;
      if (charge.date) {
        const chargeDate = new Date(charge.date);
        // Credit statement period is usually the month BEFORE the charge
        const statementMonth = new Date(chargeDate.getFullYear(), chargeDate.getMonth() - 1, 1);
        const statementEndMonth = new Date(chargeDate.getFullYear(), chargeDate.getMonth(), 0);
        
        periodStart = statementMonth.toISOString().split('T')[0];
        periodEnd = statementEndMonth.toISOString().split('T')[0];
      }

      // Build description
      let description = `דוח אשראי`;
      if (cardLast4) {
        description += ` כרטיס ****${cardLast4}`;
      }
      description += ` - ${charge.amount} ₪`;
      if (charge.date) {
        const chargeDate = new Date(charge.date);
        description += ` (חיוב ${chargeDate.toLocaleDateString('he-IL')})`;
      }

      // Check if already exists
      const { data: existing } = await supabase
        .from('missing_documents')
        .select('id')
        .eq('user_id', userId)
        .eq('document_type', 'credit')
        .eq('status', 'pending');

      if (cardLast4) {
        const { data: existingCard } = await supabase
          .from('missing_documents')
          .select('id')
          .eq('user_id', userId)
          .eq('document_type', 'credit')
          .eq('card_last_4', cardLast4)
          .eq('period_start', periodStart)
          .eq('status', 'pending')
          .single();
        
        if (existingCard) {
          console.log(`ℹ️  Missing document already exists for card ${cardLast4} period ${periodStart}`);
          continue;
        }
      }

      // Calculate priority based on date (more recent = higher priority)
      let priority = 1000;
      if (charge.date) {
        const daysSinceCharge = Math.floor((Date.now() - new Date(charge.date).getTime()) / (1000 * 60 * 60 * 24));
        priority = Math.max(500, 1000 - daysSinceCharge);
      }

      missingDocsToInsert.push({
        user_id: userId,
        document_type: 'credit',
        status: 'pending',
        period_start: periodStart,
        period_end: periodEnd,
        card_last_4: cardLast4,
        related_transaction_id: charge.id,
        expected_amount: charge.amount,
        priority: priority,
        description: description,
        instructions: `העלה את דוח האשראי לתקופה ${periodStart ? new Date(periodStart).toLocaleDateString('he-IL') : ''} - ${periodEnd ? new Date(periodEnd).toLocaleDateString('he-IL') : ''}. זה יעזור לנו לפרט את כל ההוצאות שביצעת באשראי החודש.`,
      });
    }

    if (missingDocsToInsert.length === 0) {
      return 0;
    }

    // Insert missing documents
    const { error } = await supabase
      .from('missing_documents')
      .insert(missingDocsToInsert);

    if (error) {
      console.error('Failed to insert credit card missing documents:', error);
      // Don't throw - this is not critical
      return 0;
    }

    console.log(`✅ Created ${missingDocsToInsert.length} missing credit statement request(s)`);
    return missingDocsToInsert.length;
  } catch (error) {
    console.error('Error in autoDetectCreditCardCharges:', error);
    return 0;
  }
}

/**
 * Save account balance snapshot from bank statement
 * שמירת snapshot של יתרת חשבון מדוח בנק
 */
async function saveAccountSnapshot(
  supabase: any,
  result: any,
  userId: string,
  documentId: string
): Promise<void> {
  try {
    if (!result.account_info || !result.report_info) {
      console.log('ℹ️  No account info for snapshot');
      return;
    }

    const accountInfo = result.account_info;
    const reportInfo = result.report_info;

    // Get balance and snapshot date
    const balance = accountInfo.current_balance || accountInfo.closing_balance || null;
    const snapshotDate = reportInfo.period_end || reportInfo.report_date || null;

    if (!balance || !snapshotDate) {
      console.log('ℹ️  Missing balance or date for snapshot');
      return;
    }

    // Parse snapshot date
    let parsedDate = snapshotDate;
    if (snapshotDate.includes('/')) {
      const parts = snapshotDate.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) {
          year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
        }
        parsedDate = `${year}-${month}-${day}`;
      }
    }

    const snapshot = {
      user_id: userId,
      account_number: accountInfo.account_number || null,
      account_name: accountInfo.account_name || null,
      bank_name: reportInfo.bank_name || null,
      balance: parseFloat(balance),
      snapshot_date: parsedDate,
      source_document_id: documentId,
    };

    // Upsert (insert or update if exists)
    const { error } = await supabase
      .from('account_snapshots')
      .upsert(snapshot, {
        onConflict: 'user_id,account_number,snapshot_date',
      });

    if (error) {
      console.error('Failed to save account snapshot:', error);
      // Don't throw - snapshot is not critical
    } else {
      console.log(`💰 Saved bank account snapshot: ${balance} ₪`);
    }
  } catch (error) {
    console.error('Error in saveAccountSnapshot:', error);
    // Don't throw - snapshot is not critical
  }
}

/**
 * Save credit statement details - creates transaction_details and matches to bank transactions
 * דוח אשראי של חודש X-1 מתחבר לתנועות תשלום אשראי בחודש X
 */
async function saveCreditDetails(supabase: any, result: any, userId: string, documentId: string, statementMonth?: string): Promise<number> {
  try {
    console.log(`💾 Saving credit details for statement month: ${statementMonth || 'not provided'}`);
    
    // Extract transactions from credit statement
    let allTransactions: any[] = [];
    if (result.transactions && Array.isArray(result.transactions)) {
      allTransactions = result.transactions;
    }

    if (allTransactions.length === 0) {
      console.log('No credit transactions to save');
      return 0;
    }

    // Calculate detail period month (the month of the credit statement - X-1)
    let detailPeriodMonth: string | null = null;
    if (statementMonth) {
      const [year, month] = statementMonth.split('-').map(Number);
      detailPeriodMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    }

    // Calculate payment month (credit statement of month X-1 matches bank transactions of month X)
    // דוח אשראי של אוגוסט → תנועות תשלום אשראי בספטמבר
    let paymentMonthDate: string | null = null;
    if (statementMonth) {
      const [year, month] = statementMonth.split('-').map(Number);
      const paymentMonth = month === 12 ? 1 : month + 1;
      const paymentYear = month === 12 ? year + 1 : year;
      paymentMonthDate = `${paymentYear}-${String(paymentMonth).padStart(2, '0')}-01`;
    }

    // Find matching bank transactions (credit card payments in payment month)
    // דוח אשראי של חודש X-1 מחפש תנועות תשלום אשראי בחודש X
    const { data: bankTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_source_transaction', true)
      .eq('payment_method', 'credit_card')
      .eq('needs_details', true);
    
    // Filter by statement_month if we have paymentMonthDate
    let filteredBankTransactions = bankTransactions || [];
    if (paymentMonthDate) {
      // Get transactions from the payment month (X)
      filteredBankTransactions = filteredBankTransactions.filter((tx: any) => {
        if (!tx.statement_month) return false;
        const txMonth = new Date(tx.statement_month).toISOString().slice(0, 7);
        const paymentMonth = paymentMonthDate.slice(0, 7);
        return txMonth === paymentMonth;
      });
    }
    
    filteredBankTransactions.sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });

    console.log(`🔍 Found ${filteredBankTransactions.length} potential bank transactions to match (payment month: ${paymentMonthDate || 'any'})`);

    // Group credit transactions by card (if available) or by amount
    const creditDetails: any[] = [];
    let unmatchedCreditTotal = 0;

    for (const tx of allTransactions) {
      // Parse date using improved date parser
      const statementMonthStr = statementMonth ? `${statementMonth}-01` : null;
      const parsedDate = parseDateWithFallback(tx.date, statementMonthStr);

      if (!parsedDate) {
        console.warn(`⚠️  Skipping transaction - could not parse date: ${tx.date}`);
        continue;
      }

      const amount = Math.abs(parseFloat(tx.amount)) || 0;
      if (amount === 0) {
        console.warn(`⚠️  Skipping transaction - invalid amount: ${tx.amount}`);
        continue;
      }

      // 🔥 CRITICAL: Validate category exists in database
      let expenseCategory = tx.expense_category || null;
      let expenseType = tx.expense_type || null;
      
      // If category is provided, verify it exists in database
      if (expenseCategory) {
        const { data: categoryData } = await supabase
          .from('expense_categories')
          .select('name, expense_type')
          .eq('name', expenseCategory)
          .eq('is_active', true)
          .single();
        
        if (!categoryData) {
          // Category doesn't exist - mark as pending for user review
          console.warn(`⚠️  Category "${expenseCategory}" not found in database - marking as pending`);
          expenseCategory = null;
          expenseType = null;
        } else {
          // Use the expense_type from database
          expenseType = categoryData.expense_type;
        }
      }

      // Extract card number if available
      const cardNumberLast4 = tx.card_number_last4 || null;

      unmatchedCreditTotal += amount;

      creditDetails.push({
        user_id: userId,
        amount: amount,
        vendor: tx.vendor || tx.description || 'לא צוין',
        date: parsedDate,
        notes: tx.notes || tx.description || null,
        category: tx.category || 'other',
        expense_category: expenseCategory, // null if not found or not provided
        expense_type: expenseType, // null if category not found
        payment_method: 'credit_card',
        confidence_score: tx.confidence_score || 0.85,
        // ⭐ New fields for detailed breakdown (from migration 20251110)
        detailed_category: tx.detailed_category || null,
        sub_category: tx.sub_category || null,
        tags: tx.tags || null,
        detailed_notes: tx.detailed_notes || null,
        item_count: tx.item_count || null,
        items: tx.items || null,
        // ⭐ Matching fields (from migration 20251110)
        card_number_last4: cardNumberLast4,
        detail_period_month: detailPeriodMonth,
        credit_statement_id: documentId,
        // parent_transaction_id will be set after matching
        parent_transaction_id: null,
      });
    }

    // Match credit details to bank transactions
    // Strategy: Match by card number first, then by amount and date
    const matchedDetails: any[] = [];
    const unmatchedDetails: any[] = [];

    for (const detail of creditDetails) {
      let bestMatch: any = null;
      let bestScore = 0;

      for (const bankTx of filteredBankTransactions) {
        let score = 0;

        // Card number match (20% weight)
        if (detail.card_number_last4 && bankTx.card_number_last4) {
          if (detail.card_number_last4 === bankTx.card_number_last4) {
            score += 0.2;
          }
        }

        // Amount match (40% weight) - within 5% tolerance
        const amountDiff = Math.abs(detail.amount - bankTx.amount);
        const amountPercentDiff = (amountDiff / bankTx.amount) * 100;
        if (amountPercentDiff <= 5) {
          score += 0.4 * (1 - amountPercentDiff / 5);
        }

        // Date match (30% weight) - within 7 days
        const detailDate = new Date(detail.date);
        const bankDate = new Date(bankTx.date);
        const daysDiff = Math.abs((detailDate.getTime() - bankDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 7) {
          score += 0.3 * (1 - daysDiff / 7);
        }

        // Vendor match (10% weight) - fuzzy matching
        if (detail.vendor && bankTx.vendor) {
          const vendorSimilarity = calculateStringSimilarity(detail.vendor.toLowerCase(), bankTx.vendor.toLowerCase());
          score += 0.1 * vendorSimilarity;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = bankTx;
        }
      }

      if (bestMatch && bestScore >= 0.5) {
        // Match found - link detail to bank transaction
        detail.parent_transaction_id = bestMatch.id;
        matchedDetails.push(detail);
        console.log(`✅ Matched credit detail ${detail.vendor} (${detail.amount} ₪) to bank transaction ${bestMatch.id} (score: ${bestScore.toFixed(2)})`);
      } else {
        // No match - will be created as pending
        unmatchedDetails.push(detail);
        console.log(`⚠️  No match found for credit detail ${detail.vendor} (${detail.amount} ₪)`);
      }
    }

    // Insert matched details
    if (matchedDetails.length > 0) {
      const { error: insertError } = await supabase
        .from('transaction_details')
        .insert(matchedDetails);

      if (insertError) {
        console.error('Failed to insert matched credit details:', insertError);
        throw insertError;
      }

      // Update parent transactions to mark as having details
      const parentIds = Array.from(new Set(matchedDetails.map(d => d.parent_transaction_id)));
      await supabase
        .from('transactions')
        .update({ 
          has_details: true,
          matching_status: 'matched',
        })
        .in('id', parentIds);

      console.log(`💾 Saved ${matchedDetails.length} matched credit details`);
    }

    // Insert unmatched details as regular transactions (not details)
    // These will appear as standalone credit card transactions waiting for bank statement
    if (unmatchedDetails.length > 0) {
      const unmatchedTransactions = unmatchedDetails.map((detail: any) => ({
        user_id: detail.user_id,
        type: 'expense',
        amount: detail.amount,
        vendor: detail.vendor,
        date: detail.date,
        tx_date: detail.date,
        notes: detail.notes,
        category: detail.category,
        expense_category: detail.expense_category,
        expense_type: detail.expense_type,
        payment_method: 'credit_card',
        source: 'ocr',
        status: 'proposed', // ✅ תמיד proposed כדי להופיע ברשימה לאישור
        document_id: documentId,
        // Hierarchy fields
        is_source_transaction: false, // Credit details are NOT source
        statement_month: detail.detail_period_month, // Month they belong to
        card_number_last4: detail.card_number_last4,
        matching_status: 'pending_matching', // Waiting for bank statement
      }));

      const { error: insertError } = await supabase
        .from('transactions')
        .insert(unmatchedTransactions);

      if (insertError) {
        console.error('Failed to insert unmatched credit transactions:', insertError);
        throw insertError;
      }

      console.log(`💾 Saved ${unmatchedDetails.length} unmatched credit transactions (waiting for bank statement)`);
    }

    return creditDetails.length;
  } catch (error) {
    console.error('Error in saveCreditDetails:', error);
    throw error;
  }
}

/**
 * Helper function to calculate string similarity (simple Jaccard similarity)
 */
  function calculateStringSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));
    const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
    const union = new Set([...Array.from(words1), ...Array.from(words2)]);
    return intersection.size / union.size;
  }

/**
 * Save transactions from credit/bank statements (legacy - use saveBankTransactions or saveCreditDetails instead)
 */
async function saveTransactions(supabase: any, result: any, userId: string, documentId: string, documentType: string, statementMonth?: string): Promise<number> {
  try {
    console.log(`💾 Saving transactions for statement month: ${statementMonth || 'not provided, using AI dates'}`);
    
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

    let transactionsToInsert = allTransactions.map((tx: any) => {
      // 🎯 עדיפות 1: התאריך המדויק מהדוח (tx.date)
      // עדיפות 2: statementMonth (אם בחר המשתמש)
      // עדיפות 3: היום (רק אם אין שום מידע)
      const statementMonthStr = statementMonth ? `${statementMonth}-01` : null;
      const parsedDate = parseDateWithFallback(tx.date, statementMonthStr);

      if (!parsedDate) {
        console.warn(`⚠️  Skipping transaction - could not parse date: ${tx.date}`);
        return null; // Will be filtered out
      }

      // Validate and normalize transaction type
      // MUST be either "income" or "expense"
      let transactionType = tx.type;
      
      // Fix invalid type values from AI
      if (!transactionType || !['income', 'expense'].includes(transactionType)) {
        // If AI returned Hebrew values like "תשלום", "קרדיט", "הוראת קבע" - default to expense
        transactionType = 'expense';
      }
      
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

      // 🔥 CRITICAL: Validate category exists in database (only for expenses)
      let expenseCategory = tx.expense_category || null;
      let expenseType = tx.expense_type || null;
      
      // Only validate categories for expenses (income transactions don't need categories)
      if (transactionType === 'expense' && expenseCategory) {
        // Category validation will be done in a batch query below for performance
        // For now, we'll mark it as pending if category is null
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
        expense_category: expenseCategory, // Will be validated below
        vendor: tx.vendor || tx.description || 'לא צוין',
        date: parsedDate,
        tx_date: parsedDate,
        source: 'ocr',
        status: 'proposed', // 🔥 תמיד proposed - המשתמש חייב לאשר ידנית!
        needs_review: true,
        notes: tx.installment 
          ? `${tx.notes || tx.description || ''} ${tx.installment}`.trim() 
          : (tx.notes || tx.description || null),
        payment_method: paymentMethod,
        expense_type: expenseType, // Will be set from database validation
        confidence_score: tx.confidence_score || 0.85,
        document_id: documentId,
        original_description: tx.vendor || tx.description,
        auto_categorized: true,
        // ⭐ New fields: recurring payments
        is_recurring: tx.is_recurring || false,
        recurring_type: tx.recurring_type || null,
        // ⭐ New fields: foreign currency transactions
        original_amount: tx.original_amount || null,
        original_currency: tx.original_currency || null,
        exchange_rate: tx.exchange_rate || null,
        forex_fee: tx.forex_fee || null,
        currency: 'ILS',
        // Linking fields
        is_summary: false, // ✨ לא מסמנים כ-summary בשלב זה - רק ה-matcher יעשה זאת!
        linked_loan_id: linkedLoanId,
      };
    }).filter((tx: any) => tx !== null); // Filter out null transactions (invalid dates)

    // 🔥 CRITICAL: Batch validate all categories for expenses
    const expenseTransactions = transactionsToInsert.filter((tx: any) => tx.type === 'expense' && tx.expense_category);
    const categoryNames = Array.from(new Set(expenseTransactions.map((tx: any) => tx.expense_category)));
    
    if (categoryNames.length > 0) {
      const { data: validCategories } = await supabase
        .from('expense_categories')
        .select('name, expense_type')
        .in('name', categoryNames)
        .eq('is_active', true);
      
      const categoryMap = new Map(
        (validCategories || []).map((cat: any) => [cat.name, cat.expense_type])
      );
      
      // Update transactions with validated categories
      transactionsToInsert = transactionsToInsert.map((tx: any) => {
        if (tx.type === 'expense' && tx.expense_category) {
          if (categoryMap.has(tx.expense_category)) {
            // Category is valid - use expense_type from database
            tx.expense_type = categoryMap.get(tx.expense_category);
            // 🔥 גם אם יש קטגוריה - תמיד proposed לאישור משתמש!
            tx.status = 'proposed';
            tx.needs_review = true;
          } else {
            // Category not found - mark as pending
            console.warn(`⚠️  Category "${tx.expense_category}" not found - marking as pending`);
            tx.expense_category = null;
            tx.expense_type = null;
            tx.status = 'proposed';
            tx.needs_review = true;
          }
        }
        return tx;
      });
    }

    const { error } = await supabase
      .from('transactions')
      .insert(transactionsToInsert as any);

    if (error) {
      console.error('Failed to insert transactions:', error);
      throw error;
    }

    console.log(`💾 Saved ${transactionsToInsert.length} transactions`);
    
    // Update linked loans with new payment info
    const linkedTransactions = transactionsToInsert.filter((tx: any) => tx && tx.linked_loan_id);
    if (linkedTransactions.length > 0) {
      for (const tx of linkedTransactions) {
        if (!tx || !tx.linked_loan_id) continue;
        
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
 * מתחבר לתלוש משכורת (הניכוי) ולתנועות בנק (ההפקדה) - אם יש
 */
async function savePensions(supabase: any, result: any, userId: string, documentId: string, statementMonth?: string): Promise<number> {
  try {
    if (!result.pension_plans || result.pension_plans.length === 0) {
      console.log('No pension plans to save');
      return 0;
    }

    // Calculate statement month date
    let statementMonthDate: string | null = null;
    if (statementMonth) {
      const [year, month] = statementMonth.split('-').map(Number);
      statementMonthDate = `${year}-${String(month).padStart(2, '0')}-01`;
    }

    // Find matching payslip for this month (pension deductions are in payslip)
    // תשלומי פנסיה נראים רק בתלוש, לא בדוח בנק
    let linkedPayslipId: string | null = null;
    if (statementMonthDate) {
      const payslipMonth = statementMonthDate.slice(0, 7); // YYYY-MM
      const { data: payslips } = await supabase
        .from('payslips')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Filter by month_year (compare YYYY-MM part)
      const matchingPayslip = payslips?.find((p: any) => {
        if (!p.month_year) return false;
        const payslipMonthYear = new Date(p.month_year).toISOString().slice(0, 7);
        return payslipMonthYear === payslipMonth;
      });

      if (matchingPayslip) {
        linkedPayslipId = matchingPayslip.id;
        console.log(`🔗 Linked pension report to payslip: ${linkedPayslipId} (month: ${payslipMonth})`);
      } else {
        console.log(`⚠️  No matching payslip found for month: ${payslipMonth}`);
      }
    }

    // Find matching bank transactions (pension deposits) - if any
    // תנועות פנסיה בדוח בנק (אם יש) - יכול להיות NULL אם אין תנועה בנק
    let linkedTransactionId: string | null = null;
    if (statementMonthDate) {
      const { data: pensionTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_source_transaction', true)
        .eq('linked_pension_id', null) // Not already linked
        .gte('statement_month', statementMonthDate)
        .lte('statement_month', statementMonthDate);

      // Try to find pension deposit transaction
      // Look for transactions that might be pension deposits
      const pensionTx = pensionTransactions?.find((tx: any) => {
        const vendor = (tx.vendor || '').toLowerCase();
        return vendor.includes('פנסיה') || 
               vendor.includes('pension') || 
               vendor.includes('קרן') ||
               tx.category === 'pension' ||
               tx.category === 'savings';
      });

      if (pensionTx) {
        linkedTransactionId = pensionTx.id;
        console.log(`🔗 Linked pension report to bank transaction: ${linkedTransactionId}`);
      }
    }

    const pensionsToInsert = result.pension_plans.map((plan: any) => {
      // Parse start_date
      const startDate = parseDateToISO(plan.start_date);

      // Map plan_type to fund_type
      const typeMap: Record<string, string> = {
        'pension_fund': 'pension_fund',
        'provident_fund': 'provident_fund',
        'study_fund': 'study_fund',
        'insurance_policy': 'insurance',
      };
      const fundType = typeMap[plan.plan_type] || 'other';

      return {
        user_id: userId,
        fund_name: plan.plan_name || plan.provider || 'לא צוין',
        fund_type: fundType,
        provider: plan.provider || 'לא צוין',
        policy_number: plan.policy_number || null,
        employee_type: plan.employee_type || null,
        current_balance: parseFloat(plan.current_balance || plan.pension_savings || '0') || 0,
        monthly_deposit: parseFloat(plan.monthly_deposit || plan.employee_deposit || '0') || 0,
        employer_contribution: parseFloat(plan.employer_deposit || plan.employer_contribution || '0') || 0,
        employee_contribution: parseFloat(plan.employee_deposit || plan.monthly_deposit || '0') || 0,
        management_fee_percentage: parseFloat(plan.management_fees || '0') || null,
        deposit_fee_percentage: null,
        annual_return: parseFloat(plan.annual_return || '0') || null,
        start_date: startDate,
        seniority_date: parseDateToISO(plan.seniority_date) || startDate,
        active: plan.status !== 'closed',
        notes: JSON.stringify({
          retirement_age: plan.retirement_age,
          capital_savings: plan.capital_savings,
          retirement_forecast: plan.retirement_forecast,
          investment_track: plan.investment_track,
          insurance_coverage: plan.insurance_coverage,
          document_id: documentId,
          report_info: result.report_info,
        }),
        // ⭐ Linking fields
        linked_payslip_id: linkedPayslipId, // תשלומי פנסיה נראים רק בתלוש, לא בדוח בנק
        linked_transaction_id: linkedTransactionId, // תנועת הפקדה פנסיה בדוח הבנק (אם יש)
      };
    });

    const { error } = await supabase
      .from('pension_insurance')
      .insert(pensionsToInsert);

    if (error) {
      console.error('Failed to insert pensions:', error);
      throw error;
    }

    // Update linked transaction if found
    if (linkedTransactionId) {
      await supabase
        .from('transactions')
        .update({ linked_pension_id: pensionsToInsert[0]?.id || null })
        .eq('id', linkedTransactionId);
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

/**
 * Save loan payments identified in bank statement as loans
 */
async function saveLoanPaymentsAsLoans(supabase: any, result: any, userId: string): Promise<number> {
  try {
    // Try to get loan_payments from dedicated array first
    let loanPayments = result.transactions?.loan_payments || [];
    
    // Fallback: if no loan_payments array, search in expenses with category "loan_payment"
    if (!Array.isArray(loanPayments) || loanPayments.length === 0) {
      const expenses = result.transactions?.expenses || [];
      loanPayments = expenses.filter((exp: any) => 
        exp.category === 'loan_payment' || 
        exp.category?.includes('הלוואה') ||
        exp.expense_category === 'loan_payment'
      );
    }
    
    if (!Array.isArray(loanPayments) || loanPayments.length === 0) {
      console.log('ℹ️  No loan payments found');
      return 0;
    }
    
    console.log(`💳 Found ${loanPayments.length} loan payment(s), creating loan records...`);

    // Get bank name from report (default lender for most loans in bank statements)
    const reportBankName = result.report_info?.bank_name || '';
    
    // Group loan payments by lender/provider to identify unique loans
    const loansByProvider: Record<string, any[]> = {};
    
    loanPayments.forEach((payment: any) => {
      // Prefer lender_name from payment, then loan_provider, then vendor, fallback to report's bank
      const provider = payment.lender_name || payment.loan_provider || payment.vendor || reportBankName || 'לא צוין';
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
        
        // Calculate total monthly payment if multiple payments
        const totalMonthlyPayment = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        const { error: insertError } = await supabase
          .from('loans')
          .insert({
            user_id: userId,
            loan_type: 'personal',
            lender_name: provider,
            original_amount: 0, // Unknown from bank statement
            current_balance: payment.principal ? parseFloat(payment.principal) : 0,
            monthly_payment: totalMonthlyPayment,
            interest_rate: payment.interest_rate ? parseFloat(payment.interest_rate) : null,
            active: true,
            notes: `זוהה אוטומטית מדוח בנק - ${payments.length} תשלום(ים)`,
          });

        if (insertError) {
          console.error(`❌ Failed to insert loan for ${provider}:`, insertError);
        } else {
          loansCreated++;
          console.log(`💳 Created loan record for ${provider} (${totalMonthlyPayment} ₪/month)`);
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
async function savePayslips(supabase: any, result: any, userId: string, documentId: string, statementMonth?: string): Promise<number> {
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

    // Find matching income transaction from bank statement (same month)
    // תלוש משכורת של חודש X מתחבר לתנועת הכנסה של חודש X בדוח הבנק
    let linkedTransactionId: string | null = null;
    const netSalary = parseFloat(info.net_salary || '0');
    
    if (netSalary > 0) {
      // Calculate statement month date
      let statementMonthDate: string | null = null;
      if (statementMonth) {
        const [year, month] = statementMonth.split('-').map(Number);
        statementMonthDate = `${year}-${String(month).padStart(2, '0')}-01`;
      }

      // Search for matching income transaction in bank statement
      const { data: incomeTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'income')
        .eq('is_source_transaction', true)
        .gte('amount', netSalary * 0.95) // Within 5% tolerance
        .lte('amount', netSalary * 1.05);

      // Filter by statement_month if available
      let matchingTransaction: any = null;
      if (statementMonthDate && incomeTransactions) {
        matchingTransaction = incomeTransactions.find((tx: any) => {
          if (!tx.statement_month) return false;
          const txMonth = new Date(tx.statement_month).toISOString().slice(0, 7);
          const payslipMonth = statementMonthDate!.slice(0, 7);
          return txMonth === payslipMonth;
        });
      } else if (incomeTransactions && incomeTransactions.length > 0) {
        // Fallback: match by amount and date proximity
        matchingTransaction = incomeTransactions[0];
      }

      if (matchingTransaction) {
        linkedTransactionId = matchingTransaction.id;
        console.log(`🔗 Linked payslip to existing income transaction: ${matchingTransaction.id} (${matchingTransaction.amount} ₪)`);
      } else {
        // No matching transaction found - create one
        // This can happen if bank statement wasn't uploaded yet
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
          is_source_transaction: false, // Not from bank statement
          statement_month: statementMonthDate,
        };

        const { data: newTx, error: txError } = await supabase
          .from('transactions')
          .insert([incomeTransaction])
          .select()
          .single();

        if (txError) {
          console.warn('Failed to create income transaction from payslip:', txError);
        } else {
          linkedTransactionId = newTx.id;
          console.log(`💸 Created income transaction for ${netSalary} ₪ (no bank statement match found)`);
        }
      }
    }

    // Update payslip with transaction_id
    if (linkedTransactionId) {
      await supabase
        .from('payslips')
        .update({ transaction_id: linkedTransactionId })
        .eq('id', insertedPayslip.id);
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

    // 🆕 Use φ Router for bank/credit documents
    if (docType.includes('credit') || docType.includes('bank')) {
      const { onDocumentProcessed } = await import('@/lib/conversation/phi-router');
      await onDocumentProcessed(userId, user.phone);
      console.log(`✅ φ Router notification sent to ${user.phone}`);
      return;
    }

    // Other document types - send simple message
    const greenAPI = getGreenAPIClient();
    const userName = user.name || 'שלום';
    const url = 'https://finhealer.vercel.app/dashboard';
    
    let message = '';
    
    if (docType.includes('loan') || docType.includes('mortgage')) {
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

