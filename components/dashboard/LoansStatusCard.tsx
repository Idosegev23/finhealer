"use client";

import { useEffect, useState } from "react";
import { DollarSign, AlertCircle } from "lucide-react";
import { InfoTooltip } from "../ui/info-tooltip";
import { Button } from "../ui/button";
import Link from "next/link";

export function LoansStatusCard() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      const res = await fetch("/api/loans");
      if (res.ok) {
        const json = await res.json();
        setLoans(Array.isArray(json) ? json : json.data || []);
      }
    } catch (error) {
      console.error("Error fetching loans:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  const totals = loans.reduce(
    (acc, loan) => ({
      balance: acc.balance + (loan.current_balance || 0),
      monthly: acc.monthly + (loan.monthly_payment || 0),
    }),
    { balance: 0, monthly: 0 }
  );

  const avgInterest =
    loans.length > 0
      ? loans.reduce((sum, l) => sum + (l.interest_rate || 0), 0) / loans.length
      : 0;

  if (loans.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">הלוואות</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">אין הלוואות רשומות</p>
        <Link href="/dashboard/loans">
          <Button variant="outline" size="sm" className="w-full">
            נהל הלוואות
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">הלוואות</h3>
          <InfoTooltip
            content="סטטוס כל ההלוואות שלך - יתרות, תשלומים חודשיים וריבית ממוצעת"
            type="info"
          />
        </div>
        {avgInterest > 6 && (
          <AlertCircle className="w-5 h-5 text-orange-500" />
        )}
      </div>

      <div className="space-y-4 mb-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">יתרת חוב:</span>
            <span className="text-lg font-bold text-red-600">
              ₪{totals.balance.toLocaleString("he-IL")}
            </span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">תשלום חודשי:</span>
            <span className="text-md font-semibold text-orange-600">
              ₪{totals.monthly.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">ריבית ממוצעת:</span>
            <span
              className={`text-md font-semibold ${
                avgInterest > 8 ? "text-red-600" : avgInterest > 6 ? "text-orange-600" : "text-green-600"
              }`}
            >
              {avgInterest.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {avgInterest > 6 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-orange-800">
            💡 הריבית הממוצעת גבוהה - שקול איחוד הלוואות
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Link href="/dashboard/loans" className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            נהל
          </Button>
        </Link>
        {loans.length > 1 && (
          <Link href="/loans-simulator" className="flex-1">
            <Button size="sm" className="w-full bg-phi-mint hover:bg-phi-mint/90">
              סימולטור
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

