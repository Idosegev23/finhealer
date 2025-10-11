'use client';

import { AlertCircle, TrendingUp } from 'lucide-react';

interface DebtVsAssetsProps {
  profile: any;
}

export default function DebtVsAssets({ profile }: DebtVsAssetsProps) {
  const totalDebt = profile?.total_debt || 0;
  const totalAssets = (profile?.current_savings || 0) + (profile?.investments || 0);
  const netWorth = totalAssets - totalDebt;

  const maxValue = Math.max(totalDebt, totalAssets) || 1;
  const debtPercentage = (totalDebt / maxValue) * 100;
  const assetsPercentage = (totalAssets / maxValue) * 100;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-[#1E2A3B] mb-4">חובות ונכסים</h3>

      <div className="space-y-4">
        {/* חובות */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#D64541]" />
              <span className="text-sm font-medium text-[#555555]">חובות</span>
            </div>
            <span className="text-lg font-bold text-[#D64541]">
              {totalDebt.toLocaleString('he-IL')} ₪
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div 
              className="bg-[#D64541] h-3 rounded-full transition-all duration-500"
              style={{ width: `${debtPercentage}%` }}
            />
          </div>
          {profile?.credit_card_debt > 0 && (
            <p className="text-xs text-[#555555] mt-1">
              כולל {profile.credit_card_debt.toLocaleString('he-IL')} ₪ כרטיסי אשראי
            </p>
          )}
        </div>

        {/* נכסים */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#7ED957]" />
              <span className="text-sm font-medium text-[#555555]">נכסים נזילים</span>
            </div>
            <span className="text-lg font-bold text-[#7ED957]">
              {totalAssets.toLocaleString('he-IL')} ₪
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div 
              className="bg-[#7ED957] h-3 rounded-full transition-all duration-500"
              style={{ width: `${assetsPercentage}%` }}
            />
          </div>
          {profile?.current_savings > 0 && (
            <p className="text-xs text-[#555555] mt-1">
              כולל {profile.current_savings.toLocaleString('he-IL')} ₪ חיסכון
            </p>
          )}
        </div>

        {/* קו הפרדה */}
        <div className="border-t border-gray-200 my-3"></div>

        {/* מאזן */}
        <div className={`p-4 rounded-lg ${netWorth >= 0 ? 'bg-[#E8F5E9]' : 'bg-[#FFEBEE]'}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#555555]">מאזן נכסים - חובות</span>
            <span className={`text-2xl font-bold ${netWorth >= 0 ? 'text-[#7ED957]' : 'text-[#D64541]'}`}>
              {netWorth >= 0 ? '+' : ''}{netWorth.toLocaleString('he-IL')} ₪
            </span>
          </div>
        </div>

        {/* בעלות */}
        {(profile?.owns_home || profile?.owns_car) && (
          <div className="flex gap-2 mt-3">
            {profile.owns_home && (
              <div className="flex-1 p-2 bg-[#F5F6F8] rounded-lg text-center">
                <p className="text-xs text-[#555555]">🏠 דירה בבעלות</p>
              </div>
            )}
            {profile.owns_car && (
              <div className="flex-1 p-2 bg-[#F5F6F8] rounded-lg text-center">
                <p className="text-xs text-[#555555]">🚗 רכב בבעלות</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


