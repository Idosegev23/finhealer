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

## **1. מידע כללי על הדוח (report_info):**
- תאריך הפקת הדוח (report_date - DD/MM/YYYY)
- תקופת הדוח (period_start, period_end - DD/MM/YYYY)
- שם הבנק (bank_name) - "בנק לאומי", "בנק הפועלים", "בנק דיסקונט" וכו'

## **2. מידע על החשבון (account_info):**
- מספר חשבון (account_number)
- שם החשבון (account_name) - "עובר ושב", "חשבון עו\"ש" וכו'
- סוג חשבון (account_type) - "checking" (עו\"ש), "savings" (חיסכון), "business" (עסקי)
- מספר סניף (branch_number) - אם מופיע
- יתרה פותחת (opening_balance)
- יתרה סוגרת (closing_balance) - **זו היתרה הנוכחית המדויקת של החשבון!**
- יתרה זמינה (available_balance) - אם שונה מיתרה סוגרת (כולל מסגרת אשראי)
- מסגרת אשראי (overdraft_limit) - אם יש

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
  "report_info": {
    "report_date": "01/11/2025",
    "period_start": "01/10/2025",
    "period_end": "31/10/2025",
    "bank_name": "בנק הפועלים"
  },
  "account_info": {
    "account_number": "123-456789",
    "account_name": "חשבון עו״ש",
    "account_type": "checking",
    "branch_number": "682",
    "opening_balance": 15000.00,
    "current_balance": 12000.00,
    "available_balance": 14000.00,
    "overdraft_limit": 2000.00
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
- שם/סוג הלוואה (loan_name) - "הלואה לא צמודה", "הלואה צמודה למדד" וכו'
- צמדות (index_type) - "לא צמוד", "צמוד למדד", "צמוד לדולר"
- סכום הלוואה מקורי (original_amount)
- יתרת חוב נוכחית (current_balance)
- ריבית שנתית (interest_rate) - רק המספר (לדוגמה: 7.75)
- החזר חודשי קבוע (monthly_payment) - **הסכום שמשולם כל חודש**
- תשלומים ששולמו (paid_payments) - מספר
- תשלומים שנותרו (remaining_payments) - מספר
- תאריך תשלום הבא (next_payment_date - DD/MM/YYYY) - אם מופיע

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
      "index_type": "לא צמוד",
      "original_amount": 120000.00,
      "current_balance": 89677.33,
      "interest_rate": 7.75,
      "monthly_payment": 1432.73,
      "paid_payments": 80,
      "remaining_payments": 40,
      "next_payment_date": "15/11/2025"
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
- סוג מסלול (track_type) - "קבועה לא צמודה", "משתנה כל 5 שנים", "פריים" וכו'
- צמדות (index_type) - "לא צמוד", "צמוד למדד"
- סכום מקורי (original_amount)
- יתרה נוכחית (current_balance)
- ריבית שנתית (interest_rate) - רק המספר (לדוגמה: 2.5)
- החזר חודשי קבוע (monthly_payment) - **הסכום שמשולם כל חודש**
- תשלומים ששולמו (paid_payments) - מספר
- תשלומים שנותרו (remaining_payments) - מספר
- תאריך תשלום הבא (next_payment_date - DD/MM/YYYY) - אם מופיע

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
      "paid_payments": 60,
      "remaining_payments": 180,
      "next_payment_date": "01/12/2025"
    },
    {
      "track_number": "2",
      "track_type": "משתנה כל 5 שנים",
      "index_type": "צמוד למדד",
      "original_amount": 800000.00,
      "current_balance": 750000.00,
      "interest_rate": 1.8,
      "monthly_payment": 3500.00,
      "paid_payments": 100,
      "remaining_payments": 200,
      "next_payment_date": "01/12/2025"
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
// 6️⃣ תלוש שכר (Payslip / Salary Slip)
// ============================================================================

export function getPayslipPrompt(text: string): string {
  return `אתה מומחה בניתוח תלושי שכר ישראליים.

נתח את תלוש השכר הבא וחלץ את **כל המידע הרלוונטי**.

## **מה לחלץ:**

### **1. מידע כללי (payslip_info):**
- שם המעסיק (employer_name)
- ח.פ. מעסיק (employer_id) - אם מופיע
- שם העובד (employee_name)
- תעודת זהות עובד (employee_id)
- חודש ושנה (month_year) - פורמט: "MM/YYYY" או "אוקטובר 2025"
- תאריך תשלום (pay_date - DD/MM/YYYY) - אם מופיע
- מספר תלוש (payslip_number) - אם מופיע

### **2. רכיבי שכר (salary_components):**

**הכנסה:**
- שכר ברוטו (gross_salary) - **סה"כ ברוטו לפני הפרשות וניכויים**
- שכר בסיס (base_salary)
- שעות נוספות (overtime_hours, overtime_pay) - אם יש
- בונוסים (bonus) - אם יש
- תוספות אחרות (allowances) - נסיעות, אוכל, טלפון וכו'

**ניכויים וקצבאות:**
- ניכוי מס הכנסה (tax_deducted / mas_hachnasa)
- ביטוח לאומי (social_security / bituach_leumi)
- מס בריאות (health_tax / briut_tax)
- פנסיה - עובד (pension_employee)
- פנסיה - מעסיק (pension_employer)
- קרן השתלמות - עובד (advanced_study_fund_employee / keren_hishtalmut_employee)
- קרן השתלמות - מעסיק (advanced_study_fund_employer / keren_hishtalmut_employer)
- ביטוח מנהלים (managers_insurance) - אם יש
- גמל/פנסיה מקיפה (provident_fund) - אם יש

**סה"כ:**
- שכר נטו (net_salary) - **הסכום שמועבר לחשבון הבנק**

### **3. פירוט פנסיה וחיסכון (pension_details):**
אם יש פירוט, חלץ:
- שם קופת פנסיה/גמל (fund_name)
- מספר תוכנית (policy_number)
- אחוז הפקדה עובד (employee_percentage)
- אחוז הפקדה מעסיק (employer_percentage)

## **פורמט JSON:**
{
  "payslip_info": {
    "employer_name": "חברת הייטק בע״מ",
    "employer_id": "515123456",
    "employee_name": "ישראל ישראלי",
    "employee_id": "123456789",
    "month_year": "10/2025",
    "pay_date": "05/11/2025",
    "payslip_number": "2025-10-12345"
  },
  "salary_components": {
    "gross_salary": 20000.00,
    "base_salary": 18000.00,
    "overtime_hours": 10,
    "overtime_pay": 1500.00,
    "bonus": 500.00,
    "allowances": {
      "travel": 0,
      "phone": 0,
      "food": 0
    },
    "tax_deducted": 4200.00,
    "social_security": 720.00,
    "health_tax": 310.00,
    "pension_employee": 1200.00,
    "pension_employer": 1500.00,
    "advanced_study_fund_employee": 500.00,
    "advanced_study_fund_employer": 500.00,
    "managers_insurance": 0,
    "net_salary": 13070.00
  },
  "pension_details": {
    "fund_name": "מבטחים קרן פנסיה",
    "policy_number": "123456789",
    "employee_percentage": 6.0,
    "employer_percentage": 7.5
  }
}

**התלוש:**
${text}

**חשוב: זהה במדויק את שכר ברוטו ונטו!**`;
}

// ============================================================================
// 7️⃣ דוח מסלקה פנסיונית (Pension Clearinghouse Report)
// ============================================================================

export function getPensionStatementPrompt(text: string): string {
  return `אתה מומחה בניתוח דוחות מסלקה פנסיונית ישראלית.

נתח את דוח המסלקה הבא וחלץ את **כל התוכניות והנתונים הפנסיוניים**.

## **מה לחלץ:**

### **1. מידע כללי (report_info):**
- שם הלקוח (customer_name)
- תעודת זהות (id_number)
- תאריך דוח (report_date)
- שם סוכן/יועץ (agent_name) - אם יש
- סה"כ יתרה נוכחית (total_balance)
- סה"כ הפקדה חודשית (total_monthly_deposit)

### **2. תוכניות פנסיוניות (pension_plans):**
עבור כל תוכנית (קרן פנסיה, קופת גמל, קרן השתלמות, פוליסת ביטוח משולבת):

**שדות חובה:**
- סוג תוכנית (plan_type): "pension_fund", "provident_fund", "study_fund", "insurance_policy"
- שם חברה מנהלת (provider)
- שם תוכנית (plan_name)
- מספר תוכנית/פוליסה (policy_number)
- סטטוס (status): "active", "frozen", "settled"
- וותק - תאריך התחלה (start_date)
- יתרה נוכחית (current_balance)

**שדות אופציונליים:**
- הפקדה חודשית (monthly_deposit)
- הפקדת עובד (employee_deposit)
- הפקדת מעסיק (employer_deposit)
- גיל פרישה (retirement_age)
- חיסכון לקצבה (pension_savings)
- חיסכון להון (capital_savings)
- כיסויים ביטוחיים (insurance_coverage): ביטוח חיים, אובדן כושר עבודה, מחלות קשות וכו'
- תחזית בגיל פרישה (retirement_forecast)
- מסלול השקעה (investment_track)
- דמי ניהול (management_fees)

### **3. סיכום כיסויים ביטוחיים (insurance_summary):**
אם יש כיסויים ביטוחיים, חלץ:
- ביטוח חיים (life_insurance)
- ביטוח יסודי (basic_insurance)
- פנסיית שאירים (survivors_pension)
- אובדן כושר עבודה (disability)
- מחלות קשות (critical_illness)
- ביטוח סיעודי (nursing_care)
- נכות מתאונה (accident_disability)

## **פורמט JSON:**
{
  "report_info": {
    "report_date": "16/03/2023",
    "customer_name": "אביתר באבאני",
    "id_number": "039854880",
    "agent_name": "גדי ברקאי",
    "total_balance": 11547.00,
    "total_monthly_deposit": 1666.00
  },
  "pension_plans": [
    {
      "plan_type": "pension_fund",
      "provider": "הפניקס",
      "plan_name": "הפניקס פנסיה מקיפה",
      "policy_number": "1124800010",
      "status": "frozen",
      "start_date": "01/03/2006",
      "current_balance": 24.00,
      "monthly_deposit": 0,
      "retirement_age": 67,
      "pension_savings": 24.00,
      "retirement_forecast": 75.00,
      "insurance_coverage": {
        "life_insurance": 398.00,
        "disability": 6007.00
      }
    }
  ],
  "insurance_summary": {
    "life_insurance": 398.00,
    "survivors_pension": 0,
    "disability": 8009.00,
    "critical_illness": 6007.00,
    "nursing_care": 0
  },
  "summary": {
    "total_plans": 5,
    "active_plans": 3,
    "frozen_plans": 2,
    "total_balance": 11547.00,
    "total_monthly_deposit": 1666.00,
    "by_type": {
      "pension_fund": 1,
      "provident_fund": 2,
      "study_fund": 1,
      "insurance_policy": 1
    }
  }
}

**הדוח:**
${text}

**חלץ את כל התוכניות - גם קפואות וגם פעילות!**`;
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

  if (normalizedType.includes('pension') || normalizedType.includes('פנסיה') || normalizedType.includes('מסלקה')) {
    return getPensionStatementPrompt(extractedText);
  }

  if (normalizedType.includes('payslip') || normalizedType.includes('salary') || normalizedType.includes('תלוש')) {
    return getPayslipPrompt(extractedText);
  }

  // Default to credit statement for unknown types
  console.warn(`Unknown document type: ${documentType}, using credit statement prompt`);
  return getCreditStatementPrompt(extractedText);
}

