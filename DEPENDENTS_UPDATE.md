# עדכון: מערכת תלויים (ילדים ונכדים) ✅

## מה עשינו

### 1️⃣ יצירת טבלת `dependents` במסד הנתונים

**טבלה חדשה:** `public.dependents`

**עמודות:**
- `id` - UUID (מזהה ייחודי)
- `user_id` - UUID (קישור למשתמש)
- `name` - TEXT (שם מלא)
- `birth_date` - DATE (תאריך לידה)
- `gender` - TEXT (male/female/other)
- `relationship_type` - TEXT (child/grandchild)
- `is_financially_supported` - BOOLEAN (האם תומך כלכלית)
- `support_notes` - TEXT (הערות)
- `created_at`, `updated_at` - TIMESTAMPTZ

**אבטחה:**
- ✅ RLS מופעל
- ✅ משתמשים יכולים לראות רק את התלויים שלהם
- ✅ מדיניות SELECT, INSERT, UPDATE, DELETE

**פונקציות עזר:**
- `calculate_age(birth_date)` - חישוב גיל
- `update_dependents_updated_at()` - עדכון אוטומטי של updated_at

---

### 2️⃣ עדכון שלב 1 באונבורדינג

**קובץ:** `components/reflection/steps/Step1Personal.tsx`

**לוגיקה חדשה:**
1. **ילדים מתחת לגיל 18** - רשימה רגילה
2. **ילדים מעל גיל 18** - שאלה נוספת: "האם אתה תומך כלכלית?"
3. **נכדים (מעל גיל 60)** - מופיע רק למשתמשים מעל 60
   - גם נכדים מקבלים שאלה על תמיכה כלכלית

**שדות לכל תלוי:**
- שם מלא
- תאריך לידה (במקום גיל)
- מין (זכר/נקבה/אחר)
- האם תומך כלכלית (רק למעל 18 / נכדים)

**תכונות:**
- ✅ חישוב גיל אוטומטי מתאריך לידה
- ✅ ממשק דינמי - שדות משתנים לפי גיל המשתמש
- ✅ סיכום משפחה בתחתית
- ✅ UX נקי עם כפתורי הוסף/מחק

---

### 3️⃣ עדכון API

**קובץ:** `app/api/reflection/profile/route.ts`

**שינויים:**
- מפריד את `dependents` משאר הנתונים
- שומר dependents בטבלה נפרדת
- מחיקה ויצירה מחדש בכל עדכון (replace strategy)

**שליחה ל-API:**
```typescript
{
  ...profile,
  dependents: [
    {
      name: "יוסי כהן",
      birthDate: "2015-05-20",
      gender: "male",
      relationshipType: "child",
      isFinanciallySupported: false
    }
  ]
}
```

---

### 4️⃣ עדכון תיאורים באונבורדינג

**קובץ:** `components/onboarding/OnboardingSelector.tsx`

**שיפור:** תיאור מפורט יותר של "תמונת מצב 360°" עם רשימת כל הנתונים שנלקחים.

**כל 6 השלבים:** הוספנו קופסה כחולה "מה נלקח" שמציינת את המידע המדויק בכל שלב.

---

## שימוש

### דוגמה: קריאת תלויים של משתמש

```typescript
const { data: dependents } = await supabase
  .from('dependents')
  .select('*')
  .eq('user_id', userId);
```

### דוגמה: הוספת תלוי חדש

```typescript
const { data, error } = await supabase
  .from('dependents')
  .insert({
    user_id: userId,
    name: 'שרה כהן',
    birth_date: '2010-03-15',
    gender: 'female',
    relationship_type: 'child',
    is_financially_supported: false
  });
```

---

## בדיקות

- ✅ מיגרציה הושלמה בהצלחה
- ✅ טבלה נוצרה עם RLS
- ✅ אין שגיאות לינטר
- ✅ Security advisors: רק WARN קטנות (לא קריטי)

---

## המשך עבודה (אופציונלי)

1. **תצוגה בדשבורד** - להציג ילדים ונכדים בסקירה
2. **יעדים ספציפיים** - לקשר יעדים לילדים (כבר יש `child_name` ב-goals)
3. **הוצאות לפי תלוי** - מעקב הוצאות פר ילד
4. **דוחות** - ניתוח הוצאות משפחתיות

---

**נוצר ב:** ${new Date().toLocaleDateString('he-IL')}
**סטטוס:** ✅ מושלם ופעיל

