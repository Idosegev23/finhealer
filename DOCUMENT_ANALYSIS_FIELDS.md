# 📋 השוואת שדות - דוחות מול טבלאות

## 1️⃣ **דוח אשראי / דוח בנק → `transactions`**

| שדה מחולץ | עמודה ב-DB | סטטוס |
|-----------|-----------|-------|
| date | date ✅ | ✅ קיים |
| vendor | vendor ✅ | ✅ קיים |
| amount | amount ✅ | ✅ קיים |
| category | category ✅ | ✅ קיים |
| type | expense_type ✅ | ✅ קיים |
| installment | notes ✅ | ✅ קיים |
| payment_method | payment_method ✅ | ✅ קיים |
| confidence_score | confidence_score ✅ | ✅ קיים |

**✅ כל השדות קיימים!**

---

## 2️⃣ **דוח הלוואות רגיל → `loans`**

| שדה מחולץ | עמודה ב-DB | סטטוס |
|-----------|-----------|-------|
| loan_number | ❌ חסר | ⚠️ נשמור ב-metadata |
| loan_name | ❌ חסר | ⚠️ נשמור ב-metadata |
| original_amount | original_amount ✅ | ✅ קיים |
| outstanding_balance | current_balance ✅ | ✅ קיים |
| annual_interest_rate | interest_rate ✅ | ✅ קיים |
| next_payment_amount | monthly_payment ✅ | ✅ קיים |
| remaining_payments | ❌ חסר | ⚠️ נחשב מתוך remaining_months |

**✅ כל השדות קיימים או ניתן למיפוי!**

---

## 3️⃣ **דוח משכנתא → `loans`**

משכנתא = מספר מסלולים, כל מסלול = `loan` נפרד

| שדה מחולץ | עמודה ב-DB | סטטוס |
|-----------|-----------|-------|
| report_date | ❌ חסר | ⚠️ נשמור ב-metadata |
| customer_name | ❌ חסר | ⚠️ נשמור ב-metadata |
| property_address | ❌ חסר | ⚠️ נשמור ב-metadata |
| total_debt | ❌ חסר | ⚠️ סכום כל המסלולים |
| track_number | ❌ חסר | ⚠️ נשמור ב-metadata |
| track_type | loan_type ✅ | ✅ קיים (נשתמש ב-'mortgage') |
| index_type | ❌ חסר | ⚠️ נשמור ב-metadata |
| original_amount | original_amount ✅ | ✅ קיים |
| current_balance | current_balance ✅ | ✅ קיים |
| interest_rate | interest_rate ✅ | ✅ קיים |
| monthly_payment | monthly_payment ✅ | ✅ קיים |

**✅ כל השדים קיימים או ניתן למיפוי!**

---

## 4️⃣ **דוח ביטוחים → `insurance`**

| שדה מחולץ | עמודה ב-DB | סטטוס |
|-----------|-----------|-------|
| report_date | ❌ חסר | ⚠️ נשמור ב-metadata |
| id_number | ❌ חסר | ⚠️ נשמור ב-metadata |
| domain | ❌ חסר | ⚠️ נשמור ב-metadata או coverage_details |
| main_branch | ❌ חסר | ⚠️ נשמור ב-metadata או coverage_details |
| sub_branch | ❌ חסר | ⚠️ נשמור ב-metadata או coverage_details |
| product_type | ❌ חסר | ⚠️ נשמור ב-metadata |
| insurance_company | provider ✅ | ✅ קיים |
| coverage_period | start_date, end_date ✅ | ✅ קיים |
| premium_amount | monthly_premium / annual_premium ✅ | ✅ קיים |
| premium_type | ❌ חסר | ⚠️ נשמור ב-metadata |
| policy_number | policy_number ✅ | ✅ קיים |

**✅ כל השדים קיימים או ניתן למיפוי!**

---

## ✅ **סיכום:**

### **הכל עובד!** 

כל השדות שחילצנו ניתנים למיפוי לטבלאות הקיימות:
- **transactions** ✅ מוכן
- **loans** ✅ מוכן (metadata לשדות נוספים)
- **insurance** ✅ מוכן (metadata לשדות נוספים)

### **המלצה:**
לא צריך migration חדש! נשתמש ב:
1. **`metadata` JSONB** - לשדות נוספים שאין להם עמודה ייעודית
2. **`coverage_details` JSONB** - ב-insurance לפרטי כיסוי

---

## 📝 **צעדים הבאים:**
1. ✅ ליצור קובץ פרומפטים (`lib/ai/document-prompts.ts`)
2. ✅ לעדכן `/api/documents/process/route.ts`
3. ✅ לעדכן `DocumentUploader` לתמוך ב-5 סוגי מסמכים

