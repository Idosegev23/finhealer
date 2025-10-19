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
        // תיקון: הנתונים מגיעים ב-data.profile
        const balance = data.profile?.current_account_balance || data.current_account_balance || 0;
        setAccountBalance(Number(balance));
      }
    } catch (error) {
      console.error("Error fetching account balance:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card-dark rounded-2xl shadow-xl p-6 border border-gray-800 animate-pulse">
        <div className="h-6 bg-gray-700 rounded mb-4 w-1/2"></div>
        <div className="h-10 bg-gray-700 rounded"></div>
      </div>
    );
  }

  const balance = accountBalance || 0;
  const isPositive = balance >= 0;

  return (
    <div className="bg-card-dark rounded-2xl shadow-xl p-6 border border-gray-800 card-hover relative overflow-hidden">
      {/* Glow Effect */}
      <div className={`absolute top-0 right-0 w-32 h-32 ${isPositive ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/5' : 'bg-gradient-to-br from-red-500/10 to-rose-500/5'} rounded-full blur-3xl`}></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-xl ${isPositive ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'} flex items-center justify-center shadow-lg`}>
              <Wallet className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">מצב חשבון עו&quot;ש</h3>
              <p className="text-sm text-gray-400">יתרה נוכחית</p>
            </div>
          </div>
          {isPositive ? (
            <TrendingUp className="w-7 h-7 text-green-400" />
          ) : (
            <TrendingDown className="w-7 h-7 text-red-400" />
          )}
        </div>

        <div className="text-center py-4">
          <p className={`text-5xl font-black ${isPositive ? "text-green-400" : "text-red-400"}`}>
            {isPositive ? "+" : ""}
            ₪{Math.abs(balance).toLocaleString("he-IL")}
          </p>
          <p className="text-sm text-gray-400 mt-3">
            {isPositive ? "החשבון שלך במצב חיובי 👍" : "חשוב לפקח על המינוס ⚠️"}
          </p>
        </div>

        {!isPositive && balance < -1000 && (
          <div className="mt-4 bg-red-900/20 border border-red-800/50 rounded-xl p-4">
            <p className="text-sm text-red-400">
              💡 <strong className="text-red-300">המלצה:</strong> נסה להעביר כסף מחסכון או להפחית הוצאות
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

