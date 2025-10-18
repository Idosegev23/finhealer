import { Metadata } from "next";
import { 
  Target, 
  TrendingUp, 
  PiggyBank, 
  Receipt, 
  Shield, 
  Lightbulb,
  BarChart3
} from "lucide-react";

export const metadata: Metadata = {
  title: "מדריך | FinHealer",
  description: "מדריך מפורט לשיפור המצב הפיננסי שלך",
};

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  why: string;
  how: string[];
  example?: string;
  tips?: string[];
  pros?: string[];
  cons?: string[];
}

const guideSections: GuideSection[] = [
  {
    id: "reflection",
    title: "שיקוף - הבנת העבר",
    icon: BarChart3,
    description: "תהליך שיקוף הוא המפתח להבנת דפוסי ההוצאה שלך. על ידי ניתוח 3-6 החודשים האחרונים, אנחנו יכולים לזהות לאן הכסף שלך באמת הולך.",
    why: "למה זה חשוב? כי רוב האנשים לא באמת יודעים לאן הכסף שלהם הולך. שיקוף נותן לך תמונת מצב אמיתית ללא שיפוטיות - רק עובדות.",
    how: [
      "אסוף דפי חשבון בנק של 3-6 חודשים אחרונים",
      "חלק את ההוצאות לקטגוריות: דיור, תחבורה, אוכל, בילויים וכו'",
      "חשב ממוצע חודשי לכל קטגוריה",
      "זהה קטגוריות שמפתיעות אותך (הוצאה גבוהה מהצפוי)",
    ],
    example: "לדוגמה: אם ראית שהוצאת בממוצע 1,200 ₪ על בילויים בחודש, זה לא שיפוט - זה רק מידע. עכשיו אתה יכול להחליט אם זה בסדר עבורך או שאתה רוצה לשנות משהו.",
    tips: [
      "השתמש בממשק הדיגיטלי של הבנק - זה מקל על החישובים",
      "אל תתבייש - כולנו מוציאים על דברים שלא מתוכננים",
      "שיקוף הוא נקודת התחלה, לא גזר דין",
    ],
  },
  {
    id: "habits",
    title: "שינוי הרגלים - הצעד הבא",
    icon: TrendingUp,
    description: "אחרי שמבינים את העבר, זה הזמן ליצור הרגלים חדשים. הרגלים פיננסיים טובים הם כמו שרירים - צריך לאמן אותם.",
    why: "למה זה עובד? כי שינוי הדרגתי מתקיים יותר משינוי דרסטי. במקום 'דיאטה פיננסית', אנחנו בונים אורח חיים בר-קיימא.",
    how: [
      "התחל קטן: בחר הרגל אחד לשבועיים",
      "הגדר טריגר: 'כל בוקר לפני הקפה, אני רושם הוצאות של אתמול'",
      "עקוב אחרי התקדמות - גם כשלונות הם חלק מהתהליך",
      "תן לעצמך גמול על הצלחות קטנות",
    ],
    example: "הרגל דוגמה: 'הכלל של 24 שעות' - לפני כל קנייה מעל 200 ₪, מחכים 24 שעות. לרוב תגלו שאחרי יום הרצון יעבור.",
    tips: [
      "אפליקציה טובה עוזרת - היא מזכירה לך ומעודדת",
      "שתף מישהו - אחריותיות חברתית עובדת",
      "תעד ניצחונות קטנים - זה מחזק מוטיבציה",
    ],
  },
  {
    id: "consolidation",
    title: "איחוד הלוואות - פתרון חכם",
    icon: PiggyBank,
    description: "איחוד הלוואות זה לקחת כמה הלוואות קיימות (במיוחד עם ריבית גבוהה) ולאחד אותן להלוואה אחת עם ריבית נמוכה יותר.",
    why: "למה זה כדאי? כי ריביות על הלוואות קטנות (כמו משיכת יתר, כרטיסי אשראי) יכולות להגיע ל-15-20% בשנה. הלוואה מאוחדת יכולה לרדת ל-5-8%.",
    how: [
      "רשום את כל ההלוואות שיש לך: סכום, ריבית, תשלום חודשי",
      "בדוק בבנק או בחברות אשראי מה הריבית על הלוואה מאוחדת",
      "השתמש בסימולטור שלנו לחישוב החיסכון הפוטנציאלי",
      "שקול היטב - יש לקחת בחשבון עמלות ועלויות נוספות",
    ],
    pros: [
      "תשלום חודשי אחד במקום כמה - קל יותר לנהל",
      "חיסכון בריבית - לפעמים מדובר באלפי שקלים בשנה",
      "זמן החזר קצר יותר אם התשלום החודשי נשאר זהה",
    ],
    cons: [
      "עמלות פירעון מוקדם על הלוואות קיימות",
      "אם לא משנים הרגלים, יכולים לחזור לחובות",
      "צריך דיסציפלינה - לא לקחת הלוואות חדשות",
    ],
    example: "דוגמה: 3 הלוואות בסך 100,000 ₪ עם ריבית ממוצעת של 12% → הלוואה אחת בריבית 6% = חיסכון של כ-6,000 ₪ בשנה!",
  },
  {
    id: "budgeting",
    title: "קביעת תקציבים - אל תעבור את ההכנסה",
    icon: Receipt,
    description: "תקציב זה לא כלא - זה תכנית. כמו שמתכננים טיול, ככה צריך לתכנן את ההוצאות החודשיות.",
    why: "למה זה חשוב? כי 'הכנסה פחות הוצאות = חיסכון'. אם ההוצאות גבוהות מההכנסה, אין חיסכון - יש חוב.",
    how: [
      "התחל מההכנסה הנטו (אחרי מיסים)",
      "קבע תקציב קבוע: 50% הוצאות חיוניות, 30% אורח חיים, 20% חיסכון",
      "הוסף כרית ביטחון של 10% לבלתי צפוי",
      "עקוב בזמן אמת - אפליקציה תעזור",
    ],
    example: "הכנסה נטו: 10,000 ₪ → הוצאות חיוניות: 5,000 ₪ | אורח חיים: 3,000 ₪ | חיסכון: 2,000 ₪. פשוט וברור.",
    tips: [
      "התחל שמרני - קל להוסיף, קשה לגרוע",
      "הגדר התראות בזמן אמת כשמתקרבים לגבול",
      "תקציב הוא מסמך חי - מותר לעדכן אותו",
      "אל תשכח הוצאות חד-פעמיות (ביטוח שנתי, מתנות לחגים)",
    ],
  },
  {
    id: "goals",
    title: "יעדים ומטרות - למה אני חוסך?",
    icon: Target,
    description: "חיסכון ללא מטרה זה כמו לרוץ ללא קו סיום. יעדים נותנים משמעות ומוטיבציה.",
    why: "למה זה עובד? כי המוח שלנו אוהב יעדים ברורים. 'לחסוך 100,000 ₪ לקרן השתלמות של הבן שלי' זה הרבה יותר מוחשי מ'לחסוך כסף'.",
    how: [
      "הגדר יעד ספציפי: 'חיסכון של 30,000 ₪ לטיול משפחתי בעוד שנה'",
      "פרק אותו לחודשים: 30,000 ÷ 12 = 2,500 ₪ לחודש",
      "צור חשבון חיסכון נפרד ליעד",
      "עקוב אחרי progress bar - זה ממכר!",
    ],
    example: "יעד לדוגמה: 'קופת חירום' - 3 פעמים ההוצאות החודשיות שלך (אם אתה מוציא 8,000 ₪ בחודש → 24,000 ₪). זה נותן ביטחון אמיתי.",
    tips: [
      "התחל עם יעד קטן וקצר טווח - הצלחה מניעה",
      "שתף את המשפחה - זה יכול להיות פרויקט משותף",
      "חגוג אבני דרך - הגעת ל-25%? תן לעצמך משהו קטן",
      "השתמש בתמונות - תלה תמונה של היעד במקום בולט",
    ],
  },
  {
    id: "monitoring",
    title: "תוכנית בקרות - מעקב תקופתי",
    icon: Shield,
    description: "מעקב זה לא בקרה - זה דאגה. כמו שבודקים לחץ דם, ככה צריך לבדוק את הבריאות הפיננסית.",
    why: "למה זה קריטי? כי דברים משתנים. הכנסה עולה, ילד נולד, מכונית מתקלקלת. מעקב קבוע מאפשר התאמות בזמן.",
    how: [
      "שבועי: מבט מהיר על הוצאות (5 דקות)",
      "חודשי: סיכום מפורט + השוואה לתקציב (30 דקות)",
      "רבעוני: בדיקת יעדים ארוכי טווח (שעה)",
      "שנתי: תכנון מחדש מלא (יום שלם)",
    ],
    example: "מעקב חודשי: כל ראשון של החודש, תשב עם קפה ותראה: איפה חרגתי? למה? מה אני משנה החודש?",
    tips: [
      "קבע תאריך קבוע בלוח - תהפוך את זה להרגל",
      "השתמש באפליקציה עם תזכורות אוטומטיות",
      "אל תענש את עצמך על טעויות - למד מהן",
      "שתף את התוצאות עם בן/בת זוג - שקיפות חשובה",
    ],
  },
  {
    id: "insurance-pension",
    title: "ביטוחים ופנסיה - הביטחון לעתיד",
    icon: Lightbulb,
    description: "ביטוחים ופנסיה זה לא 'הוצאה' - זה השקעה בעתיד שלך ושל המשפחה שלך.",
    why: "למה זה הכרחי? כי לחיים יש פתעות. ביטוח חיים מגן על המשפחה, ביטוח בריאות חוסך עשרות אלפי שקלים, ופנסיה מבטיחה פרישה בכבוד.",
    how: [
      "עבור על כל הפוליסות שיש לך - מה מכוסה? מה לא?",
      "בדוק פערי כיסוי: יש לך ביטוח סיעודי? מחלות קשות?",
      "פנסיה: וודא שמפרישים לפחות 18.5% (17.5% פנסיה + 6% קרן השתלמות)",
      "דמי ניהול: ודא שלא משלם יותר מ-0.5% על חיסכון פנסיוני",
    ],
    example: "ביטוח בריאות משלים: עולה כ-200-300 ₪ בחודש, אבל יכול לחסוך 50,000-100,000 ₪ במקרה של ניתוח פרטי.",
    tips: [
      "השווה פוליסות - המחירים משתנים בין חברות",
      "עדכן את הביטוחים כשיש שינוי משמעותי (נישואין, ילד)",
      "דרוש מידע פשוט - אל תחתום על משהו שלא הבנת",
      "פנסיה: ככל שמתחילים מוקדם יותר, יותר ריבית דריבית עובדת לטובתך",
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1E2A3B] to-[#3A7BD5] text-white py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4 text-center">
            המדריך המלא לשיפור פיננסי
          </h1>
          <p className="text-lg text-center text-gray-200 max-w-2xl mx-auto">
            כל מה שצריך לדעת כדי לקחת שליטה על הכסף שלך ולבנות עתיד פיננסי יציב
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Intro */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-12">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">
            ברוכים הבאים למסע השיפור הפיננסי שלכם
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            המדריך הזה נבנה מתוך ניסיון של אלפי משפחות שעברו את התהליך. הוא מחולק ל-7 נושאים עיקריים,
            כל אחד עם הסברים מעשיים, דוגמאות אמיתיות וטיפים שעובדים.
          </p>
          <p className="text-gray-700 leading-relaxed">
            <strong>טיפ חשוב:</strong> אל תנסו לעשות הכל בבת אחת. קראו, הפנימו, ובחרו נושא אחד להתחיל בו.
            הצלחה קטנה יוצרת מומנטום להצלחה גדולה יותר.
          </p>
        </div>

        {/* Guide Sections */}
        <div className="space-y-8">
          {guideSections.map((section, index) => {
            const Icon = section.icon;
            return (
              <div
                key={section.id}
                className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Section Header */}
                <div className="bg-gradient-to-r from-[#3A7BD5] to-[#5A8BE5] text-white p-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <Icon className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{section.title}</h3>
                      <p className="text-gray-100 mt-1">{section.description}</p>
                    </div>
                  </div>
                </div>

                {/* Section Content */}
                <div className="p-6 space-y-6">
                  {/* Why */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <span className="text-[#3A7BD5]">●</span>
                      למה זה חשוב?
                    </h4>
                    <p className="text-gray-700 leading-relaxed">{section.why}</p>
                  </div>

                  {/* How */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-[#3A7BD5]">●</span>
                      איך עושים את זה?
                    </h4>
                    <ol className="space-y-2 mr-4">
                      {section.how.map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-[#3A7BD5] text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {i + 1}
                          </span>
                          <span className="text-gray-700 leading-relaxed pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Example */}
                  {section.example && (
                    <div className="bg-green-50 border-r-4 border-green-500 p-4 rounded">
                      <h4 className="text-lg font-semibold text-green-900 mb-2">
                        💡 דוגמה
                      </h4>
                      <p className="text-green-800 leading-relaxed">{section.example}</p>
                    </div>
                  )}

                  {/* Pros & Cons */}
                  {(section.pros || section.cons) && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {section.pros && (
                        <div className="bg-green-50 p-4 rounded-lg">
                          <h4 className="text-lg font-semibold text-green-900 mb-3">
                            ✅ יתרונות
                          </h4>
                          <ul className="space-y-2">
                            {section.pros.map((pro, i) => (
                              <li key={i} className="text-green-800 text-sm flex gap-2">
                                <span>•</span>
                                <span>{pro}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {section.cons && (
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <h4 className="text-lg font-semibold text-orange-900 mb-3">
                            ⚠️ חסרונות
                          </h4>
                          <ul className="space-y-2">
                            {section.cons.map((con, i) => (
                              <li key={i} className="text-orange-800 text-sm flex gap-2">
                                <span>•</span>
                                <span>{con}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tips */}
                  {section.tips && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold text-blue-900 mb-3">
                        💎 טיפים מעשיים
                      </h4>
                      <ul className="space-y-2">
                        {section.tips.map((tip, i) => (
                          <li key={i} className="text-blue-800 text-sm flex gap-2">
                            <span className="text-blue-500">★</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-[#7ED957] to-[#6BC949] text-white rounded-lg p-8 mt-12 text-center">
          <h2 className="text-2xl font-bold mb-4">מוכנים להתחיל?</h2>
          <p className="text-lg mb-6 max-w-2xl mx-auto">
            המדריך הזה הוא רק ההתחלה. המערכת שלנו תלווה אותך בכל צעד - עם תזכורות, תובנות והמלצות מותאמות אישית.
          </p>
          <a
            href="/dashboard"
            className="inline-block bg-white text-[#7ED957] font-bold px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
          >
            בואו נתחיל את המסע →
          </a>
        </div>
      </div>
    </div>
  );
}

