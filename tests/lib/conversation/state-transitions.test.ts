/**
 * E2E tests for state transitions across the entire flow.
 *
 * Verifies that onboarding_state and phase stay in sync at each transition:
 *   start → waiting_for_document (or classification)
 *   classification → classification_income / classification_expense
 *   classification_income → classification_expense → goals_setup
 *   goals_setup → goals → monitoring
 *   behavior → goals (transition)
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
    return rows.filter((t: any) => t.user_id === userId && t.status === 'pending' && t.type === type);
  }),
  checkAndRequestMissingDocuments: vi.fn(async () => false),
}));

vi.mock('@/lib/conversation/advanced-goals-handler', () => ({
  startAdvancedGoal: vi.fn(async () => {}),
}));

vi.mock('@/lib/analysis/behavior-analyzer', () => ({
  runFullAnalysis: vi.fn(async () => ({
    transactionCount: 10,
    months: 3,
    insights: ['תובנה 1'],
    topCategories: [{ category: 'סופרמרקט', total: 1500 }],
  })),
}));

// ── Import under test ──

import {
  startClassification,
  handleClassificationResponse,
} from '@/lib/conversation/states/classification';
import { handleBehaviorPhase, transitionToGoals } from '@/lib/conversation/states/behavior';
import type { RouterContext } from '@/lib/conversation/shared';

// ============================================================================
// Helpers
// ============================================================================

const PHONE = '972501234567';
const USER_ID = 'user-trans-1';

function makeCtx(state: string): RouterContext {
  return { userId: USER_ID, phone: PHONE, state: state as any, userName: 'טסט' };
}

function resetAll() {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
  sentMessages.length = 0;
}

// ============================================================================
// Tests
// ============================================================================

describe('State Transitions E2E', () => {
  beforeEach(() => {
    resetAll();
  });

  describe('Classification → startClassification sets phase=data_collection', () => {
    it('sets phase to data_collection when starting classification', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'classification', phase: null }];
      mockStore['uploaded_statements'] = [{ id: 'doc-1', user_id: USER_ID }];
      mockStore['user_category_rules'] = [];
      mockStore['transactions'] = [
        { id: 'tx-1', user_id: USER_ID, type: 'income', vendor: 'משכורת', amount: 5000, status: 'pending', tx_date: '2025-01-15' },
      ];

      await startClassification(makeCtx('classification'));

      const user = mockStore['users'][0];
      expect(user.phase).toBe('data_collection');
    });
  });

  describe('Income done → Expense transition', () => {
    it('transitions from income to expense when income is done', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'classification_income', phase: 'data_collection' }];
      mockStore['user_category_rules'] = [];
      mockStore['missing_documents'] = [];
      mockStore['transactions'] = [
        { id: 'tx-inc', user_id: USER_ID, type: 'income', vendor: 'חברה', amount: 8000, status: 'pending', tx_date: '2025-01-15' },
        { id: 'tx-exp', user_id: USER_ID, type: 'expense', vendor: 'חשמל', amount: -500, status: 'pending', tx_date: '2025-01-10' },
      ];

      await handleClassificationResponse(makeCtx('classification_income'), 'משכורת', 'income');

      const user = mockStore['users'][0];
      expect(user.onboarding_state).toBe('classification_expense');
      expect(sentMessages.some(m => m.message.includes('הוצאות'))).toBe(true);
    });
  });

  describe('All classified → goals_setup', () => {
    it('transitions to goals_setup with phase=goals when all done', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'classification_expense', phase: 'data_collection', classification_context: { group_ids: ['tx-last'] } }];
      mockStore['uploaded_statements'] = [{ id: 'doc-1', user_id: USER_ID }];
      mockStore['user_category_rules'] = [];
      mockStore['missing_documents'] = [];
      mockStore['transactions'] = [
        { id: 'tx-last', user_id: USER_ID, type: 'expense', vendor: 'חנות', amount: -100, status: 'pending', tx_date: '2025-01-15' },
      ];

      await handleClassificationResponse(makeCtx('classification_expense'), 'קניות', 'expense');

      const user = mockStore['users'][0];
      expect(user.onboarding_state).toBe('goals_setup');
      expect(user.phase).toBe('goals');
    });
  });

  describe('Behavior → Goals transition', () => {
    it('transitionToGoals sets phase=goals and state=goals', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'behavior', phase: 'behavior' }];
      mockStore['goals'] = [];

      await transitionToGoals(makeCtx('behavior'));

      const user = mockStore['users'][0];
      expect(user.onboarding_state).toBe('goals');
      expect(user.phase).toBe('goals');
      expect(sentMessages.some(m => m.message.includes('יעדים') || m.message.includes('Goals'))).toBe(true);
    });
  });

  describe('Behavior analysis command', () => {
    it('"ניתוח" in behavior phase runs analysis', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'behavior', phase: 'behavior' }];

      await handleBehaviorPhase(makeCtx('behavior'), 'ניתוח');

      expect(sentMessages.some(m =>
        m.message.includes('מנתח') || m.message.includes('ניתוח')
      )).toBe(true);
    });
  });

  describe('Phase sync verification', () => {
    it('startClassification with only expenses sets state to classification_expense', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'classification', phase: null }];
      mockStore['uploaded_statements'] = [{ id: 'doc-1', user_id: USER_ID }];
      mockStore['user_category_rules'] = [];
      mockStore['transactions'] = [
        { id: 'tx-1', user_id: USER_ID, type: 'expense', vendor: 'חנות', amount: -200, status: 'pending', tx_date: '2025-01-15' },
      ];

      await startClassification(makeCtx('classification'));

      const user = mockStore['users'][0];
      expect(user.onboarding_state).toBe('classification_expense');
      expect(user.phase).toBe('data_collection');
    });

    it('startClassification with only income sets state to classification_income', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'classification', phase: null }];
      mockStore['uploaded_statements'] = [{ id: 'doc-1', user_id: USER_ID }];
      mockStore['user_category_rules'] = [];
      mockStore['transactions'] = [
        { id: 'tx-1', user_id: USER_ID, type: 'income', vendor: 'משכורת', amount: 5000, status: 'pending', tx_date: '2025-01-15' },
      ];

      await startClassification(makeCtx('classification'));

      const user = mockStore['users'][0];
      expect(user.onboarding_state).toBe('classification_income');
      expect(user.phase).toBe('data_collection');
    });
  });
});
