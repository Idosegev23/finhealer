import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isQuietTime } from '@/lib/utils/quiet-hours';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/cron/auto-populate-financials
 *
 * Runs daily. For each user with confirmed transactions:
 * 1. Detects recurring income → upserts income_sources
 * 2. Detects recurring loan-like payments → upserts loans
 * 3. Detects recurring expenses → upserts recurring_patterns
 * 4. Builds user_financial_profile from aggregated transaction data
 */
export async function GET(request: Request) {
  try {
    // Auth guard
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users with transactions
    const { data: users } = await supabase
      .from('users')
      .select('id, name, phone')
      .not('id', 'is', null);

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'No users found' });
    }

    const results: any[] = [];

    // Process users in parallel batches of 10
    const BATCH_SIZE = 10;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (user) => {
          const result = await processUser(supabase, user.id);
          return { userId: user.id, name: user.name, ...result };
        })
      );

      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === 'fulfilled') {
          results.push(r.value);
        } else {
          console.error(`[auto-populate] Error for user ${batch[j].id}:`, r.reason?.message || r.reason);
          results.push({ userId: batch[j].id, error: r.reason?.message || 'Unknown error' });
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error('[auto-populate] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function processUser(supabase: any, userId: string) {
  // Get last 6 months of confirmed transactions
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDate = sixMonthsAgo.toISOString().split('T')[0];

  const { data: transactions } = await supabase
    .from('transactions')
    .select('type, amount, vendor, expense_category, expense_type, tx_date, payment_method')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .or('is_summary.is.null,is_summary.eq.false')
    .gte('tx_date', startDate)
    .order('tx_date', { ascending: true });

  if (!transactions || transactions.length < 10) {
    return { skipped: true, reason: 'Not enough transactions' };
  }

  const incomeResult = await detectAndUpsertIncomeSources(supabase, userId, transactions);
  const loanResult = await detectAndUpsertLoans(supabase, userId, transactions);
  const recurringResult = await detectAndUpsertRecurringExpenses(supabase, userId, transactions);
  const profileResult = await buildFinancialProfile(supabase, userId, transactions);

  return {
    incomeSources: incomeResult,
    loans: loanResult,
    recurringExpenses: recurringResult,
    profile: profileResult,
  };
}

// ─── INCOME SOURCES DETECTION ──────────────────────
async function detectAndUpsertIncomeSources(supabase: any, userId: string, transactions: any[]) {
  const incomeTransactions = transactions.filter((t: any) => t.type === 'income');
  if (incomeTransactions.length < 2) return { detected: 0 };

  // Group by vendor (source)
  const vendorMap: Record<string, { amounts: number[]; dates: string[]; category: string }> = {};
  incomeTransactions.forEach((tx: any) => {
    const vendor = tx.vendor || tx.expense_category || 'הכנסה';
    if (!vendorMap[vendor]) vendorMap[vendor] = { amounts: [], dates: [], category: tx.expense_category || '' };
    vendorMap[vendor].amounts.push(Number(tx.amount) || 0);
    vendorMap[vendor].dates.push(tx.tx_date);
  });

  const detected: any[] = [];

  for (const [vendor, data] of Object.entries(vendorMap)) {
    // Need at least 2 occurrences to consider it a recurring source
    if (data.amounts.length < 2) continue;

    // Check if amounts are somewhat consistent (within 30% of each other)
    const avg = data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length;
    const isConsistent = data.amounts.every(a => Math.abs(a - avg) / avg < 0.3);

    if (!isConsistent && data.amounts.length < 3) continue;

    // Determine employment type from category/vendor
    const employmentType = guessEmploymentType(vendor, data.category);

    const sourceName = vendor;
    const avgAmount = Math.round(avg);

    // Upsert income source
    const { error } = await supabase
      .from('income_sources')
      .upsert({
        user_id: userId,
        source_name: sourceName,
        employment_type: employmentType,
        actual_bank_amount: avgAmount,
        net_amount: avgAmount,
        gross_amount: Math.round(avgAmount * 1.2), // estimate gross
        payment_frequency: 'monthly',
        is_primary: data.amounts.length >= 3 && avgAmount > 3000,
        active: true,
      }, {
        onConflict: 'user_id,source_name',
        ignoreDuplicates: false,
      });

    if (!error) {
      detected.push({ source: sourceName, amount: avgAmount, occurrences: data.amounts.length });
    }
  }

  return { detected: detected.length, sources: detected };
}

function guessEmploymentType(vendor: string, category: string): string {
  const v = (vendor + ' ' + category).toLowerCase();
  if (v.includes('משכורת') || v.includes('שכר') || v.includes('salary')) return 'employee';
  if (v.includes('פנסי') || v.includes('ביטוח לאומי')) return 'pension';
  if (v.includes('שכירות') || v.includes('rent')) return 'rental';
  if (v.includes('ביטוח')) return 'insurance_payout';
  if (v.includes('פרילנס') || v.includes('עצמאי') || v.includes('freelance')) return 'self_employed';
  return 'other';
}

// ─── LOAN DETECTION ────────────────────────────────
async function detectAndUpsertLoans(supabase: any, userId: string, transactions: any[]) {
  const expenses = transactions.filter((t: any) => t.type === 'expense');
  if (expenses.length < 5) return { detected: 0 };

  // Group by vendor — look for recurring fixed-amount payments
  const vendorMap: Record<string, { amounts: number[]; dates: string[]; category: string }> = {};
  expenses.forEach((tx: any) => {
    const vendor = tx.vendor || '';
    if (!vendor) return;
    if (!vendorMap[vendor]) vendorMap[vendor] = { amounts: [], dates: [], category: tx.expense_category || '' };
    vendorMap[vendor].amounts.push(Number(tx.amount) || 0);
    vendorMap[vendor].dates.push(tx.tx_date);
  });

  const loanKeywords = ['הלוואה', 'משכנתא', 'הלוואת', 'לאומי', 'דיסקונט', 'הפועלים', 'מזרחי',
    'בנק', 'ליסינג', 'leasing', 'mortgage', 'loan', 'חוב', 'תשלום חודשי',
    'מימון', 'אשראי', 'car2go', 'yes', 'hot', 'פרטנר', 'סלקום'];
  const loanCategoryKeywords = ['הלוואה', 'משכנתא', 'חוב', 'ליסינג', 'מימון'];

  const detected: any[] = [];

  for (const [vendor, data] of Object.entries(vendorMap)) {
    if (data.amounts.length < 2) continue;

    // Check if it's a consistent recurring payment (loan-like)
    const avg = data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length;
    const isConsistent = data.amounts.every(a => Math.abs(a - avg) / avg < 0.05); // Within 5%

    if (!isConsistent) continue;
    if (avg < 100) continue; // Too small for a loan

    // Check if vendor or category looks like a loan
    const combined = (vendor + ' ' + data.category).toLowerCase();
    const looksLikeLoan = loanKeywords.some(kw => combined.includes(kw)) ||
      loanCategoryKeywords.some(kw => data.category.toLowerCase().includes(kw));

    // Also treat very consistent high payments (>500) with 3+ occurrences as potential loans
    const isLikelyLoan = looksLikeLoan || (isConsistent && avg > 500 && data.amounts.length >= 3);

    if (!isLikelyLoan) continue;

    const loanType = guessloanType(vendor, data.category);
    const monthlyPayment = Math.round(avg);

    // Estimate remaining balance and original amount
    const estimatedBalance = monthlyPayment * 48;
    const estimatedOriginal = monthlyPayment * 60;

    const { error } = await supabase
      .from('loans')
      .upsert({
        user_id: userId,
        lender_name: vendor,
        loan_type: loanType,
        monthly_payment: monthlyPayment,
        current_balance: estimatedBalance,
        original_amount: estimatedOriginal,
        active: true,
      }, {
        onConflict: 'user_id,lender_name',
        ignoreDuplicates: false,
      });

    if (!error) {
      detected.push({ lender: vendor, monthly: monthlyPayment, type: loanType });
    }
  }

  return { detected: detected.length, loans: detected };
}

function guessloanType(vendor: string, category: string): string {
  const v = (vendor + ' ' + category).toLowerCase();
  if (v.includes('משכנתא') || v.includes('mortgage')) return 'mortgage';
  if (v.includes('ליסינג') || v.includes('leasing') || v.includes('רכב')) return 'car';
  if (v.includes('סטודנט') || v.includes('לימוד')) return 'student';
  return 'personal';
}

// ─── RECURRING EXPENSE DETECTION ─────────────────────
async function detectAndUpsertRecurringExpenses(supabase: any, userId: string, transactions: any[]) {
  const expenses = transactions.filter((t: any) => t.type === 'expense');
  if (expenses.length < 5) return { detected: 0 };

  // Group by normalized vendor
  const vendorMap: Record<string, { amounts: number[]; dates: string[]; category: string; expenseType: string }> = {};
  expenses.forEach((tx: any) => {
    const vendor = (tx.vendor || '').trim();
    if (!vendor || vendor.length < 2) return;
    const key = vendor.toLowerCase().replace(/[0-9\-]/g, '').trim();
    if (!key) return;
    if (!vendorMap[key]) vendorMap[key] = { amounts: [], dates: [], category: tx.expense_category || '', expenseType: tx.expense_type || 'variable' };
    vendorMap[key].amounts.push(Math.abs(Number(tx.amount) || 0));
    vendorMap[key].dates.push(tx.tx_date);
  });

  const detected: any[] = [];

  for (const [normalizedVendor, data] of Object.entries(vendorMap)) {
    if (data.amounts.length < 2) continue;

    // Check amount consistency (within 10%)
    const avg = data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length;
    if (avg < 20) continue; // Too small
    const isConsistent = data.amounts.every(a => Math.abs(a - avg) / avg < 0.10);
    if (!isConsistent) continue;

    // Check it spans at least 2 different months
    const months = new Set(data.dates.map(d => d.substring(0, 7)));
    if (months.size < 2) continue;

    // Calculate frequency
    const sortedMonths = Array.from(months).sort();
    const gaps: number[] = [];
    for (let i = 1; i < sortedMonths.length; i++) {
      const [y1, m1] = sortedMonths[i - 1].split('-').map(Number);
      const [y2, m2] = sortedMonths[i].split('-').map(Number);
      gaps.push((y2 - y1) * 12 + (m2 - m1));
    }
    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 1;
    const frequency = avgGap <= 1.5 ? 'monthly' : avgGap <= 2.5 ? 'bi-monthly' : avgGap <= 4 ? 'quarterly' : 'yearly';

    // Calculate expected day of month
    const days = data.dates.map(d => new Date(d).getDate());
    const avgDay = Math.round(days.reduce((a, b) => a + b, 0) / days.length);

    // Calculate next expected date
    const lastDate = new Date(data.dates.sort().pop()!);
    const nextExpected = new Date(lastDate);
    switch (frequency) {
      case 'monthly': nextExpected.setMonth(nextExpected.getMonth() + 1); break;
      case 'bi-monthly': nextExpected.setMonth(nextExpected.getMonth() + 2); break;
      case 'quarterly': nextExpected.setMonth(nextExpected.getMonth() + 3); break;
      case 'yearly': nextExpected.setFullYear(nextExpected.getFullYear() + 1); break;
    }
    nextExpected.setDate(avgDay);

    // Get original vendor name (not normalized)
    const originalVendor = expenses.find((tx: any) =>
      (tx.vendor || '').toLowerCase().replace(/[0-9\-]/g, '').trim() === normalizedVendor
    )?.vendor || normalizedVendor;

    // Upsert into recurring_patterns
    const { error } = await supabase
      .from('recurring_patterns')
      .upsert({
        user_id: userId,
        vendor: originalVendor,
        amount: Math.round(avg),
        expected_amount: Math.round(avg),
        frequency,
        expected_day: avgDay,
        day_tolerance: 3,
        next_expected: nextExpected.toISOString().split('T')[0],
        last_occurrence: data.dates.sort().pop(),
        occurrence_count: data.amounts.length,
        missed_count: 0,
        status: 'active',
        is_auto_detected: true,
        pattern_type: 'expense',
        category: data.category || null,
        expense_type: data.expenseType || 'variable',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,vendor',
        ignoreDuplicates: false,
      });

    if (!error) {
      detected.push({ vendor: originalVendor, amount: Math.round(avg), frequency, months: months.size });
    } else {
      console.warn(`[auto-populate] recurring upsert error for ${originalVendor}:`, error.message);
    }
  }

  return { detected: detected.length, patterns: detected };
}

// ─── FINANCIAL PROFILE FROM TRANSACTIONS ───────────
// Uses actual user_financial_profile columns: monthly_income, total_monthly_income,
// total_fixed_expenses, rent_mortgage, insurance, etc.
async function buildFinancialProfile(supabase: any, userId: string, transactions: any[]) {
  // Group transactions by month
  const monthlyData: Record<string, { income: number; expenses: number; fixedExpenses: number }> = {};
  // Track fixed expense categories for profile columns
  const fixedCatTotals: Record<string, number> = {};

  transactions.forEach((tx: any) => {
    const month = tx.tx_date?.substring(0, 7);
    if (!month) return;
    if (!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0, fixedExpenses: 0 };

    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      monthlyData[month].income += amount;
    } else {
      monthlyData[month].expenses += amount;
      if (tx.expense_type === 'fixed') {
        monthlyData[month].fixedExpenses += amount;
        const cat = (tx.expense_category || '').toLowerCase();
        fixedCatTotals[cat] = (fixedCatTotals[cat] || 0) + amount;
      }
    }
  });

  const months = Object.values(monthlyData);
  if (months.length === 0) return { updated: false };

  const numMonths = months.length;
  const avgIncome = Math.round(months.reduce((s, m) => s + m.income, 0) / numMonths);
  const avgFixed = Math.round(months.reduce((s, m) => s + m.fixedExpenses, 0) / numMonths);

  // Map detected fixed categories to profile columns
  const catAvg = (keywords: string[]) => {
    let total = 0;
    for (const [cat, amount] of Object.entries(fixedCatTotals)) {
      if (keywords.some(kw => cat.includes(kw))) total += amount;
    }
    return Math.round(total / numMonths);
  };

  // Note: total_monthly_income and total_fixed_expenses are generated columns — do NOT insert
  const profileData: Record<string, any> = {
    user_id: userId,
    monthly_income: avgIncome,
    completed: true,
    completed_at: new Date().toISOString(),
    // Map transaction categories to profile columns
    rent_mortgage: catAvg(['שכירות', 'משכנתא', 'דירה', 'שכ"ד']),
    insurance: catAvg(['ביטוח']),
    electricity: catAvg(['חשמל']),
    water: catAvg(['מים']),
    gas: catAvg(['גז']),
    cellular: catAvg(['סלולר', 'טלפון', 'פלאפון', 'פרטנר', 'סלקום', 'הוט מובייל']),
    internet: catAvg(['אינטרנט', 'בזק', 'הוט']),
    education: catAvg(['חינוך', 'לימוד', 'קורס']),
    subscriptions: catAvg(['מנוי', 'נטפליקס', 'ספוטיפיי', 'streaming']),
    fuel: catAvg(['דלק', 'בנזין', 'סונול', 'פז', 'דור אלון']),
  };

  // Remove zero values to not overwrite manual data with zeros
  for (const key of Object.keys(profileData)) {
    if (profileData[key] === 0) {
      delete profileData[key];
    }
  }

  const { error } = await supabase
    .from('user_financial_profile')
    .upsert(profileData, { onConflict: 'user_id' });

  if (error) {
    console.error(`[auto-populate] Profile upsert error for ${userId}:`, error.message);
    return { updated: false, error: error.message };
  }

  return { updated: true, avgIncome, avgFixed };
}
