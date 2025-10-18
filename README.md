# 🏥 FinHealer - תוכנית ההבראה הפיננסית הדיגיטלית

מערכת SaaS מתקדמת לניהול ושיפור המצב הפיננסי האישי, עם בוט WhatsApp חכם, בינה מלאכותית ומעקב בזמן אמת.

## 🎯 מטרת הפרויקט

יצירת **מאמן פיננסי דיגיטלי אישי** שמלווה משתמשים בשיפור המצב הכלכלי שלהם:
- ניטור הוצאות והכנסות בזמן אמת
- מעקב תקציבי חכם עם התראות
- בוט WhatsApp דו-כיווני בעברית
- AI Assistant לתמיכה וייעוץ
- דוחות ויזואליים ברורים

## 🚀 טכנולוגיות

### Frontend
- **Next.js 14+** (App Router)
- **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Framer Motion** (אנימציות)
- **Recharts** (גרפים)

### Backend
- **Supabase**
  - PostgreSQL Database
  - Authentication
  - Row Level Security (RLS)
  - Storage
  - Edge Functions

### אינטגרציות
- **GreenAPI** - WhatsApp Business API
- **OpenAI** - AI Assistant
- **Tesseract.js** - OCR לקבלות
- **חשבונית ירוקה** - ניהול מנויים ותשלומים

## 📊 מבנה מסד הנתונים

### טבלאות מרכזיות (29 טבלאות)
- `users` - משתמשים (+ phase, ai_personality, locale)
- `transactions` - תנועות כספיות (+ category_id FK, currency, tx_date)
- `budget_categories` - קטגוריות תקציב (+ priority)
- `goals` - יעדים פיננסיים (+ child_name, priority)
- `wa_messages` - הודעות WhatsApp (+ buttons, provider_msg_id)
- `alerts` - התראות למשתמש
- `alerts_rules` - חוקי התראות
- `alerts_events` - אירועי התראות
- `subscriptions` - מנויים (+ renewed_at, canceled_at)
- `receipts` - קבלות OCR (+ tx_date)
- `user_baselines` - ממוצעי הוצאות היסטוריים
- `user_financial_profile` - פרופיל פיננסי 360°
- `loans` - הלוואות והתחייבויות 🆕
- `insurance` - ביטוחים (חיים, בריאות, מחלות קשות, סיעודי, תאונות) 🆕
- `savings_accounts` - חשבונות חיסכון והשקעות 🆕
- `pension_insurance` - קרנות פנסיה וקופות גמל 🆕
- `behavior_insights` - דפוסי הוצאה מזוהים ⭐ חדש
- `advisor_notes` - הערות ליווי אנושי ⭐ חדש
- `user_financial_profile` - תמונת מצב 360° ⭐ חדש
- `admin_users` - מנהלי מערכת
- `message_templates` - תבניות הודעות
- `user_settings` - הגדרות משתמש
- `audit_logs` - לוגים
- `default_categories` - קטגוריות ברירת מחדל

### Views (6 Views)
- `monthly_budget_tracking` - מעקב תקציב בזמן אמת
- `user_monthly_stats` - סטטיסטיקות חודשיות
- `category_spending_report` - דוח הוצאות
- `goals_progress_report` - דוח יעדים
- `financial_summary` - סיכום פיננסי כולל (נכסים, חובות, שווי נטו) 🆕
- `cash_flow_projection` - תחזית תזרים (6/12/24 חודשים) 🆕
- `debt_analysis` - ניתוח חובות מפורט עם יחסים 🆕

### פונקציות (8 Functions)
- `calculate_financial_health(user_id)` - חישוב ציון בריאות (0-100)
- `get_daily_summary(user_id, date)` - סיכום יומי
- `create_default_user_categories(user_id)` - קטגוריות ברירת מחדל
- `get_top_spenders(limit, month)` - דוח הוצאות גבוהות
- `get_inactive_users(days)` - זיהוי משתמשים לא פעילים
- `calculate_loan_details(loan_id)` - חישוב פרטי הלוואה (ריבית, תשלומים) 🆕
- `calculate_net_worth(user_id)` - חישוב שווי נטו (נכסים - חובות) 🆕

## 🗂️ מבנה הפרויקט

```
finhealer/
├── app/                    # Next.js App Router
│   ├── (auth)/
│   │   └── login/         # התחברות Google
│   ├── auth/callback/     # OAuth callback
│   ├── dashboard/         # Dashboard ראשי
│   ├── reflection/        # שיקוף עבר (Phase 1) ⭐ חדש
│   ├── onboarding/        # הגדרת מספר נייד
│   ├── payment/           # דף תשלום
│   ├── api/               # API Routes
│   │   ├── reflection/
│   │   │   ├── baseline/  # שמירת baselines ⭐
│   │   │   └── profile/   # פרופיל פיננסי מלא ⭐
│   │   ├── transactions/  # ניהול תנועות ⭐
│   │   ├── dashboard/summary/  # סיכום dashboard ⭐
│   │   ├── goals/         # ניהול יעדים ⭐
│   │   ├── alerts/test/   # סימולציה התראות ⭐
│   │   ├── wa/            # WhatsApp Integration ⭐ חדש!
│   │   │   ├── webhook/   # קבלת הודעות GreenAPI
│   │   │   └── send/      # שליחת הודעות
│   │   ├── ocr/process/   # עיבוד קבלות OCR ⭐ חדש!
│   │   └── webhooks/      # webhooks אחרים
│   └── page.tsx           # Landing Page
├── components/
│   ├── ui/                # shadcn components
│   ├── reflection/        # Reflection Wizard components ⭐ חדש
│   ├── dashboard/         # Dashboard 2.0 components ⭐ מעודכן
│   │   ├── FinancialOverview.tsx     # הכנסות/הוצאות/פנוי
│   │   ├── DebtVsAssets.tsx          # מאזן חובות-נכסים
│   │   ├── SmartInsights.tsx         # תובנות חכמות
│   │   ├── PhaseProgress.tsx         # התקדמות במסע
│   │   └── GoalsQuickView.tsx        # תצוגת יעדים
│   └── shared/            # reusable components
│       └── Stepper.tsx    # Wizard stepper ⭐ חדש
├── lib/
│   ├── supabase/          # DB clients (client + server)
│   ├── greenapi/          # GreenAPI WhatsApp client ⭐ חדש!
│   ├── ocr/               # Tesseract.js OCR handler ⭐ חדש!
│   └── utils/             # helper functions (phone, cn)
├── types/
│   └── database.types.ts  # TypeScript types אוטומטיים
├── public/                # static assets
├── middleware.ts          # Auth middleware
└── memory-bank/           # תיעוד פרויקט מעודכן ⭐
    ├── projectbrief.md
    ├── techContext.md
    ├── systemPatterns.md
    ├── productContext.md
    ├── activeContext.md
    └── progress.md
```

## ✨ תכונות חדשות (18 באוקטובר 2025)

### 💰 ניהול פיננסי מלא
- **ניהול הלוואות** (`/dashboard/loans`) - מעקב אחרי כל ההלוואות והתחייבויות
- **ניהול ביטוחים** (`/dashboard/insurance`) - 5 סוגי ביטוח עם זיהוי פערי כיסוי
- **ניהול חיסכון** (`/dashboard/savings`) - חשבונות חיסכון עם יעדים ו-progress bars
- **ניהול פנסיה** (`/dashboard/pensions`) - קרנות פנסיוניות וקופות גמל

### 🎓 מערכת מדריך
- **דף מדריך מקיף** (`/guide`) - 7 נושאים עם הסברים, דוגמאות וטיפים
- **Tooltips System** - הסברים מהירים בכל שדה חשוב
- **Info Sections** - טיפים מעשיים בכל דף

### 🧮 סימולטור איחוד הלוואות (`/loans-simulator`)
- הוספה/הסרה של עד 5 הלוואות
- Sliders אינטראקטיביים לכל פרמטר
- חישובים בזמן אמת
- 2 גרפים: Bar Chart (לפני/אחרי) + Pie Chart (התפלגות)
- תצוגת חיסכון פוטנציאלי

### 📊 Dashboard משודרג
- **4 Cards חדשים:** שווי נטו, סטטוס הלוואות, ביטוח/פנסיה, התקדמות חיסכון
- **חישובים אוטומטיים** - נכסים, חובות, תזרים
- **התראות חכמות** - אזהרה על ריבית גבוהה, פערי ביטוח

### 🎨 UX Polish
- **Empty states חמים** - אנימציות + micro-copy מעודד
- **Animations חלקות** - fade-in, slide-up, bounce, scale
- **שפה נעימה** - תומכת ומעודדת בכל מקום
- **RTL מלא** - עברית מושלמת

---

## 🛠️ התקנה ופיתוח

### דרישות מקדימות
- Node.js 18+
- npm/yarn/pnpm
- חשבון Supabase
- מפתחות API (OpenAI, GreenAPI, חשבונית ירוקה)

### התקנה
```bash
# Clone the repository
git clone [repository-url]
cd finhealer

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# ערוך .env.local והזן את המפתחות שלך

# Run development server
npm run dev
```

### משתני סביבה
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# GreenAPI (WhatsApp)
GREEN_API_INSTANCE_ID=your_instance_id
GREEN_API_TOKEN=your_token

# חשבונית ירוקה
GREEN_INVOICE_API_KEY=your_api_key
GREEN_INVOICE_SECRET=your_secret
```

## 📝 תיעוד נוסף

### Memory Bank
המערכת משתמשת ב-Memory Bank לתיעוד מלא:
- **projectbrief.md** - אפיון ומטרות
- **techContext.md** - טכנולוגיות ומבנה טכני
- **systemPatterns.md** - דפוסי עיצוב וארכיטקטורה
- **productContext.md** - חוויית משתמש ומסע לקוח
- **activeContext.md** - מצב נוכחי ומשימות פתוחות
- **progress.md** - התקדמות ומטריקות

### Database Schema
לתיעוד מלא של מבנה הטבלאות, ראה:
```sql
-- ניתן לייצא את הסכמה מ-Supabase:
supabase db dump --schema public
```

## 🎨 עיצוב

### צבעי מותג
- כחול כהה: `#1E2A3B` (רקע עליון)
- כחול בינוני: `#3A7BD5` (כפתורים)
- אפור בהיר: `#F5F6F8` (רקע כללי)
- ירוק: `#7ED957` (חיובי)
- כתום: `#F6A623` (התראות)

### טיפוגרפיה
- Font: **Heebo**
- Weights: 400, 500, 700

## 🔒 אבטחה

- **RLS (Row Level Security)** - הגנה ברמת מסד הנתונים
- **Supabase Auth** - אימות משתמשים
- **JWT Tokens** - הצפנת sessions
- **HTTPS Only** - תקשורת מוצפנת
- **Webhook Verification** - אימות חתימות
- **Input Validation** - Zod schemas

## 🤖 ייבוא חכם - AI-Powered Import

המערכת תומכת בייבוא אוטומטי של נתונים מדוחות בנק ואשראי:

### תכונות
- **OCR מתקדם** - זיהוי טקסט בעברית + אנגלית (Tesseract.js + OpenAI Vision)
- **AI Parsing** - זיהוי אוטומטי של הוצאות קבועות, חובות, נכסים
- **דיוק גבוה** - יעד של 90%+ לדוחות ישראליים
- **פורמטים** - PDF, Excel/CSV, תמונות (JPG, PNG)
- **אישור משתמש** - כל נתון מאושר לפני שמירה

### תהליך
1. העלאת קובץ → 2. ניתוח (10-30 שניות) → 3. אישור → 4. מילוי אוטומטי

ראה [`IMPORT_SPEC.md`](./IMPORT_SPEC.md) לפרטים מלאים.

---

## 🎯 Phase System - מסע המשתמש

המערכת מלווה משתמשים ב-**5 שלבים הדרגתיים**:

### Phase 1: Reflection (שיקוף עבר) ✅ הושלם!
- [x] **Full Reflection Wizard** - 6 שלבים עם Stepper
  - Step 1: מידע אישי ומשפחתי (גיל, מצב משפחתי, ילדים, עיר)
  - Step 2: הכנסות (משכורת, הכנסות נוספות, בן/בת זוג)
  - Step 3: הוצאות קבועות (דיור, ביטוחים, פנסיה, ליסינג...)
  - Step 4: חובות ונכסים (כרטיסי אשראי, הלוואות, חיסכון, השקעות)
  - Step 5: היסטוריה (ממוצעי הוצאות 3-6 חודשים)
  - Step 6: מטרות (למה באת, מטרה קצרה, חלום גדול)
- [x] שמירה ב-`user_financial_profile` + `user_baselines`
- [x] **Dashboard 2.0** - CRM-style overview עם 5 קומפוננטים חכמים
  - FinancialOverview, DebtVsAssets, SmartInsights, PhaseProgress, GoalsQuickView
- [x] מעבר אוטומטי ל-Phase 2

### Phase 2: Behavior (התנהלות והרגלים)
- [ ] Cron יומי לניתוח דפוסים
- [ ] יצירת `behavior_insights`
- [ ] הודעות טיפים מותאמות
- [ ] מעבר אוטומטי ל-Phase 3

### Phase 3: Budget (תקציב אוטומטי)
- [ ] יצירת תקציב מהיסטוריה
- [ ] S-curve visualization
- [ ] התאמות בקליקים
- [ ] מעבר ל-Phase 4

### Phase 4: Goals (יעדים ומטרות)
- [x] API: GET/POST `/api/goals`
- [ ] UI מלא ב-`/goals`
- [ ] תמיכה ב-"ילדים ומטרות" (child_name)
- [ ] חוקי העברת עודפים
- [ ] מעבר ל-Phase 5

### Phase 5: Monitoring (בקרה רציפה)
- [ ] דשבורד תזרים מלא
- [ ] דוחות חודשיים/שנתיים
- [ ] התראות חכמות
- [ ] ליווי ארוך טווח

---

## 📈 Roadmap טכני

### ✅ MVP Extended (Week 3-4) - הושלם!
- [x] Phase System מלא
- [x] 6 טבלאות חדשות (כולל user_financial_profile)
- [x] 7 טבלאות עודכנו
- [x] 9 API endpoints חדשים
- [x] **Full Reflection Wizard** - 6 שלבים
- [x] **Dashboard 2.0** - CRM-style overview
- [x] 5 Dashboard Components חדשים
- [x] **WhatsApp Integration** - GreenAPI + OCR מלא
- [x] **Tesseract.js OCR** - קבלות בעברית + אנגלית

### 🔄 Week 4-5: Transactions UI + Behavior Engine
- [x] WhatsApp Integration ✅
- [ ] `/transactions` UI מלא
- [ ] Edge Functions (Cron)
- [ ] analyzeBehavior()
- [ ] טיפים מותאמים

### 🔄 Week 5-6: Transactions + Budget
- [ ] `/transactions` UI מלא
- [ ] `/budget` עם auto-generate
- [ ] S-curve alerts

### 🔄 Week 7-8: Integrations
- [ ] GreenAPI
- [ ] OpenAI
- [ ] OCR
- [ ] Green Invoice

### 🔄 Week 9-10: Admin
- [ ] Admin Dashboard
- [ ] User management
- [ ] Analytics

### 🔄 Week 11-12: Polish
- [ ] E2E tests
- [ ] Performance
- [ ] Production ready

## 🧪 בדיקות

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## 📦 Deployment

הפרויקט מתוכנן ל-deployment ב-**Vercel**:

```bash
# Production build
npm run build

# Deploy to Vercel
vercel --prod
```

## 🤝 תרומה

הפרויקט נמצא בפיתוח פעיל. לפרטים על תרומה לפרויקט, ראה את הקבצים ב-Memory Bank.

## 📄 רישיון

[לציין רישיון]

## 👥 צוות

[לציין בעלי תפקידים]

## 📞 יצירת קשר

[פרטי יצירת קשר]

---

## 🎉 סטטוס נוכחי

✅ **19 טבלאות** ב-DB (26 migrations)  
✅ **7 דפים** פעילים (כולל **Reflection**, **Dashboard 2.0**, **Transactions**)  
✅ **10 API endpoints** (transactions, goals, dashboard, profile, alerts, WhatsApp, OCR...)  
✅ **Phase System** פעיל עם מעברים אוטומטיים  
✅ **Reflection Wizard** - 6 שלבים מלאים עם Stepper + Framer Motion  
✅ **Dashboard 2.0** - 5 קומפוננטים חכמים בסגנון CRM  
✅ **WhatsApp Integration** - GreenAPI + OCR + Button Handlers מלא 🤖  
✅ **Transactions UI** - טבלה מלאה עם פילטרים וסטטיסטיקות 💳  
✅ **Google OAuth** + Middleware  
✅ **Memory Bank** מעודכן מלא  

### 🌟 **New! Reflection Wizard 2.0**
תמונת מצב פיננסית 360 מעלות:
- 📋 Step 1: מידע אישי ומשפחתי
- 💰 Step 2: הכנסות מלאות  
- 🏠 Step 3: הוצאות קבועות
- 💼 Step 4: חובות ונכסים
- 📊 Step 5: היסטוריה (3-6 חודשים)
- 🎯 Step 6: מטרות וחלומות

### 📊 **New! Dashboard 2.0 - CRM Style**
Dashboard מקצועי עם תובנות מבוססות נתונים:
- 💰 **FinancialOverview** - הכנסות/הוצאות/תקציב פנוי + אזהרות
- 💼 **DebtVsAssets** - מאזן חובות-נכסים עם progress bars
- 💡 **SmartInsights** - תובנות מותאמות (ילדים, ניצול, חובות)
- 🗺️ **PhaseProgress** - Timeline מסע המשתמש + הצעד הבא
- 🎯 **GoalsQuickView** - תצוגת יעדים + המלצות

### 📱 **New! WhatsApp Integration - GreenAPI + OCR**
אינטגרציה מלאה עם WhatsApp:
- 📥 **Webhook Handler** - קבלת הודעות טקסט ותמונות
- 🔍 **Message Parser** - זיהוי חכם של הוצאות מטקסט
  - "50 ₪ קפה" → Transaction מוצעת
  - "רכישה 120 שקל" → זיהוי סכום
- 📸 **OCR לקבלות** - Tesseract.js (עברית + אנגלית)
  - זיהוי סכום, ספק, תאריך
  - Confidence score + validation
  - יצירת Transaction אוטומטית
- 🤖 **Smart Responses**
  - הודעות עם כפתורים "כן, נכון" / "לא, ערוך"
  - טיפול בשגיאות + הודעות עזרה
- 🔘 **Button Handlers** - טיפול בלחיצות
  - אישור → `proposed` → `confirmed`
  - עריכה → מחיקה + בקשת הזנה חדשה
  - בחירת קטגוריה → עדכון `category_id`
- 📤 **Send API** - שליחה יזומה למשתמשים

### 💳 **New! Transactions Page**
דף ניהול תנועות מלא:
- 📊 **סטטיסטיקות** - הכנסות/הוצאות/ממתינות
- 🔍 **פילטרים** - חיפוש, סוג, סטטוס, קטגוריה
- 📋 **טבלה CRM** - עם zebra stripes + hover effects
- 🏷️ **Badges** - סטטוס (מאושר/ממתין), מקור (ידני/WhatsApp/קבלה)
- ⚙️ **פעולות** - ערוך/מחק (בהכנה)

**הצעד הבא:** Transactions UI + Behavior Engine + Budget Auto-Generate

---

**עדכון אחרון:** 8 באוקטובר 2025 - Pricing Plans Edition! 💳🎉🚀

### 💳 **Update! Pricing Plans**
דף תשלום חדש עם 2 תוכניות:
- 💼 **בסיסי** (49 ₪/חודש) - כל התכונות הבסיסיות + 7 ימי ניסיון חינם
- ⭐ **מתקדם** (119 ₪/חודש) - כל התכונות + פגישות אישיות מוזלות עם יועץ (2 פגישות/חודש)
- תשלום דמו תקין עובד ישירות עם Supabase
- UI מרהיב עם 2 כרטיסים זה ליד זה
- Badge "הכי פופולרי" על התוכנית המתקדמת

