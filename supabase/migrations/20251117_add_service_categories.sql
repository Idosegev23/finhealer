-- Add service categories for various types of services
-- Created: 2025-11-17
-- Purpose: Add comprehensive service categories for better expense tracking

-- Add service categories
INSERT INTO expense_categories (name, expense_type, category_group, applicable_to, search_keywords, is_active)
VALUES 
  -- General services
  ('שירותים כלליים', 'variable', 'professional_services', 'both', 
   ARRAY['שירותים', 'שירות', 'בעל מקצוע', 'מומחה', 'עבודה'], true),
  
  -- Home services
  ('שירותי תיקונים', 'variable', 'home_services', 'both', 
   ARRAY['תיקון', 'תיקונים', 'תחזוקה', 'טכנאי', 'מתקן'], true),
  
  ('שירותי ניקיון', 'variable', 'home_services', 'both', 
   ARRAY['ניקיון', 'ניקיונות', 'מנקה', 'עוזרת בית', 'שטיפה'], true),
  
  ('שירותי גינון', 'variable', 'home_services', 'both', 
   ARRAY['גינון', 'גן', 'גינה', 'גנן', 'צמחים'], true),
  
  -- Professional services
  ('שירותים מקצועיים', 'variable', 'professional_services', 'both', 
   ARRAY['מקצועי', 'מומחה', 'יועץ', 'שירות מקצועי', 'מומחיות'], true),
  
  -- Digital services
  ('שירותי מחשוב', 'variable', 'digital', 'both', 
   ARRAY['מחשוב', 'מחשבים', 'תמיכה טכנית', 'IT', 'תוכנה'], true)
ON CONFLICT (name) DO NOTHING;

-- Add comment
COMMENT ON TABLE expense_categories IS 'Expense categories including comprehensive service categories added on 2025-11-17';

