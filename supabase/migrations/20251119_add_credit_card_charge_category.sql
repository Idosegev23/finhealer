-- ============================================================================
-- Migration: Add "חיוב כרטיס אשראי" Category
-- תאריך: 2025-11-19
-- תיאור: הוספת קטגוריה מיוחדת לחיובי כרטיס אשראי בדוחות בנק
--         זו לא הוצאה אמיתית - זו העברה שמצריכה סריקת דוח אשראי
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

-- הוספת הערה
COMMENT ON TABLE expense_categories IS 'Expense categories including credit card charge tracking category added on 2025-11-19';


