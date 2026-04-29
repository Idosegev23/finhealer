"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Loader2, Shield, HeartPulse, Stethoscope, Heart,
  Accessibility, Ambulance, Home, Car, Plane, PawPrint, FileText,
  Calendar, DollarSign, AlertTriangle, Sparkles, Upload, ListChecks,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageWrapper, Card as DSCard } from "@/components/ui/design-system";
import { Button } from "@/components/ui/button";

interface Insurance {
  id: string;
  insurance_type: string;
  provider: string;
  policy_number: string | null;
  status: string;
  coverage_amount: number | null;
  monthly_premium: number | null;
  annual_premium: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  metadata: any;
  active: boolean;
}

const TYPE_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  life: { label: "ביטוח חיים", icon: HeartPulse },
  health: { label: "ביטוח בריאות", icon: Stethoscope },
  critical_illness: { label: "סיעודי / מחלות קשות", icon: Heart },
  disability: { label: "אובדן כושר עבודה", icon: Accessibility },
  accident: { label: "תאונות אישיות", icon: Ambulance },
  home: { label: "ביטוח דירה", icon: Home },
  car: { label: "ביטוח רכב", icon: Car },
  travel: { label: "ביטוח נסיעות", icon: Plane },
  pet: { label: "ביטוח חיות מחמד", icon: PawPrint },
  other: { label: "אחר", icon: FileText },
};

const formatILS = (n: number | null | undefined) =>
  n == null ? "—" : `₪${Math.round(Number(n)).toLocaleString("he-IL")}`;

const formatDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("he-IL") : "—";

const isInferred = (ins: Insurance) =>
  !!ins.notes && ins.notes.includes("הוסק אוטומטית מתנועה בנקאית");

const fromHarb = (ins: Insurance) =>
  !!ins.notes && ins.notes.includes("הר הביטוח");

export default function InsuranceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";
  const [insurance, setInsurance] = useState<Insurance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("insurance")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          setError("הפוליסה לא נמצאה");
        } else {
          setInsurance(data as Insurance);
        }
      } catch (e: any) {
        setError(e?.message || "שגיאה בטעינה");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <PageWrapper>
        <DSCard padding="lg" className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-8 h-8 animate-spin text-phi-slate" />
        </DSCard>
      </PageWrapper>
    );
  }

  if (error || !insurance) {
    return (
      <PageWrapper>
        <DSCard padding="lg" className="text-center py-12">
          <p className="text-phi-coral mb-4">{error || "לא נמצאה פוליסה"}</p>
          <Link href="/dashboard/insurance">
            <Button variant="outline">חזרה לתיק הביטוח</Button>
          </Link>
        </DSCard>
      </PageWrapper>
    );
  }

  const typeInfo = TYPE_LABELS[insurance.insurance_type] || TYPE_LABELS.other;
  const TypeIcon = typeInfo.icon;
  const meta = (insurance.metadata || {}) as any;
  const isActiveInsured = insurance.status === "active";
  const inferred = isInferred(insurance);
  const sourceHarb = fromHarb(insurance);
  const coverageList: string[] = Array.isArray(meta.coverage) ? meta.coverage : [];
  const conditions: string[] = Array.isArray(meta.covered_conditions) ? meta.covered_conditions : [];
  const subTypes: string[] = Array.isArray(meta.sub_types) ? meta.sub_types : [];
  const branches: string[] = Array.isArray(meta.branches) ? meta.branches : [];
  const riders: Array<{ name: string; monthly_premium: number }> = Array.isArray(meta.riders) ? meta.riders : [];
  const vehicle = meta.vehicle as
    | { make?: string; model?: string; year?: number | null; license_plate?: string }
    | undefined;

  return (
    <PageWrapper>
      {/* Back nav */}
      <div className="mb-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-phi-slate hover:text-phi-dark flex items-center gap-1"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה
        </button>
      </div>

      {/* Header card */}
      <DSCard padding="lg" className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-phi-dark/10 flex items-center justify-center flex-shrink-0">
              <TypeIcon className="w-6 h-6 text-phi-dark" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-gray-900">{typeInfo.label}</h1>
                <span
                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    isActiveInsured
                      ? "bg-emerald-50 text-phi-mint border border-emerald-200"
                      : "bg-gray-100 text-gray-600 border border-gray-200"
                  }`}
                >
                  {isActiveInsured ? "פעיל" : "לא פעיל"}
                </span>
                {sourceHarb && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-sky-50 text-phi-dark border border-sky-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    מהר הביטוח
                  </span>
                )}
                {inferred && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-50 text-phi-coral border border-amber-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    הוסק אוטומטית
                  </span>
                )}
              </div>
              <p className="text-base text-gray-700">{insurance.provider}</p>
              {meta.plan_name && (
                <p className="text-sm text-phi-slate mt-0.5">{meta.plan_name}</p>
              )}
              {subTypes.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {subTypes.map((s, i) => (
                    <span key={i} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {inferred && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <p className="text-gray-700 mb-2">
              הפוליסה זוהתה אוטומטית מחיובי בנק. הסכום ופרטי הפוליסה הם הערכה.
            </p>
            <Link
              href="/dashboard/scan-center"
              className="inline-flex items-center gap-1 text-phi-dark hover:underline font-medium text-xs"
            >
              <Upload className="w-3 h-3" />
              העלאת פירוט פוליסה (או דוח הר הביטוח) לדיוק הפרטים
            </Link>
          </div>
        )}
      </DSCard>

      {/* Money KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <DSCard padding="lg">
          <div className="flex items-center gap-2 text-xs text-phi-slate mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            פרמיה חודשית
          </div>
          <p className="text-2xl font-bold text-phi-coral tabular-nums">
            {formatILS(insurance.monthly_premium)}
          </p>
        </DSCard>
        <DSCard padding="lg">
          <div className="flex items-center gap-2 text-xs text-phi-slate mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            פרמיה שנתית
          </div>
          <p className="text-2xl font-bold text-phi-dark tabular-nums">
            {formatILS(insurance.annual_premium ?? (insurance.monthly_premium ? insurance.monthly_premium * 12 : null))}
          </p>
        </DSCard>
        <DSCard padding="lg">
          <div className="flex items-center gap-2 text-xs text-phi-slate mb-1">
            <Shield className="w-3.5 h-3.5" />
            גובה כיסוי
          </div>
          <p className="text-2xl font-bold text-phi-mint tabular-nums">
            {(insurance.coverage_amount && Number(insurance.coverage_amount) > 0)
              ? formatILS(insurance.coverage_amount)
              : "לא צוין"}
          </p>
        </DSCard>
      </div>

      {/* Identity panel */}
      <DSCard padding="lg" className="mb-6">
        <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-phi-slate" />
          פרטי פוליסה
        </h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <dt className="text-phi-slate">מספר פוליסה</dt>
            <dd className="font-medium text-gray-900 tabular-nums">{insurance.policy_number || "—"}</dd>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <dt className="text-phi-slate">חברה</dt>
            <dd className="font-medium text-gray-900">{insurance.provider}</dd>
          </div>
          {meta.product_type && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-phi-slate">סוג מוצר</dt>
              <dd className="font-medium text-gray-900">{meta.product_type}</dd>
            </div>
          )}
          {branches.length > 0 && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-phi-slate">ענפים</dt>
              <dd className="font-medium text-gray-900 text-xs text-right">{branches.join(" · ")}</dd>
            </div>
          )}
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <dt className="text-phi-slate flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              תחילת ביטוח
            </dt>
            <dd className="font-medium text-gray-900">{formatDate(insurance.start_date)}</dd>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <dt className="text-phi-slate flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              סוף ביטוח
            </dt>
            <dd className="font-medium text-gray-900">{formatDate(insurance.end_date)}</dd>
          </div>
          {meta.beneficiaries && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-phi-slate">מוטבים</dt>
              <dd className="font-medium text-gray-900">{meta.beneficiaries}</dd>
            </div>
          )}
          {meta.waiting_period && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-phi-slate">תקופת המתנה</dt>
              <dd className="font-medium text-gray-900">{meta.waiting_period}</dd>
            </div>
          )}
          {meta.definition && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-phi-slate">הגדרה</dt>
              <dd className="font-medium text-gray-900">{meta.definition}</dd>
            </div>
          )}
          {meta.deductible != null && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-phi-slate">השתתפות עצמית</dt>
              <dd className="font-medium text-gray-900 tabular-nums">{formatILS(meta.deductible)}</dd>
            </div>
          )}
          {meta.coverage_percent != null && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-phi-slate">אחוז כיסוי</dt>
              <dd className="font-medium text-gray-900">{meta.coverage_percent}%</dd>
            </div>
          )}
          {meta.monthly_benefit != null && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-phi-slate">קצבה חודשית</dt>
              <dd className="font-medium text-gray-900 tabular-nums">{formatILS(meta.monthly_benefit)}</dd>
            </div>
          )}
        </dl>
      </DSCard>

      {/* Coverage list */}
      {(coverageList.length > 0 || conditions.length > 0) && (
        <DSCard padding="lg" className="mb-6">
          <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-phi-slate" />
            כיסויים
          </h3>
          {coverageList.length > 0 && (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
              {coverageList.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                  <Shield className="w-3.5 h-3.5 text-phi-mint flex-shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          )}
          {conditions.length > 0 && (
            <>
              <h4 className="text-xs font-semibold text-phi-slate mt-3 mb-1">מצבים מכוסים</h4>
              <ul className="flex gap-1.5 flex-wrap">
                {conditions.map((c, i) => (
                  <li key={i} className="text-xs bg-amber-50 text-phi-coral rounded px-2 py-1">
                    {c}
                  </li>
                ))}
              </ul>
            </>
          )}
        </DSCard>
      )}

      {/* Vehicle (car insurance) */}
      {vehicle && (
        <DSCard padding="lg" className="mb-6">
          <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Car className="w-4 h-4 text-phi-slate" />
            רכב מבוטח
          </h3>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {vehicle.make && (
              <div>
                <dt className="text-xs text-phi-slate">יצרן</dt>
                <dd className="font-medium text-gray-900">{vehicle.make}</dd>
              </div>
            )}
            {vehicle.model && (
              <div>
                <dt className="text-xs text-phi-slate">דגם</dt>
                <dd className="font-medium text-gray-900">{vehicle.model}</dd>
              </div>
            )}
            {vehicle.year && (
              <div>
                <dt className="text-xs text-phi-slate">שנת ייצור</dt>
                <dd className="font-medium text-gray-900 tabular-nums">{vehicle.year}</dd>
              </div>
            )}
            {vehicle.license_plate && (
              <div>
                <dt className="text-xs text-phi-slate">מספר רכב</dt>
                <dd className="font-medium text-gray-900 tabular-nums">{vehicle.license_plate}</dd>
              </div>
            )}
          </dl>
        </DSCard>
      )}

      {/* Property (home insurance) */}
      {(meta.property_address || meta.building_coverage != null || meta.contents_coverage != null) && (
        <DSCard padding="lg" className="mb-6">
          <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Home className="w-4 h-4 text-phi-slate" />
            נכס מבוטח
          </h3>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {meta.property_address && (
              <div className="md:col-span-3">
                <dt className="text-xs text-phi-slate">כתובת</dt>
                <dd className="font-medium text-gray-900">{meta.property_address}</dd>
              </div>
            )}
            {meta.building_coverage != null && (
              <div>
                <dt className="text-xs text-phi-slate">כיסוי מבנה</dt>
                <dd className="font-medium text-gray-900 tabular-nums">{formatILS(meta.building_coverage)}</dd>
              </div>
            )}
            {meta.contents_coverage != null && (
              <div>
                <dt className="text-xs text-phi-slate">כיסוי תכולה</dt>
                <dd className="font-medium text-gray-900 tabular-nums">{formatILS(meta.contents_coverage)}</dd>
              </div>
            )}
          </dl>
        </DSCard>
      )}

      {/* Riders */}
      {riders.length > 0 && (
        <DSCard padding="lg" className="mb-6">
          <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-phi-slate" />
            נספחים וכתבי שירות
          </h3>
          <ul className="divide-y divide-gray-100">
            {riders.map((r, i) => (
              <li key={i} className="flex justify-between items-center py-2 text-sm">
                <span className="text-gray-700">{r.name}</span>
                <span className="font-medium text-phi-coral tabular-nums">
                  {formatILS(r.monthly_premium)}/חודש
                </span>
              </li>
            ))}
          </ul>
        </DSCard>
      )}

      {/* Notes */}
      {insurance.notes && !inferred && !sourceHarb && (
        <DSCard padding="lg" className="mb-6">
          <h3 className="text-base font-bold text-gray-900 mb-2">הערות</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{insurance.notes}</p>
        </DSCard>
      )}

      {/* Source line */}
      <p className="text-xs text-phi-slate text-center">
        {sourceHarb
          ? `סונכרן מהר הביטוח · ${meta.report_date || "-"}`
          : inferred
          ? "הוסק אוטומטית מחיובי בנק"
          : "הוזן ידנית"}
      </p>
    </PageWrapper>
  );
}
