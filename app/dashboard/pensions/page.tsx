"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Shield, TrendingUp, Briefcase } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { AddPensionModal } from "@/components/pensions/AddPensionModal";
import { RequestPensionReport } from "@/components/pension/RequestPensionReport";

interface PensionFund {
  id: string;
  fund_name: string;
  fund_type: string;
  provider: string;
  current_balance: number;
  monthly_deposit: number;
  management_fee_percentage: number;
  annual_return: number;
  employee_type: string;
}

const FUND_TYPE_LABELS: Record<string, string> = {
  pension_fund: "קרן פנסיה",
  provident_fund: "קופת גמל",
  advanced_study_fund: "קרן השתלמות",
  managers_insurance: "ביטוח מנהלים",
  investment_provident: "קופת גמל להשקעה",
};

export default function PensionsPage() {
  const [pensions, setPensions] = useState<PensionFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchPensions();
  }, []);

  const fetchPensions = async () => {
    try {
      const res = await fetch("/api/pensions");
      const json = await res.json();
      setPensions(json.data || []);
      setSummary(json.summary || {});
    } catch (error) {
      console.error("Error fetching pensions:", error);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="min-h-screen bg-gray-50 py-8" dir="rtl">
        <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Shield className="w-8 h-8 text-[#3A7BD5]" />
                חיסכון פנסיוני
                <InfoTooltip
                  content="כאן תוכל לנהל את כל הקרנות הפנסיוניות שלך - קופות גמל, קרן השתלמות, ביטוח מנהלים ועוד"
                  type="info"
                />
              </h1>
              <p className="text-gray-600 mt-2">
                ניהול מרכזי של כל החיסכון הפנסיוני שלך
              </p>
            </div>
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-[#7ED957] hover:bg-[#6BC949] text-white"
            >
              <PlusCircle className="w-4 h-4 ml-2" />
              הוסף קרן חדשה
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <Briefcase className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-gray-600">סה&quot;כ קרנות</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {summary.total_funds}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-600">יתרה כוללת</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                ₪{summary.total_balance?.toLocaleString("he-IL") || 0}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-gray-600">הפקדה חודשית</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                ₪{summary.total_monthly_deposit?.toLocaleString("he-IL") || 0}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                <span className="text-sm text-gray-600">תשואה ממוצעת</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {summary.average_return?.toFixed(2) || 0}%
              </div>
            </div>
          </div>
        )}

        {/* Request Pension Report from Gadi */}
        <div className="mb-8">
          <RequestPensionReport />
        </div>

        {/* Pensions Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {pensions.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-purple-100 rounded-full blur-3xl opacity-30 animate-pulse"></div>
                <Shield className="w-20 h-20 text-[#3A7BD5] mx-auto relative animate-bounce-slow" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                העתיד שלך מתחיל היום 🌟
              </h3>
              <p className="text-gray-600 mb-2 max-w-md mx-auto leading-relaxed">
                פנסיה זה לא רק חובה - זה ההשקעה החשובה ביותר שלך. בגיל 67 תודו לעצמכם של היום.
              </p>
              <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
                הוסף את הקרנות הפנסיוניות שלך ובדוק שהן עובדות בשבילך נכון
              </p>
              <Button 
                onClick={() => setShowAddModal(true)}
                className="bg-[#7ED957] hover:bg-[#6BC949] text-white shadow-lg hover:shadow-xl transition-all"
              >
                <PlusCircle className="w-4 h-4 ml-2" />
                הוסף קרן פנסיונית ראשונה
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      שם הקרן
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      סוג
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      חברה
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      יתרה
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      הפקדה חודשית
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      דמי ניהול
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      תשואה
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      פעולות
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pensions.map((pension) => (
                    <tr key={pension.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {pension.fund_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {FUND_TYPE_LABELS[pension.fund_type] || pension.fund_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {pension.provider}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        ₪{pension.current_balance?.toLocaleString("he-IL") || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        ₪{pension.monthly_deposit?.toLocaleString("he-IL") || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {pension.management_fee_percentage}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm font-semibold ${
                            pension.annual_return >= 5
                              ? "text-green-600"
                              : pension.annual_return >= 0
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {pension.annual_return >= 0 ? "+" : ""}
                          {pension.annual_return}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Button variant="ghost" size="sm">
                          ערוך
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 shadow-sm animate-slide-up">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900 mb-1">
                טיפים חכמים לניהול חיסכון פנסיוני
              </h3>
              <p className="text-sm text-blue-700">
                כי בגיל 67 תרצו לחיות בכבוד
              </p>
            </div>
          </div>
          <ul className="space-y-3 text-sm text-blue-800">
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>הפרישו מינימום 18.5%</strong> - לפחות 17.5% לפנסיה + 6% לקרן השתלמות. זה לא מותרות, זה הכרח
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>דמי ניהול חשובים</strong> - כל 0.1% זה אלפי שקלים על 30 שנה. מעל 0.5%? תבדקו אלטרנטיבות זולות יותר
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>תשואה ארוכת טווח</strong> - תשואה שנתית ממוצעת של 4-6% לאורך זמן היא מצוינת. אל תרדפו אחרי תשואות גבוהות
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>בדקו פערי כיסוי</strong> - קרן פנסיה טובה כוללת גם ביטוח נכות וסיעוד. ודאו שזה קיים!
              </span>
            </li>
          </ul>
        </div>
      </div>
      
      {/* Add Pension Modal */}
      <AddPensionModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={fetchPensions}
      />
    </div>
  );
}

