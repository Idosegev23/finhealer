import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkApiRateLimit } from '@/lib/utils/api-rate-limiter';
import crypto from 'crypto';

/**
 * POST /api/documents/upload
 * Uploads ONE OR MORE financial documents (bank, credit, payslip, …) and
 * fires off background processing for each. All files in a single request
 * share a `batch_id` so the WhatsApp notification logic can hold the
 * per-file confirmations and emit one summary at the end of the batch.
 *
 * Backwards compatible: callers sending a single `file` field keep working.
 * New callers can send `files[]` instead and pass a parallel `statementMonth`
 * (single value applies to all, or `statementMonths[]` for per-file values).
 */

type UploadResult = {
  fileName: string;
  statementId?: string;
  fileSize?: number;
  status: 'processing' | 'duplicate' | 'error';
  message?: string;
  error?: string;
};

const VALID_DOC_TYPES = [
  'bank', 'credit', 'payslip', 'pension', 'pension_clearing',
  'insurance', 'loan', 'investment', 'savings', 'receipt', 'mortgage',
  'bank_statement', 'credit_statement',
];

const FILE_TYPE_MAP: Record<string, string> = {
  bank: 'bank_statement',
  credit: 'credit_statement',
  payslip: 'salary_slip',
  pension: 'pension_report',
  pension_clearing: 'pension_report',
  insurance: 'insurance_report',
  loan: 'loan_statement',
  investment: 'investment_report',
  savings: 'savings_statement',
  receipt: 'receipt',
  mortgage: 'loan_statement',
  bank_statement: 'bank_statement',
  credit_statement: 'credit_statement',
};

function deriveStatementMonth(fallback: string | null): { month: string; periodStart: string; periodEnd: string; statementMonthDate: string } {
  // Default to current month when the caller didn't pick one. Server-side
  // resolution ahead of the OCR-corrected period that the processor sets
  // on completion.
  const now = new Date();
  const month = fallback || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, mo] = month.split('-').map(Number);
  const periodStart = `${year}-${String(mo).padStart(2, '0')}-01`;
  const lastDay = new Date(year, mo, 0).getDate();
  const periodEnd = `${year}-${String(mo).padStart(2, '0')}-${lastDay}`;
  const statementMonthDate = periodStart;
  return { month, periodStart, periodEnd, statementMonthDate };
}

async function uploadOne(
  supabase: any,
  userId: string,
  file: File,
  documentType: string,
  statementMonth: string | null,
  batchId: string,
): Promise<UploadResult> {
  try {
    if (!VALID_DOC_TYPES.includes(documentType)) {
      return { fileName: file.name, status: 'error', error: `סוג מסמך לא חוקי: ${documentType}` };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Dedup: same content already uploaded by the same user → skip.
    const { data: existing } = await supabase
      .from('uploaded_statements')
      .select('id, status, file_name')
      .eq('user_id', userId)
      .eq('file_hash', fileHash)
      .maybeSingle();
    if (existing) {
      return {
        fileName: file.name,
        statementId: existing.id,
        status: 'duplicate',
        message: `כבר הועלה (${existing.file_name})`,
      };
    }

    const fileExtension = file.name.split('.').pop() || 'pdf';
    const safeFileName = `${userId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from('financial-documents')
      .upload(safeFileName, buffer, { contentType: file.type, upsert: false });
    if (uploadError) {
      return { fileName: file.name, status: 'error', error: uploadError.message || 'שגיאת אחסון' };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('financial-documents')
      .getPublicUrl(safeFileName);

    const { month, periodStart, periodEnd, statementMonthDate } = deriveStatementMonth(statementMonth);

    const fileType = FILE_TYPE_MAP[documentType] || 'other';
    const isSourceDocument = documentType === 'bank' || documentType === 'bank_statement';

    const { data: statement, error: dbError } = await supabase
      .from('uploaded_statements')
      .insert({
        user_id: userId,
        file_name: file.name,
        file_type: fileType,
        document_type: documentType,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        status: 'pending',
        period_start: periodStart,
        period_end: periodEnd,
        statement_month: statementMonthDate,
        is_source_document: isSourceDocument,
        batch_id: batchId,
        file_hash: fileHash,
      })
      .select('id')
      .single();

    if (dbError) {
      return { fileName: file.name, status: 'error', error: dbError.message };
    }

    // Fire-and-forget — Vercel Background Function handles per-doc OCR
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://finhealer.vercel.app'}/api/documents/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({ statementId: statement.id }),
    }).catch((err) => console.error('[upload] process trigger failed:', err));

    return {
      fileName: file.name,
      statementId: statement.id,
      fileSize: file.size,
      status: 'processing',
      message: `נשלח לעיבוד (${month})`,
    };
  } catch (error: any) {
    return { fileName: file.name, status: 'error', error: error.message || 'שגיאה לא צפויה' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = checkApiRateLimit(request, 20, 60_000);
    if (limited) return limited;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();

    // Multi-file: prefer files[]; fall back to a single `file` field.
    const filesRaw = formData.getAll('files');
    const files: File[] = (filesRaw.length > 0 ? filesRaw : [formData.get('file')])
      .filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: 'לא נשלחו קבצים' }, { status: 400 });
    }

    const documentType = (formData.get('documentType') as string) || 'bank';

    // Per-file months OR a single month for all
    const monthsRaw = formData.getAll('statementMonths');
    const months: (string | null)[] = monthsRaw.length > 0
      ? monthsRaw.map((m) => (typeof m === 'string' && m ? m : null))
      : files.map(() => (formData.get('statementMonth') as string) || null);

    const batchId = crypto.randomUUID();

    console.log(`📤 Upload batch ${batchId.substring(0, 8)}: ${files.length} files (${documentType})`);

    // Upload sequentially — Supabase storage prefers steady throughput
    // over parallel small uploads, and we don't want to spike the DB.
    const results: UploadResult[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const result = await uploadOne(
        supabase,
        user.id,
        files[i],
        documentType,
        months[i] || null,
        batchId,
      );
      results.push(result);
    }

    const summary = {
      batchId,
      total: results.length,
      processing: results.filter((r) => r.status === 'processing').length,
      duplicate: results.filter((r) => r.status === 'duplicate').length,
      errors: results.filter((r) => r.status === 'error').length,
    };

    console.log(`📦 Batch ${batchId.substring(0, 8)} complete:`, summary);

    return NextResponse.json({
      success: summary.errors === 0,
      summary,
      results,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
