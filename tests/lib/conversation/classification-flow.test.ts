/**
 * E2E tests for the classification flow.
 *
 * Tests the full lifecycle:
 *   1. Start classification → auto-classify with rules → show first income
 *   2. Classify income → skip income → move to expenses
 *   3. Classify expense group → skip expense group
 *   4. "סיימתי" (finish early) → marks remaining as unclassified
 *   5. Move to next phase (goals_setup) after all classified
 *   6. Missing credit documents flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockQuery, type MockStore } from '../../mocks/mock-query';

// ── Shared state ──

const mockStore: MockStore = {};
const sentMessages: Array<{ phone: string; message: string }> = [];

function mockFrom(tableName: string) {
  if (!mockStore[tableName]) mockStore[tableName] = [];
  return new MockQuery(tableName, mockStore);
}

// ── Module mocks ──

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
  createClient: async () => ({ from: mockFrom }),
}));

vi.mock('@/lib/greenapi/client', () => ({
  getGreenAPIClient: () => ({
    sendMessage: vi.fn(async ({ phoneNumber, message }: any) => {
      sentMessages.push({ phone: phoneNumber, message });
      return { idMessage: 'mock' };
    }),
    sendInteractiveButtons: vi.fn(async ({ phoneNumber, message }: any) => {
      sentMessages.push({ phone: phoneNumber, message });
      return { idMessage: 'mock' };
    }),
    sendButtons: vi.fn(async ({ phoneNumber, message }: any) => {
      sentMessages.push({ phone: phoneNumber, message });
      return { idMessage: 'mock' };
    }),
  }),
  sendWhatsAppInteractiveButtons: vi.fn(async () => ({ idMessage: 'mock' })),
  sendWhatsAppMessage: vi.fn(),
  sendWhatsAppImage: vi.fn(),
}));

vi.mock('@/lib/conversation/classification-flow', () => ({
  getClassifiableTransactions: vi.fn(async (userId: string, type: string) => {
    const rows = mockStore['transactions'] || [];
    return rows.filter(
      (t: any) => t.user_id === userId && t.status === 'pending' && t.type === type
    );
  }),
  checkAndRequestMissingDocuments: vi.fn(async () => false),
}));

vi.mock('@/lib/conversation/advanced-goals-handler', () => ({
  startAdvancedGoal: vi.fn(async () => {}),
}));

// ── Import modules under test ──

import {
  handleClassificationState,
  handleClassificationResponse,
  startClassification,
} from '@/lib/conversation/states/classification';
import type { RouterContext } from '@/lib/conversation/shared';

// ============================================================================
// Helpers
// ============================================================================

const PHONE = '972501234567';
const USER_ID = 'user-test-1';

function makeCtx(overrides?: Partial<RouterContext>): RouterContext {
  return {
    userId: USER_ID,
    phone: PHONE,
    state: 'classification',
    userName: 'טסט',
    ...overrides,
  };
}

function resetAll() {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
  sentMessages.length = 0;
}

function seedUser(state = 'classification', ctx: any = {}) {
  mockStore['users'] = [
    {
      id: USER_ID,
      name: 'טסט',
      onboarding_state: state,
      classification_context: ctx,
    },
  ];
}

function seedTransactions(txs: Array<Partial<any>>) {
  mockStore['transactions'] = txs.map((tx, i) => ({
    id: tx.id || `tx-${i}`,
    user_id: USER_ID,
    amount: tx.amount || -100,
    vendor: tx.vendor || `חנות ${i}`,
    tx_date: tx.tx_date || '2025-01-15',
    type: tx.type || 'expense',
    status: tx.status || 'pending',
    category: tx.category || null,
    expense_category: tx.expense_category || null,
    income_category: tx.income_category || null,
    original_description: tx.original_description || '',
    notes: tx.notes || null,
    ...tx,
  }));
}

function seedUploadedStatements(count = 1) {
  mockStore['uploaded_statements'] = Array.from({ length: count }, (_, i) => ({
    id: `doc-${i}`,
    user_id: USER_ID,
    document_type: 'bank',
    created_at: new Date().toISOString(),
  }));
}

function seedCategoryRules(rules: Array<{ vendor_pattern: string; category: string; auto_approved?: boolean }>) {
  mockStore['user_category_rules'] = rules.map((r, i) => ({
    id: `rule-${i}`,
    user_id: USER_ID,
    vendor_pattern: r.vendor_pattern,
    category: r.category,
    auto_approved: r.auto_approved ?? false,
    learn_count: r.auto_approved ? 3 : 1,
    times_used: 1,
    confidence: 1.0,
    last_used_at: new Date().toISOString(),
  }));
}

// ============================================================================
// Tests
// ============================================================================

describe('Classification Flow E2E', () => {
  beforeEach(() => {
    resetAll();
  });

  // --------------------------------------------------------------------------
  // handleClassificationState
  // --------------------------------------------------------------------------

  describe('handleClassificationState', () => {
    it('starts classification when user says "נתחיל"', async () => {
      seedUser('classification');
      seedUploadedStatements();
      seedTransactions([
        { type: 'income', vendor: 'משכורת', amount: 10000 },
      ]);

      const result = await handleClassificationState(makeCtx(), 'נתחיל');
      expect(result.success).toBe(true);
    });

    it('asks for document when user says "עוד דוח"', async () => {
      seedUser('classification');
      const result = await handleClassificationState(makeCtx(), 'עוד דוח');
      expect(result.success).toBe(true);
      expect(sentMessages.some(m => m.message.includes('שלח לי את המסמך'))).toBe(true);
    });

    it('shows options on unknown message', async () => {
      seedUser('classification');
      const result = await handleClassificationState(makeCtx(), 'בלה בלה');
      expect(result.success).toBe(true);
      expect(sentMessages.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // startClassification - auto-classify
  // --------------------------------------------------------------------------

  describe('startClassification', () => {
    it('auto-classifies transactions using learned rules', async () => {
      seedUser('classification');
      seedUploadedStatements();
      seedCategoryRules([
        { vendor_pattern: 'שופרסל', category: 'סופרמרקט', auto_approved: true },
      ]);
      seedTransactions([
        { id: 'tx-auto', type: 'expense', vendor: 'שופרסל', status: 'pending' },
        { id: 'tx-manual', type: 'expense', vendor: 'חנות חדשה', status: 'pending' },
      ]);

      await startClassification(makeCtx());

      const autoTx = mockStore['transactions'].find((t: any) => t.id === 'tx-auto');
      expect(autoTx.status).toBe('confirmed');
      expect(autoTx.category).toBe('סופרמרקט');

      const manualTx = mockStore['transactions'].find((t: any) => t.id === 'tx-manual');
      expect(manualTx.status).toBe('pending');

      expect(sentMessages.some(m => m.message.includes('סיווגתי אוטומטית'))).toBe(true);
    });

    it('tells user to upload docs when none exist', async () => {
      seedUser('classification');
      mockStore['uploaded_statements'] = [];
      seedTransactions([]);

      await startClassification(makeCtx());

      expect(sentMessages.some(m => m.message.includes('אין עדיין דוחות'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Income classification
  // --------------------------------------------------------------------------

  describe('Income classification', () => {
    it('skip marks transaction as confirmed with "לא מסווג"', async () => {
      seedUser('classification_income', { suggestions: ['משכורת'] });
      seedTransactions([
        { id: 'tx-inc-1', type: 'income', vendor: 'חברה א', amount: 5000, status: 'pending' },
        { id: 'tx-inc-2', type: 'income', vendor: 'חברה ב', amount: 3000, status: 'pending' },
      ]);

      const ctx = makeCtx({ state: 'classification_income' });
      await handleClassificationResponse(ctx, 'דלג', 'income');

      const skipped = mockStore['transactions'].find((t: any) => t.id === 'tx-inc-1');
      expect(skipped.status).toBe('confirmed');
      expect(skipped.income_category).toBe('לא מסווג');
      expect(skipped.notes).toBe('דילג המשתמש');
    });

    it('classifying income with exact category name works', async () => {
      seedUser('classification_income');
      seedTransactions([
        { id: 'tx-inc-1', type: 'income', vendor: 'חברת הייטק', amount: 15000, status: 'pending' },
      ]);
      mockStore['user_category_rules'] = [];

      const ctx = makeCtx({ state: 'classification_income' });
      await handleClassificationResponse(ctx, 'משכורת', 'income');

      const classified = mockStore['transactions'].find((t: any) => t.id === 'tx-inc-1');
      expect(classified.status).toBe('confirmed');
      expect(classified.category).toBe('משכורת');
      expect(sentMessages.some(m => m.message.includes('✅'))).toBe(true);
    });

    it('"סיימתי" marks all remaining income as unclassified', async () => {
      seedUser('classification_income');
      seedTransactions([
        { id: 'tx-1', type: 'income', vendor: 'א', amount: 1000, status: 'pending' },
        { id: 'tx-2', type: 'income', vendor: 'ב', amount: 2000, status: 'pending' },
        { id: 'tx-3', type: 'income', vendor: 'ג', amount: 3000, status: 'pending' },
      ]);
      mockStore['missing_documents'] = [];

      const ctx = makeCtx({ state: 'classification_income' });
      await handleClassificationResponse(ctx, 'סיימתי', 'income');

      const allIncome = mockStore['transactions'].filter((t: any) => t.type === 'income');
      for (const tx of allIncome) {
        expect(tx.status).toBe('confirmed');
        expect(tx.income_category).toBe('לא מסווג');
        expect(tx.notes).toContain('סיום מוקדם');
      }

      expect(sentMessages.some(m => m.message.includes('3'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Expense classification
  // --------------------------------------------------------------------------

  describe('Expense classification', () => {
    it('groups expenses by vendor', async () => {
      seedUser('classification_expense', { group_ids: ['tx-e1', 'tx-e2'] });
      seedTransactions([
        { id: 'tx-e1', type: 'expense', vendor: 'שופרסל', amount: -200, status: 'pending' },
        { id: 'tx-e2', type: 'expense', vendor: 'שופרסל', amount: -150, status: 'pending' },
        { id: 'tx-e3', type: 'expense', vendor: 'פז', amount: -300, status: 'pending' },
      ]);
      mockStore['user_category_rules'] = [];

      const ctx = makeCtx({ state: 'classification_expense' });
      await handleClassificationResponse(ctx, 'סופרמרקט', 'expense');

      const group = mockStore['transactions'].filter((t: any) =>
        ['tx-e1', 'tx-e2'].includes(t.id)
      );
      for (const tx of group) {
        expect(tx.status).toBe('confirmed');
        // findBestMatch normalizes "סופרמרקט" → "קניות סופר" (canonical name)
        expect(tx.expense_category).toBe('קניות סופר');
      }

      const other = mockStore['transactions'].find((t: any) => t.id === 'tx-e3');
      expect(other.status).toBe('pending');
    });

    it('skip marks entire expense group as confirmed', async () => {
      seedUser('classification_expense', { group_ids: ['tx-e1', 'tx-e2'] });
      seedTransactions([
        { id: 'tx-e1', type: 'expense', vendor: 'שופרסל', amount: -200, status: 'pending' },
        { id: 'tx-e2', type: 'expense', vendor: 'שופרסל', amount: -150, status: 'pending' },
      ]);

      const ctx = makeCtx({ state: 'classification_expense' });
      await handleClassificationResponse(ctx, 'דלג', 'expense');

      const group = mockStore['transactions'].filter((t: any) =>
        ['tx-e1', 'tx-e2'].includes(t.id)
      );
      for (const tx of group) {
        expect(tx.status).toBe('confirmed');
        expect(tx.expense_category).toBe('לא מסווג');
      }
    });

    it('"סיימתי" marks all remaining expenses as unclassified', async () => {
      seedUser('classification_expense', { group_ids: ['tx-e1'] });
      seedTransactions([
        { id: 'tx-e1', type: 'expense', vendor: 'א', amount: -100, status: 'pending' },
        { id: 'tx-e2', type: 'expense', vendor: 'ב', amount: -200, status: 'pending' },
      ]);
      mockStore['missing_documents'] = [];

      const ctx = makeCtx({ state: 'classification_expense' });
      await handleClassificationResponse(ctx, 'סיימתי', 'expense');

      const all = mockStore['transactions'].filter((t: any) => t.type === 'expense');
      for (const tx of all) {
        expect(tx.status).toBe('confirmed');
        expect(tx.expense_category).toBe('לא מסווג');
      }
    });

    it('shows category list on "רשימה" command', async () => {
      seedUser('classification_expense', { group_ids: ['tx-e1'] });
      seedTransactions([
        { id: 'tx-e1', type: 'expense', vendor: 'חנות', amount: -100, status: 'pending' },
      ]);

      const ctx = makeCtx({ state: 'classification_expense' });
      await handleClassificationResponse(ctx, 'רשימה', 'expense');

      expect(sentMessages.some(m => m.message.includes('קטגוריות'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Learn rules
  // --------------------------------------------------------------------------

  describe('Learning rules', () => {
    it('creates a new rule after classifying a vendor', async () => {
      seedUser('classification_income');
      mockStore['user_category_rules'] = [];
      seedTransactions([
        { id: 'tx-learn', type: 'income', vendor: 'חברת טכנולוגיה', amount: 12000, status: 'pending' },
      ]);

      const ctx = makeCtx({ state: 'classification_income' });
      await handleClassificationResponse(ctx, 'משכורת', 'income');

      const rules = mockStore['user_category_rules'] || [];
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0].category).toBe('משכורת');
    });
  });

  // --------------------------------------------------------------------------
  // Phase transitions
  // --------------------------------------------------------------------------

  describe('Phase transitions', () => {
    it('moves to expense classification after income is done', async () => {
      seedUser('classification_income');
      mockStore['user_category_rules'] = [];
      mockStore['missing_documents'] = [];
      seedTransactions([
        { id: 'tx-last-inc', type: 'income', vendor: 'שכר', amount: 8000, status: 'pending' },
        { id: 'tx-exp', type: 'expense', vendor: 'חשמל', amount: -500, status: 'pending' },
      ]);

      const ctx = makeCtx({ state: 'classification_income' });
      await handleClassificationResponse(ctx, 'משכורת', 'income');

      const user = mockStore['users']?.[0];
      expect(
        user?.onboarding_state === 'classification_expense' ||
        sentMessages.some(m => m.message.includes('הוצאות'))
      ).toBe(true);
    });

    it('moves to goals_setup when all transactions classified', async () => {
      seedUser('classification_expense', { group_ids: ['tx-last'] });
      seedUploadedStatements();
      mockStore['user_category_rules'] = [];
      mockStore['missing_documents'] = [];
      seedTransactions([
        { id: 'tx-last', type: 'expense', vendor: 'דלק', amount: -200, status: 'pending' },
      ]);

      const ctx = makeCtx({ state: 'classification_expense' });
      await handleClassificationResponse(ctx, 'תחבורה', 'expense');

      const user = mockStore['users']?.[0];
      expect(
        user?.onboarding_state === 'goals_setup' ||
        sentMessages.some(m => m.message.includes('סיימנו') || m.message.includes('יעדים') || m.message.includes('מטרות'))
      ).toBe(true);
    });
  });
});
