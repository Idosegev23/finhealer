'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Plus, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatementUploader from '@/components/expenses/StatementUploader';
import ExpensesTable from '@/components/expenses/ExpensesTable';
import EditTransactionModal from '@/components/expenses/EditTransactionModal';
import { useRouter } from 'next/navigation';

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

export default function ExpensesPage() {
  const router = useRouter();
  const [showUploader, setShowUploader] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [existingTransactions, setExistingTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // טעינת תנועות קיימות
  useEffect(() => {
    loadExistingTransactions();
  }, []);

  const loadExistingTransactions = async () => {
    try {
      const response = await fetch('/api/transactions?type=expense');
      if (response.ok) {
        const data = await response.json();
        setExistingTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionsExtracted = (newTransactions: Transaction[]) => {
    setTransactions(newTransactions);
    setShowUploader(false);
  };

  const handleSaveAll = async (transactionsToSave: Transaction[]) => {
    setSaving(true);
    try {
      const promises = transactionsToSave.map((t) =>
        fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'expense',
            date: t.date,
            description: t.description,
            vendor: t.vendor,
            amount: t.amount,
            category: t.category,
            detailed_category: t.detailed_category,
            expense_frequency: t.expense_frequency,
            confidence_score: t.confidence,
            source: 'statement_upload',
            status: 'confirmed',
            auto_categorized: true,
          }),
        })
      );

      await Promise.all(promises);
      
      alert(`✅ ${transactionsToSave.length} תנועות נשמרו בהצלחה!`);
      setTransactions([]);
      loadExistingTransactions();
      
    } catch (error) {
      console.error('Error saving transactions:', error);
      alert('❌ שגיאה בשמירת התנועות');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק תנועה זו?')) return;
    
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setExistingTransactions((prev) => prev.filter((t) => t.id !== id));
        alert('✅ התנועה נמחקה');
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('❌ שגיאה במחיקת התנועה');
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleSaveEdit = async (updated: Transaction) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updated.id,
          type: 'expense',
          date: updated.date,
          description: updated.description,
          vendor: updated.vendor,
          amount: updated.amount,
          category: updated.category,
          detailed_category: updated.detailed_category,
          expense_frequency: updated.expense_frequency,
          confidence_score: updated.confidence,
        }),
      });

      if (response.ok) {
        // עדכון ב-state
        if (updated.id) {
          setExistingTransactions((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t))
          );
        } else {
          setTransactions((prev) =>
            prev.map((t, i) => (i === transactions.indexOf(editingTransaction!) ? updated : t))
          );
        }
        
        alert('✅ התנועה עודכנה בהצלחה!');
        setEditingTransaction(null);
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('❌ שגיאה בעדכון התנועה');
    }
  };

  const allTransactions = [...transactions, ...existingTransactions];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 py-12 px-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-3 flex items-center gap-3">
            📊 ניהול הוצאות חכם
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            העלה דוחות בנק/אשראי וזהה את ההוצאות שלך אוטומטית עם AI
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-4 mb-8"
        >
          <Button
            onClick={() => setShowUploader(true)}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg font-bold px-8"
          >
            <Upload className="w-5 h-5 ml-2" />
            העלה דוח בנק/אשראי
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="border-2 font-bold"
          >
            <Plus className="w-5 h-5 ml-2" />
            הוסף הוצאה ידנית
          </Button>

          {allTransactions.length > 0 && (
            <Button
              variant="outline"
              size="lg"
              className="border-2 font-bold"
            >
              <Download className="w-5 h-5 ml-2" />
              ייצא ל-Excel
            </Button>
          )}
        </motion.div>

        {/* Transactions from Upload (Pending Save) */}
        {transactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
          >
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <FileSpreadsheet className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                <h2 className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  תנועות חדשות ממתינות לשמירה
                </h2>
              </div>
              <p className="text-yellow-800 dark:text-yellow-200">
                זיהינו {transactions.length} תנועות מהקובץ שהעלית. בדוק אותן ושמור.
              </p>
            </div>
            <ExpensesTable
              transactions={transactions}
              onSave={handleSaveAll}
              onEdit={handleEdit}
            />
          </motion.div>
        )}

        {/* Existing Transactions */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">טוען הוצאות...</p>
          </div>
        ) : existingTransactions.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              ההוצאות שלי
            </h2>
            <ExpensesTable
              transactions={existingTransactions}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-12 text-center border border-gray-200 dark:border-gray-800"
          >
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileSpreadsheet className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                טרם הוספת הוצאות
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
                העלה דוח בנק או אשראי כדי שנזהה את ההוצאות שלך אוטומטית, או הוסף הוצאה ידנית.
              </p>
              <Button
                onClick={() => setShowUploader(true)}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg font-bold px-10"
              >
                <Upload className="w-5 h-5 ml-2" />
                בואו נתחיל!
              </Button>
        </div>
          </motion.div>
        )}

        {/* Statement Uploader Modal */}
        <AnimatePresence>
          {showUploader && (
            <StatementUploader
              onTransactionsExtracted={handleTransactionsExtracted}
              onClose={() => setShowUploader(false)}
            />
          )}
          
          {/* Edit Transaction Modal */}
          {editingTransaction && (
            <EditTransactionModal
              transaction={editingTransaction}
              onSave={handleSaveEdit}
              onClose={() => setEditingTransaction(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

