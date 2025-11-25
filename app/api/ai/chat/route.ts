import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processMessage } from "@/lib/conversation/orchestrator";
import { getGreenAPIClient } from "@/lib/greenapi/client";
import { processVoiceMessage } from "@/lib/whatsapp/voice-handler";

/**
 * AI Chat API Endpoint
 * Main endpoint for WhatsApp AI conversations
 * 
 * POST /api/ai/chat
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, message, messageType = "text", phoneNumber, audioUrl } = body;

    if (!userId || (!message && !audioUrl)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let textMessage = message;

    // Handle voice message
    if (messageType === "voice" && audioUrl) {
      try {
        const transcription = await processVoiceMessage({
          messageId: `voice-${Date.now()}`,
          from: phoneNumber || userId,
          audioUrl,
          mimeType: "audio/ogg",
        });

        textMessage = transcription.text;

        // Send acknowledgment
        if (phoneNumber) {
          const greenAPI = getGreenAPIClient();
          await greenAPI.sendMessage({
            phoneNumber,
            message: `קלטתי 🎤: "${textMessage}"\n\nעכשיו אני מעבד...`,
          });
        }
      } catch (error) {
        console.error("Voice processing error:", error);
        return NextResponse.json(
          { error: "Failed to process voice message" },
          { status: 500 }
        );
      }
    }

    // Process message with orchestrator
    const response = await processMessage(userId, textMessage, messageType);

    // Handle required actions
    if (response.requiresAction && response.action) {
      await handleAction(userId, response.action);
    }

    // Save conversation to database
    await saveConversation(userId, textMessage, response.message, messageType);

    // Send response via WhatsApp if phone number provided
    if (phoneNumber) {
      const greenAPI = getGreenAPIClient();
      await greenAPI.sendMessage({
        phoneNumber,
        message: response.message,
      });
    }

    return NextResponse.json({
      success: true,
      response: response.message,
      metadata: response.metadata,
    });
  } catch (error: any) {
    console.error("AI Chat API error:", error);
    
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle required actions from orchestrator
 */
async function handleAction(
  userId: string,
  action: { type: string; data: any }
): Promise<void> {
  const supabase = createServiceClient();

  switch (action.type) {
    case "create_transaction":
      await supabase.from("transactions").insert({
        user_id: userId,
        type: "expense",
        amount: action.data.amount,
        category: action.data.category || "other",
        merchant_name: action.data.merchant,
        description: action.data.description,
        date: action.data.date || new Date().toISOString(),
        source: "ai_whatsapp",
        status: action.data.confidence >= 0.9 ? "confirmed" : "pending",
        confidence_score: action.data.confidence,
        learned_from_pattern: action.data.confidence >= 0.8,
      });
      break;

    case "update_budget":
      // TODO: Implement budget update
      break;

    case "confirm_expense":
      await supabase
        .from("transactions")
        .update({ status: "confirmed" })
        .eq("id", action.data.transactionId)
        .eq("user_id", userId);
      break;

    default:
      console.log(`Unknown action type: ${action.type}`);
  }
}

/**
 * Save conversation to database
 */
async function saveConversation(
  userId: string,
  userMessage: string,
  aiResponse: string,
  messageType: string
): Promise<void> {
  try {
    const supabase = createServiceClient();

    // Save user message
    await supabase.from("conversation_history").insert({
      user_id: userId,
      role: "user",
      message_text: userMessage,
      message_type: messageType,
    });

    // Save AI response
    await supabase.from("conversation_history").insert({
      user_id: userId,
      role: "assistant",
      message_text: aiResponse,
      message_type: "text",
    });
  } catch (error) {
    console.error("Failed to save conversation:", error);
    // Don't throw - conversation should continue even if save fails
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "AI Chat API",
    timestamp: new Date().toISOString(),
  });
}

