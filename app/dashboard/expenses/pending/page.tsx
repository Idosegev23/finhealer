"use client"

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Edit2, Package, Link2, CheckCheck, Filter, X, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toaster';
import { EditExpenseModal } from '@/components/expenses/EditExpenseModal';
import TransactionMatchCard from '@/components/dashboard/TransactionMatchCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  receipt_number?: string; // ⭐ מספר קבלה/מסמך
  receipt_id?: string; // ⭐ קישור לקבלה
  duplicate_warning?: boolean; // ⭐ אזהרה על כפילות
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
  
  // 🎯 Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'categorized' | 'uncategorized'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
    if (filteredExpenses.length === 0) return;

    // ✅ סנן רק תנועות שמסווגות (או שהן הכנסות) מתוך התנועות המסוננות
    // 🚨 חובה: לא לאשר "לא מסווג" או ללא קטגוריה בכלל!
    const approvableExpenses = filteredExpenses.filter(
      (e) => e.type === 'income' || (e.expense_category && e.expense_category !== 'לא מסווג')
    );

    const uncategorizedCount = filteredExpenses.length - approvableExpenses.length;

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

  const handleRejectAll = async () => {
    if (filteredExpenses.length === 0) {
      return;
    }

    const confirmReject = confirm(
      `האם אתה בטוח שברצונך לדחות את כל ${filteredExpenses.length} התנועות המסוננות?\n\nלא ניתן לבטל פעולה זו.`
    );

    if (!confirmReject) {
      return;
    }

    setApprovingAll(true);

    try {
      const rejectPromises = filteredExpenses.map((expense) =>
        fetch('/api/expenses/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expenseId: expense.id }),
        })
      );

      const results = await Promise.allSettled(rejectPromises);
      
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failureCount = results.filter((r) => r.status === 'rejected').length;

      if (successCount > 0) {
        addToast({
          type: 'info',
          title: 'דחייה המונית הושלמה',
          description: `${successCount} תנועות נדחו${failureCount > 0 ? `, ${failureCount} נכשלו` : ''}`,
        });
      }

      await loadExpenses();
    } catch (error: any) {
      console.error('Reject all error:', error);
      addToast({
        type: 'error',
        title: 'שגיאה',
        description: 'שגיאה בדחיית התנועות',
      });
    } finally {
      setApprovingAll(false);
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
          body: JSON.stringify({ expenseId: expenseId }), // ✅ תיקון: שליחת expenseId במקום expenseIds
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

  // 🎯 Filter Logic
  const filteredExpenses = expenses.filter((expense) => {
    // Filter by type
    if (filterType !== 'all' && expense.type !== filterType) return false;
    
    // Filter by status (categorized/uncategorized)
    const isUncategorized = !expense.expense_category || expense.expense_category === 'לא מסווג';
    if (filterStatus === 'uncategorized' && !isUncategorized) return false;
    if (filterStatus === 'categorized' && isUncategorized) return false;
    
    // Filter by category
    if (filterCategory !== 'all' && expense.expense_category !== filterCategory) return false;
    
    // Filter by search query (vendor name)
    if (searchQuery && !expense.vendor?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    return true;
  });

  // Get unique categories for filter dropdown
  const uniqueCategories = Array.from(new Set(
    expenses
      .map(e => e.expense_category)
      .filter((c): c is string => !!c && c !== 'לא מסווג')
  )).sort();

  const uncategorizedCount = expenses.filter(e => !e.expense_category || e.expense_category === 'לא מסווג').length;
  
  // Active filters count
  const activeFiltersCount = [
    filterType !== 'all',
    filterCategory !== 'all',
    filterStatus !== 'all',
    searchQuery !== ''
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterType('all');
    setFilterCategory('all');
    setFilterStatus('all');
    setSearchQuery('');
  };

  return (
    <div className="container mx-auto p-8" dir="rtl">
      {/* 🎯 Header עם הסבר */}
      <div className="mb-8">
        <h1 className="text-6xl font-extrabold mb-5 bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent drop-shadow-lg">
          💳 בדוק ואשר את התנועות שלך
        </h1>
        <p className="text-3xl text-gray-800 mb-6 font-bold">
          {expenses.length === 0
            ? '✅ אין תנועות ממתינות כרגע'
            : `📊 ${expenses.length} תנועות ממתינות לבדיקה`}
        </p>
        
        {/* ℹ️ Info Box */}
        {expenses.length > 0 && (
          <div className="bg-gradient-to-r from-blue-100 to-blue-200 border-4 border-blue-400 rounded-2xl p-6 mb-6 shadow-xl">
            <div className="flex items-start gap-5">
              <div className="text-5xl">📊</div>
              <div className="flex-1">
                <h3 className="text-2xl font-extrabold text-blue-900 mb-3">למה חשוב לבדוק?</h3>
                <ul className="text-xl text-blue-900 space-y-2 list-disc mr-6 font-semibold">
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
          <div className="bg-gradient-to-r from-amber-100 to-orange-100 border-4 border-amber-500 rounded-2xl p-6 mb-6 shadow-xl">
            <div className="flex items-start gap-5">
              <div className="text-6xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-3xl font-extrabold text-amber-900 mb-3">
                  {uncategorizedCount} תנועות ללא קטגוריה!
                </h3>
                <p className="text-xl font-bold text-amber-900">
                  לחץ על &quot;ערוך&quot; כדי לבחור קטגוריה מתאימה. בלי קטגוריה לא ניתן לאשר.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 📈 סטטיסטיקה */}
        {expenses.length > 0 && (
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-green-100 to-emerald-200 border-4 border-green-400 rounded-2xl p-6 shadow-lg hover:scale-105 transition-transform">
              <div className="text-5xl font-extrabold text-green-800 mb-2">
                {expenses.filter(e => e.type === 'income').length}
              </div>
              <div className="text-xl font-bold text-green-700">💰 הכנסות</div>
            </div>
            <div className="bg-gradient-to-br from-blue-100 to-indigo-200 border-4 border-blue-400 rounded-2xl p-6 shadow-lg hover:scale-105 transition-transform">
              <div className="text-5xl font-extrabold text-blue-800 mb-2">
                {expenses.filter(e => e.type === 'expense').length}
              </div>
              <div className="text-xl font-bold text-blue-700">💳 הוצאות</div>
            </div>
            <div className={`${uncategorizedCount > 0 ? 'bg-gradient-to-br from-amber-100 to-orange-200 border-amber-500' : 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-400'} border-4 rounded-2xl p-6 shadow-lg hover:scale-105 transition-transform`}>
              <div className={`text-5xl font-extrabold mb-2 ${uncategorizedCount > 0 ? 'text-amber-800' : 'text-gray-800'}`}>
                {uncategorizedCount}
              </div>
              <div className={`text-xl font-bold ${uncategorizedCount > 0 ? 'text-amber-700' : 'text-gray-700'}`}>
                {uncategorizedCount > 0 ? '⚠️ לא מסווג' : '✅ מסווג'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🎯 Filter Bar */}
      <Card className="mb-8 border-4 border-blue-400 shadow-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-5">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant={showFilters ? "default" : "outline"}
                className="gap-3 text-xl font-bold py-6 px-8 rounded-xl border-3 hover:scale-105 transition-transform"
              >
                <Filter className="w-7 h-7" />
                🔍 סינון
                {activeFiltersCount > 0 && (
                  <Badge className="bg-red-600 text-white text-lg px-3 py-1 mr-2">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
              
              {activeFiltersCount > 0 && (
                <Button
                  onClick={clearAllFilters}
                  variant="ghost"
                  size="lg"
                  className="text-red-700 hover:text-red-800 hover:bg-red-100 text-xl font-bold py-6 px-6 rounded-xl border-3 border-red-300 hover:scale-105 transition-transform"
                >
                  <X className="w-7 h-7 ml-2" />
                  ❌ נקה הכל
                </Button>
              )}
              
              <div className="text-2xl text-gray-800 font-bold bg-gray-100 px-6 py-4 rounded-xl border-3 border-gray-300">
                מציג <span className="text-blue-700">{filteredExpenses.length}</span> מתוך {expenses.length} תנועות
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          {showFilters && (
            <div className="space-y-6 pt-6 border-t-4 border-blue-300">
              {/* Search */}
              <div className="relative">
                <Search className="absolute right-5 top-1/2 transform -translate-y-1/2 w-7 h-7 text-gray-500" />
                <Input
                  type="text"
                  placeholder="🔎 חפש לפי שם עסק..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-16 text-xl font-bold py-6 border-3 border-gray-400 rounded-xl focus:ring-4 focus:ring-blue-300"
                />
              </div>

              {/* Filter Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Type Filter */}
                <div>
                  <label className="text-xl font-extrabold text-gray-800 mb-3 block">
                    📊 סוג תנועה
                  </label>
                  <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                    <SelectTrigger className="text-xl font-bold py-6 border-3 border-gray-400 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xl">
                      <SelectItem value="all" className="text-xl py-4 font-bold">הכל</SelectItem>
                      <SelectItem value="income" className="text-xl py-4 font-bold">💰 הכנסות בלבד</SelectItem>
                      <SelectItem value="expense" className="text-xl py-4 font-bold">💳 הוצאות בלבד</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-xl font-extrabold text-gray-800 mb-3 block">
                    ✅ סטטוס סיווג
                  </label>
                  <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                    <SelectTrigger className="text-xl font-bold py-6 border-3 border-gray-400 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xl">
                      <SelectItem value="all" className="text-xl py-4 font-bold">הכל</SelectItem>
                      <SelectItem value="uncategorized" className="text-xl py-4 font-bold">⚠️ לא מסווג בלבד</SelectItem>
                      <SelectItem value="categorized" className="text-xl py-4 font-bold">✅ מסווג בלבד</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="text-xl font-extrabold text-gray-800 mb-3 block">
                    📁 קטגוריה
                  </label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="text-xl font-bold py-6 border-3 border-gray-400 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xl max-h-[400px]">
                      <SelectItem value="all" className="text-xl py-4 font-bold">כל הקטגוריות</SelectItem>
                      {uniqueCategories.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-xl py-4 font-bold">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap gap-4 pt-4">
                <Button
                  onClick={() => setFilterStatus('uncategorized')}
                  variant={filterStatus === 'uncategorized' ? 'default' : 'outline'}
                  size="lg"
                  className="text-lg font-bold py-5 px-6 rounded-xl border-3 hover:scale-105 transition-transform"
                >
                  ⚠️ רק לא מסווג
                </Button>
                <Button
                  onClick={() => setFilterType('expense')}
                  variant={filterType === 'expense' ? 'default' : 'outline'}
                  size="lg"
                  className="text-lg font-bold py-5 px-6 rounded-xl border-3 hover:scale-105 transition-transform"
                >
                  💳 רק הוצאות
                </Button>
                <Button
                  onClick={() => setFilterType('income')}
                  variant={filterType === 'income' ? 'default' : 'outline'}
                  size="lg"
                  className="text-lg font-bold py-5 px-6 rounded-xl border-3 hover:scale-105 transition-transform"
                >
                  💰 רק הכנסות
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* כפתורי פעולה המונית */}
      <div className="mb-8 flex items-center gap-6">
        {filteredExpenses.length > 0 && (
          <>
            <Button
              onClick={handleApproveAll}
              disabled={approvingAll}
              size="lg"
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-2xl font-extrabold py-8 px-10 rounded-2xl border-4 border-green-500 shadow-2xl hover:scale-110 transition-all"
            >
              {approvingAll ? (
                <>
                  <Loader2 className="w-8 h-8 ml-3 animate-spin" />
                  ⏳ מעבד...
                </>
              ) : (
                <>
                  <CheckCheck className="w-8 h-8 ml-3" />
                  ✅ אשר הכל ({filteredExpenses.length})
                </>
              )}
            </Button>
            
            <Button
              onClick={handleRejectAll}
              disabled={approvingAll}
              size="lg"
              variant="destructive"
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-2xl font-extrabold py-8 px-10 rounded-2xl border-4 border-red-500 shadow-2xl hover:scale-110 transition-all"
            >
              {approvingAll ? (
                <>
                  <Loader2 className="w-8 h-8 ml-3 animate-spin" />
                  ⏳ מעבד...
                </>
              ) : (
                <>
                  <XCircle className="w-8 h-8 ml-3" />
                  ❌ דחה הכל ({filteredExpenses.length})
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {filteredExpenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <Package className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {expenses.length === 0 ? 'אין תנועות ממתינות' : 'אין תנועות מתאימות לסינון'}
            </h3>
            <p className="text-gray-600 mb-4 text-center">
              {expenses.length === 0 
                ? 'כל התנועות שלך אושרו! העלה דוח חדש כדי לראות תנועות נוספות.'
                : 'נסה לשנות את הסינון או לנקות את כל הפילטרים.'}
            </p>
            {expenses.length === 0 ? (
              <Button onClick={() => router.push('/dashboard/scan-center')}>
                העלאת דוח חדש
              </Button>
            ) : (
              <Button onClick={clearAllFilters} variant="outline">
                נקה סינון
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {filteredExpenses.map((expense) => {
            const confidenceBadge = getConfidenceBadge(expense.confidence_score || 0);
            const isProcessing = processingIds.has(expense.id);
            const isIncome = expense.type === 'income';
            const needsCategory = !expense.expense_category || expense.expense_category === 'לא מסווג';

            return (
              <Card 
                key={expense.id} 
                className={`hover:shadow-2xl transition-all hover:scale-[1.02] ${needsCategory ? 'border-6 border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50' : 'border-4 border-gray-300 bg-white'}`}
              >
                {/* ⚠️ אזהרה אם חסרה קטגוריה */}
                {needsCategory && (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-center py-4 text-2xl shadow-lg">
                    ⚠️ חובה לבחור קטגוריה לפני אישור! לחץ על &quot;ערוך&quot; ↓
                  </div>
                )}

                <CardHeader className="pb-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b-4 border-gray-300">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <CardTitle className="text-4xl font-extrabold text-gray-900">
                          🏪 {expense.vendor || 'לא צוין'}
                        </CardTitle>
                        {needsCategory && (
                          <Badge className="bg-amber-600 text-white text-xl px-4 py-2 shadow-lg">
                            ⚠️ דורש תשומת לב!
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-2xl font-bold text-gray-700">
                        📅 {formatDate(expense.date)} • 💳 {expense.payment_method || 'לא צוין'}
                        {expense.receipt_number && (
                          <> • 📄 מספר מסמך: {expense.receipt_number}</>
                        )}
                      </CardDescription>
                      {/* ⚠️ אזהרה על כפילות */}
                      {expense.duplicate_warning && (
                        <div className="mt-4 bg-gradient-to-r from-red-100 to-rose-100 border-4 border-red-500 rounded-xl p-4 text-xl text-red-900 font-extrabold shadow-lg">
                          ⚠️ אזהרה: נמצאה תנועה דומה עם אותו מספר מסמך שכבר אושרה!
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <div className={`text-6xl font-extrabold ${isIncome ? 'text-green-700' : 'text-blue-700'} drop-shadow-lg`}>
                        {isIncome ? '+' : ''}{formatCurrency(expense.amount)}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-8">
                  <div className="space-y-6">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-4">
                      {/* Type Badge */}
                      <Badge variant={isIncome ? "default" : "outline"} className={`text-2xl px-6 py-3 font-extrabold border-3 shadow-lg ${isIncome ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white" : "bg-gradient-to-r from-blue-500 to-indigo-500 text-white"}`}>
                        {isIncome ? '💰 הכנסה' : '💳 הוצאה'}
                      </Badge>
                      {expense.expense_category && (
                        <Badge variant="outline" className="text-xl px-5 py-2 font-bold border-3 border-purple-400 text-purple-700 bg-purple-50">{expense.expense_category}</Badge>
                      )}
                      {expense.category && expense.category !== expense.expense_category && (
                        <Badge variant="outline" className="text-xl px-5 py-2 font-bold border-3 border-indigo-400 text-indigo-700 bg-indigo-50">{expense.category}</Badge>
                      )}
                      {expense.expense_type && (
                        <Badge variant="secondary" className="text-xl px-5 py-2 font-bold border-3 border-gray-400 text-gray-700 bg-gray-200">{expense.expense_type}</Badge>
                      )}
                      {expense.confidence_score !== undefined && (
                        <Badge className={`${confidenceBadge.color} text-xl px-5 py-2 font-bold border-3 shadow-md`}>
                          {confidenceBadge.label} ({Math.round(expense.confidence_score * 100)}%)
                        </Badge>
                      )}
                    </div>

                    {/* פרטי התנועה - פירוט מלא */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2 border border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-semibold text-gray-600 dark:text-gray-400">🏪 עסק:</span>
                          <p className="text-gray-900 dark:text-white font-medium">{expense.vendor || 'לא צוין'}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-600 dark:text-gray-400">💰 סכום:</span>
                          <p className="text-gray-900 dark:text-white font-medium">{formatCurrency(expense.amount)}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-600 dark:text-gray-400">📅 תאריך:</span>
                          <p className="text-gray-900 dark:text-white font-medium">{formatDate(expense.date)}</p>
                        </div>
                        {expense.receipt_number && (
                          <div>
                            <span className="font-semibold text-gray-600 dark:text-gray-400">📄 מספר מסמך:</span>
                            <p className="text-gray-900 dark:text-white font-medium">{expense.receipt_number}</p>
                          </div>
                        )}
                      </div>
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
                    <div className="space-y-4 pt-4">
                      {/* כפתור ערוך - בולט אם חסרה קטגוריה */}
                      <Button
                        onClick={() => setEditingExpense(expense)}
                        disabled={isProcessing}
                        className={`w-full text-2xl py-8 rounded-2xl border-4 shadow-2xl font-extrabold hover:scale-105 transition-all ${
                          needsCategory 
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-amber-600' 
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-blue-500'
                        }`}
                      >
                        <Edit2 className="w-8 h-8 ml-3" />
                        {needsCategory ? '⚠️ ערוך וסווג קטגוריה' : '✏️ ערוך פרטים'}
                      </Button>

                      {/* שורת כפתורי פעולה */}
                      <div className="flex gap-4">
                        <Button
                          onClick={() => handleApprove(expense.id)}
                          disabled={isProcessing || needsCategory}
                          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-2xl py-8 rounded-2xl border-4 border-green-500 shadow-2xl font-extrabold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all"
                          title={needsCategory ? 'יש לבחור קטגוריה לפני אישור' : ''}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-8 h-8 ml-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-8 h-8 ml-3" />
                          )}
                          {needsCategory ? '🔒 אשר' : '✅ אשר'}
                        </Button>

                        <Button
                          onClick={() => handleReject(expense.id)}
                          disabled={isProcessing}
                          variant="destructive"
                          className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-2xl py-8 rounded-2xl border-4 border-red-500 shadow-2xl font-extrabold hover:scale-105 transition-all"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-8 h-8 ml-3 animate-spin" />
                          ) : (
                            <XCircle className="w-8 h-8 ml-3" />
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
          onSave={(updates, shouldApprove) => handleUpdate(editingExpense.id, updates, shouldApprove)}
        />
      )}
    </div>
  );
}

