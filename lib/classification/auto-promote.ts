/**
 * Auto-Promote — turn detected recurring transactions into first-class records.
 *
 * The recurring-detector finds candidate patterns and flags transactions
 * (is_recurring=true). This module takes the next step: promote those
 * candidates into actual `income_sources` (for incomes) and `recurring_patterns`
 * (for expenses), so the dashboard reflects what the data already says.
 *
 * Triggered after PDF/Excel imports complete. Idempotent — re-runs are safe
 * because each upsert checks for an existing similar entry first.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { detectUserRecurringExpenses, type RecurringCandidate, markAsRecurring } from './recurring-detector';

interface PromoteResult {
  incomesCreated: number;
  recurringCreated: number;
  txMarked: number;
  detected: number;
}

const MIN_CONFIDENCE = 0.7;
const MIN_OCCURRENCES = 2;
const MIN_INCOME_AMOUNT = 1000;
const MIN_RECURRING_AMOUNT = 20;

function inferEmploymentType(c: RecurringCandidate): string {
  const name = (c.vendorName || '').toLowerCase();
  if (/משכורת|salary|payroll/i.test(name)) return 'salary';
  if (/פרילנס|freelance|חשבונית/i.test(name)) return 'freelance';
  if (/דיב|dividend|ריבית|פיקדון/i.test(name)) return 'passive';
  return 'salary';
}

function pickExpectedDay(c: RecurringCandidate): number | null {
  const days = c.transactions
    .map(tx => new Date(tx.tx_date).getDate())
    .filter(d => Number.isFinite(d));
  if (!days.length) return null;
  return days[0];
}

function nextExpectedDate(day: number | null): string {
  const today = new Date();
  const next = new Date(today.getFullYear(), today.getMonth() + 1, day ?? today.getDate());
  return next.toISOString().split('T')[0];
}

export async function autoPromoteFromTransactions(userId: string): Promise<PromoteResult> {
  const supabase = createServiceClient();
  const result: PromoteResult = { incomesCreated: 0, recurringCreated: 0, txMarked: 0, detected: 0 };

  const { detected } = await detectUserRecurringExpenses(userId);
  result.detected = detected.length;
  if (!detected.length) return result;

  // Existing first-class records — to avoid duplicates
  const [{ data: existingIncomes }, { data: existingRecurring }] = await Promise.all([
    supabase.from('income_sources').select('source_name, employer_name, net_amount').eq('user_id', userId),
    supabase.from('recurring_patterns').select('vendor, expected_amount').eq('user_id', userId),
  ]);

  const incomeKeys = new Set(
    (existingIncomes || []).map((r: any) => `${(r.source_name || '').toLowerCase().trim()}|${Math.round(Number(r.net_amount) || 0)}`)
  );
  const recurringKeys = new Set(
    (existingRecurring || []).map((r: any) => `${(r.vendor || '').toLowerCase().trim()}|${Math.round(Number(r.expected_amount) || 0)}`)
  );

  const txIdsToMark: string[] = [];

  for (const c of detected) {
    if (c.confidence < MIN_CONFIDENCE) continue;
    if (c.occurrences < MIN_OCCURRENCES) continue;

    if (c.type === 'income') {
      if (c.averageAmount < MIN_INCOME_AMOUNT) continue;
      const key = `${c.vendorName.toLowerCase().trim()}|${Math.round(c.averageAmount)}`;
      if (incomeKeys.has(key)) continue;

      const empType = inferEmploymentType(c);
      const { error } = await supabase.from('income_sources').insert({
        user_id: userId,
        source_name: c.vendorName,
        employment_type: empType,
        net_amount: Math.round(c.averageAmount),
        payment_frequency: c.frequency === 'monthly' ? 'monthly' : c.frequency,
        is_primary: result.incomesCreated === 0 && existingIncomes?.length === 0,
        active: true,
        notes: `זוהה אוטומטית מתנועות (${c.occurrences} חודשים, ${Math.round(c.confidence * 100)}% ביטחון)`,
      });
      if (!error) {
        result.incomesCreated += 1;
        incomeKeys.add(key);
        c.transactions.forEach(tx => txIdsToMark.push(tx.id));
      } else {
        console.error('[auto-promote] income_sources insert failed:', error);
      }
    } else {
      if (c.averageAmount < MIN_RECURRING_AMOUNT) continue;
      const key = `${c.vendorName.toLowerCase().trim()}|${Math.round(c.averageAmount)}`;
      if (recurringKeys.has(key)) continue;

      const day = pickExpectedDay(c);
      const insertData: any = {
        user_id: userId,
        vendor: c.vendorName,
        expected_amount: Math.round(c.averageAmount * 100) / 100,
        frequency: c.frequency === 'bi-monthly' ? 'monthly' : c.frequency,
        next_expected: nextExpectedDate(day),
        status: 'active',
        is_auto_detected: true,
        confidence: c.confidence,
        occurrence_count: c.occurrences,
      };
      if (day) insertData.expected_day = day;

      const { error } = await supabase.from('recurring_patterns').insert(insertData);
      if (!error) {
        result.recurringCreated += 1;
        recurringKeys.add(key);
        c.transactions.forEach(tx => txIdsToMark.push(tx.id));
      } else {
        console.error('[auto-promote] recurring_patterns insert failed:', error);
      }
    }
  }

  if (txIdsToMark.length > 0) {
    const marked = await markAsRecurring(userId, Array.from(new Set(txIdsToMark)));
    result.txMarked = marked.count;
  }

  return result;
}

export function formatPromoteSummary(r: PromoteResult): string | null {
  if (r.incomesCreated === 0 && r.recurringCreated === 0) return null;
  const parts: string[] = ['🤖 *זוהה אוטומטית מהדוח:*'];
  if (r.incomesCreated > 0) parts.push(`💰 ${r.incomesCreated} מקור${r.incomesCreated === 1 ? '' : 'ות'} הכנסה`);
  if (r.recurringCreated > 0) parts.push(`🔄 ${r.recurringCreated} חיוב${r.recurringCreated === 1 ? '' : 'ים'} קבוע${r.recurringCreated === 1 ? '' : 'ים'}`);
  parts.push('\nאפשר לראות הכל בדף הטבלה הפיננסית באתר.');
  return parts.join('\n');
}
