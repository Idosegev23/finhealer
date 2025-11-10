# שיפור ביצועים - נובמבר 2025

## הבעיה שזוהתה
מתוך בדיקת לוגים של Vercel, זוהה עומס מוגזם של קריאות API:

### תסמינים:
- **קריאות רבות מאוד** ל-`/api/expenses/pending` - כמעט כל 30 שניות
- **SSE timeouts** - `/api/notifications/sse` עושה timeout אחרי 300 שניות (5 דקות)
- **קריאות מיותרות כפולות** - כל קומפוננט עושה polling בנפרד

### מקורות הבעיה:
1. **PendingTransactionsBanner** - polling כל **30 שניות** ⚠️
2. **usePendingExpensesCount** - polling כל **דקה** ⚠️
3. **SSE connection** - לא עובד טוב ב-Vercel (timeout limit 5 דקות) + polling פנימי כל 5 שניות ⚠️

אם היו מספר קומפוננטות שמשתמשות בהם, זה יצר **מכפלה של קריאות**.

---

## הפתרון שיושם

### 1. Context מאוחד - `PendingExpensesContext`
נוצר Context חדש שמרכז את כל ה-polling במקום אחד:

**קובץ:** `contexts/PendingExpensesContext.tsx`

**מאפיינים:**
- ✅ קריאה API **אחת** משותפת לכל הקומפוננטות
- ✅ Polling **כל 3 דקות** במקום 30 שניות
- ✅ מנגנון `refresh()` לרענון מיידי במקרה הצורך
- ✅ מעקב אחר `lastUpdated` לדיבוג

### 2. עדכון קומפוננטות קיימות

#### `PendingTransactionsBanner.tsx`
- ❌ הוסר: polling עצמאי כל 30 שניות
- ✅ הוסף: שימוש ב-`usePendingExpenses` מה-Context

#### `usePendingExpensesCount.ts`
- ❌ הוסר: polling עצמאי כל דקה
- ✅ הוסף: wrapper ל-`usePendingExpenses` (backward compatibility)
- 📝 סומן כ-`@deprecated` לעדכון עתידי

#### `DashboardWrapper.tsx`
- ✅ הוסף: `PendingExpensesProvider` ל-dashboard
- ❌ הוסר: `NotificationsListener` (SSE)
- 🧹 ניקוי קוד מיותר

### 3. השבתת SSE Endpoint

**קובץ:** `app/api/notifications/sse/route.ts`

**סיבות להשבתה:**
1. Vercel מגביל serverless functions ל-**5 דקות** - SSE לא אידיאלי
2. גרם לעומס מיותר עם polling פנימי כל 5 שניות
3. יצר timeouts רבים בלוגים

**שונה ל:**
- מחזיר `410 Gone` עם הסבר
- מסומן כ-`@deprecated`

---

## תוצאות צפויות

### לפני:
```
30 שניות × PendingTransactionsBanner = קריאה כל 30 שניות
60 שניות × usePendingExpensesCount = קריאה כל דקה
SSE polling פנימי = קריאה כל 5 שניות
───────────────────────────────────────────────
= עשרות קריאות בדקה, timeouts רבים
```

### אחרי:
```
180 שניות (3 דקות) × Context אחד = קריאה כל 3 דקות
SSE = מושבת לחלוטין
───────────────────────────────────────────────
= ~20 קריאות לשעה במקום ~120-180 קריאות
```

### שיפור צפוי:
- 🚀 **85-90% פחות קריאות API**
- ⚡ **אין timeouts יותר**
- 💰 **חיסכון בעלויות Vercel**
- 🎯 **ביצועים טובים יותר למשתמש**

---

## שימוש בקוד החדש

### בקומפוננטות חדשות:
```typescript
import { usePendingExpenses } from '@/contexts/PendingExpensesContext';

function MyComponent() {
  const { count, loading, refresh, lastUpdated } = usePendingExpenses();
  
  return (
    <div>
      {!loading && count > 0 && (
        <span>יש לך {count} תנועות ממתינות</span>
      )}
      <button onClick={refresh}>רענן עכשיו</button>
    </div>
  );
}
```

### קומפוננטות ישנות:
```typescript
// עדיין עובד אבל deprecated
import { usePendingExpensesCount } from '@/lib/hooks/usePendingExpensesCount';

function OldComponent() {
  const { count, loading, refresh } = usePendingExpensesCount();
  // ... אותו ממשק, אותו Context מתחת למכסה
}
```

---

## אלטרנטיבות עתידיות (לשקול)

אם נרצה **real-time** אמיתי בעתיד:

### 1. Supabase Realtime
```typescript
// הקשבה לשינויים בטבלה
supabase
  .channel('pending_expenses')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'expenses' },
    (payload) => {
      // עדכון אוטומטי
    }
  )
  .subscribe();
```

**יתרונות:**
- ✅ Real-time אמיתי
- ✅ אין polling בכלל
- ✅ עובד מעולה ב-Vercel

**חסרונות:**
- ⚠️ דורש הגדרה נוספת
- ⚠️ יותר מורכב

### 2. Polling חכם (Smart Polling)
- Polling אגרסיבי כשהמשתמש אקטיבי
- Polling איטי/השבתה כשהמשתמש לא פעיל (visibility API)

---

## בדיקות שבוצעו
- ✅ אין שגיאות TypeScript
- ✅ אין שגיאות לינטר
- ✅ backward compatibility נשמרת
- ✅ כל הקומפוננטות משתמשות ב-Context

---

## קבצים שעודכנו
1. ✅ `contexts/PendingExpensesContext.tsx` - נוצר חדש
2. ✅ `components/dashboard/PendingTransactionsBanner.tsx` - עודכן
3. ✅ `lib/hooks/usePendingExpensesCount.ts` - עודכן (wrapper)
4. ✅ `components/dashboard/DashboardWrapper.tsx` - עודכן
5. ✅ `app/api/notifications/sse/route.ts` - הושבת

---

## המלצות נוספות

1. **מעקב Vercel Logs** - לבדוק אחרי deployment שהקריאות אכן ירדו
2. **Analytics** - להוסיף Vercel Analytics למעקב ביצועים
3. **Error Monitoring** - Sentry/similar לתפיסת שגיאות
4. **Rate Limiting** - להוסיף ב-API routes מניעת abuse

---

תאריך: 3 בנובמבר 2025




