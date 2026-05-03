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

type GroupBy = 'month' | 'type';

const formatMonthLabel = (s: string) => {
  // s = 'YYYY-MM' → 'אפריל 2026'
  const [year, month] = s.split('-').map(Number);
  if (!year || !month) return s;
  return new Date(year, month - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
};

export default function MissingDocumentsPage() {
  const router = useRouter();
  const [missingDocs, setMissingDocs] = useState<MissingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('month');

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

  // Two grouping modes:
  //   - 'month' (default): group by period_start (YYYY-MM), one card per
  //     month showing all the docs needed for that period. Most actionable
  //     because users typically gather docs month-by-month.
  //   - 'type': group by document_type (credit / insurance / …) — useful
  //     when the user wants to take care of one category at a time.
  // Docs without a period fall into a 'no-period' bucket at the bottom.
  const groups = useMemo(() => {
    if (groupBy === 'type') {
      const byType = new Map<string, MissingDocument[]>();
      for (const d of missingDocs) {
        const arr = byType.get(d.document_type) || [];
        arr.push(d);
        byType.set(d.document_type, arr);
      }
      return Array.from(byType.entries())
        .map(([type, docs]) => {
          const meta = TYPE_META[type] || { label: type, icon: FileText };
          return {
            key: type,
            label: meta.label,
            sublabel: '',
            icon: meta.icon,
            docs: docs.sort((a, b) => (b.priority || 0) - (a.priority || 0)),
            totalAmount: docs.reduce((s, d) => s + (Number(d.expected_amount) || 0), 0),
          };
        })
        .sort((a, b) => b.docs.length - a.docs.length);
    }

    // groupBy === 'month'
    const byMonth = new Map<string, MissingDocument[]>();
    for (const d of missingDocs) {
      const key = d.period_start ? d.period_start.slice(0, 7) : 'no-period';
      const arr = byMonth.get(key) || [];
      arr.push(d);
      byMonth.set(key, arr);
    }
    return Array.from(byMonth.entries())
      .map(([monthKey, docs]) => {
        const types = Array.from(new Set(docs.map((d) => d.document_type)));
        const sublabel = types
          .map((t) => `${TYPE_META[t]?.label || t} (${docs.filter((d) => d.document_type === t).length})`)
          .join(' · ');
        return {
          key: monthKey,
          label: monthKey === 'no-period' ? 'ללא תקופה מוגדרת' : formatMonthLabel(monthKey),
          sublabel,
          // Picks the icon of the dominant type in the month
          icon: TYPE_META[types[0]]?.icon || FileText,
          docs: docs.sort((a, b) => (b.priority || 0) - (a.priority || 0)),
          totalAmount: docs.reduce((s, d) => s + (Number(d.expected_amount) || 0), 0),
        };
      })
      // Most recent month first; 'no-period' last
      .sort((a, b) => {
        if (a.key === 'no-period') return 1;
        if (b.key === 'no-period') return -1;
        return b.key.localeCompare(a.key);
      });
  }, [missingDocs, groupBy]);

  const totalPending = missingDocs.length;
  const totalTypes = new Set(missingDocs.map((d) => d.document_type)).size;
  const totalMonths = new Set(missingDocs.map((d) => (d.period_start || '').slice(0, 7)).filter(Boolean)).size;
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
        subtitle={`${totalPending} מסמכים מחכים להעלאה — ${totalMonths} ${totalMonths === 1 ? 'חודש' : 'חודשים'} · ${totalTypes} ${totalTypes === 1 ? 'סוג' : 'סוגים'}`}
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
          label="חודשים פתוחים"
          value={totalMonths}
          icon={CreditCard}
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
          icon={FileText}
          tone="neutral"
        />
      </KpiGrid>

      {/* View toggle — month vs type. Month-first matches how users
          actually work (gather Jan, then Feb, then Mar). */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <span className="text-xs text-phi-slate ml-1">תצוגה:</span>
        <button
          type="button"
          onClick={() => { setGroupBy('month'); setOpenKey(null); }}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${
            groupBy === 'month'
              ? 'bg-phi-dark text-white border-phi-dark'
              : 'bg-white text-phi-slate border-gray-200 hover:border-phi-dark'
          }`}
        >
          לפי חודש
        </button>
        <button
          type="button"
          onClick={() => { setGroupBy('type'); setOpenKey(null); }}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${
            groupBy === 'type'
              ? 'bg-phi-dark text-white border-phi-dark'
              : 'bg-white text-phi-slate border-gray-200 hover:border-phi-dark'
          }`}
        >
          לפי סוג
        </button>
      </div>

      {/* Groups — one card per group key (month or type), expandable */}
      <div className="space-y-3">
        {groups.map(({ key, label, sublabel, icon: Icon, docs, totalAmount: groupAmount }) => {
          const isOpen = openKey === key;
          return (
            <DSCard key={key} padding="md" className="overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : key)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 text-right"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-phi-coral" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{label}</h3>
                      <span className="text-xs bg-amber-100 text-phi-coral px-2 py-0.5 rounded-full">
                        {docs.length}
                      </span>
                      {groupAmount > 0 && (
                        <span className="text-xs text-phi-slate tabular-nums">
                          · {formatILS(groupAmount)}
                        </span>
                      )}
                    </div>
                    {sublabel && (
                      <p className="text-xs text-phi-slate mt-0.5 truncate">{sublabel}</p>
                    )}
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-phi-slate" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-phi-slate" />
                )}
              </button>

              {isOpen && (
                <ul className="mt-3 pt-3 border-t border-gray-100 divide-y divide-gray-100">
                  {docs.map((doc) => {
                    const docMeta = TYPE_META[doc.document_type] || { label: doc.document_type, icon: FileText };
                    return (
                      <li key={doc.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-[180px]">
                          <p className="text-sm font-medium text-gray-900">
                            {doc.description || docMeta.label}
                            {doc.card_last_4 && (
                              <span className="text-phi-slate font-normal"> · ****{doc.card_last_4}</span>
                            )}
                          </p>
                          <div className="text-xs text-phi-slate mt-0.5 flex items-center gap-2 flex-wrap">
                            {/* When grouping by month, the period is the group title — skip on the row.
                                When grouping by type, show it on the row. */}
                            {groupBy === 'type' && formatPeriod(doc.period_start, doc.period_end) && (
                              <span>תקופה: {formatPeriod(doc.period_start, doc.period_end)}</span>
                            )}
                            {groupBy === 'month' && (
                              <span className="text-phi-coral">{docMeta.label}</span>
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
                    );
                  })}
                </ul>
              )}
            </DSCard>
          );
        })}
      </div>
    </PageWrapper>
  );
}
