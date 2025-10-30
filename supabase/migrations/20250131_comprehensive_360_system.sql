-- ============================================================================
-- Migration: Comprehensive 360° Financial System
-- תאריך: 2025-01-31
-- תיאור: הרחבה מלאה למערכת 360 מעלות - טבלאות נוספות, קישורים, איכות נתונים
-- ============================================================================

-- ============================================================================
-- SECTION 1: Additional Linking Fields in transactions
-- ============================================================================

DO $$ 
BEGIN
  -- linked_insurance_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'linked_insurance_id'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN linked_insurance_id UUID REFERENCES public.insurance(id);
    
    CREATE INDEX idx_transactions_linked_insurance ON public.transactions(linked_insurance_id);
    
    COMMENT ON COLUMN public.transactions.linked_insurance_id IS 
    'קישור לביטוח אם זו פרמיית ביטוח';
  END IF;
  
  -- linked_savings_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'linked_savings_id'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN linked_savings_id UUID REFERENCES public.savings_accounts(id);
    
    CREATE INDEX idx_transactions_linked_savings ON public.transactions(linked_savings_id);
    
    COMMENT ON COLUMN public.transactions.linked_savings_id IS 
    'קישור לחשבון חיסכון אם זו הפקדה';
  END IF;
  
  -- linked_pension_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'linked_pension_id'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN linked_pension_id UUID REFERENCES public.pension_insurance(id);
    
    CREATE INDEX idx_transactions_linked_pension ON public.transactions(linked_pension_id);
    
    COMMENT ON COLUMN public.transactions.linked_pension_id IS 
    'קישור לקרן פנסיה אם זו הפקדה פנסיונית';
  END IF;
  
  -- reconciliation_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'reconciliation_status'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN reconciliation_status TEXT DEFAULT 'not_checked' 
    CHECK (reconciliation_status IN ('not_checked', 'matched', 'discrepancy', 'needs_review'));
    
    COMMENT ON COLUMN public.transactions.reconciliation_status IS 
    'סטטוס התאמה: not_checked, matched, discrepancy, needs_review';
  END IF;
  
END $$;

-- ============================================================================
-- SECTION 2: bank_accounts - יתרות חשבון בנק
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Account details
  bank_name TEXT,
  account_number TEXT,
  account_type TEXT, -- 'checking', 'savings', 'credit'
  branch_number TEXT,
  
  -- Balance info
  current_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  available_balance DECIMAL(10,2),
  overdraft_limit DECIMAL(10,2),
  
  -- Snapshot info
  snapshot_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  document_id UUID REFERENCES public.uploaded_statements(id),
  currency TEXT DEFAULT 'ILS',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_user ON public.bank_accounts(user_id);
CREATE INDEX idx_bank_accounts_snapshot ON public.bank_accounts(user_id, snapshot_date DESC);
CREATE INDEX idx_bank_accounts_current ON public.bank_accounts(user_id, is_current) WHERE is_current = TRUE;

-- RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own bank accounts" 
ON public.bank_accounts
USING (auth.uid() = user_id);

COMMENT ON TABLE public.bank_accounts IS 
'יתרות חשבונות בנק - snapshot מכל דוח בנק שהועלה';

-- View: Current bank balance
CREATE OR REPLACE VIEW current_bank_balance AS
SELECT DISTINCT ON (user_id, account_number)
  *
FROM bank_accounts
WHERE is_current = TRUE
ORDER BY user_id, account_number, snapshot_date DESC;

-- ============================================================================
-- SECTION 3: payslips - תלושי שכר
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Employer info
  employer_name TEXT,
  employer_id TEXT, -- ח.פ
  
  -- Period
  month_year DATE NOT NULL,
  pay_date DATE,
  
  -- Salary breakdown
  gross_salary DECIMAL(10,2) NOT NULL,
  net_salary DECIMAL(10,2) NOT NULL,
  
  -- Deductions
  tax_deducted DECIMAL(10,2) DEFAULT 0,
  social_security DECIMAL(10,2) DEFAULT 0,
  health_tax DECIMAL(10,2) DEFAULT 0,
  
  -- Pension & savings
  pension_employee DECIMAL(10,2) DEFAULT 0,
  pension_employer DECIMAL(10,2) DEFAULT 0,
  advanced_study_fund DECIMAL(10,2) DEFAULT 0,
  
  -- Extras
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  overtime_pay DECIMAL(10,2) DEFAULT 0,
  bonus DECIMAL(10,2) DEFAULT 0,
  
  -- Links
  transaction_id UUID REFERENCES public.transactions(id), -- קישור להכנסה
  document_id UUID REFERENCES public.uploaded_statements(id),
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payslips_user ON public.payslips(user_id);
CREATE INDEX idx_payslips_month ON public.payslips(user_id, month_year DESC);

-- RLS
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own payslips" 
ON public.payslips
USING (auth.uid() = user_id);

COMMENT ON TABLE public.payslips IS 
'תלושי שכר - פירוט מלא של הכנסות מעבודה';

-- ============================================================================
-- SECTION 4: recurring_patterns - דפוסים חוזרים
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.recurring_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Pattern details
  vendor TEXT NOT NULL,
  category TEXT,
  expected_amount DECIMAL(10,2) NOT NULL,
  amount_tolerance DECIMAL(5,2) DEFAULT 5.0, -- ±%
  
  -- Timing
  expected_day INTEGER CHECK (expected_day >= 1 AND expected_day <= 31),
  day_tolerance INTEGER DEFAULT 3, -- ±days
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  
  -- Tracking
  last_occurrence DATE,
  next_expected DATE NOT NULL,
  occurrence_count INTEGER DEFAULT 0,
  missed_count INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
  confidence DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Auto-detected or manual
  is_auto_detected BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recurring_patterns_user ON public.recurring_patterns(user_id);
CREATE INDEX idx_recurring_patterns_next ON public.recurring_patterns(next_expected) WHERE status = 'active';

-- RLS
ALTER TABLE public.recurring_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own recurring patterns" 
ON public.recurring_patterns
USING (auth.uid() = user_id);

COMMENT ON TABLE public.recurring_patterns IS 
'דפוסי תשלום חוזרים - זיהוי אוטומטי של הוצאות קבועות';

-- ============================================================================
-- SECTION 5: reconciliation_issues - אי-התאמות
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reconciliation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Related transactions
  parent_transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  related_transaction_ids UUID[],
  
  -- Issue details
  issue_type TEXT NOT NULL CHECK (issue_type IN ('amount_mismatch', 'missing_detail', 'duplicate', 'orphan_detail')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  
  -- Values
  expected_value DECIMAL(10,2),
  actual_value DECIMAL(10,2),
  difference DECIMAL(10,2),
  difference_percent DECIMAL(5,2),
  
  -- Resolution
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored', 'auto_resolved')),
  resolution_action TEXT, -- 'user_confirmed', 'adjusted', 'unlinked'
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reconciliation_issues_user ON public.reconciliation_issues(user_id);
CREATE INDEX idx_reconciliation_issues_status ON public.reconciliation_issues(status) WHERE status = 'pending';
CREATE INDEX idx_reconciliation_issues_parent ON public.reconciliation_issues(parent_transaction_id);

-- RLS
ALTER TABLE public.reconciliation_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own reconciliation issues" 
ON public.reconciliation_issues
USING (auth.uid() = user_id);

COMMENT ON TABLE public.reconciliation_issues IS 
'אי-התאמות בין מסמכים - דוח בנק vs אשראי, כפילויות, וכו';

-- ============================================================================
-- SECTION 6: uploaded_statements - שדות נוספים
-- ============================================================================

DO $$ 
BEGIN
  -- file_hash for duplicate detection
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'uploaded_statements' AND column_name = 'file_hash'
  ) THEN
    ALTER TABLE public.uploaded_statements 
    ADD COLUMN file_hash TEXT;
    
    CREATE UNIQUE INDEX idx_uploaded_statements_hash ON public.uploaded_statements(file_hash) 
    WHERE file_hash IS NOT NULL;
    
    COMMENT ON COLUMN public.uploaded_statements.file_hash IS 
    'SHA256 hash של הקובץ לזיהוי כפילויות';
  END IF;
  
  -- duplicate_of
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'uploaded_statements' AND column_name = 'duplicate_of'
  ) THEN
    ALTER TABLE public.uploaded_statements 
    ADD COLUMN duplicate_of UUID REFERENCES public.uploaded_statements(id);
    
    ALTER TABLE public.uploaded_statements 
    ADD COLUMN is_duplicate BOOLEAN DEFAULT FALSE;
    
    COMMENT ON COLUMN public.uploaded_statements.duplicate_of IS 
    'אם זה קובץ כפול, הפנייה למסמך המקורי';
  END IF;
  
  -- retry fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'uploaded_statements' AND column_name = 'last_error'
  ) THEN
    ALTER TABLE public.uploaded_statements 
    ADD COLUMN last_error TEXT;
    
    ALTER TABLE public.uploaded_statements 
    ADD COLUMN next_retry_at TIMESTAMPTZ;
    
    COMMENT ON COLUMN public.uploaded_statements.last_error IS 
    'שגיאה אחרונה בעיבוד';
    COMMENT ON COLUMN public.uploaded_statements.next_retry_at IS 
    'מתי לנסות שוב אוטומטית';
  END IF;
  
END $$;

-- ============================================================================
-- SECTION 7: user_category_rules - למידה מתיקונים
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_category_rules' AND column_name = 'learn_count'
  ) THEN
    ALTER TABLE public.user_category_rules 
    ADD COLUMN learn_count INTEGER DEFAULT 1;
    
    ALTER TABLE public.user_category_rules 
    ADD COLUMN auto_approved BOOLEAN DEFAULT FALSE;
    
    COMMENT ON COLUMN public.user_category_rules.learn_count IS 
    'כמה פעמים המשתמש תיקן כך - אחרי 3 נציע אוטומציה';
    COMMENT ON COLUMN public.user_category_rules.auto_approved IS 
    'האם המשתמש אישר שימוש אוטומטי בכלל הזה';
  END IF;
END $$;

-- ============================================================================
-- SECTION 8: alerts_rules - שדות נוספים
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts_rules' AND column_name = 'alert_channel'
  ) THEN
    ALTER TABLE public.alerts_rules 
    ADD COLUMN alert_channel TEXT DEFAULT 'whatsapp' 
    CHECK (alert_channel IN ('whatsapp', 'email', 'both', 'none'));
    
    ALTER TABLE public.alerts_rules 
    ADD COLUMN last_triggered_at TIMESTAMPTZ;
    
    ALTER TABLE public.alerts_rules 
    ADD COLUMN trigger_count INTEGER DEFAULT 0;
    
    COMMENT ON COLUMN public.alerts_rules.alert_channel IS 
    'ערוץ התראה: whatsapp, email, both, none';
  END IF;
END $$;

-- ============================================================================
-- SECTION 9: audit_logs - שדות נוספים
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE public.audit_logs 
    ADD COLUMN entity_type TEXT;
    
    ALTER TABLE public.audit_logs 
    ADD COLUMN entity_id UUID;
    
    ALTER TABLE public.audit_logs 
    ADD COLUMN before_value JSONB;
    
    ALTER TABLE public.audit_logs 
    ADD COLUMN after_value JSONB;
    
    CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
    
    COMMENT ON COLUMN public.audit_logs.entity_type IS 
    'סוג ישות: transaction, loan, insurance, etc';
  END IF;
END $$;

-- ============================================================================
-- SECTION 10: Materialized Views for Performance
-- ============================================================================

-- Monthly snapshots
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_snapshots AS
SELECT 
  user_id,
  date_trunc('month', date)::date as month,
  SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as total_income,
  SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as total_expenses,
  COUNT(*) as transaction_count,
  COUNT(CASE WHEN status='proposed' THEN 1 END) as pending_count
FROM transactions
WHERE status IN ('confirmed', 'proposed')
GROUP BY user_id, date_trunc('month', date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_snapshots_unique 
ON monthly_snapshots(user_id, month);

COMMENT ON MATERIALIZED VIEW monthly_snapshots IS 
'סיכום חודשי של תנועות - מתעדכן יומית';

-- User current state
CREATE MATERIALIZED VIEW IF NOT EXISTS user_current_state AS
SELECT 
  u.id as user_id,
  u.name,
  u.email,
  (SELECT current_balance FROM bank_accounts WHERE user_id=u.id AND is_current=TRUE LIMIT 1) as bank_balance,
  (SELECT SUM(current_balance) FROM pension_insurance WHERE user_id=u.id) as pension_balance,
  (SELECT SUM(current_balance) FROM savings_accounts WHERE user_id=u.id AND active=TRUE) as savings_balance,
  (SELECT SUM(current_balance) FROM loans WHERE user_id=u.id AND active=TRUE) as total_debt,
  (SELECT COUNT(*) FROM transactions WHERE user_id=u.id AND status='proposed') as pending_transactions,
  (SELECT COUNT(*) FROM reconciliation_issues WHERE user_id=u.id AND status='pending') as pending_issues,
  NOW() as last_updated
FROM users u;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_current_state_unique 
ON user_current_state(user_id);

COMMENT ON MATERIALIZED VIEW user_current_state IS 
'מצב נוכחי של כל משתמש - מתעדכן כל שעה';

-- ============================================================================
-- SECTION 11: Helper Functions
-- ============================================================================

-- Function: Calculate reconciliation difference percentage
CREATE OR REPLACE FUNCTION calculate_reconciliation_difference(
  expected DECIMAL,
  actual DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  IF expected = 0 THEN
    RETURN 100.0;
  END IF;
  RETURN ABS((actual - expected) / expected * 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Get user's recurring patterns that are overdue
CREATE OR REPLACE FUNCTION get_overdue_recurring_patterns(user_uuid UUID)
RETURNS TABLE (
  pattern_id UUID,
  vendor TEXT,
  expected_amount DECIMAL,
  next_expected DATE,
  days_overdue INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    recurring_patterns.vendor,
    expected_amount,
    recurring_patterns.next_expected,
    (CURRENT_DATE - recurring_patterns.next_expected)::INTEGER as days_overdue
  FROM recurring_patterns
  WHERE user_id = user_uuid
    AND status = 'active'
    AND next_expected < CURRENT_DATE
    AND (CURRENT_DATE - next_expected) > day_tolerance;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- SECTION 12: Triggers
-- ============================================================================

-- Trigger: Update updated_at on all new tables
CREATE TRIGGER bank_accounts_updated_at 
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payslips_updated_at 
BEFORE UPDATE ON public.payslips
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER recurring_patterns_updated_at 
BEFORE UPDATE ON public.recurring_patterns
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER reconciliation_issues_updated_at 
BEFORE UPDATE ON public.reconciliation_issues
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

