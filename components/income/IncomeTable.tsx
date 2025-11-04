"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  DollarSign,
  Banknote,
  Building2,
  Landmark,
  TrendingUp,
  PiggyBank,
  Plus,
  Edit2,
  Trash2,
  Copy,
  MoreVertical,
  CheckCircle,
  XCircle,
  Star,
  StarOff,
} from 'lucide-react';
import { SmartIncomeCalculator } from './SmartIncomeCalculator';
import { Button } from '@/components/ui/button';

// ============================================================================
// טיפוסים
// ============================================================================

interface IncomeSource {
  id: string;
  source_name: string;
  employment_type: string;
  gross_amount: number | null;
  net_amount: number | null;
  actual_bank_amount: number | null;
  payment_frequency: string;
  is_primary: boolean;
  active: boolean;
  employer_name?: string;
  created_at: string;
}

interface IncomeTableProps {
  incomeSources: IncomeSource[];
  onEdit?: (income: IncomeSource) => void;
  onDelete?: (id: string) => void;
  onTogglePrimary?: (id: string, isPrimary: boolean) => void;
  onRefresh?: () => void;
}

// ============================================================================
// אייקונים לפי סוג
// ============================================================================

const EMPLOYMENT_ICONS: Record<string, any> = {
  employee: Briefcase,
  self_employed: DollarSign,
  freelance: Banknote,
  business: Building2,
  rental: Landmark,
  investment: TrendingUp,
  pension: PiggyBank,
  other: Plus,
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  employee: 'שכיר',
  self_employed: 'עצמאי',
  freelance: 'פרילנסר',
  business: 'בעל עסק',
  rental: 'שכירות',
  investment: 'השקעות',
  pension: 'פנסיה',
  other: 'אחר',
};

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'חודשי',
  weekly: 'שבועי',
  one_time: 'חד-פעמי',
  variable: 'משתנה',
};

// ============================================================================
// קומפוננטה ראשית
// ============================================================================

export default function IncomeTable({
  incomeSources,
  onEdit,
  onDelete,
  onTogglePrimary,
  onRefresh,
}: IncomeTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSelectAll = () => {
    if (selectedIds.size === incomeSources.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(incomeSources.map(i => i.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק מקור הכנסה זה?')) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/income/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('שגיאה במחיקה');
      }

      onDelete?.(id);
      onRefresh?.();
    } catch (error) {
      alert('❌ שגיאה במחיקת מקור ההכנסה');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePrimary = async (id: string, currentValue: boolean) => {
    try {
      const response = await fetch(`/api/income/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_primary: !currentValue }),
      });

      if (!response.ok) {
        throw new Error('שגיאה בעדכון');
      }

      onTogglePrimary?.(id, !currentValue);
      onRefresh?.();
    } catch (error) {
      alert('❌ שגיאה בעדכון');
    }
  };

  if (incomeSources.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
        <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">אין עדיין מקורות הכנסה</h3>
        <p className="text-gray-500 text-sm">הוסף את מקור ההכנסה הראשון שלך!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between"
        >
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size} נבחרו
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // TODO: bulk delete
                alert('מחיקה קבוצתית תתווסף בקרוב');
              }}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 ml-1" />
              מחק הכל
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds(new Set())}
            >
              ביטול
            </Button>
          </div>
        </motion.div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full" dir="rtl">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === incomeSources.length}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">
                  שם
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">
                  סוג
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">
                  סכום
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">
                  תדירות
                </th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">
                  סטטוס
                </th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700 w-32">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <AnimatePresence>
                {incomeSources.map((income) => (
                  <IncomeRow
                    key={income.id}
                    income={income}
                    isSelected={selectedIds.has(income.id)}
                    isDeleting={deletingId === income.id}
                    onToggleSelect={() => handleToggleSelect(income.id)}
                    onEdit={() => onEdit?.(income)}
                    onDelete={() => handleDelete(income.id)}
                    onTogglePrimary={() => handleTogglePrimary(income.id, income.is_primary)}
                  />
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// שורת הכנסה
// ============================================================================

interface IncomeRowProps {
  income: IncomeSource;
  isSelected: boolean;
  isDeleting: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePrimary: () => void;
}

function IncomeRow({
  income,
  isSelected,
  isDeleting,
  onToggleSelect,
  onEdit,
  onDelete,
  onTogglePrimary,
}: IncomeRowProps) {
  const [showActions, setShowActions] = useState(false);
  const Icon = EMPLOYMENT_ICONS[income.employment_type] || Plus;

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''} ${isDeleting ? 'opacity-50' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <td className="px-4 py-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="rounded"
          disabled={isDeleting}
        />
      </td>

      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900 flex items-center gap-2">
              {income.source_name}
              {income.is_primary && (
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              )}
            </div>
            {income.employer_name && (
              <div className="text-sm text-gray-500">{income.employer_name}</div>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-4">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {EMPLOYMENT_LABELS[income.employment_type] || income.employment_type}
        </span>
      </td>

      <td className="px-4 py-4">
        <div className="text-lg font-bold text-gray-900">
          {SmartIncomeCalculator.formatAmount(income.actual_bank_amount)}
        </div>
        {income.gross_amount && income.gross_amount !== income.actual_bank_amount && (
          <div className="text-xs text-gray-500">
            ברוטו: {SmartIncomeCalculator.formatAmount(income.gross_amount)}
          </div>
        )}
      </td>

      <td className="px-4 py-4">
        <span className="text-sm text-gray-600">
          {FREQUENCY_LABELS[income.payment_frequency] || income.payment_frequency}
        </span>
      </td>

      <td className="px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-2">
          {income.active ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-gray-400" />
          )}
          <span className="text-sm text-gray-600">
            {income.active ? 'פעיל' : 'לא פעיל'}
          </span>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="flex items-center justify-center gap-1">
          <AnimatePresence>
            {showActions && !isDeleting && (
              <>
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={onTogglePrimary}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title={income.is_primary ? 'הסר סימון ראשי' : 'סמן כראשי'}
                >
                  {income.is_primary ? (
                    <StarOff className="w-4 h-4 text-gray-600" />
                  ) : (
                    <Star className="w-4 h-4 text-gray-600" />
                  )}
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={onEdit}
                  className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                  title="ערוך"
                >
                  <Edit2 className="w-4 h-4 text-blue-600" />
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={onDelete}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                  title="מחק"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </motion.button>
              </>
            )}
          </AnimatePresence>
        </div>
      </td>
    </motion.tr>
  );
}

