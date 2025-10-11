# הקשר טכנולוגי - FinHealer

## מחסנית הטכנולוגיות

### Frontend
- **Next.js 14+** - App Router עם Server Components
- **TypeScript** - בטיחות טיפוסים מלאה
- **Tailwind CSS** - עיצוב מותאם אישית
- **shadcn/ui** - ספריית קומפוננטים
- **Framer Motion** - אנימציות חלקות
- **React Hook Form + Zod** - ולידציה וטפסים
- **Recharts** - ויזואליזציית נתונים

### Backend
- **Supabase** - פלטפורמת Backend מלאה:
  - PostgreSQL Database
  - Authentication (Email, Social)
  - Row Level Security (RLS)
  - Edge Functions
  - Storage
  - Realtime Subscriptions

### אינטגרציות חיצוניות

#### 1. GreenAPI (WhatsApp Business API)
- שליחת הודעות דו-כיוונית
- קבלת תמונות וטקסטים
- Webhooks לעדכוני סטטוס
- תמיכה מלאה בעברית

#### 2. OpenAI API
- GPT-4 לבוט פיננסי חכם
- תמיכה בעברית
- Context מותאם אישית לכל משתמש
- Streaming responses

#### 3. Tesseract.js (OCR)
- זיהוי קבלות בעברית
- חילוץ סכומים ותאריכים
- עבודה בדפדפן (client-side)

#### 4. חשבונית ירוקה (Green Invoice)
- מנויים חוזרים
- Webhooks לעדכוני תשלום
- חשבוניות אוטומטיות
- ניהול לקוחות

## מבנה מסד הנתונים

### טבלאות מרכזיות

#### users
משתמשי המערכת - מידע בסיסי, סטטוס מנוי, הרשמה לוואטסאפ

#### transactions
תנועות כספיות - הוצאות והכנסות, מקור (manual/whatsapp/ocr), סטטוס

#### budget_categories
קטגוריות תקציב - תקרה חודשית, צבע, פעילה

#### goals
יעדים פיננסיים - סכום יעד, התקדמות, תאריך יעד

#### wa_messages
הודעות וואטסאפ - כיוון, סוג, payload, סטטוס

#### alerts
התראות למשתמש - חריגות תקציב, תזכורות, עידוד

#### subscriptions
מנויים - תוכנית, ספק, סטטוס, תאריכים

#### receipts
קבלות - OCR text, סכום, ספק, רמת ודאות

#### admin_users
מנהלי מערכת - תפקידים והרשאות

#### message_templates
תבניות הודעות - לשימוש הבוט והתראות

#### user_settings
הגדרות משתמש - התראות, שפה, מטבע

#### audit_logs
לוגים - מעקב אחרי פעולות במערכת

#### default_categories
קטגוריות ברירת מחדל - נוצרות אוטומטית למשתמש חדש

#### user_baselines
ממוצעי הוצאות היסטוריים (3-6 חודשים) - Phase 1: Reflection

#### behavior_insights
דפוסי הוצאה מזוהים - Phase 2: Behavior

#### advisor_notes
הערות של גדי (ליווי אנושי)

#### alerts_rules
חוקי התראות (thresholds, S-curve, cadence)

#### alerts_events
אירועי התראות (pending/sent/ack)

### Views מרכזיים

#### monthly_budget_tracking
מעקב תקציב חודשי בזמן אמת לפי קטגוריה

#### user_monthly_stats
סטטיסטיקות חודשיות למשתמש

#### active_users_stats
נתונים על משתמשים פעילים ומנויים

#### category_spending_report
דוח הוצאות לפי קטגוריה

#### goals_progress_report
דוח התקדמות יעדים

### פונקציות מרכזיות

#### calculate_financial_health(user_id)
חישוב ציון בריאות פיננסית (0-100) על בסיס:
- יחס חיסכון (30%)
- עמידה בתקציב (40%)
- התקדמות ביעדים (30%)

#### get_daily_summary(user_id, date)
סיכום יומי של תנועות ומצב תקציב

#### create_default_user_categories(user_id)
יצירת קטגוריות ברירת מחדל למשתמש חדש

#### is_admin()
בדיקה האם המשתמש הנוכחי הוא אדמין

#### get_top_spenders(limit, month)
קבלת המשתמשים עם ההוצאות הגבוהות ביותר

#### get_inactive_users(days)
זיהוי משתמשים שלא היו פעילים

## אבטחה

### Row Level Security (RLS)
- כל טבלה מוגנת ב-RLS
- משתמש רואה רק את הנתונים שלו
- אדמינים רואים הכל (עם policies מיוחדות)

### Authentication
- Supabase Auth
- תמיכה ב-Email/Password
- אפשרות להוספת Social Auth בעתיד

### הצפנה
- HTTPS בלבד
- JWT tokens
- אימות Webhooks

## Storage

### Buckets
1. **receipts** - קבלות משתמשים (private)
2. **avatars** - תמונות פרופיל (public)

### Policies
- משתמש יכול להעלות/לצפות/למחוק רק קבלות שלו
- אדמין יכול לצפות בכל הקבלות

## Triggers & Automation

### Trigger: setup_new_user
נקרא אוטומטית לאחר יצירת משתמש חדש:
- יוצר קטגוריות ברירת מחדל
- יוצר הגדרות משתמש ברירת מחדל

### Trigger: update_updated_at
מעדכן אוטומטית את שדה updated_at בעריכה

## סביבת פיתוח

### דרישות
- Node.js 18+
- npm/yarn/pnpm
- חשבון Supabase
- מפתחות API:
  - OpenAI
  - GreenAPI
  - חשבונית ירוקה

### משתני סביבה נדרשים
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=

GREEN_API_INSTANCE_ID=
GREEN_API_TOKEN=

GREEN_INVOICE_API_KEY=
GREEN_INVOICE_SECRET=
```

## Deployment

### Vercel
- Deployment אוטומטי מ-Git
- Edge Functions
- Environment Variables
- Preview Deployments

### Monitoring
- Sentry לשגיאות
- Supabase Logs
- Vercel Analytics

