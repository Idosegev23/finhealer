/**
 * API Route: Generate AI Welcome Message
 * 
 * מייצר הודעת פתיחה דינמית לפי state המשתמש
 * 
 * Query params:
 * - phone: מספר טלפון (אופציונלי - אם יש, בודק את ה-state)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    
    let userName: string | null = null;
    let onboardingState: string | null = null;
    
    // אם יש טלפון, נבדוק את ה-state של המשתמש
    if (phone) {
      const supabase = createServiceClient();
      
      // נרמול מספר טלפון
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '972' + cleanPhone.substring(1);
      } else if (!cleanPhone.startsWith('972')) {
        cleanPhone = '972' + cleanPhone;
      }
      
      const { data: user } = await supabase
        .from('users')
        .select('name, full_name, onboarding_state')
        .eq('phone', cleanPhone)
        .single();
      
      if (user) {
        userName = user.full_name || user.name || null;
        onboardingState = user.onboarding_state || null;
      }
    }
    
    let message: string;
    
    // 🆕 הודעה לפי ה-state
    if (userName && (onboardingState === 'waiting_for_document' || onboardingState === 'document_upload')) {
      // יש שם - בקש מסמך
      message = `היי *${userName}*! 👋

אני *φ (פאי)* - המאמן הפיננסי האישי שלך.

*נעים להכיר!* 😊

*הצעד הראשון:*
שלח לי דוח עו״ש מהבנק שלך (PDF) של 3 חודשים אחרונים.

*איך זה עובד?*
1️⃣ תשלח לי דוחות בנק (PDF)
2️⃣ אני אנתח ואסווג את התנועות
3️⃣ ביחד נבין לאן הכסף הולך
4️⃣ נבנה תוכנית שעובדת *בשבילך*

💡 *טיפ:* אפשר להוריד את הדוח מהאפליקציה או מהאתר של הבנק`;
    } else {
      // אין שם - בקש שם
      message = `היי! 👋

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

בוא נתחיל - *מה השם שלך?*`;
    }
    
    return NextResponse.json({ 
      success: true, 
      message,
      state: onboardingState,
      hasName: !!userName,
    });
  } catch (error) {
    console.error('[WelcomeAPI] Error:', error);
    
    // Fallback message
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

בוא נתחיל - *מה השם שלך?*`;
    
    return NextResponse.json({ 
      success: true, 
      message: fallbackMessage 
    });
  }
}

