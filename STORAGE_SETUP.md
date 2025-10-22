# הגדרת Storage Bucket לסימולטור איחוד הלוואות

## שלבים להגדרה ידנית ב-Supabase Dashboard:

### 1. יצירת Bucket
- היכנס ל-Supabase Dashboard: https://supabase.com/dashboard
- בחר את הפרויקט שלך
- עבור ל-**Storage** בתפריט הצד
- לחץ על **Create a new bucket**
- הזן שם: `loan-documents`
- **Deselect** את "Public bucket" (צריך להיות private!)
- הגדר File size limit: `10 MB`
- שמור

### 2. הגדרת RLS Policies
בחר את bucket `loan-documents` ועבור ל-**Policies**. הוסף את 4 ה-policies הבאות:

#### Policy 1: Upload
```sql
-- Target roles: authenticated
-- Policy name: Users can upload loan documents to their folder
-- Allowed operation: INSERT

(bucket_id = 'loan-documents'::text) 
AND 
((storage.foldername(name))[1] = (auth.uid())::text)
```

#### Policy 2: View
```sql
-- Target roles: authenticated
-- Policy name: Users can view their own loan documents  
-- Allowed operation: SELECT

(bucket_id = 'loan-documents'::text)
AND
((storage.foldername(name))[1] = (auth.uid())::text)
```

#### Policy 3: Update
```sql
-- Target roles: authenticated
-- Policy name: Users can update their own loan documents
-- Allowed operation: UPDATE

(bucket_id = 'loan-documents'::text)
AND
((storage.foldername(name))[1] = (auth.uid())::text)
```

#### Policy 4: Delete
```sql
-- Target roles: authenticated
-- Policy name: Users can delete their own loan documents
-- Allowed operation: DELETE

(bucket_id = 'loan-documents'::text)
AND
((storage.foldername(name))[1] = (auth.uid())::text)
```

### 3. אימות
- נסה להעלות קובץ דרך הקוד
- וודא שהמשתמש יכול לראות רק את הקבצים שלו
- בדוק שמשתמש אחד לא יכול למחוק קבצים של משתמש אחר

## מבנה תיקיות
כל קבצי משתמש יישמרו תחת:
```
loan-documents/
  └── {user_id}/
      ├── {application_id}/
      │   ├── bank_israel_credit_report.pdf
      │   ├── payslip_1.pdf
      │   ├── payslip_2.pdf
      │   └── ...
```

## MIME Types מותרים
- `application/pdf`
- `image/jpeg`
- `image/jpg`
- `image/png`

## הערות אבטחה
- ✅ כל משתמש רואה רק את הקבצים שלו
- ✅ קבצים מוצפנים ב-transit וב-rest
- ✅ גודל מקסימלי: 10MB per file
- ✅ RLS מאומת ברמת השורה

