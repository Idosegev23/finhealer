'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { PageWrapper, PageHeader, Card } from '@/components/ui/design-system';

export default function InvestmentsDataPage() {
  return (
    <PageWrapper maxWidth="narrow">
      <PageHeader title="השקעות" subtitle="נהל את תיק ההשקעות שלך" />
      <Card padding="lg">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-phi-mint" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">ניהול השקעות</h3>
            <p className="text-sm text-gray-500">מניות, אגרות חוב, קרנות נאמנות, קריפטו ועוד</p>
          </div>
        </div>
        <Link href="/dashboard/investments">
          <Button className="w-full bg-phi-dark hover:bg-phi-slate text-white">
            <ArrowRight className="w-4 h-4 ml-2" />
            עבור לדף השקעות
          </Button>
        </Link>
      </Card>
    </PageWrapper>
  );
}
