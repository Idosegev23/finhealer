/**
 * E2E User Journey Simulation
 *
 * Simulates the complete user flow WITHOUT real DB or API calls.
 * Tests the logic chain: message → fast path → action → response.
 */

import { describe, it, expect } from 'vitest';

// ── Simulate fast path logic (extracted from phi-brain.ts) ──

const EXPENSE_PATTERN = /^(.+?)\s+(\d[\d,.]*)\s*$|^(\d[\d,.]*)\s+(.+?)$/;
const COMMAND_MAP: Record<string, string> = {
  'סיכום': 'show_summary', 'מצב': 'show_money_flow', 'סטטוס': 'show_money_flow',
  'גרף': 'show_chart', 'תרשים': 'show_chart',
  'תקציב': 'show_budget', 'כמה נשאר': 'show_money_flow',
  'יעדים': 'show_goals', 'מטרות': 'show_goals',
  'תזרים': 'show_cashflow', 'תחזית': 'show_cashflow',
  'ציון': 'show_phi_score', 'דירוג': 'show_phi_score',
  'ניתוח': 'show_summary', 'בטל': 'undo_expense',
  'עזרה': 'help', 'תפריט': 'help',
  'כמה יש לי': 'show_money_flow', 'כמה חופשי': 'show_money_flow',
};

function simulateFastPath(message: string): { action: string; params?: any } | null {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // Commands
  for (const [cmd, action] of Object.entries(COMMAND_MAP)) {
    if (lower === cmd || lower.startsWith(cmd + ' ')) return { action };
  }

  // Greetings
  if (/^(היי|שלום|הי|בוקר טוב|ערב טוב|מה נשמע|אהלן)$/i.test(trimmed)) {
    return { action: 'greeting' };
  }

  // Expense
  const match = trimmed.match(EXPENSE_PATTERN);
  if (match) {
    const vendor = (match[1] || match[4] || '').trim();
    const amountStr = (match[2] || match[3] || '').replace(/,/g, '');
    const amount = parseFloat(amountStr);
    if (amount > 0 && amount < 100000 && vendor.length >= 2) {
      return { action: 'log_expense', params: { vendor, amount } };
    }
  }

  // Afford check
  const affordMatch = trimmed.match(/אפשר\s+(?:לקנות|לרכוש)?\s*(.+?)\s+ב?-?(\d[\d,.]*)/);
  if (affordMatch) {
    return {
      action: 'afford_check',
      params: { description: affordMatch[1].trim(), amount: parseFloat(affordMatch[2].replace(/,/g, '')) },
    };
  }

  return null; // → Gemini
}

// ── Tests ──

describe('E2E Journey: Morning Routine', () => {
  it('User says "בוקר טוב" → greeting (fast path, no Gemini)', () => {
    const result = simulateFastPath('בוקר טוב');
    expect(result?.action).toBe('greeting');
  });

  it('User says "כמה יש לי" → money flow (fast path)', () => {
    const result = simulateFastPath('כמה יש לי');
    expect(result?.action).toBe('show_money_flow');
  });
});

describe('E2E Journey: Expense Logging Throughout Day', () => {
  it('User buys coffee: "קפה 15" → log_expense', () => {
    const result = simulateFastPath('קפה 15');
    expect(result?.action).toBe('log_expense');
    expect(result?.params).toEqual({ vendor: 'קפה', amount: 15 });
  });

  it('User refuels: "דלק 300" → log_expense', () => {
    const result = simulateFastPath('דלק 300');
    expect(result?.action).toBe('log_expense');
    expect(result?.params).toEqual({ vendor: 'דלק', amount: 300 });
  });

  it('User at supermarket: "רמי לוי 342.50" → log_expense', () => {
    const result = simulateFastPath('רמי לוי 342.50');
    expect(result?.action).toBe('log_expense');
    expect(result?.params).toEqual({ vendor: 'רמי לוי', amount: 342.5 });
  });

  it('User says amount first: "200 נעליים" → log_expense', () => {
    const result = simulateFastPath('200 נעליים');
    expect(result?.action).toBe('log_expense');
    expect(result?.params).toEqual({ vendor: 'נעליים', amount: 200 });
  });

  it('User makes mistake: "בטל" → undo (fast path)', () => {
    const result = simulateFastPath('בטל');
    expect(result?.action).toBe('undo_expense');
  });
});

describe('E2E Journey: Evening Check', () => {
  it('User says "סיכום" → show_summary (fast path)', () => {
    const result = simulateFastPath('סיכום');
    expect(result?.action).toBe('show_summary');
  });

  it('User says "גרף" → show_chart (fast path)', () => {
    const result = simulateFastPath('גרף');
    expect(result?.action).toBe('show_chart');
  });

  it('User says "תקציב" → show_budget (fast path)', () => {
    const result = simulateFastPath('תקציב');
    expect(result?.action).toBe('show_budget');
  });

  it('User says "יעדים" → show_goals (fast path)', () => {
    const result = simulateFastPath('יעדים');
    expect(result?.action).toBe('show_goals');
  });
});

describe('E2E Journey: Purchase Decision', () => {
  it('"אפשר לקנות טלוויזיה ב-3000" → afford_check', () => {
    const result = simulateFastPath('אפשר לקנות טלוויזיה ב-3000');
    expect(result?.action).toBe('afford_check');
    expect(result?.params?.description).toBe('טלוויזיה');
    expect(result?.params?.amount).toBe(3000);
  });

  it('"אפשר לקנות נעליים ב500" → afford_check', () => {
    const result = simulateFastPath('אפשר לקנות נעליים ב500');
    expect(result?.action).toBe('afford_check');
    expect(result?.params?.amount).toBe(500);
  });

  it('"אפשר לרכוש מחשב ב-4,500" → afford_check (with comma)', () => {
    const result = simulateFastPath('אפשר לרכוש מחשב ב-4,500');
    expect(result?.action).toBe('afford_check');
    expect(result?.params?.amount).toBe(4500);
  });
});

describe('E2E Journey: Complex Questions → Gemini', () => {
  it('"למה הוצאתי כל כך הרבה על מסעדות?" → null (needs Gemini)', () => {
    expect(simulateFastPath('למה הוצאתי כל כך הרבה על מסעדות?')).toBeNull();
  });

  it('"מה דעתך על ההוצאות שלי?" → null (needs Gemini)', () => {
    expect(simulateFastPath('מה דעתך על ההוצאות שלי?')).toBeNull();
  });

  it('"תן לי טיפ לחיסכון" → null (needs Gemini)', () => {
    expect(simulateFastPath('תן לי טיפ לחיסכון')).toBeNull();
  });

  it('"כמה הוצאתי על אוכל בינואר?" → null (needs Gemini)', () => {
    expect(simulateFastPath('כמה הוצאתי על אוכל בינואר?')).toBeNull();
  });
});

describe('E2E Journey: Edge Cases', () => {
  it('empty message → null', () => {
    expect(simulateFastPath('')).toBeNull();
  });

  it('whitespace only → null', () => {
    expect(simulateFastPath('   ')).toBeNull();
  });

  it('emoji only → null (goes to Gemini)', () => {
    expect(simulateFastPath('😊')).toBeNull();
  });

  it('very long message → null (goes to Gemini)', () => {
    const long = 'א'.repeat(500);
    expect(simulateFastPath(long)).toBeNull();
  });

  it('"סופר" without amount → null (goes to Gemini, not expense)', () => {
    expect(simulateFastPath('סופר')).toBeNull();
  });

  it('"450" without vendor → null', () => {
    expect(simulateFastPath('450')).toBeNull();
  });
});

describe('E2E Journey: Hebrew Greetings', () => {
  const greetings = ['היי', 'שלום', 'הי', 'בוקר טוב', 'ערב טוב', 'מה נשמע', 'אהלן'];
  for (const g of greetings) {
    it(`"${g}" → greeting`, () => {
      expect(simulateFastPath(g)?.action).toBe('greeting');
    });
  }
});

describe('E2E Journey: All Commands Work', () => {
  const commands: Array<[string, string]> = [
    ['סיכום', 'show_summary'],
    ['מצב', 'show_money_flow'],
    ['סטטוס', 'show_money_flow'],
    ['גרף', 'show_chart'],
    ['תרשים', 'show_chart'],
    ['תקציב', 'show_budget'],
    ['כמה נשאר', 'show_money_flow'],
    ['יעדים', 'show_goals'],
    ['מטרות', 'show_goals'],
    ['תזרים', 'show_cashflow'],
    ['תחזית', 'show_cashflow'],
    ['ציון', 'show_phi_score'],
    ['דירוג', 'show_phi_score'],
    ['ניתוח', 'show_summary'],
    ['בטל', 'undo_expense'],
    ['עזרה', 'help'],
    ['תפריט', 'help'],
    ['כמה יש לי', 'show_money_flow'],
    ['כמה חופשי', 'show_money_flow'],
  ];

  for (const [cmd, expected] of commands) {
    it(`"${cmd}" → ${expected}`, () => {
      expect(simulateFastPath(cmd)?.action).toBe(expected);
    });
  }
});
