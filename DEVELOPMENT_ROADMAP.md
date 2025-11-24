# 🗺️ Phi (φ) - תוכנית פיתוח מפורטת

## 📅 Timeline Overview

```
Week 1-2   │ Phase System (Behavior + Budget)
Week 3-4   │ Phase System (Goals + Monitoring)
Week 5     │ AI Integration + Cron
Week 6     │ Admin Dashboard + Payments
Week 7     │ Advanced Features
Week 8     │ QA + Polish
Week 9-10  │ Beta Testing + Iterations
```

---

## 🎯 Sprint 1-2: Phase System Complete (שבועיים)

### Week 1: Phase 2 (Behavior) + Phase 3 (Budget Auto)

#### Day 1-2: Phase 2 - Behavior Engine
**מטרה:** זיהוי דפוסי הוצאה אוטומטי

##### Backend Tasks
- [ ] פונקציה: `analyzeBehavior(user_id)`
  ```sql
  -- Location: supabase/migrations/
  CREATE OR REPLACE FUNCTION analyze_behavior(p_user_id UUID)
  RETURNS jsonb AS $$
  -- Logic:
  -- 1. שלוף transactions מ-30 ימים אחרונים
  -- 2. זהה דפוסים:
  --    - ימי שיא הוצאה (יום בשבוע)
  --    - שעות שיא הוצאה
  --    - קטגוריות דומיננטיות
  --    - ספקים חוזרים
  -- 3. השווה ל-user_baselines
  -- 4. הכנס ל-behavior_insights
  $$;
  ```
  
- [ ] Edge Function: `daily-behavior-analysis`
  ```typescript
  // Location: supabase/functions/daily-behavior-analysis/
  // קורא מ-Cron Job (20:30)
  // 1. רשימת משתמשים ב-Phase 2
  // 2. קריאה ל-analyze_behavior() לכל אחד
  // 3. אם יש תובנות חדשות → שליחת הודעה
  ```

##### Frontend Tasks
- [ ] קומפוננטה: `BehaviorInsights.tsx`
  ```typescript
  // Location: components/dashboard/BehaviorInsights.tsx
  // Props: insights[], phase
  // UI: כרטיס עם תובנות מעניינות
  // - "אתה מוציא הכי הרבה בימי שישי בערב 🛒"
  // - "80% מההוצאות שלך בקטגוריית מזון"
  // - "חרגת ב-15% מהממוצע שלך בחודש הזה"
  ```

- [ ] עדכון Dashboard: הצגת BehaviorInsights
  ```typescript
  // Location: app/dashboard/page.tsx
  // הוספת BehaviorInsights אם phase >= 'behavior'
  ```

##### API Tasks
- [ ] GET `/api/behavior/insights`
  ```typescript
  // Location: app/api/behavior/insights/route.ts
  // שלוף behavior_insights אחרונים
  // סינון לפי severity (high/medium/low)
  ```

**זמן משוער:** 2 ימים

---

#### Day 3-5: Phase 3 - Budget Auto-Generate

##### Backend Tasks
- [ ] פונקציה: `generateBudgetFromHistory(user_id)`
  ```sql
  CREATE OR REPLACE FUNCTION generate_budget_from_history(p_user_id UUID)
  RETURNS jsonb AS $$
  -- Logic:
  -- 1. שלוף user_baselines (ממוצעים)
  -- 2. שלוף behavior_insights (התאמות)
  -- 3. חשב לכל קטגוריה:
  --    baseline * 1.1 (buffer 10%)
  --    או baseline * behavior_factor (אם יש התנהגות חריגה)
  -- 4. החזר JSON עם הצעת תקציב
  $$;
  ```

- [ ] טבלה חדשה: `budget_proposals` (אופציונלי)
  ```sql
  CREATE TABLE budget_proposals (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    proposed_at TIMESTAMPTZ DEFAULT NOW(),
    data JSONB, -- הצעת התקציב
    status TEXT DEFAULT 'pending', -- pending/accepted/rejected
    accepted_at TIMESTAMPTZ
  );
  ```

##### Frontend Tasks
- [ ] דף `/budget` משופר
  ```typescript
  // Location: app/dashboard/budget/page.tsx
  // Sections:
  // 1. כפתור "צור תקציב אוטומטי" (אם עדיין אין)
  // 2. הצגת ההצעה עם כל קטגוריה
  // 3. Sliders לכיול מהיר
  // 4. כפתור אישור
  ```

- [ ] קומפוננטה: `BudgetProposal.tsx`
  ```typescript
  // Location: components/budget/BudgetProposal.tsx
  // Props: proposal, onAdjust, onApprove
  // UI: טבלה עם כל קטגוריה:
  // - שם קטגוריה
  // - ממוצע (baseline)
  // - הצעה (באר)
  // - Slider לשינוי
  // - Total בתחתית
  ```

- [ ] קומפוננטה: `SCurveChart.tsx`
  ```typescript
  // Location: components/budget/SCurveChart.tsx
  // Props: category, spent, cap, daysInMonth, currentDay
  // UI: גרף S-curve:
  // - ציר X: ימים בחודש (1-30)
  // - ציר Y: % מהתקציב
  // - קו ירוק: עקומה "בריאה" (S-curve)
  // - קו אדום: ההוצאה בפועל
  // - נקודה נוכחית
  ```

##### API Tasks
- [ ] POST `/api/budget/generate`
  ```typescript
  // Location: app/api/budget/generate/route.ts
  // קריאה ל-generateBudgetFromHistory()
  // שמירה ב-budget_proposals
  // החזרת ההצעה
  ```

- [ ] POST `/api/budget/approve`
  ```typescript
  // Location: app/api/budget/approve/route.ts
  // 1. עדכון budget_categories עם הערכים החדשים
  // 2. סימון ההצעה כ-accepted
  // 3. עדכון user.phase = 'goals'
  // 4. שליחת הודעת WhatsApp: "תקציב מאושר! עכשיו בואו נגדיר יעדים 🎯"
  ```

**זמן משוער:** 3 ימים

---

### Week 2: Phase 4 (Goals) + Phase 5 (Monitoring)

#### Day 1-3: Phase 4 - Goals UI + Rules

##### Backend Tasks
- [ ] טבלה: `goal_surplus_rules` (חדש)
  ```sql
  CREATE TABLE goal_surplus_rules (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    goal_id UUID REFERENCES goals(id),
    category_id UUID REFERENCES budget_categories(id),
    transfer_percentage INT, -- % להעביר (0-100)
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [ ] פונקציה: `applySurplusRules(user_id, month)`
  ```sql
  CREATE OR REPLACE FUNCTION apply_surplus_rules(p_user_id UUID, p_month DATE)
  RETURNS jsonb AS $$
  -- Logic:
  -- 1. שלוף סיכום הוצאות לחודש
  -- 2. חשב עודפים לכל קטגוריה (cap - spent)
  -- 3. שלוף goal_surplus_rules פעילים
  -- 4. העבר עודפים לפי החוקים
  -- 5. עדכן goals.current_amount
  -- 6. החזר סיכום
  $$;
  ```

- [ ] Edge Function: `monthly-surplus-transfer`
  ```typescript
  // Location: supabase/functions/monthly-surplus-transfer/
  // רץ בתחילת כל חודש (1st, 00:00)
  // 1. רשימת משתמשים ב-Phase 4+
  // 2. קריאה ל-applySurplusRules() לכל אחד
  // 3. שליחת הודעה: "העברנו X ₪ לחיסכון! 🎉"
  ```

##### Frontend Tasks
- [ ] דף `/goals` מחודש
  ```typescript
  // Location: app/dashboard/goals/page.tsx
  // Sections:
  // 1. רשימת יעדים עם progress bars
  // 2. כפתור "הוסף יעד חדש"
  // 3. Tab "חוקי עודפים"
  ```

- [ ] קומפוננטה: `GoalCard.tsx`
  ```typescript
  // Location: components/goals/GoalCard.tsx
  // Props: goal
  // UI:
  // - שם יעד (אייקון לפי סוג)
  // - progress bar
  // - current / target
  // - תאריך יעד
  // - % השלמה
  // - כפתור עריכה/מחיקה
  ```

- [ ] קומפוננטה: `SurplusRulesManager.tsx`
  ```typescript
  // Location: components/goals/SurplusRulesManager.tsx
  // Props: rules[], goals[], categories[]
  // UI: טבלה:
  // - קטגוריה (select)
  // - יעד יעד (select)
  // - % להעביר (slider)
  // - פעיל (checkbox)
  // כפתור "הוסף חוק"
  ```

##### API Tasks
- [ ] POST `/api/goals/surplus-rules`
  ```typescript
  // Location: app/api/goals/surplus-rules/route.ts
  // CRUD לחוקי עודפים
  ```

**זמן משוער:** 3 ימים

---

#### Day 4-5: Phase 5 - Monitoring Dashboard

##### Frontend Tasks
- [ ] קומפוננטה: `CashFlowTimeline.tsx`
  ```typescript
  // Location: components/dashboard/CashFlowTimeline.tsx
  // Props: transactions[], budgets[], goals[]
  // UI: Timeline אינטראקטיבי:
  // - ציר זמן (יומי/שבועי/חודשי)
  // - יתרה לפני/אחרי
  // - נקודות להוצאות גדולות
  // - Tooltip עם פרטים
  ```

- [ ] קומפוננטה: `MonthlyComparison.tsx`
  ```typescript
  // Location: components/reports/MonthlyComparison.tsx
  // Props: currentMonth, previousMonth
  // UI: השוואה צד-בצד:
  // - הכנסות (חודש זה vs קודם)
  // - הוצאות (חודש זה vs קודם)
  // - חיסכון (חודש זה vs קודם)
  // - % שינוי (ירוק/אדום)
  ```

- [ ] עדכון Dashboard: הצגת Monitoring למשתמשים ב-Phase 5

**זמן משוער:** 2 ימים

---

## 🤖 Sprint 3: AI Integration + Cron (שבוע)

### Day 1-3: OpenAI Integration

#### Backend Tasks
- [ ] קובץ: `lib/ai/openai-client.ts`
  ```typescript
  import OpenAI from 'openai';
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  export async function chatWithAI(
    userId: string,
    message: string,
    context: FinancialContext
  ): Promise<string> {
    // 1. בנה system prompt
    // 2. הוסף context (phase, spending, goals, alerts)
    // 3. קרא ל-OpenAI
    // 4. החזר תשובה
  }
  ```

- [ ] קובץ: `lib/ai/context-builder.ts`
  ```typescript
  export async function buildFinancialContext(userId: string) {
    // שלוף:
    // - user.phase
    // - הוצאות החודש
    // - user_baselines
    // - alerts_events אחרונים (3 ימים)
    // - goals progress
    // - behavior_insights אחרונים
    // החזר JSON מסודר
  }
  ```

- [ ] קובץ: `lib/ai/system-prompts.ts`
  ```typescript
  export const FINANCIAL_COACH_PROMPT = `
  אתה מאמן φ (Phi) - מאמן פיננסי אישי ישראלי.
  אתה מלווה את המשתמש למצוא את ה-φ שלו - האיזון המושלם בין הכנסות להוצאות.
  
  דבר בשפה חמה, פשוטה וידידותית. תן עצות מעשיות, לא תיאורטיות.
  אל תיתן ייעוץ פיננסי או משפטי פורמלי - אתה מלווה, לא יועץ.
  השתמש באימוג'ים במידה. תמיד עודד ותמוך.
  השתמש במונח "ציון φ" או "φ Score" כשמדברים על בריאות פיננסית.
  
  בסיום התשובה, הצע עד 3 צעדים קטנים שהמשתמש יכול לעשות.
  `;
  ```

#### Frontend Tasks
- [ ] דף `/assistant`
  ```typescript
  // Location: app/dashboard/assistant/page.tsx
  // UI:
  // - חלון צ'אט (messages list)
  // - Input box + שלח
  // - Streaming response (typewriter effect)
  // - Empty state: "שאל אותי כל שאלה על הכספים שלך"
  ```

- [ ] קומפוננטה: `ChatMessage.tsx`
  ```typescript
  // Location: components/assistant/ChatMessage.tsx
  // Props: message, role (user/assistant)
  // UI: בועת צ'אט עם:
  // - אווטר (משתמש / φ לוגו)
  // - תוכן (markdown support)
  // - זמן
  ```

#### API Tasks
- [ ] POST `/api/ai/chat`
  ```typescript
  // Location: app/api/ai/chat/route.ts
  export async function POST(request: Request) {
    const { message, userId } = await request.json();
    
    // 1. בנה context
    const context = await buildFinancialContext(userId);
    
    // 2. קרא ל-OpenAI
    const response = await chatWithAI(userId, message, context);
    
    // 3. שמור ב-chat_history (טבלה חדשה)
    
    return Response.json({ response });
  }
  ```

#### WhatsApp Integration
- [ ] עדכון `/api/wa/webhook`
  ```typescript
  // הוספת לוגיקה:
  // אם ההודעה לא נראית כמו הוצאה → שלח ל-AI
  if (!isExpenseMessage(messageText)) {
    const context = await buildFinancialContext(userId);
    const aiResponse = await chatWithAI(userId, messageText, context);
    await sendWhatsAppMessage(phone, aiResponse);
  }
  ```

**זמן משוער:** 3 ימים

---

### Day 4-5: Cron Jobs Activation

#### Tasks
- [ ] Vercel Cron configuration
  ```json
  // Location: vercel.json
  {
    "crons": [
      {
        "path": "/api/cron/daily-summary",
        "schedule": "30 20 * * *"
      },
      {
        "path": "/api/cron/hourly-alerts",
        "schedule": "0 * * * *"
      },
      {
        "path": "/api/cron/weekly-report",
        "schedule": "0 9 * * 1"
      },
      {
        "path": "/api/cron/monthly-budget",
        "schedule": "0 0 1 * *"
      },
      {
        "path": "/api/cron/update-phases",
        "schedule": "0 1 * * *"
      }
    ]
  }
  ```

- [ ] עדכון כל ה-Cron routes
  ```typescript
  // הוספת:
  // 1. Authorization header check (CRON_SECRET)
  // 2. Error handling + retry logic
  // 3. Logging (audit_logs)
  // 4. Rate limiting
  ```

- [ ] טבלה: `cron_jobs_log`
  ```sql
  CREATE TABLE cron_jobs_log (
    id UUID PRIMARY KEY,
    job_name TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    status TEXT, -- success/failed
    processed_count INT,
    errors JSONB
  );
  ```

**זמן משוער:** 2 ימים

---

## 👨‍💼 Sprint 4: Admin Dashboard + Payments (שבוע)

### Day 1-3: Admin Dashboard

#### Backend Tasks
- [ ] טבלה: `admin_roles`
  ```sql
  CREATE TABLE admin_roles (
    user_id UUID REFERENCES users(id),
    role TEXT, -- admin, support, viewer
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id)
  );
  ```

- [ ] View: `admin_user_stats`
  ```sql
  CREATE VIEW admin_user_stats AS
  SELECT
    u.id,
    u.full_name,
    u.email,
    u.phase,
    s.plan,
    s.status AS subscription_status,
    COUNT(DISTINCT t.id) AS total_transactions,
    MAX(t.created_at) AS last_activity
  FROM users u
  LEFT JOIN subscriptions s ON s.user_id = u.id
  LEFT JOIN transactions t ON t.user_id = u.id
  GROUP BY u.id, s.plan, s.status;
  ```

#### Frontend Tasks
- [ ] Layout: `/admin/layout.tsx`
  ```typescript
  // Sidebar עם:
  // - Dashboard (KPIs)
  // - Users (ניהול)
  // - Messages (תבניות)
  // - Analytics
  // - Settings
  ```

- [ ] דף: `/admin/dashboard`
  ```typescript
  // KPIs:
  // - Total Users
  // - Active Users (7/30 days)
  // - MRR (Monthly Recurring Revenue)
  // - Churn Rate
  // - Avg. Transaction/User
  // גרפים:
  // - Signups over time
  // - Revenue over time
  // - Phase distribution (pie)
  ```

- [ ] דף: `/admin/users`
  ```typescript
  // טבלה:
  // - ID, Name, Email, Phase, Plan, Status, Last Activity
  // - Filters: Phase, Plan, Status
  // - Search: Name/Email
  // - Actions: View, Send Message, Suspend
  ```

- [ ] דף: `/admin/user/[id]`
  ```typescript
  // כרטיס לקוח מפורט:
  // Section 1: פרטים אישיים
  // Section 2: סיכום פיננסי (dashboard-style)
  // Section 3: היסטוריית פעילות
  // Section 4: הערות יועץ (advisor_notes)
  // Section 5: שליחת הודעה ישירה
  ```

#### API Tasks
- [ ] GET `/api/admin/stats`
- [ ] GET `/api/admin/users`
- [ ] POST `/api/admin/send-message`
- [ ] POST `/api/advice/note`

**זמן משוער:** 3 ימים

---

### Day 4-5: Payments Integration

#### Tasks
- [ ] חשבונית ירוקה API Setup
  ```typescript
  // Location: lib/green-invoice/client.ts
  import axios from 'axios';
  
  const GI_API = axios.create({
    baseURL: 'https://api.greeninvoice.co.il/api/v1',
    headers: {
      'Authorization': `Bearer ${process.env.GREEN_INVOICE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  export async function createRecurringSubscription(userData) {
    // יצירת מנוי חוזר
  }
  
  export async function cancelSubscription(subscriptionId) {
    // ביטול מנוי
  }
  ```

- [ ] Webhook Handler
  ```typescript
  // Location: app/api/webhooks/green-invoice/route.ts
  export async function POST(request: Request) {
    // 1. Verify signature
    // 2. Parse event type:
    //    - subscription.created
    //    - subscription.renewed
    //    - subscription.canceled
    //    - payment.succeeded
    //    - payment.failed
    // 3. עדכון subscriptions table
    // 4. שליחת הודעה למשתמש
  }
  ```

- [ ] עדכון דף `/payment`
  ```typescript
  // החלפת Mock ב-Green Invoice אמיתי
  // כפתור מוביל לטופס Green Invoice
  ```

**זמן משוער:** 2 ימים

---

## 🚀 Sprint 5: Advanced Features (שבוע)

### Day 1-3: AI-Powered Import

#### Tasks
- [ ] קומפוננטה: `FileUploader.tsx`
  ```typescript
  // Location: components/shared/FileUploader.tsx
  // Props: onUpload, acceptedTypes
  // UI:
  // - Drag & Drop zone
  // - File list
  // - Progress bar
  // - Preview (PDF/Image)
  ```

- [ ] API: POST `/api/import/analyze`
  ```typescript
  // 1. העלאת קובץ ל-Storage
  // 2. OCR (אם תמונה/PDF)
  // 3. שליחה ל-OpenAI Vision/GPT-4 עם prompt:
  //    "זהה הוצאות קבועות, חובות, נכסים מתוך המסמך הזה"
  // 4. Parsing של התשובה (JSON)
  // 5. החזרה למשתמש לאישור
  ```

- [ ] דף: `/import`
  ```typescript
  // Wizard:
  // Step 1: העלאת קובץ
  // Step 2: המתנה לניתוח (loading)
  // Step 3: סקירת תוצאות + עריכה
  // Step 4: אישור + מילוי אוטומטי
  ```

**זמן משוער:** 3 ימים

---

### Day 4-5: Advanced Reports

#### Tasks
- [ ] דף: `/reports/advanced`
  ```typescript
  // Tabs:
  // - תזרים מזומנים (Cash Flow)
  // - מגמות (Trends)
  // - התפלגויות (Breakdown)
  // - השוואות (Comparisons)
  // כל טאב עם:
  // - Filters (תאריך, קטגוריה)
  // - גרף אינטראקטיבי
  // - כפתור Export (CSV/XLSX)
  ```

- [ ] קומפוננטה: `TrendChart.tsx`
  ```typescript
  // Location: components/reports/TrendChart.tsx
  // Props: data[], type (line/bar/area)
  // UI: גרף Recharts עם:
  // - Legend
  // - Tooltip מפורט
  // - Zoom
  // - Annotations
  ```

- [ ] API: GET `/api/reports/export`
  ```typescript
  // יצוא ל-CSV/XLSX
  // שימוש ב-library: xlsx
  ```

**זמן משוער:** 2 ימים

---

## 🧪 Sprint 6: QA + Polish (שבוע)

### Day 1-2: Testing

#### Tasks
- [ ] Unit Tests (Vitest)
  ```bash
  npm install -D vitest @testing-library/react
  ```
  ```typescript
  // tests/utils/phone.test.ts
  // tests/components/PhiScore.test.tsx
  // tests/api/transactions.test.ts
  ```

- [ ] E2E Tests (Playwright)
  ```bash
  npm install -D @playwright/test
  ```
  ```typescript
  // tests/e2e/auth.spec.ts
  // tests/e2e/transactions.spec.ts
  // tests/e2e/reflection.spec.ts
  ```

- [ ] Coverage
  ```bash
  npm run test:coverage
  # יעד: > 70%
  ```

**זמן משוער:** 2 ימים

---

### Day 3-4: Performance Optimization

#### Tasks
- [ ] Image Optimization
  ```typescript
  // השתמש ב-Next.js Image
  // דחיסה
  // WebP format
  ```

- [ ] Code Splitting
  ```typescript
  // Dynamic imports לקומפוננטות כבדות
  const HeavyChart = dynamic(() => import('@/components/charts/HeavyChart'));
  ```

- [ ] Caching Strategy
  ```typescript
  // SWR או React Query
  // Cache headers נכונים
  ```

- [ ] Database Indexes
  ```sql
  -- הוספת indexes לשאילתות נפוצות
  CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
  CREATE INDEX idx_expenses_user_status ON transactions(user_id, status) 
    WHERE type = 'expense';
  ```

- [ ] Lighthouse Audit
  ```bash
  # יעד:
  # Performance: > 90
  # Accessibility: > 95
  # Best Practices: > 90
  # SEO: > 90
  ```

**זמן משוער:** 2 ימים

---

### Day 5: Final Polish

#### Tasks
- [ ] Error Messages מקצועיות
- [ ] Loading States לכל מקום
- [ ] Empty States לכל מסכים
- [ ] Accessibility (a11y)
  - Screen readers
  - Keyboard navigation
  - Focus management
- [ ] Mobile Testing מקיף
- [ ] Documentation עדכון

**זמן משוער:** 1 יום

---

## 🎉 Sprint 7-8: Beta Testing (שבועיים)

### Week 1: Beta Launch

#### Tasks
- [ ] בחירת 10-20 Beta Users
- [ ] Onboarding אישי
- [ ] יצירת ערוץ תמיכה (Telegram/WhatsApp Group)
- [ ] Feedback Form
- [ ] Analytics Setup (Google Analytics, Mixpanel)

### Week 2: Iterations

#### Tasks
- [ ] איסוף Feedback
- [ ] Bug Fixes
- [ ] Quick Wins
- [ ] Documentation
- [ ] Training Materials

---

## 📊 Definition of Done

### לכל Feature:
- [ ] קוד נכתב ועובד
- [ ] Tests (Unit + E2E) עוברים
- [ ] Documentation עודכן
- [ ] Code Review עבר
- [ ] Deployed ל-Staging
- [ ] QA אישר
- [ ] Product Owner אישר

### ל-Production Ready:
- [ ] כל ה-Features הושלמו
- [ ] Coverage > 70%
- [ ] Lighthouse > 90
- [ ] Security Audit עבר
- [ ] Performance Audit עבר
- [ ] Beta Testing הסתיים בהצלחה
- [ ] Documentation מלא
- [ ] Rollback Plan מוכן

---

## 🎯 Success Metrics

### Week 4:
- ✅ Phase System מלא ופועל
- ✅ 5 Beta Users משתמשים
- ✅ 0 Critical Bugs

### Week 8:
- ✅ כל התכונות הושלמו
- ✅ 20 Beta Users פעילים
- ✅ Retention > 60% (30 days)
- ✅ < 5 Bugs קלים

### Week 10:
- ✅ Production Ready
- ✅ Documentation מלא
- ✅ Support System מוכן
- ✅ Marketing Materials מוכנים

---

**עודכן:** נובמבר 2025  
**גרסה:** 1.0

