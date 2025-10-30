"use client"

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Edit2, Package, Link2, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toaster';
import { EditExpenseModal } from '@/components/expenses/EditExpenseModal';
import TransactionMatchCard from '@/components/dashboard/TransactionMatchCard';

interface PendingTransaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  vendor: string;
  date: string;
  category: string;
  expense_category?: string;
  expense_type: string;
  payment_method: string;
  notes: string;
  confidence_score: number;
  created_at: string;
  is_summary?: boolean;
  document_type?: string;
}

interface Match {
  transaction: PendingTransaction;
  confidence: number;
}

export default function PendingExpensesPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [expenses, setExpenses] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingExpense, setEditingExpense] = useState<PendingTransaction | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<Record<string, Match[]>>({});
  const [loadingMatches, setLoadingMatches] = useState<Set<string>>(new Set());
  const [showingMatchesFor, setShowingMatchesFor] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/expenses/pending');
      if (!response.ok) throw new Error('Failed to load expenses');
      
      const data = await response.json();
      setExpenses(data.expenses || []);
    } catch (err: any) {
      console.error('Load expenses error:', err);
      setError(err.message || 'שגיאה בטעינת הוצאות');
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async (transactionId: string, documentType: string) => {
    setLoadingMatches((prev) => new Set(prev).add(transactionId));
    
    try {
      const response = await fetch('/api/transactions/find-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, documentType }),
      });

      if (!response.ok) throw new Error('Failed to load matches');

      const data = await response.json();
      if (data.success && data.matches) {
        setMatches((prev) => ({ ...prev, [transactionId]: data.matches }));
        setShowingMatchesFor(transactionId);
      }
    } catch (error: any) {
      console.error('Load matches error:', error);
      addToast({
        type: 'error',
        title: 'שגיאה',
        description: 'לא הצלחנו למצוא התאמות',
      });
    } finally {
      setLoadingMatches((prev) => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
  };

  const handleLinkTransactions = async (
    parentId: string,
    detailIds: string[],
    documentId?: string
  ) => {
    try {
      const response = await fetch('/api/transactions/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentTransactionId: parentId, detailTransactionIds: detailIds, documentId }),
      });

      if (!response.ok) throw new Error('Failed to link transactions');

      addToast({
        type: 'success',
        title: 'תנועות קושרו',
        description: 'התנועות קושרו בהצלחה',
      });

      // Refresh expenses list
      await loadExpenses();
      setShowingMatchesFor(null);
    } catch (error: any) {
      console.error('Link error:', error);
      addToast({
        type: 'error',
        title: 'שגיאה',
        description: 'לא הצלחנו לקשר את התנועות',
      });
    }
  };

  const handleApprove = async (expenseId: string) => {
    setProcessingIds((prev) => new Set(prev).add(expenseId));
    
    try {
      const response = await fetch('/api/expenses/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId }),
      });

      if (!response.ok) throw new Error('Failed to approve');

      addToast({
        type: 'success',
        title: 'הוצאה אושרה',
        description: 'ההוצאה נוספה לרשימת ההוצאות שלך',
      });

      // Remove from list
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    } catch (error: any) {
      console.error('Approve error:', error);
      addToast({
        type: 'error',
        title: 'שגיאה',
        description: error.message || 'שגיאה באישור ההוצאה',
      });
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(expenseId);
        return newSet;
      });
    }
  };

  const handleApproveAll = async () => {
    if (expenses.length === 0) return;

    setApprovingAll(true);

    try {
      // אישור כל התנועות במקביל
      const approvalPromises = expenses.map((expense) =>
        fetch('/api/expenses/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expenseId: expense.id }),
        })
      );

      const results = await Promise.allSettled(approvalPromises);
      
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failureCount = results.filter((r) => r.status === 'rejected').length;

      if (successCount > 0) {
        addToast({
          type: 'success',
          title: 'אישור המוני הושלם',
          description: `${successCount} תנועות אושרו בהצלחה${failureCount > 0 ? `, ${failureCount} נכשלו` : ''}`,
        });
      }

      // רענון רשימה
      await loadExpenses();
    } catch (error: any) {
      console.error('Approve all error:', error);
      addToast({
        type: 'error',
        title: 'שגיאה',
        description: 'שגיאה באישור התנועות',
      });
    } finally {
      setApprovingAll(false);
    }
  };

  const handleReject = async (expenseId: string) => {
    setProcessingIds((prev) => new Set(prev).add(expenseId));
    
    try {
      const response = await fetch('/api/expenses/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId }),
      });

      if (!response.ok) throw new Error('Failed to reject');

      addToast({
        type: 'info',
        title: 'הוצאה נדחתה',
        description: 'ההוצאה הוסרה מהרשימה',
      });

      // Remove from list
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    } catch (error: any) {
      console.error('Reject error:', error);
      addToast({
        type: 'error',
        title: 'שגיאה',
        description: error.message || 'שגיאה בדחיית ההוצאה',
      });
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(expenseId);
        return newSet;
      });
    }
  };

  const handleUpdate = async (expenseId: string, updates: Partial<PendingTransaction>) => {
    try {
      const response = await fetch('/api/expenses/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId, ...updates }),
      });

      if (!response.ok) throw new Error('Failed to update');

      const result = await response.json();

      addToast({
        type: 'success',
        title: 'הוצאה עודכנה',
        description: 'השינויים נשמרו בהצלחה',
      });

      // Update in list
      setExpenses((prev) =>
        prev.map((e) => (e.id === expenseId ? { ...e, ...result.expense } : e))
      );
      setEditingExpense(null);
    } catch (error: any) {
      console.error('Update error:', error);
      addToast({
        type: 'error',
        title: 'שגיאה',
        description: error.message || 'שגיאה בעדכון ההוצאה',
      });
    }
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return { label: 'בטוח', variant: 'default' as const, color: 'bg-green-100 text-green-800' };
    if (score >= 0.6) return { label: 'בינוני', variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'נמוך', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' };
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">תנועות ממתינות לאישור</h1>
          <p className="text-gray-600">
            {expenses.length === 0
              ? 'אין תנועות ממתינות כרגע'
              : `${expenses.length} תנועות ממתינות לבדיקתך (${expenses.filter(e => e.type === 'income').length} הכנסות, ${expenses.filter(e => e.type === 'expense').length} הוצאות)`}
          </p>
        </div>
        {expenses.length > 0 && (
          <Button
            onClick={handleApproveAll}
            disabled={approvingAll}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {approvingAll ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                מאשר...
              </>
            ) : (
              <>
                <CheckCheck className="w-4 h-4 ml-2" />
                אשר הכל ({expenses.length})
              </>
            )}
          </Button>
        )}
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <Package className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">אין תנועות ממתינות</h3>
            <p className="text-gray-600 mb-4 text-center">
              כל התנועות שלך אושרו! העלה דוח חדש כדי לראות תנועות נוספות.
            </p>
            <Button onClick={() => router.push('/dashboard/scan-center')}>
              העלאת דוח חדש
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {expenses.map((expense) => {
            const confidenceBadge = getConfidenceBadge(expense.confidence_score || 0);
            const isProcessing = processingIds.has(expense.id);
            const isIncome = expense.type === 'income';

            return (
              <Card key={expense.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">
                        {expense.vendor || 'לא צוין'}
                      </CardTitle>
                      <CardDescription>
                        {formatDate(expense.date)} • {expense.payment_method || 'לא צוין'}
                      </CardDescription>
                    </div>
                    <div className="text-left">
                      <div className={`text-2xl font-bold ${isIncome ? 'text-green-600' : 'text-blue-600'}`}>
                        {isIncome ? '+' : ''}{formatCurrency(expense.amount)}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {/* Type Badge */}
                      <Badge variant={isIncome ? "default" : "outline"} className={isIncome ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
                        {isIncome ? '💰 הכנסה' : '💳 הוצאה'}
                      </Badge>
                      {expense.expense_category && (
                        <Badge variant="outline">{expense.expense_category}</Badge>
                      )}
                      {expense.category && expense.category !== expense.expense_category && (
                        <Badge variant="outline">{expense.category}</Badge>
                      )}
                      {expense.expense_type && (
                        <Badge variant="secondary">{expense.expense_type}</Badge>
                      )}
                      {expense.confidence_score !== undefined && (
                        <Badge className={confidenceBadge.color}>
                          {confidenceBadge.label} ({Math.round(expense.confidence_score * 100)}%)
                        </Badge>
                      )}
                    </div>

                    {/* Notes */}
                    {expense.notes && (
                      <p className="text-sm text-gray-600 border-r-2 border-blue-200 pr-3">
                        {expense.notes}
                      </p>
                    )}

                    {/* Find Matches Button - for bank statements */}
                    {expense.is_summary && (
                      <Button
                        onClick={() => loadMatches(expense.id, expense.document_type || 'bank')}
                        disabled={loadingMatches.has(expense.id)}
                        variant="secondary"
                        className="w-full mb-2"
                      >
                        {loadingMatches.has(expense.id) ? (
                          <>
                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                            מחפש התאמות...
                          </>
                        ) : (
                          <>
                            <Link2 className="w-4 h-4 ml-2" />
                            מצא התאמות מדוח אשראי
                          </>
                        )}
                      </Button>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleApprove(expense.id)}
                        disabled={isProcessing}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 ml-2" />
                        )}
                        אשר
                      </Button>

                      <Button
                        onClick={() => setEditingExpense(expense)}
                        disabled={isProcessing}
                        variant="outline"
                        className="flex-1"
                      >
                        <Edit2 className="w-4 h-4 ml-2" />
                        ערוך
                      </Button>

                      <Button
                        onClick={() => handleReject(expense.id)}
                        disabled={isProcessing}
                        variant="destructive"
                        className="flex-1"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4 ml-2" />
                        )}
                        דחה
                      </Button>
                    </div>

                    {/* Match Card - show when matches found */}
                    {showingMatchesFor === expense.id && matches[expense.id] && (
                      <div className="mt-4">
                        <TransactionMatchCard
                          parentTransaction={expense}
                          matches={matches[expense.id]}
                          onLink={handleLinkTransactions}
                          onDismiss={() => setShowingMatchesFor(null)}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingExpense && (
        <EditExpenseModal
          expense={{
            ...editingExpense,
            expense_category: editingExpense.expense_category || editingExpense.category || '',
          }}
          onClose={() => setEditingExpense(null)}
          onSave={(updates) => handleUpdate(editingExpense.id, updates)}
        />
      )}
    </div>
  );
}

