import { describe, it, expect } from 'vitest';
import { formatNumber, formatCurrency, parseFormattedNumber } from '@/lib/utils/formatNumber';

// ============================================================================
// formatNumber
// ============================================================================

describe('formatNumber', () => {
  it('formats integer with locale separators', () => {
    const result = formatNumber(1000);
    // he-IL uses comma as thousands separator
    expect(result).toContain('1');
    expect(result).toContain('000');
  });

  it('returns "0" for null', () => {
    expect(formatNumber(null)).toBe('0');
  });

  it('returns "0" for undefined', () => {
    expect(formatNumber(undefined)).toBe('0');
  });

  it('returns "0" for empty string', () => {
    expect(formatNumber('')).toBe('0');
  });

  it('returns "0" for NaN string', () => {
    expect(formatNumber('abc')).toBe('0');
  });

  it('formats string numbers correctly', () => {
    const result = formatNumber('5000');
    expect(result).toContain('5');
    expect(result).toContain('000');
  });

  it('formats with decimals', () => {
    const result = formatNumber(1234.5, { decimals: 2 });
    expect(result).toContain('1,234.50');
  });

  it('adds ₪ prefix when currency=true', () => {
    const result = formatNumber(5000, { currency: true });
    expect(result.startsWith('₪')).toBe(true);
  });

  it('returns "₪0" for null with currency=true', () => {
    expect(formatNumber(null, { currency: true })).toBe('₪0');
  });

  it('handles negative numbers', () => {
    const result = formatNumber(-1000);
    expect(result).toContain('-');
    expect(result).toContain('1');
  });

  it('handles zero correctly', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

// ============================================================================
// formatCurrency
// ============================================================================

describe('formatCurrency', () => {
  it('adds ₪ prefix', () => {
    const result = formatCurrency(10000);
    expect(result.startsWith('₪')).toBe(true);
  });

  it('returns ₪0 for null', () => {
    expect(formatCurrency(null)).toBe('₪0');
  });

  it('formats with default 0 decimals', () => {
    const result = formatCurrency(1234.56);
    expect(result).not.toContain('.56');
  });

  it('formats with specified decimals', () => {
    const result = formatCurrency(1234.56, 2);
    expect(result).toContain('34.56');
  });

  it('handles string input', () => {
    const result = formatCurrency('5000');
    expect(result.startsWith('₪')).toBe(true);
  });
});

// ============================================================================
// parseFormattedNumber
// ============================================================================

describe('parseFormattedNumber', () => {
  it('parses plain number string', () => {
    expect(parseFormattedNumber('1000')).toBe(1000);
  });

  it('removes ₪ symbol', () => {
    expect(parseFormattedNumber('₪5,000')).toBe(5000);
  });

  it('removes comma separators', () => {
    expect(parseFormattedNumber('10,000')).toBe(10000);
  });

  it('removes spaces', () => {
    expect(parseFormattedNumber('10 000')).toBe(10000);
  });

  it('handles decimal numbers', () => {
    expect(parseFormattedNumber('1,234.56')).toBeCloseTo(1234.56);
  });

  it('returns 0 for empty string', () => {
    expect(parseFormattedNumber('')).toBe(0);
  });

  it('returns 0 for non-numeric string', () => {
    expect(parseFormattedNumber('abc')).toBe(0);
  });

  it('round-trips with formatCurrency', () => {
    const original = 12345;
    const formatted = formatCurrency(original);
    const parsed = parseFormattedNumber(formatted);
    expect(parsed).toBe(original);
  });
});
