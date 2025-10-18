"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { InfoTooltip } from "../ui/info-tooltip";

export function NetWorthCard() {
  const [netWorth, setNetWorth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNetWorth();
  }, []);

  const fetchNetWorth = async () => {
    try {
      // Call the calculate_net_worth function via Supabase
      const res = await fetch("/api/financial-summary");
      if (res.ok) {
        const data = await res.json();
        setNetWorth(data);
      }
    } catch (error) {
      console.error("Error fetching net worth:", error);
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

  const assets = (netWorth?.savings_total || 0) + (netWorth?.investments_total || 0) + (netWorth?.pension_total || 0);
  const liabilities = (netWorth?.loans_total || 0) + (netWorth?.debt_total || 0);
  const netWorthValue = assets - liabilities;
  const isPositive = netWorthValue >= 0;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">שווי נטו</h3>
          <InfoTooltip
            content="שווי נטו = סך כל הנכסים פחות סך כל החובות. זה המדד העיקרי למצב הפיננסי שלך."
            type="info"
          />
        </div>
        {isPositive ? (
          <TrendingUp className="w-6 h-6 text-green-500" />
        ) : (
          <TrendingDown className="w-6 h-6 text-red-500" />
        )}
      </div>

      <div className="mb-6">
        <div
          className={`text-3xl font-bold ${
            isPositive ? "text-green-600" : "text-red-600"
          }`}
        >
          {isPositive ? "+" : ""}₪{Math.abs(netWorthValue).toLocaleString("he-IL")}
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {isPositive
            ? "מצב פיננסי חיובי 💪"
            : "יש עבודה לעשות - אבל אפשר!"}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center pb-3 border-b border-gray-200">
          <span className="text-sm text-gray-600">נכסים כוללים:</span>
          <span className="text-sm font-semibold text-green-600">
            ₪{assets.toLocaleString("he-IL")}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">חובות כוללים:</span>
          <span className="text-sm font-semibold text-red-600">
            ₪{liabilities.toLocaleString("he-IL")}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full ${
              isPositive ? "bg-green-500" : "bg-red-500"
            }`}
            style={{
              width: `${Math.min(
                Math.max((assets / (assets + liabilities)) * 100, 5),
                95
              )}%`,
            }}
          ></div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>חובות</span>
          <span>נכסים</span>
        </div>
      </div>
    </div>
  );
}

