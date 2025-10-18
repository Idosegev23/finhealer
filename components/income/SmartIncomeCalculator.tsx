"use client";

/**
 * Smart Income Calculator - מחשבון הכנסות חכם
 * מחשב אוטומטית ברוטו/נטו/ניכויים בשני כיוונים
 */

interface CalculatorState {
  gross: number | null;
  net: number | null;
  pension: number | null;
  advancedStudy: number | null;
  otherDeductions: number | null;
  actualBank: number | null;
}

interface CalculatorResult {
  gross: number;
  net: number;
  pension: number;
  advancedStudy: number;
  otherDeductions: number;
  actualBank: number;
  totalDeductions: number;
}

export class SmartIncomeCalculator {
  /**
   * חישוב קדימה: מברוטו לנטו
   */
  static calculateForward(state: CalculatorState): Partial<CalculatorResult> {
    const gross = state.gross || 0;
    const pension = state.pension || 0;
    const advancedStudy = state.advancedStudy || 0;
    const otherDeductions = state.otherDeductions || 0;

    const totalDeductions = pension + advancedStudy + otherDeductions;
    const actualBank = gross - totalDeductions;

    return {
      actualBank,
      totalDeductions,
    };
  }

  /**
   * חישוב הפוך: מנטו לברוטו (הערכה)
   * מבוסס על ממוצעים ישראליים
   */
  static calculateReverse(actualBank: number, employmentType: string): Partial<CalculatorResult> {
    if (!actualBank || actualBank <= 0) return {};

    let estimatedGross = 0;
    let pension = 0;
    let advancedStudy = 0;
    let estimatedNet = 0;

    if (employmentType === 'employee') {
      // שכיר רגיל - ממוצע ניכויים ~25-30%
      estimatedGross = Math.round(actualBank / 0.72); // נניח 28% ניכויים
      pension = Math.round(estimatedGross * 0.06); // 6% פנסיה עובד
      advancedStudy = Math.round(estimatedGross * 0.025); // 2.5% קה"ש
      
      // נטו = ברוטו פחות מס וביטוח לאומי (לפני הפרשות)
      estimatedNet = estimatedGross; // פשטות - נטו = ברוטו (הקיזוזים זה פנסיה וקה"ש)
    } else if (employmentType === 'self_employed') {
      // עצמאי - ניכויים גבוהים יותר ~40-50%
      estimatedGross = Math.round(actualBank / 0.55); // נניח 45% ניכויים
      pension = 0; // עצמאי לא תמיד מפריש
      advancedStudy = 0;
      estimatedNet = actualBank; // הסכום שנשאר אחרי הכל
    } else {
      // אחר - הערכה בסיסית
      estimatedGross = Math.round(actualBank * 1.2);
      estimatedNet = actualBank;
    }

    const totalDeductions = pension + advancedStudy;

    return {
      gross: estimatedGross,
      pension,
      advancedStudy,
      totalDeductions,
      net: estimatedNet,
    };
  }

  /**
   * חישוב אוטומטי של ניכויים לפי ברוטו
   */
  static suggestDeductions(gross: number, employmentType: string): { pension: number; advancedStudy: number } {
    if (employmentType === 'employee') {
      return {
        pension: Math.round(gross * 0.06), // 6%
        advancedStudy: Math.round(gross * 0.025), // 2.5%
      };
    }
    return {
      pension: 0,
      advancedStudy: 0,
    };
  }

  /**
   * בדיקת תקינות - האם המספרים הגיוניים
   */
  static validate(state: CalculatorState): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // בדיקה 1: נטו לא יכול להיות גדול מברוטו
    if (state.gross && state.actualBank && state.actualBank > state.gross) {
      warnings.push('נטו לבנק גבוה מברוטו - בדוק שהמספרים נכונים');
    }

    // בדיקה 2: ניכויים סבירים
    const totalDeductions = (state.pension || 0) + (state.advancedStudy || 0) + (state.otherDeductions || 0);
    if (state.gross && totalDeductions > state.gross * 0.5) {
      warnings.push('הניכויים גבוהים מאוד (מעל 50%) - בדוק שזה נכון');
    }

    // בדיקה 3: פנסיה סבירה (בדרך כלל 6-18.5%)
    if (state.gross && state.pension && state.pension > state.gross * 0.20) {
      warnings.push('הפרשה לפנסיה גבוהה מאוד - בדוק שזה נכון');
    }

    return {
      valid: warnings.length === 0,
      warnings,
    };
  }
}

