# מפרט ייבוא דוחות - FinHealer

## מטרה
ייבוא מדויק ואוטומטי של נתונים פיננסיים מדוחות בנק/אשראי לצורך מילוי אוטומטי של הטופס.

---

## 1. סוגי קבצים נתמכים

### דוחות בנק:
- ✅ **PDF פירוט חשבון** - הפורמט המומלץ! 📄
  - פירוט חשבון חודשי (הפועלים, לאומי, דיסקונט, מזרחי, וכו')
  - דוח תנועות מהאפליקציה (שמור כ-PDF)
  - תמצית חשבון עו״ש
  - **יתרון:** טקסט מובנה = דיוק גבוה יותר
- ✅ **Excel/CSV** - ייצוא תנועות ישיר מהבנק
  - ניתוח מיידי של עמודות (תאריך, סכום, תיאור)
  - ללא צורך ב-OCR
- ✅ **תמונה** (JPG/PNG) - צילום מסך של האפליקציה
  - דורש OCR
  - מומלץ תמונה ברורה ובאיכות גבוהה

### דוחות אשראי:
- ✅ **PDF דוח חודשי** - הפורמט המומלץ! 📄
  - דוח כרטיס אשראי (ויזה, ישראכרט, מקס, לאומי קארד)
  - פירוט עסקאות מהאתר/אפליקציה
  - **יתרון:** זיהוי מדויק של יתרות, חיובים חוזרים, וחובות
- ✅ **תמונה** - צילום מסך מהאפליקציה
  - מסך "יתרות ועסקאות"
  - מסך "חובות והלוואות"

---

## 2. טכנולוגיות

### Phase 1 - OCR בסיסי (MVP)
```typescript
// Tesseract.js לזיהוי טקסט
import Tesseract from 'tesseract.js';

// עברית + אנגלית
const result = await Tesseract.recognize(image, 'heb+eng');
```

### Phase 2 - AI Parsing (Production)
```typescript
// OpenAI Vision API לזיהוי מתקדם
const analysis = await openai.chat.completions.create({
  model: "gpt-4-vision-preview",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "זהה הוצאות קבועות מהדוח" },
      { type: "image_url", image_url: imageUrl }
    ]
  }]
});
```

### Phase 3 - PDF Parsing
```typescript
// pdf-parse לקריאת PDF מובנה
import pdfParse from 'pdf-parse';

// זיהוי טבלאות עם camelot-py (Python microservice)
```

---

## 3. תהליך הייבוא

### שלב A: העלאה ואימות
```
1. משתמש מעלה קובץ
2. בדיקת סוג קובץ (PDF/Image/Excel)
3. בדיקת גודל (max 10MB)
4. העלאה ל-Supabase Storage
5. קבלת URL זמני
```

### שלב B: עיבוד וזיהוי

**PDF (המומלץ!):**
```
1. PDF Text Extraction (pdf-parse)
   ↓
2. זיהוי מבנה:
   - כותרות טבלאות
   - עמודות: תאריך | תיאור | חיוב | זיכוי | יתרה
   ↓
3. Parsing חכם:
   - Regex patterns לספקים ידועים
   - זיהוי חיובים קבועים (3+ חודשים)
   - AI לסיווג קטגוריות
   ↓
4. תוצאה: רשימת הוצאות קבועות + confidence scores
```

**Image:**
```
1. Tesseract OCR (עברית + אנגלית)
   ↓
2. ניקוי טקסט + AI Vision (אם נדרש)
   ↓
3. Parsing כמו PDF
```

**Excel/CSV:**
```
1. Parse columns (auto-detect headers)
   ↓
2. מיפוי אוטומטי: תאריך, סכום, תיאור
   ↓
3. זיהוי חיובים חוזרים
```

### שלב C: ניתוח חכם
```typescript
// זיהוי הוצאות קבועות
const patterns = {
  rent: /דמי שכירות|דיור|משכנתא|rent/i,
  insurance: /ביטוח|insurance|הראל|מגדל|כלל/i,
  cellular: /פלאפון|סלקום|הוט מובייל|פרטנר|cellular/i,
  internet: /בזק|הוט|yes|סלקום tv|internet/i,
  streaming: /נטפליקס|ספוטיפיי|netflix|spotify/i,
  education: /גן|משפחתון|לימוד|שכר לימוד/i,
  gym: /כושר|חדר אימונים|gym/i,
};

// זיהוי סכומים
const amountPattern = /₪?\s*(\d{1,3}(,\d{3})*(\.\d{2})?)\s*₪?/g;

// זיהוי חיובים חוזרים (3+ חודשים)
function findRecurring(transactions) {
  // group by merchant + similar amount
  // identify monthly patterns
}
```

### שלב D: אישור משתמש
```
1. הצגת ממצאים במסך אישור:
   ✓ זוהה: דיור - 4,500 ₪
   ✓ זוהה: ביטוח - 850 ₪
   ? לא בטוח: "חיוב 39.90" - האם זה מנוי?

2. משתמש מאשר/מתקן/מוסיף

3. מילוי אוטומטי של הטופס
```

---

## 4. מבנה API

### POST /api/import/analyze
```typescript
Request:
{
  fileUrl: string,
  fileType: 'pdf' | 'image' | 'excel',
  importType: 'expenses' | 'debts' | 'income'
}

Response:
{
  success: true,
  detected: {
    rent_mortgage: { value: 4500, confidence: 0.95 },
    insurance: { value: 850, confidence: 0.88 },
    cellular: { value: 129, confidence: 0.92 },
    unknown: [
      { 
        description: "חיוב 39.90",
        suggestion: "subscriptions",
        confidence: 0.65
      }
    ]
  }
}
```

---

## 5. UX Flow

```
[העלה קובץ]
    ↓
[מעלה לשרת... 📤]
    ↓
[מנתח... 🔍] (10-30 שניות)
    ↓
┌────────────────────────────────┐
│  נמצאו 6 הוצאות קבועות:       │
│                                │
│  ✓ דיור: 4,500 ₪             │
│  ✓ ביטוח: 850 ₪              │
│  ✓ פלאפון: 129 ₪             │
│  ? לא זוהה: "39.90 חיוב"     │
│                                │
│  [אשר הכל] [ערוך] [ביטול]     │
└────────────────────────────────┘
    ↓
[ממלא את הטופס אוטומטית ✨]
```

---

## 6. דיוק ואיכות

### יעדי דיוק:
- ✅ **95%+ לPDF מובנה** (דוח בנק רשמי)
- ✅ **85%+ לתמונות ברורות**
- ✅ **70%+ לצילומי מסך**

### Validation:
```typescript
interface DetectedExpense {
  category: string;
  amount: number;
  confidence: number; // 0-1
  source: string; // "OCR" | "Pattern" | "AI"
  rawText: string; // המקור
}

// רק confidence > 0.7 מאושר אוטומטית
// confidence 0.5-0.7 דורש אישור
// confidence < 0.5 מוצג כהצעה
```

### Machine Learning (Phase 4):
```
- לימוד מדפוסים של משתמשים
- שיפור זיהוי לפי היסטוריה
- זיהוי ספקים ייחודיים לישראל
```

---

## 7. טיפול בשגיאות

```typescript
const errors = {
  FILE_TOO_LARGE: "הקובץ גדול מדי (מקס 10MB)",
  UNSUPPORTED_FORMAT: "פורמט לא נתמך",
  OCR_FAILED: "לא הצלחנו לקרוא את הקובץ. נסה תמונה ברורה יותר",
  NO_DATA_FOUND: "לא מצאנו נתונים בקובץ. אנא מלא ידנית",
  PROCESSING_ERROR: "שגיאה בעיבוד. נסה שוב או מלא ידנית"
};
```

---

## 8. פרטיות ואבטחה

### אחסון:
```
1. קובץ נשמר ב-Supabase Storage (Bucket: 'imports')
2. URL זמני (1 שעה)
3. מחיקה אוטומטית אחרי עיבוד
4. ללא שמירת הקובץ המקורי לטווח ארוך
```

### RLS Policy:
```sql
-- רק בעלים יכול לגשת לקבצים שלו
CREATE POLICY "Users can upload own imports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'imports' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 9. עלויות

### MVP (Tesseract.js):
- ✅ **חינם**
- ⚡ עובד בצד לקוח (Browser)
- ⏱️ איטי יחסית (10-30 שניות)

### Production (OpenAI Vision):
- 💰 **~$0.01 לדוח**
- ⚡⚡ מהיר ומדויק
- ☁️ Server-side

### Hybrid (מומלץ):
```
1. נסה Tesseract (חינם)
2. אם confidence < 0.7 → OpenAI Vision
3. Best of both worlds
```

---

## 10. תעדוף יישום

### Week 1 (MVP):
- ✅ העלאת קובץ
- ✅ Tesseract OCR בסיסי
- ✅ Regex patterns לזיהוי
- ✅ מסך אישור

### Week 2:
- ✅ OpenAI Vision fallback
- ✅ Excel/CSV parsing
- ✅ מילוי אוטומטי

### Week 3:
- ✅ PDF parsing מתקדם
- ✅ זיהוי חיובים חוזרים
- ✅ למידה מהיסטוריה

---

## 11. דוגמאות קוד

### Client-side Upload:
```typescript
async function uploadAndAnalyze(file: File) {
  // 1. Upload to storage
  const { data, error } = await supabase.storage
    .from('imports')
    .upload(`${userId}/${Date.now()}_${file.name}`, file);

  if (error) throw error;

  // 2. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('imports')
    .getPublicUrl(data.path);

  // 3. Analyze
  const response = await fetch('/api/import/analyze', {
    method: 'POST',
    body: JSON.stringify({
      fileUrl: publicUrl,
      fileType: file.type,
      importType: 'expenses'
    })
  });

  const result = await response.json();
  return result;
}
```

### Server-side OCR:
```typescript
// app/api/import/analyze/route.ts
export async function POST(request: Request) {
  const { fileUrl, fileType } = await request.json();
  
  // Download file
  const imageBuffer = await fetch(fileUrl).then(r => r.arrayBuffer());
  
  // OCR
  const { data: { text } } = await Tesseract.recognize(imageBuffer, 'heb+eng');
  
  // Parse with AI
  const analysis = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: `אתה מנתח דוחות בנק ישראליים. זהה הוצאות קבועות חודשיות בפורמט JSON:
      {
        "rent_mortgage": number,
        "insurance": number,
        "cellular": number,
        ...
      }`
    }, {
      role: "user",
      content: text
    }]
  });
  
  const detected = JSON.parse(analysis.choices[0].message.content);
  
  return NextResponse.json({ success: true, detected });
}
```

---

## סיכום ✨

הייבוא יהיה:
1. **מדויק** - שילוב OCR + AI + Patterns
2. **מהיר** - תוצאות תוך 10-30 שניות
3. **בטוח** - מחיקה אוטומטית, RLS
4. **ידידותי** - UX ברור עם אישור משתמש
5. **חכם** - למידה והשתפרות עם הזמן

**יעד:** 90%+ דיוק בזיהוי הוצאות קבועות מדוחות ישראליים.

