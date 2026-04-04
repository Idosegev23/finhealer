'use client';

import FinancialSummaryTable from '@/components/dashboard/FinancialSummaryTable';
import { TableProperties } from 'lucide-react';
import Link from 'next/link';

export default function FinancialTablePage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8" dir="rtl">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#074259] rounded-xl flex items-center justify-center">
              <TableProperties className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">טבלה פיננסית</h1>
              <p className="text-sm text-gray-500">סיכום מלא — הכנסות, הוצאות, קבועות, משתנות, מיוחדות</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-[#074259] hover:underline"
          >
            חזרה לדשבורד
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto">
        <FinancialSummaryTable />
      </div>
    </div>
  );
}
