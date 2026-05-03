'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  FileText, CreditCard, FileCheck, Building2, AlertCircle,
  Upload, X, CheckCircle, ChevronDown, ChevronUp, Loader2,
  Shield, type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageWrapper, PageHeader, Card as DSCard, KpiGrid, StatCard } from '@/components/ui/design-system';

interface MissingDocument {
  id: string;
  document_type: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  card_last_4: string | null;
  expected_amount: number | null;
  priority: number;
  description: string | null;
  instructions: string | null;
  created_at: string;
  related_transaction_id: string | null;
}

const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  credit:     { label: 'דוחות אשראי',  icon: CreditCard },
  payslip:    { label: 'תלושי משכורת', icon: FileCheck },
  mortgage:   { label: 'דוחות משכנתא', icon: Building2 },
  loan:       { label: 'דוחות הלוואה', icon: Building2 },
  insurance:  { label: 'פוליסות ביטוח', icon: Shield },
  pension:    { label: 'דוחות פנסיה', icon: Shield },
  savings:    { label: 'דוחות חיסכון', icon: FileText },
  investment: { label: 'דוחות השקעות', icon: FileText },
};

const formatDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('he-IL', { month: '2-digit', year: 'numeric' }) : '';

const formatPeriod = (start: string | null, end: string | null) => {
  if (!start && !end) return null;
  if (start && end) return `${formatDate(start)}–${formatDate(end)}`;
  return formatDate(start) || formatDate(end);
};

const formatILS = (n: number | null | undefined) =>
  n == null ? '' : `₪${Math.round(n).toLocaleString('he-IL')}`;

export default function MissingDocumentsPage() {
  const router = useRouter();
  const [missingDocs, setMissingDocs] = useState<MissingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [openType, setOpenType] = useState<string | null>(null);
  const [skippingId, setSkippingId] = useState<string | null>(null);

  useEffect(() => { fetchMissingDocuments(); }, []);

  async function fetchMissingDocuments() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('missing_documents')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('priority', { ascending: false });
      if (error) throw error;
      setMissingDocs((data as MissingDocument[]) || []);
    } catch (e) {
      console.error('Error fetching missing documents:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip(docId: string) {
    setSkippingId(docId);
    try {
      const supabase = createClient();
      await (supabase as any).from('missing_documents').update({ status: 'skipped' }).eq('id', docId);
      setMissingDocs((prev) => prev.filter((d) => d.id !== docId));
    } finally {
      setSkippingId(null);
    }
  }

  function handleUpload(doc: MissingDocument) {
    router.push(`/dashboard/scan-center?type=${doc.document_type}&required=${doc.id}`);
  }

  // Aggregate by document_type — collapse 12 separate cards into one
  // group per type, with a per-card expand of the periods inside.
  const groups = useMemo(() => {
    const byType = new Map<string, MissingDocument[]>();
    for (const d of missingDocs) {
      const arr = byType.get(d.document_type) || [];
      arr.push(d);
      byType.set(d.document_type, arr);
    }
    return Array.from(byType.entries())
      .map(([type, docs]) => ({
        type,
        meta: TYPE_META[type] || { label: type, icon: FileText },
        docs: docs.sort((a, b) => (b.priority || 0) - (a.priority || 0)),
        totalAmount: docs.reduce((s, d) => s + (Number(d.expected_amount) || 0), 0),
        oldest: docs
          .map((d) => d.period_start)
          .filter(Boolean)
          .sort()[0] || null,
      }))
      .sort((a, b) => b.docs.length - a.docs.length);
  }, [missingDocs]);

  const totalPending = missingDocs.length;
  const totalTypes = groups.length;
  const totalAmount = missingDocs.reduce((s, d) => s + (Number(d.expected_amount) || 0), 0);

  if (loading) {
    return (
      <PageWrapper>
        <DSCard padding="lg" className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-8 h-8 animate-spin text-phi-slate" />
        </DSCard>
      </PageWrapper>
    );
  }

  if (totalPending === 0) {
    return (
      <PageWrapper>
        <PageHeader title="מסמכים חסרים" subtitle="כל המסמכים הנדרשים זמינים במערכת" />
        <DSCard padding="lg" className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-phi-mint" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">תיק המסמכים מלא</h3>
          <p className="text-sm text-phi-slate mb-6 max-w-md mx-auto">
            אין דוחות שעוד לא הועלו. התמונה הפיננסית מבוססת על דאטה אמיתי.
          </p>
          <Button
            onClick={() => router.push('/dashboard/scan-center')}
            variant="outline"
            className="border-phi-gold text-phi-coral hover:bg-amber-50"
          >
            <Upload className="w-4 h-4 ml-2" />
            העלאת מסמך נוסף
          </Button>
        </DSCard>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <PageHeader
        title="מסמכים חסרים"
        subtitle={`${totalPending} מסמכים מחכים להעלאה ב-${totalTypes} ${totalTypes === 1 ? 'סוג' : 'סוגים'}`}
        action={
          <Button
            onClick={() => router.push('/dashboard/scan-center')}
            className="bg-phi-dark hover:bg-phi-slate text-white"
          >
            <Upload className="w-4 h-4 ml-2" />
            פתח מרכז סריקה
          </Button>
        }
      />

      {/* Top KPI strip — quick orientation before the list */}
      <KpiGrid cols={3}>
        <StatCard
          label="סוגי מסמכים"
          value={totalTypes}
          icon={FileText}
          tone="neutral"
        />
        <StatCard
          label="סך הכל מסמכים"
          value={totalPending}
          icon={AlertCircle}
          tone="pending"
        />
        <StatCard
          label="סכום מצופה"
          value={totalAmount > 0 ? formatILS(totalAmount) : '—'}
          icon={CreditCard}
          tone="neutral"
        />
      </KpiGrid>

      {/* Groups by type — one card per type, expandable to see periods */}
      <div className="space-y-3">
        {groups.map(({ type, meta, docs, totalAmount: groupAmount, oldest }) => {
          const Icon = meta.icon;
          const isOpen = openType === type;
          return (
            <DSCard key={type} padding="md" className="overflow-hidden">
              {/* Group header — clickable */}
              <button
                type="button"
                onClick={() => setOpenType(isOpen ? null : type)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 text-right"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-phi-coral" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{meta.label}</h3>
                      <span className="text-xs bg-amber-100 text-phi-coral px-2 py-0.5 rounded-full">
                        {docs.length}
                      </span>
                    </div>
                    <p className="text-xs text-phi-slate mt-0.5">
                      {oldest && `מ-${formatDate(oldest)} `}
                      {groupAmount > 0 && `· סך ${formatILS(groupAmount)}`}
                    </p>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-phi-slate" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-phi-slate" />
                )}
              </button>

              {/* Expanded list of specific docs */}
              {isOpen && (
                <ul className="mt-3 pt-3 border-t border-gray-100 divide-y divide-gray-100">
                  {docs.map((doc) => (
                    <li key={doc.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-[180px]">
                        <p className="text-sm font-medium text-gray-900">
                          {doc.description || meta.label}
                          {doc.card_last_4 && (
                            <span className="text-phi-slate font-normal"> · ****{doc.card_last_4}</span>
                          )}
                        </p>
                        <div className="text-xs text-phi-slate mt-0.5 flex items-center gap-2 flex-wrap">
                          {formatPeriod(doc.period_start, doc.period_end) && (
                            <span>תקופה: {formatPeriod(doc.period_start, doc.period_end)}</span>
                          )}
                          {doc.expected_amount && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="font-medium tabular-nums">{formatILS(doc.expected_amount)}</span>
                            </>
                          )}
                        </div>
                        {doc.instructions && (
                          <p className="text-[11px] text-phi-slate mt-1 leading-relaxed">{doc.instructions}</p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          onClick={() => handleUpload(doc)}
                          size="sm"
                          className="bg-phi-dark hover:bg-phi-slate text-white"
                        >
                          <Upload className="w-3.5 h-3.5 ml-1" />
                          העלאה
                        </Button>
                        <Button
                          onClick={() => handleSkip(doc.id)}
                          size="sm"
                          variant="outline"
                          disabled={skippingId === doc.id}
                        >
                          {skippingId === doc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </DSCard>
          );
        })}
      </div>
    </PageWrapper>
  );
}
