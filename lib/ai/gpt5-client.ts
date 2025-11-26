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

    // Call GPT-5.1 with Responses API
    const result = await openai.responses.create({
      model: "gpt-5.1",
      input: fullInput,
      reasoning: { effort: reasoningEffort },
      text: { verbosity: verbosity },
      max_output_tokens: maxOutputTokens,
      previous_response_id: previousResponseId,
    });

    return {
      response: result.output_text || "",
      responseId: result.id,
    };
  } catch (error: any) {
    console.error("GPT-5.1 Error:", error);
    
    // Fallback to GPT-4.1 if GPT-5.1 fails
    try {
      return await fallbackToGPT4(conversationHistory, systemPrompt, userContext);
    } catch (fallbackError) {
      console.error("Fallback Error:", fallbackError);
      throw new Error("AI service temporarily unavailable");
    }
  }
}

/**
 * Fast response for quick interactions (reasoning: none)
 * Best for simple confirmations and casual chat
 */
export async function chatWithGPT5Fast(
  userMessage: string,
  systemPrompt: string,
  userContext: UserContext
): Promise<string> {
  try {
    // 🔧 Combine system prompt with input (Responses API doesn't support 'system' param)
    const fullInput = `[System Instructions]
${systemPrompt}

[User Context]
${buildContextSummary(userContext)}

[User Message]
${userMessage}`;

    const result = await openai.responses.create({
      model: "gpt-5.1",
      input: fullInput,
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
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
    model: "gpt-5.1",
    input: fullInput,
    reasoning: { effort: "high" },
    text: { verbosity: "medium" },
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

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages,
    max_tokens: 500,
    temperature: 0.7,
  });

  return {
    response: completion.choices[0]?.message?.content || "",
    responseId: completion.id,
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

