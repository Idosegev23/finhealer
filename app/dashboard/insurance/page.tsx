"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Shield, Heart, AlertTriangle } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { DashboardNav } from "@/components/shared/DashboardNav";
import { AddInsuranceModal } from "@/components/insurance/AddInsuranceModal";

interface Insurance {
  id: string;
  insurance_type: string;
  provider: string;
  policy_number: string;
  status: string;
  coverage_amount: number;
  monthly_premium: number;
  annual_premium: number;
}

const INSURANCE_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  life: { label: "ביטוח חיים", icon: "❤️" },
  health: { label: "ביטוח בריאות", icon: "🏥" },
  critical_illness: { label: "מחלות קשות", icon: "⚕️" },
  disability: { label: "ביטוח סיעודי", icon: "🦽" },
  accident: { label: "תאונות אישיות", icon: "🚑" },
};

export default function InsurancePage() {
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchInsurances();
  }, []);

  const fetchInsurances = async () => {
    try {
      const res = await fetch("/api/insurance");
      const json = await res.json();
      setInsurances(json.data || []);
      setSummary(json.summary || {});
    } catch (error) {
      console.error("Error fetching insurances:", error);
    } finally {
      setLoading(false);
    }
  };

  const missingInsurances = Object.keys(INSURANCE_TYPE_LABELS).filter(
    (type) => !insurances.some((ins) => ins.insurance_type === type)
  );

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
                <Shield className="w-8 h-8 text-[#3A7BD5]" />
                תיק הביטוח שלי
                <InfoTooltip
                  content="כאן תוכל לנהל את כל הביטוחים שלך - חיים, בריאות, מחלות קשות, סיעודי ותאונות אישיות"
                  type="info"
                />
              </h1>
              <p className="text-gray-600 mt-2">ניהול מרכזי של כל הביטוחים שלך</p>
            </div>
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-[#7ED957] hover:bg-[#6BC949] text-white"
            >
              <PlusCircle className="w-4 h-4 ml-2" />
              הוסף ביטוח
            </Button>
          </div>
        </div>

        {/* Missing Insurances Alert */}
        {missingInsurances.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                  חסרים לך ביטוחים חשובים
                </h3>
                <p className="text-yellow-800 mb-3">
                  זוהו פערי כיסוי בתיק הביטוח שלך:
                </p>
                <div className="flex flex-wrap gap-2">
                  {missingInsurances.map((type) => (
                    <span
                      key={type}
                      className="px-3 py-1 bg-yellow-100 text-yellow-900 rounded-full text-sm"
                    >
                      {INSURANCE_TYPE_LABELS[type].icon}{" "}
                      {INSURANCE_TYPE_LABELS[type].label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-gray-600">סה&quot;כ ביטוחים</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {summary.total_policies}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <Heart className="w-5 h-5 text-red-500" />
                <span className="text-sm text-gray-600">פרמיה חודשית</span>
              </div>
              <div className="text-2xl font-bold text-red-600">
                ₪{summary.monthly_total?.toLocaleString("he-IL") || 0}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-gray-600">פרמיה שנתית</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                ₪{summary.annual_total?.toLocaleString("he-IL") || 0}
              </div>
            </div>
          </div>
        )}

        {/* Insurances Grid */}
        {insurances.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm text-center py-16 animate-fade-in">
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-green-100 rounded-full blur-3xl opacity-30 animate-pulse"></div>
              <Shield className="w-20 h-20 text-[#7ED957] mx-auto relative animate-bounce-slow" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              בואו נדאג לעתיד שלכם 🛡️
            </h3>
            <p className="text-gray-600 mb-2 max-w-md mx-auto leading-relaxed">
              ביטוחים זה לא הוצאה - זה ביטחון. הגנה על המשפחה והנכסים שלך.
            </p>
            <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
              התחל לנהל את תיק הביטוח שלך בצורה מקצועית ובדוק שיש לך את הכיסויים החשובים
            </p>
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-[#7ED957] hover:bg-[#6BC949] text-white shadow-lg hover:shadow-xl transition-all"
            >
              <PlusCircle className="w-4 h-4 ml-2" />
              הוסף ביטוח ראשון
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {insurances.map((insurance) => {
              const typeInfo = INSURANCE_TYPE_LABELS[insurance.insurance_type];
              return (
                <div
                  key={insurance.id}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{typeInfo?.icon}</div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {typeInfo?.label || insurance.insurance_type}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {insurance.provider}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        insurance.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {insurance.status === "active" ? "פעיל" : "לא פעיל"}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">מספר פוליסה:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {insurance.policy_number || "לא צוין"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">גובה כיסוי:</span>
                      <span className="text-sm font-semibold text-green-600">
                        ₪{insurance.coverage_amount?.toLocaleString("he-IL") || 0}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">פרמיה חודשית:</span>
                      <span className="text-lg font-bold text-[#3A7BD5]">
                        ₪{insurance.monthly_premium?.toLocaleString("he-IL") || 0}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Button variant="outline" size="sm" className="w-full">
                      ערוך פרטים
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 shadow-sm animate-slide-up">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900 mb-1">
                טיפים חכמים לניהול תיק ביטוח
              </h3>
              <p className="text-sm text-blue-700">
                כי ביטחון זה לא מותרות - זה הכרח
              </p>
            </div>
          </div>
          <ul className="space-y-3 text-sm text-blue-800">
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>ביטוח חיים</strong> - מומלץ כיסוי של פי 10 מההכנסה השנתית. זה מגן על המשפחה במקרה הגרוע ביותר
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>ביטוח בריאות משלים</strong> - השקעה של 200-300 ₪ בחודש שיכולה לחסוך 50,000-100,000 ₪ בניתוח
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>מחלות קשות</strong> - חובה אם יש משפחה או משכנתא. זה הביטחון שהכסף לא יגמר במצב קשה
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>ביטוח סיעודי</strong> - ככל שמתחילים צעירים יותר, הפרמיות זולות יותר. אל תחכו!
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-blue-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>עדכנו בשינויים גדולים</strong> - נישואין, ילד, משכנתא חדשה? זה הזמן לבדוק את הכיסויים
              </span>
            </li>
          </ul>
        </div>
        </div>
      </div>

      {/* Add Insurance Modal */}
      <AddInsuranceModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={fetchInsurances}
      />
    </>
  );
}
