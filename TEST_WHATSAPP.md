# 🧪 WhatsApp Testing Guide

**תאריך:** 25 אוקטובר 2025  
**מטרה:** בדיקת GreenAPI Integration

---

## 🚀 **איך לבדוק:**

### **אופציה 1: דפדפן (הכי פשוט)**

1. **הרץ את הפרויקט:**
```bash
npm run dev
```

2. **פתח בדפדפן:**
```
http://localhost:3000/api/test/wa?phone=972547667775
```

3. **בדוק את ה-WhatsApp** בטלפון `972547667775` - אמורה להגיע הודעה!

---

### **אופציה 2: Terminal (עם jq)**

```bash
# הרץ את הסקריפט
./test-wa.sh
```

**או ידנית:**
```bash
curl "http://localhost:3000/api/test/wa?phone=972547667775" | jq '.'
```

---

### **אופציה 3: POST עם הודעה מותאמת**

```bash
curl -X POST http://localhost:3000/api/test/wa \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "972547667775",
    "message": "היי! זו הודעת בדיקה 🚀",
    "testButtons": true
  }' | jq '.'
```

---

## 📱 **מה אמור לקרות:**

### **1. בלוג של הטרמינל:**
```
🧪 Testing GreenAPI...
📱 Phone: 972547667775

1️⃣ Testing getInstanceStatus...
✅ Status: { stateInstance: 'authorized' }

2️⃣ Testing sendMessage...
✅ Message sent: { idMessage: 'ABC123...' }
```

### **2. ב-WhatsApp (972547667775):**
```
🤖 היי! זה פיני מ-FinHealer!

זו הודעת בדיקה לראות שהכל עובד.

אם קיבלת את זה - הכל מצוין! ✅

תאריך: 25/10/2025, 20:30:00
```

### **3. תגובת API:**
```json
{
  "success": true,
  "results": {
    "instanceStatus": {
      "stateInstance": "authorized"
    },
    "messageSent": {
      "idMessage": "3EB0123...",
      "chatId": "972547667775@c.us"
    },
    "phone": "972547667775",
    "format": "972547667775@c.us"
  },
  "timestamp": "2025-10-25T20:30:00.000Z"
}
```

---

## ❌ **אם יש שגיאה:**

### **שגיאה 1: Instance Not Authorized**
```json
{
  "error": "Instance not authorized"
}
```

**פתרון:**
1. היכנס ל-[GreenAPI Dashboard](https://console.green-api.com)
2. בדוק את סטטוס ה-instance
3. סרוק QR code מחדש אם צריך

---

### **שגיאה 2: Invalid Phone Number**
```json
{
  "error": "Invalid phone number"
}
```

**פתרון:**
וודא שהמספר בפורמט: `972547667775` (ללא + ללא אפס מוביל)

---

### **שגיאה 3: Network Error**
```json
{
  "error": "fetch failed"
}
```

**פתרון:**
1. בדוק חיבור לאינטרנט
2. בדוק שה-credentials ב-`.env.local` נכונים:
```env
GREEN_API_INSTANCE_ID=your_instance_id
GREEN_API_TOKEN=your_token
```

---

## 🔍 **בדיקות נוספות:**

### **בדיקת Buttons (אם נתמך):**
```bash
curl -X POST http://localhost:3000/api/test/wa \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "972547667775",
    "message": "בחר אופציה:",
    "testButtons": true
  }'
```

**אם buttons לא עובד:**
```json
{
  "results": {
    "messageSent": {...},
    "buttonsError": {
      "message": "...",
      "note": "Buttons might be deprecated by WhatsApp"
    }
  }
}
```

זה אומר ש-WhatsApp הפסיקה לתמוך בזה → נחליף ל-List Messages.

---

## 📊 **Checklist:**

- [ ] השרת רץ (`npm run dev`)
- [ ] `.env.local` מוגדר נכון
- [ ] GreenAPI instance authorized
- [ ] מספר הטלפון נכון (`972547667775`)
- [ ] קריאה ל-API עבדה
- [ ] הודעה התקבלה ב-WhatsApp ✅

---

## 🎯 **מה בודקים:**

1. ✅ **getInstanceStatus** - ה-instance מחובר
2. ✅ **sendMessage** - שליחת הודעה עובדת
3. ✅ **פורמט phone** - `972xxx@c.us` נכון
4. ⚠️ **sendButtons** - אם נתמך (optional)

---

## 🚀 **Next Steps:**

אם הכל עבד:
1. ✅ Integration מוכן!
2. ✅ אפשר להתחיל לשלוח הודעות למשתמשים
3. ✅ Webhook מוכן לקבל הודעות
4. ✅ AI (פיני) מוכן לשיחה

---

**Created:** 25 אוקטובר 2025  
**Status:** Ready for Testing 🧪

