import Link from 'next/link';
import { TrendingDown, TrendingUp, Activity, Wallet } from 'lucide-react';

const reportPages = [
  { href: '/dashboard/budget', label: 'תקציב', icon: Wallet, description: 'תקציב חודשי — בפועל מול תכנון' },
  { href: '/dashboard/expenses', label: 'הוצאות', icon: TrendingDown, description: 'ניתוח הוצאות לפי קטגוריות' },
  { href: '/dashboard/income', label: 'הכנסות', icon: TrendingUp, description: 'סיכום מקורות הכנסה' },
  { href: '/dashboard/reports/cash-flow', label: 'תזרים מזומנים', icon: Activity, description: 'תחזית תזרים חודשית' },
];

export default function ReportsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">דוחות</h1>
        <p className="mt-2 text-gray-600">צפה בניתוח מפורט של המצב הפיננסי שלך</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {reportPages.map((page) => {
          const Icon = page.icon;
          return (
            <Link key={page.href} href={page.href}>
              <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#3A7BD5] to-[#7ED957] rounded-lg flex items-center justify-center">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-[#1E2A3B]">{page.label}</h2>
                </div>
                <p className="text-sm text-gray-500">{page.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
