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
    const fallbackMessage = `שלום,

אני *φ (פאי)* - המאמן הפיננסי שלך.

הסימן φ מייצג את *היחס הזהב* - האיזון המושלם במתמטיקה.
וזה בדיוק מה שנעשה ביחד: נמצא את *האיזון המושלם* בכסף שלך.

*איך זה עובד?*
תשלח לי דוחות בנק, אני אנתח אותם בשבילך, ויחד נבנה תמונה ברורה של המצב הפיננסי. בלי לחץ, בלי שיפוטיות - בקצב שלך.

בסוף התהליך תרגיש *שליטה מלאה* על הכסף שלך.

אבל קודם כל, בוא נכיר -
*מה השם שלך?*`;
    
    return NextResponse.json({ 
      success: true, 
      message: fallbackMessage 
    });
  }
}

