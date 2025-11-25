import { transcribeVoice } from "@/lib/ai/gpt5-client";
import axios from "axios";

/**
 * Voice Message Handler
 * Downloads and transcribes voice messages from WhatsApp
 */

export interface VoiceMessage {
  messageId: string;
  from: string;
  audioUrl: string;
  mimeType: string;
  duration?: number;
}

export interface TranscriptionResult {
  text: string;
  duration: number;
  confidence: number;
}

/**
 * Download audio file from GreenAPI
 */
export async function downloadAudioFile(
  audioUrl: string
): Promise<Buffer> {
  try {
    const response = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: 30000, // 30 seconds
    });

    return Buffer.from(response.data);
  } catch (error) {
    console.error("Failed to download audio:", error);
    throw new Error("Failed to download voice message");
  }
}

/**
 * Process voice message: download, transcribe, return text
 */
export async function processVoiceMessage(
  voiceMessage: VoiceMessage
): Promise<TranscriptionResult> {
  try {
    console.log(`Processing voice message: ${voiceMessage.messageId}`);

    // Download audio file
    const audioBuffer = await downloadAudioFile(voiceMessage.audioUrl);

    console.log(`Downloaded audio: ${audioBuffer.length} bytes`);

    // Transcribe with Whisper
    const transcription = await transcribeVoice(audioBuffer);

    console.log(`Transcription: ${transcription}`);

    return {
      text: transcription,
      duration: voiceMessage.duration || 0,
      confidence: 0.9, // Whisper is generally highly accurate
    };
  } catch (error) {
    console.error("Voice processing error:", error);
    throw new Error("Failed to process voice message");
  }
}

/**
 * Convert audio format if needed
 * WhatsApp typically sends OGG but Whisper prefers MP3/WAV
 */
async function convertAudioFormat(
  audioBuffer: Buffer,
  fromFormat: string
): Promise<Buffer> {
  // For now, return as-is. Whisper can handle OGG.
  // If needed, use ffmpeg or similar library for conversion
  return audioBuffer;
}

/**
 * Validate voice message
 */
export function isValidVoiceMessage(message: any): message is VoiceMessage {
  return (
    message &&
    typeof message.messageId === "string" &&
    typeof message.from === "string" &&
    typeof message.audioUrl === "string" &&
    message.audioUrl.startsWith("http")
  );
}

/**
 * Generate response acknowledging voice message
 */
export function generateVoiceAcknowledgment(
  transcription: string
): string {
  const truncated =
    transcription.length > 50
      ? transcription.substring(0, 50) + "..."
      : transcription;

  return `קלטתי 🎤: "${truncated}"\n\nעכשיו אני מעבד את זה...`;
}

/**
 * Handle voice message error with friendly message
 */
export function getVoiceErrorMessage(error: Error): string {
  const errorMsg = error.message.toLowerCase();

  if (errorMsg.includes("download")) {
    return "אופס! לא הצלחתי להוריד את ההודעה הקולית 😅\nאפשר לנסות שוב?";
  }

  if (errorMsg.includes("transcribe") || errorMsg.includes("process")) {
    return "הממ... לא הבנתי את ההודעה הקולית 🤔\nאפשר לכתוב במקום?";
  }

  return "משהו השתבש עם ההודעה הקולית 😕\nננסה שוב?";
}

/**
 * Get voice message duration in human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} שניות`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes} דקות`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")} דקות`;
}

export default {
  processVoiceMessage,
  downloadAudioFile,
  isValidVoiceMessage,
  generateVoiceAcknowledgment,
  getVoiceErrorMessage,
  formatDuration,
};

