/**
 * Universal State-Aware AI Intent Parser
 *
 * A single function that understands user intent in ANY conversation state.
 * Uses Gemini Flash (~$0.000175/call) with state-specific prompts.
 *
 * Replaces isCommand() keyword matching across all state handlers.
 */

import { chatWithGeminiFlashMinimal } from './gemini-client';

// ============================================================================
// Types
// ============================================================================

export interface StateIntent {
  intent: string;
  confidence: number;
  params?: Record<string, any>;
}

// ============================================================================
// State-Specific Prompts
// ============================================================================

const STATE_PROMPTS: Record<string, string> = {
  // ── Classification Start (generic state, not yet classifying) ───────────────
  classification_start: `אתה מנתח כוונות למערכת φ - מאמן פיננסי.
המשתמש בשלב סיווג - יש תנועות שממתינות אבל עוד לא התחיל.
זהה כוונה אחת. החזר JSON בלבד.

כוונות:
start - המשתמש רוצה להתחיל/להמשיך לסווג (נתחיל, נמשיך, התחל, סווג, קבל הכל)
add_document - המשתמש רוצה להוסיף מסמך/דוח (עוד דוח, דוח נוסף, מסמך)
help - המשתמש רוצה עזרה
unknown - לא ברור

פורמט: {"intent":"...","confidence":0.0-1.0,"params":{}}`,

  // ── Classification ─────────────────────────────────────────────────────────
  classification: `אתה מנתח כוונות למערכת φ - מאמן פיננסי.
המשתמש מסווג תנועות בנקאיות. הוא רואה תנועה ומתבקש לתת קטגוריה.
זהה כוונה אחת. החזר JSON בלבד.

כוונות:
approve - המשתמש מאשר/מסכים עם ההצעה (כן, נכון, אישור, ok, מסכים)
skip - המשתמש רוצה לדלג על התנועה (דלג, הבא, תעבור, לא יודע)
accept_all - המשתמש רוצה לסווג הכל אוטומטית (קבל הכל, סווג הכל, אוטומטי)
fix - המשתמש רוצה לתקן/לחזור אחורה (תקן, טעות, חזור, לא נכון, תיקון)
list_categories - המשתמש רוצה לראות רשימת קטגוריות (רשימה, קטגוריות, אפשרויות, מה יש)
finish - המשתמש רוצה לסיים את הסיווג (סיימתי, מספיק, נגמר, done, finish)
category_input - המשתמש כותב שם קטגוריה. params:{category:"שם הקטגוריה"}
number_select - המשתמש בוחר מספר מתוך רשימה. params:{number:N}
help - המשתמש רוצה עזרה
unknown - לא ברור

פורמט: {"intent":"...","confidence":0.0-1.0,"params":{}}`,

  // ── Goals Setup ────────────────────────────────────────────────────────────
  goals_setup: `אתה מנתח כוונות למערכת φ - מאמן פיננסי.
המשתמש בשלב הגדרת יעדי חיסכון.
זהה כוונה אחת. החזר JSON בלבד.

כוונות:
new_goal - המשתמש רוצה ליצור יעד חדש (יעד חדש, הוסף יעד, רוצה לחסוך, כן)
skip - המשתמש רוצה לדלג/להמשיך הלאה (דלג, סיימתי, לא עכשיו, skip, done)
cancel - המשתמש רוצה לבטל (ביטול, בטל, cancel)
decline - המשתמש לא רוצה (לא, no)
show_goals - המשתמש רוצה לראות יעדים קיימים (יעדים, הצג, show goals)
help - המשתמש רוצה עזרה
unknown - לא ברור

פורמט: {"intent":"...","confidence":0.0-1.0,"params":{}}`,

  // ── Goals Phase (ongoing management) ───────────────────────────────────────
  goals: `אתה מנתח כוונות למערכת φ - מאמן פיננסי.
המשתמש מנהל יעדי חיסכון.
זהה כוונה אחת. החזר JSON בלבד.

כוונות:
new_goal - יצירת יעד חדש (יעד חדש, הוסף, רוצה לחסוך)
show_goals - הצגת יעדים (יעדים, הצג, מה היעדים שלי)
edit_goal - עריכת יעד (ערוך, שנה, עדכן)
simulate - סימולציה/תרחישים (סימולציה, מה יקרה אם, תרחיש)
optimize - אופטימיזציה/שיפור (שפר, ייעל, אופטימיזציה)
confirm - אישור (אשר, confirm, כן)
cancel - ביטול (ביטול, בטל)
next_phase - מעבר לתקציב (המשך, נמשיך, הבא, תקציב, budget)
finish - סיום יעדים (סיימתי, done, מספיק, finish)
help - עזרה
unknown - לא ברור

פורמט: {"intent":"...","confidence":0.0-1.0,"params":{}}`,

  // ── Behavior ───────────────────────────────────────────────────────────────
  behavior: `אתה מנתח כוונות למערכת φ - מאמן פיננסי.
המשתמש בשלב ניתוח דפוסי הוצאות.
זהה כוונה אחת. החזר JSON בלבד.

כוונות:
analyze - המשתמש רוצה ניתוח/תובנות (נתח, ניתוח, התחל, דפוסים, תראה לי)
summary - המשתמש רוצה סיכום (סיכום, תובנות, insights)
next_phase - המשתמש רוצה להמשיך הלאה (המשך, נמשיך, הבא, יעדים, goals)
add_docs - המשתמש רוצה להוסיף מסמכים (עוד דוח, מסמך, add)
help - עזרה
unknown - לא ברור

פורמט: {"intent":"...","confidence":0.0-1.0,"params":{}}`,

  // ── Loan Decision (yes/no binary) ─────────────────────────────────────────
  loan_decision: `אתה מנתח כוונות למערכת φ - מאמן פיננסי.
המשתמש קיבל הצעה לאיחוד הלוואות ועונה עליה.
זהה כוונה אחת. החזר JSON בלבד.

כוונות:
yes - המשתמש מעוניין/מסכים (כן, בטח, מעוניין, רוצה, אשמח, בוא, yes, ok)
no - המשתמש לא מעוניין (לא, no, תודה לא, לא מעוניין, בינתיים לא)
skip - המשתמש רוצה לדלג/להמשיך (נמשיך, המשך, דלג, skip, הלאה, אחר כך)
help - עזרה
unknown - לא ברור

פורמט: {"intent":"...","confidence":0.0-1.0,"params":{}}`,

  // ── Waiting for Documents ─────────────────────────────────────────────────
  waiting_for_docs: `אתה מנתח כוונות למערכת φ - מאמן פיננסי.
המשתמש בשלב שבו מחכים שישלח מסמכים (הלוואות או דוחות בנק).
זהה כוונה אחת. החזר JSON בלבד.

כוונות:
skip - המשתמש רוצה לדלג/להמשיך בלי מסמכים (המשך, נמשיך, דלג, skip, אין לי, בינתיים לא, next, done, לא עכשיו)
add_document - המשתמש רוצה לשלוח/להוסיף מסמך (שולח, מצרף, הנה)
help - עזרה
unknown - לא ברור

פורמט: {"intent":"...","confidence":0.0-1.0,"params":{}}`,

  // ── Onboarding: Waiting for Document ──────────────────────────────────────
  onboarding: `אתה מנתח כוונות למערכת φ - מאמן פיננסי.
המשתמש חדש ומחכים שישלח דוח בנק או אשראי ראשון.
זהה כוונה אחת. החזר JSON בלבד.

כוונות:
start_classify - המשתמש רוצה להתחיל/לסווג תנועות (נתחיל, נמשיך, התחל, לסווג, סיווג, start)
add_document - המשתמש רוצה לשלוח מסמך (עוד דוח, דוח נוסף, שולח, מצרף)
skip - המשתמש רוצה לדלג (דלג, skip, אין לי, אין לי עכשיו, מאוחר יותר, אחר כך, לא עכשיו, לא רוצה)
help - עזרה
unknown - לא ברור

פורמט: {"intent":"...","confidence":0.0-1.0,"params":{}}`,

  // ── Budget Phase ──────────────────────────────────────────────────────────
  budget: `אתה מנתח כוונות למערכת φ - מאמן פיננסי.
המשתמש בשלב בניית תקציב חודשי.
זהה כוונה אחת. החזר JSON בלבד.

כוונות:
auto_budget - המשתמש רוצה תקציב אוטומטי (אוטומטי, אוטו, תקציב אוטומטי, תבנה לי, בנה לי)
manual_budget - המשתמש רוצה להגדיר ידנית (ידני, הגדרה ידנית, אני אגדיר, בעצמי)
skip - המשתמש רוצה לדלג (דלג, skip, לא עכשיו, אחר כך, הלאה)
finish - המשתמש סיים/מאשר (סיימתי, finish, done, מאשר, confirm, אישור)
category_set - המשתמש מגדיר קטגוריה:סכום. params:{category:"...",amount:N}
help - עזרה
unknown - לא ברור

פורמט: {"intent":"...","confidence":0.0-1.0,"params":{}}`,
};

// ============================================================================
// Main Function
// ============================================================================

export async function parseStateIntent(
  message: string,
  state: string
): Promise<StateIntent> {
  // Find the most specific prompt for this state
  const prompt = STATE_PROMPTS[state]
    || STATE_PROMPTS[state.replace('_income', '').replace('_expense', '')]
    || null;

  if (!prompt) {
    return { intent: 'unknown', confidence: 0.3 };
  }

  try {
    const response = await chatWithGeminiFlashMinimal(message, prompt);

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
    console.error(`[StateIntent] Parse error for state=${state}:`, error);
    return { intent: 'unknown', confidence: 0.3 };
  }
}
