'use client';

import FinancialSummaryTable from '@/components/dashboard/FinancialSummaryTable';
import Link from 'next/link';
import { PageWrapper, PageHeader } from '@/components/ui/design-system';

export default function FinancialTablePage() {
  return (
    <PageWrapper maxWidth="wide">
      <PageHeader
        title="טבלה פיננסית"
        subtitle="סיכום מלא — הכנסות, הוצאות, קבועות, משתנות, מיוחדות"
        action={
          <Link href="/dashboard" className="text-sm text-phi-gold hover:underline">
            חזרה לדשבורד
          </Link>
        }
      />
      <FinancialSummaryTable />
    </PageWrapper>
  );
}
