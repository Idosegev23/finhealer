"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusCircle, Shield, TrendingUp, Briefcase, Mail, Loader2, AlertTriangle } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { AddPensionModal } from "@/components/pensions/AddPensionModal";
import { RequestPensionReport } from "@/components/pension/RequestPensionReport";
import { PageWrapper, PageHeader, Card as DSCard } from '@/components/ui/design-system';
import { analyzePensionPlan, analyzePortfolio } from '@/lib/finance/pension-insights';
import { useToast } from '@/components/ui/toaster';

interface PensionFund {
  id: string;
  fund_name: string;
  fund_type: string;
  provider: string;
  current_balance: number;
  monthly_deposit: number;
  management_fee_percentage: number;
  deposit_fee_percentage?: number;
  annual_return: number;
  employee_type: string;
  active?: boolean | null;
}

const FUND_TYPE_LABELS: Record<string, string> = {
  pension_fund: "קרן פנסיה",
  provident_fund: "קופת גמל",
  advanced_study_fund: "קרן השתלמות",
  managers_insurance: "ביטוח מנהלים",
  investment_provident: "קופת גמל להשקעה",
};

export default function PensionsPage() {
  const { addToast } = useToast();
  const [pensions, setPensions] = useState<PensionFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sendingLead, setSendingLead] = useState(false);

  const flaggedInsights = useMemo(() => {
    if (!pensions.length) return [];
    const perPlan = pensions.flatMap((p) => analyzePensionPlan(p as any));
    const portfolio = analyzePortfolio(pensions as any);
    return [...portfolio, ...perPlan].filter(
      (i) => i.severity === 'critical' || i.severity === 'warning',
    );
  }, [pensions]);

  const handleSendToAdvisor = async () => {
    setSendingLead(true);
    try {
      const res = await fetch('/api/leads/pensions', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        addToast({ title: data.error || 'שליחה נכשלה', type: 'error' });
      } else {
        addToast({ title: 'הפרטים נשלחו לסוכן במייל', type: 'success' });
      }
    } catch (e: any) {
      addToast({ title: 'שגיאה בשליחה', type: 'error' });
    } finally {
      setSendingLead(false);
    }
  };

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phi-dark mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper>
        <PageHeader
          title="חיסכון פנסיוני"
          subtitle="קופות גמל, קרן השתלמות, ביטוח מנהלים — מרכז אחד"
          action={
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-phi-dark hover:bg-phi-slate text-white"
            >
              <PlusCircle className="w-4 h-4 ml-2" />
              הוסף קרן חדשה
            </Button>
          }
        />

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <DSCard padding="lg">
              <div className="flex items-center gap-3 mb-2">
                <Briefcase className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-phi-slate">סה&quot;כ קרנות</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {summary.total_funds}
              </div>
            </DSCard>

            <DSCard padding="lg">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span className="text-sm text-phi-slate">יתרה כוללת</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                ₪{summary.total_balance?.toLocaleString("he-IL") || 0}
              </div>
            </DSCard>

            <DSCard padding="lg">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-phi-slate">הפקדה חודשית</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                ₪{summary.total_monthly_deposit?.toLocaleString("he-IL") || 0}
              </div>
            </DSCard>

            <DSCard padding="lg">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                <span className="text-sm text-phi-slate">תשואה ממוצעת</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {summary.average_return?.toFixed(2) || 0}%
              </div>
            </DSCard>
          </div>
        )}

        {/* Request Pension Report from Gadi */}
        <div className="mb-8" data-tour="pension-report">
          <RequestPensionReport />
        </div>

        {/* Advisor consultation CTA — only when concrete issues are detected */}
        {flaggedInsights.length > 0 && (
          <DSCard padding="lg" className="mb-8 border-2 border-amber-200 bg-amber-50">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-phi-coral" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  זוהו {flaggedInsights.length} סימני אזהרה בתיק שלך
                </h3>
                <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                  נמצאו דמי ניהול גבוהים, תשואות נמוכות, יתרות קטנות או הזדמנות לאיחוד קופות. שווה
                  להתייעץ עם סוכן פנסיוני — חיסכון של 0.3% בדמי ניהול שווה אלפי שקלים בעשור.
                </p>
                <ul className="text-xs text-gray-600 mb-4 space-y-1">
                  {flaggedInsights.slice(0, 3).map((ins, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-phi-coral">•</span>
                      <span><strong>{ins.title}</strong></span>
                    </li>
                  ))}
                  {flaggedInsights.length > 3 && (
                    <li className="text-gray-500 pr-3">ועוד {flaggedInsights.length - 3} נושאים נוספים…</li>
                  )}
                </ul>
                <Button
                  onClick={handleSendToAdvisor}
                  disabled={sendingLead}
                  className="bg-phi-coral hover:bg-phi-coral/90 text-white"
                >
                  {sendingLead ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 ml-2" />
                  )}
                  שלח פרטים לסוכן לקבלת ייעוץ
                </Button>
              </div>
            </div>
          </DSCard>
        )}

        {/* Pensions Table */}
        <DSCard padding="sm" className="overflow-hidden" data-tour="pension-list">
          {pensions.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-purple-100 rounded-full blur-3xl opacity-30 animate-pulse"></div>
                <Shield className="w-20 h-20 text-phi-dark mx-auto relative animate-bounce-slow" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                העתיד שלך מתחיל היום 🌟
              </h3>
              <p className="text-gray-600 mb-2 max-w-md mx-auto leading-relaxed">
                פנסיה זה לא רק חובה - זה ההשקעה החשובה ביותר שלך. בגיל 67 תודו לעצמכם של היום.
              </p>
              <p className="text-sm text-phi-slate mb-8 max-w-md mx-auto">
                הוסף את הקרנות הפנסיוניות שלך ובדוק שהן עובדות בשבילך נכון
              </p>
              <Button 
                onClick={() => setShowAddModal(true)}
                className="bg-phi-mint hover:bg-phi-mint/90 text-white shadow-lg hover:shadow-xl transition-all"
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
                    <tr
                      key={pension.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => window.location.href = `/dashboard/pensions/${pension.id}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-phi-dark hover:underline">
                          {pension.fund_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-phi-dark/10 text-phi-dark">
                          {FUND_TYPE_LABELS[pension.fund_type] || pension.fund_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {pension.provider}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-phi-mint tabular-nums">
                        ₪{pension.current_balance?.toLocaleString("he-IL") || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 tabular-nums">
                        ₪{pension.monthly_deposit?.toLocaleString("he-IL") || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 tabular-nums">
                        {pension.management_fee_percentage != null ? `${Number(pension.management_fee_percentage).toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {pension.annual_return != null ? (
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              pension.annual_return >= 5 ? "text-phi-mint"
                                : pension.annual_return >= 0 ? "text-phi-gold"
                                : "text-phi-coral"
                            }`}
                          >
                            {pension.annual_return >= 0 ? "+" : ""}
                            {Number(pension.annual_return).toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">אין נתון</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/dashboard/pensions/${pension.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-phi-gold hover:underline text-sm"
                        >
                          פתח →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DSCard>

        <DSCard padding="lg">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-phi-dark" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-0.5">טיפים חכמים לניהול חיסכון פנסיוני</h3>
              <p className="text-sm text-gray-500">כי בגיל 67 תרצו לחיות בכבוד</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              { title: 'הפרשה מינימום 18.5%', body: 'לפחות 17.5% לפנסיה + 6% לקרן השתלמות. זה הכרח' },
              { title: 'דמי ניהול חשובים', body: 'כל 0.1% זה אלפי שקלים על 30 שנה. מעל 0.5% — בדקו אלטרנטיבות זולות יותר' },
              { title: 'תשואה ארוכת טווח', body: 'תשואה שנתית ממוצעת של 4-6% לאורך זמן היא מצוינת. אל תרדפו אחרי תשואות גבוהות' },
              { title: 'בדקו פערי כיסוי', body: 'קרן פנסיה טובה כוללת גם ביטוח נכות וסיעוד. ודאו שזה קיים' },
            ].map((tip, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-phi-dark/10 text-phi-dark flex items-center justify-center text-xs font-bold mt-0.5">✓</span>
                <span className="leading-relaxed"><strong className="text-gray-900">{tip.title}</strong> — {tip.body}</span>
              </li>
            ))}
          </ul>
        </DSCard>

      {/* Add Pension Modal */}
      <AddPensionModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={fetchPensions}
      />
    </PageWrapper>
  );
}

