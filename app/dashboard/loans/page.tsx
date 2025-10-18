"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, DollarSign, TrendingDown, AlertCircle, Calculator } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { DashboardNav } from "@/components/shared/DashboardNav";
import { AddLoanModal } from "@/components/loans/AddLoanModal";
import Link from "next/link";

interface Loan {
  id: string;
  lender_name: string;
  loan_type: string;
  original_amount: number;
  current_balance: number;
  monthly_payment: number;
  interest_rate: number;
  remaining_payments: number;
  active: boolean;
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  mortgage: "משכנתא",
  personal: "הלוואה אישית",
  car: "הלוואת רכב",
  student: "הלוואת סטודנט",
  credit: "אשראי",
  business: "הלוואת עסק",
  other: "אחר",
};

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      const res = await fetch("/api/loans");
      if (res.ok) {
        const data = await res.json();
        setLoans(data || []);
      }
    } catch (error) {
      console.error("Error fetching loans:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totals = loans.reduce(
    (acc, loan) => ({
      totalBalance: acc.totalBalance + (loan.current_balance || 0),
      totalMonthly: acc.totalMonthly + (loan.monthly_payment || 0),
      totalOriginal: acc.totalOriginal + (loan.original_amount || 0),
    }),
    { totalBalance: 0, totalMonthly: 0, totalOriginal: 0 }
  );

  const totalPaid = totals.totalOriginal - totals.totalBalance;
  const avgInterest =
    loans.length > 0
      ? loans.reduce((sum, l) => sum + (l.interest_rate || 0), 0) / loans.length
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3A7BD5] mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardNav />
      <div className="min-h-screen bg-gray-50 py-8" dir="rtl">
        <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-[#3A7BD5]" />
                הלוואות והתחייבויות
                <InfoTooltip
                  content="כאן תוכל לנהל את כל ההלוואות שלך - משכנתא, הלוואות אישיות, רכב ועוד"
                  type="info"
                />
              </h1>
              <p className="text-gray-600 mt-2">ניהול מרכזי של כל ההתחייבויות שלך</p>
            </div>
            <div className="flex gap-3">
              <Link href="/loans-simulator">
                <Button variant="outline" className="border-[#7ED957] text-[#7ED957] hover:bg-[#7ED957] hover:text-white">
                  <Calculator className="w-4 h-4 ml-2" />
                  סימולטור איחוד
                </Button>
              </Link>
              <Button 
                onClick={() => setShowAddModal(true)}
                className="bg-[#3A7BD5] hover:bg-[#2A5BA5] text-white"
              >
                <PlusCircle className="w-4 h-4 ml-2" />
                הוסף הלוואה
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-gray-600">סה&quot;כ הלוואות</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{loans.length}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <span className="text-sm text-gray-600">יתרת חוב כוללת</span>
            </div>
            <div className="text-2xl font-bold text-red-600">
              ₪{totals.totalBalance.toLocaleString("he-IL")}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-gray-600">תשלום חודשי</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              ₪{totals.totalMonthly.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-gray-600">ריבית ממוצעת</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {avgInterest.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Suggestion Card */}
        {loans.length > 1 && avgInterest > 6 && (
          <div className="bg-gradient-to-r from-[#7ED957] to-[#6BC949] text-white rounded-lg p-6 mb-8">
            <div className="flex items-start gap-4">
              <Calculator className="w-8 h-8 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold mb-2">
                  💡 יש לך יותר מהלוואה אחת עם ריבית גבוהה
                </h3>
                <p className="mb-4">
                  איחוד ההלוואות שלך יכול לחסוך לך אלפי שקלים! הריבית הממוצעת שלך היא{" "}
                  <strong>{avgInterest.toFixed(2)}%</strong>, אבל הלוואה מאוחדת יכולה להגיע לריבית של 4-6% בלבד.
                </p>
                <Link href="/loans-simulator">
                  <Button className="bg-white text-[#7ED957] hover:bg-gray-100">
                    <Calculator className="w-4 h-4 ml-2" />
                    חשב כמה תחסוך עם הסימולטור שלנו
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Loans Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loans.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-blue-100 rounded-full blur-3xl opacity-30 animate-pulse"></div>
                <DollarSign className="w-20 h-20 text-[#3A7BD5] mx-auto relative animate-bounce-slow" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                מצוין! אין לך הלוואות 🎉
              </h3>
              <p className="text-gray-600 mb-2 max-w-md mx-auto leading-relaxed">
                זה מצב נהדר - אתה ללא התחייבויות כספיות!
              </p>
              <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
                אם בכל זאת יש לך הלוואות, הוסף אותן כאן כדי לעקוב אחרי ההתקדמות ולראות כמה כסף תחסוך עם איחוד
              </p>
              <Button 
                onClick={() => setShowAddModal(true)}
                className="bg-[#3A7BD5] hover:bg-[#2A5BA5] text-white shadow-lg hover:shadow-xl transition-all"
              >
                <PlusCircle className="w-4 h-4 ml-2" />
                הוסף הלוואה
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      מלווה
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      סוג
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      סכום מקורי
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      יתרה נוכחית
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      תשלום חודשי
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ריבית
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      תשלומים נותרים
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      התקדמות
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      פעולות
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loans.map((loan) => {
                    const paidPercentage =
                      ((loan.original_amount - loan.current_balance) / loan.original_amount) * 100;
                    return (
                      <tr key={loan.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {loan.lender_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                            {LOAN_TYPE_LABELS[loan.loan_type] || loan.loan_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          ₪{loan.original_amount?.toLocaleString("he-IL") || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                          ₪{loan.current_balance?.toLocaleString("he-IL") || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                          ₪{loan.monthly_payment?.toLocaleString("he-IL", { maximumFractionDigits: 0 }) || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {loan.interest_rate}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {loan.remaining_payments || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-32">
                            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${paidPercentage}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-gray-500 text-center">
                              {paidPercentage.toFixed(0)}% שולם
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Button variant="ghost" size="sm">
                            ערוך
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm animate-slide-up">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900 mb-1">
                טיפים חכמים לניהול הלוואות
              </h3>
              <p className="text-sm text-blue-700">
                כמה עצות שיכולות לחסוך לך אלפי שקלים
              </p>
            </div>
          </div>
          <ul className="space-y-3 text-sm text-blue-800">
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>שלמו מעל למינימום</strong> - כל שקל נוסף שאתם משלמים מקצר את תקופת ההחזר וחוסך המון ריבית
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>שקלו איחוד הלוואות</strong> - אם יש לכם יותר מהלוואה אחת עם ריבית גבוהה, איחוד יכול לחסוך לכם עד 50% מהריבית!
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>שימו לב לעמלות</strong> - לפני פירעון מוקדם, בדקו אם יש עמלות. לפעמים כדאי להמתין
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>סגרו קודם את היקרות</strong> - תעדפו לסגור הלוואות עם הריבית הגבוהה ביותר - זה החיסכון הגדול ביותר
              </span>
            </li>
          </ul>
        </div>
        </div>
      </div>

      {/* Add Loan Modal */}
      <AddLoanModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={fetchLoans}
      />
    </>
  );
}
