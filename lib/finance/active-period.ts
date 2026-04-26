/**
 * Active Period — pick the most relevant month/range for a user's data.
 *
 * Many dashboard queries filter by "current month". For new users uploading
 * historical statements (e.g. October-November statements arriving in April),
 * the current month is empty and the dashboard appears blank. This helper
 * returns the latest month that actually has confirmed transactions, falling
 * back to the current month only if everything is empty.
 *
 * Use server-side or pass a Supabase client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ActivePeriod {
  /** YYYY-MM-01 — first day of the period */
  start: string;
  /** YYYY-MM-DD — last day of the period (real, accounts for short months) */
  end: string;
  /** YYYY-MM */
  month: string;
  /** Hebrew label e.g. "נובמבר 2025" */
  label: string;
  /** True when we fell back from the current month because it's empty */
  isFallback: boolean;
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function periodForMonth(yyyyMm: string, isFallback: boolean): ActivePeriod {
  const [yStr, mStr] = yyyyMm.split('-');
  const year = parseInt(yStr);
  const month = parseInt(mStr); // 1-12
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${yyyyMm}-${String(lastDay).padStart(2, '0')}`;
  const label = `${HEBREW_MONTHS[month - 1]} ${year}`;
  return { start: `${yyyyMm}-01`, end, month: yyyyMm, label, isFallback };
}

/**
 * Resolve the active month for a user's dashboard.
 * - If the current month has transactions, return that.
 * - Otherwise, return the latest month with confirmed transactions.
 * - If the user has nothing at all, return the current month (UI will show empty state).
 */
export async function getActivePeriod(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActivePeriod> {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);

  const monthStart = `${currentMonth}-01`;

  const { count: currentCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .or('is_summary.is.null,is_summary.eq.false')
    .gte('tx_date', monthStart);

  if ((currentCount ?? 0) > 0) {
    return periodForMonth(currentMonth, false);
  }

  // Find latest month with confirmed transactions
  const { data: latest } = await supabase
    .from('transactions')
    .select('tx_date')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .or('is_summary.is.null,is_summary.eq.false')
    .order('tx_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestDate = (latest as any)?.tx_date as string | undefined;
  if (latestDate) {
    return periodForMonth(latestDate.slice(0, 7), true);
  }

  // No data at all — return current month, UI handles empty state
  return periodForMonth(currentMonth, false);
}

/**
 * Date range covering the last N months ending at the active period.
 * Useful for charts that want N-month context.
 */
export async function getActiveRange(
  supabase: SupabaseClient,
  userId: string,
  months: number = 3,
): Promise<{ start: string; end: string; isFallback: boolean }> {
  const period = await getActivePeriod(supabase, userId);
  const [yStr, mStr] = period.month.split('-');
  const year = parseInt(yStr);
  const month = parseInt(mStr);
  // N months back from period start
  const startDate = new Date(year, month - 1 - (months - 1), 1);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
  return { start, end: period.end, isFallback: period.isFallback };
}
