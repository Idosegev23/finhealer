/**
 * Income Validator - מערכת ולידציות להכנסות
 * בדיקות חכמות, אזהרות והצעות לשיפור
 */

import { validateIncome as validateIncomeAmounts } from './tax-calculator-2025';

// ============================================================================
// טיפוסים
// ============================================================================

export type ValidationLevel = 'error' | 'warning' | 'info' | 'success';

export interface ValidationMessage {
  level: ValidationLevel;
  field?: string;
  message: string;
  suggestion?: string;
  code?: string;
}

export interface ValidationResult {
  valid: boolean;
  messages: ValidationMessage[];
  score: number; // 0-100
}

export interface IncomeData {
  source_name?: string;
  employment_type?: string;
  gross_amount?: number | null;
  net_amount?: number | null;
  actual_bank_amount?: number | null;
  pension_contribution?: number | null;
  advanced_study_fund?: number | null;
  other_deductions?: number | null;
  employer_name?: string;
  payment_frequency?: string;
  is_variable?: boolean;
  min_amount?: number | null;
  max_amount?: number | null;
}

// ============================================================================
// קבועים
// ============================================================================

const MINIMUM_WAGE_2025 = 5880; // שכר מינימום חודשי 2025
const AVERAGE_WAGE_2025 = 12500; // שכר ממוצע משוער
const MAX_REASONABLE_WAGE = 150000; // תקרה סבירה

const REASONABLE_RANGES = {
  employee: {
    deductionRate: { min: 0.20, max: 0.35 }, // 20-35% ניכויים
    pensionRate: { min: 0.05, max: 0.08 },   // 5-8% פנסיה
    studyFundRate: { min: 0.02, max: 0.03 }, // 2-3% קה"ש
  },
  self_employed: {
    deductionRate: { min: 0.30, max: 0.50 }, // 30-50% ניכויים
    pensionRate: { min: 0, max: 0.10 },      // 0-10% פנסיה (אופציונלי)
  },
  freelance: {
    deductionRate: { min: 0.25, max: 0.45 }, // 25-45% ניכויים
  },
};

// ============================================================================
// פונקציות ולידציה ראשיות
// ============================================================================

/**
 * ולידציה מלאה של נתוני הכנסה
 */
export function validateFullIncome(data: IncomeData): ValidationResult {
  const messages: ValidationMessage[] = [];
  let score = 100;

  // בדיקות חובה
  validateRequired(data, messages);
  if (messages.some(m => m.level === 'error')) {
    return { valid: false, messages, score: 0 };
  }

  // בדיקות סכומים
  const amountValidation = validateIncomeAmounts({
    gross: data.gross_amount ?? undefined,
    net: data.net_amount ?? undefined,
    bank: data.actual_bank_amount ?? undefined,
    pension: data.pension_contribution ?? undefined,
    advancedStudyFund: data.advanced_study_fund ?? undefined,
  });

  amountValidation.errors.forEach(error => {
    messages.push({ level: 'error', message: error, code: 'AMOUNT_ERROR' });
    score -= 25;
  });

  amountValidation.warnings.forEach(warning => {
    messages.push({ level: 'warning', message: warning, code: 'AMOUNT_WARNING' });
    score -= 10;
  });

  // בדיקות נוספות
  validateEmploymentType(data, messages);
  validateSalaryRange(data, messages);
  validateDeductions(data, messages);
  validateConsistency(data, messages);
  validateVariableIncome(data, messages);

  // חישוב ציון סופי
  score = Math.max(0, Math.min(100, score));
  const valid = !messages.some(m => m.level === 'error');

  // הוספת הודעת הצלחה אם הכל תקין
  if (valid && messages.length === 0) {
    messages.push({
      level: 'success',
      message: 'כל הנתונים נראים תקינים!',
      code: 'ALL_GOOD',
    });
  }

  return { valid, messages, score };
}

/**
 * בדיקת שדות חובה
 */
function validateRequired(data: IncomeData, messages: ValidationMessage[]): void {
  if (!data.source_name || data.source_name.trim() === '') {
    messages.push({
      level: 'error',
      field: 'source_name',
      message: 'חובה למלא שם למקור ההכנסה',
      code: 'REQUIRED_FIELD',
    });
  }

  if (!data.employment_type) {
    messages.push({
      level: 'error',
      field: 'employment_type',
      message: 'חובה לבחור סוג תעסוקה',
      code: 'REQUIRED_FIELD',
    });
  }

  if (!data.actual_bank_amount && !data.net_amount && !data.gross_amount) {
    messages.push({
      level: 'error',
      field: 'actual_bank_amount',
      message: 'חובה למלא לפחות סכום אחד (נכנס לבנק/נטו/ברוטו)',
      code: 'REQUIRED_AMOUNT',
    });
  }

  if (!data.payment_frequency) {
    messages.push({
      level: 'warning',
      field: 'payment_frequency',
      message: 'מומלץ לציין תדירות תשלום',
      suggestion: 'monthly',
      code: 'MISSING_FREQUENCY',
    });
  }
}

/**
 * בדיקת סוג תעסוקה
 */
function validateEmploymentType(data: IncomeData, messages: ValidationMessage[]): void {
  const validTypes = ['employee', 'self_employed', 'freelance', 'business', 'rental', 'investment', 'pension', 'other'];
  
  if (data.employment_type && !validTypes.includes(data.employment_type)) {
    messages.push({
      level: 'error',
      field: 'employment_type',
      message: `סוג תעסוקה לא תקין: ${data.employment_type}`,
      code: 'INVALID_TYPE',
    });
  }

  // שכיר צריך שם מעסיק
  if (data.employment_type === 'employee' && !data.employer_name) {
    messages.push({
      level: 'info',
      field: 'employer_name',
      message: 'מומלץ להוסיף שם מעסיק',
      code: 'MISSING_EMPLOYER',
    });
  }

  // עצמאי לא צריך שם מעסיק
  if ((data.employment_type === 'self_employed' || data.employment_type === 'freelance') && data.employer_name) {
    messages.push({
      level: 'info',
      field: 'employer_name',
      message: 'עצמאי/פרילנסר בדרך כלל לא צריך שם מעסיק',
      code: 'UNEXPECTED_EMPLOYER',
    });
  }
}

/**
 * בדיקת טווח משכורת
 */
function validateSalaryRange(data: IncomeData, messages: ValidationMessage[]): void {
  const amount = data.gross_amount || data.net_amount || data.actual_bank_amount || 0;
  
  if (amount < MINIMUM_WAGE_2025 && data.payment_frequency === 'monthly') {
    messages.push({
      level: 'warning',
      field: 'gross_amount',
      message: `הסכום נמוך משכר המינימום (${MINIMUM_WAGE_2025.toLocaleString('he-IL')} ₪)`,
      suggestion: 'בדוק שהנתונים נכונים או שמדובר בעבודה חלקית',
      code: 'BELOW_MINIMUM',
    });
  }

  if (amount > MAX_REASONABLE_WAGE) {
    messages.push({
      level: 'warning',
      field: 'gross_amount',
      message: 'משכורת גבוהה מאוד - וודא שהנתונים נכונים',
      code: 'VERY_HIGH_SALARY',
    });
  }

  // השוואה לשכר ממוצע
  if (amount > 0 && amount < AVERAGE_WAGE_2025 * 0.5 && data.payment_frequency === 'monthly') {
    messages.push({
      level: 'info',
      message: `הסכום נמוך מהממוצע במשק (${AVERAGE_WAGE_2025.toLocaleString('he-IL')} ₪)`,
      code: 'BELOW_AVERAGE',
    });
  }

  if (amount > AVERAGE_WAGE_2025 * 2 && data.payment_frequency === 'monthly') {
    messages.push({
      level: 'success',
      message: 'הכנסה גבוהה מהממוצע - כל הכבוד! 🎉',
      code: 'ABOVE_AVERAGE',
    });
  }
}

/**
 * בדיקת ניכויים
 */
function validateDeductions(data: IncomeData, messages: ValidationMessage[]): void {
  const { gross_amount, net_amount, actual_bank_amount, employment_type } = data;
  
  if (!gross_amount || !net_amount) return;

  const ranges = employment_type && employment_type in REASONABLE_RANGES 
    ? REASONABLE_RANGES[employment_type as keyof typeof REASONABLE_RANGES]
    : null;

  // בדיקת יחס ניכויים
  const taxesAndInsurance = gross_amount - net_amount;
  const deductionRate = taxesAndInsurance / gross_amount;

  if (ranges && 'deductionRate' in ranges) {
    if (deductionRate < ranges.deductionRate.min) {
      messages.push({
        level: 'warning',
        message: `שיעור הניכויים נמוך (${(deductionRate * 100).toFixed(1)}%) - בדוק שהנתונים נכונים`,
        suggestion: `צפוי בין ${(ranges.deductionRate.min * 100).toFixed(0)}%-${(ranges.deductionRate.max * 100).toFixed(0)}%`,
        code: 'LOW_DEDUCTION_RATE',
      });
    }

    if (deductionRate > ranges.deductionRate.max) {
      messages.push({
        level: 'warning',
        message: `שיעור הניכויים גבוה (${(deductionRate * 100).toFixed(1)}%) - בדוק שהנתונים נכונים`,
        suggestion: `צפוי בין ${(ranges.deductionRate.min * 100).toFixed(0)}%-${(ranges.deductionRate.max * 100).toFixed(0)}%`,
        code: 'HIGH_DEDUCTION_RATE',
      });
    }
  }

  // בדיקת פנסיה
  if (employment_type === 'employee') {
    const pension = data.pension_contribution || 0;
    const expectedPension = gross_amount * 0.06;
    const pensionDiff = Math.abs(pension - expectedPension) / expectedPension;

    if (pension > 0 && pensionDiff > 0.3) {
      messages.push({
        level: 'warning',
        field: 'pension_contribution',
        message: `ניכוי פנסיה חריג - צפוי בערך ${Math.round(expectedPension).toLocaleString('he-IL')} ₪`,
        code: 'UNUSUAL_PENSION',
      });
    }

    if (pension === 0) {
      messages.push({
        level: 'info',
        field: 'pension_contribution',
        message: 'לא צוין ניכוי פנסיה - האם אתה בתקופת הסתגלות?',
        code: 'NO_PENSION',
      });
    }

    // בדיקת קה"ש
    const studyFund = data.advanced_study_fund || 0;
    const expectedStudyFund = gross_amount * 0.025;

    if (studyFund === 0 && gross_amount > 10000) {
      messages.push({
        level: 'info',
        field: 'advanced_study_fund',
        message: 'מומלץ לשקול קרן השתלמות - יכול לחסוך לך במס!',
        suggestion: `ניכוי צפוי: ${Math.round(expectedStudyFund).toLocaleString('he-IL')} ₪/חודש`,
        code: 'MISSING_STUDY_FUND',
      });
    }
  }

  // בדיקת סכום בנק
  if (net_amount && actual_bank_amount) {
    const additionalDeductions = net_amount - actual_bank_amount;
    
    if (additionalDeductions < 0) {
      messages.push({
        level: 'error',
        field: 'actual_bank_amount',
        message: 'סכום בנק לא יכול להיות גבוה מנטו',
        code: 'BANK_EXCEEDS_NET',
      });
    }

    if (additionalDeductions > net_amount * 0.3) {
      messages.push({
        level: 'warning',
        message: `הפרש גדול בין נטו לבנק (${Math.round(additionalDeductions).toLocaleString('he-IL')} ₪)`,
        suggestion: 'וודא שכל הניכויים נכונים',
        code: 'LARGE_DEDUCTION_GAP',
      });
    }
  }
}

/**
 * בדיקת עקביות נתונים
 */
function validateConsistency(data: IncomeData, messages: ValidationMessage[]): void {
  const { gross_amount, net_amount, actual_bank_amount } = data;

  // יחסים בין הסכומים
  if (gross_amount && net_amount && actual_bank_amount) {
    if (gross_amount < net_amount) {
      messages.push({
        level: 'error',
        message: 'ברוטו לא יכול להיות נמוך מנטו',
        code: 'GROSS_LT_NET',
      });
    }

    if (net_amount < actual_bank_amount) {
      messages.push({
        level: 'error',
        message: 'נטו לא יכול להיות נמוך מסכום בנק',
        code: 'NET_LT_BANK',
      });
    }

    // בדיקת יחס הגיוני
    const grossToBank = actual_bank_amount / gross_amount;
    if (grossToBank < 0.5) {
      messages.push({
        level: 'warning',
        message: 'הסכום שנכנס לבנק נמוך מדי ביחס לברוטו (פחות מ-50%)',
        suggestion: 'בדוק שכל הנתונים נכונים',
        code: 'LOW_BANK_RATIO',
      });
    }
  }
}

/**
 * בדיקת הכנסות משתנות
 */
function validateVariableIncome(data: IncomeData, messages: ValidationMessage[]): void {
  if (!data.is_variable) return;

  const { min_amount, max_amount, actual_bank_amount } = data;

  if (min_amount !== null && max_amount !== null && min_amount !== undefined && max_amount !== undefined) {
    if (min_amount > max_amount) {
      messages.push({
        level: 'error',
        field: 'min_amount',
        message: 'מינימום לא יכול להיות גבוה ממקסימום',
        code: 'MIN_GT_MAX',
      });
    }

    const range = max_amount - min_amount;
    const average = (min_amount + max_amount) / 2;

    if (range > average) {
      messages.push({
        level: 'warning',
        message: 'הטווח של ההכנסה רחב מאוד - שקול לפרק למספר מקורות',
        code: 'WIDE_RANGE',
      });
    }

    if (actual_bank_amount) {
      if (actual_bank_amount < min_amount || actual_bank_amount > max_amount) {
        messages.push({
          level: 'warning',
          field: 'actual_bank_amount',
          message: 'הסכום הממוצע מחוץ לטווח שצוין',
          code: 'OUT_OF_RANGE',
        });
      }
    }
  } else {
    messages.push({
      level: 'info',
      message: 'עבור הכנסה משתנה, מומלץ לציין טווח (מינימום-מקסימום)',
      code: 'MISSING_RANGE',
    });
  }
}

// ============================================================================
// פונקציות עזר
// ============================================================================

/**
 * בדיקה מהירה - האם הנתונים תקינים בסיסית?
 */
export function quickValidate(data: IncomeData): boolean {
  if (!data.source_name || !data.employment_type) return false;
  if (!data.actual_bank_amount && !data.net_amount && !data.gross_amount) return false;
  
  const amount = data.gross_amount || data.net_amount || data.actual_bank_amount || 0;
  if (amount <= 0) return false;

  return true;
}

/**
 * קבלת הצעות לשיפור
 */
export function getSuggestions(data: IncomeData): ValidationMessage[] {
  const result = validateFullIncome(data);
  return result.messages.filter(m => m.suggestion);
}

/**
 * בדיקה אם יש שגיאות קריטיות
 */
export function hasErrors(data: IncomeData): boolean {
  const result = validateFullIncome(data);
  return result.messages.some(m => m.level === 'error');
}

/**
 * קבלת ציון איכות הנתונים
 */
export function getQualityScore(data: IncomeData): number {
  return validateFullIncome(data).score;
}

