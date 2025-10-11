'use client';

import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface DetectedField {
  value: number | boolean;
  confidence: number;
  source?: string;
}

interface ImportResultsProps {
  detected: Record<string, DetectedField>;
  onConfirm: (data: Record<string, number>) => void;
  onCancel: () => void;
  fieldLabels: Record<string, string>;
}

export default function ImportResults({ detected, onConfirm, onCancel, fieldLabels }: ImportResultsProps) {
  const entries = Object.entries(detected);
  
  const handleConfirm = () => {
    const confirmedData: Record<string, number> = {};
    entries.forEach(([key, data]) => {
      if (typeof data.value === 'number') {
        confirmedData[key] = data.value;
      }
    });
    onConfirm(confirmedData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      dir="rtl"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#3A7BD5] to-[#2E5EA5] p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">✨ ניתוח הושלם!</h2>
          <p className="text-sm opacity-90">
            זיהינו {entries.length} שדות מהקובץ. אנא אשר או ערוך לפני המשך
          </p>
        </div>

        {/* Results */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <div className="space-y-3">
            {entries.map(([key, data]) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-4 rounded-lg border-2 ${
                  data.confidence >= 0.8
                    ? 'bg-green-50 border-green-200'
                    : data.confidence >= 0.6
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {data.confidence >= 0.8 ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : data.confidence >= 0.6 ? (
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className="font-semibold text-[#1E2A3B]">
                        {fieldLabels[key] || key}
                      </span>
                    </div>
                    
                    <div className="text-2xl font-bold text-[#3A7BD5] mb-2">
                      {typeof data.value === 'number' 
                        ? `${data.value.toLocaleString('he-IL')} ₪`
                        : data.value ? '✓ כן' : '✗ לא'}
                    </div>
                    
                    {data.source && (
                      <div className="text-xs text-[#888888] bg-white/50 p-2 rounded">
                        <strong>מקור:</strong> {data.source}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-left">
                    <div className={`text-sm font-bold ${
                      data.confidence >= 0.8
                        ? 'text-green-600'
                        : data.confidence >= 0.6
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}>
                      {(data.confidence * 100).toFixed(0)}% ביטחון
                    </div>
                    <div className="w-24 h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full ${
                          data.confidence >= 0.8
                            ? 'bg-green-500'
                            : data.confidence >= 0.6
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${data.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {entries.length === 0 && (
            <div className="text-center py-12">
              <XCircle className="w-16 h-16 text-[#888888] mx-auto mb-4" />
              <p className="text-[#555555] text-lg">
                לא הצלחנו לזהות נתונים מהקובץ
              </p>
              <p className="text-sm text-[#888888] mt-2">
                נסה קובץ אחר או מלא את השדות ידנית
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 bg-gray-50 border-t flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-3 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition"
          >
            ביטול
          </button>
          {entries.length > 0 && (
            <button
              onClick={handleConfirm}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#3A7BD5] to-[#2E5EA5] text-white font-bold hover:shadow-lg transition"
            >
              אשר ומלא אוטומטית ✨
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

