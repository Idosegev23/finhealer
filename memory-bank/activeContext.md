# הקשר פעיל - Phi (φ)

## מיקום נוכחי בפרויקט

### 🎉 **עדכון אחרון: 1 בדצמבר 2025**

**ריברנדינג מלא!** המוצר עבר מ-FinHealer ל-**Phi (φ)** - היחס הזהב של הכסף שלך.

---

## 📱 עקרון מפתח: WhatsApp-First

> **הדסקטופ לצפייה בלבד. כל הפעולות דרך WhatsApp.**

| ממשק | תפקיד |
|------|-------|
| **WhatsApp** | סריקה, רישום הוצאות, אישורים, סיווג, שיחות עם גדי |
| **Desktop** | צפייה בנתונים, גרפים, דוחות - READ ONLY |

---

## 🎯 קורלציה: שלבי המוצר ↔ מצב הפיתוח

### Phase 1: Reflection (שיקוף עבר) - ✅ פיתוח הושלם
**מטרה:** הבנת דפוסי הוצאה היסטוריים (3-6 חודשים)

| פיצ'ר | סטטוס | איפה? |
|-------|--------|------|
| Onboarding via WhatsApp | ✅ | `onboarding-flow.ts` |
| AI parser לתשובות | ✅ | `parseOnboardingDataWithAI()` |
| Reflection Wizard (web) | ✅ | `/reflection` - 6 שלבים |
| user_baselines | ✅ | טבלה ב-DB |
| user_financial_profile | ✅ | טבלה ב-DB |

### Phase 1.5: Document Scanning - 🔄 בפיתוח פעיל
**מטרה:** סריקה אוטומטית של דוחות בנק/אשראי

| פיצ'ר | סטטוס | איפה? |
|-------|--------|------|
| PDF Upload via WhatsApp | ✅ | `webhook/route.ts` |
| AI Document Analysis | ✅ | `document-prompts.ts` |
| Transaction Extraction | ✅ | OCR + GPT |
| Classification Session | ✅ | `document-classification-session.ts` |
| Period Tracking (3 months) | ✅ | `period-tracker.ts` |
| Missing Docs Request | ✅ | אוטומטי אחרי סריקה |
| דוחות מקיפים (מסלקה/הר הביטוח) | ✅ | Prompts מוכנים |
| Handler ל-"נמשיך" | ✅ | `document-upload-flow.ts` |
| הודעה טבעית אחרי סריקה | ✅ | `buildDocumentAnalysisMessage()` |

**Flow טבעי:**
1. משתמש שולח מסמך
2. בוט מנתח ומציג: תקופה, תנועות, מסמכים חסרים
3. משתמש יכול: לשלוח עוד / לכתוב "נמשיך"
4. אם "נמשיך" - מתחיל סיווג (גם אם אין 3 חודשים מלאים)

**לבדוק:**
- [ ] E2E test של כל ה-flow
- [ ] מעבר אוטומטי לשלב 2 בסיום סיווג

### Phase 2: Behavior (התנהלות והרגלים) - ✅ **מושלם!**
**מטרה:** זיהוי דפוסי הוצאה בפועל (30+ ימים)

| פיצ'ר | סטטוס | איפה? |
|-------|--------|------|
| analyzeBehavior() | ✅ | `lib/analysis/behavior-analyzer.ts` |
| Cron יומי 20:30 | ✅ | `api/cron/daily-summary` |
| Cron שבועי ראשון 09:00 | ✅ | `api/cron/weekly-summary` |
| behavior_insights טבלה | ✅ | Migration + RLS |
| AI Tips אישיים | ✅ | `generateAITip()` עם GPT-4o-mini |
| מעבר אוטו לשלב 3 | ✅ | `checkReadyForBudget()` + `transitionToBudget()` |
| BehaviorDashboard | ✅ | נתונים אמיתיים מ-DB |
| SmartInsights | ✅ | מושך תובנות מ-DB |
| WhatsApp Handler לתובנות | ✅ | `handleAnalysisRequest()` |
| Handler לסטטוס | ✅ | `handleStatusRequest()` |
| getQuickAITip() | ✅ | טיפ מהיר ב-WhatsApp |

**Flow אוטומטי מושלם:**
1. כל יום 20:30 - ניתוח דפוסים + סיכום יומי + AI tip אישי
2. אם יש תובנה חשובה - נשלחת בהודעה
3. כל ראשון 09:00 - סיכום שבועי מקיף
4. אחרי 30+ ימים ו-50+ תנועות - מעבר אוטומטי לשלב 3
5. משתמש יכול לכתוב "ניתוח" ולקבל תובנות + AI tip
6. משתמש יכול לכתוב "איפה אני עומד?" ולקבל סטטוס

### Phase 3: Budget (תקציב אוטומטי) - ⏳ בהמתנה
**מטרה:** יצירת תקציב חכם מבוסס היסטוריה

| פיצ'ר | סטטוס | איפה? |
|-------|--------|------|
| דף `/budget` | ⏳ | צריך לפתח |
| generateBudgetFromHistory() | ⏳ | צריך לפתח |
| S-curve visualization | ⏳ | צריך לפתח |
| התראות חריגה | ⏳ | alerts_rules קיים |

### Phase 4: Goals (יעדים ומטרות) - ⏳ בהמתנה
**מטרה:** הגדרת יעדים אישיים ומשפחתיים

| פיצ'ר | סטטוס | איפה? |
|-------|--------|------|
| דף `/goals` | ⏳ | צריך לפתח |
| child_name support | ✅ | DB ready |
| העברת עודפים אוטומטית | ⏳ | צריך לפתח |
| GoalsQuickView | ✅ | Dashboard component |

### Phase 5: Monitoring (בקרה רציפה) - ⏳ בהמתנה
**מטרה:** ליווי ארוך טווח

| פיצ'ר | סטטוס | איפה? |
|-------|--------|------|
| Dashboard 2.0 | ✅ | `/dashboard` |
| דוחות חודשיים/שנתיים | ⏳ | צריך לפתח |
| התראות חכמות | ⏳ | alerts_events קיים |
| סיכום שבועי WhatsApp | ⏳ | צריך לפתח |

---

## 🔧 מה נבנה בימים האחרונים

### WhatsApp Bot - Document Scanning
1. ✅ תיקון באג מספר תנועות (הציג סכום במקום כמות)
2. ✅ שינוי לשאלה אחת בכל פעם (היה 2-3)
3. ✅ AI parser לתשובות Onboarding (במקום regex)
4. ✅ הסרת הודעת "קיבלתי" המיידית
5. ✅ תמיכה בדוחות מקיפים (מסלקה פנסיונית, הר הביטוח)
6. ✅ period-tracker - מעקב כיסוי 3 חודשים
7. ✅ הסתרת עמוד הסריקה מהתפריט (WhatsApp-first)

### Database
- ✅ 19+ טבלאות עם RLS מלא
- ✅ uploaded_statements לmעקב מסמכים
- ✅ expense_categories + income_sources

---

## 📋 מה הלאה?

### Priority 1: Phase 3 - Budget 🚀
1. [ ] דף `/budget` עם wizard
2. [ ] `generateBudgetFromHistory()`
3. [ ] S-curve visualization
4. [ ] התראות חריגה via WhatsApp

### Priority 3: Integrations
- ✅ GreenAPI - webhook + send
- [ ] OpenAI Chat - בוט AI מלא
- [ ] Green Invoice - Recurring

---

## 📁 קבצים מרכזיים

### WhatsApp Bot
```
app/api/wa/webhook/route.ts          - Main webhook handler
lib/conversation/orchestrator.ts     - Message routing
lib/conversation/flows/
  ├── onboarding-flow.ts            - Onboarding questions
  ├── document-classification-session.ts - Transaction classification
  └── ...
lib/ai/document-prompts.ts          - AI prompts for documents
lib/documents/period-tracker.ts     - 3-month coverage tracking
```

### Dashboard (View-Only)
```
app/dashboard/page.tsx              - Main dashboard
components/dashboard/
  ├── FinancialOverview.tsx
  ├── DebtVsAssets.tsx
  ├── SmartInsights.tsx
  ├── PhaseProgress.tsx
  └── GoalsQuickView.tsx
```

### Hidden Pages
```
app/dashboard/scan-center/page.tsx  - 🔒 Hidden (WhatsApp-first)
```

---

## 🎨 עיצוב ו-Branding

### Phi Color Palette (Nord-inspired)
```css
--phi-dark: #2E3440;      /* Primary dark */
--phi-gold: #A96B48;      /* Accent gold */
--phi-mint: #8FBCBB;      /* Success mint */
--phi-bg: #ECEFF4;        /* Background */
--phi-coral: #D08770;     /* Highlight coral */
```

### Typography
- Headers: Inter
- Body: Heebo (עברית)
- φ Symbol: Georgia, serif

---

## ⚠️ בעיות ידועות

| בעיה | סטטוס |
|------|--------|
| Build error בגלל sandbox (לא באמת שגיאה) | ⚠️ לוקאלי בלבד |

---

**עדכון אחרון:** 1 בדצמבר 2025
