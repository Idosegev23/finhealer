# עדכון: שלב 2 - מערכת מקורות הכנסה מתקדמת ✅

## מה עשינו

### 1️⃣ יצירת טבלת `income_sources` במסד הנתונים

**טבלה חדשה:** `public.income_sources`

**עמודות:**

#### פרטי מקור
- `id` - UUID (מזהה ייחודי)
- `user_id` - UUID (קישור למשתמש)
- `source_name` - TEXT (שם מקור ההכנסה)
- `employment_type` - TEXT (סוג תעסוקה)

#### סכומים
- `gross_amount` - NUMERIC (ברוטו - לפני כל הניכויים)
- `net_amount` - NUMERIC (נטו משכורת - אחרי מס + ביטוח לאומי)
- `actual_bank_amount` - NUMERIC **⭐ החשוב ביותר!** (מה שבאמת נכנס לבנק)

#### ניכויים ומסים
- `tax_rate` - NUMERIC (אחוז מס)
- `pension_contribution` - NUMERIC (ניכוי פנסיה חודשי)
- `national_insurance` - NUMERIC (ביטוח לאומי)
- `health_tax` - NUMERIC (מס בריאות)
- `advanced_study_fund` - NUMERIC (קרן השתלמות)
- `other_deductions` - NUMERIC (קיזוזים אחרים)

#### פרטי שכיר
- `employer_name` - TEXT (שם המעסיק)
- `pension_fund_name` - TEXT (שם קרן הפנסיה)

#### פרטי עצמאי
- `business_expenses` - NUMERIC (הוצאות עסקיות)
- `vat_registered` - BOOLEAN (רשום במע"מ)

#### מטא-נתונים
- `payment_frequency` - TEXT (תדירות תשלום)
- `is_primary` - BOOLEAN (מקור הכנסה עיקרי)
- `active` - BOOLEAN (פעיל)
- `notes` - TEXT (הערות)
- `created_at`, `updated_at` - TIMESTAMPTZ

**סוגי תעסוקה:**
- 🏢 **employee** - שכיר
- 💼 **self_employed** - עצמאי
- 🎨 **freelance** - פרילנסר
- 🏪 **business** - עסק
- 🏠 **rental** - שכירות
- 📈 **investment** - השקעות
- 🏦 **pension** - פנסיה
- 📋 **other** - אחר

**אבטחה:**
- ✅ RLS מופעל
- ✅ משתמשים יכולים לראות רק את המקורות שלהם
- ✅ מדיניות SELECT, INSERT, UPDATE, DELETE

**View עזר:**
- `user_total_income` - סיכום אוטומטי של הכנסות לפי משתמש

---

### 2️⃣ שלב 2 משודרג לחלוטין!

**קובץ:** `components/reflection/steps/Step2Income.tsx`

#### תכונות חדשות:

**1. ריבוי מקורות הכנסה**
- ✅ אפשרות להוסיף מספר בלתי מוגבל של מקורות
- ✅ לכל מקור: שם, סוג תעסוקה, סכומים
- ✅ סימון מקור עיקרי

**2. 3 שדות סכום חשובים**

```
💼 ברוטו → 📄 נטו משכורת → 🏦 נכנס לבנק בפועל
```

- **ברוטו**: מה שרשום בחוזה העבודה
- **נטו משכורת**: מה שרשום בתלוש (אחרי מס + ביטוח לאומי)
- **נכנס לבנק בפועל** ⭐: מה שבאמת מגיע לחשבון!

**3. קיזוזים נוספים (לשכירים)**
- פנסיה
- קרן השתלמות (קה״ש)
- קיזוזים אחרים (הלוואות, ביטוחים, ארגון עובדים)

**4. פירוט אוטומטי**
המערכת מציגה אוטומטית:
- מס הכנסה + ביטוח לאומי
- קיזוזים נוספים מהתלוש
- סה״כ קיזוזים וניכויים

**5. סיכום חכם**
- סה״כ ברוטו
- סה״כ נטו משכורת
- **סה״כ נכנס לבנק** (הכי חשוב!)
- פירוט לפי סוג תעסוקה

---

### 3️⃣ למה זה חשוב?

#### לניתוח פנסיות:
- מעקב אחר ניכויי פנסיה מדויק
- הבנת תרומות מעסיק
- חישוב זכויות פנסיוניות עתידיות

#### להטבות מס:
- הבחנה בין שכיר לעצמאי
- מעקב קרן השתלמות
- חישובי החזר מס

#### לניהול תקציב:
- **הסכום שבאמת זמין** - נכנס לבנק בפועל
- לא "כסף על הנייר" - כסף אמיתי!
- בסיס נכון לתכנון תקציב

---

### 4️⃣ עדכון API

**קובץ:** `app/api/reflection/profile/route.ts`

**שינויים:**
- שמירת מקורות הכנסה בטבלה `income_sources`
- מחיקה ויצירה מחדש בכל עדכון
- שמירת כל השדות: ברוטו, נטו, נכנס לבנק, קיזוזים

**דוגמת שליחה:**
```typescript
{
  ...profile,
  incomeSources: [
    {
      sourceName: "משכורת ראשית",
      employmentType: "employee",
      grossAmount: 20000,
      netAmount: 14500,
      actualBankAmount: 12800,
      employerName: "חברת ABC",
      pensionContribution: 1200,
      advancedStudyFund: 500,
      isPrimary: true
    },
    {
      sourceName: "פרילנס",
      employmentType: "freelance",
      grossAmount: 5000,
      netAmount: 5000,
      actualBankAmount: 5000,
      isPrimary: false
    }
  ]
}
```

---

## UX ועיצוב

### ויזואלי
- 🎨 כל סוג תעסוקה עם צבע ואייקון ייחודיים
- 📊 חישובים אוטומטיים בזמן אמת
- ✅ סימון מקור עיקרי בולט
- 🏦 דגש על "נכנס לבנק בפועל"

### חווית משתמש
- הוספה/מחיקה קלה של מקורות
- הסברים ברורים לכל שדה
- פירוט הפרשים אוטומטי
- סיכום מקיף למטה

---

## דוגמאות שימוש

### קריאת מקורות הכנסה
```typescript
const { data: incomeSources } = await supabase
  .from('income_sources')
  .select('*')
  .eq('user_id', userId)
  .eq('active', true);
```

### סיכום הכנסות
```typescript
const { data: summary } = await supabase
  .from('user_total_income')
  .select('*')
  .eq('user_id', userId)
  .single();

// summary.total_gross - סה״כ ברוטו
// summary.total_net - סה״כ נטו
// summary.employee_income - הכנסה משכיר
// summary.self_employed_income - הכנסה מעצמאות
```

---

## מיגרציות שהורצו

1. ✅ `create_income_sources_table` - יצירת הטבלה
2. ✅ `add_actual_bank_amount_to_income_sources` - הוספת שדה actual_bank_amount

---

## בדיקות

- ✅ טבלה נוצרה עם RLS
- ✅ View `user_total_income` פעיל
- ✅ אין שגיאות לינטר
- ✅ API route משודרג
- ✅ FullReflectionWizard מעודכן

---

## המשך עבודה (אופציונלי)

1. **גרפים** - ויזואליזציה של הכנסות לפי מקור
2. **מעקב שינויים** - היסטוריית שינויים במשכורות
3. **תחזיות** - תחזית הכנסות עתידיות
4. **ייצוא תלושים** - קישור לתלושי שכר דיגיטליים
5. **התראות** - התראה על שינוי במשכורת

---

**נוצר ב:** ${new Date().toLocaleDateString('he-IL')}  
**סטטוס:** ✅ מושלם ופעיל  
**קריטי עבור:** פנסיות, הטבות מס, ניהול תקציב מדויק

