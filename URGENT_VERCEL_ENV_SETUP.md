# ⚠️ דחוף! הגדרת Environment Variables ב-Vercel

## 🚨 הבעיה:
Webhook לא עובד כי חסר `SUPABASE_SERVICE_ROLE_KEY` ב-Vercel!

---

## ✅ פתרון (3 דקות):

### 1. כנס ל-Vercel Dashboard
👉 https://vercel.com/dashboard

### 2. בחר את הפרויקט "finhealer"

### 3. לחץ על "Settings"

### 4. בחר "Environment Variables" בתפריט השמאלי

### 5. הוסף את המשתנים הבאים:

#### ✅ משתנים חובה:

| Key | Value | Environment |
|-----|-------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cm5kdGFsbnh3c3lpYmh4cWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTY5ODMwNSwiZXhwIjoyMDc1Mjc0MzA1fQ.y7TUZWXnk0AXRyAs-qFa7SbDzFXzZH35p8LjhaeaaFk` | Production, Preview, Development |
| `GREEN_API_INSTANCE_ID` | `7103957106` | Production, Preview, Development |
| `GREEN_API_TOKEN` | `da7175990ec4435990f1d696d76c7c4f6a98cd50414448bcb9` | Production, Preview, Development |
| `OPENAI_API_KEY` | (הקיים שלך) | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://cxrndtalnxwsyibhxqjz.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cm5kdGFsbnh3c3lpYmh4cWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2OTgzMDUsImV4cCI6MjA3NTI3NDMwNX0.-UoR-wShu48Fva98_hhEUXQfqJn02SeMhxx7aHGHvy4` | Production, Preview, Development |
| `CRON_SECRET` | `finhealer-cron-secret-2025-change-me-in-production` | Production, Preview, Development |

---

### 6. לחץ "Save" על כל אחד

### 7. Redeploy הפרויקט:
- לחץ על "Deployments" בתפריט העליון
- בחר את ה-deployment האחרון
- לחץ על "⋯" (3 נקודות)
- בחר "Redeploy"

---

## 🧪 בדיקה אחרי Deployment:

אחרי 1-2 דקות, שלח הודעה ב-WhatsApp ל-`972547667775` ותקבל תשובה אוטומטית מפיני! 🤖

---

## ⚠️ חשוב!

**אל תשתף את ה-SERVICE_ROLE_KEY בשום מקום פומבי!**
זה המפתח שעוקף את כל אבטחת RLS!

---

## 🐛 עדיין לא עובד?

בדוק Vercel Logs:
1. Vercel Dashboard → בחר פרויקט
2. לחץ "Logs"
3. שלח הודעה ב-WhatsApp
4. חפש `/api/wa/webhook` בלוגים
5. תעתיק את השגיאה ותשלח לי

---

## ✅ איך לדעת שזה עובד?

כשתשלח הודעה ב-WhatsApp, תקבל תשובה תוך 2-3 שניות מ"פיני"! 🎉

