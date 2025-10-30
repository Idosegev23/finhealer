-- ============================================================================
-- Migration: Transaction Linking System
-- תאריך: 2025-01-31
-- תיאור: מערכת קישור בין תנועות בנק לפירוט (אשראי/הלוואות)
--         למניעת כפילויות והצגת פירוט מלא
-- ============================================================================

-- ============================================================================
-- SECTION 1: Create transaction_details table
-- ============================================================================

-- טבלה: transaction_details - פירוט תנועות (sub-transactions)
-- כאשר סורקים דוח אשראי אחרי דוח בנק, הפירוט נשמר כאן
CREATE TABLE IF NOT EXISTS public.transaction_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transaction info (same structure as main transaction)
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  vendor TEXT,
  date DATE NOT NULL,
  notes TEXT,
  
  -- Categorization
  category TEXT,
  expense_category TEXT,
  expense_type TEXT CHECK (expense_type IN ('fixed', 'variable', 'special')),
  payment_method TEXT,
  
  -- OCR metadata
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_transaction_details_parent ON public.transaction_details(parent_transaction_id);
CREATE INDEX idx_transaction_details_user ON public.transaction_details(user_id);
CREATE INDEX idx_transaction_details_date ON public.transaction_details(date);

-- RLS Policy
ALTER TABLE public.transaction_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own transaction details" 
ON public.transaction_details
USING (auth.uid() = user_id);

-- Comment
COMMENT ON TABLE public.transaction_details IS 
'פירוט תנועות - כאשר יש דוח מפורט (אשראי) שמתאים לתנועה כללית (בנק), הפירוט נשמר כאן';

-- ============================================================================
-- SECTION 2: Add linking fields to transactions table
-- ============================================================================

-- הוסף שדות לקישור ופירוט
DO $$ 
BEGIN
  -- has_details: האם יש פירוט לתנועה זו
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'has_details'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN has_details BOOLEAN DEFAULT FALSE;
    
    COMMENT ON COLUMN public.transactions.has_details IS 
    'האם יש פירוט (sub-transactions) לתנועה זו';
  END IF;
  
  -- is_summary: האם זו תנועה סיכומית שמחכה לפירוט
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'is_summary'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN is_summary BOOLEAN DEFAULT FALSE;
    
    COMMENT ON COLUMN public.transactions.is_summary IS 
    'תנועה סיכומית מדוח בנק שמחכה לפירוט מדוח אשראי';
  END IF;
  
  -- linked_document_id: קישור למסמך שממנו הגיע הפירוט
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'linked_document_id'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN linked_document_id UUID REFERENCES public.uploaded_statements(id);
    
    CREATE INDEX idx_transactions_linked_document ON public.transactions(linked_document_id);
    
    COMMENT ON COLUMN public.transactions.linked_document_id IS 
    'קישור למסמך המקור של הפירוט (למשל דוח אשראי שפירט את החיוב)';
  END IF;
  
  -- linked_loan_id: קישור להלוואה (אם זה תשלום הלוואה)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'linked_loan_id'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN linked_loan_id UUID REFERENCES public.loans(id);
    
    CREATE INDEX idx_transactions_linked_loan ON public.transactions(linked_loan_id);
    
    COMMENT ON COLUMN public.transactions.linked_loan_id IS 
    'קישור להלוואה אם זו תנועת תשלום הלוואה';
  END IF;
  
  -- matching_confidence: רמת ביטחון בהתאמה אוטומטית
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'matching_confidence'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN matching_confidence DECIMAL(3,2) CHECK (matching_confidence >= 0 AND matching_confidence <= 1);
    
    COMMENT ON COLUMN public.transactions.matching_confidence IS 
    'רמת ביטחון בהתאמה אוטומטית בין תנועת בנק לפירוט אשראי (0-1)';
  END IF;
  
  -- potential_matches: התאמות פוטנציאליות שהמשתמש יכול לבחור מהן
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'potential_matches'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN potential_matches JSONB;
    
    COMMENT ON COLUMN public.transactions.potential_matches IS 
    'רשימת התאמות פוטנציאליות [{"id": "xxx", "confidence": 0.95, "reason": "..."}, ...]';
  END IF;
  
END $$;

-- ============================================================================
-- SECTION 3: Helper function to calculate total of details
-- ============================================================================

-- פונקציה: חישוב סה"כ פירוט תנועה
CREATE OR REPLACE FUNCTION get_transaction_details_total(transaction_id UUID)
RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM transaction_details
  WHERE parent_transaction_id = transaction_id;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_transaction_details_total IS 
'מחשב את סכום כל הפירוטים של תנועה מסוימת';

-- ============================================================================
-- SECTION 4: Trigger for updated_at
-- ============================================================================

-- Apply updated_at trigger to transaction_details
CREATE TRIGGER transaction_details_updated_at 
BEFORE UPDATE ON public.transaction_details
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SECTION 5: View for transactions with details summary
-- ============================================================================

-- View: סיכום תנועות כולל פירוט
CREATE OR REPLACE VIEW transactions_with_details_summary AS
SELECT 
  t.*,
  CASE 
    WHEN t.has_details THEN (
      SELECT COUNT(*)::INTEGER 
      FROM transaction_details td 
      WHERE td.parent_transaction_id = t.id
    )
    ELSE 0
  END as details_count,
  CASE 
    WHEN t.has_details THEN (
      SELECT SUM(td.amount)
      FROM transaction_details td 
      WHERE td.parent_transaction_id = t.id
    )
    ELSE t.amount
  END as total_amount_with_details
FROM transactions t;

COMMENT ON VIEW transactions_with_details_summary IS 
'תצוגה של תנועות כולל סיכום פירוט - מספר פריטים וסכום מפורט';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

