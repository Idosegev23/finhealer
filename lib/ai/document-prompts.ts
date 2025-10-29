/**
 * פרומפטים מותאמים לניתוח 5 סוגי מסמכים פיננסיים
 * כל פרומפט מותאם לסוג המסמך ולפורמט הפלט הנדרש
 */

// ============================================================================
// 1️⃣ דוח אשראי (Credit Card Statement)
// ============================================================================

export function getCreditStatementPrompt(text: string): string {
  return `אתה מומחה בניתוח דוחות אשראי ישראליים מסוג כאל/מקס/ישראכרט.

נתח את דוח האשראי הבא וחלץ **כל** עסקה שמופיעה בו - ללא יוצא מן הכלל.

🔴 **קריטי ביותר - חלץ גם עסקאות בעברית!** 🔴

דוח זה מכיל עסקאות בשתי שפות:
1. **עברית**: סופר דוידי, שופרסל, יוחננוף, בבקה בייקרי, סיטי מרקט, פז, פלאפון, בזק, הפניקס, הראל וכו'
2. **אנגלית**: CURSOR, OPENAI, VERCEL, PROMEAI, Netflix, Apple וכו'

**חובה לחלץ את שתי השפות!**

**סוגי עסקאות לחילוץ:**
✅ עסקאות רגילות (סופר דוידי, שופרסל, CURSOR, OPENAI)
✅ עסקאות עם תשלומים (תשלום 1 מ-2, תשלום 27 מ-48)
✅ עסקאות קרדיט (קרדיט 1 מ-3)
✅ הוראות קבע (קרן מכבי, פרי טיוי, ביטוחים)

**אל תדלג על אף עסקה - לא באנגלית ולא בעברית!**

עבור כל עסקה, חלץ:
- **תאריך** (DD/MM/YYYY - בדיוק כפי שמופיע)
- **שם בית העסק/ספק** (כפי שמופיע, עברית או אנגלית)
- **סכום בש"ח** (המספר הסופי אחרי המרה, ללא סימן ₪)
- **קטגוריה** (אם מצוין במסמך - מזון ומשקא, מחשבים, ביטוח וכו')
- **סוג** (רגיל/תשלום/קרדיט/הוראת קבע)
- **פירוט תשלום** (אם יש - למשל "תשלום 2 מ-5")

**פורמט JSON בלבד - ללא טקסט נוסף:**
{
  "transactions": [
    {
      "date": "21/08/2025",
      "vendor": "שפירא גז בע'מ",
      "amount": 920.00,
      "category": "גז",
      "type": "תשלום",
      "installment": "תשלום 1 מ-2",
      "payment_method": "credit_card"
    },
    {
      "date": "12/08/2025",
      "vendor": "סופר דוידי",
      "amount": 350.00,
      "category": "מזון ומשקא",
      "type": "רגיל",
      "payment_method": "credit_card"
    }
  ]
}

**הדוח:**
${text}

**זכור: חלץ את כל העסקאות כולל תשלומים, קרדיט והוראות קבע - בעברית ובאנגלית!**`;
}

// ============================================================================
// 2️⃣ דוח בנק (Bank Statement)
// ============================================================================

export function getBankStatementPrompt(text: string): string {
  return `אתה מומחה בניתוח דוחות בנק ישראליים.

נתח את דוח הבנק הבא וחלץ את כל המידע הרלוונטי בפורמט JSON.

**מטרת העל:** לספק תמונה פיננסית מלאה של החשבון.

## **1. מידע כללי על החשבון (account_info):**
- תקופה (from_date, to_date - DD/MM/YYYY)
- יתרה פותחת (opening_balance)
- יתרה סוגרת (closing_balance)
- מספר חשבון (account_number)
- שם החשבון (account_name)

## **2. תנועות לפי סוג (transactions):**

### **הכנסות (income)** - כל זכות שמגדילה את היתרה:
- משכורת
- העברות שקיבלתי (גם מחשבונות אחרים שלי!)
- החזרי מס
- גמלאות
- הכנסות מהשקעות
- דיבידנדים
- ביטול חיוב
- **כלל: כל תנועה עם סימן (+) או "זכות"**

### **הוצאות (expense)** - כל חיוב שמקטין את היתרה:
- קניות
- חשבונות (חשמל, מים, ארנונה, טלפון)
- העברות שעשיתי (גם לחשבונות אחרים שלי!)
- משיכות מזומן
- עמלות
- **כלל: כל תנועה עם סימן (-) או "חיוב"**

**חריגים מיוחדים:**

### **הלוואות (loan_payment)** - זיהוי לפי תיאור:
- "בנק לאומי/דיסקונט/מזרחי - הלוואה"
- "החזר הלוואה"
- "החזר משכנתא"
- אם יש פירוט קרן וריבית - חלץ אותם
- **סווג כ-expense אבל תעד בנפרד**

### **חיסכון (savings_transfer)** - זיהוי לפי תיאור:
- "העברה לפיקדון"
- "העברה לחיסכון"
- "קרן השתלמות"
- "קופת גמל"
- **סווג כ-expense אבל תעד בנפרד**

## **פורמט JSON:**
{
  "account_info": {
    "from_date": "01/10/2025",
    "to_date": "31/10/2025",
    "opening_balance": 15000.00,
    "closing_balance": 12000.00,
    "account_number": "123-456789",
    "account_name": "עובר ושב"
  },
  "transactions": {
    "income": [
      {
        "date": "05/10/2025",
        "description": "משכורת",
        "amount": 10000.00,
        "category": "הכנסה מעבודה",
        "vendor": "מעסיק"
      }
    ],
    "expenses": [
      {
        "date": "02/10/2025",
        "description": "קניות בסופר",
        "amount": 350.00,
        "category": "מזון וצריכה",
        "vendor": "סופר דוידי"
      }
    ],
    "loan_payments": [
      {
        "date": "15/10/2025",
        "description": "החזר הלוואה בנק לאומי",
        "amount": 2000.00,
        "principal": 1500.00,
        "interest": 500.00,
        "loan_provider": "בנק לאומי",
        "vendor": "בנק לאומי"
      }
    ],
    "savings_transfers": [
      {
        "date": "15/10/2025",
        "description": "העברה לפיקדון",
        "amount": 1000.00,
        "to_account": "פיקדון",
        "vendor": "העברה פנימית"
      }
    ]
  }
}

**הדוח:**
${text}`;
}

// ============================================================================
// 3️⃣ דוח הלוואות רגיל (Loan Statement)
// ============================================================================

export function getLoanStatementPrompt(text: string): string {
  return `אתה מומחה בניתוח דוחות הלוואות ישראליים.

נתח את דוח ההלוואות הבא וחלץ את כל המידע הרלוונטי בפורמט JSON.

**מטרת העל:** לספק תמונה פיננסית מלאה של ההלוואות.

## **1. מידע כללי על הדוח (report_info):**
- תאריך הדוח (date - DD/MM/YYYY)
- שם הלקוח (customer_name)
- סניף (branch)
- סה"כ יתרת חוב (total_outstanding_debt)
- סה"כ החזר חודשי (total_monthly_payment)

## **2. פירוט הלוואות (loans):**
עבור כל הלוואה, חלץ:
- מספר הלוואה (loan_number)
- שם/סוג הלוואה (loan_name)
- סכום הלוואה מקורי (original_amount)
- יתרת חוב נוכחית (outstanding_balance)
- ריבית שנתית נומינלית (annual_interest_rate)
- סכום תשלום קרוב (next_payment_amount)
- יתרת תשלומים (remaining_payments - פורמט X/Y)

**פורמט JSON בלבד - ללא טקסט נוסף:**
{
  "report_info": {
    "date": "29/10/2025",
    "customer_name": "ליבוביץ אילנית, שגב עידו",
    "branch": "סניף אשקלון",
    "total_outstanding_debt": 99630.03,
    "total_monthly_payment": 2024.34
  },
  "loans": [
    {
      "loan_number": "0-128-0155-00-978020",
      "loan_name": "הלואה לא צמודה ברבית משתנה",
      "original_amount": 120000.00,
      "outstanding_balance": 89677.33,
      "annual_interest_rate": "P+1.75% (7.75%)",
      "next_payment_amount": 1432.73,
      "remaining_payments": "40/120"
    }
  ]
}

**הדוח:**
${text}`;
}

// ============================================================================
// 4️⃣ דוח משכנתא (Mortgage Statement)
// ============================================================================

export function getMortgageStatementPrompt(text: string): string {
  return `אתה מומחה בניתוח דוחות משכנתאות ישראליות.

נתח את דוח המשכנתא הבא וחלץ את כל המידע הרלוונטי בפורמט JSON.

**הבנה:** משכנתא = מספר מסלולים. כל מסלול = הלוואה נפרדת.

## **1. מידע כללי (report_info):**
- תאריך הדוח (date - DD/MM/YYYY)
- שם הלקוח (customer_name)
- מספר נכס/כתובת (property_address)
- סה"כ חוב משכנתא (total_debt)
- סה"כ החזר חודשי (total_monthly_payment)

## **2. פירוט מסלולים (tracks):**
עבור כל מסלול, חלץ:
- מספר מסלול (track_number)
- סוג מסלול (track_type) - "קבועה לא צמודה", "משתנה כל 5 שנים"
- צמדות (index_type) - "לא צמוד", "צמוד למדד"
- סכום מקורי (original_amount)
- יתרה נוכחית (current_balance)
- ריבית שנתית (interest_rate)
- החזר חודשי (monthly_payment)
- תשלומים ששולמו / סה"כ תשלומים (remaining_payments - פורמט X/Y)

**פורמט JSON בלבד - ללא טקסט נוסף:**
{
  "report_info": {
    "date": "29/10/2025",
    "customer_name": "שגב עידו",
    "property_address": "רחוב הדקל 12, תל אביב",
    "total_debt": 1770000.00,
    "total_monthly_payment": 8500.00
  },
  "tracks": [
    {
      "track_number": "1",
      "track_type": "קבועה לא צמודה",
      "index_type": "לא צמוד",
      "original_amount": 500000.00,
      "current_balance": 450000.00,
      "interest_rate": 2.5,
      "monthly_payment": 2000.00,
      "remaining_payments": "180/240"
    },
    {
      "track_number": "2",
      "track_type": "משתנה כל 5 שנים",
      "index_type": "צמוד למדד",
      "original_amount": 800000.00,
      "current_balance": 750000.00,
      "interest_rate": 1.8,
      "monthly_payment": 3500.00,
      "remaining_payments": "200/300"
    }
  ]
}

**הדוח:**
${text}`;
}

// ============================================================================
// 5️⃣ דוח ביטוחים (Insurance Statement - "הר הביטוח")
// ============================================================================

export function getInsuranceStatementPrompt(text: string): string {
  return `אתה מומחה בניתוח דוחות "הר הביטוח" - מרשם הביטוחים הלאומי של משרד האוצר.

נתח את דוח הביטוחים הבא וחלץ את **כל הפוליסות**.

## **מה לחלץ:**

### **1. מידע כללי**
- תאריך הפקת הדוח (report_date)
- תעודת זהות (id_number)

### **2. פוליסות ביטוח**
הדוח מחולק לתחומים. עבור כל פוליסה חלץ:

**שדות חובה:**
- תחום (domain) - "כללי", "בריאות ותאונות אישיות", "חיים ואבדן כושר עבודה"
- ענף ראשי (main_branch) - "ביטוח דירה", "ביטוח בריאות", "ביטוח סיעודי" וכו'
- ענף משני (sub_branch) - "מבנה ותכולה", "ניתוחים משלים", "סיעודי עד 3 חודשים" וכו'
- סוג מוצר (product_type) - "פוליסת ביטוח", "תכנית ביטוח" וכו'
- חברה (insurance_company) - שם החברה המבטחת
- תקופת ביטוח (coverage_period) - תאריכים או "לכל החיים"
- פרמיה בש"ח (premium_amount) - סכום הפרמיה
- סוג פרמיה (premium_type) - "שנתית", "חודשית", "חד פעמית"

**שדות אופציונליים (אם יש):**
- מספר פוליסה (policy_number)
- סיכוי/תוכן (coverage_details)

## **פורמט JSON:**
{
  "report_info": {
    "report_date": "29/10/2025",
    "id_number": "300700556",
    "source": "הר הביטוח - משרד האוצר"
  },
  "insurance_policies": [
    {
      "domain": "כללי",
      "main_branch": "ביטוח דירה",
      "sub_branch": "מבנה ותכולה",
      "product_type": "פוליסת ביטוח",
      "insurance_company": "איי.די.איי. חברה לביטוח בע\\"מ",
      "coverage_period": "01/05/2025 - 30/04/2026",
      "premium_amount": 4554.00,
      "premium_type": "שנתית",
      "policy_number": "1528021603"
    }
  ],
  "summary": {
    "total_policies": 10,
    "total_annual_premium": 15000.00,
    "by_domain": {
      "כללי": 1,
      "בריאות ותאונות אישיות": 5,
      "חיים ואבדן כושר עבודה": 4
    }
  }
}

**הדוח:**
${text}

**חלץ את כל הפוליסות - גם אם אין פרמיה!**`;
}

// ============================================================================
// Helper: בחירת פרומפט לפי סוג מסמך
// ============================================================================

export function getPromptForDocumentType(
  documentType: string,
  extractedText: string
): string {
  const normalizedType = documentType.toLowerCase();

  if (normalizedType.includes('credit') || normalizedType === 'credit_statement') {
    return getCreditStatementPrompt(extractedText);
  }

  if (normalizedType.includes('bank') || normalizedType === 'bank_statement') {
    return getBankStatementPrompt(extractedText);
  }

  if (normalizedType.includes('mortgage')) {
    return getMortgageStatementPrompt(extractedText);
  }

  if (normalizedType.includes('loan')) {
    return getLoanStatementPrompt(extractedText);
  }

  if (normalizedType.includes('insurance')) {
    return getInsuranceStatementPrompt(extractedText);
  }

  // Default to credit statement for unknown types
  console.warn(`Unknown document type: ${documentType}, using credit statement prompt`);
  return getCreditStatementPrompt(extractedText);
}

