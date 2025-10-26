# 🔍 איך לבדוק לוגים של Webhook

## 📋 צעדים:

### 1. כנס ל-Vercel Dashboard
👉 https://vercel.com/dashboard

### 2. בחר את הפרויקט "finhealer"

### 3. לחץ על "Logs" בתפריט העליון

### 4. חפש logs של `/api/wa/webhook`

---

## 🔎 מה לחפש בלוגים:

### ✅ אם ה-Webhook עובד - תראה:
```
POST /api/wa/webhook 200
✅ Webhook received successfully
📱 Processing message from: 972547667775
🤖 AI response sent
```

### ❌ אם יש שגיאה - תראה:
```
POST /api/wa/webhook 500
Error: ...
```

או

```
POST /api/wa/webhook 401
Unauthorized
```

---

## 🧪 בדיקה מהירה:

אם אתה רואה שה-webhook **לא מקבל בקשות בכלל**, זאת אומרת:
- GreenAPI לא שולח את ההודעות ל-webhook שלנו
- צריך לבדוק שוב את ההגדרות ב-GreenAPI Console

אם אתה **רואה בקשות אבל יש שגיאות**, תעתיק את השגיאה ונתקן!

---

## 🐛 Debug מתקדם:

אם אין logs בכלל, נסה:

### אופציה 1: שלח webhook test ידני
```bash
curl -X POST "https://finhealer.vercel.app/api/wa/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "typeWebhook": "incomingMessageReceived",
    "instanceData": {
      "idInstance": 7103957106,
      "wid": "972559749242@c.us",
      "typeInstance": "whatsapp"
    },
    "timestamp": 1234567890,
    "idMessage": "TEST123",
    "senderData": {
      "chatId": "972547667775@c.us",
      "sender": "972547667775@c.us",
      "senderName": "Test"
    },
    "messageData": {
      "typeMessage": "textMessage",
      "textMessageData": {
        "textMessage": "בדיקה"
      }
    }
  }'
```

זה ישלח webhook test ישירות ל-API שלך.

### אופציה 2: בדיקת Environment Variables ב-Vercel

וודא שכל המשתנים האלה קיימים ב-Vercel:
- ✓ `GREEN_API_INSTANCE_ID`
- ✓ `GREEN_API_TOKEN`
- ✓ `OPENAI_API_KEY`
- ✓ `NEXT_PUBLIC_SUPABASE_URL`
- ✓ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✓ `SUPABASE_SERVICE_ROLE_KEY`

לבדוק: Settings → Environment Variables

---

## 📞 מה הלאה?

1. **שלח הודעה ב-WhatsApp** (תשובה להודעת הבדיקה)
2. **בדוק Vercel Logs** - תראה אם המערכת קיבלה את ההודעה
3. **אם יש שגיאה** - תעתיק אותה ותשלח לי
4. **אם אין logs בכלל** - כנראה בעיה בהגדרות GreenAPI webhook

