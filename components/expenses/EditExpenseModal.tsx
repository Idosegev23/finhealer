"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import ExpenseCategorySelector from '@/components/expenses/expense-category-selector';

interface EditExpenseModalProps {
  expense: {
    id: string;
    amount: number;
    vendor: string;
    date: string;
    expense_category: string;
    expense_category_id?: string;
    expense_type: string;
    payment_method: string;
    notes: string;
    receipt_number?: string; // ⭐ מספר קבלה/מסמך
  };
  onClose: () => void;
  onSave: (updates: any, shouldApprove?: boolean) => void;
}

export function EditExpenseModal({ expense, onClose, onSave }: EditExpenseModalProps) {
  const [formData, setFormData] = useState({
    amount: expense.amount,
    vendor: expense.vendor || '',
    date: expense.date || new Date().toISOString().split('T')[0],
    expense_category: expense.expense_category || '',
    expense_category_id: expense.expense_category_id || '',
    expense_type: expense.expense_type || 'variable',
    payment_method: expense.payment_method || 'credit_card',
    notes: expense.notes || '',
    receipt_number: expense.receipt_number || '', // ⭐ מספר קבלה/מסמך
  });

  const handleSubmit = (e: React.FormEvent, shouldApprove = false) => {
    e.preventDefault();
    
    // ✅ Validation: אי אפשר לאשר ללא קטגוריה
    if (shouldApprove && !formData.expense_category_id) {
      alert('יש לבחור קטגוריה לפני אישור התנועה');
      return;
    }
    
    onSave(formData, shouldApprove);
  };

  const handleCategoryChange = (category: any) => {
    setFormData((prev) => ({
      ...prev,
      expense_category_id: category.id,
      expense_category: category.name,
      expense_type: category.expense_type,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">עריכת הוצאה</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-2">סכום *</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-sm font-medium mb-2">ספק</label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="שם העסק"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-2">תאריך *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">קטגוריה</label>
            <ExpenseCategorySelector
              value={formData.expense_category_id}
              onChange={handleCategoryChange}
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium mb-2">אמצעי תשלום</label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="credit_card">כרטיס אשראי</option>
              <option value="debit_card">כרטיס חיוב</option>
              <option value="cash">מזומן</option>
              <option value="bank_transfer">העברה בנקאית</option>
              <option value="check">שיק</option>
              <option value="digital_wallet">ארנק דיגיטלי</option>
              <option value="other">אחר</option>
            </select>
          </div>

          {/* Receipt Number */}
          <div>
            <label className="block text-sm font-medium mb-2">מספר מסמך/קבלה</label>
            <input
              type="text"
              value={formData.receipt_number}
              onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="מספר הקבלה/מסמך (למניעת כפילויות)"
            />
            <p className="text-xs text-gray-500 mt-1">
              מספר הקבלה או המסמך - עוזר למנוע כפילויות
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">הערות</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="הערות נוספות..."
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4">
            {/* כפתור עיקרי - שמור ואשר */}
            <Button 
              type="button"
              onClick={(e: any) => handleSubmit(e, true)}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={!formData.expense_category_id}
            >
              ✓ שמור ואשר
            </Button>
            
            {/* שורה של כפתורים משניים */}
            <div className="flex gap-3">
              <Button type="submit" variant="outline" className="flex-1">
                שמור בלבד
              </Button>
              <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
                ביטול
              </Button>
            </div>
            
            {/* הודעת עזרה */}
            {!formData.expense_category_id && (
              <p className="text-sm text-amber-600 text-center">
                ⚠️ יש לבחור קטגוריה כדי לאשר את התנועה
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

