// ============================================================================
// φ Guided Tour — definitions
// ----------------------------------------------------------------------------
// Voice: gentle, simple Hebrew. Imagine sitting next to a non-tech-savvy
// elderly user, walking them through every button and field. Each step
// targets a real element via [data-tour="..."] so the spotlight works.
// Only the very first ("intro") and last ("outro") step on each tour are
// centered modals — every other step highlights a concrete UI element.
// ============================================================================

export type TourStep = {
  id: string
  /** CSS attribute selector or `null` for a centered modal step. */
  selector: string | null
  title: string
  body: string
  /** Optional tip line shown below the body. */
  tip?: string
  /** Where to anchor the popover relative to the target. */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  /** Optional CTA at the bottom of the step (besides next/skip). */
  cta?: { label: string; href: string }
}

export type TourId =
  | 'onboarding-welcome'
  | 'dashboard'
  | 'budget'
  | 'goals'
  | 'loans'
  | 'assistant'
  | 'overview'
  | 'financial-table'
  | 'expenses'
  | 'income'
  | 'transactions'
  | 'recurring'
  | 'savings'
  | 'investments'
  | 'insurance'
  | 'pensions'
  | 'simulator'
  | 'scan-center'
  | 'missing-documents'
  | 'reports'
  | 'settings'

export const TOURS: Record<TourId, { name: string; steps: TourStep[] }> = {
  // ============================================================
  // ONBOARDING
  // ============================================================
  'onboarding-welcome': {
    name: 'הכרות מהירה',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'נעים מאוד 👋',
        body: 'שמי φ. אני המאמן הפיננסי שלך. אני כאן ללוות אותך, לא להלחיץ אותך. אם משהו לא ברור — תעצור, תשאל, תחזור. שום דבר אסור ושום דבר לא נשמר עד שאתה מאשר.',
        tip: 'אפשר לסגור את ההסבר הזה בכל רגע (X בפינה למעלה).',
      },
      {
        id: 'progress',
        selector: '[data-tour="progress"]',
        placement: 'bottom',
        title: 'הסרגל הזה הוא המפה',
        body: 'רואה את העיגולים עם המספרים? כל עיגול הוא שלב. השלב הירוק = סיימת. השלב עם המסגרת הזהובה = איפה שאתה עכשיו.',
      },
      {
        id: 'phone',
        selector: '[data-tour="phone-step"]',
        placement: 'top',
        title: 'בשלב הבא נבקש מספר טלפון',
        body: 'זה לטובתך — דרך הטלפון תוכל לדבר איתי בוואטסאפ. תשלח לי דוח מהבנק, אני אענה לך בתוך שניות. בלי הטלפון, אי אפשר לחבר אותך אליי.',
        tip: 'המספר שלך מוצפן. שום אדם זר לא רואה אותו.',
      },
    ],
  },

  // ============================================================
  // MAIN DASHBOARD
  // ============================================================
  dashboard: {
    name: 'סיור בדף הבית',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'ברוך הבא לדף הבית שלך',
        body: 'זה המסך הראשי. כאן תראה את התמונה הכללית של הכסף שלך. בוא נסתכל יחד על כל חלק במסך.',
        tip: 'אי אפשר לקלקל פה כלום. תרגיש בנוח לחקור.',
      },
      {
        id: 'greeting',
        selector: '[data-tour="greeting"]',
        placement: 'bottom',
        title: 'ברכה אישית',
        body: 'בראש המסך — השם שלך והתאריך של היום. בכל פעם שתיכנס, תראה ברכה מותאמת לשעה ("בוקר טוב"/"ערב טוב").',
      },
      {
        id: 'phi-score',
        selector: '[data-tour="phi-score"]',
        placement: 'left',
        title: 'הציון שלך — המספר הזה',
        body: 'זה ציון φ. מספר בין 0 ל-100. ככל שהוא גבוה יותר — המצב הפיננסי שלך טוב יותר. הציון מתעדכן לבד, אתה לא צריך לעשות כלום.',
        tip: 'מתחת ל-50 = שווה לעבוד. בין 50-70 = יפה. מעל 70 = מצוין.',
      },
      {
        id: 'phase-journey',
        selector: '[data-tour="phase-journey"]',
        placement: 'right',
        title: 'באיזה שלב במסע אתה',
        body: 'זה לא משחק — זה מסע אמיתי שיש לו 5 שלבים: איסוף נתונים → סיווג → ניתוח התנהגות → יעדים → תקציב → ניטור שוטף. תראה כאן איפה אתה עכשיו.',
      },
      {
        id: 'kpis',
        selector: '[data-tour="kpis"]',
        placement: 'bottom',
        title: 'ארבעה מספרים חשובים',
        body: 'הכנסות החודש, הוצאות, יתרה (כמה נשאר), וכמה תנועות מחכות לאישור. ירוק = טוב. אדום = שווה להציץ.',
      },
      {
        id: 'expenses-pie',
        selector: '[data-tour="expenses-pie"]',
        placement: 'top',
        title: 'גרף עוגה של ההוצאות',
        body: 'איפה הולך הכסף שלך החודש? כל פלח בעוגה הוא קטגוריה — סופר, דלק, יציאות. הפלח הגדול ביותר = איפה אתה הכי מוציא.',
      },
      {
        id: 'budget-tracking',
        selector: '[data-tour="budget-tracking"]',
        placement: 'top',
        title: 'מעקב תקציב',
        body: 'אם כבר הגדרת תקציב — תראה כאן פסים שמתמלאים במשך החודש. אם עוד לא — יופיע כפתור "צור תקציב חכם".',
      },
      {
        id: 'goals',
        selector: '[data-tour="goals"]',
        placement: 'top',
        title: 'היעדים שלך',
        body: 'יעד = מטרה. למשל "לחסוך 10,000 ₪ עד יום הולדת". כל יעד יש לו פס התקדמות שמתמלא לבד כשאתה חוסך.',
        cta: { label: 'הגדר יעד חדש', href: '/dashboard/goals' },
      },
      {
        id: 'loans-snapshot',
        selector: '[data-tour="loans-snapshot"]',
        placement: 'top',
        title: 'תצוגת חובות',
        body: 'תקציר של כל ההלוואות שלך. תוכל לראות את היתרה הכללית. לחיצה על "הכל" תוביל אותך לעמוד המפורט.',
      },
      {
        id: 'insights',
        selector: '[data-tour="insights"]',
        placement: 'top',
        title: 'תובנות חכמות',
        body: 'כאן אני שם הערות שגיליתי על הדפוסים שלך. למשל "החודש הוצאת 30% יותר על מסעדות". התובנות עם נקודה אדומה = חשוב לשים לב.',
      },
      {
        id: 'recent-transactions',
        selector: '[data-tour="recent-transactions"]',
        placement: 'top',
        title: 'תנועות אחרונות',
        body: '6 הפעולות האחרונות שלך — הכנסות והוצאות. ירוק = הכנסה, כתום = הוצאה. תג "ממתין" = עוד לא סיווגתי, תאשר אותה.',
      },
      {
        id: 'sidebar',
        selector: '[data-tour="sidebar"]',
        placement: 'right',
        title: 'התפריט מימין',
        body: 'הרצועה הכהה — זה התפריט הראשי. לחיצה על כל שורה לוקחת אותך למסך אחר. אל תדאג לטעות, אפשר לחזור הנה כל פעם.',
        tip: 'בכל פעם שתיכנס למסך חדש — יקפוץ הסבר חדש כמו זה.',
      },
      {
        id: 'whatsapp-final',
        selector: null,
        placement: 'center',
        title: 'הטריק הכי חשוב',
        body: 'אתה לא חייב להיכנס למסך הזה כל יום. אפשר פשוט לכתוב לי בוואטסאפ: "כמה הוצאתי השבוע על סופר?" — ואני אענה. כל מה שיש כאן זמין גם דרך הוואטסאפ.',
      },
    ],
  },

  // ============================================================
  // BUDGET
  // ============================================================
  budget: {
    name: 'מסך התקציב',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'מה זה תקציב?',
        body: 'תקציב הוא תוכנית: כמה כסף אתה מתכנן להוציא בכל קטגוריה החודש. למשל — 1,500 ₪ על אוכל, 600 ₪ על דלק.',
        tip: 'אל תדאג להגדיר נכון. אני אציע לך תקציב לפי מה שכבר הוצאת. אתה רק תאשר.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת של המסך',
        body: 'בראש המסך תמיד יופיע השם של המסך והסבר קצר. זה עוזר לך לדעת איפה אתה.',
      },
      {
        id: 'categories',
        selector: '[data-tour="budget-categories"]',
        placement: 'bottom',
        title: 'אזור הקטגוריות',
        body: 'אם עוד אין לך תקציב — תראה כאן הסבר וכפתור "צור תקציב חכם". התקציב יוקם אוטומטית לפי הדפוסים שלך.',
        tip: 'הכפתור הזה הוא הצעד החשוב ביותר במסך הזה. כדאי ללחוץ עליו.',
      },
      {
        id: 'progress',
        selector: '[data-tour="budget-progress"]',
        placement: 'top',
        title: 'מצב התקציב',
        body: 'אם כבר יש תקציב — כאן תראה איך אתה עומד מולו החודש. צבע ירוק = הכל בסדר. צהוב = שים לב. אדום = חרגת.',
      },
      {
        id: 'overrun',
        selector: null,
        placement: 'center',
        title: 'מה קורה אם אני חורג?',
        body: 'אני אשלח לך התראה בוואטסאפ. בלי דרמה, רק כדי שתדע. גם אם חרגת — זה לא סוף העולם. בחודש הבא נסתכל על זה יחד.',
      },
    ],
  },

  // ============================================================
  // GOALS
  // ============================================================
  goals: {
    name: 'מסך היעדים',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'מה זה יעד?',
        body: 'יעד הוא משהו שאתה רוצה להשיג עם כסף. למשל: "לחסוך 30,000 ₪ לטיול לחו"ל עד יוני". יעד צריך שלושה דברים: סכום, תאריך, ושם.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: 'בראש המסך — "יעדים" עם תיאור קצר. לידה תראה את כפתורי הפעולה הראשיים.',
      },
      {
        id: 'add-goal',
        selector: '[data-tour="goals-add"]',
        placement: 'bottom',
        title: 'הכפתור החשוב — "יעד חדש"',
        body: 'לחיצה על הכפתור הזה תפתח חלון להוספת יעד. הזן שם, סכום, תאריך, וסוג (חיסכון/רכישה/החזר חוב). זהו, סיימת.',
        tip: 'אפשר תמיד למחוק יעד אחר כך, אם התחרטת.',
      },
      {
        id: 'progress',
        selector: '[data-tour="goals-progress"]',
        placement: 'top',
        title: 'רשימת היעדים שלך',
        body: 'כל יעד מוצג עם פס התקדמות צבעוני. הפס מתמלא לבד בכל פעם שאתה חוסך כסף. אתה לא צריך לעדכן ידנית.',
      },
      {
        id: 'edit-delete',
        selector: '[data-tour="goals-progress"]',
        placement: 'top',
        title: 'עריכה והפקדה',
        body: 'ליד כל יעד יש סימני עיפרון (עריכה) ופח אשפה (מחיקה). יש גם כפתור "הפקדה" — אם הפקדת כסף ייעודי, לחץ עליו.',
        tip: 'מחיקה דורשת אישור — כדי שלא תימחק בטעות. אם לא בטוח, עדיף "ערוך" ולא "מחק".',
      },
    ],
  },

  // ============================================================
  // LOANS
  // ============================================================
  loans: {
    name: 'ניהול הלוואות',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'כל החובות במסך אחד',
        body: 'במסך הזה אתה רואה את כל ההלוואות שלך — משכנתא, הלוואת רכב, הלוואות מהבנק. לכל הלוואה: יתרה, ריבית, החזר חודשי.',
        tip: 'אם אתה לא יודע את כל הפרטים — לא נורא. תמלא מה שאתה כן יודע.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת והפעולות',
        body: 'הכותרת בראש המסך מסבירה איפה אתה. לידה תראה את כפתורי הפעולות (כמו "הוסף הלוואה").',
      },
      {
        id: 'action',
        selector: '[data-tour="page-action"]',
        placement: 'left',
        title: 'הוספת הלוואה',
        body: 'הכפתור הכחול "הוסף הלוואה" פותח טופס: שם הבנק, סוג ההלוואה (משכנתא/רכב/אחר), סכום, ריבית. אם משהו לא ידוע לך — דלג, תוכל לעדכן אחר כך.',
      },
      {
        id: 'kpi-grid',
        selector: '[data-tour="kpi-grid"]',
        placement: 'bottom',
        title: 'תקציר ההלוואות',
        body: 'ארבעה מספרים חשובים: כמה הלוואות פעילות, סך היתרה, סך ההחזר החודשי, וכמה זמן עד שתסיים לשלם הכל.',
      },
      {
        id: 'list',
        selector: '[data-tour="loans-list"]',
        placement: 'top',
        title: 'רשימת ההלוואות',
        body: 'כל שורה היא הלוואה אחת. תלחץ על שורה — והיא תיפתח עם פרטים נוספים: כמה החזרים נשארו, מתי תסיים לשלם, וכו\'.',
      },
      {
        id: 'expensive',
        selector: null,
        placement: 'center',
        title: 'ההלוואה היקרה',
        body: 'את ההלוואה עם הריבית הגבוהה ביותר אני אדגיש. זו ההלוואה הראשונה שכדאי לסיים — ככה תחסוך הכי הרבה כסף.',
        tip: 'הפרש של 1% בריבית = אלפי שקלים על פני שנים. ממש שווה לבדוק.',
      },
    ],
  },

  // ============================================================
  // AI ASSISTANT
  // ============================================================
  assistant: {
    name: 'שיחה עם φ',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'דבר איתי כאילו אני אדם',
        body: 'אני AI — תוכנה שמדברת איתך. אבל אני יודע הכל על הכסף שלך. אז אפשר לשאול אותי בעברית פשוטה כל מה שמטריד אותך.',
        tip: 'אין שאלה מטופשת. שאל אותי כל מה שאתה תוהה.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת — שיחה עם φ',
        body: 'בראש המסך — סמל φ עם השם שלי. אותה היסטוריה ואותו זיכרון כמו בוואטסאפ.',
      },
      {
        id: 'messages',
        selector: '[data-tour="chat-messages"]',
        placement: 'bottom',
        title: 'אזור ההודעות',
        body: 'באזור הגדול תראה את כל מה שדיברנו. ההודעות שלך מימין בכחול כהה, התשובות שלי משמאל בלבן.',
        tip: 'בפעם הראשונה תראה גם 4 שאלות לדוגמה — אפשר ללחוץ עליהן כדי להתחיל מהר.',
      },
      {
        id: 'input',
        selector: '[data-tour="chat-input"]',
        placement: 'top',
        title: 'איפה כותבים',
        body: 'בתחתית המסך יש שורה ארוכה לכתיבה. תקליד שאלה — "כמה הוצאתי על קפה החודש?", "מה היעדים שלי?", כל מה שאתה רוצה לדעת.',
      },
      {
        id: 'send',
        selector: '[data-tour="chat-send"]',
        placement: 'top',
        title: 'כפתור השליחה',
        body: 'אחרי שכתבת — לחץ על הכפתור העגול הכחול עם החץ. אפשר גם פשוט להקיש Enter.',
        tip: 'רוצה שורה חדשה בלי לשלוח? Shift+Enter.',
      },
      {
        id: 'privacy',
        selector: null,
        placement: 'center',
        title: 'מאובטח לחלוטין',
        body: 'הנתונים שלך לא יוצאים מהמערכת. שום שירות חיצוני לא רואה אותם. הכל מוצפן ושמור רק אצלך.',
      },
    ],
  },

  // ============================================================
  // OVERVIEW
  // ============================================================
  overview: {
    name: 'סקירה כללית',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'התמונה הגדולה',
        body: 'במסך הזה אתה רואה הכל — נכסים (חיסכונות, השקעות, פנסיה) ביחד עם התחייבויות (הלוואות, חובות).',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"סקירה כללית" — המקום שבו כל המספרים החשובים מתאחדים.',
      },
      {
        id: 'networth',
        selector: '[data-tour="overview-networth"]',
        placement: 'bottom',
        title: 'מאזן / שווי נטו',
        body: 'הכרטיס הזה — המספר הכי חשוב במסך. נכסים פחות התחייבויות. ככל שהוא גדל לאורך זמן, אתה בכיוון נכון.',
        tip: 'אל תיבהל אם הוא נמוך או שלילי. זה רק צילום מצב — מה שחשוב זה הכיוון.',
      },
      {
        id: 'breakdown',
        selector: '[data-tour="overview-breakdown"]',
        placement: 'top',
        title: 'פילוח הוצאות',
        body: 'גרף עוגה שמראה איך מחולק התקציב שלך בין קטגוריות. הפלח הגדול ביותר = איפה הכי הולך הכסף.',
      },
      {
        id: 'trend',
        selector: '[data-tour="overview-trend"]',
        placement: 'top',
        title: 'הקטגוריות המובילות',
        body: 'רשימת הקטגוריות עם ההוצאה הכי גבוהה, מסודרת מהגדול לקטן. שווה לראות אם יש קטגוריה שמפתיעה אותך.',
      },
      {
        id: 'whatsapp',
        selector: null,
        placement: 'center',
        title: 'גם בוואטסאפ',
        body: 'תוכל לבקש ממני בוואטסאפ "תן לי סיכום מצב" — ואשלח לך את אותו תקציר בהודעה אחת.',
      },
    ],
  },

  // ============================================================
  // FINANCIAL TABLE
  // ============================================================
  'financial-table': {
    name: 'טבלה פיננסית',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'הסיכום הכי מלא',
        body: 'זו טבלה. בעמודות — חודשים. בשורות — קטגוריות (הכנסות, הוצאות קבועות, הוצאות משתנות, הוצאות מיוחדות).',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"טבלה פיננסית" — בראש המסך. תמיד תדע איפה אתה.',
      },
      {
        id: 'table',
        selector: '[data-tour="ftable-table"]',
        placement: 'top',
        title: 'הטבלה עצמה',
        body: 'תסתכל על שורה אחת — נגיד "סופר". תראה כמה הוצאת בכל חודש. תוכל מהר לזהות אם בחודש מסוים הוצאת חריג.',
        tip: 'מספרים שעלו חריג מסומנים באדום. שווה ללחוץ עליהם.',
      },
      {
        id: 'export',
        selector: null,
        placement: 'center',
        title: 'ייצוא לאקסל',
        body: 'יש כפתור "ייצוא" — הוא מוריד את כל הטבלה לקובץ אקסל. שימושי לפני פגישה עם רואה החשבון.',
      },
    ],
  },

  // ============================================================
  // EXPENSES
  // ============================================================
  expenses: {
    name: 'ההוצאות שלי',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'כל הוצאה — בשורה משלה',
        body: 'הרשימה הזו מציגה כל הוצאה בנפרד: התאריך, הסכום, מי הספק, ובאיזה קטגוריה זה.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת — "הוצאות"',
        body: 'מסך מסודר של כל ההוצאות שלך. תיכף נראה איך להוסיף ולתקן.',
      },
      {
        id: 'kpi-grid',
        selector: '[data-tour="kpi-grid"]',
        placement: 'bottom',
        title: 'תקציר הוצאות',
        body: 'בכרטיסים — סך ההוצאות החודש, ההוצאה הגדולה ביותר, וקטגוריה עם הכי הרבה תנועות. מבט מהיר לפני שצוללים פנימה.',
      },
      {
        id: 'add',
        selector: '[data-tour="exp-add"]',
        placement: 'left',
        title: 'הוספת הוצאה ידנית',
        body: 'הכפתור הזה — להוצאה במזומן או משהו שלא תפסתי בדוח. הזן תאריך, סכום, וקטגוריה.',
      },
      {
        id: 'list',
        selector: '[data-tour="exp-list"]',
        placement: 'top',
        title: 'הרשימה',
        body: 'כל שורה היא הוצאה אחת. לחיצה על שורה פותחת אותה לעריכה — תוכל לשנות קטגוריה, להוסיף הערה, או לפצל לכמה רכיבים.',
        tip: 'בכל פעם שתתקן קטגוריה — אני זוכר. בפעם הבאה, הוצאה דומה תסווג נכון.',
      },
      {
        id: 'split',
        selector: null,
        placement: 'center',
        title: 'מה זה "פיצול"?',
        body: 'לפעמים הוצאה אחת מכילה כמה דברים. למשל קנית בסופר אוכל + מוצרי ניקיון + ספר לילד. פיצול = לחלק את הסכום לקטגוריות שונות.',
      },
    ],
  },

  // ============================================================
  // INCOME
  // ============================================================
  income: {
    name: 'ההכנסות שלי',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'מאיפה הכסף נכנס',
        body: 'במסך הזה — כל הכנסה: משכורת, עצמאי, השכרה, פיקדונות, דיבידנדים. כל הכנסה במקור משלה.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"ההכנסות שלי" — תקציר של כל מקורות ההכנסה.',
      },
      {
        id: 'filter',
        selector: '[data-tour="inc-filter"]',
        placement: 'bottom',
        title: 'בחירת חודש',
        body: 'אפשר להציג נתונים מכל חודש. בוחרים חודש כאן — והנתונים למטה מתעדכנים. נוח כדי להשוות בין חודשים.',
      },
      {
        id: 'kpi-grid',
        selector: '[data-tour="kpi-grid"]',
        placement: 'bottom',
        title: 'תקציר הכנסות',
        body: 'בכרטיסים — סך ההכנסה החודשית, מספר תנועות הכנסה, וכמה מקורות הכנסה קבועים יש לך.',
        tip: 'הכנסה קבועה (כמו משכורת) = מקור שאני מסתמך עליו לבניית התקציב.',
      },
      {
        id: 'add',
        selector: '[data-tour="inc-add"]',
        placement: 'left',
        title: 'הוספת מקור הכנסה',
        body: 'יש לך הכנסה שלא מופיעה? לחץ על הכפתור הזה. מלא תאריך, סכום, ומאיפה הגיע — וזהו.',
      },
      {
        id: 'list',
        selector: '[data-tour="inc-list"]',
        placement: 'top',
        title: 'הטבלה',
        body: 'כל שורה היא הכנסה אחת. לחיצה על שורה תפתח אותה לעריכה. תוכל לתקן קטגוריה ("זה לא משכורת, זה החזר ממס הכנסה").',
      },
    ],
  },

  // ============================================================
  // TRANSACTIONS
  // ============================================================
  transactions: {
    name: 'יומן התנועות',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'הכל באותו מקום',
        body: 'תנועה = כל פעולה שיש בה כסף. הוצאה או הכנסה. כאן תראה את 30 הימים האחרונים, מסודר מהחדש לישן.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"תנועות" — היומן המלא של כל פעולה פיננסית.',
      },
      {
        id: 'list',
        selector: '[data-tour="tx-list"]',
        placement: 'top',
        title: 'הטבלה',
        body: 'כל שורה היא תנועה אחת — תאריך, סכום, ספק, וקטגוריה. מסודר מהחדש לישן.',
      },
      {
        id: 'pending',
        selector: null,
        placement: 'center',
        title: 'תנועות "ממתינות"',
        body: 'תנועה שעדיין לא ודאית — אני מסמן אותה כ"ממתינה" (תג צהוב). אתה צריך לאשר או לתקן.',
        tip: 'תנועות ממתינות לא נספרות בתקציב עד שאתה מאשר.',
      },
      {
        id: 'approve',
        selector: null,
        placement: 'center',
        title: 'איך מאשרים',
        body: 'לחץ על תנועה ממתינה — תראה את הפרטים. אם הקטגוריה נכונה — לחץ "אישור". אם לא — תבחר קטגוריה אחרת ואז "אישור".',
      },
    ],
  },

  // ============================================================
  // RECURRING
  // ============================================================
  recurring: {
    name: 'מנויים והוצאות חוזרות',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'הזיכרון של הארנק שלך',
        body: 'מנוי = הוצאה שחוזרת כל חודש (Netflix, ביטוח, ארנונה). אני מזהה את כל המנויים שלך אוטומטית מתוך הדוחות.',
        tip: 'הרבה אנשים מגלים פה מנויים ששכחו מהם. שווה אלפי שקלים בשנה.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"מנויים והוצאות חוזרות" — כל מה שחוזר על עצמו אוטומטית.',
      },
      {
        id: 'filter',
        selector: '[data-tour="rec-filter"]',
        placement: 'bottom',
        title: 'סינון',
        body: 'אפשר לסנן בין הוצאות והכנסות חוזרות, או לחפש מנוי לפי שם. שימושי כשהרשימה ארוכה.',
      },
      {
        id: 'list',
        selector: '[data-tour="rec-list"]',
        placement: 'top',
        title: 'הרשימה',
        body: 'כל מנוי בכרטיס: שם, סכום חודשי, מתי התחיל, וכמה הוא כבר עלה לך בסך הכל. המספר המצטבר חשוב — הוא חושף את העלות האמיתית.',
      },
      {
        id: 'cancel',
        selector: null,
        placement: 'center',
        title: 'מנוי שאתה לא צריך?',
        body: 'אנחנו לא יכולים לבטל בשבילך — חברות לא מרשות. אבל אנחנו יכולים להראות לך איך לבטל. לחץ על המנוי — תראה הוראות ביטול.',
      },
    ],
  },

  // ============================================================
  // SAVINGS
  // ============================================================
  savings: {
    name: 'חשבונות חיסכון',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'מה יש לך בחיסכון',
        body: 'פיקדונות בבנק, קופות גמל להשקעה, תכניות חיסכון, חיסכון לכל ילד — כל הכסף שלא יושב בעו"ש.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"חשבונות חיסכון" — כל החיסכונות שלך במקום אחד.',
      },
      {
        id: 'add',
        selector: '[data-tour="savings-add"]',
        placement: 'left',
        title: 'הוספת חשבון',
        body: 'הכפתור הזה — להוסיף חיסכון חדש. טופס קצר: סוג (פיקדון/קופה/חיסכון לכל ילד), סכום, איפה הוא מתנהל.',
      },
      {
        id: 'list',
        selector: '[data-tour="savings-list"]',
        placement: 'top',
        title: 'הרשימה',
        body: 'כל חשבון מוצג עם: סוג, סכום נוכחי, תשואה, ותאריך פירעון אם יש. לחיצה על שורה תפתח פרטים נוספים.',
      },
      {
        id: 'returns',
        selector: null,
        placement: 'center',
        title: 'בדיקת תשואה',
        body: 'תשואה = כמה הכסף שלך גדל. אני משווה את התשואה שלך לאפיקים אחרים. אם יש מקום שיכול להניב יותר — תראה הערה.',
        tip: 'הפרש של 1% תשואה = אלפי שקלים על פני שנים.',
      },
    ],
  },

  // ============================================================
  // INVESTMENTS
  // ============================================================
  investments: {
    name: 'תיק השקעות',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'התיק שלך, מסונכרן',
        body: 'מניות, אג"ח, קרנות נאמנות, ETF, קריפטו. הכל מוצג עם השווי הנוכחי שלו.',
        tip: 'שים לב — אנחנו לא נותנים ייעוץ השקעות. רק מציגים את התמונה ברורה.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"תיק השקעות" — כל הניירות שלך במבט אחד.',
      },
      {
        id: 'allocation',
        selector: '[data-tour="invest-allocation"]',
        placement: 'bottom',
        title: 'התיק הכללי',
        body: 'הכרטיס הגדול — סך התיק שלך והקצאת הנכסים: כמה אחוז במניות, כמה באג"ח, כמה בקרנות. ככה תוכל לראות אם התיק שלך מאוזן.',
      },
      {
        id: 'list',
        selector: '[data-tour="invest-list"]',
        placement: 'top',
        title: 'הניירות שלך',
        body: 'באזור הזה הזן או תעדכן כל השקעה ספציפית. אפשר להזין שם נייר, כמות, מחיר. אני אעדכן את השווי לבד מנתוני השוק.',
      },
      {
        id: 'returns',
        selector: null,
        placement: 'center',
        title: 'רווח/הפסד',
        body: 'לכל השקעה תראה: כמה השקעת בהתחלה, כמה זה שווה היום, ההפרש בשקלים, ובאחוזים. ירוק = רווח. אדום = הפסד.',
      },
    ],
  },

  // ============================================================
  // INSURANCE
  // ============================================================
  insurance: {
    name: 'תיק הביטוח',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'הכיסוי הביטוחי שלך',
        body: 'ביטוח חיים, ביטוח בריאות, ביטוח מחלות קשות, ביטוח סיעודי, תאונות אישיות. כל סוג ביטוח שיש לך — תראה כאן.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"תיק הביטוח שלי" — מקום אחד לכל הפוליסות.',
      },
      {
        id: 'add',
        selector: '[data-tour="ins-add"]',
        placement: 'left',
        title: 'הוספת ביטוח',
        body: 'יש לך ביטוח שלא מופיע? לחץ כאן. מספיק להזין שם החברה, סוג, וסכום הפרמיה. לא חייב למלא הכל בפעם אחת.',
      },
      {
        id: 'gaps',
        selector: '[data-tour="ins-gaps"]',
        placement: 'bottom',
        title: 'פערים בכיסוי',
        body: 'הכרטיס הזה מסמן ביטוחים חסרים — דברים שאני חושב שכדאי להוסיף לפי גילך, ההכנסות שלך, וגיל הילדים. כפילויות (אותו כיסוי בכמה ביטוחים) גם מסומנות.',
        tip: 'זו הצעה לחשוב, לא ייעוץ. שווה להתייעץ עם סוכן ביטוח.',
      },
      {
        id: 'list',
        selector: '[data-tour="ins-list"]',
        placement: 'top',
        title: 'רשימת הפוליסות',
        body: 'כל ביטוח בכרטיס: שם החברה, סוג הכיסוי, סכום הכיסוי (כמה ישלמו אם יקרה משהו), והפרמיה החודשית. לחיצה תפתח פרטים מלאים.',
      },
    ],
  },

  // ============================================================
  // PENSIONS
  // ============================================================
  pensions: {
    name: 'חיסכון פנסיוני',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'הפנסיה שלך',
        body: 'קרן פנסיה, ביטוח מנהלים, קופת גמל, קרן השתלמות. כל הכסף שאתה צובר לטווח ארוך — כאן.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"חיסכון פנסיוני" — מרכז אחד לכל הקרנות שלך.',
      },
      {
        id: 'request-report',
        selector: '[data-tour="pension-report"]',
        placement: 'bottom',
        title: 'בקשת דוח מקצועי',
        body: 'הכרטיס הזה — בקשה לדוח חינם שגדי מכין אישית. הוא מנתח את הקרנות שלך, בודק דמי ניהול, ומציע מה לשפר.',
        tip: 'הדוח הזה הוא אחד הדברים הכי שווים שיש לנו. ממש שווה.',
      },
      {
        id: 'list',
        selector: '[data-tour="pension-list"]',
        placement: 'top',
        title: 'רשימת הקרנות',
        body: 'כל קרן: שם החברה, סכום צבירה, מסלול השקעה, ודמי ניהול. שים לב לעמודה של דמי ניהול — זה הכי חשוב.',
      },
      {
        id: 'fees-warning',
        selector: null,
        placement: 'center',
        title: 'דמי ניהול = הסיפור החשוב',
        body: 'דמי ניהול הם אחוז שהחברה לוקחת בכל שנה מהצבירה שלך. נשמע קטן (0.3%-1%) — אבל על פני 30 שנה זה הופך לעשרות אלפי שקלים.',
        tip: 'אם אתה משלם יותר מ-0.5% — שווה לדבר עם גדי.',
      },
    ],
  },

  // ============================================================
  // SIMULATOR
  // ============================================================
  simulator: {
    name: 'סימולטור פיננסי',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'בדוק לפני שתחליט',
        body: 'מתכנן לקחת הלוואה? משכנתא? לחסוך לרכב חדש? כאן אתה ממלא את הפרמטרים — ואני מחשב לך הכל.',
        tip: 'אין שום סיכון. שום דבר לא נשמר ולא מבוצע. רק חישוב.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"סימולטור פיננסי" — מחשבון חכם לתכנון מראש.',
      },
      {
        id: 'form',
        selector: '[data-tour="sim-form"]',
        placement: 'left',
        title: 'הטופס',
        body: 'בחר סוג חישוב (הלוואה / משכנתא / חיסכון), ומלא את השדות: סכום, ריבית, מספר חודשים. לא בטוח? תכניס מספר משוער ותראה מה יוצא.',
      },
      {
        id: 'results',
        selector: '[data-tour="sim-results"]',
        placement: 'left',
        title: 'התוצאות',
        body: 'אחרי החישוב — תראה כאן את המספרים החשובים: החזר חודשי, סך הריבית, וגרף שמראה איך זה מתפזר על פני הזמן.',
      },
      {
        id: 'save-as-goal',
        selector: '[data-tour="sim-save"]',
        placement: 'top',
        title: 'שמור כיעד',
        body: 'אהבת את התוצאה? לחץ על הכפתור הזה. החישוב הופך ליעד פעיל בדשבורד שלך — עם פס התקדמות שמתעדכן לבד.',
      },
    ],
  },

  // ============================================================
  // SCAN CENTER
  // ============================================================
  'scan-center': {
    name: 'מרכז העלאת מסמכים',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'מקום אחד לכל המסמכים',
        body: 'דוחות בנק, תלושי משכורת, הצעות ביטוח, דוחות השקעה. כל מסמך פיננסי PDF — לכאן.',
        tip: 'הכי קל זה לשלוח לבוט בוואטסאפ. אבל גם פה זה עובד מצוין.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"מרכז סריקה" — איפה שכל המסמכים שלך עוברים בדרך לניתוח.',
      },
      {
        id: 'hint',
        selector: '[data-tour="scan-hint"]',
        placement: 'bottom',
        title: 'התחל מדוח עו"ש',
        body: 'הכרטיס הזה — טיפ חשוב לפעם הראשונה. הדוח הראשון שכדאי להעלות זה דוח עו"ש מהבנק, 3 חודשים אחרונים.',
      },
      {
        id: 'dropzone',
        selector: '[data-tour="scan-dropzone"]',
        placement: 'top',
        title: 'איפה מעלים',
        body: 'במלבן הגדול: גרור קובץ PDF מהמחשב — או לחץ על המלבן ובחר קובץ ידנית. שתי דרכים, אותה תוצאה.',
        tip: 'אני מזהה לבד את סוג המסמך והחודש. אתה לא צריך להגיד לי.',
      },
      {
        id: 'status',
        selector: '[data-tour="scan-status"]',
        placement: 'top',
        title: 'היסטוריית העלאות',
        body: 'הכרטיס הזה מראה את כל המסמכים שכבר העלית — מה עובד עכשיו ומה כבר עובד מסווג. אפשר לראות סטטוס לכל אחד.',
      },
    ],
  },

  // ============================================================
  // MISSING DOCUMENTS
  // ============================================================
  'missing-documents': {
    name: 'מסמכים חסרים',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'מה עוד חסר',
        body: 'במסך הזה אני מראה לך מה אני עוד צריך כדי לתת לך תמונה פיננסית מלאה.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: 'בראש המסך — "מסמכים חסרים" עם המספר הכולל. אל תיבהל מהמספר — זה רק מה שיהיה נחמד שיהיה.',
      },
      {
        id: 'progress',
        selector: '[data-tour="docs-progress"]',
        placement: 'bottom',
        title: 'פס התקדמות',
        body: 'הפס הזה מראה לך כמה מסמכים כבר העלית מתוך הסך הכולל. ככל שהוא יותר מלא — התמונה הפיננסית שלך יותר ברורה.',
      },
      {
        id: 'filter',
        selector: '[data-tour="docs-filter"]',
        placement: 'bottom',
        title: 'סינון',
        body: 'אפשר לסנן מה לראות — רק דוחות בנק, רק תלושים, וכו\'. הכל = הצג הכל. נוח אם הרשימה ארוכה.',
      },
      {
        id: 'no-pressure',
        selector: null,
        placement: 'center',
        title: 'אין לחץ',
        body: 'אין דדליין. תעלה מסמכים בקצב שנוח לך. אם אין לך — דלג. אני אעבוד עם מה שיש.',
      },
    ],
  },

  // ============================================================
  // REPORTS
  // ============================================================
  reports: {
    name: 'דוחות',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'דוחות מפורטים',
        body: 'במסך הזה — כל הדוחות שאני מכין לך אוטומטית. תזרים מזומנים, השוואה שנתית, פילוח הוצאות, ועוד.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"דוחות" — כאן הם מתאספים. כל סוג דוח ייפתח בלחיצה אחת.',
      },
      {
        id: 'grid',
        selector: '[data-tour="reports-grid"]',
        placement: 'top',
        title: 'הכרטיסים',
        body: 'כל "כרטיס" במסך = סוג דוח אחד. לחיצה על כרטיס פותחת את הדוח המלא עם גרפים ומספרים.',
      },
      {
        id: 'cashflow',
        selector: '[data-tour="reports-cashflow"]',
        placement: 'bottom',
        title: 'תזרים מזומנים',
        body: 'הדוח הזה — הכי חשוב. הוא מראה לך לאורך החודשים מתי נכנס כסף ומתי יוצא. אם יש "פערים" — תראה את זה כאן.',
        tip: 'תזרים זה לא מצב — זה הזרימה לאורך זמן. הסוד של ניהול פיננסי בריא.',
      },
      {
        id: 'export',
        selector: null,
        placement: 'center',
        title: 'הורדה כקובץ',
        body: 'בכל דוח יש כפתור "הורד" — זה יוצר קובץ PDF או Excel מסודר, מתאים להעביר לרואה החשבון.',
      },
    ],
  },

  // ============================================================
  // SETTINGS
  // ============================================================
  settings: {
    name: 'הגדרות',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'השליטה אצלך',
        body: 'במסך הזה: פרופיל אישי, התראות, חיבור וואטסאפ, פרטיות, ייצוא נתונים, ומחיקת חשבון.',
      },
      {
        id: 'header',
        selector: '[data-tour="page-header"]',
        placement: 'bottom',
        title: 'הכותרת',
        body: '"הגדרות" — כל מה שקשור לחשבון שלך.',
      },
      {
        id: 'tabs',
        selector: '[data-tour="settings-tabs"]',
        placement: 'left',
        title: 'התפריט בצד',
        body: 'בצד יש 5 לשוניות: פרופיל, וואטסאפ, התראות, מנוי, פרטיות. לחיצה על כל לשונית מחליפה את התוכן בצד השני.',
        tip: 'בתחתית התפריט — כפתור "התנתק". אדום, כי זה כפתור עם משמעות.',
      },
      {
        id: 'content',
        selector: '[data-tour="settings-content"]',
        placement: 'right',
        title: 'אזור התוכן',
        body: 'באזור הגדול תראה את ההגדרות של הלשונית שבחרת. בפעם הראשונה אתה רואה "פרופיל אישי" — שם, מייל, טלפון, תאריך לידה.',
      },
      {
        id: 'save',
        selector: null,
        placement: 'center',
        title: 'אחרי שינוי — תמיד "שמור"',
        body: 'בכל לשונית, כשאתה משנה משהו — תחפש את כפתור "שמור" הכחול בתחתית. שינוי בלי לחיצה על "שמור" = לא נשמר.',
        tip: 'זה בטוח. אי אפשר לעשות שינוי בטעות שלא ניתן לבטל.',
      },
      {
        id: 'export-delete',
        selector: null,
        placement: 'center',
        title: 'ייצוא ומחיקה',
        body: 'בלשונית "פרטיות" יש כפתור "ייצוא נתונים" (מוריד הכל לאקסל) ו"מחיקת חשבון" (אדום — דורש אישור כפול).',
        tip: 'הנתונים שלך — שלך. בכל רגע אתה חופשי לקחת אותם או למחוק.',
      },
    ],
  },
}

export const tourStorageKey = (tourId: TourId) => `phi-tour-${tourId}`
export const tourSeenKey = (tourId: TourId) => `phi-tour-seen-${tourId}`
