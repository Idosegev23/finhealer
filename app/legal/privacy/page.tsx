export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white p-8 max-w-4xl mx-auto" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">מדיניות פרטיות</h1>
      
      <div className="prose prose-lg">
        <p className="mb-4">עודכן לאחרונה: {new Date().toLocaleDateString('he-IL')}</p>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">1. כללי</h2>
          <p>
            FinHealer ("אנחנו", "שלנו") מחויבת להגן על פרטיותך. מדיניות פרטיות זו מסבירה
            כיצד אנו אוספים, משתמשים ומגנים על המידע האישי שלך.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">2. איסוף מידע</h2>
          <p>אנו אוספים את סוגי המידע הבאים:</p>
          <ul className="list-disc pr-6 mt-2">
            <li>מידע אישי: שם, כתובת אימייל, מספר טלפון</li>
            <li>מידע פיננסי: הכנסות, הוצאות, תקציבים, יעדים</li>
            <li>מידע טכני: כתובת IP, סוג דפדפן, מכשיר</li>
            <li>נתוני שימוש: אינטראקציות עם השירות</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">3. שימוש במידע</h2>
          <p>אנו משתמשים במידע שלך כדי:</p>
          <ul className="list-disc pr-6 mt-2">
            <li>לספק ולשפר את השירות</li>
            <li>לנתח דפוסי הוצאה ולספק המלצות מותאמות אישית</li>
            <li>לשלוח התראות והודעות רלוונטיות (ב-WhatsApp או אימייל)</li>
            <li>לתמוך בך ולענות על שאלות</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">4. אבטחת מידע</h2>
          <p>
            אנו נוקטים באמצעי אבטחה מתקדמים כדי להגן על המידע שלך, כולל הצפנה,
            גישה מוגבלת, ומערכות ניטור. כל המידע הפיננסי שלך מוצפן ומאובטח.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">5. שיתוף מידע</h2>
          <p>
            אנו לא משתפים את המידע האישי שלך עם צדדים שלישיים למטרות שיווקיות.
            אנו עשויים לשתף מידע רק:
          </p>
          <ul className="list-disc pr-6 mt-2">
            <li>עם ספקי שירות שעוזרים לנו להפעיל את השירות</li>
            <li>כאשר נדרש על פי חוק</li>
            <li>כדי להגן על זכויותינו או בטחונך</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">6. זכויותיך</h2>
          <p>יש לך זכות:</p>
          <ul className="list-disc pr-6 mt-2">
            <li>לגשת למידע שלך ולבקש עותק ממנו</li>
            <li>לתקן מידע לא מדויק</li>
            <li>למחוק את חשבונך ואת כל המידע</li>
            <li>להתנגד לעיבוד מידע מסוים</li>
            <li>לייצא את הנתונים שלך</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">7. שימוש ב-WhatsApp</h2>
          <p>
            אם בחרת לקבל הודעות ב-WhatsApp, אנו נשתמש במספר הטלפון שלך לשליחת
            התראות, סיכומים ותובנות פיננסיות. אתה יכול להפסיק לקבל הודעות בכל עת.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">8. עוגיות (Cookies)</h2>
          <p>
            אנו משתמשים בעוגיות כדי לשפר את חווית המשתמש, לנתח שימוש ולשמור על
            ההתחברות שלך. אתה יכול לנהל עוגיות דרך הגדרות הדפדפן.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">9. שינויים במדיניות</h2>
          <p>
            אנו עשויים לעדכן מדיניות זו מעת לעת. נודיע לך על שינויים משמעותיים
            באמצעות אימייל או הודעה בשירות.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">10. צור קשר</h2>
          <p>
            לשאלות או בקשות לגבי מדיניות הפרטיות, צור קשר:
            <br />
            אימייל: privacy@finhealer.com
            <br />
            טלפון: 054-766-7775
          </p>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t">
        <a href="/" className="text-primary hover:underline">
          ← חזרה לדף הבית
        </a>
      </div>
    </div>
  )
}

