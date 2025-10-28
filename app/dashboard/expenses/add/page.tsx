'use client';

import { useState } from 'react';
import { Upload, Edit } from 'lucide-react';
import ExpenseCategorySelector from '@/components/expenses/expense-category-selector';

type TabType = 'scan' | 'manual';

interface ExpenseCategory {
  id: string;
  name: string;
  expense_type: 'fixed' | 'variable' | 'special';
  applicable_to: 'employee' | 'self_employed' | 'both';
  category_group: string;
}

export default function AddExpensePage() {
  const [activeTab, setActiveTab] = useState<TabType>('scan');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">הוספת הוצאה</h1>
          <p className="text-gray-600 mt-2">בחר אם לסרוק דוח או להזין הוצאה ידנית</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('scan')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'scan'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Upload className="inline-block h-5 w-5 ml-2" />
              סריקת דוח
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'manual'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Edit className="inline-block h-5 w-5 ml-2" />
              הזנה ידנית
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'scan' ? (
              <ScanTab
                isUploading={isUploading}
                setIsUploading={setIsUploading}
                uploadMessage={uploadMessage}
                setUploadMessage={setUploadMessage}
              />
            ) : (
              <ManualTab />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== טאב סריקה ==========
interface ScanTabProps {
  isUploading: boolean;
  setIsUploading: (val: boolean) => void;
  uploadMessage: string;
  setUploadMessage: (msg: string) => void;
}

function ScanTab({ isUploading, setIsUploading, uploadMessage, setUploadMessage }: ScanTabProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'bank_statement' | 'credit_statement'>('bank_statement');

  async function handleFileUpload() {
    if (!selectedFile) {
      setUploadMessage('אנא בחר קובץ תחילה');
      return;
    }

    setIsUploading(true);
    setUploadMessage('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('fileType', fileType);

      const response = await fetch('/api/expenses/upload-statement', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadMessage('✅ הקובץ מעובד! תקבל התראה כשמוכן.');
        setSelectedFile(null);
        
        // אופציונלי: הפניה לדף הוצאות ממתינות אחרי 3 שניות
        setTimeout(() => {
          window.location.href = '/dashboard/expenses?filter=proposed';
        }, 3000);
      } else {
        setUploadMessage(`❌ שגיאה: ${data.error || 'לא הצלחנו לעבד את הקובץ'}`);
      }
    } catch (error: any) {
      setUploadMessage(`❌ שגיאה: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">העלאת דוח בנק/אשראי</h3>
        <p className="text-gray-600 mb-4">
          העלה קובץ PDF, תמונה, או Excel של דוח בנק או אשראי.
          <br />
          המערכת תזהה אוטומטית את ההוצאות ותציג אותן לאישור.
        </p>
      </div>

      {/* סוג דוח */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">סוג הדוח</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="fileType"
              value="bank_statement"
              checked={fileType === 'bank_statement'}
              onChange={(e) => setFileType(e.target.value as any)}
              className="w-4 h-4 text-blue-600"
            />
            <span>דוח בנק</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="fileType"
              value="credit_statement"
              checked={fileType === 'credit_statement'}
              onChange={(e) => setFileType(e.target.value as any)}
              className="w-4 h-4 text-blue-600"
            />
            <span>דוח אשראי</span>
          </label>
        </div>
      </div>

      {/* העלאת קובץ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">בחר קובץ</label>
        <div className="flex items-center gap-4">
          <label className="flex-1 cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              {selectedFile ? (
                <div>
                  <Upload className="mx-auto h-12 w-12 text-blue-500 mb-2" />
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-700">לחץ לבחירת קובץ</p>
                  <p className="text-xs text-gray-500 mt-1">PDF, תמונה, Excel</p>
                </div>
              )}
            </div>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* כפתור העלאה */}
      <button
        onClick={handleFileUpload}
        disabled={!selectedFile || isUploading}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {isUploading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            מעבד קובץ...
          </span>
        ) : (
          'העלה וסרוק'
        )}
      </button>

      {/* הודעת סטטוס */}
      {uploadMessage && (
        <div
          className={`p-4 rounded-lg ${
            uploadMessage.startsWith('✅')
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {uploadMessage}
        </div>
      )}
    </div>
  );
}

// ========== טאב הזנה ידנית ==========
function ManualTab() {
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'debit'>('credit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedCategory || !amount || !vendor) {
      setMessage('❌ אנא מלא את כל השדות החובה');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/expenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          vendor,
          date,
          expense_category: selectedCategory.name,
          expense_category_id: selectedCategory.id,
          expense_type: selectedCategory.expense_type,
          payment_method: paymentMethod,
          notes,
          source: 'manual',
          status: 'confirmed', // מאושר מיד כי הוזן ידנית
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage('✅ ההוצאה נוספה בהצלחה!');
        
        // איפוס טופס
        setSelectedCategory(null);
        setAmount('');
        setVendor('');
        setNotes('');
        
        // הפניה לדף הוצאות אחרי 2 שניות
        setTimeout(() => {
          window.location.href = '/dashboard/expenses';
        }, 2000);
      } else {
        setMessage(`❌ שגיאה: ${data.error || 'לא הצלחנו להוסיף את ההוצאה'}`);
      }
    } catch (error: any) {
      setMessage(`❌ שגיאה: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">הזנת הוצאה ידנית</h3>
        <p className="text-gray-600 mb-4">מלא את הפרטים של ההוצאה</p>
      </div>

      {/* קטגוריית הוצאה */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          סוג הוצאה <span className="text-red-500">*</span>
        </label>
        <ExpenseCategorySelector
          value={selectedCategory?.name}
          onChange={setSelectedCategory}
          placeholder="חפש או בחר הוצאה..."
        />
        {selectedCategory && (
          <p className="text-sm text-gray-500 mt-2">
            {selectedCategory.expense_type === 'fixed' && '📌 הוצאה קבועה'}
            {selectedCategory.expense_type === 'variable' && '🔄 הוצאה משתנה'}
            {selectedCategory.expense_type === 'special' && '⭐ הוצאה מיוחדת'}
          </p>
        )}
      </div>

      {/* סכום */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          סכום (₪) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
          required
        />
      </div>

      {/* ספק/עסק */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          שם עסק/ספק <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="לדוגמה: שופרסל, חברת החשמל..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
          required
        />
      </div>

      {/* תאריך */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">תאריך</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      {/* אמצעי תשלום */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">אמצעי תשלום</label>
        <div className="flex gap-4">
          {[
            { value: 'credit', label: '💳 אשראי' },
            { value: 'debit', label: '🏦 חיוב' },
            { value: 'cash', label: '💵 מזומן' },
          ].map((method) => (
            <label key={method.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value={method.value}
                checked={paymentMethod === method.value}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-4 h-4 text-blue-600"
              />
              <span>{method.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* הערות */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">הערות (אופציונלי)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הוסף הערות נוספות..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right resize-none"
        />
      </div>

      {/* כפתור שליחה */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'שומר...' : 'הוסף הוצאה'}
      </button>

      {/* הודעת סטטוס */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.startsWith('✅')
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}
    </form>
  );
}

