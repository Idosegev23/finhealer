# 📝 Changelog - FinHealer

## [Extended MVP] - 2025-10-08 🎉

### ✨ תכונות חדשות

#### Phase System מלא
- ✅ מערכת 5 שלבים הדרגתית: `reflection` → `behavior` → `budget` → `goals` → `monitoring`
- ✅ מעברים אוטומטיים בין שלבים
- ✅ הודעות הסבר + CTA יחיד בכל מעבר

#### Database Extensions
**5 טבלאות חדשות:**
- `user_baselines` - ממוצעי הוצאות היסטוריים (3-6 חודשים)
- `behavior_insights` - דפוסי הוצאה מזוהים
- `advisor_notes` - הערות ליווי של גדי
- `alerts_rules` - חוקי התראות (over_threshold, no_spend, savings_found, stale)
- `alerts_events` - אירועי התראות (pending/sent/ack)

**7 טבלאות עודכנו:**
- `users` + שדות: `phase`, `ai_personality`, `locale`
- `transactions` + שדות: `category_id` (FK), `currency`, `tx_date`
- `budget_categories` + שדה: `priority`
- `goals` + שדות: `child_name`, `priority`
- `wa_messages` + תמיכה ב-`buttons`, `provider_msg_id`
- `receipts` + שדה: `tx_date`
- `subscriptions` + שדות: `renewed_at`, `canceled_at`

#### דפים חדשים
- **`/reflection`** - אשף שיקוף עבר (Phase 1)
  - בחירת תקופה (3-6 חודשים)
  - טופס עם כל הקטגוריות
  - סיכום חודשי + יומי
  - מעבר אוטומטי ל-Phase 2

#### API Endpoints חדשים
1. **`POST /api/reflection/baseline`**
   - שמירת baselines למשתמש
   - עדכון phase ל-'behavior'
   - יצירת alert מעבר שלבים

2. **`GET/POST /api/transactions`**
   - GET: שליפה עם filters (from, to, category, type, status, pagination)
   - POST: יצירה/עדכון תנועה (proposed/confirmed)

3. **`GET /api/dashboard/summary`**
   - סיכום מלא: financial_health, monthly stats, budget tracking, goals, alerts
   - Cache 60 שניות
   - תמיכה בכל ה-phases

4. **`GET/POST /api/goals`**
   - GET: שליפת יעדים (priority + created_at)
   - POST: יצירה/עדכון יעד
   - תמיכה ב-`child_name` (ילדים ומטרות)
   - מעבר אוטומטי ל-'monitoring' ביעד ראשון

5. **`POST /api/alerts/test`**
   - סימולציה לחוקי התראות
   - תמיכה ב-4 סוגי חוקים
   - החזרת פרטי ההדלקה

### 🔧 שיפורים

#### Memory Bank מעודכן
- `productContext.md` - מסע משתמש ב-5 שלבים
- `systemPatterns.md` - זרימות חדשות (Phase Transitions, Budget Auto, Goals)
- `techContext.md` - טבלאות חדשות
- `activeContext.md` - משימות מעודכנות
- `progress.md` - סטטוס מלא

#### קוד
- React Hook Form + Zod validation ב-ReflectionForm
- TypeScript types מלאים
- Error handling מקיף
- Loading states
- RTL support מלא

### 📊 סטטיסטיקות

#### Database
- **25 migrations** (מ-18 ל-25, +7 חדשים)
- **18 טבלאות** (מ-13 ל-18, +5 חדשות)
- **7 טבלאות** עודכנו עם שדות חדשים

#### Code
- **7 קבצים חדשים** נוצרו
- **4 קבצי Memory Bank** עודכנו
- **0 linter errors** 🎉

#### Features
- **Phase System** פעיל מלא
- **5 API endpoints** חדשים
- **1 דף** חדש (Reflection)
- **1 קומפוננט** חדש (ReflectionForm)

### 🎯 הצעד הבא

#### Week 4: Behavior Engine
- [ ] Cron יומי (Edge Function)
- [ ] analyzeBehavior() → behavior_insights
- [ ] הודעות טיפים מותאמות
- [ ] Dashboard: הצגת תובנות

#### Week 5-6: Transactions + Budget
- [ ] `/transactions` UI מלא
- [ ] `/budget` עם auto-generate
- [ ] S-curve visualization

---

## [MVP] - 2025-10-05

### ✨ תכונות ראשוניות
- ✅ 13 טבלאות ב-DB עם RLS מלא
- ✅ Google OAuth
- ✅ Landing Page
- ✅ Dashboard בסיסי
- ✅ Onboarding עם מספר טלפון
- ✅ 18 migrations ראשוניים

---

**הערה:** Changelog זה מתעד רק שינויים מרכזיים. לפרטים מלאים ראה `memory-bank/progress.md`


