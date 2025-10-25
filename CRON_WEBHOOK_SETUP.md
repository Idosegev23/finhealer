# 🔄 Cron Jobs + WhatsApp Webhook - מדריך הגדרה

תיעוד מלא להגדרת Cron Jobs וWebhook של WhatsApp

---

## 📍 **כתובת ה-Webhook**

```
https://finhealer.vercel.app/api/wa/webhook
```

**זה הכתובת שצריך להגדיר ב-GreenAPI!**

---

## 🔐 **אבטחה**

### 1. **CRON_SECRET**
כל Cron Job מוגן ב-Authorization header:

```typescript
Authorization: Bearer YOUR_CRON_SECRET
```

**הגדרה ב-Vercel:**
1. לך ל-Project Settings → Environment Variables
2. הוסף: `CRON_SECRET` = `finhealer-cron-secret-2025-change-me-in-production`
3. **חשוב:** שנה ל-UUID חזק בפרודקשן!

```bash
# יצירת UUID חזק (Linux/Mac)
uuidgen | tr '[:upper:]' '[:lower:]'

# או בNode.js
node -e "console.log(require('crypto').randomUUID())"
```

### 2. **Webhook Authentication (אופציונלי)**
אפשר להגדיר `GREEN_API_WEBHOOK_SECRET` ולאמת signatures

---

## ⏰ **Cron Jobs**

### 1. **סיכום יומי** (20:30 כל יום)
**נתיב:** `/api/cron/daily-summary`  
**לוח זמנים:** `30 20 * * *` (20:30 Israel Time)

**מה זה עושה:**
- בודק אם היו הוצאות היום
- שולח סיכום ב-WhatsApp:
  - אם **יש** הוצאות → סיכום עם top 3
  - אם **אין** הוצאות → "יום ללא הוצאות! 🎉"

**הודעה לדוגמה:**
```
📊 עידו, סיכום היום:

💸 סה״כ הוצאות: ₪350
📝 5 תנועות

ההוצאות הגדולות:
• סופר: ₪200
• דלק: ₪100
• קפה: ₪50

לילה טוב! 🌙
```

---

### 2. **דוח שבועי** (Monday 09:00)
**נתיב:** `/api/cron/weekly-report`  
**לוח זמנים:** `0 9 * * 1` (יום שני 09:00)

**מה זה עושה:**
- מחשב סיכום השבוע (7 ימים אחרונים)
- משווה לשבוע שעבר
- מציג top 3 קטגוריות

**הודעה לדוגמה:**
```
🗓️ עידו, דוח השבוע!

💸 הוצאות השבוע: ₪2,500
📉 ירידה של 15% 🎉

📊 קטגוריות מובילות:
• קניות: ₪1,200
• תחבורה: ₪800
• בילויים: ₪500

💰 הכנסות: ₪12,000

שבוע טוב! 💪
```

---

### 3. **תקציב חודשי** (1st of month 00:00)
**נתיב:** `/api/cron/monthly-budget`  
**לוח זמנים:** `0 0 1 * *` (1 בחודש 00:00)

**מה זה עושה:**
- מוצא משתמשים עם לפחות 3 חודשי נתונים
- קורא ל-`/api/budget/create-smart` ליצירת תקציב אוטומטי
- שולח הודעה עם לינק לדשבורד

**הודעה לדוגמה:**
```
🎯 עידו!

התקציב שלך לחודש הבא מוכן! 🎉

💰 תקציב כולל: ₪6,500

📊 התקציב נבנה על בסיס ההתנהלות שלך ב-3 החודשים האחרונים.

הכנס לדשבורד לראות את הפירוט המלא! 💪

https://finhealer.vercel.app/dashboard/budget
```

---

### 4. **התראות שעתיות**
**נתיב:** `/api/cron/hourly-alerts`  
**לוח זמנים:** `0 * * * *` (כל שעה)

**מה זה עושה:**
- בודק חריגות תקציב
- שולח התראות:
  - **90-99%** → אזהרה ⚠️
  - **100%+** → חריגה 🚨

**הודעות:**

**אזהרה (90-99%):**
```
⚠️ עידו!

אזהרת תקציב! 📊

💸 הוצאת 95% מהתקציב
💰 נותר: ₪300

שים לב להוצאות בימים הבאים 👀
```

**חריגה (100%+):**
```
⚠️ עידו!

חרגת מהתקציב החודשי! 🚨

💸 תקציב: ₪6,000
💰 הוצאת: ₪6,500
📊 חריגה: ₪500

בוא ננסה להיזהר בימים הבאים 💪
```

---

## 🔗 **הגדרת Webhook ב-GreenAPI**

### שלב 1: כנס ל-GreenAPI Console
https://console.green-api.com/

### שלב 2: בחר את ה-Instance שלך
Instance ID: `7103957106`

### שלב 3: הגדר Webhook
```
Settings → Webhook Settings

Webhook URL: https://finhealer.vercel.app/api/wa/webhook

סמן:
✅ Incoming Messages
✅ Incoming Message Status
```

### שלב 4: Save & Test
לחץ "Save" ושלח הודעת בדיקה מהנייד שלך

---

## 🧪 **בדיקה מקומית**

### בדיקת Webhook:
```bash
# GET endpoint (לבדיקה שהוא עובד)
curl http://localhost:3000/api/wa/webhook

# צריך להחזיר:
{
  "status": "ok",
  "message": "GreenAPI Webhook endpoint is active",
  "timestamp": "2025-10-25T..."
}
```

### בדיקת Cron (עם Authorization):
```bash
# סיכום יומי
curl -H "Authorization: Bearer finhealer-cron-secret-2025-change-me-in-production" \
  http://localhost:3000/api/cron/daily-summary

# דוח שבועי
curl -H "Authorization: Bearer finhealer-cron-secret-2025-change-me-in-production" \
  http://localhost:3000/api/cron/weekly-report

# תקציב חודשי
curl -H "Authorization: Bearer finhealer-cron-secret-2025-change-me-in-production" \
  http://localhost:3000/api/cron/monthly-budget

# התראות שעתיות
curl -H "Authorization: Bearer finhealer-cron-secret-2025-change-me-in-production" \
  http://localhost:3000/api/cron/hourly-alerts
```

---

## 🚀 **Deploy ל-Vercel**

### 1. Push ל-Git
```bash
git add .
git commit -m "feat: add cron jobs and webhook"
git push origin main
```

### 2. Vercel Auto-Deploy
Vercel יקרא את `vercel.json` ויגדיר את ה-Cron Jobs אוטומטית!

### 3. הגדר Environment Variables
```
Project Settings → Environment Variables

הוסף:
- CRON_SECRET = [UUID חזק]
- GREEN_API_WEBHOOK_URL = https://finhealer.vercel.app/api/wa/webhook
- (וכל השאר מ-.env.local)
```

### 4. Redeploy (אם צריך)
```bash
vercel --prod
```

---

## 📊 **ניטור Cron Jobs**

### Vercel Dashboard
```
Project → Deployments → Logs

סנן לפי:
/api/cron/daily-summary
/api/cron/weekly-report
/api/cron/monthly-budget
/api/cron/hourly-alerts
```

### לוגים ב-Supabase
```sql
-- בדוק התראות שנשלחו
SELECT * FROM alerts 
WHERE type IN ('daily_summary', 'weekly_report', 'budget_warning', 'budget_exceeded')
ORDER BY created_at DESC
LIMIT 50;

-- בדוק כמה משתמשים פעילים עם WhatsApp
SELECT COUNT(*) 
FROM users 
WHERE wa_opt_in = true 
  AND subscription_status = 'active' 
  AND phone IS NOT NULL;
```

---

## ⚠️ **בעיות נפוצות**

### 1. **Webhook לא עובד**
- ✅ בדוק שה-Instance authorized (סרוק QR code)
- ✅ בדוק שה-URL נכון: `https://finhealer.vercel.app/api/wa/webhook`
- ✅ בדוק שהמספר רשום ב-DB עם `wa_opt_in = true`

### 2. **Cron לא רץ**
- ✅ בדוק ש-`CRON_SECRET` מוגדר ב-Vercel
- ✅ בדוק ש-`vercel.json` committed ל-Git
- ✅ Vercel Crons פועלים רק ב-Production (לא ב-Preview)

### 3. **הודעות לא מגיעות**
- ✅ בדוק שהמספר בפורמט נכון: `972547667775`
- ✅ בדוק ש-`wa_opt_in = true`
- ✅ בדוק לוגים ב-GreenAPI Console

---

## 📝 **Checklist להפעלה**

- [ ] `.env.local` עודכן עם `CRON_SECRET`
- [ ] `vercel.json` נוצר עם 4 cron jobs
- [ ] 4 API endpoints נוצרו: `/api/cron/*`
- [ ] Webhook endpoint: `/api/wa/webhook` עובד
- [ ] Environment variables הועלו ל-Vercel
- [ ] Deploy הצליח
- [ ] Webhook הוגדר ב-GreenAPI
- [ ] בדיקה: שלחתי הודעה מהנייד ← פיני עונה ✅
- [ ] בדיקה: הרצתי `daily-summary` ידנית ← הודעה הגיעה ✅

---

## 🎯 **סיכום**

| Cron Job | זמן | תדירות | מה זה עושה |
|---------|-----|---------|-----------|
| daily-summary | 20:30 | יומי | סיכום הוצאות היום |
| weekly-report | Mon 09:00 | שבועי | דוח שבועי + השוואה |
| monthly-budget | 1st 00:00 | חודשי | יצירת תקציב אוטומטי |
| hourly-alerts | :00 | שעתי | בדיקת חריגות תקציב |

**Webhook:**
- נתיב: `https://finhealer.vercel.app/api/wa/webhook`
- תומך: הודעות טקסט, תמונות, כפתורים
- מחובר: AI (GPT-4o) + Context מלא

---

**📅 תאריך עדכון אחרון:** 25 אוקטובר 2025  
**✨ סטטוס:** ✅ מוכן לפרודקשן

