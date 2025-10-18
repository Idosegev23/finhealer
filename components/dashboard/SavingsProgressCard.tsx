"use client";

import { useEffect, useState } from "react";
import { PiggyBank, TrendingUp } from "lucide-react";
import { InfoTooltip } from "../ui/info-tooltip";
import { Button } from "../ui/button";
import Link from "next/link";

export function SavingsProgressCard() {
  const [savings, setSavings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSavings();
  }, []);

  const fetchSavings = async () => {
    try {
      const res = await fetch("/api/savings");
      if (res.ok) {
        const data = await res.json();
        setSavings(data.data || []);
        setSummary(data.summary || {});
      }
    } catch (error) {
      console.error("Error fetching savings:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (savings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <PiggyBank className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">חיסכון</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">אין חשבונות חיסכון רשומים</p>
        <Link href="/dashboard/savings">
          <Button variant="outline" size="sm" className="w-full">
            התחל לחסוך
          </Button>
        </Link>
      </div>
    );
  }

  const progress = summary?.progress_percentage || 0;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">חיסכון</h3>
          <InfoTooltip
            content="התקדמות יעדי החיסכון שלך ויתרות נוכחיות"
            type="info"
          />
        </div>
        <TrendingUp className="w-5 h-5 text-green-500" />
      </div>

      <div className="space-y-4 mb-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">יתרה כוללת:</span>
            <span className="text-lg font-bold text-green-600">
              ₪{summary?.total_balance?.toLocaleString("he-IL") || 0}
            </span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">הפקדה חודשית:</span>
            <span className="text-md font-semibold text-blue-600">
              ₪{summary?.total_monthly_deposit?.toLocaleString("he-IL") || 0}
            </span>
          </div>
        </div>

        {summary?.total_target > 0 && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">התקדמות ליעד:</span>
              <span className="text-md font-semibold text-purple-600">
                {progress.toFixed(1)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${
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
          </div>
        )}

        {summary?.average_return > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-green-700">תשואה ממוצעת:</span>
              <span className="text-sm font-bold text-green-800">
                {summary.average_return.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>

      <Link href="/dashboard/savings">
        <Button variant="outline" size="sm" className="w-full">
          נהל חיסכון
        </Button>
      </Link>
    </div>
  );
}

