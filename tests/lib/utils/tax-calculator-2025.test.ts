import { describe, it, expect } from 'vitest';
import {
  calculateIncomeTax,
  calculateNationalInsurance,
  calculateHealthTax,
  calculateNetFromGross,
  estimateGrossFromBank,
  calculatePensionDeductions,
  calculateAdvancedStudyFund,
  validateIncome,
  TAX_BRACKETS_2025,
  NATIONAL_INSURANCE_THRESHOLD,
  NATIONAL_INSURANCE_CEILING,
  CREDIT_POINT_VALUE_2025,
  BASE_CREDIT_POINTS,
  PENSION_RATES,
  ADVANCED_STUDY_FUND_RATES,
} from '@/lib/utils/tax-calculator-2025';

// ============================================================================
// calculateIncomeTax
// ============================================================================

describe('calculateIncomeTax', () => {
  it('returns 0 for salary below credit points value', () => {
    const creditAmount = BASE_CREDIT_POINTS * CREDIT_POINT_VALUE_2025; // ~598.5
    const { tax } = calculateIncomeTax(500);
    expect(tax).toBe(0);
  });

  it('taxes minimal salary at 10% bracket', () => {
    // 8000 gross - credit ~598 = ~7402 taxable → 10% bracket
    const { tax, breakdown } = calculateIncomeTax(8000);
    expect(tax).toBeGreaterThan(0);
    expect(breakdown[0].rate).toBe(0.10);
  });

  it('taxes high salary across multiple brackets', () => {
    const { tax, breakdown } = calculateIncomeTax(50000);
    expect(breakdown.length).toBeGreaterThan(3);
    expect(tax).toBeGreaterThan(10000);
  });

  it('increases tax monotonically with salary', () => {
    const tax1 = calculateIncomeTax(10000).tax;
    const tax2 = calculateIncomeTax(20000).tax;
    const tax3 = calculateIncomeTax(40000).tax;
    expect(tax1).toBeLessThan(tax2);
    expect(tax2).toBeLessThan(tax3);
  });

  it('respects extra credit points (reduces tax)', () => {
    const taxBase = calculateIncomeTax(15000, 2.25).tax;
    const taxExtra = calculateIncomeTax(15000, 5).tax;
    expect(taxExtra).toBeLessThan(taxBase);
  });

  it('tax never exceeds 50% of gross', () => {
    const { tax } = calculateIncomeTax(100000);
    expect(tax).toBeLessThan(100000 * 0.5);
  });

  it('returns structured breakdown with rate and amount', () => {
    const { breakdown } = calculateIncomeTax(30000);
    for (const entry of breakdown) {
      expect(entry).toHaveProperty('bracket');
      expect(entry).toHaveProperty('amount');
      expect(entry).toHaveProperty('rate');
      expect(entry.amount).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// calculateNationalInsurance
// ============================================================================

describe('calculateNationalInsurance', () => {
  it('calculates employee NI below threshold at lower rate', () => {
    const { amount } = calculateNationalInsurance(5000, 'employee');
    expect(amount).toBeCloseTo(5000 * 0.035, 0);
  });

  it('calculates employee NI across threshold', () => {
    const { amount, breakdown } = calculateNationalInsurance(
      NATIONAL_INSURANCE_THRESHOLD + 5000,
      'employee'
    );
    expect(breakdown.length).toBe(2);
    expect(breakdown[0].rate).toBe(0.035);
    expect(breakdown[1].rate).toBe(0.07);
    expect(amount).toBeGreaterThan(0);
  });

  it('caps at national insurance ceiling', () => {
    const atCeiling = calculateNationalInsurance(NATIONAL_INSURANCE_CEILING, 'employee').amount;
    const aboveCeiling = calculateNationalInsurance(NATIONAL_INSURANCE_CEILING + 20000, 'employee').amount;
    expect(atCeiling).toBe(aboveCeiling);
  });

  it('self employed pays higher lower-bracket rate than employee', () => {
    const employeeNI = calculateNationalInsurance(5000, 'employee').amount;
    const selfEmployedNI = calculateNationalInsurance(5000, 'self_employed').amount;
    expect(selfEmployedNI).toBeGreaterThan(employeeNI);
  });

  it('defaults to employee type', () => {
    const explicit = calculateNationalInsurance(10000, 'employee').amount;
    const implicit = calculateNationalInsurance(10000).amount;
    expect(implicit).toBe(explicit);
  });
});

// ============================================================================
// calculateHealthTax
// ============================================================================

describe('calculateHealthTax', () => {
  it('applies 3.1% on salary below threshold', () => {
    const { amount } = calculateHealthTax(5000);
    expect(amount).toBeCloseTo(5000 * 0.031, 0);
  });

  it('applies both rates above threshold', () => {
    const { breakdown } = calculateHealthTax(NATIONAL_INSURANCE_THRESHOLD + 1000);
    expect(breakdown.length).toBe(2);
    expect(breakdown[0].rate).toBe(0.031);
    expect(breakdown[1].rate).toBe(0.05);
  });

  it('increases monotonically with salary', () => {
    const h1 = calculateHealthTax(5000).amount;
    const h2 = calculateHealthTax(10000).amount;
    const h3 = calculateHealthTax(30000).amount;
    expect(h1).toBeLessThan(h2);
    expect(h2).toBeLessThan(h3);
  });
});

// ============================================================================
// calculateNetFromGross
// ============================================================================

describe('calculateNetFromGross', () => {
  it('net is less than gross', () => {
    const result = calculateNetFromGross({ grossSalary: 15000 });
    expect(result.netSalary).toBeLessThan(15000);
  });

  it('total taxes = gross - net', () => {
    const result = calculateNetFromGross({ grossSalary: 20000 });
    expect(result.grossSalary - result.netSalary).toBeCloseTo(result.totalTaxes, 0);
  });

  it('effective tax rate is between 0-100%', () => {
    const result = calculateNetFromGross({ grossSalary: 25000 });
    expect(result.effectiveTaxRate).toBeGreaterThan(0);
    expect(result.effectiveTaxRate).toBeLessThan(100);
  });

  it('returns zero taxes for zero salary', () => {
    const result = calculateNetFromGross({ grossSalary: 0 });
    expect(result.totalTaxes).toBe(0);
    expect(result.netSalary).toBe(0);
    expect(result.effectiveTaxRate).toBe(0);
  });

  it('sums incomeTax + nationalInsurance + healthTax = totalTaxes', () => {
    const result = calculateNetFromGross({ grossSalary: 30000 });
    const sum = result.incomeTax + result.nationalInsurance + result.healthTax;
    expect(sum).toBeCloseTo(result.totalTaxes, 0);
  });

  it('self_employed has different NI than employee', () => {
    const employee = calculateNetFromGross({ grossSalary: 15000, employmentType: 'employee' });
    const selfEmployed = calculateNetFromGross({ grossSalary: 15000, employmentType: 'self_employed' });
    expect(selfEmployed.nationalInsurance).not.toBe(employee.nationalInsurance);
  });

  it('higher salary results in higher effective tax rate', () => {
    const low = calculateNetFromGross({ grossSalary: 8000 });
    const high = calculateNetFromGross({ grossSalary: 50000 });
    expect(high.effectiveTaxRate).toBeGreaterThan(low.effectiveTaxRate);
  });
});

// ============================================================================
// estimateGrossFromBank
// ============================================================================

describe('estimateGrossFromBank', () => {
  it('returns 0 for zero or negative bank amount', () => {
    expect(estimateGrossFromBank(0).estimatedGross).toBe(0);
    expect(estimateGrossFromBank(-100).estimatedGross).toBe(0);
  });

  it('estimated gross is greater than bank amount', () => {
    const { estimatedGross } = estimateGrossFromBank(10000, 'employee');
    expect(estimatedGross).toBeGreaterThan(10000);
  });

  it('self_employed estimate is higher than employee estimate', () => {
    const employee = estimateGrossFromBank(10000, 'employee').estimatedGross;
    const selfEmployed = estimateGrossFromBank(10000, 'self_employed').estimatedGross;
    expect(selfEmployed).toBeGreaterThan(employee);
  });

  it('employee confidence is higher than freelance', () => {
    const employee = estimateGrossFromBank(10000, 'employee').confidence;
    const freelance = estimateGrossFromBank(10000, 'freelance').confidence;
    expect(employee).toBeGreaterThan(freelance);
  });

  it('confidence is between 0 and 1', () => {
    for (const type of ['employee', 'self_employed', 'freelance', 'other'] as const) {
      const { confidence } = estimateGrossFromBank(15000, type);
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// calculatePensionDeductions
// ============================================================================

describe('calculatePensionDeductions', () => {
  it('calculates employee contribution at default 6%', () => {
    const { employee } = calculatePensionDeductions(10000);
    expect(employee).toBe(Math.round(10000 * PENSION_RATES.employee));
  });

  it('calculates employer contribution at 6.5%', () => {
    const { employer } = calculatePensionDeductions(10000);
    expect(employer).toBe(Math.round(10000 * PENSION_RATES.employer));
  });

  it('total = employee + employer', () => {
    const { employee, employer, total } = calculatePensionDeductions(10000);
    expect(total).toBe(employee + employer);
  });

  it('accepts custom employee rate', () => {
    const { employee } = calculatePensionDeductions(10000, 0.07);
    expect(employee).toBe(Math.round(10000 * 0.07));
  });
});

// ============================================================================
// calculateAdvancedStudyFund (קרן השתלמות)
// ============================================================================

describe('calculateAdvancedStudyFund', () => {
  it('employee contributes 2.5%', () => {
    const { employee } = calculateAdvancedStudyFund(10000);
    expect(employee).toBe(Math.round(10000 * ADVANCED_STUDY_FUND_RATES.employee));
  });

  it('employer contributes 7.5%', () => {
    const { employer } = calculateAdvancedStudyFund(10000);
    expect(employer).toBe(Math.round(10000 * ADVANCED_STUDY_FUND_RATES.employer));
  });

  it('employer contribution is 3x employee contribution', () => {
    const { employee, employer } = calculateAdvancedStudyFund(10000);
    expect(employer).toBe(employee * 3);
  });
});

// ============================================================================
// validateIncome
// ============================================================================

describe('validateIncome', () => {
  it('is valid for reasonable salary data', () => {
    const result = validateIncome({ gross: 15000 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error when net > gross', () => {
    const result = validateIncome({ gross: 10000, net: 12000 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('נטו'))).toBe(true);
  });

  it('returns error for negative gross', () => {
    const result = validateIncome({ gross: -5000 });
    expect(result.valid).toBe(false);
  });

  it('returns error for negative net', () => {
    const result = validateIncome({ net: -1000 });
    expect(result.valid).toBe(false);
  });

  it('returns error for negative bank amount', () => {
    const result = validateIncome({ bank: -500 });
    expect(result.valid).toBe(false);
  });

  it('warns when salary is below minimum wage (5000)', () => {
    const result = validateIncome({ gross: 3000 });
    expect(result.warnings.some(w => w.includes('מינימום'))).toBe(true);
  });

  it('warns when salary is very high (>100000)', () => {
    const result = validateIncome({ gross: 150000 });
    expect(result.warnings.some(w => w.includes('גבוהה מאוד'))).toBe(true);
  });

  it('warns when net differs significantly from expected calculation', () => {
    // gross 20000 but net reported as 5000 (very different from calculated ~14000)
    const result = validateIncome({ gross: 20000, net: 5000 });
    expect(result.warnings.some(w => w.includes('חריג'))).toBe(true);
  });

  it('warns when bank > net', () => {
    const result = validateIncome({ net: 10000, bank: 12000 });
    expect(result.warnings.some(w => w.includes('גבוה מנטו'))).toBe(true);
  });

  it('passes with empty input', () => {
    const result = validateIncome({});
    expect(result.valid).toBe(true);
  });
});
