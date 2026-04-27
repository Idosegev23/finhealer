"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, PiggyBank, Target, TrendingUp, Calendar } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Card as DSCard, PageWrapper, PageHeader } from '@/components/ui/design-system';
import { AddSavingsModal } from "@/components/savings/AddSavingsModal";

interface SavingsAccount {
  id: string;
  account_name: string;
  account_type: string;
  bank_name: string;
  current_balance: number;
  monthly_deposit: number;
  annual_return: number;
  target_amount: number;
  goal_name: string;
  target_date: string;
  goal_id?: string | null;
  goal?: { id: string; goal_name: string; target_amount: number } | null;
}

// Brand-only color tokens for account-type icons. Each "color" maps to a
// phi palette pair (icon background + icon foreground). No raw rainbow.
const COLOR_CLASSES: Record<string, { bg: string; text: string }> = {
  blue:   { bg: "bg-sky-50",     text: "text-phi-dark" },
  green:  { bg: "bg-emerald-50", text: "text-phi-mint" },
  purple: { bg: "bg-phi-dark/10", text: "text-phi-dark" },
  red:    { bg: "bg-red-50",     text: "text-phi-coral" },
  orange: { bg: "bg-amber-50",   text: "text-phi-gold" },
  gray:   { bg: "bg-gray-50",    text: "text-phi-slate" },
};

const ACCOUNT_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  savings: { label: "חיסכון", icon: PiggyBank, color: "blue" },
  deposit: { label: "פיקדון", icon: TrendingUp, color: "green" },
  investment: { label: "השקעה", icon: TrendingUp, color: "purple" },
  emergency_fund: { label: "קופת חירום", icon: Target, color: "red" },
  goal_based: { label: "יעד מסוים", icon: Target, color: "orange" },
  other: { label: "אחר", icon: PiggyBank, color: "gray" },
};

export default function SavingsPage() {
  const [savings, setSavings] = useState<SavingsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchSavings();
  }, []);

  const fetchSavings = async () => {
    try {
      const res = await fetch("/api/savings");
      const json = await res.json();
      setSavings(json.data || []);
      setSummary(json.summary || {});
    } catch (error) {
      console.error("Error fetching savings:", error);
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
    <PageWrapper maxWidth="wide">
        {/* Header */}
        <PageHeader
          title="חשבונות חיסכון"
          subtitle="ניהול מרכזי של כל החיסכונות שלך"
          action={
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-phi-mint hover:bg-phi-mint/90 text-white"
            >
              <PlusCircle className="w-4 h-4 ml-2" />
              הוסף חשבון חיסכון
            </Button>
          }
        />

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <DSCard padding="lg">
              <div className="flex items-center gap-3 mb-2">
                <PiggyBank className="w-5 h-5 text-phi-dark" />
                <span className="text-sm text-phi-slate">סה&quot;כ חשבונות</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">
                {summary.total_accounts}
              </div>
            </DSCard>

            <DSCard padding="lg">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-phi-mint" />
                <span className="text-sm text-phi-slate">יתרה כוללת</span>
              </div>
              <div className="text-2xl font-bold text-phi-mint tabular-nums">
                ₪{summary.total_balance?.toLocaleString("he-IL") || 0}
              </div>
            </DSCard>

            <DSCard padding="lg">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-phi-dark" />
                <span className="text-sm text-phi-slate">הפקדה חודשית</span>
              </div>
              <div className="text-2xl font-bold text-phi-dark tabular-nums">
                ₪{summary.total_monthly_deposit?.toLocaleString("he-IL") || 0}
              </div>
            </DSCard>

            <DSCard padding="lg">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-phi-gold" />
                <span className="text-sm text-phi-slate">התקדמות ליעד</span>
              </div>
              <div className="text-2xl font-bold text-phi-gold">
                {summary.progress_percentage?.toFixed(1) || 0}%
              </div>
            </DSCard>
          </div>
        )}

        {/* Savings Cards Grid */}
        {savings.length === 0 ? (
          <DSCard className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <PiggyBank className="w-8 h-8 text-phi-mint" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              בואו נתחיל לחסוך יחד
            </h3>
            <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
              חיסכון זה לא על לוותר — זה על לתכנן נכון. כל שקל שתחסוך עכשיו עובד בשבילך בעתיד.
            </p>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-phi-dark hover:bg-phi-slate text-white"
            >
              <PlusCircle className="w-4 h-4 ml-2" />
              פתח חשבון חיסכון ראשון
            </Button>
          </DSCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savings.map((account) => {
              const typeInfo = ACCOUNT_TYPE_LABELS[account.account_type];
              const Icon = typeInfo?.icon || PiggyBank;
              const colorClass = COLOR_CLASSES[typeInfo?.color || "gray"] || COLOR_CLASSES.gray;
              const progress = account.target_amount
                ? (account.current_balance / account.target_amount) * 100
                : 0;

              return (
                <DSCard
                  key={account.id}
                  padding="lg"
                  hover
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${colorClass.bg}`}>
                        <Icon className={`w-6 h-6 ${colorClass.text}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {account.account_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {typeInfo?.label || account.account_type}
                        </p>
                      </div>
                    </div>
                  </div>

                  {account.bank_name && (
                    <div className="mb-4 text-sm text-gray-600">
                      🏦 {account.bank_name}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">יתרה נוכחית:</span>
                      <span className="text-lg font-bold text-phi-mint tabular-nums">
                        ₪{account.current_balance?.toLocaleString("he-IL") || 0}
                      </span>
                    </div>

                    {account.monthly_deposit > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">הפקדה חודשית:</span>
                        <span className="text-sm font-medium text-gray-900">
                          ₪{account.monthly_deposit?.toLocaleString("he-IL") || 0}
                        </span>
                      </div>
                    )}

                    {account.annual_return > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">תשואה שנתית:</span>
                        <span className="text-sm font-semibold text-phi-dark tabular-nums">
                          {account.annual_return}%
                        </span>
                      </div>
                    )}

                    {account.target_amount > 0 && (
                      <>
                        <div className="pt-3 border-t border-gray-200">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">יעד:</span>
                            <span className="text-sm font-medium text-gray-900">
                              ₪{account.target_amount?.toLocaleString("he-IL")}
                            </span>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                progress >= 100 ? "bg-phi-mint"
                                  : progress >= 75 ? "bg-phi-mint"
                                  : progress >= 50 ? "bg-phi-gold"
                                  : "bg-phi-coral"
                              }`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            ></div>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">התקדמות</span>
                            <span className="text-xs font-semibold text-gray-700">
                              {progress.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {(account.goal?.goal_name || account.goal_name) && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <Target className="w-4 h-4 text-phi-gold" />
                              <span className="text-sm font-medium text-amber-900">
                                {account.goal?.goal_name || account.goal_name}
                              </span>
                              {account.goal?.goal_name && (
                                <span className="text-[10px] bg-phi-gold/20 text-phi-coral px-2 py-0.5 rounded">
                                  מקושר ליעד
                                </span>
                              )}
                            </div>
                            {account.target_date && (
                              <div className="text-xs text-amber-800/70 mt-1">
                                יעד: {new Date(account.target_date).toLocaleDateString("he-IL")}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                </DSCard>
              );
            })}
          </div>
        )}

        {/* Info Section */}
        <DSCard padding="lg">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <PiggyBank className="w-5 h-5 text-phi-mint" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-0.5">טיפים לחיסכון חכם</h3>
              <p className="text-sm text-gray-500">כי כל שקל היום שווה יותר מחר</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              { title: 'קופת חירום קודם כל', body: 'שמרו 3-6 חודשים של הוצאות במזומן נזיל. זה הביטחון שלכם לכל מקרה' },
              { title: 'הפקדות אוטומטיות', body: 'קבעו העברה אוטומטית ביום השכר. ככה החיסכון קורה ממילא, בלי מאמץ' },
              { title: 'פיזור סיכונים', body: 'חלקו את הכסף — חלק בחיסכון בטוח, חלק בהשקעות. אל תשימו הכל בסל אחד' },
              { title: 'ריבית דריבית היא הקסם', body: 'התחלה ב-25 ועד 65 תהיו מיליונרים. התחלה ב-35? חצי מיליון. התחילו היום' },
            ].map((tip, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-phi-mint/15 text-phi-mint flex items-center justify-center text-xs font-bold mt-0.5">✓</span>
                <span className="leading-relaxed"><strong className="text-gray-900">{tip.title}</strong> — {tip.body}</span>
              </li>
            ))}
          </ul>
        </DSCard>

      {/* Add Savings Modal */}
      <AddSavingsModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={fetchSavings}
      />
    </PageWrapper>
  );
}
