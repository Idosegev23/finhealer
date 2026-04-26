/**
 * Mislaka (Israeli Pension Clearinghouse) Report Handler
 *
 * Mislaka reports are produced by the Israeli pension clearinghouse and
 * aggregate ALL of a person's pension funds, study funds, life insurance,
 * mortgage insurance, etc. across providers (מנורה, מגדל, מיטב דש, הראל…).
 *
 * Output structure expected from Gemini OCR (per getPensionStatementPrompt):
 * {
 *   report_info: { customer_name, id_number, report_date, total_balance, total_monthly_deposit, ... },
 *   pension_plans: [
 *     { plan_type, provider, plan_name, policy_number, status, start_date,
 *       current_balance, monthly_deposit, employer_deposit, employee_deposit,
 *       management_fees, retirement_age, capital_savings, retirement_forecast,
 *       investment_track, insurance_coverage }
 *   ],
 *   insurance_policies?: [   // pure-risk: life, mortgage, disability
 *     { provider, policy_number, policy_type, coverage_amount, monthly_premium,
 *       start_date, end_date, status }
 *   ],
 *   insurance_summary?: { life_insurance, disability, ... }
 * }
 *
 * The handler is idempotent — same policy_number from a re-uploaded report
 * UPDATES the existing row instead of creating a duplicate.
 */

// Inline date parser — period-tracker keeps theirs private and we want zero coupling.
function parseDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  // dd/MM/yyyy or dd-MM-yyyy
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m1) {
    let [, dd, mm, yy] = m1;
    if (yy.length === 2) yy = (parseInt(yy) > 50 ? '19' : '20') + yy;
    return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // yyyy-MM-dd already
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  // MM/yyyy
  const m3 = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m3) return `${m3[2]}-${m3[1].padStart(2, '0')}-01`;
  return null;
}

interface MislakaResult {
  pensionsUpserted: number;
  insurancesUpserted: number;
  totalBalance: number;
  totalMonthlyDeposit: number;
  summary: {
    pensionFunds: number;
    studyFunds: number;
    providentFunds: number;
    insurancePolicies: number;
    purerisk: number;
  };
}

// Map plan_type from OCR to fund_type column on pension_insurance.
// DB CHECK constraint allows: pension_fund | provident_fund |
// advanced_study_fund | managers_insurance | investment_provident.
const FUND_TYPE_MAP: Record<string, string> = {
  pension_fund: 'pension_fund',
  provident_fund: 'provident_fund',
  study_fund: 'advanced_study_fund',
  insurance_policy: 'managers_insurance',          // ביטוח מנהלים / פוליסה משולבת חיסכון
  life_combined_savings: 'managers_insurance',
  investment_provident: 'investment_provident',
  // legacy aliases
  pension: 'pension_fund',
  provident: 'provident_fund',
  study: 'advanced_study_fund',
};

export async function handleMislakaReport(
  supabase: any,
  userId: string,
  ocrData: any,
  documentId: string | null,
): Promise<MislakaResult> {
  const result: MislakaResult = {
    pensionsUpserted: 0,
    insurancesUpserted: 0,
    totalBalance: 0,
    totalMonthlyDeposit: 0,
    summary: { pensionFunds: 0, studyFunds: 0, providentFunds: 0, insurancePolicies: 0, purerisk: 0 },
  };

  // ──────────────── Pension plans ────────────────
  const plans = Array.isArray(ocrData?.pension_plans) ? ocrData.pension_plans : [];

  // Pre-fetch existing rows so we can do upsert-by-policy_number
  const { data: existingPensions } = await supabase
    .from('pension_insurance')
    .select('id, policy_number, provider')
    .eq('user_id', userId);
  const existingByPolicy = new Map<string, string>();
  (existingPensions || []).forEach((row: any) => {
    if (row.policy_number) {
      existingByPolicy.set(`${row.provider || ''}|${row.policy_number}`, row.id);
    }
  });

  for (const plan of plans) {
    if (!plan.policy_number && !plan.plan_name) continue;

    const fundType = FUND_TYPE_MAP[(plan.plan_type || '').toLowerCase()] || 'other';
    const balance = Number(plan.current_balance || plan.pension_savings || 0) || 0;
    const monthlyDeposit = Number(plan.monthly_deposit || plan.employee_deposit || 0) || 0;

    // management_fees can be either a number ("1.15") or an object
    // ({ from_balance, from_deposit, from_accumulation }). Extract both.
    const fees = plan.management_fees;
    const mgmtFromBalance = typeof fees === 'object' && fees !== null
      ? parseManagementFee(fees.from_balance ?? fees.from_accumulation)
      : parseManagementFee(fees);
    const mgmtFromDeposit = typeof fees === 'object' && fees !== null
      ? parseManagementFee(fees.from_deposit)
      : null;

    // annual_return can be a number, an object, or an array of yearly returns
    const annualReturn = (() => {
      const r = plan.annual_return;
      if (typeof r === 'number') return r;
      if (typeof r === 'string') return parseManagementFee(r);
      if (typeof r === 'object' && r !== null) {
        return parseManagementFee(r.average ?? r.annual ?? r.last_year);
      }
      return null;
    })();

    const row = {
      user_id: userId,
      fund_name: plan.plan_name || plan.provider || 'לא צוין',
      fund_type: fundType,
      provider: plan.provider || 'לא צוין',
      policy_number: plan.policy_number || null,
      employee_type: plan.employee_type || null,
      current_balance: balance,
      monthly_deposit: monthlyDeposit,
      employer_contribution: Number(plan.employer_deposit || plan.employer_contribution || 0) || 0,
      employee_contribution: Number(plan.employee_deposit || plan.monthly_deposit || 0) || 0,
      management_fee_percentage: mgmtFromBalance,
      deposit_fee_percentage: mgmtFromDeposit,
      annual_return: annualReturn,
      start_date: parseDate(plan.start_date),
      seniority_date: parseDate(plan.seniority_date || plan.start_date),
      active: plan.status !== 'closed' && plan.status !== 'תום תקופה' && plan.status !== 'מוקפא/מסולק/לא פעיל',
      notes: JSON.stringify({
        retirement_age: plan.retirement_age,
        capital_savings: plan.capital_savings,
        retirement_forecast: plan.retirement_forecast,
        investment_track: plan.investment_track,
        insurance_coverage: plan.insurance_coverage,
        management_fees_raw: plan.management_fees,
        annual_return_raw: plan.annual_return,
        returns_history: plan.returns_history || plan.returns,
        document_id: documentId,
        source: 'mislaka',
      }),
    };

    const key = `${row.provider}|${row.policy_number}`;
    const existingId = row.policy_number ? existingByPolicy.get(key) : undefined;

    if (existingId) {
      const { error } = await supabase.from('pension_insurance').update(row).eq('id', existingId);
      if (!error) result.pensionsUpserted += 1;
      else console.error('[mislaka] update pension failed:', { policy: row.policy_number, error });
    } else {
      const { error } = await supabase.from('pension_insurance').insert(row);
      if (!error) result.pensionsUpserted += 1;
      else console.error('[mislaka] insert pension failed:', { policy: row.policy_number, plan_type: plan.plan_type, fund_type: fundType, error });
    }

    // Counters by type — match the actual DB enum values
    if (fundType === 'pension_fund') result.summary.pensionFunds += 1;
    else if (fundType === 'advanced_study_fund') result.summary.studyFunds += 1;
    else if (fundType === 'provident_fund') result.summary.providentFunds += 1;
    else result.summary.insurancePolicies += 1;
    result.totalBalance += balance;
    result.totalMonthlyDeposit += monthlyDeposit;
  }

  // ──────────────── Pure-risk insurance policies ────────────────
  const policies = Array.isArray(ocrData?.insurance_policies) ? ocrData.insurance_policies : [];

  const { data: existingInsurances } = await supabase
    .from('insurance')
    .select('id, policy_number, provider')
    .eq('user_id', userId);
  const existingInsByPolicy = new Map<string, string>();
  (existingInsurances || []).forEach((row: any) => {
    if (row.policy_number) {
      existingInsByPolicy.set(`${row.provider || ''}|${row.policy_number}`, row.id);
    }
  });

  for (const policy of policies) {
    if (!policy.policy_number && !policy.provider) continue;

    const isActive = policy.status !== 'closed' && policy.status !== 'cancelled' && policy.status !== 'inactive';
    // annual_premium is a GENERATED column (monthly_premium * 12) — never insert it.
    const insRow = {
      user_id: userId,
      insurance_type: mapInsuranceType(policy.policy_type, policy.plan_name),
      provider: policy.provider || 'לא צוין',
      policy_number: policy.policy_number || null,
      status: isActive ? 'active' : 'inactive',  // CHECK: active|inactive|cancelled
      coverage_amount: Number(policy.coverage_amount || 0) || 0,
      monthly_premium: Number(policy.monthly_premium || policy.premium_amount || 0) || 0,
      start_date: parseDate(policy.start_date),
      end_date: parseDate(policy.end_date),
      active: isActive,
      notes: JSON.stringify({
        plan_name: policy.plan_name,
        document_id: documentId,
        source: 'mislaka',
      }),
    };

    const key = `${insRow.provider}|${insRow.policy_number}`;
    const existingId = insRow.policy_number ? existingInsByPolicy.get(key) : undefined;

    if (existingId) {
      const { error } = await supabase.from('insurance').update(insRow).eq('id', existingId);
      if (!error) result.insurancesUpserted += 1;
      else console.error('[mislaka] update insurance failed:', { policy: insRow.policy_number, error });
    } else {
      const { error } = await supabase.from('insurance').insert(insRow);
      if (!error) result.insurancesUpserted += 1;
      else console.error('[mislaka] insert insurance failed:', { policy: insRow.policy_number, type: insRow.insurance_type, error });
    }
    result.summary.purerisk += 1;
  }

  // Use report_info totals if extraction had them — more accurate than summing parts
  if (ocrData?.report_info?.total_balance) {
    result.totalBalance = Number(ocrData.report_info.total_balance) || result.totalBalance;
  }
  if (ocrData?.report_info?.total_monthly_deposit) {
    result.totalMonthlyDeposit = Number(ocrData.report_info.total_monthly_deposit) || result.totalMonthlyDeposit;
  }

  return result;
}

function parseManagementFee(raw: any): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  // "1.15%" or "1.15" — strip % and parse
  const cleaned = String(raw).replace(/%/g, '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function mapInsuranceType(policyType?: string, planName?: string): string {
  const text = `${policyType || ''} ${planName || ''}`.toLowerCase();
  if (/משכנתא|mortgage/.test(text)) return 'life';  // mortgage life insurance
  if (/מגן.*זוגי|אקסטרה|life|חיים/.test(text)) return 'life';
  if (/בריאות|health/.test(text)) return 'health';
  if (/סיעוד/.test(text)) return 'critical_illness';
  if (/אכ"ע|אובדן כושר|disability/.test(text)) return 'disability';
  if (/תאונ/.test(text)) return 'accident';
  return 'life';
}

export function formatMislakaSummary(r: MislakaResult, customerName?: string): string {
  const lines: string[] = [];
  lines.push(`🏦 *דוח מסלקה התקבל!*${customerName ? `  (${customerName})` : ''}`);
  lines.push('');
  const totalPlans = r.summary.pensionFunds + r.summary.studyFunds + r.summary.providentFunds + r.summary.insurancePolicies;
  lines.push(`✅ זוהו *${totalPlans}* תוכניות:`);
  if (r.summary.pensionFunds) lines.push(`  📈 קרנות פנסיה: ${r.summary.pensionFunds}`);
  if (r.summary.studyFunds) lines.push(`  💼 קרנות השתלמות: ${r.summary.studyFunds}`);
  if (r.summary.providentFunds) lines.push(`  🏦 קופות גמל: ${r.summary.providentFunds}`);
  if (r.summary.insurancePolicies) lines.push(`  📊 פוליסות חיסכון: ${r.summary.insurancePolicies}`);
  if (r.summary.purerisk) lines.push(`  🛡️ ביטוחי חיים/משכנתא: ${r.summary.purerisk}`);
  lines.push('');
  lines.push(`💰 סך חיסכון: ₪${Math.round(r.totalBalance).toLocaleString('he-IL')}`);
  if (r.totalMonthlyDeposit > 0) {
    lines.push(`📥 הפקדות חודשיות: ₪${Math.round(r.totalMonthlyDeposit).toLocaleString('he-IL')}`);
  }
  lines.push('');
  lines.push('צפה בכל הפרטים בדפי הפנסיה והביטוח בדשבורד.');
  return lines.join('\n');
}
