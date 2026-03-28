/**
 * Learning Engine — Pure Function Tests
 *
 * Tests financial signatures, DNA matching, amount ranges.
 * No DB calls — pure logic only.
 */

import { describe, it, expect } from 'vitest';

// ── Extract pure functions for testing ──

function getAmountRange(amount: number): string {
  const abs = Math.abs(amount);
  if (abs <= 50) return 'micro';
  if (abs <= 200) return 'small';
  if (abs <= 500) return 'medium';
  if (abs <= 1000) return 'large';
  if (abs <= 3000) return 'xlarge';
  return 'jumbo';
}

function normalizeVendorName(vendor: string): string {
  if (!vendor) return '';
  return vendor
    .toLowerCase()
    .trim()
    .replace(/\s*\d+\s*$/, '')
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFinancialSignature(vendor: string, amount: number): string {
  return `${normalizeVendorName(vendor)}|${getAmountRange(amount)}`;
}

interface DNAEntry {
  category: string;
  vendor: string | string[];
  amount: number;
  amount_min: number;
  amount_max: number;
}

function matchAgainstDNA(
  tx: { vendor?: string; amount?: number },
  dna: Record<string, DNAEntry>
): { matched: boolean; category?: string; confidence?: number } {
  if (!tx.vendor || !tx.amount || Object.keys(dna).length === 0) {
    return { matched: false };
  }
  const vendorNorm = normalizeVendorName(tx.vendor);
  const amount = Math.abs(Number(tx.amount));

  for (const [, entry] of Object.entries(dna)) {
    const dnaVendors = Array.isArray(entry.vendor) ? entry.vendor : [entry.vendor];
    const vendorMatch = dnaVendors.some(v => {
      const vNorm = normalizeVendorName(v);
      return vNorm === vendorNorm || vNorm.includes(vendorNorm) || vendorNorm.includes(vNorm);
    });
    if (!vendorMatch) continue;

    const tolerance = entry.amount * 0.20;
    if (amount >= entry.amount_min - tolerance && amount <= entry.amount_max + tolerance) {
      return { matched: true, category: entry.category, confidence: 0.95 };
    }
  }
  return { matched: false };
}

// ── Tests ──

describe('Amount Range Classification', () => {
  it('0-50 = micro', () => {
    expect(getAmountRange(15)).toBe('micro');
    expect(getAmountRange(50)).toBe('micro');
  });
  it('51-200 = small', () => {
    expect(getAmountRange(51)).toBe('small');
    expect(getAmountRange(189)).toBe('small');
  });
  it('201-500 = medium', () => {
    expect(getAmountRange(342)).toBe('medium');
  });
  it('501-1000 = large', () => {
    expect(getAmountRange(840)).toBe('large');
  });
  it('1001-3000 = xlarge', () => {
    expect(getAmountRange(1200)).toBe('xlarge');
  });
  it('3001+ = jumbo', () => {
    expect(getAmountRange(4200)).toBe('jumbo');
    expect(getAmountRange(50000)).toBe('jumbo');
  });
  it('handles negative amounts', () => {
    expect(getAmountRange(-150)).toBe('small');
  });
  it('handles zero', () => {
    expect(getAmountRange(0)).toBe('micro');
  });
});

describe('Vendor Normalization', () => {
  it('lowercases', () => {
    expect(normalizeVendorName('NETFLIX')).toBe('netflix');
  });
  it('trims whitespace', () => {
    expect(normalizeVendorName('  רמי לוי  ')).toBe('רמי לוי');
  });
  it('removes trailing numbers', () => {
    expect(normalizeVendorName('רמי לוי 123')).toBe('רמי לוי');
  });
  it('removes special characters', () => {
    expect(normalizeVendorName('אמ.בי. בורגר בע"מ')).toBe('אמבי בורגר בעמ');
  });
  it('collapses multiple spaces', () => {
    expect(normalizeVendorName('רמי   לוי')).toBe('רמי לוי');
  });
  it('returns empty for empty input', () => {
    expect(normalizeVendorName('')).toBe('');
  });
  it('preserves Hebrew + English mix', () => {
    expect(normalizeVendorName('HOT מובייל')).toBe('hot מובייל');
  });
});

describe('Financial Signature', () => {
  it('"מגדל" 189₪ = "מגדל|small"', () => {
    expect(getFinancialSignature('מגדל', 189)).toBe('מגדל|small');
  });
  it('"מגדל" 1200₪ = "מגדל|xlarge" (different from 189!)', () => {
    expect(getFinancialSignature('מגדל', 1200)).toBe('מגדל|xlarge');
  });
  it('same vendor, different amount = different signature', () => {
    const sig1 = getFinancialSignature('מגדל', 189);
    const sig2 = getFinancialSignature('מגדל', 1200);
    expect(sig1).not.toBe(sig2);
  });
  it('normalizes vendor in signature', () => {
    expect(getFinancialSignature('  NETFLIX  ', 50)).toBe('netflix|micro');
  });
});

describe('DNA Matching', () => {
  const sampleDNA: Record<string, DNAEntry> = {
    'ביטוח בריאות': {
      category: 'ביטוח בריאות',
      vendor: 'מגדל',
      amount: 189,
      amount_min: 180,
      amount_max: 200,
    },
    'קניות סופר': {
      category: 'קניות סופר',
      vendor: ['רמי לוי', 'שופרסל'],
      amount: 3000,
      amount_min: 2500,
      amount_max: 3500,
    },
    'שכירות': {
      category: 'שכירות למגורים',
      vendor: 'בעל דירה',
      amount: 4200,
      amount_min: 4200,
      amount_max: 4200,
    },
  };

  it('matches exact vendor + amount in range', () => {
    const result = matchAgainstDNA({ vendor: 'מגדל', amount: 189 }, sampleDNA);
    expect(result.matched).toBe(true);
    expect(result.category).toBe('ביטוח בריאות');
    expect(result.confidence).toBe(0.95);
  });

  it('matches within ±20% tolerance', () => {
    // 189 * 1.20 = 226.8 → 220 should match
    const result = matchAgainstDNA({ vendor: 'מגדל', amount: 220 }, sampleDNA);
    expect(result.matched).toBe(true);
  });

  it('does NOT match vendor with wrong amount range', () => {
    // מגדל at 1200₪ is not ביטוח בריאות (DNA says 180-200)
    const result = matchAgainstDNA({ vendor: 'מגדל', amount: 1200 }, sampleDNA);
    expect(result.matched).toBe(false);
  });

  it('matches multi-vendor DNA (array)', () => {
    const result = matchAgainstDNA({ vendor: 'רמי לוי שיווק', amount: 3000 }, sampleDNA);
    expect(result.matched).toBe(true);
    expect(result.category).toBe('קניות סופר');
  });

  it('matches second vendor in array', () => {
    const result = matchAgainstDNA({ vendor: 'שופרסל', amount: 2800 }, sampleDNA);
    expect(result.matched).toBe(true);
    expect(result.category).toBe('קניות סופר');
  });

  it('returns false for unknown vendor', () => {
    const result = matchAgainstDNA({ vendor: 'חנות אקראית', amount: 100 }, sampleDNA);
    expect(result.matched).toBe(false);
  });

  it('returns false for empty DNA', () => {
    const result = matchAgainstDNA({ vendor: 'מגדל', amount: 189 }, {});
    expect(result.matched).toBe(false);
  });

  it('returns false for null vendor', () => {
    const result = matchAgainstDNA({ vendor: undefined, amount: 189 }, sampleDNA);
    expect(result.matched).toBe(false);
  });

  it('returns false for null amount', () => {
    const result = matchAgainstDNA({ vendor: 'מגדל', amount: undefined }, sampleDNA);
    expect(result.matched).toBe(false);
  });

  it('handles exact amount (שכירות 4200 exactly)', () => {
    const result = matchAgainstDNA({ vendor: 'בעל דירה', amount: 4200 }, sampleDNA);
    expect(result.matched).toBe(true);
    expect(result.category).toBe('שכירות למגורים');
  });
});
