"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import ExpenseCategorySelector from '@/components/expenses/expense-category-selector';
import IncomeCategorySelector from '@/components/income/IncomeCategorySelector';

interface EditExpenseModalProps {
  expense: {
    id: string;
    type?: 'income' | 'expense'; // ⭐ סוג התנועה
    amount: number;
    vendor: string;
    date: string;
    expense_category: string;
    expense_category_id?: string;
    expense_type: string;
    payment_method: string;
    notes: string;
    receipt_number?: string; // ⭐ מספר קבלה/מסמך
    source?: string; // ⭐ מקור התנועה (דוח אשראי, דוח בנק, וכו')
    income_category?: string; // ⭐ קטגוריית הכנסה
    employment_type?: string; // ⭐ סוג תעסוקה
    allowance_type?: string; // ⭐ סוג קצבה
  };
  onClose: () => void;
  onSave: (updates: any, shouldApprove?: boolean) => void;
}

export function EditExpenseModal({ expense, onClose, onSave }: EditExpenseModalProps) {
  const isIncome = expense.type === 'income';
  
  const [formData, setFormData] = useState({
    type: expense.type || 'expense',
    amount: expense.amount,
    vendor: expense.vendor || '',
    date: expense.date || new Date().toISOString().split('T')[0],
    expense_category: expense.expense_category || '',
    expense_category_id: expense.expense_category_id || '',
    expense_type: expense.expense_type || '',
    payment_method: expense.payment_method || '',
    notes: expense.notes || '',
    receipt_number: expense.receipt_number || '',
    source: expense.source || '',
    // ⭐ שדות הכנסה
    income_category: expense.income_category || '',
    employment_type: expense.employment_type || '',
    allowance_type: expense.allowance_type || '',
  });

  const handleSubmit = (e: React.FormEvent, shouldApprove = false) => {
    e.preventDefault();
    
    // ✅ Validation: אי אפשר לאשר ללא קטגוריה
    if (shouldApprove) {
      if (isIncome && !formData.income_category) {
        alert('יש לבחור קטגוריית הכנסה לפני אישור התנועה');
        return;
      }
      if (!isIncome && !formData.expense_category_id) {
        alert('יש לבחור קטגוריה לפני אישור התנועה');
        return;
      }
    }
    
    onSave(formData, shouldApprove);
  };

  const handleExpenseCategoryChange = (category: any) => {
    setFormData((prev) => ({
      ...prev,
      expense_category_id: category.id,
      expense_category: category.name,
      expense_type: category.expense_type,
    }));
  };

  const handleIncomeCategoryChange = (category: any) => {
    setFormData((prev) => ({
      ...prev,
      income_category: category.name,
      employment_type: category.employment_type || '',
      allowance_type: category.allowance_type || '',
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div 
        className={`rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto ${
          isIncome 
            ? 'bg-gradient-to-br from-green-50 via-white to-green-50' 
            : 'bg-gradient-to-br from-red-50 via-white to-orange-50'
        }`} 
        dir="rtl"
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-8 border-b-4 ${
          isIncome ? 'border-green-400 bg-green-100' : 'border-red-400 bg-red-100'
        }`}>
          <h2 className={`text-4xl font-extrabold ${
            isIncome ? 'text-green-800' : 'text-red-800'
          }`}>
            {isIncome ? '💰 עריכת הכנסה' : '💳 עריכת הוצאה'}
          </h2>
          <button
            onClick={onClose}
            className={`p-3 rounded-full transition-all hover:scale-110 ${
              isIncome 
                ? 'bg-green-200 hover:bg-green-300 text-green-800' 
                : 'bg-red-200 hover:bg-red-300 text-red-800'
            }`}
          >
            <X className="w-7 h-7 font-bold" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-8 space-y-6">
          {/* Amount */}
          <div className={`p-6 rounded-xl border-4 ${
            isIncome 
              ? 'bg-green-50 border-green-300' 
              : 'bg-red-50 border-red-300'
          }`}>
            <label className={`block text-2xl font-bold mb-3 ${
              isIncome ? 'text-green-800' : 'text-red-800'
            }`}>
              💵 סכום *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              required
              className={`w-full px-6 py-5 text-3xl font-bold border-3 rounded-xl focus:ring-4 focus:outline-none ${
                isIncome 
                  ? 'border-green-400 focus:ring-green-300 focus:border-green-500 text-green-900 bg-white' 
                  : 'border-red-400 focus:ring-red-300 focus:border-red-500 text-red-900 bg-white'
              }`}
              placeholder="0.00 ₪"
            />
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-xl font-bold mb-3 text-gray-800">
              🏪 {isIncome ? 'מקור ההכנסה' : 'ספק/עסק'}
            </label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              className="w-full px-6 py-4 text-xl border-2 rounded-xl focus:ring-4 focus:ring-blue-300 focus:border-blue-500 focus:outline-none"
              placeholder={isIncome ? 'שם המעסיק/מקור' : 'שם העסק'}
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xl font-bold mb-3 text-gray-800">📅 תאריך *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              className="w-full px-6 py-4 text-xl border-2 rounded-xl focus:ring-4 focus:ring-blue-300 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Category */}
          <div className={`p-6 rounded-xl border-4 ${
            isIncome 
              ? 'bg-green-50 border-green-300' 
              : 'bg-orange-50 border-orange-300'
          }`}>
            <label className={`block text-2xl font-bold mb-4 ${
              isIncome ? 'text-green-800' : 'text-orange-800'
            }`}>
              {isIncome ? '📊 קטגוריית הכנסה *' : '📊 קטגוריית הוצאה *'}
            </label>
            {isIncome ? (
              <IncomeCategorySelector
                value={formData.income_category}
                onChange={handleIncomeCategoryChange}
              />
            ) : (
              <ExpenseCategorySelector
                value={formData.expense_category}
                onChange={handleExpenseCategoryChange}
              />
            )}
            {isIncome && formData.income_category && (
              <div className="mt-4 p-5 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl border-2 border-green-400">
                <p className="font-bold text-xl text-green-900 mb-3">✅ פרטי הכנסה:</p>
                <div className="space-y-2">
                  <p className="text-lg text-green-800 font-semibold">
                    📌 קטגוריה: <span className="text-green-900">{formData.income_category}</span>
                  </p>
                  {formData.employment_type && (
                    <p className="text-lg text-green-800 font-semibold">
                      💼 סוג תעסוקה: <span className="text-green-900">{formData.employment_type}</span>
                    </p>
                  )}
                  {formData.allowance_type && (
                    <p className="text-lg text-green-800 font-semibold">
                      🏛️ סוג קצבה: <span className="text-green-900">{formData.allowance_type}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xl font-bold mb-3 text-gray-800">💳 אמצעי תשלום</label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              className="w-full px-6 py-4 text-xl border-2 rounded-xl focus:ring-4 focus:ring-blue-300 focus:border-blue-500 focus:outline-none bg-white"
            >
              <option value="">בחר אמצעי תשלום...</option>
              <option value="credit_card">💳 כרטיס אשראי</option>
              <option value="debit_card">💳 כרטיס חיוב</option>
              <option value="cash">💵 מזומן</option>
              <option value="bank_transfer">🏦 העברה בנקאית</option>
              <option value="check">📝 שיק</option>
              <option value="digital_wallet">📱 ארנק דיגיטלי</option>
              <option value="bit">💰 ביט</option>
              <option value="paybox">📦 פייבוקס</option>
              <option value="other">❓ אחר</option>
            </select>
          </div>

          {/* Receipt Number */}
          <div>
            <label className="block text-xl font-bold mb-3 text-gray-800">📄 מספר מסמך/קבלה</label>
            <input
              type="text"
              value={formData.receipt_number}
              onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
              className="w-full px-6 py-4 text-xl border-2 rounded-xl focus:ring-4 focus:ring-blue-300 focus:border-blue-500 focus:outline-none"
              placeholder="מספר הקבלה/מסמך"
            />
            <p className="text-base text-gray-600 mt-2 font-medium">
              💡 מספר הקבלה או המסמך - עוזר למנוע כפילויות
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xl font-bold mb-3 text-gray-800">📝 הערות</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-6 py-4 text-lg border-2 rounded-xl focus:ring-4 focus:ring-blue-300 focus:border-blue-500 focus:outline-none resize-none"
              placeholder="הערות נוספות..."
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-5 pt-6">
            {/* כפתור עיקרי - שמור ואשר */}
            <Button 
              type="button"
              onClick={(e: any) => handleSubmit(e, true)}
              className={`w-full text-2xl font-extrabold py-7 rounded-2xl shadow-lg transition-all hover:scale-105 ${
                isIncome 
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
              }`}
              disabled={isIncome ? !formData.income_category : !formData.expense_category_id}
            >
              ✅ שמור ואשר
            </Button>
            
            {/* שורה של כפתורים משניים */}
            <div className="flex gap-4">
              <Button 
                type="submit" 
                variant="outline" 
                className="flex-1 text-xl font-bold py-5 rounded-xl border-3 hover:bg-gray-100"
              >
                💾 שמור בלבד
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose} 
                className="flex-1 text-xl font-bold py-5 rounded-xl hover:bg-gray-200"
              >
                ❌ ביטול
              </Button>
            </div>
            
            {/* הודעת עזרה */}
            {((isIncome && !formData.income_category) || (!isIncome && !formData.expense_category_id)) && (
              <div className={`p-5 rounded-xl border-3 ${
                isIncome 
                  ? 'bg-green-100 border-green-400 text-green-900' 
                  : 'bg-amber-100 border-amber-400 text-amber-900'
              }`}>
                <p className="text-xl font-bold text-center">
                  ⚠️ יש לבחור {isIncome ? 'קטגוריית הכנסה' : 'קטגוריה'} כדי לאשר את התנועה
                </p>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

