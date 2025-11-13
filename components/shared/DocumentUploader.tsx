'use client';

import { useState, useCallback } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

interface DocumentUploaderProps {
  documentType: 'bank' | 'credit' | 'payslip' | 'pension' | 'insurance' | 'loan' | 'investment' | 'savings' | 'receipt' | 'mortgage';
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  acceptedFormats?: string;
  maxSizeMB?: number;
  showPreview?: boolean;
}

/**
 * DocumentUploader - קומפוננט מאוחד להעלאת מסמכים פיננסיים
 * 
 * @example
 * ```tsx
 * <DocumentUploader 
 *   documentType="bank"
 *   onSuccess={(data) => console.log('Uploaded!', data)}
 * />
 * ```
 */
export function DocumentUploader({
  documentType,
  onSuccess,
  onError,
  acceptedFormats = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls',
  maxSizeMB = 50,
  showPreview = true,
}: DocumentUploaderProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // ⭐ אין ערך ברירת מחדל - המשתמש חייב לבחור
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [statementId, setStatementId] = useState<string | null>(null);

  const handleFileSelect = useCallback((selectedFile: File | null) => {
    if (!selectedFile) return;

    // Validate file size
    const fileSizeMB = selectedFile.size / 1024 / 1024;
    if (fileSizeMB > maxSizeMB) {
      setErrorMessage(`הקובץ גדול מדי (${fileSizeMB.toFixed(1)} MB). מקסימום: ${maxSizeMB} MB`);
      setStatus('error');
      onError?.(`File too large: ${fileSizeMB.toFixed(1)} MB`);
      return;
    }

    setFile(selectedFile);
    setStatus('idle');
    setErrorMessage('');
  }, [maxSizeMB, onError]);

  const handleUpload = async () => {
    if (!file) return;

    // ✅ Validation: חובה לבחור חודש לכל המסמכים
    if (!selectedMonth) {
      setErrorMessage('חובה לבחור את חודש המסמך! 📅');
      setStatus('error');
      onError?.('חובה לבחור חודש המסמך');
      return;
    }

    setUploading(true);
    setStatus('uploading');
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      formData.append('statementMonth', selectedMonth); // ⭐ חודש הדוח

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בהעלאת הקובץ');
      }

      const data = await response.json();
      setStatementId(data.statementId || data.id);
      setStatus('success');
      onSuccess?.(data);

      // Stay in scan center - user can upload more documents
      // Processing continues in background, user gets WhatsApp notification when done
    } catch (error) {
      console.error('Upload error:', error);
      const message = error instanceof Error ? error.message : 'שגיאה בהעלאת הקובץ';
      setErrorMessage(message);
      setStatus('error');
      onError?.(message);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setErrorMessage('');
    setStatementId(null);
  };

  const documentTypeLabels: Record<typeof documentType, string> = {
    bank: 'דוח בנק',
    credit: 'דוח אשראי',
    payslip: 'תלוש משכורת',
    pension: 'דוח פנסיה',
    insurance: 'פוליסת ביטוח',
    loan: 'דוח הלוואה',
    investment: 'דוח השקעות',
    savings: 'דוח חיסכון',
    receipt: 'קבלה',
    mortgage: 'דוח משכנתא',
  };

  return (
    <Card>
      <CardContent className="p-6">
        {/* Idle State - File Selection */}
        {status === 'idle' && !file && (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
            onDrop={(e) => {
              e.preventDefault();
              const droppedFile = e.dataTransfer.files[0];
              handleFileSelect(droppedFile);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600 mb-2">
              גרור קובץ לכאן או לחץ לבחירה
            </p>
            <p className="text-xs text-gray-500 mb-4">
              {documentTypeLabels[documentType]} - {acceptedFormats.replace(/\./g, '').toUpperCase()} (עד {maxSizeMB} MB)
            </p>
            <input
              id="file-input"
              type="file"
              accept={acceptedFormats}
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              className="hidden"
            />
          </div>
        )}

        {/* File Selected */}
        {file && status === 'idle' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <File className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="p-2 hover:bg-blue-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* ⭐ Month selector - REQUIRED for all documents */}
            <div className="space-y-3 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <label htmlFor="statement-month" className="block text-sm font-bold text-gray-900">
                  חודש המסמך 📅 <span className="text-red-600">*חובה</span>
                </label>
              </div>
              <input
                id="statement-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-amber-400 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white text-lg font-semibold"
                max={new Date().toISOString().slice(0, 7)} // לא מאפשר חודשים עתידיים
              />
              <div className="bg-white p-3 rounded-lg border border-amber-200">
                <p className="text-sm text-gray-700 font-medium mb-1">
                  ℹ️ למה זה חשוב?
                </p>
                <p className="text-xs text-gray-600">
                  בחירת החודש הנכון מאפשרת לנו לסווג נכון את ההוצאות שלך, להתאים בין מסמכים שונים ולעקוב אחרי התקציב החודשי.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleUpload} 
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg py-6"
                disabled={!file || !selectedMonth}
              >
                <Upload className="h-5 w-5 mr-2" />
                {!selectedMonth 
                  ? 'בחר חודש כדי להמשיך ⬆️' 
                  : 'העלה ועבד את המסמך ✨'}
              </Button>
              <Button onClick={handleReset} variant="outline" className="px-6">
                בטל
              </Button>
            </div>
          </div>
        )}

        {/* Uploading */}
        {status === 'uploading' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">מעלה...</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <p className="text-sm text-gray-600 text-center">
              מעלה את הקובץ לשרת...
            </p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                הקובץ הועלה בהצלחה! ✅
              </h3>
              <p className="text-sm text-gray-600">
                העיבוד מתבצע ברקע. נודיע לך כשיסתיים 🔔
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                📱 תקבל הודעת WhatsApp כשהעיבוד יסתיים
              </p>
              <Button onClick={handleReset} variant="outline" className="w-full">
                📄 העלה מסמך נוסף
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="py-8 text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-red-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                שגיאה ❌
              </h3>
              <p className="text-sm text-red-600">
                {errorMessage}
              </p>
            </div>
            <Button onClick={handleReset}>
              נסה שוב
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

