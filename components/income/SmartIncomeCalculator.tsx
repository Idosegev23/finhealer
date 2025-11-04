"use client";

/**
 * Smart Income Calculator - מחשבון הכנסות חכם מתקדם
 * מחשב אוטומטית ברוטו/נטו/ניכויים בשני כיוונים
 * משתמש במנוע המס של 2025 לחישובים מדויקים
 */

import {
  calculateNetFromGross,
  estimateGrossFromBank,
  calculatePensionDeductions,
  calculateAdvancedStudyFund,
  suggestDeductions,
  calculateFullIncome,
  type TaxCalculationResult,
  type FullIncomeCalculation,
} from '@/lib/utils/tax-calculator-2025';

import {
  validateFullIncome,
  quickValidate,
  type ValidationResult,
  type IncomeData,
} from '@/lib/utils/income-validator';

// ============================================================================
// טיפוסים
// ============================================================================

export interface CalculatorState {
  gross: number | null;
  net: number | null;
  pension: number | null;
  advancedStudy: number | null;
  otherDeductions: number | null;
  actualBank: number | null;
  employmentType?: 'employee' | 'self_employed' | 'freelance' | 'other';
}

export interface CalculatorResult extends CalculatorState {
  totalDeductions: number;
  totalTaxes: number;
  effectiveTaxRate: number;
  validation: ValidationResult;
}

export interface VariableIncomeData {
  minAmount: number;
  maxAmount: number;
  monthlyIncomes?: number[];
}

export interface VariableIncomeResult {
  average: number;
  median: number;
  standardDeviation: number;
  confidence: number;
  trend: 'stable' | 'increasing' | 'decreasing' | 'volatile';
}

// ============================================================================
// מחלקת מחשבון חכם
// ============================================================================

export class SmartIncomeCalculator {
  /**
   * חישוב קדימה מלא: מברוטו לכל השאר
   * משתמש במנוע המס של 2025
   */
  static calculateForward(state: CalculatorState): CalculatorResult {
    const gross = state.gross || 0;
    const employmentType = state.employmentType || 'employee';

    if (gross <= 0) {
      return this.createEmptyResult(state);
    }

    // חישוב מסים
    const taxResult = calculateNetFromGross({ grossSalary: gross, employmentType });

    // חישוב ניכויים
    const pension = state.pension ?? 0;
    const advancedStudy = state.advancedStudy ?? 0;
    const otherDeductions = state.otherDeductions ?? 0;
    const totalDeductions = pension + advancedStudy + otherDeductions;
    const actualBank = taxResult.netSalary - totalDeductions;

    // ולידציה
    const validation = validateFullIncome({
      gross_amount: gross,
      net_amount: taxResult.netSalary,
      actual_bank_amount: actualBank,
      pension_contribution: pension,
      advanced_study_fund: advancedStudy,
      other_deductions: otherDeductions,
      employment_type: employmentType,
    });

    return {
      gross,
      net: taxResult.netSalary,
      pension,
      advancedStudy,
      otherDeductions,
      actualBank: Math.round(actualBank),
      employmentType,
      totalDeductions,
      totalTaxes: taxResult.totalTaxes,
      effectiveTaxRate: taxResult.effectiveTaxRate,
      validation,
    };
  }

  /**
   * חישוב הפוך: מסכום בנק לברוטו (הערכה מדויקת)
   */
  static calculateReverse(
    actualBank: number,
    employmentType: 'employee' | 'self_employed' | 'freelance' | 'other' = 'employee'
  ): CalculatorResult {
    if (actualBank <= 0) {
      return this.createEmptyResult({ actualBank, employmentType });
    }

    // הערכה ראשונית
    const estimation = estimateGrossFromBank(actualBank, employmentType);

    // חישוב מדויק עם הברוטו המשוער
    const taxResult = calculateNetFromGross({
      grossSalary: estimation.estimatedGross,
      employmentType,
    });

    // הצעת ניכויים
    const suggestedDeductions = suggestDeductions(estimation.estimatedGross, employmentType);

    const totalDeductions = suggestedDeductions.pension + suggestedDeductions.advancedStudyFund;

    // ולידציה
    const validation = validateFullIncome({
      gross_amount: estimation.estimatedGross,
      net_amount: taxResult.netSalary,
      actual_bank_amount: actualBank,
      pension_contribution: suggestedDeductions.pension,
      advanced_study_fund: suggestedDeductions.advancedStudyFund,
      employment_type: employmentType,
    });

    return {
      gross: estimation.estimatedGross,
      net: taxResult.netSalary,
      pension: suggestedDeductions.pension,
      advancedStudy: suggestedDeductions.advancedStudyFund,
      otherDeductions: 0,
      actualBank,
      employmentType,
      totalDeductions,
      totalTaxes: taxResult.totalTaxes,
      effectiveTaxRate: taxResult.effectiveTaxRate,
      validation,
    };
  }

  /**
   * חישוב חכם - ממלא חסרים אוטומטית
   */
  static smartFill(state: CalculatorState): CalculatorResult {
    const employmentType = state.employmentType || 'employee';

    // תרחיש 1: יש ברוטו - חשב הכל
    if (state.gross && state.gross > 0) {
      return this.calculateForward(state);
    }

    // תרחיש 2: יש סכום בנק - הערך ברוטו
    if (state.actualBank && state.actualBank > 0) {
      return this.calculateReverse(state.actualBank, employmentType);
    }

    // תרחיש 3: יש נטו - הערך ברוטו וחשב שאר
    if (state.net && state.net > 0) {
      const estimatedGross = state.net * 1.35; // הערכה ראשונית
      return this.calculateForward({ ...state, gross: estimatedGross });
    }

    return this.createEmptyResult(state);
  }

  /**
   * הצעת ניכויים אוטומטית
   */
  static suggestDeductions(
    gross: number,
    employmentType: 'employee' | 'self_employed' | 'freelance' | 'other' = 'employee'
  ): { pension: number; advancedStudyFund: number; total: number } {
    if (employmentType === 'employee') {
      const pension = calculatePensionDeductions(gross);
      const studyFund = calculateAdvancedStudyFund(gross);

      return {
        pension: pension.employee,
        advancedStudyFund: studyFund.employee,
        total: pension.employee + studyFund.employee,
      };
    }

    // עצמאי/פרילנסר
    return {
      pension: 0,
      advancedStudyFund: 0,
      total: 0,
    };
  }

  /**
   * חישוב פירוט מלא (לתצוגה)
   */
  static calculateDetailed(state: CalculatorState): FullIncomeCalculation | null {
    const gross = state.gross || 0;
    if (gross <= 0) return null;

    return calculateFullIncome({
      grossSalary: gross,
      pension: state.pension ?? 0,
      advancedStudyFund: state.advancedStudy ?? 0,
      otherDeductions: state.otherDeductions ?? 0,
    });
  }

  /**
   * בדיקת תקינות מהירה
   */
  static validate(state: CalculatorState): ValidationResult {
    return validateFullIncome({
      gross_amount: state.gross ?? undefined,
      net_amount: state.net ?? undefined,
      actual_bank_amount: state.actualBank ?? undefined,
      pension_contribution: state.pension ?? undefined,
      advanced_study_fund: state.advancedStudy ?? undefined,
      other_deductions: state.otherDeductions ?? undefined,
      employment_type: state.employmentType,
    });
  }

  /**
   * בדיקה אם המצב תקין בסיסית
   */
  static isValid(state: CalculatorState): boolean {
    return quickValidate({
      source_name: 'temp',
      employment_type: state.employmentType || 'employee',
      gross_amount: state.gross ?? undefined,
      net_amount: state.net ?? undefined,
      actual_bank_amount: state.actualBank ?? undefined,
    });
  }

  // ============================================================================
  // תמיכה בהכנסות משתנות
  // ============================================================================

  /**
   * חישוב ממוצע הכנסה משתנה
   */
  static calculateVariableIncome(data: VariableIncomeData): VariableIncomeResult {
    const { minAmount, maxAmount, monthlyIncomes } = data;

    if (monthlyIncomes && monthlyIncomes.length > 0) {
      // חישוב מנתונים אמיתיים
      const average = monthlyIncomes.reduce((sum, val) => sum + val, 0) / monthlyIncomes.length;
      const sorted = [...monthlyIncomes].sort((a, b) => a - b);
      const median =
        monthlyIncomes.length % 2 === 0
          ? (sorted[monthlyIncomes.length / 2 - 1] + sorted[monthlyIncomes.length / 2]) / 2
          : sorted[Math.floor(monthlyIncomes.length / 2)];

      // סטיית תקן
      const variance =
        monthlyIncomes.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / monthlyIncomes.length;
      const standardDeviation = Math.sqrt(variance);

      // רמת ביטחון
      const coefficientOfVariation = standardDeviation / average;
      const confidence = Math.max(0, 1 - coefficientOfVariation);

      // זיהוי מגמה
      const trend = this.detectTrend(monthlyIncomes);

      return {
        average: Math.round(average),
        median: Math.round(median),
        standardDeviation: Math.round(standardDeviation),
        confidence: Math.round(confidence * 100) / 100,
        trend,
      };
    }

    // הערכה מטווח בלבד
    const average = (minAmount + maxAmount) / 2;
    const range = maxAmount - minAmount;
    const confidence = 1 - Math.min(1, range / average);

    return {
      average: Math.round(average),
      median: Math.round(average),
      standardDeviation: Math.round(range / 4),
      confidence: Math.max(0, Math.min(1, confidence)),
      trend: 'stable',
    };
  }

  /**
   * זיהוי מגמה בהכנסות
   */
  private static detectTrend(incomes: number[]): 'stable' | 'increasing' | 'decreasing' | 'volatile' {
    if (incomes.length < 3) return 'stable';

    const firstHalf = incomes.slice(0, Math.floor(incomes.length / 2));
    const secondHalf = incomes.slice(Math.floor(incomes.length / 2));

    const avgFirst = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const change = (avgSecond - avgFirst) / avgFirst;

    // בדיקת תנודתיות
    const average = incomes.reduce((sum, val) => sum + val, 0) / incomes.length;
    const maxDeviation = Math.max(...incomes.map(val => Math.abs(val - average) / average));

    if (maxDeviation > 0.3) return 'volatile';
    if (change > 0.15) return 'increasing';
    if (change < -0.15) return 'decreasing';
    return 'stable';
  }

  /**
   * המלצה לטווח הכנסה משתנה
   */
  static suggestRange(average: number, volatility: 'low' | 'medium' | 'high'): { min: number; max: number } {
    const factors = {
      low: 0.1,    // ±10%
      medium: 0.25, // ±25%
      high: 0.5,   // ±50%
    };

    const factor = factors[volatility];
    return {
      min: Math.round(average * (1 - factor)),
      max: Math.round(average * (1 + factor)),
    };
  }

  /**
   * זיהוי חריגות בהכנסות
   */
  static detectAnomalies(
    currentIncome: number,
    historicalData: number[],
    threshold: number = 2
  ): { isAnomaly: boolean; severity: 'low' | 'medium' | 'high'; message: string } {
    if (historicalData.length < 3) {
      return { isAnomaly: false, severity: 'low', message: 'לא מספיק נתונים היסטוריים' };
    }

    const average = historicalData.reduce((sum, val) => sum + val, 0) / historicalData.length;
    const variance =
      historicalData.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / historicalData.length;
    const stdDev = Math.sqrt(variance);

    const zScore = (currentIncome - average) / stdDev;
    const isAnomaly = Math.abs(zScore) > threshold;

    if (!isAnomaly) {
      return { isAnomaly: false, severity: 'low', message: 'ההכנסה בטווח הצפוי' };
    }

    const severity = Math.abs(zScore) > 3 ? 'high' : Math.abs(zScore) > 2.5 ? 'medium' : 'low';
    const direction = zScore > 0 ? 'גבוהה' : 'נמוכה';
    const message = `ההכנסה ${direction} משמעותית מהממוצע (${Math.round(Math.abs(zScore))}σ)`;

    return { isAnomaly, severity, message };
  }

  // ============================================================================
  // פונקציות עזר
  // ============================================================================

  /**
   * יצירת תוצאה ריקה
   */
  private static createEmptyResult(state: Partial<CalculatorState>): CalculatorResult {
    return {
      gross: state.gross ?? null,
      net: state.net ?? null,
      pension: state.pension ?? null,
      advancedStudy: state.advancedStudy ?? null,
      otherDeductions: state.otherDeductions ?? null,
      actualBank: state.actualBank ?? null,
      employmentType: state.employmentType || 'employee',
      totalDeductions: 0,
      totalTaxes: 0,
      effectiveTaxRate: 0,
      validation: {
        valid: false,
        messages: [{ level: 'error', message: 'לא מספיק נתונים לחישוב', code: 'INSUFFICIENT_DATA' }],
        score: 0,
      },
    };
  }

  /**
   * פורמט סכום לתצוגה
   */
  static formatAmount(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * פורמט אחוזים לתצוגה
   */
  static formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }
}

// ============================================================================
// Export נוסף לנוחות
// ============================================================================

export default SmartIncomeCalculator;
