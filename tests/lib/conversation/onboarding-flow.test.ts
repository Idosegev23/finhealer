/**
 * E2E tests for the onboarding flow.
 *
 * Tests:
 *   1. handleStart → waiting_for_document (no pending tx)
 *   2. handleStart → classification (has pending tx)
 *   3. handleWaitingForName → saves name, goes to waiting_for_document
 *   4. handleWaitingForDocument → "נתחיל" starts classification
 *   5. handleWaitingForDocument → "עוד דוח" asks for doc
 *   6. handleWaitingForDocument → default asks for doc
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockQuery, type MockStore } from '../../mocks/mock-query';

// ── Mocks ──

const mockStore: MockStore = {};
const sentMessages: Array<{ phone: string; message: string }> = [];

function mockFrom(tableName: string) {
  if (!mockStore[tableName]) mockStore[tableName] = [];
  return new MockQuery(tableName, mockStore);
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
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
  }),
  sendWhatsAppInteractiveButtons: vi.fn(),
  sendWhatsAppMessage: vi.fn(),
}));

// ── Import under test ──

import {
  handleStart,
  handleWaitingForName,
  handleWaitingForDocument,
} from '@/lib/conversation/states/onboarding';
import type { RouterContext } from '@/lib/conversation/shared';

// ============================================================================
// Helpers
// ============================================================================

const PHONE = '972501234567';
const USER_ID = 'user-onboard-1';

function makeCtx(state = 'start' as any): RouterContext {
  return { userId: USER_ID, phone: PHONE, state, userName: null };
}

function resetAll() {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
  sentMessages.length = 0;
}

function mockGreenAPI() {
  return {
    sendMessage: vi.fn(async ({ phoneNumber, message }: any) => {
      sentMessages.push({ phone: phoneNumber, message });
    }),
    sendInteractiveButtons: vi.fn(async ({ phoneNumber, message }: any) => {
      sentMessages.push({ phone: phoneNumber, message });
    }),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Onboarding Flow E2E', () => {
  beforeEach(() => {
    resetAll();
  });

  // --------------------------------------------------------------------------
  // handleStart
  // --------------------------------------------------------------------------

  describe('handleStart', () => {
    it('transitions to waiting_for_document when no pending transactions', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'start' }];
      mockStore['transactions'] = [];

      const supabase = { from: mockFrom };
      const greenAPI = mockGreenAPI();

      const result = await handleStart(makeCtx('start'), supabase as any, greenAPI as any);

      expect(result.success).toBe(true);
      expect(result.newState).toBe('waiting_for_document');
      const user = mockStore['users'][0];
      expect(user.onboarding_state).toBe('waiting_for_document');
      expect(sentMessages.some(m => m.message.includes('שלח לי דוח'))).toBe(true);
    });

    it('transitions to classification when pending transactions exist', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'start' }];
      mockStore['transactions'] = [
        { id: 'tx-1', user_id: USER_ID, status: 'pending', type: 'expense' },
      ];

      const supabase = { from: mockFrom };
      const greenAPI = mockGreenAPI();

      const result = await handleStart(makeCtx('start'), supabase as any, greenAPI as any);

      expect(result.success).toBe(true);
      expect(result.newState).toBe('classification');
      const user = mockStore['users'][0];
      expect(user.onboarding_state).toBe('classification');
      expect(sentMessages.some(m => m.message.includes('סיווג') || m.message.includes('נתחיל'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // handleWaitingForName
  // --------------------------------------------------------------------------

  describe('handleWaitingForName', () => {
    it('saves name and transitions to waiting_for_document', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'waiting_for_name', name: null }];

      const supabase = { from: mockFrom };
      const greenAPI = mockGreenAPI();

      const result = await handleWaitingForName(
        makeCtx('waiting_for_name'),
        'יוסי',
        supabase as any,
        greenAPI as any
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe('waiting_for_document');

      const user = mockStore['users'][0];
      expect(user.name).toBe('יוסי');
      expect(user.full_name).toBe('יוסי');
      expect(user.onboarding_state).toBe('waiting_for_document');

      expect(sentMessages.some(m => m.message.includes('יוסי'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // handleWaitingForDocument
  // --------------------------------------------------------------------------

  describe('handleWaitingForDocument', () => {
    it('"נתחיל" triggers classification callback', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'waiting_for_document' }];

      const supabase = { from: mockFrom };
      const greenAPI = mockGreenAPI();

      const classificationCallback = vi.fn(async () => ({
        success: true,
        newState: 'classification_income' as any,
      }));

      const result = await handleWaitingForDocument(
        makeCtx('waiting_for_document'),
        'נתחיל',
        supabase as any,
        greenAPI as any,
        classificationCallback
      );

      expect(classificationCallback).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('"עוד דוח" asks for document upload', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'waiting_for_document' }];

      const supabase = { from: mockFrom };
      const greenAPI = mockGreenAPI();

      const result = await handleWaitingForDocument(
        makeCtx('waiting_for_document'),
        'עוד דוח',
        supabase as any,
        greenAPI as any,
        vi.fn()
      );

      expect(result.success).toBe(true);
      expect(sentMessages.some(m => m.message.includes('שלח לי את המסמך'))).toBe(true);
    });

    it('unknown message asks to upload document', async () => {
      mockStore['users'] = [{ id: USER_ID, onboarding_state: 'waiting_for_document' }];

      const supabase = { from: mockFrom };
      const greenAPI = mockGreenAPI();

      const result = await handleWaitingForDocument(
        makeCtx('waiting_for_document'),
        'מה המצב?',
        supabase as any,
        greenAPI as any,
        vi.fn()
      );

      expect(result.success).toBe(true);
      expect(sentMessages.some(m => m.message.includes('מחכה') || m.message.includes('דוח'))).toBe(true);
    });
  });
});
