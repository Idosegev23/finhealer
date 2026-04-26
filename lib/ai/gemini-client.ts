/**
 * Gemini 3 Chat Client
 *
 * All tasks use Gemini 3 Flash for speed and cost efficiency:
 * - Fast chat, intent detection, tips
 * - Document OCR, PDF analysis, deep financial analysis
 *
 * Gemini 3 Pro Image (charts) stays in gemini-image-client.ts
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

// Model constant - Flash for all tasks (fast + cheap)
const FLASH_MODEL = 'gemini-3-flash-preview';

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
  // Rate limit: max 5 concurrent Gemini calls
  const { geminiLimiter } = await import('@/lib/utils/rate-limiter');
  return geminiLimiter.execute(() => _chatWithGeminiFlashImpl(message, systemPrompt, userContext, conversationHistory));
}

async function _chatWithGeminiFlashImpl(
  message: string,
  systemPrompt: string,
  userContext: string,
  conversationHistory?: ConversationMessage[]
): Promise<string> {
  try {
    return await retryWithBackoff(async () => {
      const client = getClient();

      // Conversation history (oldest first), excluding current message
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
      if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
          contents.push({
            role: msg.role,
            parts: [{ text: msg.content }],
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      // systemInstruction is sticky for the call and keeps history clean.
      // userContext (financial snapshot etc.) is appended to the system prompt —
      // it's role-specific guidance, not a turn in the conversation.
      const systemInstruction = userContext
        ? `${systemPrompt}\n\n${userContext}`
        : systemPrompt;

      const response = await client.models.generateContent({
        model: FLASH_MODEL,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: 'low' as any },
          maxOutputTokens: 8000,
        },
      });

      const text = response.text || '';
      console.log(`[Gemini Flash] Response: ${text.substring(0, 100)}...`);
      return text;
    }, 'Gemini Flash');
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
  const { geminiLimiter } = await import('@/lib/utils/rate-limiter');
  return geminiLimiter.execute(() => _chatWithGeminiFlashMinimalImpl(message, systemPrompt));
}

async function _chatWithGeminiFlashMinimalImpl(
  message: string,
  systemPrompt: string
): Promise<string> {
  try {
    return await retryWithBackoff(async () => {
      const client = getClient();

      const response = await client.models.generateContent({
        model: FLASH_MODEL,
        contents: [{ role: 'user', parts: [{ text: message }] }],
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: 'minimal' as any },
          maxOutputTokens: 4000,
        },
      });

      return response.text || '';
    }, 'Gemini Flash Minimal');
  } catch (error) {
    console.error('[Gemini Flash Minimal] Error:', error);
    throw error;
  }
}

// ============================================================================
// Gemini Flash - Deep Analysis (conversation with history)
// ============================================================================

/**
 * Deep analysis chat with Gemini Flash (with conversation history)
 * Use for: Budget building, complex financial reasoning
 */
export async function chatWithGeminiPro(
  message: string,
  systemPrompt: string,
  userContext?: string,
  conversationHistory?: ConversationMessage[]
): Promise<string> {
  try {
    return await retryWithBackoff(async () => {
      const client = getClient();

      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
          contents.push({
            role: msg.role,
            parts: [{ text: msg.content }],
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      const systemInstruction = userContext
        ? `${systemPrompt}\n\n${userContext}`
        : systemPrompt;

      const response = await client.models.generateContent({
        model: FLASH_MODEL,
        contents,
        config: {
          systemInstruction,
          maxOutputTokens: 16000,
        },
      });

      return response.text || '';
    }, 'Gemini Flash Deep Chat');
  } catch (error) {
    console.error('[Gemini Flash Deep Chat] Error:', error);
    throw new Error('AI analysis service temporarily unavailable');
  }
}

// ============================================================================
// Gemini Flash Vision - Image/Document OCR
// ============================================================================

/**
 * Vision analysis with Gemini Flash for receipt/document OCR
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
        model: FLASH_MODEL,
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
          maxOutputTokens: 32000,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      console.log(`[Gemini Flash Vision] Response length: ${text.length} chars`);
      return text;
    }, 'Gemini Flash Vision');
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
        model: FLASH_MODEL,
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
          maxOutputTokens: 8000,
        },
      });

      return response.text || '';
    }, 'Gemini Flash Vision Text');
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
        model: FLASH_MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${textInput}` }],
          },
        ],
        config: {
          maxOutputTokens: 64000,
        },
      });

      return response.text || '{}';
    }, 'Gemini Flash Deep');
  } catch (error) {
    console.error('[Gemini Pro Deep] Error:', error);
    throw new Error('Deep analysis service temporarily unavailable');
  }
}

// ============================================================================
// Structured Output — strict JSON via responseJsonSchema (no markdown stripping)
// ============================================================================

/**
 * Generate a JSON response that matches the given JSON Schema.
 *
 * Per Gemini docs, `responseMimeType: 'application/json'` + `responseJsonSchema`
 * guarantees a parseable JSON object — no need for markdown code-fence regex.
 *
 * The schema is plain JSON Schema (Draft 7-ish). For Zod schemas, use:
 *   `zodToJsonSchema(myZodSchema)` from `zod-to-json-schema` (already in deps),
 * or build the schema by hand using { type, properties, required, enum }.
 */
export async function chatStructured<T = unknown>(
  message: string,
  systemPrompt: string,
  jsonSchema: Record<string, any>,
  opts: {
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
    maxOutputTokens?: number;
    history?: ConversationMessage[];
  } = {}
): Promise<T> {
  const { geminiLimiter } = await import('@/lib/utils/rate-limiter');
  return geminiLimiter.execute(async () => {
    return await retryWithBackoff(async () => {
      const client = getClient();
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
      if (opts.history) {
        for (const m of opts.history) {
          contents.push({ role: m.role, parts: [{ text: m.content }] });
        }
      }
      contents.push({ role: 'user', parts: [{ text: message }] });

      const response = await client.models.generateContent({
        model: FLASH_MODEL,
        contents,
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: (opts.thinkingLevel || 'low') as any },
          maxOutputTokens: opts.maxOutputTokens || 8000,
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchema as any,
        } as any,
      });

      const raw = response.text || '{}';
      try {
        return JSON.parse(raw) as T;
      } catch (parseErr) {
        console.error('[chatStructured] JSON.parse failed despite schema constraint:', parseErr, 'raw:', raw.substring(0, 300));
        throw new Error('Structured output parse failed');
      }
    }, 'Gemini Structured');
  });
}

// ============================================================================
// Chat with Memory — multi-turn using ai.chats.create()
// ============================================================================

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

/**
 * Run one turn of a multi-turn chat using the SDK's chat helper.
 *
 * This preserves Gemini 3 thought signatures across turns automatically,
 * and `systemInstruction` is sticky for the session — no fake "I understand"
 * priming, no role flips. Pass `history` (oldest first); the SDK sends only
 * what's needed and tracks the new exchange internally.
 *
 * For our use case: one call per incoming message. We always rebuild the chat
 * from stored history, since we're stateless across HTTP requests.
 */
export async function chatWithMemory(opts: {
  systemInstruction: string;
  history: ChatTurn[];
  userMessage: string;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  maxOutputTokens?: number;
  responseJsonSchema?: Record<string, any>;
}): Promise<string> {
  const { geminiLimiter } = await import('@/lib/utils/rate-limiter');
  return geminiLimiter.execute(async () => {
    return await retryWithBackoff(async () => {
      const client = getClient();
      const chatConfig: any = {
        systemInstruction: opts.systemInstruction,
        thinkingConfig: { thinkingLevel: (opts.thinkingLevel || 'low') as any },
        maxOutputTokens: opts.maxOutputTokens || 8000,
      };
      if (opts.responseJsonSchema) {
        chatConfig.responseMimeType = 'application/json';
        chatConfig.responseJsonSchema = opts.responseJsonSchema;
      }

      const chat = client.chats.create({
        model: FLASH_MODEL,
        history: opts.history.map(t => ({
          role: t.role,
          parts: [{ text: t.text }],
        })),
        config: chatConfig,
      });

      const response = await chat.sendMessage({ message: opts.userMessage });
      return response.text || '';
    }, 'Gemini Chat with Memory');
  });
}

// ============================================================================
// Chat with Tools — function calling + memory
// ============================================================================

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: any;
}

/**
 * Run a chat where the model can call back into our app via function calls.
 *
 * Flow:
 *   1. Send user message to Gemini with tool declarations
 *   2. If Gemini returns function calls → execute them via `executeTool` callback
 *   3. Send results back to Gemini
 *   4. Repeat until Gemini returns plain text (or maxToolHops reached)
 *
 * Used for grounding φ's free-form coaching answers in real DB facts.
 */
export interface GroundingMetadata {
  /** URLs/sources the model cited from Google Search grounding. */
  citations: Array<{ title?: string; uri: string }>;
  /** Search queries Gemini ran on the user's behalf. */
  webSearchQueries: string[];
}

export async function chatWithTools(opts: {
  systemInstruction: string;
  history: ChatTurn[];
  userMessage: string;
  tools: ToolDeclaration[];
  executeTool: (name: string, args: Record<string, any>) => Promise<unknown>;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  maxOutputTokens?: number;
  maxToolHops?: number;
  /**
   * Optional JSON schema for the FINAL text output.
   * Per Gemini 3 docs ("Structured outputs with tools" — Preview), this combo
   * IS supported on gemini-3-flash-preview / gemini-3.1-pro-preview. The model
   * can call functions during reasoning and still return schema-compliant JSON
   * as the final text part.
   */
  responseJsonSchema?: Record<string, any>;
  /**
   * Enable Gemini's built-in Google tools alongside our custom function
   * declarations:
   *  - google_search   — live web grounding (current rates, news, prices)
   *  - url_context     — read URLs the user (or model) references
   *  - code_execution  — run Python for complex math (amortization, NPV…)
   * Adds cost per grounded request, so only enable when fresh-data answers
   * outweigh the latency/cost.
   */
  enableWebTools?: boolean;
  /** Optional callback that receives grounding metadata (search citations etc) once response lands. */
  onGroundingMetadata?: (meta: GroundingMetadata) => void;
}): Promise<string> {
  const { geminiLimiter } = await import('@/lib/utils/rate-limiter');
  return geminiLimiter.execute(async () => {
    return await retryWithBackoff(async () => {
      const client = getClient();
      const maxHops = opts.maxToolHops ?? 4;

      const tools: any[] = [];
      if (opts.enableWebTools) {
        tools.push({ googleSearch: {} });
        tools.push({ urlContext: {} });
        tools.push({ codeExecution: {} });
      }
      tools.push({ functionDeclarations: opts.tools as any });

      const chatConfig: any = {
        systemInstruction: opts.systemInstruction,
        thinkingConfig: { thinkingLevel: (opts.thinkingLevel || 'low') as any },
        maxOutputTokens: opts.maxOutputTokens || 16000,
        tools,
      };
      if (opts.enableWebTools) {
        // Required when mixing built-in tools (google_search/url_context/
        // code_execution) with custom function declarations. Without this the
        // API rejects with: "Please enable tool_config.
        // include_server_side_tool_invocations to use Built-in tools with
        // Function calling."
        chatConfig.toolConfig = {
          ...(chatConfig.toolConfig || {}),
          includeServerSideToolInvocations: true,
        };
      }
      if (opts.responseJsonSchema) {
        chatConfig.responseMimeType = 'application/json';
        chatConfig.responseJsonSchema = opts.responseJsonSchema;
      }

      const chat = client.chats.create({
        model: FLASH_MODEL,
        history: opts.history.map(t => ({
          role: t.role,
          parts: [{ text: t.text }],
        })),
        config: chatConfig,
      });

      let response: any = await chat.sendMessage({ message: opts.userMessage });
      let hops = 0;

      // Tool-execution loop. Continue while the model emits function calls.
      while (hops < maxHops) {
        const calls = response.functionCalls;
        if (!calls || calls.length === 0) break;

        hops++;
        const fnResponses: any[] = [];
        for (const call of calls) {
          let result: unknown;
          try {
            result = await opts.executeTool(call.name, call.args || {});
          } catch (err: any) {
            result = { error: err.message || 'tool execution failed' };
          }
          fnResponses.push({
            functionResponse: {
              id: (call as any).id,
              name: call.name,
              response: { result },
            },
          });
        }

        response = await chat.sendMessage({ message: fnResponses as any });
      }

      // Extract grounding metadata (Google Search citations, URL contexts, etc.)
      // before consuming the response, so callers can render citations.
      if (opts.onGroundingMetadata) {
        try {
          const candidate = response.candidates?.[0];
          const grounding = candidate?.groundingMetadata;
          if (grounding) {
            const chunks = grounding.groundingChunks || [];
            const citations = chunks
              .map((c: any) => c?.web ? { title: c.web.title, uri: c.web.uri } : null)
              .filter(Boolean) as Array<{ title?: string; uri: string }>;
            const queries = grounding.webSearchQueries || [];
            opts.onGroundingMetadata({ citations, webSearchQueries: queries });
          }
        } catch { /* metadata is best-effort */ }
      }

      // Final response — should be schema-compliant JSON if responseJsonSchema was set.
      // If `.text` is empty but the response has parts, try to recover the text.
      const text = response.text || '';
      if (text.trim().length > 0) return text;

      // Fallback: try to extract any text from candidates manually.
      const candidates = response.candidates || [];
      const partsText = candidates
        .flatMap((c: any) => c?.content?.parts || [])
        .map((p: any) => p?.text || '')
        .filter((t: string) => t.length > 0)
        .join('\n');
      if (partsText.length > 0) return partsText;

      // No text and we hit max hops — model is in a tool-call loop. Force a final
      // text response by sending a nudge. This rescues degenerate cases where the
      // model keeps calling tools instead of emitting JSON.
      if (hops >= maxHops) {
        console.warn(`[chatWithTools] Hit ${hops} tool hops with no text — sending final nudge`);
        try {
          const nudge = await chat.sendMessage({
            message: 'תפסיק לקרוא ל-tools. החזר עכשיו את ה-JSON הסופי לפי הסכמה. רק JSON, בלי טקסט מסביב.',
          });
          const nudgeText = nudge.text || '';
          if (nudgeText.trim().length > 0) return nudgeText;
        } catch (nudgeErr) {
          console.warn(`[chatWithTools] Nudge failed:`, nudgeErr);
        }
      }

      console.warn(`[chatWithTools] Empty response after ${hops} tool hops`);
      return '';
    }, 'Gemini Chat with Tools');
  });
}
