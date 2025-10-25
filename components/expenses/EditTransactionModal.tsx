'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Transaction {
  id?: string;
  date: string;
  description: string;
  vendor?: string;
  amount: number;
  category: string;
  detailed_category: string;
  expense_frequency: 'fixed' | 'temporary' | 'special' | 'one_time';
  confidence: number;
}

interface EditTransactionModalProps {
  transaction: Transaction;
  onSave: (updated: Transaction) => void;
  onClose: () => void;
}

const FREQUENCY_OPTIONS = [
  { value: 'fixed', label: '🔄 קבועה', description: 'חוזרת כל חודש באותו סכום' },
  { value: 'temporary', label: '⏱️ זמנית', description: 'מנוי לתקופה מוגבלת' },
  { value: 'special', label: '⭐ מיוחדת', description: 'לא תכופה אך חשובה' },
  { value: 'one_time', label: '1️⃣ חד פעמית', description: 'רכישה חד פעמית' },
];

const CATEGORY_OPTIONS = [
  { value: 'food_beverages', label: '🍔 מזון ומשקאות' },
  { value: 'cellular_communication', label: '📱 סלולר ותקשורת' },
  { value: 'entertainment_leisure', label: '🎬 בילויים ופנאי' },
  { value: 'transportation_fuel', label: '⛽ תחבורה ודלק' },
  { value: 'housing_maintenance', label: '🏠 דיור ותחזוקה' },
  { value: 'clothing_footwear', label: '👕 ביגוד והנעלה' },
  { value: 'health_medical', label: '💊 בריאות ותרופות' },
  { value: 'education', label: '📚 חינוך והשכלה' },
  { value: 'utilities', label: '⚡ שירותים (חשמל/מים/גז)' },
  { value: 'shopping_general', label: '🛒 קניות כלליות' },
  { value: 'subscriptions', label: '📺 מנויים' },
  { value: 'insurance', label: '🛡️ ביטוחים' },
  { value: 'loans_debt', label: '💳 הלוואות וחובות' },
  { value: 'other', label: '📦 אחר' },
];

export default function EditTransactionModal({ transaction, onSave, onClose }: EditTransactionModalProps) {
  const [formData, setFormData] = useState<Transaction>(transaction);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.date) {
      newErrors.date = 'תאריך חובה';
    }

    if (!formData.description || formData.description.trim().length < 2) {
      newErrors.description = 'תיאור חובה (לפחות 2 תווים)';
    }

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'סכום חובה להיות חיובי';
    }

    if (!formData.detailed_category) {
      newErrors.detailed_category = 'קטגוריה חובה';
    }

    if (!formData.expense_frequency) {
      newErrors.expense_frequency = 'תדירות חובה';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Transaction, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user fixes field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
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
              ✏️ עריכת תנועה
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              ערוך את פרטי התנועה והסיווג שלה
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Date */}
          <div>
            <Label htmlFor="date" className="text-base font-semibold mb-2 block">
              תאריך *
            </Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className={errors.date ? 'border-red-500' : ''}
            />
            {errors.date && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.date}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-base font-semibold mb-2 block">
              תיאור *
            </Label>
            <Input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="למשל: קניה בסופר, תדלוק..."
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.description}
              </p>
            )}
          </div>

          {/* Vendor */}
          <div>
            <Label htmlFor="vendor" className="text-base font-semibold mb-2 block">
              שם העסק (אופציונלי)
            </Label>
            <Input
              id="vendor"
              type="text"
              value={formData.vendor || ''}
              onChange={(e) => handleChange('vendor', e.target.value)}
              placeholder="למשל: רמי לוי, דלק..."
            />
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount" className="text-base font-semibold mb-2 block">
              סכום *
            </Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
                placeholder="0.00"
                className={`pr-10 ${errors.amount ? 'border-red-500' : ''}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">₪</span>
            </div>
            {errors.amount && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.amount}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="category" className="text-base font-semibold mb-2 block">
              קטגוריה *
            </Label>
            <Select
              value={formData.detailed_category}
              onValueChange={(value) => {
                handleChange('detailed_category', value);
                const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === value)?.label || value;
                handleChange('category', categoryLabel);
              }}
            >
              <SelectTrigger id="category" className={errors.detailed_category ? 'border-red-500' : ''}>
                <SelectValue placeholder="בחר קטגוריה" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.detailed_category && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.detailed_category}
              </p>
            )}
          </div>

          {/* Frequency */}
          <div>
            <Label className="text-base font-semibold mb-3 block">תדירות הוצאה *</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FREQUENCY_OPTIONS.map((freq) => {
                const isSelected = formData.expense_frequency === freq.value;
                return (
                  <button
                    key={freq.value}
                    type="button"
                    onClick={() => handleChange('expense_frequency', freq.value)}
                    className={`p-4 rounded-xl border-2 text-right transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="font-bold text-gray-900 dark:text-white mb-1">
                      {freq.label}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {freq.description}
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.expense_frequency && (
              <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.expense_frequency}
              </p>
            )}
          </div>

          {/* Confidence Badge */}
          {formData.confidence > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  רמת ביטחון בזיהוי AI
                </span>
                <Badge className="bg-blue-600 text-white border-0">
                  {Math.round(formData.confidence * 100)}%
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-8">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-12"
            disabled={saving}
          >
            ביטול
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white ml-2"></div>
                שומר...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 ml-2" />
                שמור שינויים
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

