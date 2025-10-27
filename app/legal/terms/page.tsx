export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white p-8 max-w-4xl mx-auto" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">תנאי שימוש</h1>
      
      <div className="prose prose-lg">
        <p className="mb-4">עודכן לאחרונה: {new Date().toLocaleDateString('he-IL')}</p>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">1. קבלת התנאים</h2>
          <p>
            ברוכים הבאים ל-FinHealer. על ידי גישה לשירות או שימוש בו, אתה מסכים
            לתנאים אלה. אם אינך מסכים לתנאים, אנא אל תשתמש בשירות.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">2. השירות</h2>
          <p>
            FinHealer הוא כלי לניהול פיננסי אישי המספק:
          </p>
          <ul className="list-disc pr-6 mt-2">
            <li>מעקב אחר הכנסות והוצאות</li>
            <li>ניהול תקציב ויעדים פיננסיים</li>
            <li>תובנות והמלצות מבוססות AI</li>
            <li>התראות והודעות ב-WhatsApp</li>
            <li>דוחות וניתוחים פיננסיים</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">3. אחריות המשתמש</h2>
          <p>אתה מתחייב:</p>
          <ul className="list-disc pr-6 mt-2">
            <li>לספק מידע נכון ומדויק</li>
            <li>לשמור על סודיות פרטי ההתחברות שלך</li>
            <li>לא להשתמש בשירות למטרות בלתי חוקיות</li>
            <li>לא לנסות לגשת למערכות או למידע של אחרים</li>
            <li>לעדכן מידע לא מדויק או מיושן</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">4. מגבלות האחריות</h2>
          <p>
            <strong>FinHealer הוא כלי לניהול פיננסי ולא ייעוץ פיננסי מקצועי.</strong>
          </p>
          <ul className="list-disc pr-6 mt-2">
            <li>אנו לא מספקים ייעוץ השקעות, מס או משפטי</li>
            <li>ההמלצות והתובנות הן כלליות ולא מותאמות אישית במלואן</li>
            <li>אתה אחראי לקבלת החלטות פיננסיות עצמאיות</li>
            <li>אנו לא אחראים להפסדים כספיים הנובעים משימוש בשירות</li>
            <li>מומלץ להתייעץ עם יועץ פיננסי מקצועי לפני החלטות משמעותיות</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">5. מנוי ותשלום</h2>
          <p>השירות מוצע במסגרת מנוי חודשי או שנתי:</p>
          <ul className="list-disc pr-6 mt-2">
            <li>התשלום מתבצע מראש עבור תקופת המנוי</li>
            <li>המנוי מתחדש אוטומטית אלא אם ביטלת</li>
            <li>ניתן לבטל בכל עת דרך הגדרות החשבון</li>
            <li>החזרים ניתנים בהתאם למדיניות ההחזרים שלנו</li>
            <li>המחירים עשויים להשתנות עם הודעה מראש</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">6. ביטול וסיום</h2>
          <p>
            אתה יכול לבטל את המנוי בכל עת. אנו שומרים את הזכות לסיים או להשעות
            את הגישה שלך אם:
          </p>
          <ul className="list-disc pr-6 mt-2">
            <li>הפרת תנאים אלה</li>
            <li>לא שילמת עבור השירות</li>
            <li>השתמשת בשירות באופן בלתי חוקי או לא הולם</li>
            <li>סיכנת את אבטחת המערכת או משתמשים אחרים</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">7. קניין רוחני</h2>
          <p>
            כל התוכן, העיצוב, הלוגו והטכנולוגיה של FinHealer הם קניין של החברה
            ומוגנים בזכויות יוצרים. אסור להעתיק, לשכפל או לעשות שימוש מסחרי ללא
            אישור מפורש.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">8. זמינות השירות</h2>
          <p>
            אנו שואפים לשמור על זמינות השירות 24/7, אך לא מתחייבים:
          </p>
          <ul className="list-disc pr-6 mt-2">
            <li>השירות עשוי להיות לא זמין לתחזוקה או שדרוגים</li>
            <li>אנו לא אחראים להפסקות שירות בגלל גורמים חיצוניים</li>
            <li>אנו שומרים את הזכות לשנות או להפסיק תכונות מסוימות</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">9. אבטחה</h2>
          <p>
            אנו נוקטים באמצעי אבטחה סבירים כדי להגן על המידע שלך, אך אף מערכת
            אינה בטוחה לחלוטין. אתה אחראי לשמור על אבטחת החשבון שלך.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">10. שינויים בתנאים</h2>
          <p>
            אנו שומרים את הזכות לשנות תנאים אלה בכל עת. שינויים משמעותיים יפורסמו
            באתר והודעה תישלח למשתמשים רשומים. המשך שימוש בשירות מהווה הסכמה לתנאים
            המעודכנים.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">11. דין ושיפוט</h2>
          <p>
            תנאים אלה כפופים לדיני מדינת ישראל. כל מחלוקת תידון בבתי המשפט
            המוסמכים בישראל.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">12. צור קשר</h2>
          <p>
            לשאלות או בקשות לגבי תנאי השימוש, צור קשר:
            <br />
            אימייל: support@finhealer.com
            <br />
            טלפון: 054-766-7775
          </p>
        </section>

        <section className="mb-6 p-4 bg-yellow-50 border-r-4 border-yellow-400">
          <p className="font-semibold">⚠️ הצהרה חשובה:</p>
          <p className="mt-2">
            FinHealer אינו מהווה תחליף לייעוץ פיננסי מקצועי. אנו ממליצים להתייעץ
            עם יועץ פיננסי, רואה חשבון או עורך דין לפני קבלת החלטות פיננסיות משמעותיות.
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

