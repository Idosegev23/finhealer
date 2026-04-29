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
  // Rich detail captured from the report — saved into insurance.metadata
  // so the drill-down page can render the full picture.
  coverage_amount?: number | string | null;
  coverage?: string[] | null;        // e.g. ["השתלות","ניתוחים בחו\"ל"]
  covered_conditions?: string[] | null;
  beneficiaries?: string | null;
  monthly_benefit?: number | string | null;
  coverage_percent?: number | null;
  waiting_period?: string | null;
  definition?: string | null;
  vehicle?: any;                      // { make, model, year, license_plate }
  deductible?: number | string | null;
  property_address?: string | null;
  building_coverage?: number | string | null;
  contents_coverage?: number | string | null;
  type?: string | null;               // e.g. 'מקיף', 'תכולה', 'משלים'
  plan_name?: string | null;
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
        // Pass through rich detail so aggregator can store in metadata
        coverage_amount: item.coverage_amount ?? null,
        coverage: Array.isArray(item.coverage) ? item.coverage : null,
        covered_conditions: Array.isArray(item.covered_conditions) ? item.covered_conditions : null,
        beneficiaries: item.beneficiaries ?? null,
        monthly_benefit: item.monthly_benefit ?? null,
        coverage_percent: item.coverage_percent ?? null,
        waiting_period: item.waiting_period ?? null,
        definition: item.definition ?? null,
        vehicle: item.vehicle ?? null,
        deductible: item.deductible ?? null,
        property_address: item.property_address ?? null,
        building_coverage: item.building_coverage ?? null,
        contents_coverage: item.contents_coverage ?? null,
        type: item.type ?? null,
        plan_name: item.plan_name ?? null,
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
  riders: Array<{ name: string; monthly: number; raw?: any }>;
  is_active: boolean;
  raw_period: string | null;
  raw_branches: Set<string>;
  // Rich detail kept for the metadata column
  coverage_amount: number | null;
  coverage_list: Set<string>;
  covered_conditions: Set<string>;
  beneficiaries: string | null;
  monthly_benefit: number | null;
  coverage_percent: number | null;
  waiting_period: string | null;
  definition: string | null;
  vehicle: any | null;
  deductible: number | null;
  property_address: string | null;
  building_coverage: number | null;
  contents_coverage: number | null;
  product_type: string | null;
  plan_name: string | null;
  sub_types: Set<string>;          // e.g. 'מקיף + שירותים' / 'משלים'
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
        riders: [],
        is_active: isActive,
        raw_period: r.policy_period || null,
        raw_branches: new Set(),
        coverage_amount: null,
        coverage_list: new Set(),
        covered_conditions: new Set(),
        beneficiaries: null,
        monthly_benefit: null,
        coverage_percent: null,
        waiting_period: null,
        definition: null,
        vehicle: null,
        deductible: null,
        property_address: null,
        building_coverage: null,
        contents_coverage: null,
        product_type: null,
        plan_name: null,
        sub_types: new Set(),
      };
      map.set(policyNum, agg);
    }

    if (r.main_branch) agg.raw_branches.add(r.main_branch.trim());
    if (r.sub_branch) agg.raw_branches.add(r.sub_branch.trim());
    if (r.type) agg.sub_types.add(r.type.trim());

    // Rich detail — only set once (first write wins) so the base policy
    // line takes priority over rider lines.
    if (r.coverage_amount != null && agg.coverage_amount == null) {
      agg.coverage_amount = parseAmount(r.coverage_amount);
    }
    if (Array.isArray(r.coverage)) r.coverage.forEach((c) => agg!.coverage_list.add(c));
    if (Array.isArray(r.covered_conditions)) r.covered_conditions.forEach((c) => agg!.covered_conditions.add(c));
    if (r.beneficiaries && !agg.beneficiaries) agg.beneficiaries = r.beneficiaries;
    if (r.monthly_benefit != null && agg.monthly_benefit == null) agg.monthly_benefit = parseAmount(r.monthly_benefit);
    if (r.coverage_percent != null && agg.coverage_percent == null) agg.coverage_percent = Number(r.coverage_percent);
    if (r.waiting_period && !agg.waiting_period) agg.waiting_period = r.waiting_period;
    if (r.definition && !agg.definition) agg.definition = r.definition;
    if (r.vehicle && !agg.vehicle) agg.vehicle = r.vehicle;
    if (r.deductible != null && agg.deductible == null) agg.deductible = parseAmount(r.deductible);
    if (r.property_address && !agg.property_address) agg.property_address = r.property_address;
    if (r.building_coverage != null && agg.building_coverage == null) agg.building_coverage = parseAmount(r.building_coverage);
    if (r.contents_coverage != null && agg.contents_coverage == null) agg.contents_coverage = parseAmount(r.contents_coverage);
    if (r.product_type && !agg.product_type) agg.product_type = r.product_type;
    if (r.plan_name && !agg.plan_name) agg.plan_name = r.plan_name;

    if (isRider) {
      agg.rider_total_monthly += monthly;
      const label = (r.product_type || r.sub_branch || 'כתב שירות').trim();
      agg.riders.push({ name: label, monthly, raw: r });
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
    const ridersBlurb = p.riders.length
      ? ` · נספחים: ${p.riders.map((r) => `${r.name} (₪${Math.round(r.monthly)})`).join(', ')}`
      : '';
    const note = `${HARB_MARKER} (סנכרון אוטומטי) — ${branches}${ridersBlurb}. דוח: ${ocrData?.report_info?.report_date || ''}`.trim();

    // Pack the rich detail into a metadata object the drill-down page
    // renders. Empty arrays/nulls get filtered so the JSON stays clean.
    const metadata: Record<string, any> = {};
    if (p.coverage_list.size > 0) metadata.coverage = Array.from(p.coverage_list);
    if (p.covered_conditions.size > 0) metadata.covered_conditions = Array.from(p.covered_conditions);
    if (p.beneficiaries) metadata.beneficiaries = p.beneficiaries;
    if (p.monthly_benefit != null) metadata.monthly_benefit = p.monthly_benefit;
    if (p.coverage_percent != null) metadata.coverage_percent = p.coverage_percent;
    if (p.waiting_period) metadata.waiting_period = p.waiting_period;
    if (p.definition) metadata.definition = p.definition;
    if (p.vehicle) metadata.vehicle = p.vehicle;
    if (p.deductible != null) metadata.deductible = p.deductible;
    if (p.property_address) metadata.property_address = p.property_address;
    if (p.building_coverage != null) metadata.building_coverage = p.building_coverage;
    if (p.contents_coverage != null) metadata.contents_coverage = p.contents_coverage;
    if (p.product_type) metadata.product_type = p.product_type;
    if (p.plan_name) metadata.plan_name = p.plan_name;
    if (p.sub_types.size > 0) metadata.sub_types = Array.from(p.sub_types);
    if (p.raw_period) metadata.policy_period = p.raw_period;
    if (p.raw_branches.size > 0) metadata.branches = Array.from(p.raw_branches);
    if (p.riders.length > 0) {
      metadata.riders = p.riders.map((r) => ({
        name: r.name,
        monthly_premium: Math.round(r.monthly * 100) / 100,
      }));
    }
    metadata.source = 'harb';
    metadata.report_date = ocrData?.report_info?.report_date || null;
    metadata.synced_at = new Date().toISOString();

    // annual_premium is GENERATED — never insert it.
    const row = {
      user_id: userId,
      insurance_type: p.insurance_type,
      provider: p.provider,
      policy_number: p.policy_number,
      monthly_premium: Math.round(totalMonthly * 100) / 100,
      coverage_amount: p.coverage_amount != null ? p.coverage_amount : 0,
      status: p.is_active ? 'active' : 'inactive',
      active: p.is_active,
      start_date: p.start_date,
      end_date: p.end_date,
      notes: note,
      metadata,
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

  // Sweep inferred-from-transactions rows that are now shadowed by real
  // policies with the same (provider, insurance_type). Without this the
  // insurance dashboard shows both 'מגדל health 1,074' (inferred) AND
  // three real Magdal health policies — confusing.
  const realKeys = new Set<string>(
    aggregated.map((p) => `${p.provider}|${p.insurance_type}`),
  );
  // Also tolerate slight provider name drift ("מגדל" vs "מגדל חברה לביטוח")
  const realProviderKeysLoose = new Set<string>(
    aggregated.map((p) => `${p.provider.split(/\s|חברה/)[0]}|${p.insurance_type}`),
  );

  const { data: inferredRows } = await supabase
    .from('insurance')
    .select('id, provider, insurance_type, notes')
    .eq('user_id', userId)
    .like('notes', '%הוסק אוטומטית מתנועה בנקאית%');

  if (inferredRows && inferredRows.length > 0) {
    const idsToRemove: string[] = [];
    for (const row of inferredRows as any[]) {
      const key = `${row.provider}|${row.insurance_type}`;
      const looseKey = `${(row.provider || '').split(/\s|חברה/)[0]}|${row.insurance_type}`;
      if (realKeys.has(key) || realProviderKeysLoose.has(looseKey)) {
        idsToRemove.push(row.id);
      }
    }
    if (idsToRemove.length > 0) {
      const { error } = await supabase.from('insurance').delete().in('id', idsToRemove);
      if (error) {
        console.warn('[harb] failed to clean shadowed inferred rows:', error.message);
      } else {
        console.log(`[harb] cleaned ${idsToRemove.length} inferred row(s) shadowed by real policies`);
      }
    }
  }

  console.log(
    `[harb] processed ${result.total} unique policies — +${result.inserted} new, ~${result.updated} updated, ${result.skipped} skipped`,
  );
  return result;
}
