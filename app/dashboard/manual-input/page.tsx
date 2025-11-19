'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlusCircle, Trash2, DollarSign, FileText, CreditCard, Loader2 } from 'lucide-react';

interface IncomeSource {
  id: string;
  source_name: string;
  net_amount: number;
  frequency: 'monthly' | 'weekly' | 'biweekly';
}

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
  frequency: 'monthly' | 'weekly' | 'biweekly';
}

interface Loan {
  id: string;
  loan_type: string;
  current_balance: number;
  monthly_payment: number;
  interest_rate: number;
}

export default function ManualInputPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Income sources
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([
    { id: '1', source_name: '', net_amount: 0, frequency: 'monthly' }
  ]);

  // Fixed expenses
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([
    { id: '1', name: '', amount: 0, category: '', frequency: 'monthly' }
  ]);

  // Loans
  const [loans, setLoans] = useState<Loan[]>([
    { id: '1', loan_type: '', current_balance: 0, monthly_payment: 0, interest_rate: 0 }
  ]);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }
      
      setUserId(user.id);
    };

    checkAuth();
  }, [router]);

  const addIncomeSource = () => {
    setIncomeSources([...incomeSources, {
      id: Date.now().toString(),
      source_name: '',
      net_amount: 0,
      frequency: 'monthly'
    }]);
  };

  const removeIncomeSource = (id: string) => {
    if (incomeSources.length > 1) {
      setIncomeSources(incomeSources.filter(i => i.id !== id));
    }
  };

  const updateIncomeSource = (id: string, field: keyof IncomeSource, value: any) => {
    setIncomeSources(incomeSources.map(i => 
      i.id === id ? { ...i, [field]: value } : i
    ));
  };

  const addFixedExpense = () => {
    setFixedExpenses([...fixedExpenses, {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      category: '',
      frequency: 'monthly'
    }]);
  };

  const removeFixedExpense = (id: string) => {
    if (fixedExpenses.length > 1) {
      setFixedExpenses(fixedExpenses.filter(e => e.id !== id));
    }
  };

  const updateFixedExpense = (id: string, field: keyof FixedExpense, value: any) => {
    setFixedExpenses(fixedExpenses.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const addLoan = () => {
    setLoans([...loans, {
      id: Date.now().toString(),
      loan_type: '',
      current_balance: 0,
      monthly_payment: 0,
      interest_rate: 0
    }]);
  };

  const removeLoan = (id: string) => {
    if (loans.length > 1) {
      setLoans(loans.filter(l => l.id !== id));
    }
  };

  const updateLoan = (id: string, field: keyof Loan, value: any) => {
    setLoans(loans.map(l => 
      l.id === id ? { ...l, [field]: value } : l
    ));
  };

  const handleSubmit = async () => {
    if (!userId) return;

    // Validate at least one income source
    const validIncome = incomeSources.filter(i => i.source_name && i.net_amount > 0);
    if (validIncome.length === 0) {
      alert('אנא הזן לפחות מקור הכנסה אחד');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/manual-input/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          incomeSources: validIncome,
          fixedExpenses: fixedExpenses.filter(e => e.name && e.amount > 0),
          loans: loans.filter(l => l.loan_type && l.current_balance > 0),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בשמירת הנתונים');
      }

      // Show success message
      alert('הנתונים נשמרו בהצלחה! 🎉');
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Save error:', error);
      alert('אירעה שגיאה. נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-phi-mint/10 via-white to-phi-coral/10 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <Card className="bg-gradient-to-l from-phi-gold/10 to-phi-coral/10 border-4 border-phi-gold/30 p-8 mb-8">
          <div className="text-center">
            <h1 className="text-4xl font-black text-phi-dark mb-4">
              הזנה ידנית ✍️
            </h1>
            <p className="text-xl text-gray-700">
              מלא את הפרטים הבסיסיים שלך - זה ייקח רק כמה דקות
            </p>
          </div>
        </Card>

        {/* Section 1: Income Sources */}
        <Card className="p-8 mb-8 border-2 border-green-200">
          <div className="flex items-center gap-3 mb-6">
            <DollarSign className="w-8 h-8 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-900">הכנסות חודשיות</h2>
          </div>

          <div className="space-y-4">
            {incomeSources.map((income, index) => (
              <div key={income.id} className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-700">מקור הכנסה #{index + 1}</span>
                  {incomeSources.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeIncomeSource(income.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      שם המקור
                    </label>
                    <input
                      type="text"
                      value={income.source_name}
                      onChange={(e) => updateIncomeSource(income.id, 'source_name', e.target.value)}
                      placeholder="למשל: משכורת"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      סכום נטו (₪)
                    </label>
                    <input
                      type="number"
                      value={income.net_amount || ''}
                      onChange={(e) => updateIncomeSource(income.id, 'net_amount', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      תדירות
                    </label>
                    <select
                      value={income.frequency}
                      onChange={(e) => updateIncomeSource(income.id, 'frequency', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="monthly">חודשי</option>
                      <option value="biweekly">דו-שבועי</option>
                      <option value="weekly">שבועי</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={addIncomeSource}
            variant="outline"
            className="mt-4 border-green-300 text-green-700 hover:bg-green-50"
          >
            <PlusCircle className="w-4 h-4 ml-2" />
            הוסף הכנסה נוספת
          </Button>
        </Card>

        {/* Section 2: Fixed Expenses */}
        <Card className="p-8 mb-8 border-2 border-orange-200">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8 text-orange-600" />
            <h2 className="text-2xl font-bold text-gray-900">הוצאות קבועות</h2>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            דוגמאות: שכר דירה, ארנונה, ביטוח, טלפון, אינטרנט, מנויים
          </p>

          <div className="space-y-4">
            {fixedExpenses.map((expense, index) => (
              <div key={expense.id} className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-700">הוצאה #{index + 1}</span>
                  {fixedExpenses.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFixedExpense(expense.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      שם ההוצאה
                    </label>
                    <input
                      type="text"
                      value={expense.name}
                      onChange={(e) => updateFixedExpense(expense.id, 'name', e.target.value)}
                      placeholder="למשל: שכר דירה"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      סכום (₪)
                    </label>
                    <input
                      type="number"
                      value={expense.amount || ''}
                      onChange={(e) => updateFixedExpense(expense.id, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      קטגוריה
                    </label>
                    <input
                      type="text"
                      value={expense.category}
                      onChange={(e) => updateFixedExpense(expense.id, 'category', e.target.value)}
                      placeholder="למשל: דיור"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      תדירות
                    </label>
                    <select
                      value={expense.frequency}
                      onChange={(e) => updateFixedExpense(expense.id, 'frequency', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="monthly">חודשי</option>
                      <option value="biweekly">דו-שבועי</option>
                      <option value="weekly">שבועי</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={addFixedExpense}
            variant="outline"
            className="mt-4 border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            <PlusCircle className="w-4 h-4 ml-2" />
            הוסף הוצאה נוספת
          </Button>
        </Card>

        {/* Section 3: Loans */}
        <Card className="p-8 mb-8 border-2 border-red-200">
          <div className="flex items-center gap-3 mb-6">
            <CreditCard className="w-8 h-8 text-red-600" />
            <h2 className="text-2xl font-bold text-gray-900">חובות והלוואות (אופציונלי)</h2>
          </div>

          <div className="space-y-4">
            {loans.map((loan, index) => (
              <div key={loan.id} className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-700">חוב #{index + 1}</span>
                  {loans.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLoan(loan.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      סוג חוב
                    </label>
                    <input
                      type="text"
                      value={loan.loan_type}
                      onChange={(e) => updateLoan(loan.id, 'loan_type', e.target.value)}
                      placeholder="למשל: משכנתא"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      יתרה נוכחית (₪)
                    </label>
                    <input
                      type="number"
                      value={loan.current_balance || ''}
                      onChange={(e) => updateLoan(loan.id, 'current_balance', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      תשלום חודשי (₪)
                    </label>
                    <input
                      type="number"
                      value={loan.monthly_payment || ''}
                      onChange={(e) => updateLoan(loan.id, 'monthly_payment', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ריבית (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={loan.interest_rate || ''}
                      onChange={(e) => updateLoan(loan.id, 'interest_rate', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={addLoan}
            variant="outline"
            className="mt-4 border-red-300 text-red-700 hover:bg-red-50"
          >
            <PlusCircle className="w-4 h-4 ml-2" />
            הוסף חוב נוסף
          </Button>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-gradient-to-l from-phi-gold to-phi-coral text-white text-xl font-bold py-6 px-12 hover:shadow-xl"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                שומר...
              </>
            ) : (
              '✅ שמור והמשך'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

