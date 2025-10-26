# 🔍 Debug Deployment

## בדיקות שצריך לעשות:

### 1️⃣ בדוק ש-Deployment הצליח:

1. כנס ל: https://vercel.com/dashboard
2. בחר את הפרויקט "finhealer"
3. לחץ על "Deployments"
4. בדוק שה-deployment האחרון (commit: `cb6de97`) הוא **"Ready"** (ירוק)

**אם יש סטטוס "Failed" (אדום):**
- לחץ עליו
- בדוק את ה-Build Logs
- תעתיק את השגיאה

---

### 2️⃣ אם הכל ירוק, בדוק Logs:

1. Vercel Dashboard → בחר פרויקט
2. לחץ על "Logs" (תפריט עליון)
3. **שלח הודעה חדשה ב-WhatsApp** למספר שלך
4. תראה בזמן אמת אם `/api/wa/webhook` מקבל בקשות
5. אם יש שגיאה - תעתיק אותה

---

### 3️⃣ בדיקה ידנית (אם אין logs):

הרץ את הפקודה הזאת:

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
      "sender": "972547667775@c.us"
    },
    "messageData": {
      "typeMessage": "textMessage",
      "textMessageData": {
        "textMessage": "test"
      }
    }
  }'
```

תקבל תשובה - העתק אותה!

---

### 4️⃣ אפשרות אחרת - Cache:

אם הכל ירוק אבל עדיין לא עובד:

1. Vercel Dashboard → Deployments
2. בחר את ה-deployment האחרון
3. לחץ על "⋯" (3 נקודות)
4. בחר "**Redeploy**"
5. סמן ✓ "**Rebuild the deployment without using cache**"
6. לחץ "Redeploy"

זה יכריח את Vercel לבנות הכל מחדש ללא cache.

---

## מה אני מחפש?

אני מחפש אחת מהאפשרויות:

1. ✅ **Build failed** - יש שגיאת קומפילציה
2. ✅ **Runtime error** - יש שגיאה ב-logs כשהוא רץ
3. ✅ **Cache issue** - Vercel משתמש בקוד ישן
4. ✅ **Environment Variables חסרים** - בדוק שוב ש-`SUPABASE_SERVICE_ROLE_KEY` קיים

---

## תגיד לי מה מצאת! 🕵️

