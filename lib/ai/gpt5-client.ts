import OpenAI from "openai";
import { Message, UserContext, ConversationContext } from "@/types/conversation";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatOptions {
  reasoningEffort?: "none" | "low" | "medium" | "high";
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

    // Build input with context
    const input = buildInputWithContext(conversationHistory, userContext);

    // Call GPT-5.1 with Responses API
    const result = await openai.responses.create({
      model: "gpt-5.1",
      input: input,
      reasoning: { effort: reasoningEffort },
      text: { verbosity: verbosity },
      max_output_tokens: maxOutputTokens,
      previous_response_id: previousResponseId,
      // @ts-ignore - system parameter exists but may not be in types yet
      system: systemPrompt,
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
    const result = await openai.responses.create({
      model: "gpt-5.1",
      input: `${buildContextSummary(userContext)}\n\nUser: ${userMessage}`,
      reasoning: { effort: "none" },
      text: { verbosity: "low" },
      max_output_tokens: 200,
      // @ts-ignore
      system: systemPrompt,
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
  const result = await openai.responses.create({
    model: "gpt-5.1",
    input: buildInputWithContext(conversationHistory, userContext),
    reasoning: { effort: "high" },
    text: { verbosity: "medium" },
    max_output_tokens: 1000,
    previous_response_id: previousResponseId,
    // @ts-ignore
    system: systemPrompt,
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
    // Create a File-like object from buffer
    const audioFile = new File([audioBuffer], "audio.ogg", {
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

