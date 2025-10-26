// @ts-nocheck
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
 *   detailed_category: string,
 *   expense_frequency: 'fixed' | 'temporary' | 'special' | 'one_time',
 *   confidence: number (0-1),
 *   category_group?: string
 * }
 */

// מיפוי קטגוריות מפורטות
interface CategoryMapping {
  keywords: string[];
  detailed_category: string;
  expense_frequency: 'fixed' | 'temporary' | 'special' | 'one_time';
  category_label: string;
}

const CATEGORY_MAPPINGS: CategoryMapping[] = [
  // מזון ומשקאות
  { keywords: ['סופר', 'שופרסל', 'רמי לוי', 'ויקטורי', 'יוחננוף', 'סופרמרקט', 'טיב טעם', 'mega', 'good pharm', 'מכולת', 'שוק'], detailed_category: 'food_beverages', expense_frequency: 'fixed', category_label: 'קניות סופר' },
  { keywords: ['מסעדה', 'קפה', 'בית קפה', 'פיצה', 'המבורגר', 'סושי', 'מקדונלד', 'בורגר קינג', 'פלאפל', 'שווארמה', 'מזון', 'אוכל'], detailed_category: 'food_beverages', expense_frequency: 'one_time', category_label: 'מסעדות וקפה' },
  
  // סלולר ותקשורת
  { keywords: ['סלולר', 'סלולרי', 'פלאפון', 'cellcom', 'סלקום', 'פרטנר', 'golan', 'גולן טלקום', 'הוט מובייל', '012', '019', 'רמי לוי תקשורת'], detailed_category: 'cellular_communication', expense_frequency: 'fixed', category_label: 'סלולר' },
  { keywords: ['אינטרנט', 'בזק', 'hot', 'סיבים אופטיים', 'fiber', 'unlimited', 'ibc'], detailed_category: 'cellular_communication', expense_frequency: 'fixed', category_label: 'אינטרנט' },
  { keywords: ['טלוויזיה', 'yes', 'סלקום tv', 'נטפליקס', 'netflix', 'spotify', 'disney', 'apple tv'], detailed_category: 'subscriptions', expense_frequency: 'fixed', category_label: 'מנויים דיגיטליים' },
  
  // תחבורה ודלק
  { keywords: ['דלק', 'תדלוק', 'פז', 'סונול', 'דור אלון', 'דלק מוטור', 'ten', 'יעלים', 'benzi', 'sonol'], detailed_category: 'transportation_fuel', expense_frequency: 'fixed', category_label: 'דלק' },
  { keywords: ['חניה', 'פארק', 'parking', 'חנייה'], detailed_category: 'transportation_fuel', expense_frequency: 'fixed', category_label: 'חניה' },
  { keywords: ['מוסך', 'תיקון רכב', 'שירות רכב', 'טסט', 'טיפול'], detailed_category: 'transportation_fuel', expense_frequency: 'special', category_label: 'תחזוקת רכב' },
  { keywords: ['כביש 6', 'כביש אגרה', 'מעברים', 'איילון'], detailed_category: 'transportation_fuel', expense_frequency: 'one_time', category_label: 'כבישי אגרה' },
  { keywords: ['רב קו', 'רכבת', 'אוטובוס', 'מונית', 'אגד', 'דן', 'מטרופולין'], detailed_category: 'transportation_fuel', expense_frequency: 'one_time', category_label: 'תחבורה ציבורית' },
  
  // דיור ותחזוקה
  { keywords: ['ארנונה', 'עירייה', 'מס שבח', 'עיריית'], detailed_category: 'housing_maintenance', expense_frequency: 'fixed', category_label: 'ארנונה' },
  { keywords: ['חשמל', 'חברת חשמל', 'חח"י'], detailed_category: 'utilities', expense_frequency: 'fixed', category_label: 'חשמל' },
  { keywords: ['מים', 'מי ירושלים', 'תאגיד מים', 'עיריית'], detailed_category: 'utilities', expense_frequency: 'fixed', category_label: 'מים' },
  { keywords: ['גז', 'סופרגז', 'אמגז'], detailed_category: 'utilities', expense_frequency: 'fixed', category_label: 'גז' },
  { keywords: ['ועד בית', 'ועד הבית', 'דמי ניהול', 'ניהול'], detailed_category: 'housing_maintenance', expense_frequency: 'fixed', category_label: 'ועד בית' },
  { keywords: ['משכנתא', 'הלוואה לדירה'], detailed_category: 'loans_debt', expense_frequency: 'fixed', category_label: 'משכנתא' },
  { keywords: ['שכירות', 'שכר דירה'], detailed_category: 'housing_maintenance', expense_frequency: 'fixed', category_label: 'שכירות' },
  
  // ביטוחים
  { keywords: ['ביטוח חיים', 'הפניקס', 'מגדל', 'הראל', 'כלל', 'מנורה'], detailed_category: 'insurance', expense_frequency: 'fixed', category_label: 'ביטוח חיים' },
  { keywords: ['ביטוח רכב', 'ביטוח חובה', 'ביטוח מקיף'], detailed_category: 'insurance', expense_frequency: 'fixed', category_label: 'ביטוח רכב' },
  { keywords: ['ביטוח דירה', 'ביטוח נכס', 'ביטוח תכולה'], detailed_category: 'insurance', expense_frequency: 'fixed', category_label: 'ביטוח דירה' },
  
  // בריאות
  { keywords: ['קופת חולים', 'כללית', 'מכבי', 'מאוחדת', 'לאומית'], detailed_category: 'health_medical', expense_frequency: 'fixed', category_label: 'קופת חולים' },
  { keywords: ['תרופות', 'בית מרקחת', 'סופר פארם', 'פארם', 'תרופה'], detailed_category: 'health_medical', expense_frequency: 'one_time', category_label: 'תרופות' },
  { keywords: ['שיניים', 'רופא שיניים', 'דנטל', 'שיננית'], detailed_category: 'health_medical', expense_frequency: 'special', category_label: 'רופא שיניים' },
  { keywords: ['רופא', 'מרפאה', 'בדיקה', 'טיפול'], detailed_category: 'health_medical', expense_frequency: 'one_time', category_label: 'רופאים' },
  
  // חינוך
  { keywords: ['גן', 'גן ילדים', 'מעון', 'פעוטון'], detailed_category: 'education', expense_frequency: 'fixed', category_label: 'גן ילדים' },
  { keywords: ['בית ספר', 'חינוך', 'משרד החינוך', 'בי"ס'], detailed_category: 'education', expense_frequency: 'fixed', category_label: 'בית ספר' },
  { keywords: ['חוג', 'פעילות', 'שיעור', 'קורס'], detailed_category: 'education', expense_frequency: 'fixed', category_label: 'חוגים' },
  { keywords: ['צהרון', 'צהריים', 'השגחה'], detailed_category: 'education', expense_frequency: 'fixed', category_label: 'צהרון' },
  
  // ביגוד והנעלה
  { keywords: ['ביגוד', 'בגדים', 'זארה', 'castro', 'fox', 'h&m', 'מנגו', 'נעליים', 'נעל'], detailed_category: 'clothing_footwear', expense_frequency: 'one_time', category_label: 'ביגוד ונעליים' },
  
  // בילויים
  { keywords: ['קולנוע', 'תיאטרון', 'הופעה', 'פארק שעשועים', 'סינמה', 'כרטיס'], detailed_category: 'entertainment_leisure', expense_frequency: 'one_time', category_label: 'בילויים' },
  { keywords: ['חדר כושר', 'חדכ', 'כושר', 'gym', 'פיטנס'], detailed_category: 'subscriptions', expense_frequency: 'fixed', category_label: 'חדר כושר' },
  
  // קניות כלליות
  { keywords: ['איקאה', 'ikea', 'ace', 'home center', 'רהיטים', 'ציוד לבית'], detailed_category: 'shopping_general', expense_frequency: 'one_time', category_label: 'קניות לבית' },
];

// פונקציה לזיהוי קטגוריה מפורטת
function detectCategoryDetailed(text: string): {
  category_label: string;
  detailed_category: string;
  expense_frequency: string;
  confidence: number;
} | null {
  const lowerText = text.toLowerCase();
  
  let bestMatch: {
    category_label: string;
    detailed_category: string;
    expense_frequency: string;
    confidence: number;
  } | null = null;
  let highestScore = 0;

  for (const mapping of CATEGORY_MAPPINGS) {
    let score = 0;
    let matchedKeywords = 0;

    for (const keyword of mapping.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matchedKeywords++;
        // ציון גבוה יותר להתאמה מדויקת יותר
        score += keyword.length;
      }
    }

    if (matchedKeywords > 0) {
      // נרמול הציון לפי מספר המילות המפתח
      const normalizedScore = score / mapping.keywords.length;
      if (normalizedScore > highestScore) {
        highestScore = normalizedScore;
        bestMatch = {
          category_label: mapping.category_label,
          detailed_category: mapping.detailed_category,
          expense_frequency: mapping.expense_frequency,
          confidence: Math.min(matchedKeywords / mapping.keywords.length, 0.95)
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
    const detection = detectCategoryDetailed(fullText);

    if (detection) {
      return NextResponse.json({
        suggested_category: detection.category_label,
        detailed_category: detection.detailed_category,
        expense_frequency: detection.expense_frequency,
        confidence: detection.confidence,
        matched: true
      });
    }

    // אם לא מצאנו התאמה, ננסה לנחש לפי סכום
    let defaultFrequency: 'fixed' | 'temporary' | 'special' | 'one_time' = 'one_time';
    if (amount) {
      // סכומים קבועים/חוזרים בדרך כלל באותו טווח
      if (amount > 50 && amount < 500) {
        defaultFrequency = 'fixed';
      } else if (amount > 5000) {
        defaultFrequency = 'special';
      }
    }

    return NextResponse.json({
      suggested_category: 'אחר',
      detailed_category: 'other',
      expense_frequency: defaultFrequency,
      confidence: 0.3,
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

