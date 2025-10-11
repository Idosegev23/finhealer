'use client';

import { useState } from 'react';
import { Search, Filter, Download, Plus, Edit2, Trash2, CheckCircle, Clock } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  vendor: string | null;
  description: string | null;
  source: string;
  tx_date: string;
  status: 'proposed' | 'confirmed';
  budget_categories?: {
    id: string;
    name: string;
  } | null;
}

interface TransactionsTableProps {
  initialTransactions: Transaction[];
  categories: Array<{ id: string; name: string }>;
  userId: string;
}

export default function TransactionsTable({ 
  initialTransactions, 
  categories,
  userId 
}: TransactionsTableProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'proposed' | 'confirmed'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // סינון
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      (tx.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesType = filterType === 'all' || tx.type === filterType;
    const matchesStatus = filterStatus === 'all' || tx.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || tx.budget_categories?.id === filterCategory;

    return matchesSearch && matchesType && matchesStatus && matchesCategory;
  });

  // חישוב סטטיסטיקות
  const stats = {
    totalIncome: transactions
      .filter(tx => tx.type === 'income' && tx.status === 'confirmed')
      .reduce((sum, tx) => sum + tx.amount, 0),
    totalExpenses: transactions
      .filter(tx => tx.type === 'expense' && tx.status === 'confirmed')
      .reduce((sum, tx) => sum + tx.amount, 0),
    proposedCount: transactions.filter(tx => tx.status === 'proposed').length,
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
            <option value="proposed">ממתינות</option>
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3A7BD5]"
          >
            <option value="all">כל הקטגוריות</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F6F8]">
              <tr>
                <th className="text-right px-6 py-4 text-sm font-semibold text-[#1E2A3B]">תאריך</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-[#1E2A3B]">תיאור</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-[#1E2A3B]">קטגוריה</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-[#1E2A3B]">סכום</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-[#1E2A3B]">מקור</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-[#1E2A3B]">סטטוס</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-[#1E2A3B]">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="text-[#555555]">
                      <p className="text-lg mb-2">אין תנועות להצגה</p>
                      <p className="text-sm">נסה לשנות את המסננים או הוסף תנועה חדשה</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F5F6F8] transition-colors">
                    <td className="px-6 py-4 text-sm text-[#333333]">
                      {new Date(tx.tx_date).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        {tx.vendor && (
                          <p className="text-sm font-medium text-[#1E2A3B]">{tx.vendor}</p>
                        )}
                        {tx.description && (
                          <p className="text-xs text-[#555555]">{tx.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {tx.budget_categories ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E3F2FD] text-[#3A7BD5]">
                          {tx.budget_categories.name}
                        </span>
                      ) : (
                        <span className="text-xs text-[#555555]">ללא קטגוריה</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-semibold ${
                        tx.type === 'income' ? 'text-[#7ED957]' : 'text-[#D64541]'
                      }`}>
                        {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString('he-IL')} ₪
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <SourceBadge source={tx.source} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="p-1.5 hover:bg-[#E3F2FD] rounded transition-colors"
                          title="ערוך"
                        >
                          <Edit2 className="w-4 h-4 text-[#3A7BD5]" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-[#FFEBEE] rounded transition-colors"
                          title="מחק"
                        >
                          <Trash2 className="w-4 h-4 text-[#D64541]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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

function SourceBadge({ source }: { source: string }) {
  const labels: Record<string, { text: string; color: string }> = {
    manual: { text: 'ידני', color: 'bg-gray-100 text-gray-700' },
    wa_text: { text: 'WhatsApp', color: 'bg-green-100 text-green-700' },
    wa_image: { text: 'קבלה', color: 'bg-blue-100 text-blue-700' },
  };

  const { text, color } = labels[source] || labels.manual;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {text}
    </span>
  );
}

function StatusBadge({ status }: { status: 'proposed' | 'confirmed' }) {
  if (status === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#7ED957]">
        <CheckCircle className="w-3 h-3" />
        מאושר
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFF3E0] text-[#F6A623]">
      <Clock className="w-3 h-3" />
      ממתין
    </span>
  );
}

