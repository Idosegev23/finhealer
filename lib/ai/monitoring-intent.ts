/**
 * AI-powered intent detection for the monitoring state.
 *
 * Uses Gemini Flash (chatWithGeminiFlashMinimal) to understand natural Hebrew
 * input and map it to a structured MonitoringIntent.
 *
 * Cost: ~$0.000175 per call (~200 input + 50 output tokens)
 */

import { chatWithGeminiFlashMinimal } from './gemini-client';

// ============================================================================
// Types
// ============================================================================

export type MonitoringIntentType =
  | 'summary'
  | 'summary_month'
  | 'available_months'
  | 'expense_chart'
  | 'income_chart'
  | 'budget_status'
  | 'cash_flow'
  | 'phi_score'
  | 'advisor'
  | 'goals'
  | 'goal_deposit'
  | 'unclassified'
  | 'credit_pending'
  | 'duplicates'
  | 'loans'
  | 'add_document'
  | 'start_classify'
  | 'continue'
  | 'analyze'
  | 'category_question'
  | 'general_question'
  | 'unknown';

export interface MonitoringIntent {
  intent: MonitoringIntentType;
  confidence: number;
  params?: {
    month?: string;
    category?: string;
    goal_name?: string;
    amount?: number;
  };
}

// ============================================================================
// System Prompt (compact — fewer tokens = cheaper + faster)
// ============================================================================

const MONITORING_INTENT_PROMPT = `אתה מנתח כוונות למערכת φ - מאמן פיננסי בוואטסאפ.
המשתמש בשלב monitoring - ניטור שוטף של כספים.
זהה כוונה אחת בלבד. החזר JSON בלבד, בלי markdown.

כוונות:
summary - סיכום/מצב/סטטוס/כמה כסף יש לי
summary_month - סיכום חודש ספציפי. params:{month:"YYYY-MM"}
available_months - אילו חודשים יש/זמינים
expense_chart - גרף/תרשים הוצאות/תראה לי גרף
income_chart - גרף/תרשים הכנסות
budget_status - תקציב/כמה נשאר/כמה אפשר להוציא
cash_flow - תזרים/תחזית/מה צפוי
phi_score - ציון/דירוג/בריאות פיננסית
advisor - ייעוץ/יועץ/גדי/רוצה להתייעץ
goals - יעדים/חיסכון/הגדר יעד/רוצה לחסוך
goal_deposit - הפקדה ליעד. params:{goal_name:"...",amount:N}
unclassified - לא מסווגות/ממתינות/תנועות שצריך לסווג
credit_pending - ממתין לאשראי/פירוט אשראי
duplicates - כפל תשלום/כפילויות/חשד לכפל
loans - הלוואות/איחוד/מחזור/חובות
add_document - לשלוח/להוסיף מסמך/דוח/קובץ
start_classify - להתחיל/לסווג תנועות
continue - נמשיך/הלאה/קדימה
analyze - ניתוח/דפוסים/התנהגות פיננסית
category_question - כמה הוצאתי על קטגוריה. params:{category:"שם הקטגוריה"}
general_question - שאלה פיננסית חופשית שלא מתאימה לאף כוונה אחרת
unknown - לא ברור כלל

פורמט: {"intent":"...","confidence":0.0-1.0,"params":{}}`;

// ============================================================================
// Main Function
// ============================================================================

export async function parseMonitoringIntent(
  message: string
): Promise<MonitoringIntent> {
  try {
    const response = await chatWithGeminiFlashMinimal(
      message,
      MONITORING_INTENT_PROMPT
    );

    // Strip markdown code blocks if present
    const cleaned = response
      .replace(/```json?\n?/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      intent: parsed.intent || 'unknown',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      params: parsed.params || {},
    };
  } catch (error) {
    console.error('[MonitoringIntent] Parse error:', error);
    return { intent: 'unknown', confidence: 0.3 };
  }
}
