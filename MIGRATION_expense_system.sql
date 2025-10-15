-- Migration: Expense Categorization System
-- תאריך: 2025-01-15
-- תיאור: מערכת זיהוי וסיווג הוצאות חכמה

-- 1. יצירת טבלת קטגוריות הוצאות
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('fixed', 'variable', 'special')),
  applicable_to TEXT NOT NULL CHECK (applicable_to IN ('employee', 'self_employed', 'both')),
  category_group TEXT,
  display_order INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_expense_categories_applicable ON public.expense_categories(applicable_to);
CREATE INDEX IF NOT EXISTS idx_expense_categories_name ON public.expense_categories(name);
CREATE INDEX IF NOT EXISTS idx_expense_categories_active ON public.expense_categories(is_active);

-- 2. יצירת טבלת הוצאות מותאמות אישית
CREATE TABLE IF NOT EXISTS public.user_custom_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('fixed', 'variable', 'special')),
  category_group TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- RLS policies
ALTER TABLE public.user_custom_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own custom expenses"
  ON public.user_custom_expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom expenses"
  ON public.user_custom_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom expenses"
  ON public.user_custom_expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom expenses"
  ON public.user_custom_expenses FOR DELETE
  USING (auth.uid() = user_id);

-- 3. הוספת שדה employment_status לטבלת users
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS employment_status TEXT 
  CHECK (employment_status IN ('employee', 'self_employed', 'both'));

-- 4. עדכון טבלת transactions
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS expense_type TEXT CHECK (expense_type IN ('fixed', 'variable', 'special')),
  ADD COLUMN IF NOT EXISTS category_group TEXT,
  ADD COLUMN IF NOT EXISTS auto_categorized BOOLEAN DEFAULT FALSE;

-- אינדקס לביצועים
CREATE INDEX IF NOT EXISTS idx_transactions_expense_type ON public.transactions(expense_type);

-- Grant permissions
GRANT SELECT ON public.expense_categories TO authenticated;
GRANT ALL ON public.user_custom_expenses TO authenticated;

-- הערות:
COMMENT ON TABLE public.expense_categories IS 'קטגוריות הוצאות מוגדרות מראש';
COMMENT ON TABLE public.user_custom_expenses IS 'הוצאות מותאמות אישית למשתמשים';
COMMENT ON COLUMN public.transactions.expense_type IS 'סוג הוצאה: קבועה/משתנה/מיוחדת';
COMMENT ON COLUMN public.transactions.auto_categorized IS 'האם קוטגרה אוטומטית על ידי המערכת';

