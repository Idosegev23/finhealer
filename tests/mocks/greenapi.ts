/**
 * Mock GreenAPI client for E2E tests.
 * Records all sent messages for assertions.
 */

import { vi } from 'vitest';

export interface SentMessage {
  phoneNumber: string;
  message: string;
  type: 'text' | 'buttons' | 'interactive' | 'list' | 'image';
  buttons?: Array<{ buttonId: string; buttonText: string }>;
  header?: string;
}

export function createMockGreenAPI() {
  const sentMessages: SentMessage[] = [];

  const client = {
    sendMessage: vi.fn(async ({ phoneNumber, message }: { phoneNumber: string; message: string }) => {
      sentMessages.push({ phoneNumber, message, type: 'text' });
      return { idMessage: `mock-msg-${sentMessages.length}` };
    }),

    sendButtons: vi.fn(async ({ phoneNumber, message, buttons }: any) => {
      sentMessages.push({ phoneNumber, message, type: 'buttons', buttons });
      return { idMessage: `mock-btn-${sentMessages.length}` };
    }),

    sendInteractiveButtons: vi.fn(async ({ phoneNumber, message, header, buttons }: any) => {
      sentMessages.push({ phoneNumber, message, type: 'interactive', buttons, header });
      return { idMessage: `mock-ibtn-${sentMessages.length}` };
    }),

    sendListMessage: vi.fn(async ({ phoneNumber, message }: any) => {
      sentMessages.push({ phoneNumber, message, type: 'list' });
      return { idMessage: `mock-list-${sentMessages.length}` };
    }),

    sendImage: vi.fn(async ({ phoneNumber, caption }: any) => {
      sentMessages.push({ phoneNumber, message: caption || '', type: 'image' });
      return { idMessage: `mock-img-${sentMessages.length}` };
    }),

    // Test helpers
    _sentMessages: sentMessages,
    _getMessages: () => sentMessages,
    _getLastMessage: () => sentMessages[sentMessages.length - 1],
    _getMessageTexts: () => sentMessages.map(m => m.message),
    _reset: () => {
      sentMessages.length = 0;
      client.sendMessage.mockClear();
      client.sendButtons.mockClear();
      client.sendInteractiveButtons.mockClear();
      client.sendListMessage.mockClear();
      client.sendImage.mockClear();
    },
  };

  return client;
}

export type MockGreenAPIClient = ReturnType<typeof createMockGreenAPI>;

// ============================================================================
// Module mock helper
// ============================================================================

export function setupGreenAPIMock(greenAPI: MockGreenAPIClient) {
  vi.mock('@/lib/greenapi/client', () => ({
    getGreenAPIClient: () => greenAPI,
    GreenAPIClient: vi.fn(() => greenAPI),
    sendWhatsAppMessage: vi.fn(async (phone: string, msg: string) => {
      return greenAPI.sendMessage({ phoneNumber: phone, message: msg });
    }),
    sendWhatsAppInteractiveButtons: vi.fn(async (phone: string, params: any) => {
      return greenAPI.sendInteractiveButtons({ phoneNumber: phone, ...params });
    }),
    sendWhatsAppImage: vi.fn(async (phone: string, imageBase64: string, caption?: string) => {
      return greenAPI.sendImage({ phoneNumber: phone, imageBase64, caption });
    }),
  }));
}
