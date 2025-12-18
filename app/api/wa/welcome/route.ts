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
    
    // Fallback message - אותה הודעה בדיוק כמו בפונקציה הראשית
    const fallbackMessage = `היי! 👋

אני *φ (פאי)* - המאמן הפיננסי האישי שלך.

*איך זה עובד?*
תשלח לי דוחות בנק, אני אנתח אותם בשבילך, וביחד נבנה תמונה ברורה של הכסף שלך.

*למה זה שונה?*
אני לא שופט, לא מטיף - רק עוזר לך להבין ולהרגיש שליטה.

בוא נכיר - מה השם שלך?`;
    
    return NextResponse.json({ 
      success: true, 
      message: fallbackMessage 
    });
  }
}

