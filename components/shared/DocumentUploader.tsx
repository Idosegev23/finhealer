'use client';

import { useCallback, useState } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type DocType = 'bank' | 'credit' | 'payslip' | 'pension' | 'pension_clearing' | 'insurance' | 'insurance_clearing' | 'loan' | 'investment' | 'savings' | 'receipt' | 'mortgage' | 'auto';

interface DocumentUploaderProps {
  /**
   * Initial type for all files. Pass 'auto' (or leave undefined) to let
   * the server auto-detect each file by its name — useful when the user
   * dumps mixed PDFs (bank + credit + Mislaka + insurance) into one go.
   */
  documentType?: DocType;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  acceptedFormats?: string;
  maxSizeMB?: number;
  showPreview?: boolean;
}

interface PendingFile {
  file: File;
  // YYYY-MM. Optional per-file override; falls back to a shared default.
  month: string;
  // Per-file document type override; '' or 'auto' = server detects from filename.
  docType: DocType | '';
  error?: string;
}

interface BatchResult {
  fileName: string;
  status: 'processing' | 'duplicate' | 'error';
  message?: string;
  error?: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  auto: 'זיהוי אוטומטי',
  bank: 'דוח בנק',
  credit: 'דוח אשראי',
  payslip: 'תלוש משכורת',
  pension: 'דוח פנסיה',
  pension_clearing: 'מסלקה פנסיונית',
  insurance: 'פוליסת ביטוח',
  insurance_clearing: 'הר הביטוח (CMA)',
  loan: 'דוח הלוואה',
  investment: 'דוח השקעות',
  savings: 'דוח חיסכון',
  receipt: 'קבלה',
  mortgage: 'דוח משכנתא',
};

const SELECTABLE_DOC_TYPES: DocType[] = [
  'auto', 'bank', 'credit', 'pension_clearing', 'pension', 'insurance_clearing', 'insurance',
  'mortgage', 'loan', 'payslip', 'investment', 'savings', 'receipt',
];

// Same heuristic as the server route — duplicated to give the UI a
// preview before upload so the user can correct mis-detections.
function detectDocTypeFromName(name: string): DocType {
  const f = name.toLowerCase();
  if (/\b(max|visa|mastercard|isracard|cal|leumicard|amex)\b/.test(f)
      || /(ויזה|מאסטר|מסטר|כא"?ל|כאל|ישראכרט|אמריקן|לאומי\s*קארד)/.test(name)) return 'credit';
  // Check 'הר הביטוח' BEFORE generic insurance — it's a different report.
  if (/(הר[\s_]?הביטוח|harb|cma\.gov\.il|הר_הביטוח)/.test(name)) return 'insurance_clearing';
  if (/(mislaka|מסלקה|harari)/.test(name) || /\bpension\b/.test(f)) return 'pension_clearing';
  if (/(פנסיה|קופת.?גמל|השתלמות|ביטוח.?מנהלים)/.test(name)) return 'pension';
  if (/(ביטוח|פוליסה|policy|insurance)/.test(name) && !/(ביטוח.?מנהלים|חיסכון)/.test(name)) return 'insurance';
  if (/(משכנתא|mortgage|הלוואה|loan)/.test(name)) return 'mortgage';
  if (/(תלוש|payslip|salary|משכורת)/.test(name)) return 'payslip';
  if (/(השקעות|portfolio|investment|מניות|stocks)/.test(name)) return 'investment';
  if (/(חיסכון|savings|פיקדון|deposit)/.test(name)) return 'savings';
  return 'bank';
}

export function DocumentUploader({
  documentType = 'auto',
  onSuccess,
  onError,
  acceptedFormats = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls',
  maxSizeMB = 50,
}: DocumentUploaderProps) {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [defaultMonth, setDefaultMonth] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [results, setResults] = useState<BatchResult[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const addFiles = useCallback((files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;

    const list = Array.from(files);
    const accepted: PendingFile[] = [];
    let rejectedReason = '';

    for (const file of list) {
      const sizeMB = file.size / 1024 / 1024;
      if (sizeMB > maxSizeMB) {
        rejectedReason = `${file.name}: גדול מ-${maxSizeMB}MB`;
        continue;
      }
      // Per-file type defaults: when caller pinned a specific type
      // (legacy single-type uploaders), use that. Otherwise auto-detect
      // from filename so the user can correct it inline.
      const seedType: DocType | '' = documentType === 'auto'
        ? detectDocTypeFromName(file.name)
        : documentType;
      accepted.push({ file, month: '', docType: seedType });
    }

    if (rejectedReason) {
      setErrorMessage(rejectedReason);
      onError?.(rejectedReason);
    }

    if (accepted.length > 0) {
      setPending((prev) => [...prev, ...accepted]);
      setStatus('idle');
    }
  }, [documentType, maxSizeMB, onError]);

  const removeFile = (index: number) => {
    setPending((prev) => prev.filter((_, i) => i !== index));
  };

  const setFileMonth = (index: number, month: string) => {
    setPending((prev) => prev.map((p, i) => (i === index ? { ...p, month } : p)));
  };

  const setFileDocType = (index: number, docType: DocType | '') => {
    setPending((prev) => prev.map((p, i) => (i === index ? { ...p, docType } : p)));
  };

  const allMonthsSet = pending.length > 0 && pending.every((p) => p.month || defaultMonth);

  const handleUpload = async () => {
    if (pending.length === 0 || !allMonthsSet) {
      const msg = pending.length === 0
        ? 'בחר לפחות קובץ אחד'
        : 'בחר חודש לכל קובץ (או חודש ברירת-מחדל)';
      setErrorMessage(msg);
      onError?.(msg);
      return;
    }

    setStatus('uploading');
    setErrorMessage('');
    setResults([]);

    try {
      const fd = new FormData();
      pending.forEach((p) => {
        fd.append('files', p.file);
        fd.append('statementMonths', p.month || defaultMonth);
        fd.append('documentTypes', p.docType || 'auto');
      });
      // Caller-level default; the per-file documentTypes[] takes precedence.
      fd.append('documentType', documentType);

      const res = await fetch('/api/documents/upload', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בהעלאה');
      }

      setResults(data.results || []);
      setStatus(data.summary?.errors > 0 ? 'error' : 'success');
      onSuccess?.(data);

      // Clear successful files; keep failed ones so the user can fix them.
      const failedNames = new Set(
        (data.results || [])
          .filter((r: BatchResult) => r.status === 'error')
          .map((r: BatchResult) => r.fileName),
      );
      setPending((prev) => prev.filter((p) => failedNames.has(p.file.name)));
    } catch (err: any) {
      const msg = err?.message || 'שגיאה בהעלאה';
      setErrorMessage(msg);
      setStatus('error');
      onError?.(msg);
    }
  };

  const handleClear = () => {
    setPending([]);
    setResults([]);
    setStatus('idle');
    setErrorMessage('');
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {/* Drop zone */}
        {pending.length === 0 && status !== 'success' && (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-phi-gold transition-colors"
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById(`uploader-input-${documentType}`)?.click()}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-700 mb-1">גרור קבצים לכאן או לחץ לבחירה</p>
            <p className="text-xs text-gray-500">
              {DOCUMENT_TYPE_LABELS[documentType]} · אפשר לבחור מספר קבצים יחד · עד {maxSizeMB}MB לקובץ
            </p>
            <input
              id={`uploader-input-${documentType}`}
              type="file"
              multiple
              accept={acceptedFormats}
              onChange={(e) => addFiles(e.target.files)}
              className="hidden"
            />
          </div>
        )}

        {/* File list with per-file month */}
        {pending.length > 0 && status !== 'uploading' && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <label className="text-sm font-medium text-gray-900 block mb-2">
                חודש ברירת-מחדל לכל הקבצים
              </label>
              <input
                type="month"
                value={defaultMonth}
                onChange={(e) => setDefaultMonth(e.target.value)}
                max={new Date().toISOString().slice(0, 7)}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white text-sm"
              />
              <p className="text-xs text-gray-600 mt-2">
                ניתן לעקוף עבור קובץ ספציפי ברשימה למטה. אם לא נבחר — נשתמש בערך זה.
              </p>
            </div>

            <div className="space-y-2">
              {pending.map((p, idx) => (
                <div key={`${p.file.name}-${idx}`} className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <File className="h-6 w-6 text-phi-dark flex-shrink-0" />
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-medium text-sm text-gray-900 truncate">{p.file.name}</p>
                    <p className="text-xs text-gray-500">{(p.file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <select
                    value={p.docType || 'auto'}
                    onChange={(e) => setFileDocType(idx, e.target.value as DocType)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                    title="סוג המסמך"
                  >
                    {SELECTABLE_DOC_TYPES.map((t) => (
                      <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t] || t}</option>
                    ))}
                  </select>
                  <input
                    type="month"
                    value={p.month}
                    onChange={(e) => setFileMonth(idx, e.target.value)}
                    max={new Date().toISOString().slice(0, 7)}
                    placeholder={defaultMonth}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                    title="חודש המסמך (אופציונלי — נופל לחודש ברירת-מחדל)"
                  />
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    aria-label="הסר"
                  >
                    <X className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => document.getElementById(`uploader-input-${documentType}`)?.click()}
                className="text-sm text-phi-dark hover:underline"
              >
                + הוסף עוד קבצים
              </button>
              <input
                id={`uploader-input-${documentType}`}
                type="file"
                multiple
                accept={acceptedFormats}
                onChange={(e) => addFiles(e.target.files)}
                className="hidden"
              />
              <div className="flex gap-2">
                <Button onClick={handleClear} variant="outline">
                  נקה
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!allMonthsSet}
                  className="bg-phi-dark hover:bg-phi-slate text-white"
                >
                  <Upload className="h-4 w-4 ml-2" />
                  העלה {pending.length} {pending.length === 1 ? 'קובץ' : 'קבצים'}
                </Button>
              </div>
            </div>

            {!allMonthsSet && (
              <p className="text-xs text-amber-700 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                בחר חודש ברירת-מחדל או חודש פרטני לכל קובץ
              </p>
            )}
          </div>
        )}

        {/* Uploading */}
        {status === 'uploading' && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="h-10 w-10 text-phi-dark animate-spin mx-auto" />
            <p className="text-sm text-gray-600">מעלה {pending.length} קבצים...</p>
          </div>
        )}

        {/* Success / partial */}
        {(status === 'success' || (status === 'error' && results.length > 0)) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-phi-mint" />
              <p className="font-semibold text-gray-900">
                {results.filter((r) => r.status === 'processing').length} מסמכים בעיבוד
                {results.some((r) => r.status === 'duplicate') && `, ${results.filter((r) => r.status === 'duplicate').length} כבר היו במערכת`}
                {results.some((r) => r.status === 'error') && `, ${results.filter((r) => r.status === 'error').length} נכשלו`}
              </p>
            </div>
            <ul className="space-y-1 text-xs">
              {results.map((r, i) => (
                <li
                  key={`${r.fileName}-${i}`}
                  className={`px-3 py-2 rounded ${
                    r.status === 'processing' ? 'bg-emerald-50 text-phi-mint' :
                    r.status === 'duplicate' ? 'bg-amber-50 text-phi-coral' :
                    'bg-red-50 text-red-700'
                  }`}
                >
                  <strong>{r.fileName}</strong>
                  {r.message && <span className="opacity-75"> — {r.message}</span>}
                  {r.error && <span className="opacity-75"> — {r.error}</span>}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 text-center">
              העיבוד ממשיך ברקע. תקבל הודעת WhatsApp אחת עם סיכום כשהקבוצה תסיים.
            </p>
            <Button onClick={handleClear} variant="outline" className="w-full">
              העלה קבוצה נוספת
            </Button>
          </div>
        )}

        {/* Plain error */}
        {status === 'error' && results.length === 0 && errorMessage && (
          <div className="py-6 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-phi-coral mx-auto" />
            <p className="text-sm text-phi-coral">{errorMessage}</p>
            <Button onClick={handleClear} variant="outline">
              נסה שוב
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
