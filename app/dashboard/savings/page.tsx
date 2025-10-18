"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, PiggyBank, Target, TrendingUp, Calendar } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { DashboardNav } from "@/components/shared/DashboardNav";
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
}

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
                <PiggyBank className="w-8 h-8 text-[#7ED957]" />
                חשבונות חיסכון
                <InfoTooltip
                  content="כאן תוכל לנהל את כל חשבונות החיסכון שלך - קופות חירום, פיקדונות, השקעות ויעדי חיסכון"
                  type="info"
                />
              </h1>
              <p className="text-gray-600 mt-2">ניהול מרכזי של כל החיסכונות שלך</p>
            </div>
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-[#7ED957] hover:bg-[#6BC949] text-white"
            >
              <PlusCircle className="w-4 h-4 ml-2" />
              הוסף חשבון חיסכון
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <PiggyBank className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-gray-600">סה&quot;כ חשבונות</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {summary.total_accounts}
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
                <Calendar className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-gray-600">הפקדה חודשית</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                ₪{summary.total_monthly_deposit?.toLocaleString("he-IL") || 0}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-orange-500" />
                <span className="text-sm text-gray-600">התקדמות ליעד</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {summary.progress_percentage?.toFixed(1) || 0}%
              </div>
            </div>
          </div>
        )}

        {/* Savings Cards Grid */}
        {savings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm text-center py-16 animate-fade-in">
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-green-100 rounded-full blur-3xl opacity-30 animate-pulse"></div>
              <PiggyBank className="w-20 h-20 text-[#7ED957] mx-auto relative animate-bounce-slow" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              בואו נתחיל לחסוך יחד 💰
            </h3>
            <p className="text-gray-600 mb-2 max-w-md mx-auto leading-relaxed">
              חיסכון זה לא על לוותר - זה על לתכנן נכון. כל שקל שתחסוך עכשיו עובד בשבילך בעתיד.
            </p>
            <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
              הגדר חשבונות חיסכון עם יעדים ברורים ותראה את הכסף גדל
            </p>
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-[#7ED957] hover:bg-[#6BC949] text-white shadow-lg hover:shadow-xl transition-all"
            >
              <PlusCircle className="w-4 h-4 ml-2" />
              פתח חשבון חיסכון ראשון
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savings.map((account) => {
              const typeInfo = ACCOUNT_TYPE_LABELS[account.account_type];
              const Icon = typeInfo?.icon || PiggyBank;
              const progress = account.target_amount
                ? (account.current_balance / account.target_amount) * 100
                : 0;

              return (
                <div
                  key={account.id}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg bg-${typeInfo?.color}-100`}>
                        <Icon className={`w-6 h-6 text-${typeInfo?.color}-600`} />
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
                      <span className="text-lg font-bold text-green-600">
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
                        <span className="text-sm font-semibold text-blue-600">
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
                          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div
                              className={`h-2 rounded-full ${
                                progress >= 100
                                  ? "bg-green-500"
                                  : progress >= 75
                                  ? "bg-blue-500"
                                  : progress >= 50
                                  ? "bg-yellow-500"
                                  : "bg-orange-500"
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

                        {account.goal_name && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <Target className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-medium text-blue-900">
                                {account.goal_name}
                              </span>
                            </div>
                            {account.target_date && (
                              <div className="text-xs text-blue-700 mt-1">
                                יעד: {new Date(account.target_date).toLocaleDateString("he-IL")}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
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
        <div className="mt-8 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 shadow-sm animate-slide-up">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-green-900 mb-1">
                טיפים לחיסכון חכם ואפקטיבי
              </h3>
              <p className="text-sm text-green-700">
                כי כל שקל היום שווה יותר מחר
              </p>
            </div>
          </div>
          <ul className="space-y-3 text-sm text-green-800">
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-green-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>קופת חירום קודם כל</strong> - שמרו 3-6 חודשים של הוצאות במזומן נזיל. זה הביטחון שלכם לכל מקרה
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-green-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>הפקדות אוטומטיות</strong> - קבעו העברה אוטומטית ביום השכר. ככה החיסכון קורה ממילא, בלי מאמץ
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-green-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>פיזור סיכונים</strong> - חלקו את הכסף: חלק בחיסכון בטוח, חלק בהשקעות. אל תשימו הכל בסל אחד
              </span>
            </li>
            <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-green-500 font-bold">✓</span>
              <span className="leading-relaxed">
                <strong>ריבית דריבית היא הקסם</strong> - התחלה ב-25? עד 65 תהיו מיליונרים. התחלה ב-35? חצי מיליון. התחילו היום!
              </span>
            </li>
          </ul>
        </div>
        </div>
      </div>

      {/* Add Savings Modal */}
      <AddSavingsModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={fetchSavings}
      />
    </>
  );
}
