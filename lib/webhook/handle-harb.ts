/**
 * הר הביטוח (CMA Insurance Authority) report handler.
 *
 * Israel's insurance regulator publishes a per-citizen "insurance
 * mountain" report at harb.cma.gov.il listing every active and historic
 * insurance policy across all carriers. The structure is hierarchical:
 *
 *   domain (ביטוח כללי / בריאות ותאונות אישיות / חיים)
 *     → main_branch (ביטוח רכב / ביטוח דירה / ביטוח סיעודי / ...)
 *       → sub_branch (חובה / מקיף / צד ג / מבנה / סיעודי עד 3 חודשים / ...)
 *         → policies[] with { provider, policy_number, period, premium, premium_type }
 *
 * Each "service rider" line (כתב שירות שירותי דרך/וגרירה/שמשות/...) is
 * a sub-charge of a parent policy and shares the policy_number — we
 * roll those into a single row by (policy_number) so the user sees one
 * "Magdal car comprehensive" instead of five rows.
 *
 * Idempotency: upsert by (user_id, policy_number). Re-uploading a newer
 * snapshot updates premium/coverage; rows the user added manually
 * (without policy_number markers) are untouched.
 */

interface PolicyRow {
  domain?: string | null;
  main_branch?: string | null;
  sub_branch?: string | null;
  insurance_company?: string | null; // chevra
  provider?: string | null;
  product_type?: string | null;
  policy_number?: string | null;
  policy_period?: string | null; // "01/01/2024 - 31/12/2024"
  start_date?: string | null;
  end_date?: string | null;
  premium_amount?: number | string | null;
  premium_type?: string | null; // 'שנתית' | 'חודשית'
  notes?: string | null;
}

export interface HarBitachOcrResult {
  report_info?: {
    report_date?: string;
    citizen_id?: string;
  };
  // Either flat list of policies OR domain-grouped — accept both.
  policies?: PolicyRow[];
  domains?: Array<{
    domain_name?: string;
    branches?: Array<{
      main_branch?: string;
      policies?: PolicyRow[];
    }>;
  }>;
}

const HARB_MARKER = 'הר הביטוח';

// Map (main_branch, sub_branch) → insurance.insurance_type CHECK values:
// life | health | critical_illness | disability | accident | home | car | travel | pet | other
function mapInsuranceType(mainBranch?: string | null, subBranch?: string | null, productType?: string | null): string {
  const m = (mainBranch || '').trim();
  const s = (subBranch || '').trim();
  const p = (productType || '').trim();
  const all = `${m} ${s} ${p}`;

  // Vehicle — all variants (mandatory, comprehensive, third-party) → car
  if (/ביטוח\s*רכב|רכב\s*חובה|ביטוח\s*מקיף|צד\s*ג/.test(all)) return 'car';
  // Home / dwelling
  if (/ביטוח\s*דירה|מבנה|תכולה/.test(all)) return 'home';
  // Long-term care / סיעודי → critical_illness (closest CHECK match)
  if (/סיעוד/.test(all)) return 'critical_illness';
  // Disability — אבדן כושר עבודה
  if (/אבדן\s*כושר\s*עבודה|disability/.test(all)) return 'disability';
  // Critical illness — מחלות קשות
  if (/מחלות\s*קשות|critical/.test(all)) return 'critical_illness';
  // Personal accident — תאונות אישיות
  if (/תאונות\s*אישיות|accident/.test(all)) return 'accident';
  // Life — ביטוח חיים (whether savings-bundled or pure death benefit)
  if (/ביטוח\s*חיים|למקרה\s*מוות/.test(all)) return 'life';
  // Health (surgeries, transplants, medications, doctor visits, ...)
  if (/בריאות|השתלות|ניתוח|תרופות|ייעוץ/.test(all)) return 'health';
  // Travel
  if (/נסיעות|travel/.test(all)) return 'travel';
  // Pets
  if (/חיות\s*מחמד|pet/.test(all)) return 'pet';
  return 'other';
}

function parseAmount(v: any): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toMonthlyPremium(amount: number, premiumType?: string | null): number {
  const t = (premiumType || '').trim();
  if (/שנתית|annual/i.test(t)) return amount / 12;
  // Default to monthly if explicitly marked or unknown — closer to typical
  // user expectation than dividing.
  return amount;
}

function parseISODate(s?: string | null): string | null {
  if (!s) return null;
  // Accept "01/01/2024" or "2024-01-01"
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parsePeriod(period?: string | null): { start: string | null; end: string | null } {
  if (!period) return { start: null, end: null };
  const parts = period.split(/\s*-\s*|\s*–\s*|\s*to\s*/i);
  if (parts.length !== 2) return { start: null, end: null };
  return { start: parseISODate(parts[0]), end: parseISODate(parts[1]) };
}

// The OCR prompt for הר הביטוח already exists in lib/ai/document-prompts.ts
// and returns categorized arrays (life_insurance[], health_insurance[],
// car_insurance[], home_insurance[], …). This bridge accepts that shape
// too, plus the simpler flat policies[] / nested domains[] shapes — so
// future prompt revisions don't break parsing.
function flattenPolicies(ocr: any): PolicyRow[] {
  if (Array.isArray(ocr?.policies) && ocr.policies.length > 0) return ocr.policies;
  if (Array.isArray(ocr?.insurance_policies) && ocr.insurance_policies.length > 0) return ocr.insurance_policies;

  const flat: PolicyRow[] = [];

  // Domain-grouped shape
  for (const dom of ocr?.domains || []) {
    for (const br of dom.branches || []) {
      for (const pol of br.policies || []) {
        flat.push({ ...pol, main_branch: pol.main_branch || br.main_branch, domain: pol.domain || dom.domain_name });
      }
    }
  }
  if (flat.length > 0) return flat;

  // Categorized arrays — convert each into PolicyRow with an inferred
  // main_branch so mapInsuranceType lands on the right CHECK value.
  const categoryToBranch: Record<string, string> = {
    life_insurance: 'ביטוח חיים',
    health_insurance: 'ביטוח בריאות',
    disability_insurance: 'אבדן כושר עבודה',
    nursing_insurance: 'ביטוח סיעודי',
    critical_illness: 'מחלות קשות',
    accident_insurance: 'תאונות אישיות',
    car_insurance: 'ביטוח רכב',
    home_insurance: 'ביטוח דירה',
    travel_insurance: 'נסיעות',
    pet_insurance: 'חיות מחמד',
  };

  for (const [key, branch] of Object.entries(categoryToBranch)) {
    const arr = (ocr as any)?.[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      // Coerce annual_premium → monthly when premium_amount missing
      let amount = item.monthly_premium ?? item.premium_amount;
      let premiumType: string | null = item.premium_type || (item.monthly_premium != null ? 'חודשית' : null);
      if (amount == null && item.annual_premium != null) {
        amount = item.annual_premium;
        premiumType = 'שנתית';
      }
      flat.push({
        domain: branch,
        main_branch: branch,
        sub_branch: item.type || item.sub_branch || null,
        provider: item.provider || item.insurance_company || null,
        product_type: item.product_type || null,
        policy_number: item.policy_number || null,
        policy_period: item.policy_period || null,
        start_date: item.start_date || item.valid_from || null,
        end_date: item.end_date || item.valid_until || null,
        premium_amount: amount,
        premium_type: premiumType,
      });
    }
  }
  return flat;
}

interface AggregatedPolicy {
  policy_number: string;
  provider: string;
  insurance_type: string;
  start_date: string | null;
  end_date: string | null;
  monthly_premium: number;        // base policy premium, monthly
  rider_total_monthly: number;    // service riders summed, monthly
  rider_descriptions: string[];   // for the notes field
  is_active: boolean;
  raw_period: string | null;
  raw_branches: Set<string>;
}

/**
 * Group rows by policy_number — the כתב שירות riders share the same
 * policy_number as the parent policy and should be rolled up into a
 * single row whose monthly_premium = base + riders.
 */
function aggregateByPolicyNumber(rows: PolicyRow[]): AggregatedPolicy[] {
  const today = new Date();
  const map = new Map<string, AggregatedPolicy>();

  for (const r of rows) {
    const policyNum = (r.policy_number || '').toString().trim();
    if (!policyNum) continue; // skip rows without identity

    const provider = (r.provider || r.insurance_company || 'לא צוין').trim();
    const insType = mapInsuranceType(r.main_branch, r.sub_branch, r.product_type);
    const periodParsed = parsePeriod(r.policy_period);
    const startDate = r.start_date || periodParsed.start;
    const endDate = r.end_date || periodParsed.end;
    const amount = parseAmount(r.premium_amount);
    const monthly = toMonthlyPremium(amount, r.premium_type);

    // Active = end_date in the future (or no end date)
    const isActive = !endDate || new Date(endDate) >= today;

    // Riders are identifiable by product_type containing "כתב שירות"
    const isRider = /כתב\s*שירות|שירותי\s*רכב|שמשות|פנסים|רדיו\s*חלופי|רכב\s*חלופי|דרך\s*וגרירה/.test(
      `${r.product_type || ''} ${r.sub_branch || ''}`,
    );

    let agg = map.get(policyNum);
    if (!agg) {
      agg = {
        policy_number: policyNum,
        provider,
        insurance_type: insType,
        start_date: startDate,
        end_date: endDate,
        monthly_premium: 0,
        rider_total_monthly: 0,
        rider_descriptions: [],
        is_active: isActive,
        raw_period: r.policy_period || null,
        raw_branches: new Set(),
      };
      map.set(policyNum, agg);
    }

    if (r.main_branch) agg.raw_branches.add(r.main_branch.trim());
    if (r.sub_branch) agg.raw_branches.add(r.sub_branch.trim());

    if (isRider) {
      agg.rider_total_monthly += monthly;
      const label = (r.product_type || r.sub_branch || 'כתב שירות').trim();
      if (label) agg.rider_descriptions.push(`${label} (₪${monthly.toFixed(0)})`);
    } else {
      // Base policy line. Sum if multiple base lines per policy_number
      // (rare — happens when a policy has multiple coverage tiers).
      agg.monthly_premium += monthly;
      // Use the most permissive active status across base rows
      agg.is_active = agg.is_active || isActive;
    }
  }

  return Array.from(map.values());
}

export interface HarBitachResult {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
}

export async function handleHarBitachReport(
  supabase: any,
  userId: string,
  ocrData: any,
  documentId: string,
): Promise<HarBitachResult> {
  const result: HarBitachResult = { inserted: 0, updated: 0, skipped: 0, total: 0 };

  const flat = flattenPolicies(ocrData as HarBitachOcrResult);
  if (!flat.length) {
    console.warn('[harb] no policies found in OCR result');
    return result;
  }

  const aggregated = aggregateByPolicyNumber(flat);
  result.total = aggregated.length;

  // Existing policy_numbers for this user — index for upsert
  const { data: existing } = await supabase
    .from('insurance')
    .select('id, policy_number, notes')
    .eq('user_id', userId);
  const existingByPolicy = new Map<string, { id: string; notes: string | null }>();
  (existing || []).forEach((row: any) => {
    if (row.policy_number) {
      existingByPolicy.set(String(row.policy_number).trim(), { id: row.id, notes: row.notes });
    }
  });

  for (const p of aggregated) {
    const totalMonthly = p.monthly_premium + p.rider_total_monthly;
    const branches = Array.from(p.raw_branches).join(' · ');
    const ridersBlurb = p.rider_descriptions.length
      ? ` · נספחים: ${p.rider_descriptions.join(', ')}`
      : '';
    const note = `${HARB_MARKER} (סנכרון אוטומטי) — ${branches}${ridersBlurb}. דוח: ${ocrData?.report_info?.report_date || ''}`.trim();

    // annual_premium is GENERATED — never insert it.
    const row = {
      user_id: userId,
      insurance_type: p.insurance_type,
      provider: p.provider,
      policy_number: p.policy_number,
      monthly_premium: Math.round(totalMonthly * 100) / 100,
      coverage_amount: 0,
      status: p.is_active ? 'active' : 'inactive',
      active: p.is_active,
      start_date: p.start_date,
      end_date: p.end_date,
      notes: note,
      updated_at: new Date().toISOString(),
    };

    const existingRow = existingByPolicy.get(p.policy_number);
    if (existingRow) {
      const { error } = await supabase
        .from('insurance')
        .update(row)
        .eq('id', existingRow.id);
      if (error) {
        console.warn('[harb] update failed:', { policy: p.policy_number, error: error.message });
        result.skipped += 1;
      } else {
        result.updated += 1;
      }
    } else {
      const { error } = await supabase.from('insurance').insert(row);
      if (error) {
        console.warn('[harb] insert failed:', { policy: p.policy_number, type: p.insurance_type, error: error.message });
        result.skipped += 1;
      } else {
        result.inserted += 1;
      }
    }
  }

  console.log(
    `[harb] processed ${result.total} unique policies — +${result.inserted} new, ~${result.updated} updated, ${result.skipped} skipped`,
  );
  return result;
}
