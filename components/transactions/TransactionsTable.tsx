'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, CheckCircle, Clock, Pencil, Trash2, Save, X, Sparkles, Loader2 } from 'lucide-react';
import { subscribeToTransactions } from '@/lib/supabase/realtime';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import SmartCategoryPicker from './SmartCategoryPicker';
import { AccountFilter } from '@/components/dashboard/AccountFilter';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  vendor: string | null;
  description: string | null;
  source: string;
  tx_date: string;
  date: string;
  status: 'pending' | 'confirmed';
  category: string | null;
  expense_category: string | null;
  income_category: string | null;
  goal_id?: string | null;
  financial_account_id?: string | null;
  goal?: {
    id: string;
    name: string;
  } | null;
  budget_categories?: {
    id: string;
    name: string;
  } | null;
}

interface EditingState {
  vendor: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  tx_date: string;
  status: 'pending' | 'confirmed';
}

interface TransactionsTableProps {
  initialTransactions: Transaction[];
  categories: Array<{ id: string; name: string }>;
  goals?: Array<{ id: string; name: string }>;
  userId: string;
}

export default function TransactionsTable({
  initialTransactions,
  categories,
  goals = [],
  userId
}: TransactionsTableProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string | null>(null);
  const [updatingGoal, setUpdatingGoal] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyResult, setReclassifyResult] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time: refetch transactions when changes are detected
  const refetchTransactions = useCallback(async () => {
    try {
      const supabase = createClient();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('tx_date', thirtyDaysAgoStr)
        .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true')
        .order('tx_date', { ascending: false });

      if (data) setTransactions(data as any);
    } catch (err) {
      console.error('Realtime refetch failed:', err);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Debounced refetch to batch rapid changes
    const triggerRefetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        refetchTransactions();
      }, 1000);
    };

    channelRef.current = subscribeToTransactions(userId, {
      onChange: triggerRefetch,
    });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, refetchTransactions]);

  // עדכון יעד של תנועה
  async function handleGoalChange(transactionId: string, goalId: string | null) {
    setUpdatingGoal(transactionId);

    try {
      const { createClientComponentClient } = await import('@/lib/supabase/client');
      const supabase = createClientComponentClient();

      const { error } = await supabase
        .from('transactions')
        .update({ goal_id: goalId })
        .eq('id', transactionId);

      if (error) {
        console.error('Failed to update goal:', error);
        alert('שגיאה בעדכון היעד');
        return;
      }

      setTransactions(prev => prev.map(tx =>
        tx.id === transactionId
          ? { ...tx, goal_id: goalId }
          : tx
      ));

    } catch (error) {
      console.error('Error updating goal:', error);
      alert('שגיאה בעדכון היעד');
    } finally {
      setUpdatingGoal(null);
    }
  }

  // ── עריכה ──
  function startEdit(tx: Transaction) {
    setEditingId(tx.id);
    setEditData({
      vendor: tx.vendor || '',
      amount: tx.amount,
      type: tx.type,
      category: tx.expense_category || tx.income_category || tx.category || '',
      tx_date: tx.tx_date || tx.date,
      status: tx.status,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData(null);
  }

  async function saveEdit() {
    if (!editingId || !editData) return;
    setSaving(true);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          vendor: editData.vendor,
          amount: editData.amount,
          type: editData.type,
          category: editData.category,
          tx_date: editData.tx_date,
          status: editData.status,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'שגיאה בשמירה');
        return;
      }

      const { transaction: updated } = await res.json();

      setTransactions(prev =>
        prev.map(tx =>
          tx.id === editingId
            ? {
                ...tx,
                ...updated,
                category: updated.category,
                expense_category: updated.type === 'expense' ? updated.category : tx.expense_category,
                income_category: updated.type === 'income' ? updated.category : tx.income_category,
              }
            : tx
        )
      );
      setEditingId(null);
      setEditData(null);
    } catch {
      alert('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  // ── מחיקה ──
  async function handleDelete(txId: string) {
    if (!confirm('למחוק את התנועה?')) return;
    setDeletingId(txId);

    try {
      const res = await fetch(`/api/transactions?id=${txId}`, { method: 'DELETE' });
      if (!res.ok) {
        alert('שגיאה במחיקה');
        return;
      }
      setTransactions(prev => prev.filter(tx => tx.id !== txId));
    } catch {
      alert('שגיאה במחיקה');
    } finally {
      setDeletingId(null);
    }
  }

  // ── סיווג מחדש ──
  async function handleReclassify() {
    setReclassifying(true);
    setReclassifyResult(null);

    try {
      const res = await fetch('/api/transactions/reclassify', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'שגיאה בסיווג מחדש');
        return;
      }
      const data = await res.json();
      setReclassifyResult(`סווגו ${data.updated} תנועות מתוך ${data.total}`);
      // Refetch to show updated categories
      await refetchTransactions();
    } catch {
      alert('שגיאה בסיווג מחדש');
    } finally {
      setReclassifying(false);
    }
  }

  // סינון
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch =
      (tx.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false);

    const matchesType = filterType === 'all' || tx.type === filterType;
    const matchesStatus = filterStatus === 'all' || tx.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;
    const matchesAccount = !filterAccount || tx.financial_account_id === filterAccount;

    return matchesSearch && matchesType && matchesStatus && matchesCategory && matchesAccount;
  });

  // חישוב סטטיסטיקות
  const stats = {
    totalIncome: transactions
      .filter(tx => tx.type === 'income' && tx.status === 'confirmed')
      .reduce((sum, tx) => sum + tx.amount, 0),
    totalExpenses: transactions
      .filter(tx => tx.type === 'expense' && tx.status === 'confirmed')
      .reduce((sum, tx) => sum + tx.amount, 0),
    proposedCount: transactions.filter(tx => tx.status === 'pending').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <p className="text-sm text-[#555555] mb-1">הכנסות החודש</p>
          <p className="text-3xl font-bold text-[#7ED957]">
            {stats.totalIncome.toLocaleString('he-IL')} ₪
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <p className="text-sm text-[#555555] mb-1">הוצאות החודש</p>
          <p className="text-3xl font-bold text-[#D64541]">
            {stats.totalExpenses.toLocaleString('he-IL')} ₪
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <p className="text-sm text-[#555555] mb-1">ממתינות לאישור</p>
          <p className="text-3xl font-bold text-[#F6A623]">
            {stats.proposedCount}
          </p>
        </div>
      </div>

      {/* Account Filter (only shows if 2+ accounts) */}
      <AccountFilter value={filterAccount} onChange={setFilterAccount} />

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 border border-gray-100">
        <div className="grid md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555]" />
            <input
              type="text"
              placeholder="חיפוש..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3A7BD5]"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3A7BD5]"
          >
            <option value="all">כל הסוגים</option>
            <option value="income">הכנסות</option>
            <option value="expense">הוצאות</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3A7BD5]"
          >
            <option value="all">כל הסטטוסים</option>
            <option value="confirmed">מאושרות</option>
            <option value="pending">ממתינות</option>
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3A7BD5]"
          >
            <option value="all">כל הקטגוריות</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
          {/* Re-classify button */}
          <div className="flex items-center gap-3 md:col-span-4">
            <button
              onClick={handleReclassify}
              disabled={reclassifying}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {reclassifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {reclassifying ? 'מסווג...' : 'סווג מחדש (AI)'}
            </button>
            {reclassifyResult && (
              <span className="text-sm text-green-600 font-medium">{reclassifyResult}</span>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F6F8]">
              <tr>
                <th className="text-right px-4 py-4 text-sm font-semibold text-[#1E2A3B]">תאריך</th>
                <th className="text-right px-4 py-4 text-sm font-semibold text-[#1E2A3B]">תיאור</th>
                <th className="text-right px-4 py-4 text-sm font-semibold text-[#1E2A3B]">קטגוריה</th>
                <th className="text-right px-4 py-4 text-sm font-semibold text-[#1E2A3B]">סוג</th>
                <th className="text-right px-4 py-4 text-sm font-semibold text-[#1E2A3B]">יעד</th>
                <th className="text-right px-4 py-4 text-sm font-semibold text-[#1E2A3B]">סכום</th>
                <th className="text-right px-4 py-4 text-sm font-semibold text-[#1E2A3B]">סטטוס</th>
                <th className="text-center px-4 py-4 text-sm font-semibold text-[#1E2A3B]">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="text-[#555555]">
                      <p className="text-lg mb-2">אין תנועות להצגה</p>
                      <p className="text-sm">נסה לשנות את המסננים או הוסף תנועה חדשה</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isEditing = editingId === tx.id;
                  const isDeleting = deletingId === tx.id;

                  if (isEditing && editData) {
                    return (
                      <tr key={tx.id} className="bg-blue-50">
                        {/* תאריך */}
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            value={editData.tx_date}
                            onChange={(e) => setEditData({ ...editData, tx_date: e.target.value })}
                            className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-[#3A7BD5] focus:outline-none"
                          />
                        </td>
                        {/* תיאור */}
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editData.vendor}
                            onChange={(e) => setEditData({ ...editData, vendor: e.target.value })}
                            className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-[#3A7BD5] focus:outline-none"
                            placeholder="שם ספק / תיאור"
                          />
                        </td>
                        {/* קטגוריה */}
                        <td className="px-4 py-2">
                          <SmartCategoryPicker
                            value={editData.category}
                            vendor={editData.vendor}
                            onChange={(category, expenseType) => setEditData({
                              ...editData,
                              category,
                            })}
                          />
                        </td>
                        {/* סוג */}
                        <td className="px-4 py-2">
                          <select
                            value={editData.type}
                            onChange={(e) => setEditData({ ...editData, type: e.target.value as 'income' | 'expense' })}
                            className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-[#3A7BD5] focus:outline-none"
                          >
                            <option value="expense">הוצאה</option>
                            <option value="income">הכנסה</option>
                          </select>
                        </td>
                        {/* יעד */}
                        <td className="px-4 py-2">
                          <span className="text-xs text-gray-400">-</span>
                        </td>
                        {/* סכום */}
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={editData.amount}
                            onChange={(e) => setEditData({ ...editData, amount: Number(e.target.value) })}
                            className="w-24 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-[#3A7BD5] focus:outline-none text-left"
                            min={0}
                            step={1}
                          />
                        </td>
                        {/* סטטוס */}
                        <td className="px-4 py-2">
                          <select
                            value={editData.status}
                            onChange={(e) => setEditData({ ...editData, status: e.target.value as 'pending' | 'confirmed' })}
                            className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-[#3A7BD5] focus:outline-none"
                          >
                            <option value="confirmed">מאושר</option>
                            <option value="pending">בהמתנה</option>
                          </select>
                        </td>
                        {/* פעולות */}
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                              title="שמור"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded-lg bg-gray-300 text-gray-700 hover:bg-gray-400"
                              title="ביטול"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // שורה רגילה
                  return (
                    <tr key={tx.id} className={`hover:bg-[#F5F6F8] transition-colors ${isDeleting ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-4 text-sm text-[#333333]">
                        {new Date(tx.tx_date || tx.date).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          {tx.vendor && (
                            <p className="text-sm font-medium text-[#1E2A3B]">{tx.vendor}</p>
                          )}
                          {tx.description && (
                            <p className="text-xs text-[#555555]">{tx.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {(tx.category || tx.expense_category || tx.income_category) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E3F2FD] text-[#3A7BD5]">
                            {tx.category || tx.expense_category || tx.income_category}
                          </span>
                        ) : (
                          <span className="text-xs text-[#555555]">ללא קטגוריה</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          tx.type === 'income'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {tx.type === 'income' ? 'הכנסה' : 'הוצאה'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {tx.type === 'income' && tx.status === 'confirmed' ? (
                          <select
                            value={tx.goal_id || ''}
                            onChange={(e) => handleGoalChange(tx.id, e.target.value || null)}
                            disabled={updatingGoal === tx.id}
                            className="text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-phi-gold"
                          >
                            <option value="">ללא יעד</option>
                            {goals.map(goal => (
                              <option key={goal.id} value={goal.id}>
                                {goal.name}
                              </option>
                            ))}
                          </select>
                        ) : tx.goal?.name ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-phi-gold text-white">
                            {tx.goal.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-sm font-semibold ${
                          tx.type === 'income' ? 'text-[#7ED957]' : 'text-[#D64541]'
                        }`}>
                          {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString('he-IL')} ₪
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => startEdit(tx)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="עריכה"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            disabled={isDeleting}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="מחיקה"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-[#555555]">
            מציג {filteredTransactions.length} מתוך {transactions.length} תנועות
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'pending' | 'confirmed' }) {
  if (status === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#7ED957]">
        <CheckCircle className="w-3 h-3" />
        מאושר
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E3F2FD] text-[#2196F3]">
      <Clock className="w-3 h-3" />
      בהמתנה
    </span>
  );
}
