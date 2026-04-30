import Link from 'next/link';
import { TrendingDown, TrendingUp, Activity, Wallet } from 'lucide-react';
import { PageWrapper, PageHeader, Card } from '@/components/ui/design-system';

const reportPages = [
  { href: '/dashboard/budget', label: 'תקציב', icon: Wallet, description: 'תקציב חודשי — בפועל מול תכנון' },
  { href: '/dashboard/expenses', label: 'הוצאות', icon: TrendingDown, description: 'ניתוח הוצאות לפי קטגוריות' },
  { href: '/dashboard/income', label: 'הכנסות', icon: TrendingUp, description: 'סיכום מקורות הכנסה' },
  { href: '/dashboard/reports/cash-flow', label: 'תזרים מזומנים', icon: Activity, description: 'תחזית תזרים חודשית' },
];

export default function ReportsPage() {
  return (
    <PageWrapper maxWidth="narrow">
      <PageHeader title="דוחות" subtitle="ניתוח מפורט של המצב הפיננסי שלך" />
      <div data-tour="reports-grid" className="grid md:grid-cols-2 gap-4">
        {reportPages.map((page) => {
          const Icon = page.icon;
          const isCashFlow = page.label === 'תזרים מזומנים';
          return (
            <Link key={page.href} href={page.href} className="block group">
              {isCashFlow ? (
                <div data-tour="reports-cashflow">
                  <Card hover className="h-full">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-phi-dark group-hover:bg-phi-slate transition-colors rounded-lg flex items-center justify-center">
                        <Icon className="h-5 w-5 text-phi-gold" />
                      </div>
                      <h2 className="text-lg font-bold text-gray-900">{page.label}</h2>
                    </div>
                    <p className="text-sm text-gray-500">{page.description}</p>
                  </Card>
                </div>
              ) : (
                <Card hover className="h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-phi-dark group-hover:bg-phi-slate transition-colors rounded-lg flex items-center justify-center">
                      <Icon className="h-5 w-5 text-phi-gold" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">{page.label}</h2>
                  </div>
                  <p className="text-sm text-gray-500">{page.description}</p>
                </Card>
              )}
            </Link>
          );
        })}
      </div>
    </PageWrapper>
  );
}
