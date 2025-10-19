"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Target } from "lucide-react";
import { InfoTooltip } from "../ui/info-tooltip";

export function NetWorthCard() {
  const [netWorth, setNetWorth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNetWorth();
  }, []);

  const fetchNetWorth = async () => {
    try {
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
      <div className="bg-card-dark rounded-2xl shadow-xl p-6 border border-gray-800 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-10 bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  const assets = (netWorth?.savings_total || 0) + (netWorth?.investments_total || 0) + (netWorth?.pension_total || 0);
  const liabilities = (netWorth?.loans_total || 0) + (netWorth?.debt_total || 0);
  const netWorthValue = netWorth?.net_worth || (assets - liabilities);
  const isPositive = netWorthValue >= 0;

  return (
    <div className="bg-card-dark rounded-2xl shadow-xl p-6 border border-gray-800 card-hover relative overflow-hidden">
      {/* Glow Effect */}
      <div className={`absolute top-0 right-0 w-32 h-32 ${isPositive ? 'bg-gradient-to-br from-blue-500/10 to-indigo-500/5' : 'bg-gradient-to-br from-orange-500/10 to-amber-500/5'} rounded-full blur-3xl`}></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl ${isPositive ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-orange-500 to-amber-600'} flex items-center justify-center`}>
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">שווי נטו</h3>
              <p className="text-xs text-gray-400">נכסים מינוס חובות</p>
            </div>
          </div>
          {isPositive ? (
            <TrendingUp className="w-6 h-6 text-green-400" />
          ) : (
            <TrendingDown className="w-6 h-6 text-red-400" />
          )}
        </div>

        <div className="mb-6 text-center py-2">
          <div className={`text-4xl font-black ${isPositive ? "text-green-400" : "text-red-400"}`}>
            {isPositive ? "+" : ""}₪{Math.abs(netWorthValue).toLocaleString("he-IL")}
          </div>
          <p className="text-sm text-gray-400 mt-2">
            {isPositive ? "מצב פיננסי חיובי 💪" : "יש עבודה לעשות - אבל אפשר!"}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center pb-3 border-b border-gray-700">
            <span className="text-sm text-gray-400">נכסים כוללים:</span>
            <span className="text-sm font-bold text-green-400">
              ₪{assets.toLocaleString("he-IL")}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">חובות כוללים:</span>
            <span className="text-sm font-bold text-red-400">
              ₪{liabilities.toLocaleString("he-IL")}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div
              className={`h-3 rounded-full ${isPositive ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}
              style={{
                width: `${Math.min(Math.max((assets / (assets + liabilities)) * 100, 5), 95)}%`,
              }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>חובות</span>
            <span>נכסים</span>
          </div>
        </div>
      </div>
    </div>
  );
}

