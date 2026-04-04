'use client';

import { useState, useEffect } from 'react';
import { DashboardWrapper } from '@/components/dashboard/DashboardWrapper';

import { Button } from '@/components/ui/button';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CreditCard, TrendingDown, DollarSign, Clock, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Card as DSCard, EmptyState as DSEmptyState, PageHeader } from '@/components/ui/design-system';

interface Loan {
  id: string;
  lender_name: string;
  loan_type: string;
  monthly_payment: number;
  current_balance: number | null;
  interest_rate: number | null;
  start_date: string | null;
  end_date: string | null;
  remaining_payments: number | null;
  active: boolean;
  created_at: string;
}

const COLORS = ['#074259', '#F6A623', '#7ED957', '#E74C3C', '#9B59B6', '#1ABC9C'];

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  useEffect(() => {
    fetchLoans();
  }, []);

  async function fetchLoans() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/loans/list');
      if (!response.ok) throw new Error('Failed to fetch loans');
      const data = await response.json();
      setLoans(data.loans || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
      setError('שגיאה בטעינת ההלוואות. נסה לרענן את הדף.');
    } finally {
      setLoading(false);
    }
  }

  // Calculate statistics
  const totalMonthlyPayments = loans
    .filter(l => l.active)
    .reduce((sum, loan) => sum + loan.monthly_payment, 0);
  
  const totalDebt = loans
    .filter(l => l.active && l.current_balance)
    .reduce((sum, loan) => sum + (loan.current_balance || 0), 0);

  const averageInterest = loans
    .filter(l => l.active && l.interest_rate)
    .reduce((sum, loan, _, arr) => sum + (loan.interest_rate || 0) / arr.length, 0);

  // Chart data
  const monthlyPaymentsData = loans
    .filter(l => l.active)
    .map(loan => ({
      name: loan.lender_name,
      payment: loan.monthly_payment,
    }));

  const loanTypeData = loans
    .filter(l => l.active)
    .reduce((acc, loan) => {
      const existing = acc.find(item => item.name === loan.loan_type);
      if (existing) {
        existing.value += loan.monthly_payment;
      } else {
        acc.push({ name: loan.loan_type, value: loan.monthly_payment });
      }
      return acc;
    }, [] as Array<{ name: string; value: number }>);

  if (loading) {
    return (
      <DashboardWrapper>
      <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardWrapper>
    );
  }

  if (error) {
    return (
      <DashboardWrapper>
        <div className="min-h-screen bg-gray-50 p-4 md:p-6 flex items-center justify-center" dir="rtl">
          <div className="text-center space-y-4">
            <div className="text-red-500 text-lg font-semibold">{error}</div>
            <Button onClick={fetchLoans} className="bg-blue-600 hover:bg-blue-700 text-white">
              נסה שוב
            </Button>
          </div>
        </div>
      </DashboardWrapper>
    );
  }

  return (
    <DashboardWrapper>
      <div className="min-h-screen bg-gray-50 p-4 md:p-6" dir="rtl">
        <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <PageHeader
          title="הלוואות"
          subtitle="מעקב והיסטוריה של כל ההלוואות שלך"
          action={
            <Button
              onClick={() => window.location.href = '/dashboard/data/loans'}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-5 h-5 ml-2" />
              הוסף הלוואה
            </Button>
          }
        />

          {loans.length === 0 ? (
          <DSEmptyState
            icon={CreditCard}
            title="אין הלוואות עדיין"
            description="העלה דוח בנק או הוסף הלוואה ידנית כדי להתחיל לעקוב אחרי ההלוואות שלך"
            action={{ label: 'העלה דוח בנק', href: '/dashboard/scan-center' }}
          />
          ) : (
            <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <DSCard padding="lg" className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-500">
                  <div className="flex items-center justify-between mb-2">
                    <CreditCard className="w-8 h-8 opacity-80" />
                    <span className="text-sm opacity-80">הלוואות פעילות</span>
                  </div>
                  <div className="text-3xl font-bold">{loans.filter(l => l.active).length}</div>
              </DSCard>

              <DSCard padding="lg" className="bg-gradient-to-br from-red-500 to-red-600 text-white border-red-500">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingDown className="w-8 h-8 opacity-80" />
                    <span className="text-sm opacity-80">תשלום חודשי</span>
                  </div>
                  <div className="text-3xl font-bold">₪{totalMonthlyPayments.toLocaleString('he-IL')}</div>
              </DSCard>

              <DSCard padding="lg" className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-orange-500">
                  <div className="flex items-center justify-between mb-2">
                    <DollarSign className="w-8 h-8 opacity-80" />
                    <span className="text-sm opacity-80">סה״כ חוב</span>
                  </div>
                  <div className="text-3xl font-bold">
                    {totalDebt > 0 ? `₪${totalDebt.toLocaleString('he-IL')}` : 'לא ידוע'}
                  </div>
              </DSCard>

              <DSCard padding="lg" className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-purple-500">
                  <div className="flex items-center justify-between mb-2">
                    <Clock className="w-8 h-8 opacity-80" />
                    <span className="text-sm opacity-80">ריבית ממוצעת</span>
                  </div>
                  <div className="text-3xl font-bold">
                    {averageInterest > 0 ? `${averageInterest.toFixed(1)}%` : 'לא ידוע'}
                  </div>
              </DSCard>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Monthly Payments Bar Chart */}
              <DSCard padding="lg">
                <h3 className="text-xl font-bold text-gray-900 mb-4">תשלומים חודשיים לפי מלווה</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyPaymentsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `₪${value.toLocaleString('he-IL')}`} />
                      <Bar dataKey="payment" fill="#3A7BD5" />
                    </BarChart>
                  </ResponsiveContainer>
              </DSCard>

              {/* Loan Types Pie Chart */}
              <DSCard padding="lg">
                <h3 className="text-xl font-bold text-gray-900 mb-4">פילוח לפי סוג הלוואה</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={loanTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {loanTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `₪${value.toLocaleString('he-IL')}`} />
                    </PieChart>
                  </ResponsiveContainer>
              </DSCard>
              </div>

            {/* Loans List */}
            <DSCard padding="lg">
              <h3 className="text-xl font-bold text-gray-900 mb-4">רשימת הלוואות</h3>
                <div className="space-y-4">
                  {loans.map((loan) => (
                    <div key={loan.id} className="border border-gray-200 rounded-lg">
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg text-gray-900">{loan.lender_name}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              loan.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {loan.active ? 'פעיל' : 'סגור'}
                            </span>
                            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              {loan.loan_type === 'personal' ? 'אישית' : 
                               loan.loan_type === 'mortgage' ? 'משכנתא' :
                               loan.loan_type === 'car' ? 'רכב' : loan.loan_type}
                          </span>
                        </div>
                          <div className="mt-2 flex gap-6 text-sm text-gray-600">
                            <span>תשלום חודשי: <strong className="text-gray-900">₪{loan.monthly_payment.toLocaleString('he-IL')}</strong></span>
                            {loan.current_balance && (
                              <span>יתרת חוב: <strong className="text-gray-900">₪{loan.current_balance.toLocaleString('he-IL')}</strong></span>
                            )}
                            {loan.interest_rate && (
                              <span>ריבית: <strong className="text-gray-900">{loan.interest_rate}%</strong></span>
                            )}
                      </div>
                        </div>
                        {expandedLoan === loan.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>

                      {expandedLoan === loan.id && (
                        <div className="px-4 pb-4 pt-2 border-t border-gray-200 bg-gray-50 space-y-2 text-sm">
                          {loan.start_date && <div><strong>תאריך התחלה:</strong> {new Date(loan.start_date).toLocaleDateString('he-IL')}</div>}
                          {loan.end_date && <div><strong>תאריך סיום:</strong> {new Date(loan.end_date).toLocaleDateString('he-IL')}</div>}
                          {loan.remaining_payments && <div><strong>תשלומים נותרים:</strong> {loan.remaining_payments}</div>}
                          <div><strong>נוצר:</strong> {new Date(loan.created_at).toLocaleDateString('he-IL')}</div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </DSCard>
          </>
        )}
        </div>
      </div>
    </DashboardWrapper>
  );
}
