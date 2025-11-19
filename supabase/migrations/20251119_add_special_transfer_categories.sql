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

-- הוספת הערה
COMMENT ON TABLE expense_categories IS 'Expense categories including credit card charge, cash withdrawal, professional fees, professional development, and tax categories added on 2025-11-19';


