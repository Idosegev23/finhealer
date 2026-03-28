/**
 * OCR Validator Tests
 */

import { describe, it, expect } from 'vitest';
import { validateOCRTransactions } from '../../lib/classification/ocr-validator';

describe('OCR Validation: Flag Detection', () => {
  it('flags negative amount as refund', () => {
    const { valid, flagged } = validateOCRTransactions([
      { vendor: 'רמי לוי', amount: -85, date: '2026-01-15' },
    ]);
    // Refund-only = still valid (refunds are normal)
    expect(valid.length).toBe(1);
    expect(valid[0].flags).toContain('refund');
  });

  it('flags amount > 50,000 for review', () => {
    const { flagged } = validateOCRTransactions([
      { vendor: 'משכנתא', amount: 75000, date: '2026-01-15' },
    ]);
    expect(flagged.length).toBe(1);
    expect(flagged[0].flags).toContain('high_amount_review');
  });

  it('flags zero amount', () => {
    const { flagged } = validateOCRTransactions([
      { vendor: 'בדיקה', amount: 0, date: '2026-01-15' },
    ]);
    expect(flagged.length).toBe(1);
    expect(flagged[0].flags).toContain('zero_amount');
  });

  it('flags missing vendor', () => {
    const { flagged } = validateOCRTransactions([
      { vendor: '', amount: 100, date: '2026-01-15' },
    ]);
    expect(flagged.length).toBe(1);
    expect(flagged[0].flags).toContain('missing_vendor');
  });

  it('flags date out of range', () => {
    const { flagged } = validateOCRTransactions(
      [{ vendor: 'טסט', amount: 100, date: '2026-03-15' }],
      { period_start: '2026-01-01', period_end: '2026-01-31' }
    );
    expect(flagged.length).toBe(1);
    expect(flagged[0].flags).toContain('date_out_of_range');
  });

  it('passes valid transaction with no flags', () => {
    const { valid, flagged } = validateOCRTransactions([
      { vendor: 'רמי לוי', amount: 342, date: '2026-01-15' },
    ]);
    expect(valid.length).toBe(1);
    expect(flagged.length).toBe(0);
    expect(valid[0].flags).toEqual([]);
  });
});

describe('OCR Validation: Total Mismatch', () => {
  it('detects total mismatch > 5%', () => {
    const { totalMismatch } = validateOCRTransactions(
      [
        { vendor: 'A', amount: 100, date: '2026-01-01' },
        { vendor: 'B', amount: 200, date: '2026-01-02' },
      ],
      { reported_total: 500 } // actual sum = 300, reported = 500 → 40% off
    );
    expect(totalMismatch).toBe(true);
  });

  it('passes when total matches within 5%', () => {
    const { totalMismatch } = validateOCRTransactions(
      [
        { vendor: 'A', amount: 100, date: '2026-01-01' },
        { vendor: 'B', amount: 200, date: '2026-01-02' },
      ],
      { reported_total: 305 } // actual 300 vs 305 → 1.6% off
    );
    expect(totalMismatch).toBe(false);
  });

  it('no mismatch when no reported_total', () => {
    const { totalMismatch } = validateOCRTransactions([
      { vendor: 'A', amount: 100, date: '2026-01-01' },
    ]);
    expect(totalMismatch).toBe(false);
  });
});

describe('OCR Validation: Multiple Flags', () => {
  it('transaction can have multiple flags', () => {
    const { flagged } = validateOCRTransactions([
      { vendor: '', amount: 0, date: '2025-06-01' },
    ], { period_start: '2026-01-01', period_end: '2026-01-31' });
    expect(flagged.length).toBe(1);
    expect(flagged[0].flags).toContain('missing_vendor');
    expect(flagged[0].flags).toContain('zero_amount');
    expect(flagged[0].flags).toContain('date_out_of_range');
  });
});

describe('OCR Validation: Batch Processing', () => {
  it('handles mix of valid and flagged transactions', () => {
    const { valid, flagged } = validateOCRTransactions([
      { vendor: 'רמי לוי', amount: 342, date: '2026-01-15' },
      { vendor: '', amount: 100, date: '2026-01-15' },
      { vendor: 'סופר', amount: 85, date: '2026-01-20' },
      { vendor: 'טסט', amount: 100000, date: '2026-01-25' },
    ]);
    expect(valid.length).toBe(2); // רמי לוי + סופר
    expect(flagged.length).toBe(2); // missing vendor + high amount
  });

  it('handles empty input', () => {
    const { valid, flagged, totalMismatch } = validateOCRTransactions([]);
    expect(valid.length).toBe(0);
    expect(flagged.length).toBe(0);
    expect(totalMismatch).toBe(false);
  });
});
