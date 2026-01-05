import OpenAI from "openai";
import { Message, UserContext, ConversationContext } from "@/types/conversation";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatOptions {
  reasoningEffort?: "low" | "medium" | "high";
  verbosity?: "low" | "medium" | "high";
  maxOutputTokens?: number;
  previousResponseId?: string;
}

/**
 * Main GPT-5.1 chat function for conversational AI
 * Uses Responses API with chain-of-thought persistence
 */
export async function chatWithGPT5(
  conversationHistory: Message[],
  systemPrompt: string,
  userContext: UserContext,
  options: ChatOptions = {}
): Promise<{
  response: string;
  responseId: string;
}> {
  try {
    const {
      reasoningEffort = "medium",
      verbosity = "low",
      maxOutputTokens = 500,
      previousResponseId,
    } = options;

    // Build input with context - include system prompt in the input
    const contextSummary = buildContextSummary(userContext);
    const conversationText = conversationHistory
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");
    
    // 🔧 Combine system prompt with input (Responses API doesn't support 'system' param)
    const fullInput = `[System Instructions]
${systemPrompt}

[User Context]
${contextSummary}

[Conversation]
${conversationText}`;

    // 🆕 Call GPT-5.2 with Responses API
    const result = await openai.responses.create({
      model: "gpt-5.2-2025-12-11",
      input: fullInput,
      reasoning: { effort: reasoningEffort },
      max_output_tokens: maxOutputTokens,
      previous_response_id: previousResponseId,
    });

    return {
      response: result.output_text || "",
      responseId: result.id,
    };
  } catch (error: any) {
    console.error("GPT-5.2 Error:", error);
    throw new Error("AI service temporarily unavailable");
  }
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Fast response for quick interactions (reasoning: none)
 * Best for simple confirmations and casual chat
 * 
 * @param userMessage - Current user message
 * @param systemPrompt - System instructions
 * @param userContext - User context info
 * @param conversationHistory - Optional recent conversation history
 */
export async function chatWithGPT5Fast(
  userMessage: string,
  systemPrompt: string,
  userContext: UserContext,
  conversationHistory?: HistoryMessage[]
): Promise<string> {
  try {
    // Build conversation history section
    let historySection = '';
    if (conversationHistory && conversationHistory.length > 0) {
      const historyText = conversationHistory
        .map((msg) => `${msg.role === 'user' ? 'משתמש' : 'φ'}: ${msg.content}`)
        .join('\n');
      historySection = `\n[היסטוריית שיחה אחרונה]\n${historyText}\n`;
    }

    // 🔧 Combine system prompt with input (Responses API doesn't support 'system' param)
    const fullInput = `[System Instructions]
${systemPrompt}

[User Context]
${buildContextSummary(userContext)}
${historySection}
[User Message]
${userMessage}`;

    // 🆕 GPT-5-nano for fast chat responses
    const result = await openai.responses.create({
      model: "gpt-5-nano-2025-08-07",
      input: fullInput,
      reasoning: { effort: "none" },
      max_output_tokens: 200,
    });

    return result.output_text || "";
  } catch (error) {
    console.error("GPT-5.1 Fast Error:", error);
    throw error;
  }
}

/**
 * Deep reasoning for complex tasks (reasoning: high)
 * Best for financial analysis and complex decision making
 */
export async function chatWithGPT5Deep(
  conversationHistory: Message[],
  systemPrompt: string,
  userContext: UserContext,
  previousResponseId?: string
): Promise<{
  response: string;
  responseId: string;
}> {
  // 🔧 Combine system prompt with input
  const contextSummary = buildContextSummary(userContext);
  const conversationText = conversationHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
  
  const fullInput = `[System Instructions]
${systemPrompt}

[User Context]
${contextSummary}

[Conversation]
${conversationText}`;

  const result = await openai.responses.create({
    // 🆕 GPT-5.2 with high reasoning for analysis
    model: "gpt-5.2-2025-12-11",
    input: fullInput,
    reasoning: { effort: "high" },
    max_output_tokens: 1000,
    previous_response_id: previousResponseId,
  });

  return {
    response: result.output_text || "",
    responseId: result.id,
  };
}

/**
 * Build input with full user context
 */
function buildInputWithContext(
  conversationHistory: Message[],
  userContext: UserContext
): string {
  const contextSummary = buildContextSummary(userContext);
  
  const conversationText = conversationHistory
    .slice(-10) // Keep last 10 messages for context
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");

  return `${contextSummary}\n\n=== Conversation ===\n${conversationText}`;
}

/**
 * Build compact user context summary
 */
function buildContextSummary(userContext: UserContext): string {
  const parts: string[] = [
    `User: ${userContext.userName} (${userContext.phoneNumber})`,
  ];

  if (userContext.monthlyIncome) {
    parts.push(`Income: ₪${userContext.monthlyIncome.toLocaleString()}/month`);
  }

  if (userContext.familySize) {
    parts.push(`Family: ${userContext.familySize} members`);
  }

  if (userContext.phiScore !== undefined) {
    parts.push(`φ Score: ${userContext.phiScore}/100`);
  }

  if (userContext.currentGoals && userContext.currentGoals.length > 0) {
    parts.push(`Active Goals: ${userContext.currentGoals.join(", ")}`);
  }

  if (userContext.conversationState) {
    parts.push(`State: ${userContext.conversationState}`);
  }

  return `=== User Context ===\n${parts.join("\n")}`;
}

/**
 * Fallback to GPT-4.1 Chat Completions if GPT-5.1 fails
 */
async function fallbackToGPT4(
  conversationHistory: Message[],
  systemPrompt: string,
  userContext: UserContext
): Promise<{
  response: string;
  responseId: string;
}> {
  const messages = [
    {
      role: "system" as const,
      content: systemPrompt + "\n\n" + buildContextSummary(userContext),
    },
    ...conversationHistory.slice(-10).map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];

  // 🆕 GPT-5-nano fallback for fast chat
  const inputText = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  const result = await openai.responses.create({
    model: "gpt-5-nano-2025-08-07",
    input: inputText,
    reasoning: { effort: "none" },
    max_output_tokens: 500,
  });

  return {
    response: result.output_text || "",
    responseId: result.id,
  };
}

/**
 * Transcribe voice message using Whisper
 */
export async function transcribeVoice(audioBuffer: Buffer): Promise<string> {
  try {
    // Convert Buffer to Uint8Array for File constructor
    const uint8Array = new Uint8Array(audioBuffer);
    const blob = new Blob([uint8Array], { type: "audio/ogg" });
    const audioFile = new File([blob], "audio.ogg", {
      type: "audio/ogg",
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "he", // Hebrew
      response_format: "text",
    });

    return transcription;
  } catch (error) {
    console.error("Whisper transcription error:", error);
    throw new Error("Failed to transcribe voice message");
  }
}

