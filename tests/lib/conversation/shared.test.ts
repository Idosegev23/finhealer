/**
 * Unit tests for lib/conversation/shared.ts
 * Tests: isCommand, normalizeVendor, createProgressBar
 */

import { describe, it, expect } from 'vitest';
import { isCommand, normalizeVendor, createProgressBar } from '@/lib/conversation/shared';

// ============================================================================
// isCommand
// ============================================================================

describe('isCommand', () => {
  it('matches exact Hebrew command', () => {
    expect(isCommand('נתחיל', ['נתחיל', 'התחל'])).toBe(true);
  });

  it('matches case-insensitive English command', () => {
    expect(isCommand('SKIP', ['skip', 'דלג'])).toBe(true);
  });

  it('matches command with leading/trailing whitespace', () => {
    expect(isCommand('  נתחיל  ', ['נתחיל'])).toBe(true);
  });

  it('matches command with emojis stripped', () => {
    expect(isCommand('▶️ נתחיל לסווג', ['נתחיל לסווג'])).toBe(true);
  });

  it('matches when message includes command as substring', () => {
    expect(isCommand('בוא נתחיל', ['נתחיל'])).toBe(true);
  });

  it('does not match unrelated message', () => {
    expect(isCommand('שלום', ['נתחיל', 'התחל'])).toBe(false);
  });

  it('handles empty commands array', () => {
    expect(isCommand('נתחיל', [])).toBe(false);
  });

  it('handles empty message', () => {
    expect(isCommand('', ['נתחיל'])).toBe(false);
  });

  it('matches "כן" confirmation command', () => {
    expect(isCommand('כן', ['כן', 'כנ', 'נכון', 'אשר', 'ok', 'yes'])).toBe(true);
  });

  it('matches "דלג" skip command', () => {
    expect(isCommand('דלג', ['דלג', 'תדלג', 'הבא', 'skip'])).toBe(true);
  });

  it('matches "סיימתי" finish command', () => {
    expect(isCommand('סיימתי', ['סיימתי', 'סיום', 'מספיק', 'finish', 'done'])).toBe(true);
  });

  it('matches button ID commands (e.g. start_classify)', () => {
    expect(isCommand('start_classify', ['start_classify', 'נתחיל'])).toBe(true);
  });
});

// ============================================================================
// normalizeVendor
// ============================================================================

describe('normalizeVendor', () => {
  it('trims and lowercases', () => {
    expect(normalizeVendor('  SuperSal  ')).toBe('supersal');
  });

  it('removes trailing numbers', () => {
    expect(normalizeVendor('רמי לוי 123')).toBe('רמי לוי');
  });

  it('removes special characters but keeps Hebrew and alphanumeric', () => {
    expect(normalizeVendor('שופרסל-דיל!')).toBe('שופרסלדיל');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeVendor('רמי   לוי')).toBe('רמי לוי');
  });

  it('handles empty string', () => {
    expect(normalizeVendor('')).toBe('');
  });

  it('handles string with only special chars', () => {
    expect(normalizeVendor('!!!')).toBe('');
  });
});

// ============================================================================
// createProgressBar
// ============================================================================

describe('createProgressBar', () => {
  it('returns empty bar for 0%', () => {
    expect(createProgressBar(0)).toBe('░░░░░░░░░░');
  });

  it('returns full bar for 100%', () => {
    expect(createProgressBar(100)).toBe('▓▓▓▓▓▓▓▓▓▓');
  });

  it('returns half bar for 50%', () => {
    expect(createProgressBar(50)).toBe('▓▓▓▓▓░░░░░');
  });

  it('clamps values above 100', () => {
    expect(createProgressBar(150)).toBe('▓▓▓▓▓▓▓▓▓▓');
  });

  it('clamps negative values to 0', () => {
    expect(createProgressBar(-10)).toBe('░░░░░░░░░░');
  });

  it('always returns 10 characters', () => {
    expect(createProgressBar(33).length).toBe(10);
  });
});
