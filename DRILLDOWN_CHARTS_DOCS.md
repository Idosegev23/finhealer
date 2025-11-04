# 📊 גרפי עוגה אינטראקטיביים עם Drill-Down

## סקירה כללית

מערכת גרפים אינטראקטיבית שמאפשרת למשתמשים לחקור את הנתונים הפיננסיים שלהם בצורה היררכית וויזואלית.

## תכונות עיקריות

### 🎯 גרפי Drill-Down
- **לחיצה על פרוסה** - כל פרוסה בגרף עוגה ניתנת ללחיצה וצוללת לרמת פירוט הבאה
- **Breadcrumbs** - ניווט חזרה דרך שביל מסלול (breadcrumb trail)
- **אנימציות חלקות** - מעברים רכים בין רמות באמצעות Framer Motion
- **תמיכה בעברית** - כל התוכן והניווט בעברית

### 📈 3 גרפים עיקריים

#### 1. גרף הוצאות (ExpensesDrilldownChart)
**היררכיה:**
1. **רמה 1**: אמצעי תשלום (אשראי, מזומן, העברה בנקאית וכו')
2. **רמה 2**: סוג הוצאה (קבועות/משתנות)
3. **רמה 3**: קטגוריות (מזון, דלק, בילויים וכו')
4. **רמה 4**: תנועות ספציפיות (פירוט מלא)

#### 2. גרף הכנסות (IncomeDrilldownChart)
**היררכיה:**
1. **רמה 1**: סוג מקור הכנסה (משכורת, עצמאי, פנסיה וכו')
2. **רמה 2**: מקורות ספציפיים (שמות מעסיקים, פרויקטים וכו')

#### 3. גרף נכסים וחובות (AssetsLiabilitiesDrilldownChart)
**היררכיה:**
1. **רמה 1**: נכסים מול חובות (עם חישוב שווי נטו)
2. **רמה 2**: תת-קטגוריות:
   - נכסים: חיסכון, פנסיה, חשבונות בנק, השקעות
   - חובות: משכנתא, הלוואות אישיות, אשראי וכו'
3. **רמה 3**: פירוט ספציפי (שמות בנקים, חברות פנסיה, מלווים)

## מבנה קבצים

### קומפוננטות (Components)
```
components/dashboard/
├── DrilldownPieChart.tsx              # קומפוננטה בסיסית לגרף drill-down
├── ExpensesDrilldownChart.tsx         # גרף הוצאות
├── IncomeDrilldownChart.tsx           # גרף הכנסות
└── AssetsLiabilitiesDrilldownChart.tsx # גרף נכסים וחובות
```

### API Endpoints
```
app/api/dashboard/
├── expenses-hierarchy/route.ts         # נתוני הוצאות בכל רמה
├── income-hierarchy/route.ts           # נתוני הכנסות בכל רמה
└── assets-liabilities-hierarchy/route.ts # נתוני נכסים וחובות
```

## שימוש בדשבורד

הגרפים מוצגים בדשבורד הראשי (`app/dashboard/page.tsx`):

```tsx
<div className="mb-8 space-y-6">
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <ExpensesDrilldownChart />
    <IncomeDrilldownChart />
  </div>
  
  <div className="w-full">
    <AssetsLiabilitiesDrilldownChart />
  </div>
</div>
```

## API Structure

### פורמט בקשה (Request)
```
GET /api/dashboard/expenses-hierarchy?level=2&payment_method=credit_card
```

**פרמטרים:**
- `level`: מספר רמה (1-4)
- `payment_method`: אמצעי תשלום (לרמה 2+)
- `expense_type`: סוג הוצאה (לרמה 3+)
- `category`: קטגוריה (לרמה 4)

### פורמט תגובה (Response)
```json
[
  {
    "name": "שם הפריט",
    "value": 5000,
    "metadata": {
      "payment_method": "credit_card",
      "expense_type": "variable"
    },
    "color": "#3A7BD5",
    "description": "תיאור נוסף"
  }
]
```

## טכנולוגיות

- **Recharts** - ספריית גרפים ל-React
- **Framer Motion** - אנימציות וטרנזישנים
- **Supabase** - שאילתות נתונים
- **TypeScript** - type safety
- **Next.js 14** - App Router & Server Components

## UX/UI Features

### 🎨 עיצוב
- **צבעים דינמיים** - כל קטגוריה עם צבע ייחודי
- **Tooltips אינפורמטיביים** - הצגת סכומים מדויקים
- **Legend אינטראקטיבי** - אחוזים מעודכנים
- **Responsive** - עובד מצוין במובייל ובדסקטופ

### 💡 תכונות חוויית משתמש
- **Empty States** - מסרים ידידותיים כשאין נתונים
- **Loading States** - אנימציות טעינה חלקות
- **Error Handling** - טיפול בשגיאות עם הודעות ברורות
- **הנחיות** - הודעה "לחץ על פרוסה לפירוט" בכל רמה

## דוגמת שימוש מתקדמת

### יצירת גרף drill-down חדש

```tsx
import { DrilldownPieChart } from '@/components/dashboard/DrilldownPieChart';

const MyCustomChart = () => {
  const [data, setData] = useState([]);
  
  const handleDrilldown = async (item, level) => {
    // Fetch next level data
    const response = await fetch(`/api/my-endpoint?level=${level + 1}`);
    return await response.json();
  };
  
  return (
    <DrilldownPieChart
      title="הגרף שלי"
      description="תיאור קצר"
      initialData={data}
      onSliceClick={handleDrilldown}
    />
  );
};
```

## ביצועים

- **Lazy Loading** - נתונים נטענים רק כשמשתמש צולל לרמה
- **Caching** - שימוש בסטייט מקומי למניעת טעינות כפולות
- **Optimistic UI** - אנימציות מהירות לפני טעינת נתונים

## בעיות ידועות ושיפורים עתידיים

### ✅ מוכן
- [x] גרפי drill-down בסיסיים
- [x] 3 גרפים עיקריים
- [x] Breadcrumbs וניווט
- [x] אנימציות חלקות
- [x] תמיכה מלאה בעברית

### 🔄 בתהליך
- [ ] Export ל-PDF/Excel
- [ ] השוואה בין תקופות
- [ ] פילטרים מתקדמים (תאריכים, סכומים)

### 💡 רעיונות לעתיד
- [ ] גרפי drill-down נוספים (תקציב, יעדים)
- [ ] שיתוף גרפים
- [ ] התראות על חריגות
- [ ] AI insights בכל רמה

## תחזוקה

### הוספת רמה חדשה
1. עדכן את ה-API endpoint להחזיר נתונים לרמה החדשה
2. הוסף לוגיקה ב-`handleSliceClick` של הקומפוננטה
3. וודא שה-metadata עוברת נכון בין רמות

### הוספת גרף חדש
1. צור API endpoint חדש ב-`app/api/dashboard/`
2. צור קומפוננטה חדשה שמשתמשת ב-`DrilldownPieChart`
3. הוסף לדשבורד הראשי

## תמיכה

לשאלות או בעיות, צור issue או פנה למפתחים.

---

**נוצר**: נובמבר 2025  
**גרסה**: 1.0.0  
**מפתחים**: FinHealer Team


