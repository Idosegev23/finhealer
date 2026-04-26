'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Building, ArrowRight } from 'lucide-react';
import { PageWrapper, PageHeader, Card } from '@/components/ui/design-system';

export default function PensionsDataPage() {
  return (
    <PageWrapper maxWidth="narrow">
      <PageHeader title="פנסיה" subtitle="נהל את החיסכון הפנסיוני שלך" />
      <Card padding="lg">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-phi-dark/10 flex items-center justify-center flex-shrink-0">
            <Building className="w-5 h-5 text-phi-dark" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">ניהול פנסיה</h3>
            <p className="text-sm text-gray-500">קרנות פנסיה, קופות גמל, קרנות השתלמות וביטוח מנהלים</p>
          </div>
        </div>
        <Link href="/dashboard/pensions">
          <Button className="w-full bg-phi-dark hover:bg-phi-slate text-white">
            <ArrowRight className="w-4 h-4 ml-2" />
            עבור לדף פנסיה
          </Button>
        </Link>
      </Card>
    </PageWrapper>
  );
}
