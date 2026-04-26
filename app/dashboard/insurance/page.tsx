"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PlusCircle, Shield, Heart, AlertTriangle,
  HeartPulse, Stethoscope, Accessibility, Ambulance,
  Home, Car, Plane, PawPrint, FileText,
  type LucideIcon,
} from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { AddInsuranceModal } from "@/components/insurance/AddInsuranceModal";
import { RequestPensionReport } from "@/components/pension/RequestPensionReport";
import { PageWrapper, PageHeader, Card as DSCard, InsightBanner } from '@/components/ui/design-system';

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

const INSURANCE_TYPE_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  life:             { label: "ביטוח חיים",         icon: HeartPulse },
  health:           { label: "ביטוח בריאות",       icon: Stethoscope },
  critical_illness: { label: "מחלות קשות",         icon: Heart },
  disability:       { label: "ביטוח סיעודי",       icon: Accessibility },
  accident:         { label: "תאונות אישיות",      icon: Ambulance },
  home:             { label: "ביטוח דירה",         icon: Home },
  car:              { label: "ביטוח רכב",          icon: Car },
  travel:           { label: "ביטוח נסיעות",       icon: Plane },
  pet:              { label: "ביטוח חיות מחמד",    icon: PawPrint },
  other:            { label: "אחר",                icon: FileText },
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phi-dark mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper>
        <PageHeader
          title="תיק הביטוח שלי"
          subtitle="ניהול מרכזי של כל הביטוחים — חיים, בריאות, מחלות קשות, סיעודי, תאונות אישיות"
          action={
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-phi-dark hover:bg-phi-slate text-white"
            >
              <PlusCircle className="w-4 h-4 ml-2" />
              הוסף ביטוח
            </Button>
          }
        />

        <RequestPensionReport />

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
                  {missingInsurances.map((type) => {
                    const typeInfo = INSURANCE_TYPE_LABELS[type];
                    const TypeIcon = typeInfo?.icon || FileText;
                    return (
                      <span
                        key={type}
                        className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-sm inline-flex items-center gap-1.5"
                      >
                        <TypeIcon className="w-3.5 h-3.5" />
                        {typeInfo?.label || type}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <DSCard padding="lg">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-phi-slate">סה&quot;כ ביטוחים</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {summary.total_policies}
              </div>
            </DSCard>

            <DSCard padding="lg">
              <div className="flex items-center gap-3 mb-2">
                <Heart className="w-5 h-5 text-red-500" />
                <span className="text-sm text-phi-slate">פרמיה חודשית</span>
              </div>
              <div className="text-2xl font-bold text-red-600">
                ₪{summary.monthly_total?.toLocaleString("he-IL") || 0}
              </div>
            </DSCard>

            <DSCard padding="lg">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-phi-slate">פרמיה שנתית</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                ₪{summary.annual_total?.toLocaleString("he-IL") || 0}
              </div>
            </DSCard>
          </div>
        )}

        {/* Insurances Grid */}
        {insurances.length === 0 ? (
          <DSCard padding="lg" className="text-center py-16 animate-fade-in">
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-green-100 rounded-full blur-3xl opacity-30 animate-pulse"></div>
              <Shield className="w-20 h-20 text-phi-mint mx-auto relative animate-bounce-slow" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              בואו נדאג לעתיד שלכם 🛡️
            </h3>
            <p className="text-gray-600 mb-2 max-w-md mx-auto leading-relaxed">
              ביטוחים זה לא הוצאה - זה ביטחון. הגנה על המשפחה והנכסים שלך.
            </p>
            <p className="text-sm text-phi-slate mb-8 max-w-md mx-auto">
              התחל לנהל את תיק הביטוח שלך בצורה מקצועית ובדוק שיש לך את הכיסויים החשובים
            </p>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-phi-mint hover:bg-phi-mint/90 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <PlusCircle className="w-4 h-4 ml-2" />
              הוסף ביטוח ראשון
            </Button>
          </DSCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {insurances.map((insurance) => {
              const typeInfo = INSURANCE_TYPE_LABELS[insurance.insurance_type];
              const TypeIcon = typeInfo?.icon || FileText;
              return (
                <DSCard
                  key={insurance.id}
                  padding="lg"
                  hover
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-phi-dark/10 flex items-center justify-center flex-shrink-0">
                        <TypeIcon className="w-5 h-5 text-phi-dark" />
                      </div>
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
                      <span className="text-lg font-bold text-phi-dark">
                        ₪{insurance.monthly_premium?.toLocaleString("he-IL") || 0}
                      </span>
                    </div>
                  </div>

                </DSCard>
              );
            })}
          </div>
        )}

        <DSCard padding="lg">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-phi-dark" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-0.5">טיפים חכמים לניהול תיק ביטוח</h3>
              <p className="text-sm text-gray-500">כי ביטחון זה לא מותרות — זה הכרח</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              { title: 'ביטוח חיים', body: 'מומלץ כיסוי של פי 10 מההכנסה השנתית. זה מגן על המשפחה במקרה הגרוע ביותר' },
              { title: 'ביטוח בריאות משלים', body: 'השקעה של 200-300 ₪ בחודש שיכולה לחסוך 50,000-100,000 ₪ בניתוח' },
              { title: 'מחלות קשות', body: 'חובה אם יש משפחה או משכנתא. זה הביטחון שהכסף לא יגמר במצב קשה' },
              { title: 'ביטוח סיעודי', body: 'ככל שמתחילים צעירים יותר, הפרמיות זולות יותר. אל תחכו' },
              { title: 'עדכון בשינויים גדולים', body: 'נישואין, ילד, משכנתא חדשה — זה הזמן לבדוק את הכיסויים' },
            ].map((tip, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-phi-dark/10 text-phi-dark flex items-center justify-center text-xs font-bold mt-0.5">✓</span>
                <span className="leading-relaxed"><strong className="text-gray-900">{tip.title}</strong> — {tip.body}</span>
              </li>
            ))}
          </ul>
        </DSCard>

      {/* Add Insurance Modal */}
      <AddInsuranceModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={fetchInsurances}
      />
    </PageWrapper>
  );
}
