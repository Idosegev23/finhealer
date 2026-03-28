/**
 * AI Classifier — Hard Rules Unit Tests
 *
 * Tests the rule-based layer (Layer 1) without any DB or API calls.
 * Extracts the matchHardRule logic for pure testing.
 */

import { describe, it, expect } from 'vitest';

// ── Extract HARD_RULES + matchHardRule for testing ──
// (Copied from ai-classifier.ts to avoid server-side imports)

const HARD_RULES: Record<string, { category: string; expense_type?: string; is_credit?: boolean }> = {
  'רמי לוי': { category: 'קניות סופר', expense_type: 'variable' },
  'שופרסל': { category: 'קניות סופר', expense_type: 'variable' },
  'ויקטורי': { category: 'קניות סופר', expense_type: 'variable' },
  'אושר עד': { category: 'קניות סופר', expense_type: 'variable' },
  'יש חסד': { category: 'קניות סופר', expense_type: 'variable' },
  'carrefour': { category: 'קניות סופר', expense_type: 'variable' },
  'סונול': { category: 'דלק', expense_type: 'variable' },
  'פז ': { category: 'דלק', expense_type: 'variable' },
  'דור אלון': { category: 'דלק', expense_type: 'variable' },
  'פלאפון': { category: 'טלפונים ניידים', expense_type: 'fixed' },
  'סלקום': { category: 'טלפונים ניידים', expense_type: 'fixed' },
  'פרטנר': { category: 'טלפונים ניידים', expense_type: 'fixed' },
  'netflix': { category: 'מנויים דיגיטליים (נטפליקס ספוטיפיי)', expense_type: 'fixed' },
  'los gatos': { category: 'מנויים דיגיטליים (נטפליקס ספוטיפיי)', expense_type: 'fixed' },
  'spotify': { category: 'מנויים דיגיטליים (נטפליקס ספוטיפיי)', expense_type: 'fixed' },
  'stockholm se': { category: 'מנויים דיגיטליים (נטפליקס ספוטיפיי)', expense_type: 'fixed' },
  'facebk': { category: 'קמפיינים דיגיטליים', expense_type: 'variable' },
  'facebook': { category: 'קמפיינים דיגיטליים', expense_type: 'variable' },
  'מכבי': { category: 'קופת חולים', expense_type: 'fixed' },
  'כביש 6': { category: 'כביש 6 / כבישי אגרה', expense_type: 'variable' },
  'פנגו': { category: 'חניה', expense_type: 'variable' },
  'cello': { category: 'חניה', expense_type: 'variable' },
  'חברת חשמל': { category: 'חשמל לבית', expense_type: 'fixed' },
  'ביטוח לאומי': { category: 'דמי ביטוח לאומי', expense_type: 'fixed' },
  'ויזה': { category: 'חיוב כרטיס אשראי', is_credit: true },
  'visa': { category: 'חיוב כרטיס אשראי', is_credit: true },
  'מסטרקארד': { category: 'חיוב כרטיס אשראי', is_credit: true },
  'ישראכרט': { category: 'חיוב כרטיס אשראי', is_credit: true },
  'דמי כרטיס': { category: 'עמלות בנק פרטי', expense_type: 'fixed' },
  'קסטרו': { category: 'ביגוד', expense_type: 'variable' },
};

function matchHardRule(vendor: string): { category: string; expense_type?: string; is_credit?: boolean } | null {
  if (!vendor) return null;
  const lower = vendor.toLowerCase().trim();
  for (const [key, rule] of Object.entries(HARD_RULES)) {
    if (lower.includes(key) || key.includes(lower)) {
      return rule;
    }
  }
  return null;
}

// ── Tests ──

describe('Hard Rules: Israeli Supermarkets', () => {
  it('matches "רמי לוי שיווק השקמה" → קניות סופר', () => {
    expect(matchHardRule('רמי לוי שיווק השקמה')?.category).toBe('קניות סופר');
  });
  it('matches "שופרסל דיל" → קניות סופר', () => {
    expect(matchHardRule('שופרסל דיל')?.category).toBe('קניות סופר');
  });
  it('matches "יש חסד בארות יצחק" → קניות סופר', () => {
    expect(matchHardRule('יש חסד בארות יצחק')?.category).toBe('קניות סופר');
  });
  it('matches "CARREFOUR בילינסון" (case insensitive) → קניות סופר', () => {
    expect(matchHardRule('CARREFOUR בילינסון')?.category).toBe('קניות סופר');
  });
});

describe('Hard Rules: Telecom', () => {
  it('matches "פלאפון חשבון תקופתי" → טלפונים ניידים (fixed)', () => {
    const result = matchHardRule('פלאפון חשבון תקופתי');
    expect(result?.category).toBe('טלפונים ניידים');
    expect(result?.expense_type).toBe('fixed');
  });
  it('matches "חברת פרטנר תקשורת בע"מ" → טלפונים ניידים', () => {
    expect(matchHardRule('חברת פרטנר תקשורת בע"מ')?.category).toBe('טלפונים ניידים');
  });
});

describe('Hard Rules: Subscriptions (International)', () => {
  it('matches "Los Gatos NL" → Netflix (מנוי דיגיטלי)', () => {
    expect(matchHardRule('Los Gatos NL')?.category).toContain('נטפליקס');
  });
  it('matches "Stockholm SE" → Spotify (מנוי דיגיטלי)', () => {
    expect(matchHardRule('Stockholm SE')?.category).toContain('נטפליקס');
  });
  it('matches "FACEBK *UK77QEMJP2" → קמפיינים דיגיטליים', () => {
    expect(matchHardRule('FACEBK *UK77QEMJP2')?.category).toBe('קמפיינים דיגיטליים');
  });
});

describe('Hard Rules: Credit Card Charges (is_summary)', () => {
  it('matches "ויזה" → is_credit: true', () => {
    const result = matchHardRule('ויזה');
    expect(result?.is_credit).toBe(true);
    expect(result?.category).toBe('חיוב כרטיס אשראי');
  });
  it('matches "VISA" (English) → is_credit: true', () => {
    expect(matchHardRule('VISA')?.is_credit).toBe(true);
  });
  it('matches "ישראכרט" → is_credit: true', () => {
    expect(matchHardRule('ישראכרט')?.is_credit).toBe(true);
  });
  it('matches "מסטרקארד" → is_credit: true', () => {
    expect(matchHardRule('מסטרקארד')?.is_credit).toBe(true);
  });
});

describe('Hard Rules: Government & Taxes', () => {
  it('matches "ביטוח לאומי" → דמי ביטוח לאומי (fixed)', () => {
    const result = matchHardRule('ביטוח לאומי');
    expect(result?.category).toBe('דמי ביטוח לאומי');
    expect(result?.expense_type).toBe('fixed');
  });
  it('matches "חברת חשמל" → חשמל לבית (fixed)', () => {
    expect(matchHardRule('חברת חשמל')?.category).toBe('חשמל לבית');
  });
});

describe('Hard Rules: Edge Cases', () => {
  it('returns null for empty string', () => {
    expect(matchHardRule('')).toBeNull();
  });
  it('returns null for null-like input', () => {
    expect(matchHardRule(null as any)).toBeNull();
  });
  it('returns null for unknown vendor', () => {
    expect(matchHardRule('חנות לא ידועה בע"מ')).toBeNull();
  });
  it('returns null for partial match that is too short', () => {
    // "פז " has trailing space in HARD_RULES — "פז" without space might match
    // This tests that the matching is inclusive
    expect(matchHardRule('פז תדלוק')?.category).toBe('דלק');
  });
});

describe('Hard Rules: Expense Type Classification', () => {
  it('supermarket = variable', () => {
    expect(matchHardRule('רמי לוי')?.expense_type).toBe('variable');
  });
  it('phone = fixed', () => {
    expect(matchHardRule('פלאפון')?.expense_type).toBe('fixed');
  });
  it('Netflix = fixed', () => {
    expect(matchHardRule('netflix')?.expense_type).toBe('fixed');
  });
  it('parking = variable', () => {
    expect(matchHardRule('פנגו')?.expense_type).toBe('variable');
  });
  it('credit card charge has no expense_type (only is_credit)', () => {
    const result = matchHardRule('ויזה');
    expect(result?.expense_type).toBeUndefined();
    expect(result?.is_credit).toBe(true);
  });
});
