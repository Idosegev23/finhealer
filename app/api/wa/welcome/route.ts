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

*מה נעשה ביחד?*
נבנה תמונה ברורה של הכסף שלך - בלי לחץ, בלי שיפוטיות. רק אתה והמספרים.

*איך זה עובד?*
1️⃣ תשלח לי דוחות בנק (PDF)
2️⃣ אני אנתח ואסווג את התנועות
3️⃣ ביחד נבין לאן הכסף הולך
4️⃣ נבנה תוכנית שעובדת *בשבילך*

*למה אני שונה?*
אני לא אגיד לך "אל תקנה קפה" - אני אעזור לך להבין את ההרגלים שלך ולקבל החלטות מתוך מודעות.

בוא נתחיל - מה השם שלך?`;
    
    return NextResponse.json({ 
      success: true, 
      message: fallbackMessage 
    });
  }
}

