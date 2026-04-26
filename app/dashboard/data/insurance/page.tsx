'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Shield, ArrowRight } from 'lucide-react';
import { PageWrapper, PageHeader, Card } from '@/components/ui/design-system';

export default function InsuranceDataPage() {
  return (
    <PageWrapper maxWidth="narrow">
      <PageHeader title="ביטוח" subtitle="נהל את הפוליסות והביטוחים שלך" />
      <Card padding="lg">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-phi-dark/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-phi-dark" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">ניהול ביטוחים</h3>
            <p className="text-sm text-gray-500">הוסף ביטוח חיים, בריאות, רכב ועוד</p>
          </div>
        </div>
        <Link href="/dashboard/insurance">
          <Button className="w-full bg-phi-dark hover:bg-phi-slate text-white">
            <ArrowRight className="w-4 h-4 ml-2" />
            עבור לדף ביטוח
          </Button>
        </Link>
      </Card>
    </PageWrapper>
  );
}

