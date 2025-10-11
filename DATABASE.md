# 📊 מבנה מסד הנתונים - FinHealer

תיעוד מלא של מבנה מסד הנתונים ב-Supabase.

---

## 📋 טבלאות

### 1. users
**תיאור:** משתמשי המערכת

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי (מקושר ל-auth.users) |
| name | TEXT | שם המשתמש |
| email | TEXT | אימייל (ייחודי) |
| phone | TEXT | מספר טלפון |
| wa_opt_in | BOOLEAN | הסכמה לקבלת הודעות WhatsApp |
| subscription_status | TEXT | סטטוס מנוי: inactive/active/paused/cancelled |
| created_at | TIMESTAMPTZ | תאריך יצירה |
| updated_at | TIMESTAMPTZ | תאריך עדכון אחרון |

**אינדקסים:**
- `idx_users_email` - חיפוש לפי email
- `idx_users_subscription_status` - סינון לפי סטטוס מנוי

**RLS Policies:**
- משתמש רואה רק את הפרופיל שלו
- אדמין רואה את כל המשתמשים

---

### 2. transactions
**תיאור:** תנועות כספיות (הוצאות והכנסות)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי |
| user_id | UUID | FK → users.id |
| type | TEXT | expense / income |
| amount | DECIMAL(10,2) | סכום |
| category | TEXT | קטגוריה |
| vendor | TEXT | ספק/עסק (אופציונלי) |
| date | DATE | תאריך התנועה |
| source | TEXT | manual / whatsapp / ocr |
| status | TEXT | proposed / confirmed / rejected |
| notes | TEXT | הערות (אופציונלי) |
| created_at | TIMESTAMPTZ | תאריך יצירה |
| updated_at | TIMESTAMPTZ | תאריך עדכון |

**אינדקסים:**
- `idx_transactions_user_id` - חיפוש לפי משתמש
- `idx_transactions_date` - חיפוש לפי תאריך
- `idx_transactions_category` - חיפוש לפי קטגוריה
- `idx_transactions_type` - סינון לפי סוג
- `idx_transactions_status` - סינון לפי סטטוס

**RLS Policies:**
- משתמש רואה רק תנועות שלו
- אדמין רואה את כל התנועות

---

### 3. budget_categories
**תיאור:** קטגוריות תקציב עם תקרה חודשית

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי |
| user_id | UUID | FK → users.id |
| name | TEXT | שם הקטגוריה |
| monthly_cap | DECIMAL(10,2) | תקרה חודשית |
| active | BOOLEAN | האם פעילה |
| color | TEXT | צבע להצגה (HEX) |
| icon | TEXT | אייקון (emoji או שם) |
| created_at | TIMESTAMPTZ | תאריך יצירה |
| updated_at | TIMESTAMPTZ | תאריך עדכון |

**Constraints:**
- UNIQUE(user_id, name) - שם ייחודי לכל משתמש

**אינדקסים:**
- `idx_budget_categories_user_id`
- `idx_budget_categories_active`

---

### 4. goals
**תיאור:** יעדים פיננסיים אישיים

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי |
| user_id | UUID | FK → users.id |
| name | TEXT | שם היעד |
| target_amount | DECIMAL(10,2) | סכום יעד |
| current_amount | DECIMAL(10,2) | סכום נוכחי |
| deadline | DATE | תאריך יעד (אופציונלי) |
| status | TEXT | active / completed / cancelled |
| description | TEXT | תיאור (אופציונלי) |
| created_at | TIMESTAMPTZ | תאריך יצירה |
| updated_at | TIMESTAMPTZ | תאריך עדכון |

**אינדקסים:**
- `idx_goals_user_id`
- `idx_goals_status`
- `idx_goals_deadline`

---

### 5. wa_messages
**תיאור:** הודעות WhatsApp דו-כיווניות

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי |
| user_id | UUID | FK → users.id |
| direction | TEXT | incoming / outgoing |
| msg_type | TEXT | text / image / document / audio / video |
| payload | JSONB | תוכן ההודעה (raw data) |
| status | TEXT | pending / processed / failed / sent / delivered / read |
| transaction_id | UUID | FK → transactions.id (אופציונלי) |
| created_at | TIMESTAMPTZ | תאריך יצירה |

**אינדקסים:**
- `idx_wa_messages_user_id`
- `idx_wa_messages_direction`
- `idx_wa_messages_status`
- `idx_wa_messages_created_at`
- GIN index על `payload` (חיפוש בתוך JSON)

---

### 6. alerts
**תיאור:** התראות והודעות למשתמש

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי |
| user_id | UUID | FK → users.id |
| type | TEXT | budget_exceeded / no_spend / goal_progress / savings_suggestion / welcome / reminder |
| params | JSONB | פרמטרים נוספים |
| sent_at | TIMESTAMPTZ | תאריך שליחה |
| read_at | TIMESTAMPTZ | תאריך קריאה (אופציונלי) |
| status | TEXT | pending / sent / failed / read |
| message | TEXT | תוכן ההודעה |
| created_at | TIMESTAMPTZ | תאריך יצירה |

**אינדקסים:**
- `idx_alerts_user_id`
- `idx_alerts_type`
- `idx_alerts_sent_at`
- `idx_alerts_status`

---

### 7. subscriptions
**תיאור:** ניהול מנויים ותשלומים

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי |
| user_id | UUID | FK → users.id (UNIQUE) |
| plan | TEXT | basic / premium / enterprise |
| provider | TEXT | green_invoice / stripe / manual |
| status | TEXT | active / paused / cancelled / expired |
| started_at | TIMESTAMPTZ | תאריך התחלה |
| expires_at | TIMESTAMPTZ | תאריך פקיעה (אופציונלי) |
| external_id | TEXT | מזהה חיצוני מהספק |
| amount | DECIMAL(10,2) | סכום מנוי |
| currency | TEXT | מטבע (ברירת מחדל: ILS) |
| billing_cycle | TEXT | monthly / yearly |
| metadata | JSONB | מטא-דאטה נוסף |
| created_at | TIMESTAMPTZ | תאריך יצירה |
| updated_at | TIMESTAMPTZ | תאריך עדכון |

**אינדקסים:**
- `idx_subscriptions_user_id`
- `idx_subscriptions_status`
- `idx_subscriptions_expires_at`
- `idx_subscriptions_external_id`

---

### 8. receipts
**תיאור:** קבלות עם OCR

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי |
| user_id | UUID | FK → users.id |
| storage_path | TEXT | נתיב בStorage |
| ocr_text | TEXT | טקסט מזוהה (אופציונלי) |
| amount | DECIMAL(10,2) | סכום מזוהה (אופציונלי) |
| vendor | TEXT | ספק מזוהה (אופציונלי) |
| confidence | DECIMAL(3,2) | רמת ודאות (0-1) |
| status | TEXT | pending / processing / completed / failed / confirmed |
| transaction_id | UUID | FK → transactions.id (אופציונלי) |
| metadata | JSONB | נתונים נוספים |
| created_at | TIMESTAMPTZ | תאריך יצירה |
| updated_at | TIMESTAMPTZ | תאריך עדכון |

**אינדקסים:**
- `idx_receipts_user_id`
- `idx_receipts_status`
- `idx_receipts_transaction_id`
- `idx_receipts_created_at`

---

### 9. admin_users
**תיאור:** מנהלי מערכת

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי |
| user_id | UUID | FK → users.id (UNIQUE) |
| role | TEXT | admin / super_admin / support |
| permissions | JSONB | הרשאות מיוחדות |
| created_at | TIMESTAMPTZ | תאריך יצירה |

**RLS:**
- רק אדמינים רואים טבלה זו

---

### 10. message_templates
**תיאור:** תבניות הודעות לבוט

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי |
| name | TEXT | שם התבנית (ייחודי) |
| type | TEXT | welcome / budget_alert / goal_progress / reminder / savings_tip / encouragement |
| content | TEXT | תוכן ההודעה (עם placeholders) |
| variables | JSONB | רשימת משתנים |
| active | BOOLEAN | פעיל/לא פעיל |
| language | TEXT | שפה (ברירת מחדל: he) |
| created_at | TIMESTAMPTZ | תאריך יצירה |
| updated_at | TIMESTAMPTZ | תאריך עדכון |

**תבניות ברירת מחדל:**
- welcome - ברוכים הבאים
- budget_exceeded - חריגה מתקציב
- no_spend_reminder - תזכורת יומית
- goal_milestone - הגעה ליעד
- savings_tip - המלצת חיסכון

---

### 11. user_settings
**תיאור:** הגדרות אישיות למשתמש

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי |
| user_id | UUID | FK → users.id (UNIQUE) |
| notifications_enabled | BOOLEAN | התראות מופעלות |
| wa_notifications | BOOLEAN | התראות WhatsApp |
| email_notifications | BOOLEAN | התראות Email |
| daily_summary | BOOLEAN | סיכום יומי |
| weekly_report | BOOLEAN | דוח שבועי |
| budget_alerts | BOOLEAN | התראות תקציב |
| goal_reminders | BOOLEAN | תזכורות יעדים |
| currency | TEXT | מטבע (ברירת מחדל: ILS) |
| timezone | TEXT | אזור זמן (ברירת מחדל: Asia/Jerusalem) |
| language | TEXT | שפה (ברירת מחדל: he) |
| theme | TEXT | light / dark / auto |
| preferences | JSONB | העדפות נוספות |
| created_at | TIMESTAMPTZ | תאריך יצירה |
| updated_at | TIMESTAMPTZ | תאריך עדכון |

---

### 12. audit_logs
**תיאור:** לוגים למעקב אחרי פעולות במערכת

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי |
| user_id | UUID | FK → users.id (אופציונלי) |
| action | TEXT | סוג הפעולה |
| table_name | TEXT | שם הטבלה |
| record_id | UUID | מזהה הרשומה |
| old_data | JSONB | נתונים לפני |
| new_data | JSONB | נתונים אחרי |
| ip_address | INET | כתובת IP |
| user_agent | TEXT | User Agent |
| created_at | TIMESTAMPTZ | תאריך |

**אינדקסים:**
- `idx_audit_logs_user_id`
- `idx_audit_logs_action`
- `idx_audit_logs_table_name`
- `idx_audit_logs_created_at`

---

### 13. default_categories
**תיאור:** קטגוריות ברירת מחדל למשתמשים חדשים

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | מזהה ייחודי |
| name | TEXT | שם בעברית (ייחודי) |
| name_en | TEXT | שם באנגלית |
| default_cap | DECIMAL(10,2) | תקרה ברירת מחדל |
| color | TEXT | צבע (HEX) |
| icon | TEXT | אייקון |
| sort_order | INTEGER | סדר הצגה |
| active | BOOLEAN | פעיל/לא פעיל |
| created_at | TIMESTAMPTZ | תאריך יצירה |

**קטגוריות ברירת מחדל:**
1. מזון ומכולת (1,500 ₪)
2. תחבורה (800 ₪)
3. דיור (3,000 ₪)
4. בריאות (500 ₪)
5. בילויים (600 ₪)
6. ביגוד (400 ₪)
7. חינוך (500 ₪)
8. חשבונות (1,000 ₪)
9. אחר (300 ₪)

---

## 📈 Views

### 1. monthly_budget_tracking
**תיאור:** מעקב תקציב חודשי בזמן אמת

**Columns:**
- budget_category_id
- user_id
- category_name
- monthly_cap
- color
- current_spent (סכום שהוצא החודש)
- remaining (נותר)
- usage_percentage (אחוז ניצול)

**שימוש:**
```sql
SELECT * FROM monthly_budget_tracking WHERE user_id = 'xxx';
```

---

### 2. user_monthly_stats
**תיאור:** סטטיסטיקות חודשיות למשתמש

**Columns:**
- user_id
- name
- month
- total_expenses
- total_income
- net_balance
- expense_count
- income_count
- active_days

---

### 3. active_users_stats
**תיאור:** נתונים על משתמשים פעילים (לאדמין)

**Columns:**
- signup_date
- new_users
- active_subscribers
- wa_opted_in

---

### 4. category_spending_report
**תיאור:** דוח הוצאות לפי קטגוריה וחודש

**Columns:**
- user_id
- user_name
- category
- month
- transaction_count
- total_expenses
- avg_expense
- max_expense

---

### 5. goals_progress_report
**תיאור:** דוח התקדמות יעדים

**Columns:**
- user_id
- user_name
- goal_name
- target_amount
- current_amount
- deadline
- status
- progress_percentage
- days_remaining
- amount_remaining

---

## ⚙️ פונקציות

### 1. calculate_financial_health(user_id UUID)
**תיאור:** חישוב ציון בריאות פיננסית (0-100)

**לוגיקה:**
- 30% יחס חיסכון (הכנסה - הוצאה)
- 40% עמידה בתקציב
- 30% התקדמות ביעדים

**שימוש:**
```sql
SELECT calculate_financial_health('user-uuid');
```

---

### 2. get_daily_summary(user_id UUID, date DATE)
**תיאור:** סיכום יומי של תנועות ומצב תקציב

**מחזיר:**
- total_expenses
- total_income
- transaction_count
- top_category
- budget_status (תקין/התראה/חריגה)

---

### 3. create_default_user_categories(user_id UUID)
**תיאור:** יוצר קטגוריות ברירת מחדל למשתמש חדש

---

### 4. is_admin()
**תיאור:** בודק האם המשתמש הנוכחי הוא אדמין

---

### 5. get_top_spenders(limit INT, month DATE)
**תיאור:** מחזיר את המשתמשים עם ההוצאות הגבוהות ביותר

---

### 6. get_inactive_users(days INT)
**תיאור:** מזהה משתמשים שלא היו פעילים במספר ימים נתון

---

## 🔐 Row Level Security (RLS)

כל הטבלאות מוגנות ב-RLS. העקרונות:

1. **משתמש רגיל** - רואה רק את הנתונים שלו
2. **אדמין** - רואה את כל הנתונים (דרך `is_admin()`)
3. **טבלאות מערכת** - רק אדמינים (`message_templates`, `admin_users`)

---

## 🗄️ Storage

### Buckets

#### 1. receipts (private)
**Policies:**
- משתמש יכול להעלות/לצפות/למחוק רק קבלות שלו
- אדמין יכול לצפות בכל הקבלות

**מבנה:**
```
receipts/
  ├── {user_id}/
  │   ├── {receipt_id}.jpg
  │   └── {receipt_id}.pdf
```

#### 2. avatars (public)
**Policies:**
- כולם יכולים לצפות
- משתמש יכול להעלות/לעדכן רק תמונה שלו

**מבנה:**
```
avatars/
  ├── {user_id}/
  │   └── avatar.jpg
```

---

## 🔄 Triggers

### 1. setup_new_user()
**מתי:** לאחר INSERT ב-users
**מה עושה:**
1. קורא ל-`create_default_user_categories()`
2. יוצר רשומה ב-`user_settings`

### 2. update_updated_at()
**מתי:** לפני UPDATE
**מה עושה:** מעדכן את `updated_at` ל-NOW()

**טבלאות עם trigger זה:**
- users
- transactions
- budget_categories
- goals
- subscriptions
- receipts
- message_templates
- user_settings

---

## 📊 אינדקסים

כל הטבלאות כוללות אינדקסים מותאמים לביצועים:
- FK columns
- שדות חיפוש נפוצים (email, date, status)
- GIN indexes ל-JSONB columns

---

## 🔧 תחזוקה

### Migrations
כל השינויים במסד הנתונים מתועדים ב-migrations:

```bash
# רשימת migrations
supabase db migrations list

# יצירת migration חדש
supabase migration new <name>

# הרצת migrations
supabase db reset
```

### Backup
Supabase מבצע גיבויים אוטומטיים.

### Monitoring
- Supabase Dashboard - ניטור queries ו-performance
- RLS Policies - בדיקה שמשתמשים לא רואים נתונים של אחרים

---

**עדכון אחרון:** 5 באוקטובר 2025

