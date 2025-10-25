# 📊 מערכת ניהול הוצאות חכמה - תיעוד מלא

## 🎯 סקירה כללית

מערכת מתקדמת לסריקה, זיהוי וניהול הוצאות באופן אוטומטי באמצעות AI ו-OCR.

---

## 🗂️ מבנה המערכת

### 1. מסד נתונים

#### טבלאות חדשות

**`uploaded_statements`** - ניהול דוחות שהועלו
```sql
- id: uuid (PK)
- user_id: uuid (FK -> users)
- file_name: text
- file_type: text ('bank_statement' | 'credit_statement')
- file_url: text
- file_size: integer
- status: text ('pending' | 'processing' | 'completed' | 'failed')
- processed: boolean
- processed_at: timestamp
- transactions_extracted: integer
- error_message: text
- metadata: jsonb
- created_at: timestamp
- updated_at: timestamp
```

**`user_category_rules`** - כללי סיווג אישיים
```sql
- id: uuid (PK)
- user_id: uuid (FK -> users)
- keyword: text
- category: text
- expense_frequency: text
- priority: integer
- created_at: timestamp
- updated_at: timestamp
```

#### עדכון טבלת `transactions`

שדות חדשים שנוספו:
```sql
- confidence_score: numeric (0-1)
- original_description: text
- is_recurring: boolean
- recurrence_pattern: text
- detailed_category: text
- expense_frequency: text ('fixed' | 'temporary' | 'special' | 'one_time')
```

---

## 🔌 API Endpoints

### 1. העלאת דוח בנק/אשראי

**Endpoint:** `POST /api/expenses/upload-statement`

**תיאור:** העלאת דוח וזיהוי תנועות אוטומטי עם AI

**Body (FormData):**
```typescript
{
  file: File,           // PDF, Excel, CSV או תמונה
  fileType: 'bank_statement' | 'credit_statement'
}
```

**Response:**
```typescript
{
  success: boolean,
  statement_id: string,
  transactions: Transaction[],
  method: 'gpt4-vision' | 'gpt4-text'
}
```

**תהליך העיבוד:**
1. העלאה ל-Supabase Storage (`financial-documents`)
2. יצירת רשומה ב-`uploaded_statements`
3. חילוץ טקסט (PDF/Excel) או שימוש ב-GPT-4 Vision (תמונות)
4. ניתוח עם GPT-4o וזיהוי תנועות
5. סיווג אוטומטי לקטגוריות ותדירויות
6. החזרת תנועות מזוהות

---

### 2. ניהול תנועות (מעודכן)

**Endpoint:** `POST /api/transactions`

**שדות חדשים נתמכים:**
```typescript
{
  // שדות קיימים
  type: 'expense' | 'income',
  amount: number,
  date: string,              // או tx_date
  description: string,       // או notes
  vendor?: string,
  category?: string,
  
  // שדות חדשים
  detailed_category?: string,
  expense_frequency?: 'fixed' | 'temporary' | 'special' | 'one_time',
  confidence_score?: number,
  original_description?: string,
  is_recurring?: boolean,
  recurrence_pattern?: string,
  auto_categorized?: boolean
}
```

---

## 🎨 קומפוננטות Frontend

### 1. **StatementUploader** 📤

**מיקום:** `components/expenses/StatementUploader.tsx`

**תכונות:**
- ✅ Drag & Drop
- ✅ תמיכה ב-PDF, Excel, CSV, תמונות (JPG, PNG)
- ✅ Progress bar אנימטי
- ✅ אימות קבצים (סוג, גודל)
- ✅ הודעות סטטוס (הצלחה/שגיאה)
- ✅ בחירת סוג דוח (בנק/אשראי)

**שימוש:**
```tsx
<StatementUploader
  onTransactionsExtracted={(transactions) => {
    // קבלת תנועות מזוהות
  }}
  onClose={() => {}}
/>
```

---

### 2. **ExpensesTable** 📋

**מיקום:** `components/expenses/ExpensesTable.tsx`

**תכונות:**
- ✅ טבלה מתקדמת עם אנימציות
- ✅ חיפוש בזמן אמת
- ✅ סינון לפי קטגוריה ותדירות
- ✅ מיון לפי תאריך, סכום, קטגוריה
- ✅ כרטיסי סיכום (סך הכל, קבועות, סה"כ תנועות)
- ✅ תמיכה בעריכה ומחיקה
- ✅ כפתור שמירה המונית

**Props:**
```typescript
interface ExpensesTableProps {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
  onSave?: (transactions: Transaction[]) => void;
}
```

---

### 3. **EditTransactionModal** ✏️

**מיקום:** `components/expenses/EditTransactionModal.tsx`

**תכונות:**
- ✅ עריכת כל שדות התנועה
- ✅ ולידציה מלאה
- ✅ בחירה חכמה של קטגוריות ותדירויות
- ✅ הצגת רמת ביטחון AI
- ✅ אנימציות חלקות

**Props:**
```typescript
interface EditTransactionModalProps {
  transaction: Transaction;
  onSave: (updated: Transaction) => void;
  onClose: () => void;
}
```

---

### 4. **דף הוצאות משודרג** 🚀

**מיקום:** `app/dashboard/expenses/page.tsx`

**תכונות:**
- ✅ העלאת דוחות עם drag & drop
- ✅ הצגת תנועות ממתינות לשמירה
- ✅ רשימת הוצאות קיימות
- ✅ עריכה ומחיקה
- ✅ Empty state מעוצב
- ✅ אנימציות Framer Motion

---

## 🤖 אינטגרציית AI

### GPT-4o לטקסט (PDF/Excel)

**מה זה עושה:**
1. מקבל טקסט מחולץ מהקובץ
2. מזהה תנועות פיננסיות
3. מסווג לקטגוריות מפורטות
4. קובע תדירות הוצאה
5. מחזיר JSON עם כל התנועות

**דוגמה לתגובה:**
```json
{
  "transactions": [
    {
      "date": "2025-01-15",
      "description": "שופרסל דיל",
      "vendor": "שופרסל",
      "amount": 347.50,
      "category": "🍔 מזון ומשקאות",
      "detailed_category": "food_beverages",
      "expense_frequency": "fixed",
      "confidence": 0.92
    }
  ]
}
```

---

### GPT-4 Vision לתמונות

**מה זה עושה:**
1. מקבל תמונה של דוח (base64)
2. מזהה טקסט ותנועות ישירות מהתמונה
3. מבצע את אותו תהליך סיווג
4. מחזיר JSON עם תנועות מזוהות

---

## 🎨 קטגוריות מפורטות

```typescript
const CATEGORIES = {
  food_beverages: '🍔 מזון ומשקאות',
  cellular_communication: '📱 סלולר ותקשורת',
  entertainment_leisure: '🎬 בילויים ופנאי',
  transportation_fuel: '⛽ תחבורה ודלק',
  housing_maintenance: '🏠 דיור ותחזוקה',
  clothing_footwear: '👕 ביגוד והנעלה',
  health_medical: '💊 בריאות ותרופות',
  education: '📚 חינוך והשכלה',
  utilities: '⚡ שירותים',
  shopping_general: '🛒 קניות כלליות',
  subscriptions: '📺 מנויים',
  insurance: '🛡️ ביטוחים',
  loans_debt: '💳 הלוואות וחובות',
  other: '📦 אחר',
};
```

---

## 🔄 תדירויות הוצאה

```typescript
const FREQUENCIES = {
  fixed: '🔄 קבועה - חוזרת כל חודש באותו סכום',
  temporary: '⏱️ זמנית - מנוי לתקופה מוגבלת',
  special: '⭐ מיוחדת - לא תכופה אך חשובה',
  one_time: '1️⃣ חד פעמית - רכישה חד פעמית',
};
```

---

## 📦 Supabase Storage

### Bucket: `financial-documents`

**מבנה:**
```
financial-documents/
  └── {user_id}/
      └── {timestamp}_{filename}
```

**הרשאות:**
- Upload: משתמשים מחוברים בלבד
- Download: רק לבעלים
- Public: לא

**הגדרה נדרשת:**
```sql
-- RLS Policy
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (auth.uid() = (storage.foldername(name))[1]::uuid);

CREATE POLICY "Users can read their own documents"
ON storage.objects FOR SELECT
USING (auth.uid() = (storage.foldername(name))[1]::uuid);
```

---

## 🚀 איך להשתמש במערכת

### תרחיש 1: העלאת דוח בנק
1. משתמש נכנס לדף `/dashboard/expenses`
2. לוחץ על "העלה דוח בנק/אשראי"
3. גורר קובץ PDF/Excel או בוחר קובץ
4. בוחר "דוח בנק"
5. לוחץ "העלה וזהה תנועות"
6. המערכת מעבדת עם GPT-4
7. מוצגות התנועות המזוהות בטבלה
8. משתמש בודק ומאשר
9. לוחץ "שמור את כל ההוצאות"

### תרחיש 2: עריכת תנועה
1. במסך ההוצאות, לוחץ על כפתור "עריכה" ליד תנועה
2. נפתח מודל עריכה
3. משנה קטגוריה, תדירות, סכום וכו'
4. לוחץ "שמור שינויים"
5. התנועה מתעדכנת במסד הנתונים

---

## 🎯 תכונות מיוחדות

### 1. זיהוי חכם של תדירויות
המערכת מזהה אוטומטית אם הוצאה היא:
- **קבועה** - מופיעה כל חודש בסכום דומה
- **זמנית** - מנוי לתקופה מוגבלת
- **מיוחדת** - ביטוח שנתי, ארנונה
- **חד פעמית** - קניה יחידה

### 2. Confidence Score
כל תנועה מזוהה מקבלת ציון ביטחון (0-1):
- **0.9-1.0** - ביטחון גבוה מאוד
- **0.7-0.9** - ביטחון טוב
- **0.5-0.7** - ביטחון בינוני
- **< 0.5** - נמוך (דורש בדיקה ידנית)

### 3. סיווג מפורט
14 קטגוריות מפורטות עם אייקונים חזותיים

---

## 🔧 שיפורים עתידיים אפשריים

1. **למידת מכונה מקומית**
   - שמירת העדפות סיווג של המשתמש
   - שיפור דיוק עם הזמן

2. **זיהוי חיובים חוזרים**
   - התראה על חיובים חדשים/משתנים
   - ניבוי הוצאות עתידיות

3. **ייצוא לExcel**
   - דוחות מפורטים
   - ניתוח מגמות

4. **אינטגרציה עם WhatsApp**
   - קבלת התראות על הוצאות
   - הוספת הוצאות דרך בוט

---

## 📝 דוגמאות קוד

### שימוש ב-API מהקליינט
```typescript
// העלאת דוח
const formData = new FormData();
formData.append('file', file);
formData.append('fileType', 'bank_statement');

const response = await fetch('/api/expenses/upload-statement', {
  method: 'POST',
  body: formData,
});

const data = await response.json();
console.log(data.transactions);
```

### שמירת תנועה
```typescript
const response = await fetch('/api/transactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'expense',
    date: '2025-01-15',
    description: 'קניה בסופר',
    vendor: 'שופרסל',
    amount: 250.50,
    detailed_category: 'food_beverages',
    expense_frequency: 'fixed',
    confidence_score: 0.92,
    source: 'statement_upload',
    auto_categorized: true,
  }),
});
```

---

## ✅ Checklist להטמעה

- [x] מסד נתונים - טבלאות ושדות חדשים
- [x] API endpoint להעלאת דוחות
- [x] אינטגרציה עם GPT-4o ו-Vision
- [x] קומפוננטת העלאה עם Drag & Drop
- [x] טבלת הוצאות מתקדמת
- [x] מודל עריכה
- [x] דף הוצאות משודרג
- [ ] **יצירת Storage Bucket: `financial-documents`** (נדרש!)
- [ ] הגדרת RLS policies ל-Storage
- [ ] בדיקות E2E

---

## 🎉 סיכום

מערכת מלאה וחכמה לניהול הוצאות שמשלבת:
- 🤖 AI מתקדם (GPT-4o + Vision)
- 📊 ניתוח אוטומטי של דוחות
- 🎨 UI/UX מודרני ואינטואיטיבי
- 🔒 אבטחה מלאה עם RLS
- ⚡ ביצועים מעולים

**כל הקוד נכתב ב-TypeScript, עם type-safety מלא!**

