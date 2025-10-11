# 🚀 הוראות התקנה והפעלה - FinHealer

## 📋 דרישות מקדימות

- Node.js 18+ מותקן
- חשבון Supabase פעיל
- חשבון Google Cloud (ל-OAuth)
- (אופציונלי) חשבון GreenAPI
- (אופציונלי) חשבון OpenAI
- (אופציונלי) חשבון חשבונית ירוקה

---

## 🔧 שלב 1: התקנת Dependencies

```bash
npm install
```

---

## 🗄️ שלב 2: הגדרת Supabase

### 2.1 יצירת פרויקט
1. היכנס ל-[Supabase Dashboard](https://supabase.com/dashboard)
2. לחץ על "New Project"
3. בחר ארגון ושם לפרויקט
4. שמור את הסיסמה!

### 2.2 קבלת API Keys
1. לך ל-Project Settings > API
2. העתק את:
   - Project URL (NEXT_PUBLIC_SUPABASE_URL)
   - anon/public key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - service_role key (SUPABASE_SERVICE_ROLE_KEY) - **אל תחשוף אותו!**

### 2.3 מסד הנתונים כבר מוכן! ✅
כל הטבלאות, Views, פונקציות ו-RLS כבר הוקמו דרך MCP.

---

## 🔐 שלב 3: הגדרת Google OAuth

### 3.1 יצירת OAuth Client ב-Google Cloud

1. **היכנס ל-[Google Cloud Console](https://console.cloud.google.com/)**

2. **צור פרויקט חדש** (או בחר קיים):
   - לחץ על "Select a project" למעלה
   - לחץ "NEW PROJECT"
   - תן שם לפרויקט (למשל: "FinHealer")
   - לחץ "Create"

3. **הפעל את Google+ API**:
   - בחר "APIs & Services" > "Library"
   - חפש "Google+ API"
   - לחץ "Enable"

4. **הגדר OAuth Consent Screen**:
   - לך ל-"APIs & Services" > "OAuth consent screen"
   - בחר "External" ולחץ "Create"
   - מלא:
     - **App name**: FinHealer
     - **User support email**: המייל שלך
     - **Developer contact**: המייל שלך
   - לחץ "Save and Continue"
   - ב-"Scopes" לחץ "Save and Continue" (ללא שינויים)
   - ב-"Test users" הוסף את המייל שלך
   - לחץ "Save and Continue"

5. **צור OAuth 2.0 Client ID**:
   - לך ל-"APIs & Services" > "Credentials"
   - לחץ "Create Credentials" > "OAuth client ID"
   - בחר "Web application"
   - שם: "FinHealer Web Client"
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3000
     https://[your-supabase-project-ref].supabase.co
     ```
   - **Authorized redirect URIs**:
     ```
     https://[your-supabase-project-ref].supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     ```
   - לחץ "Create"
   - **העתק את Client ID ו-Client Secret**

### 3.2 הגדרת Google Provider ב-Supabase

1. לך ל-Supabase Dashboard > Authentication > Providers
2. מצא את "Google" ולחץ עליו
3. הפעל את "Enable Google provider"
4. הדבק:
   - **Client ID** מ-Google
   - **Client Secret** מ-Google
5. לחץ "Save"

### 3.3 עדכון Redirect URL ב-Google

חזור ל-Google Cloud Console והוסף את ה-redirect URI המדויק:
```
https://[your-project-ref].supabase.co/auth/v1/callback
```

**למצוא את ה-Project Ref שלך:**
- הוא מופיע ב-URL של Supabase Dashboard
- לדוגמה: `https://abcdefghijklm.supabase.co`
- ה-Ref הוא: `abcdefghijklm`

---

## 📝 שלב 4: יצירת קובץ .env.local

העתק את `.env.example` ל-`.env.local`:

```bash
cp .env.example .env.local
```

ערוך את `.env.local` ומלא את הערכים:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## 🚀 שלב 5: הרצת הפרויקט

```bash
npm run dev
```

האפליקציה תיפתח ב: **http://localhost:3000**

---

## ✅ בדיקת התקנה

### 1. בדוק את Landing Page
- פתח http://localhost:3000
- אמור לראות את דף הנחיתה

### 2. בדוק התחברות עם Google
- לחץ "התחבר"
- לחץ "המשך עם Google"
- אמור להיפתח חלון Google
- אחרי התחברות תועבר ל-Onboarding

### 3. בדוק Onboarding
- הזן מספר טלפון (050-1234567)
- לחץ "המשך לדשבורד"
- אמור להיכנס ל-Dashboard

### 4. בדוק Dashboard
- אמור לראות את ציון הבריאות הפיננסית (0 בהתחלה)
- אמור לראות "בוא נתחיל!"

---

## 🧪 בדיקת Webhook לסליקה דמה

### הפעלת מנוי דמה

שלח POST request ל-webhook:

```bash
curl -X POST http://localhost:3000/api/webhooks/payment-demo \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "YOUR-USER-ID",
    "amount": 49,
    "status": "paid"
  }'
```

**למצוא את ה-USER-ID שלך:**
1. היכנס ל-Supabase Dashboard
2. לך ל-Table Editor > users
3. העתק את ה-id

אחרי ההרצה:
- המנוי יעודכן ל-"active"
- תקבל הודעת ברוכים הבאים (ב-alerts)

---

## 🔧 בעיות נפוצות

### שגיאה: "OAuth Error"
**פתרון:**
- וודא שה-Redirect URI ב-Google זהה בדיוק לזה ב-Supabase
- בדוק שהפעלת את Google Provider ב-Supabase

### שגיאה: "User not found"
**פתרון:**
- וודא שהטבלה `users` קיימת
- בדוק שיש מדיניות RLS מתאימה

### שגיאה: "Phone number invalid"
**פתרון:**
- הזן מספר ישראלי תקין (050-1234567)
- המספר יומר אוטומטית ל-+972501234567

---

## 🎯 צעדים הבאים

עכשיו שהמערכת פועלת, אפשר:

1. **להוסיף תכונות**:
   - ניהול הוצאות והכנסות
   - הגדרת תקציב וקטגוריות
   - יעדים פיננסיים
   - דוחות וגרפים

2. **לחבר אינטגרציות אמיתיות**:
   - GreenAPI (WhatsApp)
   - OpenAI (AI Assistant)
   - חשבונית ירוקה (תשלומים)
   - OCR (קבלות)

3. **לפרוס ל-Production**:
   - Deploy ל-Vercel
   - הגדר environment variables
   - עדכן Redirect URIs ב-Google

---

## 📚 תיעוד נוסף

- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Google OAuth Docs](https://developers.google.com/identity/protocols/oauth2)

---

## 🆘 צריך עזרה?

- בדוק את קובץ `DATABASE.md` לתיעוד מלא של מסד הנתונים
- בדוק את `memory-bank/` לאפיון מפורט
- פתח issue ב-GitHub

---

**🎉 מזל טוב! המערכת מוכנה ופועלת!**

