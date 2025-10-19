"use client";

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";

export function CurrentAccountCard() {
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccountBalance();
  }, []);

  const fetchAccountBalance = async () => {
    try {
      // מביא את המצב מה-profile
      const res = await fetch("/api/reflection/profile");
      if (res.ok) {
        const data = await res.json();
        setAccountBalance(data.current_account_balance || 0);
      }
    } catch (error) {
      console.error("Error fetching account balance:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 animate-pulse">
        <div className="h-6 bg-gray-200 rounded mb-4 w-1/2"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  const balance = accountBalance || 0;
  const isPositive = balance >= 0;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-md p-6 border-2 border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">מצב חשבון עו&quot;ש</h3>
            <p className="text-sm text-gray-600">יתרה נוכחית</p>
          </div>
        </div>
        {isPositive ? (
          <TrendingUp className="w-6 h-6 text-green-600" />
        ) : (
          <TrendingDown className="w-6 h-6 text-red-600" />
        )}
      </div>

      <div className="text-center py-4">
        <p
          className={`text-4xl font-bold ${
            isPositive ? "text-green-600" : "text-red-600"
          }`}
        >
          {isPositive ? "+" : ""}
          ₪{Math.abs(balance).toLocaleString("he-IL")}
        </p>
        <p className="text-sm text-gray-600 mt-2">
          {isPositive ? "החשבון שלך במצב חיובי 👍" : "חשוב לפקח על המינוס"}
        </p>
      </div>

      {!isPositive && balance < -1000 && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">
            💡 <strong>המלצה:</strong> נסה להעביר כסף מחסכון או להפחית הוצאות
          </p>
        </div>
      )}
    </div>
  );
}

