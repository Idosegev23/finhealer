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
 * 3. Builds user_financial_profile from aggregated transaction data
 */
export async function GET(request: Request) {
  try {
    // Auth guard
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

    for (const user of users) {
      try {
        const result = await processUser(supabase, user.id);
        results.push({ userId: user.id, name: user.name, ...result });
      } catch (err: any) {
        console.error(`[auto-populate] Error for user ${user.id}:`, err.message);
        results.push({ userId: user.id, error: err.message });
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
    .gte('tx_date', startDate)
    .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true')
    .order('tx_date', { ascending: true });

  if (!transactions || transactions.length < 10) {
    return { skipped: true, reason: 'Not enough transactions' };
  }

  const incomeResult = await detectAndUpsertIncomeSources(supabase, userId, transactions);
  const loanResult = await detectAndUpsertLoans(supabase, userId, transactions);
  const profileResult = await buildFinancialProfile(supabase, userId, transactions);

  return {
    incomeSources: incomeResult,
    loans: loanResult,
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
