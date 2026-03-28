import { describe, it, expect } from 'vitest';

// We can't import phi-brain directly (server deps), so test the fast path logic inline
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

function parseExpense(msg: string): { vendor: string; amount: number } | null {
  const match = msg.trim().match(EXPENSE_PATTERN);
  if (!match) return null;
  const vendor = (match[1] || match[4] || '').trim();
  const amountStr = (match[2] || match[3] || '').replace(/,/g, '');
  const amount = parseFloat(amountStr);
  if (amount > 0 && amount < 100000 && vendor.length >= 2) {
    return { vendor, amount };
  }
  return null;
}

function parseCommand(msg: string): string | null {
  const lower = msg.trim().toLowerCase();
  for (const [cmd, action] of Object.entries(COMMAND_MAP)) {
    if (lower === cmd) return action;
  }
  return null;
}

describe('Fast Path: Expense Parsing', () => {
  it('parses "סופר 450"', () => {
    expect(parseExpense('סופר 450')).toEqual({ vendor: 'סופר', amount: 450 });
  });

  it('parses "קפה 15"', () => {
    expect(parseExpense('קפה 15')).toEqual({ vendor: 'קפה', amount: 15 });
  });

  it('parses "200 נעליים" (amount first)', () => {
    expect(parseExpense('200 נעליים')).toEqual({ vendor: 'נעליים', amount: 200 });
  });

  it('parses "דלק 300.50" (decimal)', () => {
    expect(parseExpense('דלק 300.50')).toEqual({ vendor: 'דלק', amount: 300.5 });
  });

  it('parses "רמי לוי 342" (multi-word vendor)', () => {
    expect(parseExpense('רמי לוי 342')).toEqual({ vendor: 'רמי לוי', amount: 342 });
  });

  it('parses "1,500 ביגוד" (with comma)', () => {
    expect(parseExpense('1,500 ביגוד')).toEqual({ vendor: 'ביגוד', amount: 1500 });
  });

  it('rejects just a number', () => {
    expect(parseExpense('450')).toBeNull();
  });

  it('rejects just text', () => {
    expect(parseExpense('סופר')).toBeNull();
  });

  it('rejects amount > 100000', () => {
    expect(parseExpense('סופר 200000')).toBeNull();
  });

  it('rejects single-char vendor', () => {
    expect(parseExpense('a 50')).toBeNull();
  });
});

describe('Fast Path: Command Matching', () => {
  it('matches "סיכום" → show_summary', () => {
    expect(parseCommand('סיכום')).toBe('show_summary');
  });

  it('matches "גרף" → show_chart', () => {
    expect(parseCommand('גרף')).toBe('show_chart');
  });

  it('matches "בטל" → undo_expense', () => {
    expect(parseCommand('בטל')).toBe('undo_expense');
  });

  it('matches "עזרה" → help', () => {
    expect(parseCommand('עזרה')).toBe('help');
  });

  it('matches "כמה יש לי" → show_money_flow', () => {
    expect(parseCommand('כמה יש לי')).toBe('show_money_flow');
  });

  it('returns null for unknown commands', () => {
    expect(parseCommand('מה המצב עם הביטוח?')).toBeNull();
  });

  it('returns null for expense-like messages', () => {
    expect(parseCommand('סופר 450')).toBeNull();
  });
});

describe('Fast Path: Afford Check Parsing', () => {
  const AFFORD_PATTERN = /אפשר\s+(?:לקנות|לרכוש)?\s*(.+?)\s+ב?-?(\d[\d,.]*)/;

  it('parses "אפשר לקנות טלוויזיה ב-3000"', () => {
    const match = 'אפשר לקנות טלוויזיה ב-3000'.match(AFFORD_PATTERN);
    expect(match).toBeTruthy();
    expect(match![1].trim()).toBe('טלוויזיה');
    expect(parseFloat(match![2])).toBe(3000);
  });

  it('parses "אפשר נעליים ב500"', () => {
    const match = 'אפשר נעליים ב500'.match(AFFORD_PATTERN);
    expect(match).toBeTruthy();
    expect(match![1].trim()).toBe('נעליים');
    expect(parseFloat(match![2])).toBe(500);
  });
});
