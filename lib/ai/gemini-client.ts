/**
 * Gemini 3 Chat Client
 *
 * Replaces GPT-5-nano (fast chat) and GPT-5.2 (deep analysis) with:
 * - Gemini 3 Flash: fast chat, intent detection, tips ($0.50/1M tokens)
 * - Gemini 3.1 Pro: document OCR, deep financial analysis ($2/1M tokens)
 *
 * Gemini 3 Pro Image (charts) stays in gemini-image-client.ts
 * Whisper-1 (voice) stays in gpt5-client.ts
 */

import { GoogleGenAI } from '@google/genai';

// Initialize Gemini client (lazy singleton)
let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY is not set');
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

// Model constants
const FLASH_MODEL = 'gemini-3-flash-preview';
const PRO_MODEL = 'gemini-3.1-pro-preview';

/**
 * Retry with exponential backoff for Gemini API calls.
 * Only retries on 429 (rate limit) and 5xx (server errors).
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = 3
): Promise<T> {
  const backoffMs = [1000, 3000, 9000]; // exponential: 1s, 3s, 9s
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status || error?.httpStatusCode || 0;
      const errorMsg = error?.message || '';
      const isNetworkError = errorMsg.includes('fetch failed') || errorMsg.includes('ECONNRESET') || errorMsg.includes('ETIMEDOUT');
      const isRetryable = status === 429 || status >= 500 || isNetworkError;

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const delay = backoffMs[attempt] || 9000;
      console.warn(`[${label}] Attempt ${attempt + 1} failed (status ${status}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`${label}: all retries exhausted`);
}

export interface ConversationMessage {
  role: 'user' | 'model';
  content: string;
}

// ============================================================================
// Gemini 3 Flash - Fast Chat (replaces GPT-5-nano)
// ============================================================================

/**
 * Fast chat with Gemini Flash
 * Use for: WhatsApp chat, intent detection, behavior tips, routing fallback
 *
 * @param message - Current user message
 * @param systemPrompt - System instructions (Hebrew)
 * @param userContext - Formatted user context string
 * @param conversationHistory - Optional recent conversation (oldest first)
 */
export async function chatWithGeminiFlash(
  message: string,
  systemPrompt: string,
  userContext: string,
  conversationHistory?: ConversationMessage[]
): Promise<string> {
  try {
    const client = getClient();

    // Build contents array with history
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // System context as first user message (Gemini uses systemInstruction or first message)
    const contextMessage = userContext
      ? `${systemPrompt}\n\n${userContext}`
      : systemPrompt;

    contents.push({
      role: 'user',
      parts: [{ text: contextMessage }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'הבנתי, אני מוכן לעזור.' }],
    });

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        contents.push({
          role: msg.role,
          parts: [{ text: msg.content }],
        });
      }
    }

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await client.models.generateContent({
      model: FLASH_MODEL,
      contents,
      config: {
        thinkingConfig: { thinkingLevel: 'low' as any },
        maxOutputTokens: 300,
      },
    });

    const text = response.text || '';
    console.log(`[Gemini Flash] Response: ${text.substring(0, 100)}...`);
    return text;
  } catch (error) {
    console.error('[Gemini Flash] Error:', error);
    throw new Error('AI service temporarily unavailable');
  }
}

/**
 * Fast chat with minimal thinking - even faster for simple tasks
 * Use for: intent parsing JSON, category matching
 */
export async function chatWithGeminiFlashMinimal(
  message: string,
  systemPrompt: string
): Promise<string> {
  try {
    const client = getClient();

    const response = await client.models.generateContent({
      model: FLASH_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${message}` }],
        },
      ],
      config: {
        thinkingConfig: { thinkingLevel: 'minimal' as any },
        maxOutputTokens: 500,
      },
    });

    return response.text || '';
  } catch (error) {
    console.error('[Gemini Flash Minimal] Error:', error);
    throw error;
  }
}

// ============================================================================
// Gemini 3.1 Pro - Deep Analysis (replaces GPT-5.2)
// ============================================================================

/**
 * Deep analysis with Gemini Pro
 * Use for: Document analysis, budget building, complex financial reasoning
 */
export async function chatWithGeminiPro(
  message: string,
  systemPrompt: string,
  userContext?: string,
  conversationHistory?: ConversationMessage[]
): Promise<string> {
  try {
    const client = getClient();

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // System + context
    const contextMessage = userContext
      ? `${systemPrompt}\n\n${userContext}`
      : systemPrompt;

    contents.push({
      role: 'user',
      parts: [{ text: contextMessage }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'הבנתי, אני מנתח את המידע.' }],
    });

    // History
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        contents.push({
          role: msg.role,
          parts: [{ text: msg.content }],
        });
      }
    }

    // Current message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await client.models.generateContent({
      model: PRO_MODEL,
      contents,
      config: {
        thinkingConfig: { thinkingLevel: 'high' as any },
        maxOutputTokens: 2000,
      },
    });

    return response.text || '';
  } catch (error) {
    console.error('[Gemini Pro] Error:', error);
    throw new Error('AI analysis service temporarily unavailable');
  }
}

// ============================================================================
// Gemini 3.1 Pro Vision - Image/Document OCR (replaces GPT-5.2 vision)
// ============================================================================

/**
 * Vision analysis with Gemini Pro for receipt/document OCR
 * Use for: Receipt images, bank statements, credit card statements
 *
 * @param base64Image - Base64 encoded image data
 * @param mimeType - Image MIME type (image/jpeg, image/png, application/pdf)
 * @param systemPrompt - OCR system prompt (Hebrew, extraction format)
 */
export async function chatWithGeminiProVision(
  base64Image: string,
  mimeType: string,
  systemPrompt: string
): Promise<string> {
  try {
    return await retryWithBackoff(async () => {
      const client = getClient();

      const response = await client.models.generateContent({
        model: PRO_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        config: {
          thinkingConfig: { thinkingLevel: 'high' as any },
          maxOutputTokens: 32000,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      console.log(`[Gemini Pro Vision] Response length: ${text.length} chars`);
      return text;
    }, 'Gemini Pro Vision');
  } catch (error) {
    console.error('[Gemini Pro Vision] Error:', error);
    throw new Error('Document analysis service temporarily unavailable');
  }
}

/**
 * Vision analysis without JSON mode (for free-form text responses)
 */
export async function chatWithGeminiProVisionText(
  base64Image: string,
  mimeType: string,
  systemPrompt: string
): Promise<string> {
  try {
    return await retryWithBackoff(async () => {
      const client = getClient();

      const response = await client.models.generateContent({
        model: PRO_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        config: {
          thinkingConfig: { thinkingLevel: 'high' as any },
          maxOutputTokens: 8000,
        },
      });

      return response.text || '';
    }, 'Gemini Pro Vision Text');
  } catch (error) {
    console.error('[Gemini Pro Vision Text] Error:', error);
    throw new Error('Document analysis service temporarily unavailable');
  }
}

/**
 * Deep text analysis with Gemini Pro (for large text inputs like PDF text)
 * Use for: Bank statement text analysis, credit card statement processing
 */
export async function chatWithGeminiProDeep(
  textInput: string,
  systemPrompt: string
): Promise<string> {
  try {
    return await retryWithBackoff(async () => {
      const client = getClient();

      const response = await client.models.generateContent({
        model: PRO_MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${textInput}` }],
          },
        ],
        config: {
          thinkingConfig: { thinkingLevel: 'high' as any },
          maxOutputTokens: 64000,
        },
      });

      return response.text || '{}';
    }, 'Gemini Pro Deep');
  } catch (error) {
    console.error('[Gemini Pro Deep] Error:', error);
    throw new Error('Deep analysis service temporarily unavailable');
  }
}
