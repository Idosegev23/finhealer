import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/expenses/categorize
 * זיהוי אוטומטי של קטגוריית הוצאה מטקסט חופשי
 * 
 * Body:
 * {
 *   description: string,
 *   vendor?: string,
 *   amount?: number
 * }
 * 
 * Response:
 * {
 *   suggested_category: string,
 *   expense_type: 'fixed' | 'variable' | 'special',
 *   confidence: number (0-1),
 *   category_group?: string
 * }
 */

// מילון מילות מפתח לקטגוריות
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // דיור
  'ארנונה למגורים': ['ארנונה', 'עירייה', 'מס שבח'],
  'חשמל לבית': ['חשמל', 'חברת חשמל', 'חח"י'],
  'מים': ['מים', 'מי ירושלים', 'עיריית', 'תאגיד מים'],
  'גז': ['גז', 'סופרגז', 'אמגז'],
  'ועד בית': ['ועד בית', 'ועד הבית', 'דמי ניהול'],
  'משכנתא': ['משכנתא', 'בנק', 'הלוואה לדירה'],
  'שכירות למגורים': ['שכירות', 'דירה', 'שכר דירה'],
  
  // תקשורת
  'אינטרנט ביתי': ['אינטרנט', 'בזק', 'hot', 'yes', 'סלקום', 'פרטנר'],
  'טלפונים ניידים': ['סלולר', 'סלולרי', 'פלאפון', 'cellcom', 'golan', '012'],
  'טלוויזיה (YES / HOT / סלקום)': ['טלוויזיה', 'yes', 'hot', 'נטפליקס'],
  
  // ביטוחים
  'ביטוח חיים': ['ביטוח חיים', 'הפניקס', 'מגדל', 'הראל', 'כלל', 'מנורה'],
  'ביטוח רכב': ['ביטוח רכב', 'ביטוח חובה'],
  'ביטוח דירה': ['ביטוח דירה', 'ביטוח נכס'],
  
  // רכב
  'דלק': ['דלק', 'תדלוק', 'פז', 'סונול', 'דור אלון', 'דלק מוטור', 'ten', 'יעלים'],
  'חניה': ['חניה', 'פארק', 'parking'],
  'טיפולי רכב / מוסך': ['מוסך', 'תיקון רכב', 'שירות רכב'],
  'כביש 6 / כבישי אגרה': ['כביש 6', 'כביש אגרה', 'מעברים'],
  
  // מזון
  'קניות סופר': ['סופר', 'שופרסל', 'רמי לוי', 'ויקטורי', 'יוחננוף', 'סופרמרקט', 'טיב טעם', 'mega', 'good pharm'],
  'מסעדות': ['מסעדה', 'קפה', 'בית קפה', 'פיצה', 'המבורגר', 'סושי', 'מקדונלד', 'בורגר', 'פלאפל'],
  
  // בריאות
  'קופת חולים': ['קופת חולים', 'כללית', 'מכבי', 'מאוחדת', 'לאומית'],
  'תרופות': ['תרופות', 'בית מרקחת', 'סופר פארם'],
  'טיפולי שיניים': ['שיניים', 'רופא שיניים', 'דנטל'],
  
  // חינוך
  'חינוך גנים ובתי ספר': ['גן', 'בית ספר', 'חינוך', 'משרד החינוך'],
  'חוגים לילדים': ['חוג', 'פעילות', 'שיעור'],
  
  // אישי
  'ביגוד': ['ביגוד', 'בגדים', 'זארה', 'castro', 'fox', 'h&m', 'מנגו'],
  'קוסמטיקה וטיפוח': ['קוסמטיקה', 'מספרה', 'איפור'],
  
  // בילויים
  'בילויים ובידור': ['קולנוע', 'תיאטרון', 'הופעה', 'פארק שעשועים'],
};

// פונקציה לזיהוי קטגוריה
function detectCategory(text: string): { category: string; confidence: number } | null {
  const lowerText = text.toLowerCase();
  
  let bestMatch: { category: string; confidence: number } | null = null;
  let highestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    let matchedKeywords = 0;

    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matchedKeywords++;
        // ציון גבוה יותר להתאמה מדויקת יותר
        score += keyword.length;
      }
    }

    if (matchedKeywords > 0) {
      // נרמול הציון לפי מספר המילות המפתח
      const normalizedScore = score / keywords.length;
      if (normalizedScore > highestScore) {
        highestScore = normalizedScore;
        bestMatch = {
          category,
          confidence: Math.min(matchedKeywords / keywords.length, 0.95)
        };
      }
    }
  }

  return bestMatch;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const body = await request.json();
    const { description, vendor, amount } = body;

    if (!description) {
      return NextResponse.json(
        { error: 'Missing description' },
        { status: 400 }
      );
    }

    // שילוב description + vendor לניתוח טוב יותר
    const fullText = [description, vendor].filter(Boolean).join(' ');

    // ניסיון לזיהוי הקטגוריה
    const detection = detectCategory(fullText);

    if (detection) {
      // שליפת פרטי הקטגוריה מהDB
      const { data: category } = await (supabase as any)
        .from('expense_categories')
        .select('*')
        .eq('name', detection.category)
        .eq('is_active', true)
        .single();

      if (category) {
        return NextResponse.json({
          suggested_category: category.name,
          expense_type: category.expense_type,
          category_group: category.category_group,
          confidence: detection.confidence,
          matched: true
        });
      }
    }

    // אם לא מצאנו התאמה, ננסה לנחש לפי סכום
    let defaultType = 'variable';
    if (amount) {
      // סכומים קבועים/חוזרים בדרך כלל באותו טווח
      if (amount > 1000 && amount < 5000) {
        defaultType = 'fixed';
      } else if (amount > 10000) {
        defaultType = 'special';
      }
    }

    return NextResponse.json({
      suggested_category: null,
      expense_type: defaultType,
      category_group: null,
      confidence: 0,
      matched: false,
      message: 'לא נמצאה התאמה אוטומטית. נא לבחור קטגוריה ידנית.'
    });

  } catch (error) {
    console.error('Categorize API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

