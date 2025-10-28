-- ============================================================================
-- Migration: Comprehensive Financial System
-- תאריך: 2025-01-28
-- תיאור: מבנה מלא למערכת ניהול פיננסי עם תמיכה ב-OCR מתקדם
-- ============================================================================

-- ============================================================================
-- SECTION 1: Core Tables - משתמשים ומערכת
-- ============================================================================

-- טבלה: income_sources - מקורות הכנסה קבועים
CREATE TABLE IF NOT EXISTS public.income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('salary', 'freelance', 'business', 'passive', 'other')),
  amount DECIMAL(10,2) NOT NULL,
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'weekly', 'annual', 'one_time')),
  start_date DATE,
  end_date DATE,
  active BOOLEAN DEFAULT TRUE,
  
  -- Payslip detailed data
  gross_salary DECIMAL(10,2),
  net_salary DECIMAL(10,2),
  tax_deducted DECIMAL(10,2),
  social_security DECIMAL(10,2),
  pension_employee DECIMAL(10,2),
  pension_employer DECIMAL(10,2),
  
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_income_sources_user_id ON public.income_sources(user_id);
CREATE INDEX idx_income_sources_active ON public.income_sources(active) WHERE active = TRUE;

-- ============================================================================
-- SECTION 2: Financial Data - נתונים כספיים
-- ============================================================================

-- טבלה: loans - הלוואות ומשכנתאות (משודרגת)
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Loan details
  loan_type TEXT NOT NULL CHECK (loan_type IN ('personal', 'mortgage', 'car', 'credit_line', 'other')),
  lender TEXT,
  original_amount DECIMAL(10,2) NOT NULL,
  current_balance DECIMAL(10,2) NOT NULL,
  
  -- Terms
  interest_rate DECIMAL(5,2),
  monthly_payment DECIMAL(10,2),
  remaining_months INTEGER,
  
  -- Dates
  start_date DATE,
  end_date DATE,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'refinanced', 'defaulted')),
  
  -- Link to loan application (if exists)
  application_id UUID,
  
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loans_user_id ON public.loans(user_id);
CREATE INDEX idx_loans_status ON public.loans(status);

-- טבלה: savings_accounts - חשבונות חיסכון
CREATE TABLE IF NOT EXISTS public.savings_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  account_name TEXT NOT NULL,
  account_type TEXT CHECK (account_type IN ('savings', 'term_deposit', 'checking', 'other')),
  bank_name TEXT,
  account_number TEXT,
  
  current_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  interest_rate DECIMAL(5,2),
  
  -- Dates
  opened_date DATE,
  maturity_date DATE,
  
  active BOOLEAN DEFAULT TRUE,
  
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_savings_accounts_user_id ON public.savings_accounts(user_id);
CREATE INDEX idx_savings_accounts_active ON public.savings_accounts(active) WHERE active = TRUE;

-- טבלה: investments - השקעות
CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  investment_type TEXT NOT NULL CHECK (investment_type IN ('stocks', 'bonds', 'mutual_funds', 'etf', 'crypto', 'real_estate', 'other')),
  provider TEXT,
  account_number TEXT,
  
  current_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  invested_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  return_rate DECIMAL(5,2),
  
  last_updated DATE,
  
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_investments_user_id ON public.investments(user_id);

-- טבלה: insurance - ביטוחים
CREATE TABLE IF NOT EXISTS public.insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  policy_type TEXT NOT NULL CHECK (policy_type IN ('life', 'health', 'property', 'car', 'pension_insurance', 'other')),
  provider TEXT,
  policy_number TEXT,
  
  coverage_amount DECIMAL(10,2),
  monthly_premium DECIMAL(10,2),
  annual_premium DECIMAL(10,2),
  
  start_date DATE,
  end_date DATE,
  renewal_date DATE,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  
  coverage_details JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insurance_user_id ON public.insurance(user_id);
CREATE INDEX idx_insurance_status ON public.insurance(status);
CREATE INDEX idx_insurance_renewal_date ON public.insurance(renewal_date) WHERE status = 'active';

-- טבלה: pensions - פנסיה וחיסכון פנסיוני
CREATE TABLE IF NOT EXISTS public.pensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  pension_type TEXT NOT NULL CHECK (pension_type IN ('pension_fund', 'provident_fund', 'study_fund', 'insurance', 'other')),
  provider TEXT,
  policy_number TEXT,
  
  current_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  monthly_deposit DECIMAL(10,2),
  employer_deposit DECIMAL(10,2),
  
  management_fees DECIMAL(5,2),
  annual_return DECIMAL(5,2),
  
  start_date DATE,
  
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pensions_user_id ON public.pensions(user_id);

-- ============================================================================
-- SECTION 3: Documents & OCR - סריקת מסמכים
-- ============================================================================

-- טבלה: uploaded_documents - מסמכים מרכזיים (מרחיב את uploaded_statements)
CREATE TABLE IF NOT EXISTS public.uploaded_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Document metadata
  document_type TEXT NOT NULL CHECK (document_type IN (
    'bank', 'credit', 'payslip', 'pension', 'insurance', 
    'loan', 'investment', 'savings', 'receipt', 'other'
  )),
  sub_type TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Period covered
  period_start DATE,
  period_end DATE,
  
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMPTZ,
  processing_time_ms INTEGER,
  
  -- Extracted data
  extracted_data JSONB,
  confidence_score DECIMAL(5,2),
  transactions_extracted INTEGER DEFAULT 0,
  
  -- Validation
  user_validated BOOLEAN DEFAULT FALSE,
  validation_notes TEXT,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB,
  
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_uploaded_documents_user_id ON public.uploaded_documents(user_id);
CREATE INDEX idx_uploaded_documents_type ON public.uploaded_documents(document_type);
CREATE INDEX idx_uploaded_documents_status ON public.uploaded_documents(status);
CREATE INDEX idx_uploaded_documents_period ON public.uploaded_documents(period_start, period_end);
CREATE INDEX idx_uploaded_documents_extracted_data ON public.uploaded_documents USING GIN (extracted_data);

-- טבלה: document_corrections - תיקונים משתמש
CREATE TABLE IF NOT EXISTS public.document_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.uploaded_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  field_name TEXT NOT NULL,
  original_value TEXT,
  corrected_value TEXT,
  
  corrected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_corrections_document_id ON public.document_corrections(document_id);
CREATE INDEX idx_document_corrections_user_id ON public.document_corrections(user_id);

-- ============================================================================
-- SECTION 4: Enhanced Transactions Table
-- ============================================================================

-- הוסף עמודות חדשות ל-transactions (אם לא קיימות)
DO $$ 
BEGIN
  -- Add document_id reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'document_id'
  ) THEN
    ALTER TABLE public.transactions ADD COLUMN document_id UUID REFERENCES public.uploaded_documents(id);
    CREATE INDEX idx_transactions_document_id ON public.transactions(document_id);
  END IF;
  
  -- Add receipt_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'receipt_id'
  ) THEN
    ALTER TABLE public.transactions ADD COLUMN receipt_id UUID;
  END IF;
  
END $$;

-- ============================================================================
-- SECTION 5: System Tables
-- ============================================================================

-- טבלה: usage_logs - מעקב עלויות
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  operation TEXT NOT NULL,
  tokens INTEGER,
  estimated_cost DECIMAL(10,4),
  
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON public.usage_logs(created_at DESC);

-- ============================================================================
-- SECTION 6: RLS Policies
-- ============================================================================

-- Income Sources
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own income sources" ON public.income_sources
  USING (auth.uid() = user_id);

-- Loans
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own loans" ON public.loans
  USING (auth.uid() = user_id);

-- Savings Accounts
ALTER TABLE public.savings_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own savings accounts" ON public.savings_accounts
  USING (auth.uid() = user_id);

-- Investments
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own investments" ON public.investments
  USING (auth.uid() = user_id);

-- Insurance
ALTER TABLE public.insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own insurance" ON public.insurance
  USING (auth.uid() = user_id);

-- Pensions
ALTER TABLE public.pensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own pensions" ON public.pensions
  USING (auth.uid() = user_id);

-- Uploaded Documents
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own documents" ON public.uploaded_documents
  USING (auth.uid() = user_id);

-- Document Corrections
ALTER TABLE public.document_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own corrections" ON public.document_corrections
  USING (auth.uid() = user_id);

-- Usage Logs (read-only for users)
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own usage" ON public.usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- SECTION 7: Triggers
-- ============================================================================

-- Function: update_updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all relevant tables
CREATE TRIGGER income_sources_updated_at BEFORE UPDATE ON public.income_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER loans_updated_at BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER savings_accounts_updated_at BEFORE UPDATE ON public.savings_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER investments_updated_at BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER insurance_updated_at BEFORE UPDATE ON public.insurance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pensions_updated_at BEFORE UPDATE ON public.pensions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER uploaded_documents_updated_at BEFORE UPDATE ON public.uploaded_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

