# הקשר פעיל - FinHealer

## מיקום נוכחי בפרויקט

### 🎉 **עדכון אחרון: 22 באוקטובר 2025 - Loan Application System!**

### מה עשינו עד כה? ✅
1. **הקמת מסד נתונים מלא בסופאבייס**
   - 19 טבלאות עם RLS מלא
   - Views למעקב ואנליטיקה
   - פונקציות עזר (בריאות פיננסית, סיכומים)
   - Triggers אוטומטיים (הקמת משתמש חדש)
   - Storage buckets (קבלות, אווטרים)
   - קטגוריות ברירת מחדל
   - תבניות הודעות

### מה נוצר?
**טבלאות:**
- ✅ users - משתמשים בסיסיים
- ✅ transactions - תנועות כספיות
- ✅ budget_categories - קטגוריות תקציב
- ✅ goals - יעדים פיננסיים
- ✅ wa_messages - הודעות WhatsApp
- ✅ alerts - התראות למשתמש
- ✅ subscriptions - מנויים
- ✅ receipts - קבלות OCR
- ✅ admin_users - מנהלי מערכת
- ✅ message_templates - תבניות הודעות
- ✅ user_settings - הגדרות משתמש
- ✅ audit_logs - לוגים
- ✅ default_categories - קטגוריות ברירת מחדל

**Views:**
- ✅ monthly_budget_tracking - מעקב תקציב חודשי
- ✅ user_monthly_stats - סטטיסטיקות משתמש
- ✅ active_users_stats - משתמשים פעילים
- ✅ category_spending_report - דוח הוצאות
- ✅ goals_progress_report - דוח יעדים

**פונקציות:**
- ✅ calculate_financial_health - חישוב ציון בריאות
- ✅ get_daily_summary - סיכום יומי
- ✅ create_default_user_categories - יצירת קטגוריות
- ✅ is_admin - בדיקת הרשאות אדמין
- ✅ get_top_spenders - דוח הוצאות גבוהות
- ✅ get_inactive_users - זיהוי משתמשים לא פעילים

**Policies:**
- ✅ RLS מלא לכל הטבלאות
- ✅ הרשאות אדמין מורחבות
- ✅ Storage policies

## מה הלאה? 🎯

### שלב נוכחי: המשך הרחבת ה-MVP - Week 4

**השלמנו בשבוע 3:**
✅ תשתית Next.js מלאה
✅ Landing Page + Google OAuth
✅ Onboarding בסיסי
✅ Dashboard MVP → **Dashboard 2.0** (CRM-style!) 🚀
✅ DB עם 19 טבלאות
✅ **Full Reflection Wizard** - 6 שלבים
✅ **user_financial_profile** - תמונת מצב 360°

**צריך להוסיף:**

### Priority 1: Database Extensions ✅ הושלם!
- ✅ הוספת טבלאות חדשות:
  - user_baselines 
  - behavior_insights 
  - advisor_notes
  - alerts_rules
  - alerts_events
  - user_financial_profile (360° profile)
- ✅ עדכון users: phase + ai_personality + locale
- ✅ עדכון transactions: category_id FK + currency + tx_date
- ✅ עדכון goals: child_name + priority
- ✅ עדכון budget_categories: priority
- ✅ עדכון receipts: tx_date

### Priority 2: Phase 1 - Reflection ✅ הושלם!
- ✅ דף `/reflection` - Wizard מלא ב-6 שלבים
- ✅ טבלת קטגוריות עם ממוצעים (3-6 חודשים)
- ✅ איסוף מלא: אישי, הכנסות, קבועות, חובות, נכסים, מטרות
- ✅ API: `POST /api/reflection/baseline`
- ✅ API: `GET/POST /api/reflection/profile`
- ✅ לוגיקת מעבר ל-Phase 2 (Behavior)

### Priority 2.5: Dashboard 2.0 ✅ הושלם!
- ✅ **FinancialOverview** - הכנסות/הוצאות/תקציב פנוי
- ✅ **DebtVsAssets** - ויזואליזציה של מאזן
- ✅ **SmartInsights** - תובנות מבוססות פרופיל
- ✅ **PhaseProgress** - Timeline מסע + הצעד הבא
- ✅ **GoalsQuickView** - תצוגת יעדים + המלצות
- ✅ Layout: 2/3 שמאל + 1/3 ימין
- ✅ עיצוב CRM מקצועי

### Priority 2.6: UX Polish + AI Import Spec ✅ הושלם! (9 באוקטובר)
- ✅ **Stepper Upgrade** - החלפה ל-`motion` library
  - אנימציות spring physics חלקות
  - slide transitions מתקדמות
  - עיצוב FinHealer מותאם (צבעים, RTL)
  - Stepper.css responsive
- ✅ **תיקוני Reflection Wizard**
  - שדה גילאי ילדים: תמיכה בפסיקים/רווחים + visual feedback
  - Step 3: הבהרות, העלאת דוח בנק (UI)
  - Step 4: "מינוס/אשראי שוטף", שדה יתרת עו״ש חדש
- ✅ **AI Import Infrastructure**
  - מפרט מפורט ב-`IMPORT_SPEC.md`
  - תכנון OCR + AI parsing
  - יעד דיוק 90%+
  - תמיכה ב-PDF/Excel/Images

### Priority 2.7: Loan Application System ✅ הושלם! (22 באוקטובר)
- ✅ **Database Tables**
  - `loan_applications` - בקשות לאיחוד הלוואות
  - `loan_documents` - מסמכים מועלים עם מעקב אימות
  - RLS policies מלאות למשתמשים
  - Storage bucket `loan-documents` (נדרש setup ידני)
- ✅ **Smart Document System** (`lib/loanDocuments.ts`)
  - דינמי לפי סוג הלוואה (regular/mortgage)
  - דינמי לפי סוג תעסוקה (employee/self_employed/business_owner/spouse_employee)
  - קישורים חיצוניים (בנק ישראל, וכו')
  - חישוב progress אוטומטי
- ✅ **3-Step Wizard** (`components/loans/LoanApplicationWizard.tsx`)
  - שלב 1: פרטים אישיים (conditional fields)
  - שלב 2: פרטי הלוואה + סיכום הלוואות קיימות
  - שלב 3: צ'קליסט מסמכים + העלאות
  - שמירה אוטומטית (draft status)
  - מעקב progress באחוזים
- ✅ **Simulator Upgrade** (`/loans-simulator`)
  - טעינה אוטומטית של הלוואות מה-DB
  - אינדיקציה ויזואלית של טעינה
  - כפתור "הגש בקשה לאיחוד"
  - חיבור ל-Wizard
- ✅ **API Routes**
  - `POST/GET/PATCH /api/loan-applications`
  - `POST/GET/DELETE /api/loan-applications/documents`
- ✅ **Documentation**
  - `STORAGE_SETUP.md` - הנחיות להגדרת Storage RLS
  - `LOAN_APPLICATION_MIGRATION.sql` - SQL migration מלא
  - עדכון README עם הפיצ'רים החדשים

### Priority 3: Phase 2 - Behavior Engine (שבוע הבא)
- [ ] Cron יומי לניתוח דפוסים
- [ ] יצירת behavior_insights
- [ ] הודעות טיפים מותאמות
- [ ] Dashboard: הצגת תובנות

### Priority 4: Transactions Management (שבוע הבא)
- [ ] דף `/transactions` - טבלה מלאה
- [ ] Add/Edit Modal (React Hook Form + Zod)
- [ ] Upload Receipt → OCR
- [ ] Filters: תאריך, קטגוריה, סטטוס
- [ ] תמיכה ב-proposed/confirmed
- [ ] API: GET/POST `/api/transactions`

### Priority 5: Phase 3 - Budget Auto (שבועיים)
- [ ] דף `/budget` 
- [ ] פונקציה: generateBudgetFromHistory()
- [ ] S-curve visualization
- [ ] התאמות בקליקים
- [ ] מעבר ל-Phase 4

### Priority 6: Phase 4 - Goals (שבועיים)
- [ ] דף `/goals`
- [ ] תמיכה ב-child_name (ילדים ומטרות)
- [ ] חוקי העברת עודפים
- [ ] API: GET/POST `/api/goals`

### Priority 7: Integrations ⭐ חלקי הושלם!
- ✅ **GreenAPI** - webhook + send + buttons מלא!
- ✅ **Tesseract.js** - OCR לקבלות (עברית + אנגלית)
- [ ] OpenAI: בוט AI בעברית (בתור ש 5-6)
- [ ] Green Invoice: Recurring billing (בשבוע 5-6)

### Priority 8: Admin Dashboard (שבוע)
- [ ] `/admin/dashboard` - KPIs
- [ ] `/admin/users` - ניהול משתמשים
- [ ] `/admin/user/[id]` - כרטיס לקוח מלא
- [ ] `/admin/messages` - תבניות וקמפיינים
- [ ] Advisor Notes: POST `/api/advice/note`

## החלטות פתוחות

### שאלות שצריך לענות עליהן
1. **אינטגרציית חשבונית ירוקה**
   - מה המפתחות הנדרשים?
   - איך נבנה את ה-webhook handler?

2. **GreenAPI Setup**
   - מהם פרטי החיבור?
   - איך נבנה את ה-webhook לקבלת הודעות?

3. **OpenAI Integration**
   - איזה מודל נשתמש? (GPT-4?)
   - מה ה-system prompt?
   - איך נגביל שימוש?

4. **עיצוב**
   - צריך דוגמאות עיצוב?
   - לוגו קיים?
   - צבעי המותג מוגדרים? (כן, בקובץ projectbrief)

## בעיות ידועות
- אין (עדיין פרויקט חדש)

## הערות חשובות
- השפה העיקרית היא **עברית** - UI, הודעות, בוט
- המערכת צריכה להיות רספונסיבית מלאה (Mobile First)
- חווית המשתמש צריכה להיות פשוטה ונעימה
- הבוט צריך לדבר בשפה חמה ומעודדת, לא פורמלית

