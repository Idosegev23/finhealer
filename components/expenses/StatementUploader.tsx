// @ts-nocheck
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Image, CheckCircle, XCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Transaction {
  date: string;
  description: string;
  vendor?: string;
  amount: number;
  category: string;
  detailed_category: string;
  expense_frequency: 'fixed' | 'temporary' | 'special' | 'one_time';
  confidence: number;
}

interface StatementUploaderProps {
  onTransactionsExtracted: (transactions: Transaction[]) => void;
  onClose?: () => void;
}

export default function StatementUploader({ onTransactionsExtracted, onClose }: StatementUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'bank_statement' | 'credit_statement'>('bank_statement');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);

  // Drag & Drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    if (!validTypes.includes(file.type) && 
        !file.name.endsWith('.pdf') && 
        !file.name.endsWith('.xlsx') && 
        !file.name.endsWith('.xls') && 
        !file.name.endsWith('.csv')) {
      setErrorMessage('סוג קובץ לא נתמך. אנא העלה PDF, תמונה או Excel.');
      setUploadStatus('error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('הקובץ גדול מדי. מקסימום 10MB.');
      setUploadStatus('error');
      return;
    }

    setFile(file);
    setUploadStatus('idle');
    setErrorMessage('');
  };

  const handleUpload = async () => {
    if (!file) {
      setErrorMessage('נא לבחור קובץ');
      return;
    }

    setUploading(true);
    setProgress(0);
    setUploadStatus('idle');

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 10, 90));
    }, 500);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', fileType);

      const response = await fetch('/api/expenses/upload-statement', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'העלאה נכשלה');
      }

      const data = await response.json();
      
      setUploadStatus('success');
      
      // המתן שנייה להצגת ההצלחה ואז העבר את התנועות
      setTimeout(() => {
        onTransactionsExtracted(data.transactions || []);
      }, 1000);

    } catch (error: any) {
      clearInterval(progressInterval);
      console.error('Upload error:', error);
      setErrorMessage(error.message || 'שגיאה בהעלאת הקובץ');
      setUploadStatus('error');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadStatus('idle');
    setErrorMessage('');
    setProgress(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              📊 העלאת דוח בנק/אשראי
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              העלה דוח ונזהה את ההוצאות שלך אוטומטית
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* File Type Selector */}
        <div className="mb-6">
          <Label htmlFor="fileType" className="text-base font-semibold mb-2 block">
            סוג הדוח
          </Label>
          <Select value={fileType} onValueChange={(value: any) => setFileType(value)}>
            <SelectTrigger id="fileType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_statement">דוח בנק 🏦</SelectItem>
              <SelectItem value="credit_statement">דוח אשראי 💳</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Drag & Drop Zone */}
        <div
          className={`relative border-3 border-dashed rounded-2xl p-10 text-center transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
          } ${file ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv"
            onChange={handleFileChange}
            disabled={uploading}
          />

          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  גרור קובץ לכאן או לחץ לבחירה
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  תומך ב-PDF, תמונות (JPG, PNG), Excel/CSV
                </p>
                <label htmlFor="file-upload">
                  <Button type="button" variant="outline" size="lg" asChild>
                    <span className="cursor-pointer">בחר קובץ</span>
                  </Button>
                </label>
              </motion.div>
            ) : (
              <motion.div
                key="file-selected"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-4"
              >
                {/* File Icon */}
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
                  {file.type.startsWith('image/') ? (
                    <Image className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <FileText className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  )}
                </div>

                {/* File Name */}
                <p className="text-lg font-bold text-gray-900 dark:text-white">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>

                {/* Progress Bar */}
                {uploading && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <motion.div
                      className="h-full bg-blue-600 dark:bg-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}

                {/* Status Messages */}
                <AnimatePresence>
                  {uploadStatus === 'success' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-semibold"
                    >
                      <CheckCircle className="w-5 h-5" />
                      העלאה הושלמה בהצלחה!
                    </motion.div>
                  )}

                  {uploadStatus === 'error' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 font-semibold"
                    >
                      <XCircle className="w-5 h-5" />
                      {errorMessage}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Change File Button */}
                {!uploading && uploadStatus !== 'success' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetUpload}
                  >
                    החלף קובץ
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Upload Button */}
        {file && uploadStatus !== 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full h-14 text-lg font-bold"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  מעבד את הקובץ...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  העלה וזהה תנועות
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            💡 <strong>טיפ:</strong> המערכת תזהה אוטומטית את התנועות, תסווג אותן לקטגוריות ותציין את תדירות ההוצאה (קבועה/זמנית/מיוחדת).
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

