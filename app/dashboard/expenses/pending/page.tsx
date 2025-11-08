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
  expense_category_id?: string;
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
    // ✅ Validation: בדיקה שההוצאה מסווגת לפני אישור
    const expense = expenses.find((e) => e.id === expenseId);
    if (expense && expense.type === 'expense' && !expense.expense_category_id && !expense.expense_category) {
      addToast({
        type: 'error',
        title: 'לא ניתן לאשר',
        description: 'יש לבחור קטגוריה לפני אישור ההוצאה. לחץ על "ערוך" כדי לבחור קטגוריה.',
      });
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(expenseId));
    
    try {
      const response = await fetch('/api/expenses/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to approve');
      }

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

    // ✅ סנן רק תנועות שמסווגות (או שהן הכנסות)
    const approvableExpenses = expenses.filter(
      (e) => e.type === 'income' || e.expense_category_id || e.expense_category
    );

    const uncategorizedCount = expenses.length - approvableExpenses.length;

    if (uncategorizedCount > 0) {
      addToast({
        type: 'error',
        title: 'לא ניתן לאשר הכל',
        description: `יש ${uncategorizedCount} הוצאות ללא קטגוריה. יש לסווג אותן קודם.`,
      });
      return;
    }

    if (approvableExpenses.length === 0) {
      addToast({
        type: 'error',
        title: 'אין תנועות לאישור',
        description: 'כל ההוצאות חייבות להיות מסווגות לפני אישור.',
      });
      return;
    }

    setApprovingAll(true);

    try {
      // אישור כל התנועות המסווגות במקביל
      const approvalPromises = approvableExpenses.map((expense) =>
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

  const handleUpdate = async (expenseId: string, updates: Partial<PendingTransaction>, shouldApprove = false) => {
    try {
      // עדכון התנועה
      const response = await fetch('/api/expenses/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId, ...updates }),
      });

      if (!response.ok) throw new Error('Failed to update');

      const result = await response.json();

      // אם צריך לאשר - אשר אחרי העדכון
      if (shouldApprove) {
        const approveResponse = await fetch('/api/expenses/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expenseIds: [expenseId] }),
        });

        if (!approveResponse.ok) {
          throw new Error('Failed to approve after update');
        }

        addToast({
          type: 'success',
          title: '✓ הוצאה עודכנה ואושרה',
          description: 'התנועה נשמרה ואושרה בהצלחה',
        });

        // הסר מהרשימה (כי אושרה)
        setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      } else {
        addToast({
          type: 'success',
          title: 'הוצאה עודכנה',
          description: 'השינויים נשמרו בהצלחה',
        });

        // עדכן ברשימה
        setExpenses((prev) =>
          prev.map((e) => (e.id === expenseId ? { ...e, ...result.expense } : e))
        );
      }

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

  const uncategorizedCount = expenses.filter(e => !e.expense_category || e.expense_category === 'לא מסווג').length;

  return (
    <div className="container mx-auto p-6" dir="rtl">
      {/* 🎯 Header עם הסבר */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          בדוק ואשר את ההוצאות שלך 💳
        </h1>
        <p className="text-lg text-gray-700 mb-4">
          {expenses.length === 0
            ? 'אין תנועות ממתינות כרגע ✅'
            : `${expenses.length} תנועות ממתינות לבדיקה`}
        </p>
        
        {/* ℹ️ Info Box */}
        {expenses.length > 0 && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-3xl">📊</div>
              <div className="flex-1">
                <h3 className="font-bold text-blue-900 mb-1">למה חשוב לבדוק?</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc mr-4">
                  <li>וודא שכל העסקאות נכונות ושייכות לך</li>
                  <li>ודא שהסיווג לקטגוריות מדויק (קבועות/משתנות/מיוחדות)</li>
                  <li>עדכן פרטים לפני אישור סופי</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ⚠️ Warning Box - אם יש לא מסווגות */}
        {uncategorizedCount > 0 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-3xl">⚠️</div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-900 mb-1">
                  {uncategorizedCount} תנועות ללא קטגוריה!
                </h3>
                <p className="text-sm text-amber-800">
                  לחץ על "ערוך" כדי לבחור קטגוריה מתאימה. בלי קטגוריה לא ניתן לאשר.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 📈 סטטיסטיקה */}
        {expenses.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-700">
                {expenses.filter(e => e.type === 'income').length}
              </div>
              <div className="text-xs text-green-600">הכנסות 💰</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-700">
                {expenses.filter(e => e.type === 'expense').length}
              </div>
              <div className="text-xs text-blue-600">הוצאות 💳</div>
            </div>
            <div className={`${uncategorizedCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'} border rounded-lg p-3`}>
              <div className={`text-2xl font-bold ${uncategorizedCount > 0 ? 'text-amber-700' : 'text-gray-700'}`}>
                {uncategorizedCount}
              </div>
              <div className={`text-xs ${uncategorizedCount > 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                לא מסווג {uncategorizedCount > 0 ? '⚠️' : '✅'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* כפתור אשר הכל */}
      <div className="mb-6 flex items-center justify-between">
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
            const needsCategory = !expense.expense_category || expense.expense_category === 'לא מסווג';

            return (
              <Card 
                key={expense.id} 
                className={`hover:shadow-lg transition-all ${needsCategory ? 'border-4 border-amber-400 bg-amber-50' : 'border-2 border-gray-200'}`}
              >
                {/* ⚠️ אזהרה אם חסרה קטגוריה */}
                {needsCategory && (
                  <div className="bg-amber-400 text-amber-900 font-bold text-center py-2 text-sm">
                    ⚠️ חובה לבחור קטגוריה לפני אישור! לחץ על "ערוך" ↓
                  </div>
                )}

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-2xl font-bold">
                          {expense.vendor || 'לא צוין'}
                        </CardTitle>
                        {needsCategory && (
                          <Badge className="bg-amber-500 text-white animate-pulse">
                            דורש תשומת לב!
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-base">
                        📅 {formatDate(expense.date)} • 💳 {expense.payment_method || 'לא צוין'}
                      </CardDescription>
                    </div>
                    <div className="text-left">
                      <div className={`text-3xl font-bold ${isIncome ? 'text-green-600' : 'text-blue-600'}`}>
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
                    <div className="space-y-2 pt-2">
                      {/* כפתור ערוך - בולט אם חסרה קטגוריה */}
                      <Button
                        onClick={() => setEditingExpense(expense)}
                        disabled={isProcessing}
                        className={`w-full text-lg py-6 ${
                          needsCategory 
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold animate-pulse' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <Edit2 className="w-5 h-5 ml-2" />
                        {needsCategory ? 'ערוך וסווג קטגוריה ⚠️' : 'ערוך פרטים'}
                      </Button>

                      {/* שורת כפתורי פעולה */}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApprove(expense.id)}
                          disabled={isProcessing || needsCategory}
                          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={needsCategory ? 'יש לבחור קטגוריה לפני אישור' : ''}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 ml-2" />
                          )}
                          {needsCategory ? '🔒 אשר' : '✅ אשר'}
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
                          ❌ דחה
                        </Button>
                      </div>
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

