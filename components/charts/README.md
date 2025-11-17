# 📊 Phi Charts - Enhanced Pie Charts

## 🎨 עיצוב חדש ומודרני

### פלטת צבעים בולטת
השתמשנו בפלטת צבעים תוססת ובולטת שמבליטה כל קטגוריה:

```javascript
const PHI_COLORS = [
  '#FF6B6B', // אדום תוסס
  '#4ECDC4', // טורקיז בהיר
  '#FFD93D', // צהוב זהב
  '#6BCF7F', // ירוק עז
  '#A17FE0', // סגול רך
  '#FF8C42', // כתום חם
  '#45B7D1', // כחול שמיים
  '#F78CA2', // ורוד
  '#95E1D3', // מנטה
  '#F3A683', // אפרסק
  '#786FA6', // סגול עמוק
  '#F8B500', // צהוב זהוב
]
```

### 🎬 אנימציות חלקות

#### מעברים בין רמות (DrilldownPieChart)
- **משך אנימציה**: 500ms (במקום 200ms)
- **Easing**: `[0.4, 0, 0.2, 1]` - cubic bezier לחלקות מקסימלית
- **אפקטים**: scale, opacity, y-axis movement
- **אנימציית פאי**: 800ms עם easing חלק

```typescript
transition={{ 
  duration: 0.5,
  ease: [0.4, 0, 0.2, 1] // Cubic bezier for smooth easing
}}
```

#### אפקטי Hover
- **Shadow**: `drop-shadow(0 2px 4px rgba(0,0,0,0.1))`
- **Opacity**: hover עם opacity 90%
- **Transition**: 300ms duration

## 🧩 קומפוננטות

### 1. DrilldownPieChart
תרשים פאי עם יכולת drilldown - לחיצה על פרוסה מציגה פירוט מפורט יותר.

**שיפורים:**
- ✅ צבעים בולטים ותוססים
- ✅ אנימציות חלקות ורכות
- ✅ מעבר חלק בין רמות (ללא טעינה)
- ✅ Breadcrumbs לניווט
- ✅ אפקטי hover משופרים

### 2. PhiPieChart
תרשים פאי בסיסי עם עיצוב Phi.

**תכונות:**
- ✅ אותה פלטת צבעים
- ✅ אנימציות 800ms
- ✅ תמיכה ב-donut chart (innerRadius)
- ✅ סה"כ מוצג למטה

### 3. DashboardCharts
תרשימי דשבורד (פאי, קו, עמודות).

**שיפורים:**
- ✅ צבעים משופרים
- ✅ אנימציות חלקות
- ✅ donut chart עם innerRadius
- ✅ shadows ואפקטים

## 🎯 חוויית משתמש

### עקרונות העיצוב
1. **צבעים בולטים** - כל קטגוריה בולטת ומזוהה בקלות
2. **מעברים חלקים** - אין קפיצות או טעינות פתאומיות
3. **פידבק ויזואלי** - hover effects, shadows, transitions
4. **נגישות** - ניגודיות טובה, תוויות ברורות

### טיפים לשימוש
- **DrilldownPieChart**: השתמש כשיש היררכיה של נתונים (קטגוריה → תת-קטגוריות)
- **PhiPieChart**: השתמש לתצוגה פשוטה של פילוח
- **DashboardCharts**: משלב מספר תרשימים בדשבורד

## 🚀 דוגמת שימוש

```tsx
import { DrilldownPieChart } from '@/components/dashboard/DrilldownPieChart';

const data = [
  { 
    name: 'מזון', 
    value: 3000,
    children: [
      { name: 'סופרמרקט', value: 2000 },
      { name: 'מסעדות', value: 1000 }
    ]
  },
  { name: 'בילויים', value: 1500 },
  { name: 'תחבורה', value: 800 }
];

<DrilldownPieChart
  title="פילוח הוצאות"
  description="לחץ על פרוסה לפירוט נוסף"
  initialData={data}
/>
```

## 📐 מפרט טכני

### אנימציות
- **Framer Motion**: AnimatePresence עם mode="wait"
- **Recharts**: animationDuration, animationEasing
- **CSS Transitions**: 300ms לhover effects

### ביצועים
- ✅ אנימציות מואצות בGPU (scale, opacity, transform)
- ✅ ללא re-renders מיותרים
- ✅ Responsive Container

### תאימות
- ✅ Mobile responsive
- ✅ Dark mode support
- ✅ RTL support (עברית)
