# GreenAPI Webhook Setup - הוראות הגדרה

## 🔧 צריך לעשות עכשיו:

### 1. כנס ל-GreenAPI Console
👉 https://console.green-api.com/

### 2. בחר את ה-Instance שלך (7103957106)

### 3. לחץ על "Settings" (הגדרות)

### 4. גלול ל-"Webhooks" ומלא:

#### ✅ הפעל את ה-Webhooks הבאים:
- ✓ **incomingMessageReceived** - הודעות נכנסות
- ✓ **outgoingMessageStatus** - סטטוס הודעות יוצאות (אופציונלי)

#### 📝 Webhook URL:
```
https://finhealer.vercel.app/api/wa/webhook
```

#### 🔑 Webhook Token (אופציונלי אבל מומלץ):
אם רוצה אבטחה נוספת - צור token רנדומלי כמו:
```
finhealer-webhook-secret-2025-xyz123
```

### 5. לחץ על "Save" (שמור)

### 6. בדוק שה-Instance פעיל:
- סטטוס צריך להיות: **authorized** (ירוק)
- אם אדום - סרוק מחדש את ה-QR code

---

## 🧪 בדיקה מהירה

אחרי שהגדרת, שלח הודעה ל-WhatsApp שלך ובדוק:

### אם זה לא עובד, בדוק:

1. **Vercel Logs**:
   - https://vercel.com/dashboard
   - בחר את הפרויקט → לשונית "Logs"
   - חפש שגיאות ב-`/api/wa/webhook`

2. **GreenAPI Logs**:
   - ב-Console → "Logs"
   - תראה אם ההודעות מגיעות

3. **מספר הטלפון במסד הנתונים**:
   - צריך להיות בפורמט: `972547667775`
   - בלי `+` או `-`

---

## 🔍 Debug - בדיקת החיבור

אם עדיין לא עובד, הרץ את הפקודה הזאת:

```bash
curl "https://finhealer.vercel.app/api/test/wa?phone=972547667775"
```

זה ישלח הודעת בדיקה.

---

## ⚠️ בעיות נפוצות:

### הודעה לא מגיעה?
- בדוק ש-Instance מחובר (סטטוס ירוק)
- וודא שה-Webhook URL נכון ב-GreenAPI
- בדוק שאין טעויות כתיב ב-URL

### הודעה מגיעה אבל אין תשובה?
- בדוק Vercel Logs לשגיאות
- וודא שהמספר שלך (`972547667775`) קיים בטבלת `users`
- וודא ש-`wa_opt_in = true` עבור המשתמש

### שגיאת Unauthorized?
- בדוק שה-`GREEN_API_TOKEN` נכון ב-Vercel Environment Variables
- בדוק שה-`GREEN_API_INSTANCE_ID` נכון

---

## 📞 איך לבדוק שהמספר שלך מחובר?

הרץ SQL ב-Supabase:

```sql
SELECT id, name, phone, wa_opt_in, email
FROM users
WHERE phone = '972547667775';
```

אם אין תוצאות - המספר לא מחובר!
אם `wa_opt_in = false` - צריך לשנות ל-`true`.

---

## ✅ כשהכל עובד:

תקבל תשובה אוטומטית מ"פיני" על כל הודעה ש-WhatsApp!

שלח משהו כמו:
- "היי"
- "הוצאתי 100 שקל על קפה"
- "מה התקציב שלי?"

