/**
 * API Route: Generate AI Welcome Message
 * 
 * מייצר הודעת פתיחה דינמית עם AI
 */

import { NextResponse } from 'next/server';
import { generateWelcomeMessage } from '@/lib/ai/conversation-ai';

export async function GET() {
  try {
    const message = await generateWelcomeMessage();
    
    return NextResponse.json({ 
      success: true, 
      message 
    });
  } catch (error) {
    console.error('[WelcomeAPI] Error:', error);
    
    // Fallback message
    const fallbackMessage = `היי, טוב שבאת.

אני *φ (פאי)* - המאמן הפיננסי שלך.

כמו שהיחס הזהב יוצר הרמוניה במתמטיקה, ביחד נמצא את *ההרמוניה בכסף* שלך.

תשלח לי דוחות, אני אנתח, וביחד נבנה תמונה ברורה. בלי שיפוטיות, בקצב שלך.

מה השם שלך?`;
    
    return NextResponse.json({ 
      success: true, 
      message: fallbackMessage 
    });
  }
}

