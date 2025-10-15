# מערכת סריקת דוחות סילוקין - Loans OCR System

## סקירה כללית

מערכת OCR מתקדמת לסריקה וניתוח אוטומטי של **דוחות סילוקין** (Loan Payoff Statements) באמצעות GPT-4 Vision.

## תכונות עיקריות

### 🎯 מה נסרק?

המערכת מזהה ומחלצת באופן אוטומטי:

1. **מידע בסיסי:**
   - שם המלווה (בנק, חברה)
   - מספר הלוואה/חשבון
   - סוג הלוואה (משכנתא, אישית, רכב, לימודים, אשראי, עסק)

2. **נתונים פיננסיים:**
   - סכום ההלוואה המקורי
   - יתרת חוב נוכחית ⭐
   - תשלום חודשי ⭐
   - ריבית שנתית (%)

3. **טיימליין:**
   - תאריך התחלת ההלוואה
   - תאריך סיום משוער
   - מספר תשלומים נותרים

## מבנה הפרויקט

```
/app/api/ocr/loan-statement/
  └── route.ts                    # API endpoint לסריקת דוחות

/app/api/loans/
  └── route.ts                    # GET/POST של הלוואות

/components/dashboard/sections/
  └── LoansSection.tsx            # UI עם OCR מובנה

Database:
  └── loans (table)               # טבלת הלוואות
  └── user_loan_summary (view)   # סיכום הלוואות לפי משתמש
```

## API Endpoints

### 1. POST `/api/ocr/loan-statement`

**סריקת דוח סילוקין**

**Request:**
```typescript
FormData {
  statement: File  // תמונה או PDF של דוח סילוקין
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    lenderName: string,
    loanNumber: string | null,
    loanType: 'mortgage' | 'personal' | 'car' | 'student' | 'credit' | 'business' | 'other',
    originalAmount: number,
    currentBalance: number,
    monthlyPayment: number,
    interestRate: number | null,
    startDate: string | null,  // YYYY-MM-DD
    endDate: string | null,    // YYYY-MM-DD
    remainingPayments: number | null
  }
}
```

### 2. GET `/api/loans`

**קבלת כל ההלוואות של המשתמש**

**Response:**
```typescript
{
  loans: [
    {
      id: string,
      lenderName: string,
      loanType: string,
      currentBalance: number,
      monthlyPayment: number,
      // ... שאר הפרטים
    }
  ]
}
```

### 3. POST `/api/loans`

**שמירת הלוואות**

**Request:**
```typescript
{
  loans: [
    {
      lenderName: string,
      loanType: string,
      currentBalance: number,
      monthlyPayment: number,
      // ... שאר הפרטים
    }
  ]
}
```

## Database Schema

### טבלת `loans`

```sql
CREATE TABLE loans (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Lender info
  lender_name TEXT NOT NULL,
  loan_number TEXT,
  
  -- Loan type
  loan_type TEXT NOT NULL CHECK (loan_type IN (
    'mortgage', 'personal', 'car', 'student', 'credit', 'business', 'other'
  )),
  
  -- Financial details
  original_amount NUMERIC NOT NULL,
  current_balance NUMERIC NOT NULL,
  monthly_payment NUMERIC NOT NULL,
  interest_rate NUMERIC,
  
  -- Timeline
  start_date DATE,
  end_date DATE,
  remaining_payments INTEGER,
  
  -- Additional
  notes TEXT,
  statement_url TEXT,
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### View: `user_loan_summary`

סיכום אוטומטי לכל משתמש:

```sql
CREATE VIEW user_loan_summary AS
SELECT 
  user_id,
  COUNT(*) as total_loans,
  SUM(current_balance) as total_debt,
  SUM(monthly_payment) as total_monthly_payment,
  SUM(CASE WHEN loan_type = 'mortgage' THEN current_balance ELSE 0 END) as mortgage_debt,
  SUM(CASE WHEN loan_type IN ('personal', 'car', 'student', 'credit') THEN current_balance ELSE 0 END) as consumer_debt
FROM loans
WHERE active = true
GROUP BY user_id;
```

## שימוש בקומפוננטה

```tsx
import LoansSection from '@/components/dashboard/sections/LoansSection';

// In your component:
<LoansSection 
  onSave={async (loans) => {
    const response = await fetch('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loans })
    });
  }}
  initialLoans={existingLoans}
/>
```

## UX Flow

1. **הוספת הלוואה:**
   - משתמש לוחץ "הוסף הלוואה"
   - נפתח טופס ריק

2. **סריקה אוטומטית:**
   - משתמש לוחץ "סרוק דוח סילוקין"
   - מעלה תמונה של הדוח
   - המערכת מציגה loader
   - תוך 3-5 שניות - כל הפרטים מתמלאים אוטומטית
   - הודעת הצלחה

3. **עריכה ידנית:**
   - משתמש יכול לערוך כל שדה
   - שדות חובה: יתרת חוב, תשלום חודשי

4. **שמירה:**
   - לחיצה על "שמור הלוואות"
   - הנתונים נשמרים ב-DB
   - הרובריקה מסומנת כהושלמה

## טיפים למשתמש

💡 **כיצד לקבל דוח סילוקין?**
- משכנתא: באתר הבנק > משכנתאות > דוח סילוקין
- הלוואה אישית: באתר הבנק > הלוואות > פירוט הלוואה
- רכב: חברת הליסינג/מימון
- צרו קשר עם הגורם המלווה ובקשו "דוח סילוקין"

💡 **תמונות לדוגמה:**
- צלמו את הדוח בתאורה טובה
- וודאו שכל המספרים ברורים
- המערכת תומכת גם ב-PDF

## Error Handling

**שגיאות אפשריות:**
- "Failed to scan statement" - הדוח לא ברור, נסו תמונה אחרת
- "Could not extract required information" - הדוח חסר מידע קריטי
- "Unauthorized" - המשתמש לא מחובר

**Recovery:**
- אם הסריקה נכשלה - מלאו ידנית
- הפרטים החשובים ביותר: **יתרת חוב** ו**תשלום חודשי**

## Security

- ✅ RLS מופעל - כל משתמש רואה רק את ההלוואות שלו
- ✅ התמונות נשלחות ל-OpenAI דרך HTTPS
- ✅ המידע נשמר מוצפן ב-Supabase
- ✅ אין שמירה של תמונות הדוחות (אופציונלי בעתיד)

## Future Enhancements

- [ ] תמיכה ב-PDF OCR
- [ ] שמירת תמונת הדוח ב-Supabase Storage
- [ ] הסטוריה של שינויים ביתרת חוב
- [ ] התראות אוטומטיות לפני תום הלוואה
- [ ] חישוב ריבית אפקטיבית
- [ ] המלצות לאיחוד הלוואות

## Analytics & Insights

המערכת תחשב אוטומטית:
- **יחס חוב להכנסה** (DTI - Debt to Income)
- **תשלום חודשי כ-% מהכנסה**
- **חוב צרכני vs. משכנתא**
- **ריבית ממוצעת**

---

**תאריך יצירה:** 2025-10-15  
**גרסה:** 1.0.0  
**מפתח:** FinHealer Team

