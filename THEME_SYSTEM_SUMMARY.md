# 🌙☀️ מערכת מצב לילה/יום - Dark/Light Mode

## ✅ מה הוספנו:

### 1. **Theme Context Provider** 🎨
```tsx
// contexts/ThemeContext.tsx
- ניהול מצב הנושא (dark/light)
- toggleTheme() - החלפת מצב
- שמירה ב-localStorage
- מניעת flash בטעינה
```

### 2. **Theme Toggle Button** 🔘
```tsx
// components/ui/theme-toggle.tsx
- כפתור עם אייקון שמש/ירח
- אנימציה חלקה
- תמיכה מלאה ב-accessibility
```

### 3. **CSS Variables** 🎨
```css
:root {
  --bg-dashboard: #f5f6f8;  /* Light */
  --bg-card: #ffffff;
  --text-primary: #1e2a3b;
}

.dark {
  --bg-dashboard: #1e1e1e;  /* Dark */
  --bg-card: #171717;
  --text-primary: #ffffff;
}
```

---

## 🎯 איך זה עובד:

### 1. **ThemeProvider** מעטף את כל האפליקציה:
```tsx
// app/layout.tsx
<ThemeProvider>
  {children}
</ThemeProvider>
```

### 2. **useTheme Hook** בכל קומפוננטה:
```tsx
const { theme, toggleTheme } = useTheme();
const isDark = theme === 'dark';
```

### 3. **CSS Classes דינמיות**:
```tsx
<div className={`
  ${isDark ? 'bg-card-dark text-white' : 'bg-white text-gray-900'}
`}>
```

---

## 🎨 משתנים גלובליים:

| משתנה | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--bg-dashboard` | #f5f6f8 | #1e1e1e |
| `--bg-card` | #ffffff | #171717 |
| `--bg-card-hover` | #f9fafb | #1f1f1f |
| `--text-primary` | #1e2a3b | #ffffff |
| `--text-secondary` | #555555 | #9ca3af |
| `--text-tertiary` | #888888 | #6b7280 |
| `--border-color` | #e5e7eb | #1f2937 |
| `--border-color-strong` | #d1d5db | #374151 |

---

## 📦 קבצים חדשים:

1. ✅ `contexts/ThemeContext.tsx` - Context Provider
2. ✅ `components/ui/theme-toggle.tsx` - כפתור החלפה
3. ✅ `app/globals.css` - משתני CSS

---

## 🔧 קבצים שעודכנו:

1. ✅ `app/layout.tsx` - הוספת ThemeProvider
2. ✅ `app/dashboard/page.tsx` - הוספת ThemeToggle בheader
3. ✅ `components/shared/DashboardNav.tsx` - תמיכה בשני מצבים

---

## 🎯 איפה הכפתור:

```
┌──────────────────────────────────────┐
│  FinHealer    [🌙/☀️] [🔔] [⚙️]     │ ← כפתור כאן!
└──────────────────────────────────────┘
```

הכפתור מופיע ב-Dashboard Header, ליד פעמון ההתראות.

---

## 🧪 איך לבדוק:

1. עבור ל: `/dashboard`
2. לחץ על כפתור השמש/ירח
3. **תוצאה צפויה:**
   - 🌙 → ☀️ מעבר מכהה לבהיר
   - ☀️ → 🌙 מעבר מבהיר לכהה
   - שמירה ב-localStorage
   - אנימציה חלקה

---

## 📊 מצבים:

### מצב לילה (Dark) 🌙:
```
- רקע: כהה (#1e1e1e)
- כרטיסים: כהים (#171717)
- טקסט: לבן (#ffffff)
- גבולות: אפורים כהים
```

### מצב יום (Light) ☀️:
```
- רקע: בהיר (#f5f6f8)
- כרטיסים: לבנים (#ffffff)
- טקסט: כהה (#1e2a3b)
- גבולות: אפורים בהירים
```

---

## 💡 טיפים לפיתוח:

### שימוש ב-Theme:
```tsx
import { useTheme } from "@/contexts/ThemeContext";

function MyComponent() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div className={`
      ${isDark ? 'bg-card-dark text-white' : 'bg-white text-gray-900'}
    `}>
      תוכן
    </div>
  );
}
```

### שימוש במשתני CSS:
```tsx
<div className="bg-card-dark text-theme-primary border-theme">
  תוכן שמתאים אוטומטית למצב
</div>
```

---

## 🎉 תוצאה:

**עכשיו יש לך:**
- ✅ כפתור להחלפת מצב בheader
- ✅ שמירה אוטומטית ב-localStorage
- ✅ אנימציות חלקות
- ✅ תמיכה מלאה בשני מצבים
- ✅ טעינה ללא flash

**המשתמש יכול לבחור מה שנוח לו!** 🚀

