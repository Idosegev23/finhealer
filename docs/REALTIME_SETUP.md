# 🔄 Supabase Realtime - הגדרה

## מה זה?

Supabase Realtime מאפשר עדכון נתונים בזמן אמת ללא polling. כשמשתמש מוסיף/מעדכן/מוחק תנועה, כל הקומפוננטות שמאזינות מתעדכנות אוטומטית.

## ✅ מה כבר מוגדר?

1. **Hook חדש**: `lib/hooks/useRealtimeTransactions.ts`
   - מאזין לשינויים בטבלת `transactions`
   - עובד עם RLS - רואה רק את הנתונים שהמשתמש מורשה לראות
   - תומך ב-INSERT, UPDATE, DELETE

2. **שימוש בגרפים**:
   - `ExpensesDrilldownChart` - מתעדכן אוטומטית כשנוספות/מתעדכנות הוצאות
   - `IncomeDrilldownChart` - מתעדכן אוטומטית כשנוספות/מתעדכנות הכנסות

3. **ריפרש אוטומטי**:
   - כשמגיעים לדשבורד (`pathname === '/dashboard'`), הגרפים מתעדכנים אוטומטית

## ⚙️ הגדרה ב-Supabase Dashboard

**חשוב**: צריך להפעיל Realtime על הטבלה `transactions`:

1. כנס ל-Supabase Dashboard
2. לך ל-Database → Replication
3. מצא את הטבלה `transactions`
4. הפעל את ה-toggle ליד `transactions`
5. שמור

או דרך SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
```

## 🔒 אבטחה (RLS)

Realtime עובד **אוטומטית עם RLS**:
- המשתמש רואה רק את התנועות שלו (`user_id = auth.uid()`)
- אין צורך בהגדרות נוספות
- כל שינוי שמגיע דרך Realtime כבר עבר את בדיקות ה-RLS

## 📊 איך זה עובד?

```typescript
// בקומפוננטה
useRealtimeTransactions({
  onInsert: () => {
    // כשנוספת תנועה חדשה
    fetchLevel1Data(); // רענון הגרף
  },
  onUpdate: () => {
    // כשמתעדכנת תנועה
    fetchLevel1Data();
  },
  onDelete: () => {
    // כשנמחקת תנועה
    fetchLevel1Data();
  },
  enabled: pathname === '/dashboard', // רק בדשבורד
});
```

## 🎯 יתרונות

- ✅ **Real-time אמיתי** - עדכון מיידי ללא polling
- ✅ **יעיל** - אין קריאות API מיותרות
- ✅ **בטוח** - עובד עם RLS
- ✅ **אוטומטי** - אין צורך ב-refresh ידני

## 🐛 פתרון בעיות

### הגרפים לא מתעדכנים?

1. **בדוק ש-Realtime מופעל**:
   - Supabase Dashboard → Database → Replication
   - ודא ש-`transactions` מופעל

2. **בדוק את ה-console**:
   - אמור לראות: `📡 Realtime subscription status: SUBSCRIBED`
   - אם רואה `CLOSED` או `CHANNEL_ERROR`, יש בעיה בחיבור

3. **בדוק RLS Policies**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'transactions';
   ```
   - ודא שיש policy שמאפשר SELECT למשתמש המחובר

4. **בדוק Network Tab**:
   - אמור לראות WebSocket connection ל-Supabase
   - אם אין, יש בעיה בחיבור

## 📝 הערות

- Realtime עובד רק ב-client-side (לא ב-Server Components)
- צריך להשתמש ב-`createClient()` מ-`@/lib/supabase/client`
- ה-subscription נסגר אוטומטית כשהקומפוננטה unmount


