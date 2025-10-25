# 🚀 רשימת בדיקה ל-Deploy

רשימת משימות לפני העלאה לפרודקשן

---

## ✅ **1. Environment Variables ב-Vercel**

הכנס ל-Vercel Dashboard → Project Settings → Environment Variables

### חובה:
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `GREEN_API_INSTANCE_ID`
- [ ] `GREEN_API_TOKEN`
- [ ] `OPENAI_API_KEY`
- [ ] `CRON_SECRET` (UUID חזק!)
- [ ] `NEXT_PUBLIC_APP_URL` = `https://finhealer.vercel.app`

### אופציונלי:
- [ ] `GREEN_API_WEBHOOK_SECRET`
- [ ] `GREEN_INVOICE_API_KEY`
- [ ] `GREEN_INVOICE_SECRET`
- [ ] `NEXT_PUBLIC_GA_ID` (Google Analytics)

---

## ✅ **2. הגדרות GreenAPI**

### סרוק QR Code:
1. כנס ל-https://console.green-api.com/
2. בחר Instance: `7103957106`
3. סרוק QR Code עם WhatsApp

### הגדר Webhook:
```
Settings → Webhook Settings

Webhook URL: https://finhealer.vercel.app/api/wa/webhook

סמן:
✅ Incoming Messages
✅ Incoming Message Status
```

---

## ✅ **3. בדיקות מקומיות**

### Build מוצלח:
```bash
npm run build
```

### Lint עובר:
```bash
npm run lint
```

### Type Check עובר:
```bash
npm run type-check
```

---

## ✅ **4. Supabase RLS Policies**

### בדוק שכל הטבלאות מוגנות:
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = false;
```

**צריך להחזיר 0 שורות!**

---

## ✅ **5. בדיקות Functional**

### משתמש יכול:
- [ ] להירשם (Sign Up)
- [ ] להתחבר (Login)
- [ ] למלא Reflection Wizard
- [ ] לראות Dashboard
- [ ] לשלוח הודעה ב-WhatsApp ← פיני עונה
- [ ] לצפות בהוצאות
- [ ] ליצור תקציב
- [ ] להגדיר יעד

### אדמין יכול:
- [ ] לראות רשימת משתמשים (אם יש Admin Dashboard)

---

## ✅ **6. Performance**

### בדוק Lighthouse:
- [ ] Performance > 90
- [ ] Accessibility > 90
- [ ] Best Practices > 90
- [ ] SEO > 90

### בדוק זמני טעינה:
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s

---

## ✅ **7. SEO & Meta Tags**

### בדוק שכל דף יש לו:
- [ ] `<title>`
- [ ] `<meta name="description">`
- [ ] Open Graph tags (og:image, og:title, og:description)
- [ ] Favicon

---

## ✅ **8. Error Handling**

### בדוק שיש:
- [ ] Error boundaries
- [ ] 404 page
- [ ] 500 page
- [ ] Loading states
- [ ] Empty states

---

## ✅ **9. Mobile Responsive**

### בדוק במכשירים:
- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] Tablet
- [ ] Desktop

---

## ✅ **10. Security**

### בדוק:
- [ ] אין API keys בקוד
- [ ] `.env.local` ב-.gitignore
- [ ] HTTPS בלבד (Vercel אוטומטי)
- [ ] RLS Policies פעילים
- [ ] Input validation בכל הטפסים

---

## ✅ **11. Monitoring**

### הגדר (אופציונלי):
- [ ] Sentry לשגיאות
- [ ] Google Analytics לטראפיק
- [ ] Vercel Analytics

---

## ✅ **12. Deploy!**

### Push ל-Git:
```bash
git add .
git commit -m "chore: ready for production"
git push origin main
```

### Vercel Auto-Deploy:
- Vercel יריץ `npm run build`
- אם עובר → Auto-deploy
- אם נכשל → Fix & push again

### בדוק שה-Deploy הצליח:
```
https://finhealer.vercel.app/
```

---

## ✅ **13. Post-Deploy Checks**

### בדוק ב-Production:
- [ ] האתר עולה
- [ ] Login עובד
- [ ] WhatsApp Webhook עובד (שלח הודעה)
- [ ] Cron Jobs רצים (בדוק ב-Vercel Logs)
- [ ] תשלומים עובדים (אם מוכן)

### בדוק לוגים:
```
Vercel Dashboard → Deployments → Logs

סנן:
- Errors
- Warnings
- Cron Jobs
```

---

## ✅ **14. הכנת לקוחות**

### הכן:
- [ ] מדריך שימוש
- [ ] שאלות נפוצות (FAQ)
- [ ] וידאו הדרכה
- [ ] אימייל ברוכים הבאים
- [ ] תמיכה טכנית (צ'אט/טלפון)

---

## 🎉 **סיימת!**

### ✅ **כל הפונקציות עובדות**
### ✅ **המערכת מאובטחת**
### ✅ **הביצועים מעולים**
### ✅ **הכל מתועד**

**מזל טוב! FinHealer מוכן לייצור! 🚀**

---

**📅 תאריך:** 25 אוקטובר 2025  
**✨ גרסה:** 1.0.0

