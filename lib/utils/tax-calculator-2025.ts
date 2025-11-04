/**
 * Tax Calculator for Israel 2025
 * מחשבון מס ישראלי לשנת 2025
 * 
 * כולל:
 * - מדרגות מס הכנסה
 * - ביטוח לאומי
 * - מס בריאות
 * - נקודות זיכוי
 * - חישובי פנסיה וקרן השתלמות
 */

// ============================================================================
// קבועים - שנת 2025
// ============================================================================

/** מדרגות מס הכנסה 2025 (חודשי) */
export const TAX_BRACKETS_2025 = [
  { max: 7010, rate: 0.10 },       // 10%
  { max: 10060, rate: 0.14 },      // 14%
  { max: 16150, rate: 0.20 },      // 20%
  { max: 22440, rate: 0.31 },      // 31%
  { max: 46690, rate: 0.35 },      // 35%
  { max: 60900, rate: 0.47 },      // 47%
  { max: Infinity, rate: 0.50 },   // 50%
] as const;

/** נקודת זיכוי חודשית */
export const CREDIT_POINT_VALUE_2025 = 266;

/** נקודות זיכוי בסיס */
export const BASE_CREDIT_POINTS = 2.25;

/** סף ביטוח לאומי מופחת */
export const NATIONAL_INSURANCE_THRESHOLD = 7522;

/** תקרת ביטוח לאומי חודשית */
export const NATIONAL_INSURANCE_CEILING = 49030;

/** שיעורי ביטוח לאומי לשכיר */
export const EMPLOYEE_NATIONAL_INSURANCE = {
  lower: 0.035,  // 3.5% עד סף
  upper: 0.07,   // 7% מעל סף עד תקרה
};

/** שיעורי ביטוח לאומי לעצמאי */
export const SELF_EMPLOYED_NATIONAL_INSURANCE = {
  lower: 0.1783,  // 17.83% עד סף
  upper: 0.1263,  // 12.63% מעל סף
};

/** שיעורי מס בריאות */
export const HEALTH_TAX = {
  lower: 0.031,  // 3.1% עד סף
  upper: 0.05,   // 5% מעל סף
};

/** שיעורי פנסיה סטנדרטיים */
export const PENSION_RATES = {
  employee: 0.06,        // 6% עובד
  employeeEnhanced: 0.07, // 7% עובד (משופר)
  employer: 0.065,       // 6.5% מעסיק
};

/** שיעורי קרן השתלמות */
export const ADVANCED_STUDY_FUND_RATES = {
  employee: 0.025,  // 2.5% עובד
  employer: 0.075,  // 7.5% מעסיק
};

/** פיצויים */
export const SEVERANCE_RATE = 0.0833; // 8.33% מעסיק

// ============================================================================
// טיפוסים
// ============================================================================

export interface TaxCalculationInput {
  grossSalary: number;
  creditPoints?: number;
  employmentType?: 'employee' | 'self_employed' | 'freelance' | 'other';
}

export interface TaxCalculationResult {
  grossSalary: number;
  incomeTax: number;
  nationalInsurance: number;
  healthTax: number;
  totalTaxes: number;
  netSalary: number;
  effectiveTaxRate: number;
}

export interface DeductionsInput {
  grossSalary: number;
  pension?: number;
  advancedStudyFund?: number;
  otherDeductions?: number;
}

export interface DeductionsResult {
  pension: number;
  advancedStudyFund: number;
  otherDeductions: number;
  totalDeductions: number;
  actualBankAmount: number;
}

export interface FullIncomeCalculation extends TaxCalculationResult, DeductionsResult {
  breakdown: {
    incomeTaxBreakdown: { bracket: number; amount: number; rate: number }[];
    nationalInsuranceBreakdown: { range: string; amount: number; rate: number }[];
    healthTaxBreakdown: { range: string; amount: number; rate: number }[];
  };
}

// ============================================================================
// פונקציות חישוב - מס הכנסה
// ============================================================================

/**
 * חישוב מס הכנסה מדורג
 */
export function calculateIncomeTax(
  grossSalary: number,
  creditPoints: number = BASE_CREDIT_POINTS
): { tax: number; breakdown: { bracket: number; amount: number; rate: number }[] } {
  const creditAmount = creditPoints * CREDIT_POINT_VALUE_2025;
  const taxableIncome = Math.max(0, grossSalary - creditAmount);
  
  let remainingIncome = taxableIncome;
  let totalTax = 0;
  const breakdown: { bracket: number; amount: number; rate: number }[] = [];
  let previousMax = 0;

  for (const bracket of TAX_BRACKETS_2025) {
    if (remainingIncome <= 0) break;

    const bracketSize = bracket.max - previousMax;
    const taxableInBracket = Math.min(remainingIncome, bracketSize);
    const taxForBracket = taxableInBracket * bracket.rate;

    if (taxableInBracket > 0) {
      breakdown.push({
        bracket: previousMax + 1,
        amount: taxForBracket,
        rate: bracket.rate,
      });
      totalTax += taxForBracket;
    }

    remainingIncome -= taxableInBracket;
    previousMax = bracket.max;
  }

  return { tax: Math.round(totalTax), breakdown };
}

/**
 * חישוב ביטוח לאומי
 */
export function calculateNationalInsurance(
  grossSalary: number,
  employmentType: 'employee' | 'self_employed' = 'employee'
): { amount: number; breakdown: { range: string; amount: number; rate: number }[] } {
  const breakdown: { range: string; amount: number; rate: number }[] = [];
  let totalInsurance = 0;

  const cappedSalary = Math.min(grossSalary, NATIONAL_INSURANCE_CEILING);
  
  if (employmentType === 'employee') {
    // חלק ראשון - עד הסף
    const lowerPart = Math.min(cappedSalary, NATIONAL_INSURANCE_THRESHOLD);
    const lowerAmount = lowerPart * EMPLOYEE_NATIONAL_INSURANCE.lower;
    
    if (lowerAmount > 0) {
      breakdown.push({
        range: `עד ${NATIONAL_INSURANCE_THRESHOLD.toLocaleString('he-IL')} ₪`,
        amount: lowerAmount,
        rate: EMPLOYEE_NATIONAL_INSURANCE.lower,
      });
      totalInsurance += lowerAmount;
    }

    // חלק שני - מעל הסף עד התקרה
    if (cappedSalary > NATIONAL_INSURANCE_THRESHOLD) {
      const upperPart = cappedSalary - NATIONAL_INSURANCE_THRESHOLD;
      const upperAmount = upperPart * EMPLOYEE_NATIONAL_INSURANCE.upper;
      
      breakdown.push({
        range: `${NATIONAL_INSURANCE_THRESHOLD.toLocaleString('he-IL')} - ${NATIONAL_INSURANCE_CEILING.toLocaleString('he-IL')} ₪`,
        amount: upperAmount,
        rate: EMPLOYEE_NATIONAL_INSURANCE.upper,
      });
      totalInsurance += upperAmount;
    }
  } else {
    // עצמאי
    const lowerPart = Math.min(cappedSalary, NATIONAL_INSURANCE_THRESHOLD);
    const lowerAmount = lowerPart * SELF_EMPLOYED_NATIONAL_INSURANCE.lower;
    
    if (lowerAmount > 0) {
      breakdown.push({
        range: `עד ${NATIONAL_INSURANCE_THRESHOLD.toLocaleString('he-IL')} ₪`,
        amount: lowerAmount,
        rate: SELF_EMPLOYED_NATIONAL_INSURANCE.lower,
      });
      totalInsurance += lowerAmount;
    }

    if (cappedSalary > NATIONAL_INSURANCE_THRESHOLD) {
      const upperPart = cappedSalary - NATIONAL_INSURANCE_THRESHOLD;
      const upperAmount = upperPart * SELF_EMPLOYED_NATIONAL_INSURANCE.upper;
      
      breakdown.push({
        range: `מעל ${NATIONAL_INSURANCE_THRESHOLD.toLocaleString('he-IL')} ₪`,
        amount: upperAmount,
        rate: SELF_EMPLOYED_NATIONAL_INSURANCE.upper,
      });
      totalInsurance += upperAmount;
    }
  }

  return { amount: Math.round(totalInsurance), breakdown };
}

/**
 * חישוב מס בריאות
 */
export function calculateHealthTax(
  grossSalary: number
): { amount: number; breakdown: { range: string; amount: number; rate: number }[] } {
  const breakdown: { range: string; amount: number; rate: number }[] = [];
  let totalHealthTax = 0;

  // חלק ראשון - עד הסף
  const lowerPart = Math.min(grossSalary, NATIONAL_INSURANCE_THRESHOLD);
  const lowerAmount = lowerPart * HEALTH_TAX.lower;
  
  if (lowerAmount > 0) {
    breakdown.push({
      range: `עד ${NATIONAL_INSURANCE_THRESHOLD.toLocaleString('he-IL')} ₪`,
      amount: lowerAmount,
      rate: HEALTH_TAX.lower,
    });
    totalHealthTax += lowerAmount;
  }

  // חלק שני - מעל הסף
  if (grossSalary > NATIONAL_INSURANCE_THRESHOLD) {
    const upperPart = grossSalary - NATIONAL_INSURANCE_THRESHOLD;
    const upperAmount = upperPart * HEALTH_TAX.upper;
    
    breakdown.push({
      range: `מעל ${NATIONAL_INSURANCE_THRESHOLD.toLocaleString('he-IL')} ₪`,
      amount: upperAmount,
      rate: HEALTH_TAX.upper,
    });
    totalHealthTax += upperAmount;
  }

  return { amount: Math.round(totalHealthTax), breakdown };
}

// ============================================================================
// פונקציות חישוב - מקיפות
// ============================================================================

/**
 * חישוב מלא של מס ונטו מברוטו
 */
export function calculateNetFromGross(input: TaxCalculationInput): TaxCalculationResult {
  const { grossSalary, creditPoints = BASE_CREDIT_POINTS, employmentType = 'employee' } = input;

  const incomeTaxResult = calculateIncomeTax(grossSalary, creditPoints);
  const nationalInsuranceResult = calculateNationalInsurance(
    grossSalary,
    employmentType === 'self_employed' ? 'self_employed' : 'employee'
  );
  const healthTaxResult = calculateHealthTax(grossSalary);

  const totalTaxes = incomeTaxResult.tax + nationalInsuranceResult.amount + healthTaxResult.amount;
  const netSalary = grossSalary - totalTaxes;
  const effectiveTaxRate = grossSalary > 0 ? (totalTaxes / grossSalary) * 100 : 0;

  return {
    grossSalary,
    incomeTax: incomeTaxResult.tax,
    nationalInsurance: nationalInsuranceResult.amount,
    healthTax: healthTaxResult.amount,
    totalTaxes: Math.round(totalTaxes),
    netSalary: Math.round(netSalary),
    effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100,
  };
}

/**
 * הערכת ברוטו מסכום בנק
 */
export function estimateGrossFromBank(
  bankAmount: number,
  employmentType: 'employee' | 'self_employed' | 'freelance' | 'other' = 'employee'
): { estimatedGross: number; estimatedNet: number; confidence: number } {
  if (bankAmount <= 0) {
    return { estimatedGross: 0, estimatedNet: 0, confidence: 0 };
  }

  let estimationFactor: number;
  let confidence: number;

  switch (employmentType) {
    case 'employee':
      // שכיר: בדרך כלל 25-30% ניכויים (מס + ביטוח + פנסיה + קה"ש)
      estimationFactor = 1.35; // ~26% ניכויים
      confidence = 0.8;
      break;
    case 'self_employed':
      // עצמאי: ניכויים גבוהים יותר 35-45%
      estimationFactor = 1.7; // ~42% ניכויים
      confidence = 0.6;
      break;
    case 'freelance':
      // פרילנסר: דומה לעצמאי אך יותר משתנה
      estimationFactor = 1.5; // ~33% ניכויים
      confidence = 0.5;
      break;
    default:
      // אחר: הערכה בסיסית
      estimationFactor = 1.3;
      confidence = 0.4;
      break;
  }

  const estimatedGross = Math.round(bankAmount * estimationFactor);
  const calculatedNet = calculateNetFromGross({ grossSalary: estimatedGross, employmentType }).netSalary;

  return {
    estimatedGross,
    estimatedNet: calculatedNet,
    confidence,
  };
}

/**
 * חישוב ניכויי פנסיה
 */
export function calculatePensionDeductions(
  grossSalary: number,
  employeeRate: number = PENSION_RATES.employee
): { employee: number; employer: number; total: number } {
  const employeeContribution = Math.round(grossSalary * employeeRate);
  const employerContribution = Math.round(grossSalary * PENSION_RATES.employer);

  return {
    employee: employeeContribution,
    employer: employerContribution,
    total: employeeContribution + employerContribution,
  };
}

/**
 * חישוב קרן השתלמות
 */
export function calculateAdvancedStudyFund(grossSalary: number): { employee: number; employer: number; total: number } {
  const employeeContribution = Math.round(grossSalary * ADVANCED_STUDY_FUND_RATES.employee);
  const employerContribution = Math.round(grossSalary * ADVANCED_STUDY_FUND_RATES.employer);

  return {
    employee: employeeContribution,
    employer: employerContribution,
    total: employeeContribution + employerContribution,
  };
}

/**
 * הצעת ניכויים אוטומטיים
 */
export function suggestDeductions(
  grossSalary: number,
  employmentType: 'employee' | 'self_employed' | 'freelance' | 'other' = 'employee'
): { pension: number; advancedStudyFund: number; other: number } {
  if (employmentType === 'employee') {
    const pension = calculatePensionDeductions(grossSalary);
    const studyFund = calculateAdvancedStudyFund(grossSalary);

    return {
      pension: pension.employee,
      advancedStudyFund: studyFund.employee,
      other: 0,
    };
  }

  // עצמאי/פרילנסר - בדרך כלל ללא ניכויים קבועים
  return {
    pension: 0,
    advancedStudyFund: 0,
    other: 0,
  };
}

/**
 * חישוב מלא כולל ניכויים
 */
export function calculateFullIncome(input: DeductionsInput): FullIncomeCalculation {
  const { grossSalary, pension = 0, advancedStudyFund = 0, otherDeductions = 0 } = input;

  // חישוב מסים
  const taxResult = calculateNetFromGross({ grossSalary });
  
  // חישוב ניכויים
  const totalDeductions = pension + advancedStudyFund + otherDeductions;
  const actualBankAmount = taxResult.netSalary - totalDeductions;

  // פירוט מפורט
  const incomeTaxBreakdown = calculateIncomeTax(grossSalary, BASE_CREDIT_POINTS);
  const nationalInsuranceBreakdown = calculateNationalInsurance(grossSalary, 'employee');
  const healthTaxBreakdown = calculateHealthTax(grossSalary);

  return {
    ...taxResult,
    pension,
    advancedStudyFund,
    otherDeductions,
    totalDeductions,
    actualBankAmount: Math.round(actualBankAmount),
    breakdown: {
      incomeTaxBreakdown: incomeTaxBreakdown.breakdown,
      nationalInsuranceBreakdown: nationalInsuranceBreakdown.breakdown,
      healthTaxBreakdown: healthTaxBreakdown.breakdown,
    },
  };
}

/**
 * ולידציה - בדיקה אם הנתונים הגיוניים
 */
export function validateIncome(data: {
  gross?: number;
  net?: number;
  bank?: number;
  pension?: number;
  advancedStudyFund?: number;
}): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  const { gross, net, bank, pension, advancedStudyFund } = data;

  // בדיקות בסיסיות
  if (gross && gross < 0) {
    errors.push('משכורת ברוטו לא יכולה להיות שלילית');
  }

  if (net && net < 0) {
    errors.push('משכורת נטו לא יכולה להיות שלילית');
  }

  if (bank && bank < 0) {
    errors.push('סכום בנק לא יכול להיות שלילי');
  }

  // בדיקות יחסים
  if (gross && net && net > gross) {
    errors.push('נטו לא יכול להיות גבוה מברוטו');
  }

  if (net && bank && bank > net) {
    warnings.push('סכום בנק גבוה מנטו - האם בטוח?');
  }

  if (gross && net) {
    const expectedNet = calculateNetFromGross({ grossSalary: gross }).netSalary;
    const diff = Math.abs(net - expectedNet);
    const diffPercent = (diff / gross) * 100;

    if (diffPercent > 10) {
      warnings.push(`ההפרש בין נטו לברוטו נראה חריג (${diffPercent.toFixed(1)}%)`);
    }
  }

  // בדיקת פנסיה
  if (gross && pension) {
    const expectedPension = calculatePensionDeductions(gross).employee;
    const diff = Math.abs(pension - expectedPension);
    const diffPercent = (diff / expectedPension) * 100;

    if (diffPercent > 20) {
      warnings.push(`ניכוי הפנסיה נראה חריג (צפוי: ${expectedPension} ₪)`);
    }
  }

  // בדיקת משכורת חריגה
  if (gross) {
    if (gross < 5000) {
      warnings.push('משכורת נמוכה משכר המינימום - בדוק שוב');
    }
    if (gross > 100000) {
      warnings.push('משכורת גבוהה מאוד - וודא שהנתונים נכונים');
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

