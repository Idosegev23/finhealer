/**
 * פרומפטים מותאמים לניתוח 5 סוגי מסמכים פיננסיים
 * כל פרומפט מותאם לסוג המסמך ולפורמט הפלט הנדרש
 */

// ============================================================================
// 1️⃣ דוח אשראי (Credit Card Statement)
// ============================================================================

export function getCreditStatementPrompt(
  text: string | null,
  categories?: Array<{name: string; expense_type: string; category_group: string}>
): string {
  // Build categories guide from database
  let categoriesGuide = '';
  if (categories && categories.length > 0) {
    const fixed = categories.filter(c => c.expense_type === 'fixed');
    const variable = categories.filter(c => c.expense_type === 'variable');
    const special = categories.filter(c => c.expense_type === 'special');
    
    categoriesGuide = `

**קטגוריות הוצאות אפשריות (מהמסד נתונים):**

**קבועות (fixed):**
${fixed.map(c => `  • ${c.name}`).join('\n')}

**משתנות (variable):**
${variable.map(c => `  • ${c.name}`).join('\n')}

**מיוחדות (special):**
${special.map(c => `  • ${c.name}`).join('\n')}

**חשוב:** השתמש בשמות המדויקים מהרשימה למעלה בלבד!
אל תמציא קטגוריות חדשות - רק מהרשימה הזאת.

🚨 **קריטי - קטלוג הוצאות!** 🚨
1. השתמש **רק** בקטגוריות מהרשימה למעלה
2. העתק את השם **המדויק** (כולל רווחים ואותיות)
3. **אם לא בטוח בקטגוריה - השאר null! אל תמציא קטגוריות!**
4. **אל תשתמש ב"לא מסווג" - אם אין קטגוריה ברורה, השאר expense_category: null**
5. המשתמש ימלא את הקטגוריה ידנית

דוגמאות נכונות:
✅ "קניות סופר" → expense_category: "קניות סופר"
✅ "ארנונה למגורים" → expense_category: "ארנונה למגורים"
✅ "מסעדות" → expense_category: "מסעדות"
✅ "קניות מזון" (אין בטבלה - לא בטוח) → expense_category: null
✅ "ארנונה" (לא ברור איזה סוג) → expense_category: null
`;
  }
  return `אתה מומחה בניתוח פירוטי ויזה ישראליים (כאל/מקס/ישראכרט/לאומי קארד).

## **מטרה**: חילוץ **כל עסקה** מהדוח עם סיווג מדויק לקטגוריות.

🚨 **קריטי - חובה לחלץ את כל התנועות!** 🚨
**אל תדלג על שום עסקה!** הדוח יכול להכיל עשרות או מאות תנועות - חלץ את כולן!
אם יש 150 תנועות - חלץ את כל 150. אם יש 200 - חלץ את כל 200.
**זה לא דוגמה - זה הדוח המלא!**

🎯 **חשוב במיוחד:**
- חלץ **כל עסקה ללא יוצא מן הכלל** - עברית ואנגלית
- זהה הוראות קבע (recurring) עם שדות is_recurring ו-recurring_type
- זהה תשלומים (X מ-Y)
- זהה עסקאות במט"ח (דולר/יורו) + עמלות + שער המרה
- סווג לקטגוריות **מדויקות** מהרשימה - אם לא בטוח, השאר null

🚨 **כללי פורמט JSON - חובה!** 🚨
1. החזר **רק JSON תקין** - לא markdown, לא הסברים, לא טקסט נוסף
2. התחל ישירות עם { וסיים עם }
3. **אין פסיקים אחרי האלמנט האחרון** ב-array או object:
   ✅ נכון: ["a", "b", "c"]
   ❌ לא נכון: ["a", "b", "c",]
4. **Escape תווים מיוחדים** בתוך strings:
   ✅ נכון: "notes": "תשלום - 2 מתוך 12"
   ✅ נכון: "description": "סופר פארם ת\"א"
5. **אל תשבור strings** באמצע - כל string צריך להיות בשורה אחת
6. **אל תוסיף comments** בתוך ה-JSON

---

## **1. מידע כללי (report_info)**
- report_date (תאריך הפקת הדוח - YYYY-MM-DD)
- period_start, period_end (תקופת הדוח - YYYY-MM-DD)
- card_issuer (כאל / מקס / ישראכרט / לאומי קארד)

### **🔥 זיהוי תאריכים - קריטי!** 🔥
**בדוחות כאל יש פורמט תאריכים מיוחד:**
- 52/80/11 = 11/08/2025 (DD/MM/YY)
- 52/80/01 = 01/08/2025
- 52/80/41 = 14/08/2025
- 52/01/01 = 01/10/2025

**כלל שנה בת 2 ספרות:**
- אם השנה > 50 → 19XX (52 → 2025, 99 → 1999)
- אם השנה <= 50 → 20XX (25 → 2025, 50 → 2050)

**חשוב:** הבחן בין "תאריך העסקה" (כאשר בוצעה העסקה) ל"תאריך חיוב" (מתי יחוייב בבנק)

## **2. מידע על החשבון (account_info)**
- account_number (מספר חשבון)
- card_last_digits (4 ספרות אחרונות של הכרטיס)
- card_holder (שם בעל הכרטיס)
- credit_limit (מסגרת אשראי ₪)
- used_credit (ניצול בפועל ₪)
- total_debt (סך חוב ₪)

## **🔥 3. מידע חיוב (billing_info) - קריטי!**
- next_billing_date (מועד החיוב הבא בבנק - DD/MM/YYYY)
- next_billing_amount (הסכום שיחוייב בבנק - ללא עיגול!)
- card_last_digits (4 ספרות אחרונות - לזיהוי החיוב בבנק)

**חשוב מאוד:**
- חפש "מועד חיוב" או "תאריך חיוב" בדוח
- חפש "סך לחיוב" או "סכום לתשלום"
- זה המידע שיעזור להתאים את החיוב בדוח הבנק!

## **3. עסקאות (transactions)**

### **4 סוגי עסקאות:**

**א. רגיל** - עסקה חד-פעמית:
- סופר, מסעדה, בנזין וכו'

**ב. תשלום X מ-Y** - עסקה מפוצלת:
- "תשלום 1 מ-10" = תשלום ראשון מתוך 10
- חשוב: installment: "תשלום 1 מ-10"
- payment_number: 1, total_payments: 10

**ג. קרדיט X מ-Y** - קרדיט ארוך טווח:
- "קרדיט 3 מ-3" = תשלום אחרון
- חשוב: installment: "קרדיט 3 מ-3"
- payment_number: 3, total_payments: 3

**ד. הוראת קבע** - חיוב חוזר:
- קרן מכבי, פרי טיוי, Netflix, Spotify
- **זיהוי:** כתוב "הוראת קבע" או "לא הוראת קבע" בפירוט
- **חובה להוסיף:**
  - is_recurring: true (אם "הוראת קבע") או false (אם "לא הוראת קבע")
  - recurring_type: "monthly" (חודשי), "quarterly" (רבעוני), "yearly" (שנתי), או "other"

### **🔥 שדות לכל עסקה - הכרחי!**

**שדות חובה:**
- date: תאריך העסקה (YYYY-MM-DD)
- vendor: שם בית העסק (עברית או אנגלית - **כמו שכתוב בדוח**)
  - דוגמאות: "CURSOR USAGE JUL", "סופר דוידי", "OPENAI", "קרן מכבי"
- amount: סכום בש"ח (מספר חיובי תמיד!) - **הסכום שחוייב בפועל בשקלים**
- expense_category: קטגוריה מדויקת מהמסד נתונים (ראה רשימה למטה)
- expense_type: סוג ההוצאה (fixed/variable/special) - **חובה לקחת מהקטגוריה שבחרת!**
- type: "expense" או "income" בלבד
- payment_method: credit_card

**אם תשלום/קרדיט:**
- installment: "תשלום 1 מ-10" (העתק מדויק מהדוח)
- payment_number: 1
- total_payments: 10

**🌍 אם עסקה במט"ח (דולר/יורו/וכו'):**
חפש בפירוט את המידע הזה:
- original_amount: הסכום המקורי במט"ח (מספר בלבד, ללא סימן $)
- original_currency: "USD" או "EUR" או "GBP" או "HKD" (הונג קונג) וכו'
- exchange_rate: שער החליפין המדויק (מספר עשרוני)
- forex_fee: עמלת המרה בשקלים (בדרך כלל 3% מהסכום המקורי)

**דוגמאות מפורטות מבדוח כאל אמיתי:**

**דוגמה 1:**
"$19.00 לא הוראת קבע הונג קונג. ב-52/80/9 הומר לש"ח בשער יציג 3.534. ומסכום זה נגבתה עמלת עסקה במט"ח 3.00% בסך 1.69 ש"ח. סכום חיוב: ₪67.22"
→ original_amount: 19.00, original_currency: "USD", exchange_rate: 3.534, forex_fee: 1.69, amount: 67.22

**דוגמה 2:**
"$49.31 לא הוראת קבע ארצות הברית. ב-52/80/01 הומר לש"ח בשער יציג 3.534. ומסכום זה נגבתה עמלת עסקה במט"ח 3.00% בסך 5.80 ש"ח. סכום חיוב: ₪174.46"
→ original_amount: 49.31, original_currency: "USD", exchange_rate: 3.534, forex_fee: 5.80, amount: 174.46

**חשוב:** חלץ את כל הפרטים - גם אם חלקם לא מופיעים בפירוש, נסה לחשב אותם

${categoriesGuide}

### **🔴 expense_type - חובה לפי הקטגוריה!**
**לאחר שבחרת קטגוריה, העתק את ה-expense_type שלה:**
- אם בחרת קטגוריה מרשימת **קבועות** → expense_type: "fixed"
- אם בחרת קטגוריה מרשימת **משתנות** → expense_type: "variable"  
- אם בחרת קטגוריה מרשימת **מיוחדות** → expense_type: "special"

**דוגמאות:**
- בחרת "ביטוח חיים" (מרשימת קבועות) → expense_type: "fixed"
- בחרת "מסעדות" (מרשימת משתנות) → expense_type: "variable"
- בחרת "רהיטים" (מרשימת מיוחדות) → expense_type: "special"

### **🔴 קריטי - חלץ הכל! דוגמאות מפירוט אמיתי מבדוח כאל:**

**✅ מיפוי ענף → קטגוריה (מבדוח כאל אמיתי):**
- **ענף "מחשבים"** → OPENAI, CURSOR, VERCEL → category: "תוכנה ומנויים דיגיטליים", expense_type: "fixed"
- **ענף "אנרגיה"** → פז אפליקציית יילו → category: "דלק", expense_type: "variable"
- **ענף "תיירות"** → נאייקס ישראל חניונים → category: "תיירות ונסיעות", expense_type: "variable"
- **ענף "מזון ומשקא"** → המתוקיה בע"מ → category: "מסעדות" או "קניות סופר", expense_type: "variable"
- **ענף "פנאי ובילוי"** → חילזון בטבע בע"מ → category: "בידור", expense_type: "variable"
- **ענף "רפואה ובריאות"** → קרן מכבי → category: "קופת חולים", expense_type: "fixed"
- **ענף "תקשורת ומח"** → פריטיוי → category: "טלפון נייד" או "אינטרנט", expense_type: "fixed"

**✅ עסקאות עברית:**
- "סופר דוידי" → category: "קניות סופר", expense_type: "variable"
- "שופרסל דיל ברנע אשקלון" → category: "קניות סופר", expense_type: "variable"
- "פז אפליקציית יילו" → category: "דלק", expense_type: "variable"
- "קרן מכבי" (הוראת קבע) → category: "קופת חולים", expense_type: "fixed", is_recurring: true, recurring_type: "monthly"
- "פרי טיוי" (הוראת קבע) → category: "אינטרנט", expense_type: "fixed", is_recurring: true, recurring_type: "monthly"
- "פלאפון חשבון תקופתי" (הוראת קבע) → category: "טלפון נייד", expense_type: "fixed", is_recurring: true, recurring_type: "monthly"
- "קורס פייתון" → category: "השתלמות מקצועית", expense_type: "variable"
- "כנס אקזיט" → category: "השתלמות מקצועית", expense_type: "variable"
- "עורך דין כהן" → category: "שכר טרחה", expense_type: "variable"
- "רו\"ח לוי משרד חשבות" → category: "שכר טרחה", expense_type: "variable"
- "מס הכנסה תשלום חודשי" → category: "מס הכנסה", expense_type: "fixed"
- "מע\"מ לרשות המיסים" → category: "מע\"מ", expense_type: "fixed"

**✅ עסקאות אנגלית:**
- "CURSOR USAGE JUL" → category: "תוכנה ומנויים דיגיטליים", expense_type: "fixed"
- "OPENAI" → category: "תוכנה ומנויים דיגיטליים", expense_type: "fixed"
- "VERCEL INC." → category: "תוכנה ומנויים דיגיטליים", expense_type: "fixed"
- "Netflix.com" (הוראת קבע) → category: "בידור (נטפליקס, ספוטיפיי)", expense_type: "variable", is_recurring: true, recurring_type: "monthly"

**✅ תשלומים:**
- "שפירא גז בע'מ - תשלום 1 מ-2" → installment: "תשלום 1 מ-2", payment_number: 1, total_payments: 2
- "חנות - שטראוס מים - תשלום 27 מ-48" → category: "מוצרי חשמל וטכנולוגיה", expense_type: "special"

**✅ קרדיט:**
- "גביית מעמ אינטרנט שע"מ - קרדיט 1 מ-3" → installment: "קרדיט 1 מ-3"

---

## **פורמט פלט - JSON בלבד:**

🚨 **שדה "type" - חשוב מאוד!** 🚨
השדה type חייב להיות **רק אחד מאלה:**
- "expense" - לכל החיובים (תשלום, קרדיט, הוראת קבע)
- "income" - לזיכויים/החזרים בלבד

אל תשתמש ב"תשלום", "קרדיט", "הוראת קבע" בשדה type!

דוגמת JSON:
{
  "report_info": {
    "report_date": "2025-09-15",
    "period_start": "2025-08-11",
    "period_end": "2025-09-10",
    "card_issuer": "כאל"
  },
  "account_info": {
    "card_last_digits": "3943",
    "card_holder": "עידו שגב",
    "credit_limit": 49000.00,
    "used_credit": 16262.00,
    "total_debt": 15612.00
  },
  "billing_info": {
    "next_billing_date": "10/10/2025",
    "next_billing_amount": 2829.32,
    "card_last_digits": "3943"
  },
  "transactions": [
    {
      "date": "2025-08-21",
      "vendor": "שפירא גז בע'מ",
      "amount": 460.00,
      "expense_category": "גז",
      "expense_type": "fixed",
      "type": "expense",
      "installment": "תשלום 1 מ-2",
      "payment_number": 1,
      "total_payments": 2,
      "payment_method": "credit_card",
      "is_recurring": false,
      "recurring_type": null
    }
  ]
}

---

🚨 **תזכורת אחרונה - חובה!** 🚨
**חלץ את כל התנועות מהדוח - אל תדלג על אף עסקה!**
אם הדוח מכיל 100+ תנועות, חלץ את כולן.
אם הדוח מכיל 200+ תנועות, חלץ את כולן.
**זה לא דוגמה - זה הדוח המלא שצריך לחלץ במלואו!**

---

**הדוח:**
${text}

---

**חשוב**: 
- סכומים תמיד חיוביים
- תאריכים בפורמט YYYY-MM-DD
- חלץ **כל** עסקה - עברית ואנגלית
- זהה נכון: רגיל/תשלום/קרדיט/הוראת קבע`;
}

// ============================================================================
// 2️⃣ דוח בנק (Bank Statement)
// ============================================================================

export function getBankStatementPrompt(
  text: string | null,
  categories?: Array<{name: string; expense_type: string; category_group: string}>
): string {
  // Build categories guide from database
  let categoriesGuide = '';
  if (categories && categories.length > 0) {
    const fixed = categories.filter(c => c.expense_type === 'fixed');
    const variable = categories.filter(c => c.expense_type === 'variable');
    const special = categories.filter(c => c.expense_type === 'special');
    
    categoriesGuide = `
**קטגוריות הוצאות אפשריות (מהמסד נתונים):**

**קבועות (fixed):**
${fixed.map(c => `  • ${c.name} (${c.category_group})`).join('\n')}

**משתנות (variable):**
${variable.map(c => `  • ${c.name} (${c.category_group})`).join('\n')}

**מיוחדות (special):**
${special.map(c => `  • ${c.name} (${c.category_group})`).join('\n')}

**חשוב:** השתמש **רק** בשמות המדויקים מהרשימה למעלה!
אל תמציא קטגוריות חדשות - רק מהרשימה הזאת.

🚨 **קריטי - קטלוג הוצאות!** 🚨
1. השתמש **רק** בקטגוריות מהרשימה למעלה
2. העתק את השם **המדויק** (כולל רווחים ואותיות)
3. אם לא בטוח או שהקטגוריה לא מופיעה ברשימה - השאר expense_category: null
4. **אל תשתמש ב"לא מסווג" - אם אין התאמה, השאר null!**
5. המשתמש יבחר קטגוריה ידנית מאוחר יותר

דוגמאות נכונות:
✅ "קניות סופר" → expense_category: "קניות סופר"
✅ "ארנונה למגורים" → expense_category: "ארנונה למגורים"
❌ "קניות מזון" (אין בטבלה - השאר expense_category: null)
`;
  }
  return `אתה מומחה בניתוח דוחות בנק ישראליים.

נתח את דוח הבנק הבא וחלץ את כל המידע הרלוונטי בפורמט JSON.

🚨 **קריטי - חובה לחלץ את כל התנועות!** 🚨
**אל תדלג על שום תנועה!** הדוח יכול להכיל עשרות או מאות תנועות - חלץ את כולן!
אם יש 150 תנועות - חלץ את כל 150. אם יש 200 - חלץ את כל 200.
**זה לא דוגמה - זה הדוח המלא!**

🚨 **כללי פורמט JSON - חובה!** 🚨
1. החזר **רק JSON תקין** - לא markdown, לא הסברים, לא טקסט נוסף
2. התחל ישירות עם { וסיים עם }
3. **אין פסיקים אחרי האלמנט האחרון** ב-array או object:
   ✅ נכון: ["a", "b", "c"]
   ❌ לא נכון: ["a", "b", "c",]
4. **Escape תווים מיוחדים** בתוך strings:
   ✅ נכון: "notes": "הכנסה - החזר מס"
   ✅ נכון: "notes": "יתרה עלתה מ-39,663.41- ל-33,755.41-"
5. **אל תשבור strings** באמצע - כל string צריך להיות בשורה אחת
6. **אל תוסיף comments** בתוך ה-JSON

**מטרת העל:** לספק תמונה פיננסית מלאה של החשבון + זיהוי נכון של הכנסות/הוצאות.

## **🚨 חוק ברזל - סיווג הכנסות/הוצאות! 🚨**

### **שני שלבים נפרדים:**

---

### **שלב 1: האם זה income או expense?**
**🔥 הכלל היחיד והברור - תסתכל על הסימן של הסכום! 🔥**

**כלל קריטי - פשוט ואבסולוטי:**
- **אם הסכום מתחיל במינוס (-) או מסתיים במינוס (-)** → type: "expense" ❌ (הוצאה)
- **אם הסכום חיובי בלבד (בלי מינוס)** → type: "income" ✅ (הכנסה)

**⚠️ זהו הכלל היחיד! אל תחשוב על שמות או תיאורים! ⚠️**

**דוגמאות ברורות ופשוטות:**
- "-500.00" → expense (הוצאה)
- "2500.00" → income (הכנסה)
- "+1000.00" → income (הכנסה)
- "591.61-" → expense (הוצאה)
- "-1,234.56" → expense (הוצאה)
- "7,890.12" → income (הכנסה)

**חשוב: תסתכל רק על הסימן! אם יש מינוס = הוצאה, אם אין מינוס = הכנסה.**

**3 מצבים מפורטים (למקרה שיש בעיות):**

**מצב 1: שתי עמודות נפרדות - "זכות" ו-"חובה"** (בנק הפועלים, בנק לאומי)
- סכום בעמודת **"זכות"** → type: "income" ✅
- סכום בעמודת **"חובה"** → type: "expense" ❌

**מצב 2: עמודה אחת "זכות/חובה"** (בנק דיסקונט)
- **מספר חיובי (+)** = זכות → type: "income" ✅
- **מספר שלילי (-)** = חובה → type: "expense" ❌

**מצב 3: אין עמודות זכות/חובה** (fallback)
- חשב: balance_after - balance_before
- חיובי (+) → income
- שלילי (-) → expense

**⚠️ חשוב: תסתכל תמיד קודם על הסימן של הסכום - זה הכלל הפשוט ביותר!**

---

### **שלב 2: מה הקטגוריה?**
**🔍 עכשיו כן תסתכל על התיאור והספק!**

**זיהוי קטגוריות חשובות:**

**הלוואות (loan_payment):**
- זיהוי: "פירעון הלוואה", "הלוואה", "משכנתא", "loan"
- **lender_name = report_info.bank_name (הבנק שבדוח!)** לא מה שכתוב בתיאור!
- 🎯 **כלל:** דוח מבנק X → כל ההלוואות הן לבנק X
- דוגמה: report_info.bank_name = "בנק דיסקונט" + "פירעון הלוואה 123456" → lender_name: "בנק דיסקונט"
- דוגמה: report_info.bank_name = "בנק לאומי" + "תשלום הלוואה" → lender_name: "בנק לאומי"
- **חריג נדיר:** אם כתוב בפירוש בנק אחר, למשל "בנק הפועלים - הלוואה" → lender_name: "בנק הפועלים"

**מיסים:**
- "מס הכנסה" → expense_category: "מס הכנסה", expense_type: "fixed"
- "מס בריאות" → expense_category: "מס בריאות", expense_type: "fixed"
- "מע\"מ" / "מס ערך מוסף" → expense_category: "מע\"מ", expense_type: "fixed"
- "ביטוח לאומי" → category: אם income → "גמלאות", אם expense → "מיסים"

**חשוב:** מיסים הם תמיד הוצאות קבועות (fixed) ולא משתנות

**כרטיסי אשראי:**
- "ויזא", "מאסטרקארד" → category: "כרטיס אשראי"

**העברות:**
- העברה נכנסת → category: "העברה נכנסת"
- העברה יוצאת → category: "העברה יוצאת"

**אחר:**
- השתמש בקטגוריות מהמערכת (expense_categories שסופקו)
- או תן שם תיאורי מתאים

### **🔴 expense_type - חובה לפי הקטגוריה!**
**לאחר שבחרת קטגוריה, העתק את ה-expense_type שלה:**
- אם בחרת קטגוריה מרשימת **קבועות** → expense_type: "fixed"
- אם בחרת קטגוריה מרשימת **משתנות** → expense_type: "variable"  
- אם בחרת קטגוריה מרשימת **מיוחדות** → expense_type: "special"

**דוגמאות:**
- בחרת "ביטוח חיים" (מרשימת קבועות) → expense_type: "fixed"
- בחרת "מסעדות" (מרשימת משתנות) → expense_type: "variable"
- בחרת "רהיטים" (מרשימת מיוחדות) → expense_type: "special"

### **2. סכומים:**
- **תמיד החזר מספר חיובי (ללא מינוס)**
- אם כתוב "-500" → זו הוצאה של 500 (amount: 500, type: "expense")
- אם כתוב "500" זכות → זו הכנסה של 500 (amount: 500, type: "income")

### **3. אמצעי תשלום (payment_method) - חובה באנגלית!**
**🚨 תמיד השתמש באנגלית - לא בעברית! 🚨**

אפשרויות:
- **bank_transfer** (העברה בנקאית)
- **credit_card** (כרטיס אשראי)
- **debit_card** (כרטיס חיוב)
- **direct_debit** (חיוב ישיר / הוראת קבע)
- **standing_order** (הוראת קבע)
- **cash** (מזומן)
- **check** (המחאה)
- **bit** (ביט)
- **paybox** (פייבוקס)
- **paypal** (פייפאל)
- **digital_wallet** (ארנק דיגיטלי)
- **other** (אחר)

### **4. תזרים (Account Info):**
- חפש "יתרה", "יתרת חשבון", "סגירה", "balance"
- חפש "מסגרת אשראי", "overdraft", "מסגרת"
- חפש "סכום זמין", "available", "זמין"
- **current_balance** = היתרה הסוגרת המדויקת (יכולה להיות שלילית!)

## **1. מידע כללי על הדוח (report_info):**
- תאריך הפקת הדוח (report_date - YYYY-MM-DD)
- תקופת הדוח (period_start, period_end - YYYY-MM-DD)
- שם הבנק (bank_name) - "בנק לאומי", "בנק הפועלים", "בנק דיסקונט" וכו'

## **2. מידע על החשבון (account_info):**
- מספר חשבון (account_number)
- סוג חשבון (account_type) - "עו״ש", "חיסכון", "עסקי"
- מספר סניף (branch_number) - אם מופיע
- **current_balance** - **היתרה הנוכחית המדויקת** (יכולה להיות שלילית!)
- available_balance - אם שונה (כולל מסגרת)
- overdraft_limit - מסגרת אשראי אם יש

## **3. תנועות לפי סוג (transactions):**

### **הכנסות (income)** - כל זכות:

🎯 **חשוב: לכל הכנסה יש קטגוריה ספציפית!**

**קטגוריות הכנסה אפשריות (income_category):**

1. **"משכורת"** (employment_type: "employee")
   - זיהוי: "משכורת", "שכר", "salary", "wages", שם מעסיק ידוע
   - דוגמאות: "משכורת חודש 11", "שכר מחברת ABC", "תשלום שכר"

2. **"עצמאי/פרילנס"** (employment_type: "freelancer")
   - זיהוי: "עבודה עצמאית", "פרילנס", "freelance", "שירותי ייעוץ", "הכנסה מעסק"
   - דוגמאות: "תשלום מלקוח", "הכנסה מפרויקט", "שירותי ייעוץ"

3. **"עסק"** (employment_type: "business_owner")
   - זיהוי: "הכנסה מעסק", "רווחים", "business income", שם עסק
   - דוגמאות: "הכנסה מחנות", "רווחים מעסק", "תקבולים"

4. **"קצבה"** (allowance_type)
   - **"קצבת אבטלה"** (allowance_type: "unemployment")
     - זיהוי: "דמי אבטלה", "ביטוח אבטלה", "unemployment"
   - **"קצבת נכות"** (allowance_type: "disability")
     - זיהוי: "קצבת נכות", "ביטוח לאומי - נכות", "disability"
   - **"קצבת זקנה/פנסיה"** (allowance_type: "pension")
     - זיהוי: "קצבת זקנה", "פנסיה", "pension", "קצבה מביטוח לאומי"
   - **"קצבה אחרת"** (allowance_type: "other")
     - זיהוי: קצבאות אחרות מהמדינה

5. **"החזר מס"**
   - זיהוי: "החזר מס", "החזר ממס הכנסה", "tax refund", "זיכוי מס"
   - דוגמאות: "החזר מס 2024", "זיכוי ממס הכנסה"

6. **"גמלאות/ביטוח לאומי"**
   - זיהוי: "גמלה", "ביטוח לאומי", "דמי לידה", "דמי מילואים"
   - דוגמאות: "דמי לידה", "גמלת ילדים", "דמי מילואים"

7. **"השקעות"**
   - זיהוי: "דיבידנד", "ריבית", "רווח הון", "dividend", "interest"
   - דוגמאות: "דיבידנד ממניות", "ריבית מפיקדון", "רווח ממכירת מניות"

8. **"השכרה"**
   - זיהוי: "דמי שכירות", "שכירות", "rent", "השכרת נכס"
   - דוגמאות: "דמי שכירות דירה", "הכנסה מהשכרה"

9. **"מתנה/ירושה"**
   - זיהוי: "מתנה", "ירושה", "gift", "inheritance"
   - דוגמאות: "מתנה מהורים", "ירושה"

10. **"העברה נכנסת"**
    - זיהוי: "העברה", "transfer", העברה מחשבון אחר
    - דוגמאות: "העברה מחשבון חיסכון", "העברה בין חשבונות"

11. **"הכנסה אחרת"**
    - כל הכנסה שלא מתאימה לקטגוריות למעלה

**🚨 חשוב: לכל הכנסה חובה לציין:**
- income_category (אחת מהרשימה למעלה)
- employment_type (אם זה משכורת/עצמאי/עסק)
- allowance_type (אם זו קצבה)

**דוגמאות:**
✅ "משכורת חודש 11" → income_category: "משכורת", employment_type: "employee"
✅ "תשלום מלקוח ABC" → income_category: "עצמאי/פרילנס", employment_type: "freelancer"
✅ "קצבת זקנה" → income_category: "קצבה", allowance_type: "pension"
✅ "החזר מס 2024" → income_category: "החזר מס"
✅ "דיבידנד ממניות" → income_category: "השקעות"

**כלל: כל תנועה עם סימן (+) או "זכות"**

${categoriesGuide}

### **הוצאות (expense)** - כל חיוב שמקטין את היתרה:
- קניות
- חשבונות (חשמל, מים, ארנונה, טלפון)
- העברות שעשיתי (גם לחשבונות אחרים שלי!)
- משיכות מזומן
- עמלות
- **כלל: כל תנועה עם סימן (-) או "חיוב"**

**חריגים מיוחדים - חשוב מאוד!:**

### **🎯 חיובי כרטיס אשראי (credit_card_charge)** - זיהוי לפי תיאור:
**⚠️ חשוב! זו לא הוצאה אמיתית - זו העברה שמצריכה דוח אשראי!**

- **זיהוי:** "ויזה", "ויזא", "visa", "מאסטרקארד", "mastercard", "אמריקן אקספרס", "american express", "אמקס", "amex", "דינרס", "diners", "דיינרס", "ישראכרט", "isracard", "כאל", "cal", "מקס", "max", "לאומי קארד", "חיוב כרטיס", "חיוב לכרטיס"

- **דוגמאות מדוח בנק:**
  - "חיוב ויזא 3943 - 2,500 ₪" → expense_category: "חיוב כרטיס אשראי", expense_type: "special"
  - "חיוב לכרטיס מאסטרקארד ****1234 - 5,890 ₪" → expense_category: "חיוב כרטיס אשראי", expense_type: "special"
  - "כאל ישראכרט ****5678 - 1,234 ₪" → expense_category: "חיוב כרטיס אשראי", expense_type: "special"
  - "לאומי קארד 0001 - 3,456 ₪" → expense_category: "חיוב כרטיס אשראי", expense_type: "special"
  - "אמריקן אקספרס ****9999 - 8,765 ₪" → expense_category: "חיוב כרטיס אשראי", expense_type: "special"
  - "דינרס קלאב - 4,321 ₪" → expense_category: "חיוב כרטיס אשראי", expense_type: "special"

- **חובה לחלץ:** 4 ספרות אחרונות של הכרטיס (אם יש) - שים ב-notes
- **סווג כ-expense** עם:
  - expense_category: "חיוב כרטיס אשראי"
  - expense_type: "special"
  - payment_method: "credit_card"

- **חשוב:** המשתמש יצטרך לסרוק את דוח האשראי כדי לראות את פירוט ההוצאות

### **💵 משיכות מזומן (cash_withdrawal)** - זיהוי לפי תיאור:
**⚠️ חשוב! זו לא הוצאה אמיתית - זו המרה של כסף לקש לידי (מזומן)!**

- **זיהוי:** "משיכה", "משיכת מזומן", "כספומט", "ATM", "cash withdrawal", "משיכה מכספומט", "משיכה בכספומט"

- **דוגמאות מדוח בנק:**
  - "משיכה מכספומט - 500 ₪" → expense_category: "משיכת מזומן", expense_type: "special"
  - "משיכת מזומן בנק לאומי - 1,000 ₪" → expense_category: "משיכת מזומן", expense_type: "special"
  - "ATM WITHDRAWAL - 300 ₪" → expense_category: "משיכת מזומן", expense_type: "special"
  - "משיכה עו\"ש - 2,000 ₪" → expense_category: "משיכת מזומן", expense_type: "special"

- **סווג כ-expense** עם:
  - expense_category: "משיכת מזומן"
  - expense_type: "special"
  - payment_method: "cash"

- **חשוב:** זה רק העברה של כסף מהחשבון למזומן - לא הוצאה ממשית

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

## **🎯 זיהוי מסמכים חסרים (missing_documents):**

**חשוב מאוד!** בנוסף לחילוץ התנועות, זהה גם **מסמכים חסרים** שהמשתמש צריך להעלות:

### **1. חיובי כרטיסי אשראי:**
- חפש תנועות עם: "ויזא", "מאסטרקארד", "אמקס", "דינרס", "חיוב כרטיס"
- לכל חיוב אשראי, חלץ:
  - card_last_4: 4 ספרות אחרונות של הכרטיס (אם מופיע)
  - charge_date: תאריך החיוב
  - charge_amount: סכום החיוב
  - statement_period: תקופת הדוח הנדרשת (חודש לפני תאריך החיוב)

**דוגמה:** "חיוב ויזא ****1234 - 5,890 ₪" בתאריך 10/11/2024
→ צריך דוח אשראי לתקופה: 10/10/2024 - 10/11/2024

### **2. משכורות:**
- חפש תנועות הכנסה מסוג "משכורת"
- לכל משכורת, חלץ:
  - salary_date: תאריך קבלת המשכורת
  - salary_amount: סכום המשכורת
  - employer: שם המעסיק (אם מופיע)
  - month: חודש המשכורת

**דוגמה:** "משכורת חברת XYZ - 15,234 ₪" בתאריך 01/08/2024
→ צריך תלוש משכורת לחודש: אוגוסט 2024

### **3. תשלומי משכנתא:**
- חפש תנועות עם: "משכנתא", "הלוואת דיור"
- לכל תשלום משכנתא, חלץ:
  - payment_date: תאריך התשלום
  - payment_amount: סכום התשלום
  - lender: הבנק המלווה

**דוגמה:** "תשלום משכנתא בנק דיסקונט - 4,567 ₪"
→ צריך דוח משכנתא עדכני

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
  "missing_documents": [
    {
      "type": "credit",
      "card_last_4": "1234",
      "charge_date": "2024-11-10",
      "charge_amount": 5890.00,
      "period_start": "2024-10-10",
      "period_end": "2024-11-10",
      "description": "חיוב ויזא ****1234"
    },
    {
      "type": "payslip",
      "salary_date": "2024-08-01",
      "salary_amount": 15234.00,
      "employer": "חברת XYZ",
      "month": "2024-08",
      "description": "משכורת חברת XYZ"
    },
    {
      "type": "mortgage",
      "payment_date": "2024-08-05",
      "payment_amount": 4567.00,
      "lender": "בנק דיסקונט",
      "description": "תשלום משכנתא"
    }
  ],
  "transactions": {
    "income": [
      {
        "date": "05/10/2025",
        "description": "משכורת",
        "vendor": "מעסיק",
        "amount": 10000.00,
        "balance_before": 5000.00,
        "balance_after": 15000.00,
        "income_category": "משכורת",
        "employment_type": "employee",
        "category": "הכנסה מעבודה",
        "payment_method": "bank_transfer",
        "notes": "הכנסה - יתרה עלתה מ-5000 ל-15000"
      },
      {
        "date": "12/10/2025",
        "description": "קצבת זקנה",
        "vendor": "ביטוח לאומי",
        "amount": 3500.00,
        "balance_before": 15000.00,
        "balance_after": 18500.00,
        "income_category": "קצבה",
        "allowance_type": "pension",
        "category": "גמלאות",
        "payment_method": "bank_transfer",
        "notes": "קצבה מביטוח לאומי"
      }
    ],
    "expenses": [
      {
        "date": "02/10/2025",
        "description": "קניות בסופר",
        "vendor": "סופר דוידי",
        "amount": 350.00,
        "balance_before": 15000.00,
        "balance_after": 14650.00,
        "category": "סופרמרקט",
        "expense_type": "variable",
        "payment_method": "credit_card",
        "notes": "הוצאה - יתרה ירדה מ-15000 ל-14650"
      }
    ],
    "loan_payments": [
      {
        "date": "15/10/2025",
        "description": "החזר הלוואה בנק לאומי",
        "vendor": "בנק לאומי",
        "amount": 2000.00,
        "balance_before": 14650.00,
        "balance_after": 12650.00,
        "principal": 1500.00,
        "interest": 500.00,
        "loan_provider": "בנק לאומי",
        "payment_method": "direct_debit",
        "notes": "תשלום הלוואה"
      }
    ],
    "savings_transfers": [
      {
        "date": "15/10/2025",
        "description": "העברה לפיקדון",
        "vendor": "העברה פנימית",
        "amount": 1000.00,
        "balance_before": 12650.00,
        "balance_after": 11650.00,
        "to_account": "פיקדון",
        "payment_method": "bank_transfer",
        "notes": "העברה לחיסכון"
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

export function getLoanStatementPrompt(text: string | null): string {
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

export function getMortgageStatementPrompt(text: string | null): string {
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

export function getInsuranceStatementPrompt(text: string | null): string {
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

export function getPayslipPrompt(text: string | null): string {
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

export function getPensionStatementPrompt(text: string | null): string {
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
  extractedText: string | null,
  categories?: Array<{name: string; expense_type: string; category_group: string}>
): string {
  const normalizedType = documentType.toLowerCase();

  if (normalizedType.includes('credit') || normalizedType === 'credit_statement') {
    return getCreditStatementPrompt(extractedText, categories);
  }

  if (normalizedType.includes('bank') || normalizedType === 'bank_statement') {
    return getBankStatementPrompt(extractedText, categories);
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
  return getCreditStatementPrompt(extractedText, categories);
}

