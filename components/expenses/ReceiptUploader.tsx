'use client';

import { useState } from 'react';
import { Upload, Loader2, CheckCircle, XCircle, Camera, FileText } from 'lucide-react';

export default function ReceiptUploader({ onSuccess }: { onSuccess?: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // בדיקת סוג קובץ
    if (!file.type.startsWith('image/')) {
      setError('יש להעלות קובץ תמונה בלבד');
      return;
    }

    // בדיקת גודל (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('גודל הקובץ חייב להיות קטן מ-10MB');
      return;
    }

    await uploadAndAnalyze(file);
  };

  const uploadAndAnalyze = async (file: File) => {
    setUploading(true);
    setAnalyzing(true);
    setError('');
    setResult(null);

    try {
      // שלב 1: ניתוח OCR
      const formData = new FormData();
      formData.append('image', file);
      formData.append('source', 'manual');

      const ocrResponse = await fetch('/api/ocr/analyze-receipt', {
        method: 'POST',
        body: formData,
      });

      const ocrData = await ocrResponse.json();

      if (!ocrResponse.ok) {
        throw new Error(ocrData.error || 'שגיאה בניתוח הקבלה');
      }

      setAnalyzing(false);
      setResult(ocrData);

      // שלב 2: יצירת הוצאות אוטומטית (אפשר לשנות ל-manual approval)
      const createResponse = await fetch('/api/ocr/create-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: ocrData.transactions,
          receipt_id: ocrData.receipt_id,
          auto_create: true, // שינוי ל-false למצב אישור ידני
        }),
      });

      const createData = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(createData.error || 'שגיאה ביצירת ההוצאות');
      }

      console.log('✅ Expenses created:', createData);
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'שגיאה בהעלאת הקבלה');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Camera className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">סריקת קבלה חכמה</h3>
          <p className="text-sm text-gray-600">העלה תמונה והמערכת תזהה אוטומטית את הפרטים</p>
        </div>
      </div>

      {/* Upload Area */}
      {!uploading && !result && (
        <label className="block">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-700 font-medium mb-2">לחץ להעלאת תמונה</p>
            <p className="text-sm text-gray-500">או גרור קובץ לכאן</p>
            <p className="text-xs text-gray-400 mt-4">תומך ב-JPG, PNG, HEIC (עד 10MB)</p>
          </div>
        </label>
      )}

      {/* Loading State */}
      {(uploading || analyzing) && (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-700 font-medium">
            {analyzing ? 'מנתח את הקבלה עם AI...' : 'מעלה...'}
          </p>
          <p className="text-sm text-gray-500 mt-2">זה עשוי לקחת כמה שניות</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-700 font-medium">שגיאה</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <button
              onClick={() => { setError(''); setResult(null); }}
              className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
            >
              נסה שוב
            </button>
          </div>
        </div>
      )}

      {/* Success State */}
      {result && !uploading && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-green-700 font-medium">הצלחה!</p>
              <p className="text-sm text-green-600 mt-1">{result.message}</p>
            </div>
          </div>

          {/* Transactions Preview */}
          {result.transactions && result.transactions.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                <h4 className="font-semibold text-gray-900">
                  הוצאות שזוהו ({result.transactions.length})
                </h4>
              </div>
              <div className="divide-y divide-gray-200">
                {result.transactions.map((tx: any, idx: number) => (
                  <div key={idx} className="px-4 py-3 hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-lg text-gray-900">
                        ₪{tx.amount.toFixed(2)}
                      </span>
                      <span className="text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                        {tx.category}
                      </span>
                    </div>
                    <p className="text-gray-700 font-medium">{tx.vendor}</p>
                    <p className="text-sm text-gray-500 mt-1">{tx.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>📅 {tx.date}</span>
                      <span>💳 {tx.payment_method}</span>
                      <span>🎯 {tx.expense_frequency}</span>
                      <span className="flex items-center gap-1">
                        ✓ {Math.round(tx.confidence * 100)}% ביטחון
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => { setResult(null); setError(''); }}
            className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition font-semibold"
          >
            העלה קבלה נוספת
          </button>
        </div>
      )}
    </div>
  );
}

