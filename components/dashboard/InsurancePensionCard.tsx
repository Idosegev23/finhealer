"use client";

import { useEffect, useState } from "react";
import { Shield, AlertTriangle } from "lucide-react";
import { InfoTooltip } from "../ui/info-tooltip";
import { Button } from "../ui/button";
import Link from "next/link";

export function InsurancePensionCard() {
  const [insurance, setInsurance] = useState<any[]>([]);
  const [pensions, setPensions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [insRes, penRes] = await Promise.all([
        fetch("/api/insurance"),
        fetch("/api/pensions"),
      ]);

      if (insRes.ok) {
        const insData = await insRes.json();
        setInsurance(insData.data || []);
      }

      if (penRes.ok) {
        const penData = await penRes.json();
        setPensions(penData.data || []);
      }
    } catch (error) {
      console.error("Error fetching insurance/pensions:", error);
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

  const insuranceMonthly = insurance.reduce(
    (sum, ins) => sum + (ins.monthly_premium || 0),
    0
  );
  const pensionBalance = pensions.reduce(
    (sum, pen) => sum + (pen.current_balance || 0),
    0
  );

  const requiredInsurances = ["life", "health", "critical_illness"];
  const missingInsurances = requiredInsurances.filter(
    (type) => !insurance.some((ins) => ins.insurance_type === type)
  );

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">ביטוח ופנסיה</h3>
          <InfoTooltip
            content="סטטוס כיסויי הביטוח שלך ויתרת החיסכון הפנסיוני"
            type="info"
          />
        </div>
        {missingInsurances.length > 0 && (
          <AlertTriangle className="w-5 h-5 text-orange-500" />
        )}
      </div>

      <div className="space-y-4">
        {/* Insurance */}
        <div className="pb-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">🛡️ ביטוחים:</span>
            <span className="text-sm font-semibold text-gray-900">
              {insurance.length} פוליסות
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">פרמיה חודשית:</span>
            <span className="text-sm font-semibold text-blue-600">
              ₪{insuranceMonthly.toLocaleString("he-IL")}
            </span>
          </div>
          {missingInsurances.length > 0 && (
            <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded p-2">
              <p className="text-xs text-yellow-800">
                ⚠️ חסרים {missingInsurances.length} ביטוחים חשובים
              </p>
            </div>
          )}
        </div>

        {/* Pension */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">💰 פנסיה:</span>
            <span className="text-sm font-semibold text-gray-900">
              {pensions.length} קרנות
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">יתרה כוללת:</span>
            <span className="text-sm font-semibold text-green-600">
              ₪{pensionBalance.toLocaleString("he-IL")}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <Link href="/dashboard/insurance">
          <Button variant="outline" size="sm" className="w-full">
            ביטוחים
          </Button>
        </Link>
        <Link href="/dashboard/pensions">
          <Button variant="outline" size="sm" className="w-full">
            פנסיה
          </Button>
        </Link>
      </div>
    </div>
  );
}

