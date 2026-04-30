// ============================================================================
// φ Guided Tour — definitions
// ----------------------------------------------------------------------------
// Each tour is a list of steps. A step targets a `data-tour="<id>"` element on
// the page and shows a friendly explanation next to it. If `selector` is null
// the step renders as a centered modal (great for intros / outros).
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

export const TOURS: Record<TourId, { name: string; steps: TourStep[] }> = {
  // -------- Onboarding intro (shown on first visit to /onboarding) ---------
  'onboarding-welcome': {
    name: 'הכרות מהירה',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'נעים להכיר 👋',
        body: 'אני φ — המאמן הפיננסי הדיגיטלי שלך. בשלוש דקות נסיים את ההגדרה ואצמד אליך בוואטסאפ.',
        tip: 'אפשר לדלג בכל רגע ולחזור מאוחר יותר.',
      },
      {
        id: 'progress',
        selector: '[data-tour="progress"]',
        placement: 'bottom',
        title: 'הסרגל הזה הוא המפה',
        body: 'בכל שלב תראה איפה אתה נמצא. אין לחץ — שום דבר לא נשמר עד שתאשר.',
      },
      {
        id: 'phone',
        selector: '[data-tour="phone-step"]',
        placement: 'top',
        title: 'למה אנחנו מבקשים טלפון?',
        body: 'הטלפון מחבר אותך לבוט WhatsApp שלנו — שם תעלה דוחות בנק, תקבל תובנות ותדבר עם φ.',
        tip: 'המספר נשמר מוצפן ולא נחשף לאף אחד.',
      },
    ],
  },

  // ----------------------- Main dashboard tour -----------------------------
  dashboard: {
    name: 'סיור בדשבורד',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'ברוך הבא לדשבורד שלך',
        body: 'כל המידע הפיננסי שלך במקום אחד. בוא נכיר את הרכיבים החשובים.',
      },
      {
        id: 'phi-score',
        selector: '[data-tour="phi-score"]',
        placement: 'left',
        title: 'ציון φ',
        body: 'מדד 0–100 של הבריאות הפיננסית שלך — מבוסס על 12 פרמטרים כמו יחס הכנסות-הוצאות, חיסכון וקרן חירום.',
        tip: 'הציון מתעדכן אוטומטית בכל פעם שאתה מעלה דוח חדש.',
      },
      {
        id: 'kpis',
        selector: '[data-tour="kpis"]',
        placement: 'bottom',
        title: 'הכנסות, הוצאות וחיסכון',
        body: 'התמונה החודשית שלך במבט מהיר. הצבעים מראים אם המגמה חיובית או שצריך לשים לב.',
      },
      {
        id: 'goals',
        selector: '[data-tour="goals"]',
        placement: 'top',
        title: 'היעדים שלך',
        body: 'קרן חירום, חיסכון לרכישה, החזר חוב — כל יעד מתקדם בעצמו על בסיס התנועות שלך.',
        cta: { label: 'הגדר יעד חדש', href: '/dashboard/goals' },
      },
      {
        id: 'sidebar',
        selector: '[data-tour="sidebar"]',
        placement: 'right',
        title: 'תפריט הניווט',
        body: 'מכאן תגיע לתקציב, להוצאות, להכנסות, להלוואות ועוד. כל אזור מקבל סיור משלו בפעם הראשונה שתיכנס.',
      },
      {
        id: 'whatsapp',
        selector: '[data-tour="whatsapp"]',
        placement: 'bottom',
        title: 'הקליק החשוב ביותר',
        body: 'כל פעולה אפשרית גם בוואטסאפ — שלח דוח, שאל שאלה, הוסף הוצאה. φ עונה תוך שניות.',
      },
    ],
  },

  // ------------------------- Budget feature --------------------------------
  budget: {
    name: 'איך עובד התקציב',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'התקציב שלך, חכם ופשוט',
        body: 'φ מציע לך תקציב שמתאים לדפוסי ההוצאה האמיתיים שלך — לא תבנית שרירותית.',
      },
      {
        id: 'categories',
        selector: '[data-tour="budget-categories"]',
        placement: 'left',
        title: 'קטגוריות',
        body: 'כל קטגוריה (סופר, דלק, יציאות) מקבלת תקציב מומלץ. אתה יכול לשנות אותו בכל רגע.',
      },
      {
        id: 'progress',
        selector: '[data-tour="budget-progress"]',
        placement: 'top',
        title: 'מד התקדמות',
        body: 'ירוק — בתוך התקציב. צהוב — מתקרב לקצה. אדום — חרגת. ההתראות יגיעו אליך לוואטסאפ.',
      },
    ],
  },

  // ------------------------- Goals feature ---------------------------------
  goals: {
    name: 'איך עובדים יעדים',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'יעד = מטרה ברורה + תאריך',
        body: 'במקום "לחסוך יותר" — נגדיר "10,000 ₪ עד דצמבר". φ ימצא לך כמה כדאי להפריש בכל חודש.',
      },
      {
        id: 'add-goal',
        selector: '[data-tour="goals-add"]',
        placement: 'bottom',
        title: 'הגדרת יעד',
        body: 'בחר סוג (חיסכון / רכישה / החזר חוב), הזן סכום ותאריך — וφ יראה לך מסלול ריאלי.',
      },
      {
        id: 'progress-bar',
        selector: '[data-tour="goals-progress"]',
        placement: 'top',
        title: 'מעקב אוטומטי',
        body: 'התקדמות היעד מתעדכנת מתוך התנועות שלך. אין צורך לעדכן ידנית.',
      },
    ],
  },

  // ------------------------- Loans / debt ----------------------------------
  loans: {
    name: 'ניהול הלוואות וחובות',
    steps: [
      {
        id: 'intro',
        selector: null,
        placement: 'center',
        title: 'לראות את כל החוב במקום אחד',
        body: 'ריבית, יתרה, החזר חודשי — לכל הלוואה. φ ידגיש את ההלוואה היקרה ביותר.',
      },
      {
        id: 'list',
        selector: '[data-tour="loans-list"]',
        placement: 'top',
        title: 'רשימת ההלוואות',
        body: 'כל שורה כוללת את היתרה, הריבית האפקטיבית והמסלול. ניתן לערוך או למחוק.',
      },
      {
        id: 'snowball',
        selector: '[data-tour="loans-strategy"]',
        placement: 'bottom',
        title: 'אסטרטגיית פירעון',
        body: 'φ ממליץ באיזה סדר לפרוע: הריבית הגבוהה קודם (Avalanche) או היתרה הקטנה קודם (Snowball).',
        tip: 'התובנה הזו לבד יכולה לחסוך אלפי שקלים בריבית.',
      },
    ],
  },
}

export const tourStorageKey = (tourId: TourId) => `phi-tour-${tourId}`
export const tourSeenKey = (tourId: TourId) => `phi-tour-seen-${tourId}`
