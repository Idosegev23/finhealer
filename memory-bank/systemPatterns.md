# דפוסי מערכת - FinHealer

## ארכיטקטורה כללית

### Client-Server Architecture
```
Browser/WhatsApp → Next.js (SSR/CSR) → Supabase → External APIs
```

## דפוסי עיצוב

### 1. Row Level Security (RLS)
כל משתמש רואה רק את הנתונים שלו. הגישה מוגנת ברמת מסד הנתונים.

**דוגמה:**
```sql
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);
```

### 2. Server Components + Client Components
- Server Components לנתונים סטטיים וקריאות DB
- Client Components לאינטראקציות ואנימציות

### 3. API Routes לאינטגרציות
- `/api/webhooks/greenapi` - קבלת הודעות WhatsApp
- `/api/webhooks/green-invoice` - עדכוני תשלומים
- `/api/ai/chat` - תקשורת עם OpenAI
- `/api/ocr/process` - עיבוד קבלות

### 4. Edge Functions (Supabase)
פונקציות serverless לעיבוד:
- שליחת הודעות WhatsApp
- עיבוד התראות מתוזמנות
- ניתוח טקסט בעברית

## זרימות מרכזיות

### זרימה 0: Phase Transitions (מעברי שלבים)
```
1. בדיקת תנאי מעבר (Cron יומי או פעולת משתמש)
2. updateUserPhase(user_id)
   - Reflection → Behavior: אחרי שמירת baselines
   - Behavior → Budget: אחרי 30+ ימים עם מספיק נתונים
   - Budget → Goals: אחרי אישור תקציב
   - Goals → Monitoring: אחרי הגדרת יעד ראשון
3. שליחת הודעת הסבר + CTA יחיד
4. עדכון users.phase
```

### זרימה 1: הרשמה ותשלום
```
1. משתמש ממלא טופס הרשמה
2. הפניה לחשבונית ירוקה (Recurring)
3. משתמש משלם
4. Webhook מחשבונית ירוקה → עדכון DB
5. יצירת משתמש ב-Supabase Auth
6. Trigger: setup_new_user (קטגוריות + הגדרות)
7. users.phase = 'reflection'
8. שליחת הודעת Welcome בוואטסאפ + הסבר Phase 1
```

### זרימה 1.5: Reflection - שיקוף עבר
```
1. משתמש נכנס ל-/reflection
2. בוחר תקופה (3-6 חודשים)
3. מזין ממוצעים לפי קטגוריה (או מעלה CSV)
4. POST /api/reflection/baseline
5. שמירה ב-user_baselines
6. חישוב ממוצעים
7. users.phase → 'behavior'
8. הודעת מעבר + CTA ל-Dashboard
```

### זרימה 2: הוספת הוצאה מוואטסאפ
```
1. משתמש שולח הודעה: "קניתי 55 ש״ח בארומה"
2. GreenAPI Webhook → /api/wa/webhook
3. שמירה ב-wa_messages (direction='in')
4. ניתוח הטקסט (Regex/NER בסיסי, fallback AI)
5. יצירת transaction עם status='proposed'
6. שליחת הודעה לאישור [אשר / ערוך / פצל]
7. אישור משתמש → status='confirmed'
8. עדכון behavior_insights (אם Phase 2)
```

### זרימה 3: העלאת קבלה
```
1. משתמש מעלה תמונה
2. שמירה ב-Supabase Storage (receipts bucket)
3. OCR processing (Tesseract.js)
4. חילוץ: סכום, ספק, תאריך
5. יצירת receipt עם confidence score
6. הצגת תוצאות למשתמש לאישור
7. אישור → יצירת transaction
```

### זרימה 4: התראות אוטומטיות + S-curve
```
1. Cron Jobs:
   - Hourly: בדיקת over_threshold (S-curve, לא linear)
   - Daily 20:30: no_spend + analyzeBehavior() + updateUserPhase()
   - Weekly Mon 09:00: סיכום שבועי
   - Monthly: generateBudgetFromHistory() (כיול מחדש)
2. בדיקת חוקי alerts_rules
3. יצירת alerts_events (status='pending')
4. שליחת הודעה בוואטסאפ (תבניות + context)
5. עדכון status → 'sent'
6. Deep Link למסך רלוונטי
```

### זרימה 5: צ׳אט עם AI (מאמן פיננסי)
```
1. משתמש שולח שאלה ב-/assistant
2. איסוף context מלא:
   - users.phase
   - month_spend_by_category
   - user_baselines
   - recent alerts_events
   - goals_progress
   - behavior_insights (אחרונים)
3. System Prompt: "מאמן פיננסי צעיר/מקצועי בעברית"
4. שליחה ל-OpenAI (GPT-4, temp=0.7, max_tokens=500)
5. קבלת תשובה + עד 3 צעדים קטנים + CTA
6. שמירה להיסטוריה
7. הצגה עם Deep Links
```

### זרימה 6: Budget Auto-Generate
```
1. לאחר ≥30 ימים ב-Phase 2 (Behavior)
2. generateBudgetFromHistory(user_id):
   - חישוב ממוצע מ-baselines
   - התאמה לפי behavior_insights
   - הוספת buffer 10-15%
3. יצירת הצעת תקציב
4. הצגה ב-/budget עם S-curve visualization
5. משתמש מאשר/מתאים בקליקים
6. שמירה ב-budget_categories
7. users.phase → 'goals'
```

### זרימה 7: Goals + Surplus Rules
```
1. משתמש ב-/goals יוצר יעד
2. אופציונלי: child_name (ילדים ומטרות)
3. הגדרת חוק: "העבר X% מעודף קטגוריה Y ליעד Z"
4. בסוף חודש (Cron): 
   - חישוב עודפים (cap - spent)
   - הפעלת חוקים
   - העברה אוטומטית goals.current_amount
5. הודעת עידוד + progress
```

### זרימה 8: Advisor Notes (גדי)
```
1. Admin ב-/admin/user/[id] כותב הערה
2. POST /api/advice/note
3. שמירה ב-advisor_notes
4. שליחה לוואטסאפ (GreenAPI)
5. לוג מלא ב-admin_audit
```

## דפוסי נתונים

### 1. Soft Delete
במקום למחוק רשומות, נשנה סטטוס:
- goals: status='cancelled'
- transactions: status='rejected'

### 2. Audit Trail
כל פעולה משמעותית נרשמת ב-audit_logs:
- מי ביצע
- מה שונה (old_data, new_data)
- מתי

### 3. Optimistic Updates
בממשק המשתמש:
1. הצגת השינוי מיידית
2. שליחה לשרת ברקע
3. rollback במקרה של שגיאה

### 4. Caching Strategy
- Server Components: cache אוטומטי
- Client Components: SWR / React Query
- Static Pages: ISR (Incremental Static Regeneration)

## דפוסי אבטחה

### 1. Input Validation
```typescript
const transactionSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(1),
  type: z.enum(['expense', 'income']),
  date: z.date()
});
```

### 2. Webhook Verification
```typescript
function verifyWebhook(signature: string, body: string) {
  const expectedSignature = crypto
    .createHmac('sha256', SECRET)
    .update(body)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### 3. Rate Limiting
- API Routes: 100 requests/minute per user
- WhatsApp: 50 messages/hour per user

## דפוסי UI/UX

### 1. Progressive Disclosure
הצגת מידע בהדרגה - לא להציף את המשתמש

### 2. Loading States
תמיד להציג feedback:
- Skeleton screens
- Spinner
- Progress bars

### 3. Error Boundaries
תפיסת שגיאות ברמת קומפוננטות:
```tsx
<ErrorBoundary fallback={<ErrorMessage />}>
  <Dashboard />
</ErrorBoundary>
```

### 4. Toast Notifications
משוב מיידי על פעולות:
- הצלחה: ירוק + ✓
- שגיאה: אדום + ✗
- מידע: כחול + ℹ

## דפוסי קוד

### 1. Custom Hooks
```typescript
// useFinancialHealth.ts
export function useFinancialHealth(userId: string) {
  const [score, setScore] = useState<number>(0);
  // logic...
  return { score, loading, error };
}
```

### 2. Server Actions
```typescript
// actions/transactions.ts
'use server'

export async function createTransaction(data: TransactionInput) {
  const supabase = createServerClient();
  // validation + insert
  revalidatePath('/dashboard');
}
```

### 3. Composable Components
```tsx
<Card>
  <CardHeader>
    <CardTitle>תקציב חודשי</CardTitle>
  </CardHeader>
  <CardContent>
    <BudgetChart data={data} />
  </CardContent>
</Card>
```

## מוסכמות נוספות

### שמות קבצים
- Components: PascalCase (`BudgetCard.tsx`)
- Utilities: camelCase (`formatCurrency.ts`)
- Pages: kebab-case (`[user-id]`)

### ארגון תיקיות
```
/app
  /dashboard
  /transactions
  /goals
/components
  /ui
  /dashboard
  /shared
/lib
  /supabase
  /utils
  /hooks
/types
```

### Git Flow
- `main` - production
- `develop` - staging
- `feature/*` - תכונות חדשות
- `hotfix/*` - תיקונים דחופים

