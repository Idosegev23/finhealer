// Infer loans from user financial profile
// This function creates loan records based on what the user filled in reflection

interface ProfileData {
  rent_mortgage?: number;
  bank_loans?: number;
  other_debts?: number;
  leasing?: number;
}

interface InferredLoan {
  lender_name: string;
  loan_type: 'mortgage' | 'personal' | 'credit' | 'car' | 'other';
  monthly_payment: number;
  current_balance: number;
  interest_rate: number;
  remaining_payments: number;
  source: 'inferred_from_profile';
  notes?: string;
}

/**
 * Infer loans from user financial profile
 * Creates loan records based on what was filled in reflection
 */
export function inferLoansFromProfile(profile: ProfileData): InferredLoan[] {
  const inferredLoans: InferredLoan[] = [];

  // Mortgage (משכנתא)
  if (profile.rent_mortgage && profile.rent_mortgage > 0) {
    // Assume average mortgage: 20 years (240 months), 3.5% interest
    // Work backwards from monthly payment to estimate balance
    const monthlyPayment = profile.rent_mortgage;
    const estimatedBalance = estimateLoanBalance(monthlyPayment, 3.5, 240);
    
    inferredLoans.push({
      lender_name: 'משכנתא (הוסק אוטומטית)',
      loan_type: 'mortgage',
      monthly_payment: monthlyPayment,
      current_balance: estimatedBalance,
      interest_rate: 3.5,
      remaining_payments: 240,
      source: 'inferred_from_profile',
      notes: 'נתון זה הוסק מהשדה "דיור/משכנתא" שמילאת בשלב הראשון. מומלץ לעדכן עם הנתונים המדויקים.',
    });
  }

  // Bank Loans (הלוואות בנק)
  if (profile.bank_loans && profile.bank_loans > 0) {
    // Assume average personal loan: 5 years (60 months), 8% interest
    const monthlyPayment = profile.bank_loans;
    const estimatedBalance = estimateLoanBalance(monthlyPayment, 8, 60);
    
    inferredLoans.push({
      lender_name: 'הלוואת בנק (הוסק אוטומטית)',
      loan_type: 'personal',
      monthly_payment: monthlyPayment,
      current_balance: estimatedBalance,
      interest_rate: 8,
      remaining_payments: 60,
      source: 'inferred_from_profile',
      notes: 'נתון זה הוסק מהשדה "הלוואות בנק" שמילאת בשלב הראשון. מומלץ לעדכן עם הנתונים המדויקים.',
    });
  }

  // Leasing (ליסינג רכב)
  if (profile.leasing && profile.leasing > 0) {
    // Assume car lease: 3 years (36 months), 5% interest
    const monthlyPayment = profile.leasing;
    const estimatedBalance = estimateLoanBalance(monthlyPayment, 5, 36);
    
    inferredLoans.push({
      lender_name: 'ליסינג רכב (הוסק אוטומטית)',
      loan_type: 'car',
      monthly_payment: monthlyPayment,
      current_balance: estimatedBalance,
      interest_rate: 5,
      remaining_payments: 36,
      source: 'inferred_from_profile',
      notes: 'נתון זה הוסק מהשדה "ליסינג" שמילאת בשלב הראשון. מומלץ לעדכן עם הנתונים המדויקים.',
    });
  }

  // Other Debts (חובות אחרים)
  if (profile.other_debts && profile.other_debts > 0) {
    // Assume generic loan: 3 years (36 months), 10% interest
    const monthlyPayment = profile.other_debts;
    const estimatedBalance = estimateLoanBalance(monthlyPayment, 10, 36);
    
    inferredLoans.push({
      lender_name: 'חוב אחר (הוסק אוטומטית)',
      loan_type: 'other',
      monthly_payment: monthlyPayment,
      current_balance: estimatedBalance,
      interest_rate: 10,
      remaining_payments: 36,
      source: 'inferred_from_profile',
      notes: 'נתון זה הוסק מהשדה "חובות אחרים" שמילאת בשלב הראשון. מומלץ לעדכן עם הנתונים המדויקים.',
    });
  }

  return inferredLoans;
}

/**
 * Estimate loan balance from monthly payment
 * Uses standard loan amortization formula working backwards
 */
function estimateLoanBalance(
  monthlyPayment: number,
  annualInterestRate: number,
  remainingMonths: number
): number {
  if (annualInterestRate === 0) {
    return monthlyPayment * remainingMonths;
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  const balance =
    (monthlyPayment * (Math.pow(1 + monthlyRate, remainingMonths) - 1)) /
    (monthlyRate * Math.pow(1 + monthlyRate, remainingMonths));

  return Math.round(balance);
}

/**
 * Check if a loan was inferred (vs. manually entered)
 */
export function isInferredLoan(loan: any): boolean {
  return (
    loan.notes?.includes('הוסק אוטומטית') ||
    loan.lender_name?.includes('(הוסק אוטומטית)')
  );
}

