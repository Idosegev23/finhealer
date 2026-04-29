/**
 * Infer insurance records from confirmed bank/credit transactions.
 *
 * When a user uploads a statement and the categorizer marks expenses with
 * category_group='ביטוחים', we know the user pays SOMETHING for insurance
 * even if they never uploaded the actual policy document. This module
 * creates lightweight `insurance` rows so:
 *
 * - The insurance dashboard shows real coverage instead of an empty state.
 * - The "send-to-advisor" CTA has data to attach.
 * - The user gets prompted (via missing_documents) to upload the real policy
 *   to enrich coverage_amount, policy_number, dates.
 *
 * Idempotency: an inferred row is identified by notes containing
 * 'הוסק אוטומטית' AND the (user_id, provider, insurance_type) tuple.
 * Re-running for the same set of transactions updates the monthly_premium
 * (the sum) instead of creating duplicates. Real policies (no marker) are
 * never touched.
 */

const HEBREW_TO_INSURANCE_TYPE: Record<string, string> = {
  // Direct mappings to insurance_type CHECK values
  'ביטוח חיים': 'life',
  'ביטוח בריאות': 'health',
  'ביטוח סיעודי': 'critical_illness',
  'ביטוח מחלות קשות': 'critical_illness',
  'ביטוח לאובדן כושר עבודה': 'disability',
  'ביטוח אובדן כושר עבודה': 'disability',
  'ביטוח תאונות אישיות': 'accident',
  'ביטוח דירה': 'home',
  'ביטוח מבנה מגורים': 'home',
  'ביטוח מבנה עסקי': 'home',
  'ביטוח תכולהמגורים': 'home', // typo in seed data
  'ביטוח תכולה עסקי': 'home',
  'ביטוח רכב': 'car',
  'ביטוח חובה לרכב': 'car',
  'ביטוח חיות מחמד': 'pet',
  // Catch-alls: business / liability — no clean type, fall back to 'other'
  'ביטוח עסק': 'other',
  'ביטוח אחריות מקצועית': 'other',
  'ביטוח צד ג\'': 'other',
  'ביטוח בריאות לעובדים': 'health',
};

// Categories that look like insurance from the name but ARE NOT —
// social-security/tax/state benefits. Skip these so they don't pollute
// the insurance dashboard.
const NOT_REAL_INSURANCE = /^(ביטוח\s*לאומי|ביטוח\s*בריאות\s*ממלכתי|מס\s*בריאות|דמי\s*ביטוח\s*לאומי)/;

// Vendor-name based hints used as a SECOND chance to refine the type
// when expense_category falls back to 'other'. e.g. category was the
// generic 'ביטוח עסק' but the vendor "מגדל חיים/בריאות" tells us it's
// actually health insurance.
const VENDOR_TYPE_HINTS: Array<[RegExp, string]> = [
  [/חיים\s*\/?\s*בריאות|בריאות.*חיים/, 'health'],
  [/חיים|life/i, 'life'],
  [/בריאות|health/i, 'health'],
  [/סיעוד/, 'critical_illness'],
  [/אובדן\s*כושר/, 'disability'],
  [/תאונ/, 'accident'],
  [/חובה|רכב|car|leasing/i, 'car'],
  [/דירה|מבנה|תכולה|home/i, 'home'],
  [/נסיעות|travel/i, 'travel'],
  [/חיות\s*מחמד|pet/i, 'pet'],
];

// Provider name normalization — collapse the many spellings the OCR
// returns ('ישיר ביטוח', 'ביטוח ישיר', 'ביטוח ישיר ב' …) into one
// canonical form so the inferrer doesn't create a row per spelling.
function normalizeProvider(raw: string): string {
  if (!raw) return '';
  let v = raw.trim();
  // Drop trailing single-letter or noise tokens
  v = v.replace(/\s+(חברה\s*לביטוח(\s*בע"?מ)?|בע"?מ|ביטוח\s*בע"?מ)$/, '');
  // Common collapses
  if (/ישיר/.test(v) && /ביטוח/.test(v)) return 'ישיר';
  if (/^מגדל/.test(v)) return 'מגדל';
  if (/^הראל/.test(v)) return 'הראל';
  if (/^הפניקס/.test(v)) return 'הפניקס';
  if (/^איילון/.test(v)) return 'איילון';
  if (/^מנורה/.test(v)) return 'מנורה';
  if (/^כלל/.test(v)) return 'כלל';
  if (/חקלאי|חקלא/.test(v)) return 'ביטוח חקלאי';
  if (/^ליברה/.test(v)) return 'ליברה';
  if (/^שלמה/.test(v) || /ש\.\s*שלמה/.test(v)) return 'שלמה';
  if (/^שומרה/.test(v)) return 'שומרה';
  return v;
}

const INFERRED_MARKER = 'הוסק אוטומטית מתנועה בנקאית';

interface TxRow {
  vendor: string | null;
  expense_category: string | null;
  category_group: string | null;
  amount: number;
  tx_date: string | null;
}

interface AggregateKey {
  provider: string;
  insurance_type: string;
  source_categories: Set<string>;
  total_paid: number;
  months: Set<string>; // YYYY-MM strings, distinct months observed
  tx_count: number;
}

/**
 * Look at all confirmed insurance-group transactions for the user and
 * upsert lightweight `insurance` records. Returns the count of rows that
 * were inserted or updated.
 */
export async function inferInsuranceFromTransactions(
  supabase: any,
  userId: string,
): Promise<{ inserted: number; updated: number; skipped: number }> {
  const result = { inserted: 0, updated: 0, skipped: 0 };

  // Pull all confirmed insurance-tagged transactions, regardless of
  // statement — we want a stable monthly picture, so re-aggregating each
  // upload converges to the right premium even after corrections.
  // Filter by expense_category LIKE 'ביטוח%' instead of category_group:
  // historic imports often left category_group null even when the named
  // expense_category was set ('ביטוח בריאות', 'ביטוח רכב', etc.).
  const { data: txs, error: txError } = await supabase
    .from('transactions')
    .select('vendor, expense_category, category_group, amount, tx_date')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .eq('type', 'expense')
    .like('expense_category', 'ביטוח%');

  if (txError) {
    console.warn('[inferInsurance] fetch tx failed:', txError.message);
    return result;
  }

  if (!txs || txs.length === 0) return result;

  // Group by (normalized provider, mapped_type). Tax-like categories
  // (ביטוח לאומי, מס בריאות) are NOT real insurance and are skipped.
  // When the category-based mapping falls to 'other', we try vendor
  // hints as a second pass to find a real insurance_type.
  const byKey = new Map<string, AggregateKey>();
  let skippedNotInsurance = 0;
  for (const tx of txs as TxRow[]) {
    const cat = tx.expense_category?.trim();
    if (!cat) continue;
    if (NOT_REAL_INSURANCE.test(cat)) {
      skippedNotInsurance += 1;
      continue;
    }

    const rawVendor = (tx.vendor || '').trim();
    if (rawVendor && NOT_REAL_INSURANCE.test(rawVendor)) {
      skippedNotInsurance += 1;
      continue;
    }

    let insType = HEBREW_TO_INSURANCE_TYPE[cat] || 'other';
    // Vendor-based refinement when category gave us 'other'
    if (insType === 'other' && rawVendor) {
      for (const [pat, t] of VENDOR_TYPE_HINTS) {
        if (pat.test(rawVendor)) {
          insType = t;
          break;
        }
      }
    }

    const provider = normalizeProvider(rawVendor || cat);
    if (!provider) continue;

    const key = `${provider}|${insType}`;
    const month = tx.tx_date ? tx.tx_date.slice(0, 7) : '';
    const existing = byKey.get(key);
    if (existing) {
      existing.total_paid += Number(tx.amount) || 0;
      existing.tx_count += 1;
      existing.source_categories.add(cat);
      if (month) existing.months.add(month);
    } else {
      byKey.set(key, {
        provider,
        insurance_type: insType,
        source_categories: new Set([cat]),
        total_paid: Number(tx.amount) || 0,
        months: new Set(month ? [month] : []),
        tx_count: 1,
      });
    }
  }

  if (skippedNotInsurance > 0) {
    console.log(`[inferInsurance] skipped ${skippedNotInsurance} non-insurance tx (ביטוח לאומי/מס בריאות)`);
  }

  if (byKey.size === 0) return result;

  const { data: existingRows } = await supabase
    .from('insurance')
    .select('id, provider, insurance_type, notes')
    .eq('user_id', userId);

  // Index existing INFERRED rows by key. Real rows (no marker) are skipped
  // so we never overwrite a user's manually-entered policy.
  const inferredByKey = new Map<string, string>();
  (existingRows || []).forEach((row: any) => {
    if (row.notes && String(row.notes).includes(INFERRED_MARKER)) {
      inferredByKey.set(`${row.provider}|${row.insurance_type}`, row.id);
    }
  });

  // Also collect (provider, type) pairs from REAL (non-inferred) rows so
  // we don't insert an inferred duplicate of a policy the user already
  // entered properly.
  const realKeys = new Set<string>();
  (existingRows || []).forEach((row: any) => {
    if (!row.notes || !String(row.notes).includes(INFERRED_MARKER)) {
      realKeys.add(`${row.provider}|${row.insurance_type}`);
    }
  });

  for (const agg of Array.from(byKey.values())) {
    const key = `${agg.provider}|${agg.insurance_type}`;

    // Real policy already exists — don't shadow it with a guess.
    if (realKeys.has(key)) {
      result.skipped += 1;
      continue;
    }

    // Average per month: divide total paid by distinct months observed.
    // Statements span unpredictable windows (one month vs. a year of
    // history) so summing alone over-inflates the premium when there
    // are repeats. With a single observed month, total = monthly.
    const monthSpan = Math.max(agg.months.size, 1);
    const monthlyPremium = Math.round((agg.total_paid / monthSpan) * 100) / 100;

    const note = `${INFERRED_MARKER} — סוכמו ${agg.tx_count} חיובים על פני ${monthSpan} ${
      monthSpan === 1 ? 'חודש' : 'חודשים'
    } תחת "${Array.from(agg.source_categories).join(', ')}". יש להעלות פירוט פוליסה לדיוק הפרטים (סכום כיסוי, מספר פוליסה, תאריכים).`;

    const row = {
      user_id: userId,
      insurance_type: agg.insurance_type,
      provider: agg.provider,
      monthly_premium: monthlyPremium,
      coverage_amount: 0,
      status: 'active',
      active: true,
      notes: note,
      updated_at: new Date().toISOString(),
    };

    const existingId = inferredByKey.get(key);
    if (existingId) {
      const { error } = await supabase
        .from('insurance')
        .update(row)
        .eq('id', existingId);
      if (error) {
        console.warn('[inferInsurance] update failed:', error.message);
      } else {
        result.updated += 1;
      }
    } else {
      const { error } = await supabase.from('insurance').insert(row);
      if (error) {
        console.warn('[inferInsurance] insert failed:', error.message);
      } else {
        result.inserted += 1;
      }
    }
  }

  return result;
}
