import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Shield, ArrowRight, TrendingUp, Wallet, Percent, Calendar,
  Building2, Briefcase, DollarSign, AlertCircle,
} from 'lucide-react';
import { PageWrapper, PageHeader, KpiGrid, StatCard, Card, Section, InsightBanner } from '@/components/ui/design-system';
import { analyzePensionPlan } from '@/lib/finance/pension-insights';

const FUND_TYPE_LABELS: Record<string, string> = {
  pension_fund: 'קרן פנסיה',
  provident_fund: 'קופת גמל',
  advanced_study_fund: 'קרן השתלמות',
  managers_insurance: 'ביטוח מנהלים',
  investment_provident: 'גמל להשקעה',
};

export default async function PensionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: plan } = await supabase
    .from('pension_insurance')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!plan) notFound();

  const p = plan as any;
  const insights = analyzePensionPlan(p);

  // Parse JSON notes for retirement_age, investment_track, insurance_coverage, etc.
  let extras: any = {};
  try {
    extras = p.notes ? JSON.parse(p.notes) : {};
  } catch { /* notes is plain text */ }

  const fmt = (n: number | null | undefined) => n != null ? Number(n).toLocaleString('he-IL') : '—';
  const fmtPct = (n: number | null | undefined) => n != null ? `${Number(n).toFixed(2)}%` : 'אין נתון';

  const sevColor: Record<string, 'danger' | 'warning' | 'info' | 'success'> = {
    critical: 'danger',
    warning: 'warning',
    info: 'info',
    success: 'success',
  };

  return (
    <PageWrapper>
      <Link href="/dashboard/pensions" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-phi-dark transition-colors">
        <ArrowRight className="w-4 h-4" />
        חזרה לכל הקרנות
      </Link>

      <PageHeader
        title={p.fund_name}
        subtitle={`${FUND_TYPE_LABELS[p.fund_type] || p.fund_type} • ${p.provider}${p.policy_number ? ` • פוליסה ${p.policy_number}` : ''}`}
      />

      {/* KPIs */}
      <KpiGrid cols={4}>
        <StatCard
          label="יתרה נוכחית"
          value={`₪${fmt(p.current_balance)}`}
          icon={Wallet}
          tone="balance"
        />
        <StatCard
          label="הפקדה חודשית"
          value={`₪${fmt(p.monthly_deposit)}`}
          icon={TrendingUp}
          tone="income"
        />
        <StatCard
          label="דמי ניהול מצבירה"
          value={fmtPct(p.management_fee_percentage)}
          icon={Percent}
          tone={
            !p.management_fee_percentage ? 'neutral'
              : p.management_fee_percentage > 1 ? 'expense'
              : p.management_fee_percentage > 0.5 ? 'pending'
              : 'income'
          }
        />
        <StatCard
          label="תשואה שנתית"
          value={fmtPct(p.annual_return)}
          icon={TrendingUp}
          tone={
            !p.annual_return ? 'neutral'
              : p.annual_return >= 7 ? 'income'
              : p.annual_return >= 3 ? 'pending'
              : 'expense'
          }
        />
      </KpiGrid>

      {/* AI insights */}
      {insights.length > 0 && (
        <Section title="תובנות וניתוח" titleIcon={AlertCircle}>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <InsightBanner key={i} variant={sevColor[ins.severity]} title={ins.title}>
                {ins.body}
              </InsightBanner>
            ))}
          </div>
        </Section>
      )}

      {/* Plan details */}
      <Section title="פרטי התוכנית" titleIcon={Briefcase}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <DetailRow icon={Building2} label="חברה מנהלת" value={p.provider} />
          <DetailRow icon={Shield} label="מספר פוליסה" value={p.policy_number || '—'} />
          <DetailRow icon={Calendar} label="תאריך התחלה" value={p.start_date ? new Date(p.start_date).toLocaleDateString('he-IL') : '—'} />
          <DetailRow icon={Calendar} label="גיל פרישה" value={extras.retirement_age || '67'} />
          <DetailRow icon={Briefcase} label="מסלול השקעה" value={extras.investment_track || '—'} />
          <DetailRow icon={DollarSign} label="הפקדת עובד" value={`₪${fmt(p.employee_contribution)}`} />
          <DetailRow icon={DollarSign} label="הפקדת מעסיק" value={`₪${fmt(p.employer_contribution)}`} />
          <DetailRow icon={Percent} label="דמי ניהול מהפקדה" value={fmtPct(p.deposit_fee_percentage)} />
        </div>
      </Section>

      {/* Insurance coverage */}
      {extras.insurance_coverage && Object.keys(extras.insurance_coverage).length > 0 && (
        <Section title="כיסויים ביטוחיים בתוכנית" titleIcon={Shield}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {extras.insurance_coverage.life_insurance && (
              <DetailRow icon={Shield} label="ביטוח חיים" value={`₪${fmt(extras.insurance_coverage.life_insurance)}`} />
            )}
            {extras.insurance_coverage.disability && (
              <DetailRow icon={Shield} label="אובדן כושר עבודה" value={`₪${fmt(extras.insurance_coverage.disability)} / חודש`} />
            )}
            {extras.insurance_coverage.survivors_pension && (
              <DetailRow icon={Shield} label="פנסיית שאירים" value={`₪${fmt(extras.insurance_coverage.survivors_pension)} / חודש`} />
            )}
            {extras.insurance_coverage.critical_illness && (
              <DetailRow icon={Shield} label="מחלות קשות" value={`₪${fmt(extras.insurance_coverage.critical_illness)}`} />
            )}
          </div>
        </Section>
      )}

      {/* Returns history */}
      {extras.returns_history && (
        <Section title="תשואות היסטוריות" titleIcon={TrendingUp}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {extras.returns_history.last_12m != null && (
              <Card><div className="text-xs text-gray-500 mb-1">12 חודשים</div><div className="text-lg font-bold text-phi-mint">{extras.returns_history.last_12m}%</div></Card>
            )}
            {extras.returns_history.last_24m != null && (
              <Card><div className="text-xs text-gray-500 mb-1">24 חודשים</div><div className="text-lg font-bold text-phi-mint">{extras.returns_history.last_24m}%</div></Card>
            )}
            {extras.returns_history.last_36m != null && (
              <Card><div className="text-xs text-gray-500 mb-1">36 חודשים</div><div className="text-lg font-bold text-phi-mint">{extras.returns_history.last_36m}%</div></Card>
            )}
            {extras.returns_history.last_60m != null && (
              <Card><div className="text-xs text-gray-500 mb-1">60 חודשים</div><div className="text-lg font-bold text-phi-mint">{extras.returns_history.last_60m}%</div></Card>
            )}
          </div>
          {extras.returns_history.std_36m != null && (
            <p className="text-xs text-gray-500 mt-3">
              סטיית תקן (36 חודשים): {extras.returns_history.std_36m}% • חשיפה למניות: {extras.returns_history.stock_exposure ?? '—'}%
            </p>
          )}
        </Section>
      )}

      {/* Loans on this plan */}
      {extras.plan_loans && extras.plan_loans.length > 0 && (
        <Section title="הלוואות בתוכנית" titleIcon={DollarSign}>
          <div className="space-y-2">
            {extras.plan_loans.map((loan: any, i: number) => (
              <Card key={i}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">מספר הלוואה: </span>{loan.loan_number}</div>
                  <div><span className="text-gray-500">יתרה: </span>₪{fmt(loan.current_balance)}</div>
                  <div><span className="text-gray-500">החזר חודשי: </span>₪{fmt(loan.monthly_payment)}</div>
                  <div><span className="text-gray-500">ריבית: </span>{loan.interest_rate}%</div>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}
    </PageWrapper>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <span className="text-gray-500 min-w-[120px]">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}
