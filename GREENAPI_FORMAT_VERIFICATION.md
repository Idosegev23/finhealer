# 📱 GreenAPI Format Verification - אימות פורמט

**תאריך:** 25 אוקטובר 2025  
**סטטוס:** ✅ Verified & Correct

---

## 🎯 **הפורמט הנכון של GreenAPI**

לפי [התיעוד הרשמי של GreenAPI](https://green-api.org.il):

### **פורמט chatId:**
```
[קידומת מדינה][מספר טלפון ללא אפס מוביל]@c.us
```

### **דוגמה:**
```
מספר מקורי:  054-7667775
פורמט נכון:  972547667775@c.us
              ^^^^^^^^^^^^ (ללא + ללא אפס מוביל)
```

### **חוקים:**
- ❌ **אין** להשתמש בסימן `+`
- ❌ **אין** אפס מוביל (0)
- ✅ **כן** קידומת מדינה (972 לישראל)
- ✅ **כן** `@c.us` בסוף

---

## ✅ **אימות הקוד שלנו**

### 1. **שמירה ב-DB (`/api/subscription/create`)**

```typescript
// נקה מספר טלפון (הוסף 972 אם אין)
let cleanPhone = phone.replace(/\D/g, ''); // רק ספרות
if (cleanPhone.startsWith('0')) {
  cleanPhone = '972' + cleanPhone.substring(1); // 0521234567 → 972521234567
} else if (!cleanPhone.startsWith('972')) {
  cleanPhone = '972' + cleanPhone; // 521234567 → 972521234567
}
// אם כבר מתחיל ב-972, לא משנים כלום

await supabaseAdmin.from('users').upsert({
  phone: cleanPhone, // 972521234567 (ללא +)
  // ...
})
```

**תוצאה:** `972521234567` ✅

---

### 2. **שליחת הודעה (`lib/greenapi/client.ts`)**

```typescript
async sendMessage({ phoneNumber, message }: SendMessageParams) {
  const url = `${this.baseUrl}/sendMessage/${this.token}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: `${phoneNumber}@c.us`, // 972521234567@c.us
      message: message,
    }),
  });
}
```

**קלט:** `phoneNumber = "972521234567"`  
**שליחה:** `chatId: "972521234567@c.us"` ✅

---

### 3. **קבלת הודעה (`/api/wa/webhook`)**

```typescript
// GreenAPI שולח webhook עם:
payload.senderData.chatId = "972521234567@c.us"

// אנחנו מחלצים:
const phoneNumber = payload.senderData.chatId.replace('@c.us', '');
// → "972521234567"

// מחפשים במסד:
const { data: user } = await supabase
  .from('users')
  .select('id, name, wa_opt_in')
  .eq('phone', phoneNumber) // 972521234567
  .single();
```

**קלט מ-GreenAPI:** `"972521234567@c.us"`  
**חיפוש ב-DB:** `"972521234567"` ✅

---

## 🔄 **Flow מלא**

### **תרחיש 1: משתמש נרשם**

```
משתמש מזין: "052-1234567"
              ↓
Validation:   9 ספרות ✅
              ↓
Cleaning:     "0521234567" → "972521234567"
              ↓
DB Storage:   phone = "972521234567"
```

---

### **תרחיש 2: שליחת הודעה למשתמש**

```
System:       phone = "972521234567"
              ↓
GreenAPI:     chatId = "972521234567@c.us"
              ↓
WhatsApp:     ✅ הודעה נשלחת
```

---

### **תרחיש 3: משתמש שולח הודעה**

```
WhatsApp:     משתמש שולח הודעה
              ↓
GreenAPI:     webhook → chatId = "972521234567@c.us"
              ↓
Webhook:      phoneNumber = "972521234567"
              ↓
DB Query:     WHERE phone = "972521234567"
              ↓
Match:        ✅ משתמש נמצא
              ↓
AI:           פיני עונה
```

---

## 📊 **טבלת המרות**

| קלט מקורי | Cleaning | שמירה ב-DB | GreenAPI Format |
|-----------|----------|------------|-----------------|
| 0521234567 | 972521234567 | 972521234567 | 972521234567@c.us |
| 521234567 | 972521234567 | 972521234567 | 972521234567@c.us |
| 972521234567 | 972521234567 | 972521234567 | 972521234567@c.us |
| +972521234567 | 972521234567 | 972521234567 | 972521234567@c.us |
| 052-123-4567 | 972521234567 | 972521234567 | 972521234567@c.us |

**כל הפורמטים מתוקנים ל:** `972521234567` ✅

---

## ✅ **אימות סופי**

### **שמירה ב-DB:**
```sql
SELECT phone FROM users WHERE id = 'xxx';
-- Expected: "972521234567"
```

### **שליחה ל-GreenAPI:**
```json
{
  "chatId": "972521234567@c.us",
  "message": "היי! 👋"
}
```

### **webhook מ-GreenAPI:**
```json
{
  "senderData": {
    "chatId": "972521234567@c.us"
  }
}
```

**הכל מתאים!** ✅

---

## 🚨 **שגיאות נפוצות (שהימנענו מהן)**

### ❌ **שגיאה 1: שימוש ב-+**
```typescript
// לא נכון:
phone: "+972521234567"
chatId: "+972521234567@c.us"

// נכון:
phone: "972521234567"
chatId: "972521234567@c.us"
```

### ❌ **שגיאה 2: אפס מוביל**
```typescript
// לא נכון:
phone: "0521234567"
chatId: "0521234567@c.us"

// נכון:
phone: "972521234567"
chatId: "972521234567@c.us"
```

### ❌ **שגיאה 3: פורמט לא אחיד**
```typescript
// בעיה:
DB:      "972521234567"
GreenAPI: "+972521234567@c.us"
// → Match failed! ❌

// פתרון:
DB:      "972521234567"
GreenAPI: "972521234567@c.us"
// → Match success! ✅
```

---

## 🔧 **קוד לבדיקה מהירה**

### **Test Function:**
```typescript
function testPhoneFormat(input: string): boolean {
  // נקה
  let clean = input.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '972' + clean.substring(1);
  } else if (!clean.startsWith('972')) {
    clean = '972' + clean;
  }
  
  // בדוק שהפורמט נכון
  const isValid = /^972[0-9]{9}$/.test(clean);
  
  console.log({
    input,
    clean,
    greenAPIFormat: `${clean}@c.us`,
    isValid
  });
  
  return isValid;
}

// דוגמאות:
testPhoneFormat('0521234567');     // ✅ 972521234567@c.us
testPhoneFormat('521234567');      // ✅ 972521234567@c.us
testPhoneFormat('972521234567');   // ✅ 972521234567@c.us
testPhoneFormat('+972521234567');  // ✅ 972521234567@c.us
testPhoneFormat('052-123-4567');   // ✅ 972521234567@c.us
```

---

## 📝 **סיכום**

### **פורמט ב-DB:**
```
972521234567
```

### **פורמט ל-GreenAPI:**
```
972521234567@c.us
```

### **פורמט מ-GreenAPI (webhook):**
```
972521234567@c.us → extract → 972521234567
```

---

## ✅ **Checklist סופי**

- [x] שמירה ב-DB ללא + (972xxx)
- [x] שליחה ל-GreenAPI עם @c.us
- [x] קבלת webhook והסרת @c.us
- [x] Match מוצלח בין webhook ל-DB
- [x] Cleaning נכון בכל המקרים
- [x] Validation (9-10 ספרות)
- [x] תיעוד מלא

---

## 🎯 **Bottom Line**

**הפורמט שלנו נכון לחלוטין!** ✅

```
Input:    "052-1234567"
           ↓
DB:       "972521234567"
           ↓
GreenAPI: "972521234567@c.us"
           ↓
Webhook:  "972521234567@c.us" → "972521234567"
           ↓
Match:    ✅ SUCCESS!
```

**מוכן לפרודקשן!** 🚀

---

**תאריך:** 25 אוקטובר 2025  
**אומת על ידי:** [התיעוד הרשמי של GreenAPI](https://green-api.org.il)  
**סטטוס:** ✅ **100% Verified**

