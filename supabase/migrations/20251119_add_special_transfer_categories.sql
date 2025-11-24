-- ============================================================================
-- Migration: Add Special Categories
-- תאריך: 2025-11-19
-- תיאור: הוספת קטגוריות מיוחדות:
--         1. חיוב כרטיס אשראי - העברה שמצריכה סריקת דוח אשראי
--         2. משיכת מזומן - המרה של כסף דיגיטלי למזומן
--         3. שכר טרחה - שירותים מקצועיים (עו"ד, רו"ח, יועצים)
--         4. השתלמות מקצועית - קורסים, סדנאות, כנסים, הדרכות
--         5. מע"מ - מס ערך מוסף
--         6. מס הכנסה - תשלומי מס הכנסה
--         7. מס בריאות - מס בריאות ממשכורת
--         8. עמלות בנק - עמלות ודמי ניהול בנקאיים
--         9. הלוואות פנסיוניות - הלוואות מקרנות פנסיה
--         10. הלוואות חוץ בנקאיות - הלוואות פרטיות
--         11. הלוואה מכרטיס אשראי - משיכות ומסגרת אשראי
--         12. תשלום משכורת - תשלומי שכר לעובדים (מיוחדות)
-- ============================================================================

-- הוספת קטגוריה "חיוב כרטיס אשראי"
INSERT INTO expense_categories (
  name, 
  expense_type, 
  category_group, 
  applicable_to, 
  search_keywords, 
  is_active,
  description
)
VALUES (
  'חיוב כרטיס אשראי',
  'special',
  'financial_transfers',
  'both',
  ARRAY['ויזה', 'ויזא', 'visa', 'מאסטרקארד', 'mastercard', 'אמריקן אקספרס', 'american express', 'אמקס', 'amex', 'דינרס', 'diners', 'ישראכרט', 'isracard', 'כאל', 'cal', 'מקס', 'max', 'לאומי קארד', 'leumi card', 'חיוב כרטיס', 'חיוב לכרטיס', 'כרטיס אשראי'],
  true,
  'חיוב כרטיס אשראי בדוח בנק - מצריך סריקת דוח אשראי לפירוט הוצאות'
)
ON CONFLICT (name) DO UPDATE SET
  search_keywords = EXCLUDED.search_keywords,
  description = EXCLUDED.description,
  updated_at = NOW();

-- הוספת קטגוריה "משיכת מזומן"
INSERT INTO expense_categories (
  name, 
  expense_type, 
  category_group, 
  applicable_to, 
  search_keywords, 
  is_active
)
VALUES (
  'משיכת מזומן',
  'special',
  'financial_transfers',
  'both',
  ARRAY['משיכה', 'משיכת מזומן', 'כספומט', 'כסף מזומן', 'atm', 'cash withdrawal', 'withdrawal', 'משיכה מכספומט', 'משיכה בכספומט', 'מכספומט', 'משיכה מעו"ש', 'משיכת כסף', 'משיכת מזומן מעו"ש', 'משיכה בנק', 'משיכה מהבנק'],
  true
)
ON CONFLICT (name) DO UPDATE SET
  search_keywords = EXCLUDED.search_keywords;

-- הוספת קטגוריה "שכר טרחה"
INSERT INTO expense_categories (
  name, 
  expense_type, 
  category_group, 
  applicable_to, 
  search_keywords, 
  is_active
)
VALUES (
  'שכר טרחה',
  'variable',
  'professional_services',
  'both',
  ARRAY['שכר טרחה', 'שכ"ט', 'שכט', 'עורך דין', 'עו"ד', 'עוד', 'משפטי', 'יועץ משפטי', 'רואה חשבון', 'רו"ח', 'רוח', 'חשב', 'הנהלת חשבונות', 'יועץ מס', 'ייעוץ מס', 'יועץ עסקי', 'שמאי', 'שמאות', 'שמאי מקרקעין', 'מהנדס', 'אדריכל', 'יועץ', 'שירותים מקצועיים', 'מקצועי', 'legal fees', 'attorney', 'lawyer', 'accountant', 'consultant', 'professional fee', 'professional service'],
  true
)
ON CONFLICT (name) DO UPDATE SET
  search_keywords = EXCLUDED.search_keywords;

-- הוספת קטגוריה "השתלמות מקצועית"
INSERT INTO expense_categories (
  name, 
  expense_type, 
  category_group, 
  applicable_to, 
  search_keywords, 
  is_active
)
VALUES (
  'השתלמות מקצועית',
  'variable',
  'education',
  'both',
  ARRAY['השתלמות מקצועית', 'השתלמות', 'פיתוח מקצועי', 'קורס', 'קורסים', 'סדנה', 'סדנאות', 'הדרכה', 'כנס', 'כנסים', 'סמינר', 'סמינרים', 'הכשרה', 'הכשרה מקצועית', 'הכשרה עסקית', 'למידה', 'לימודים', 'לימוד מקצועי', 'הסמכה', 'הסמכה מקצועית', 'תעודה', 'ספרים מקצועיים', 'חומרי לימוד', 'אוניברסיטה', 'מכללה', 'לימודים גבוהים', 'קורס אונליין', 'קורס מקוון', 'למידה מרחוק', 'professional development', 'training', 'course', 'workshop', 'seminar', 'conference', 'certification', 'education', 'online course', 'e-learning', 'professional training'],
  true
)
ON CONFLICT (name) DO UPDATE SET
  search_keywords = EXCLUDED.search_keywords;

-- הוספת קטגוריות מיסים
INSERT INTO expense_categories (
  name, 
  expense_type, 
  category_group, 
  applicable_to, 
  search_keywords, 
  is_active
)
VALUES 
  -- מע"מ
  (
    'מע"מ',
    'fixed',
    'taxes',
    'both',
    ARRAY['מע"מ', 'מעמ', 'מס ערך מוסף', 'מס עמ', 'vat', 'value added tax', 'מס על מכירות', 'מס מוסף'],
    true
  ),
  -- מס הכנסה
  (
    'מס הכנסה',
    'fixed',
    'taxes',
    'both',
    ARRAY['מס הכנסה', 'מס הכנסה ממשכורת', 'ניכוי מס', 'income tax', 'tax', 'income', 'מס שנתי', 'מס חודשי', 'תשלום מס', 'רשות המיסים', 'פקיד השומה'],
    true
  ),
  -- מס בריאות
  (
    'מס בריאות',
    'fixed',
    'taxes',
    'both',
    ARRAY['מס בריאות', 'מס בריאות ממשכורת', 'health tax', 'briut', 'בריאות', 'ניכוי בריאות'],
    true
  )
ON CONFLICT (name) DO UPDATE SET
  search_keywords = EXCLUDED.search_keywords;

-- הוספת קטגוריות עמלות בנק וסוגי הלוואות
INSERT INTO expense_categories (
  name, 
  expense_type, 
  category_group, 
  applicable_to, 
  search_keywords, 
  is_active
)
VALUES 
  -- עמלות בנק
  (
    'עמלות בנק',
    'fixed',
    'banking',
    'both',
    ARRAY['עמלות בנק', 'עמלת בנק', 'עמלות', 'עמלה', 'דמי ניהול חשבון', 'דמי ניהול', 'ניהול חשבון', 'עמלת העברה', 'עמלת משיכה', 'עמלת המרה', 'bank fees', 'bank fee', 'commission', 'service charge', 'עמלת כספומט', 'עמלת המחאה', 'עמלת שיק', 'עמלת חיוב', 'דמי טיפול'],
    true
  ),
  -- הלוואות פנסיוניות
  (
    'הלוואות פנסיוניות',
    'fixed',
    'loans',
    'both',
    ARRAY['הלוואה פנסיונית', 'הלוואות פנסיוניות', 'הלוואה מקרן פנסיה', 'הלוואה מפנסיה', 'משיכה מפנסיה', 'משיכה מקרן', 'pension loan', 'retirement loan', 'הלוואה מקרן השתלמות', 'הלוואה מגמל'],
    true
  ),
  -- הלוואות חוץ בנקאיות
  (
    'הלוואות חוץ בנקאיות',
    'fixed',
    'loans',
    'both',
    ARRAY['הלוואה חוץ בנקאית', 'הלוואות חוץ בנקאיות', 'הלוואה פרטית', 'הלוואות פרטיות', 'הלוואה ממשפחה', 'הלוואה מחבר', 'הלוואה לא רשמית', 'הלוואה מפרטי', 'private loan', 'non-bank loan', 'personal loan', 'הלוואה מידידים', 'הלוואה מקרובים'],
    true
  ),
  -- הלוואה מכרטיסי אשראי
  (
    'הלוואה מכרטיס אשראי',
    'fixed',
    'loans',
    'both',
    ARRAY['הלוואה מכרטיס אשראי', 'הלוואת כרטיס אשראי', 'הלוואה מויזה', 'הלוואה ממאסטרקארד', 'קרדיט מכרטיס', 'משיכת מזומן מאשראי', 'credit card loan', 'card loan', 'credit line', 'מסגרת אשראי', 'משיכת אשראי', 'הלוואה מכאל', 'הלוואה מישראכרט'],
    true
  )
ON CONFLICT (name) DO UPDATE SET
  search_keywords = EXCLUDED.search_keywords;

-- תשלום משכורת (מיוחדות)
INSERT INTO expense_categories (
  name, 
  expense_type, 
  category_group, 
  applicable_to, 
  search_keywords, 
  is_active
)
VALUES (
  'תשלום משכורת',
  'special',
  'employees',
  'both',
  ARRAY['תשלום משכורת', 'תשלומי משכורת', 'משכורת', 'שכר עובדים', 'שכר לעובדים', 'תשלום שכר', 'שכר חודשי', 'משכורות', 'תשלום עובד', 'salary payment', 'payroll', 'employee salary', 'wage payment', 'employee wages', 'תשלום לעובדים', 'העברת משכורת', 'שכר נטו', 'תשלום נטו לעובד'],
  true
)
ON CONFLICT (name) DO UPDATE SET
  search_keywords = EXCLUDED.search_keywords;

-- הוספת הערה
COMMENT ON TABLE expense_categories IS 'Expense categories including credit card charge, cash withdrawal, professional fees, professional development, tax categories, bank fees, loan types, and salary payments added on 2025-11-19';


