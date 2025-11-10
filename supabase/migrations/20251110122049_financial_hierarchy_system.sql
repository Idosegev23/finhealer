-- ============================================================================
-- Migration: Financial Documents Hierarchy System
-- תאריך: 2025-11-10
-- תיאור: מערכת היררכיה מלאה של מסמכים פיננסיים עם לוגיקת matching מורכבת
--         דוח בנק = מקור אמתי, כל המסמכים האחרים = פירוט
-- ============================================================================

-- ============================================================================
-- SECTION 1: Update transactions table
-- ============================================================================

DO $$ 
BEGIN
  -- is_source_transaction: האם זו תנועה מהמקור האמתי (דוח בנק)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'is_source_transaction'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN is_source_transaction BOOLEAN DEFAULT FALSE;
    
    CREATE INDEX idx_transactions_is_source ON public.transactions(is_source_transaction) WHERE is_source_transaction = TRUE;
    
    COMMENT ON COLUMN public.transactions.is_source_transaction IS 
    'האם זו תנועה מהמקור האמתי (דוח בנק) - רק תנועות מדוח בנק הן source';
  END IF;
  
  -- statement_month: חודש הדוח (למשל: 2024-09-01)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'statement_month'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN statement_month DATE;
    
    CREATE INDEX idx_transactions_statement_month ON public.transactions(user_id, statement_month);
    
    COMMENT ON COLUMN public.transactions.statement_month IS 
    'חודש הדוח - דוח בנק של חודש X מציג תנועות של חודש X';
  END IF;
  
  -- needs_details: האם צריך פירוט
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'needs_details'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN needs_details BOOLEAN DEFAULT FALSE;
    
    CREATE INDEX idx_transactions_needs_details ON public.transactions(needs_details) WHERE needs_details = TRUE;
    
    COMMENT ON COLUMN public.transactions.needs_details IS 
    'האם תנועה זו צריכה פירוט (למשל תנועת תשלום אשראי שמחכה לדוח אשראי)';
  END IF;
  
  -- card_number_last4: 4 ספרות אחרונות של כרטיס
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'card_number_last4'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN card_number_last4 TEXT;
    
    CREATE INDEX idx_transactions_card_last4 ON public.transactions(card_number_last4);
    
    COMMENT ON COLUMN public.transactions.card_number_last4 IS 
    '4 ספרות אחרונות של כרטיס אשראי - לעזר בהתאמה בין תנועות לפירוט';
  END IF;
  
  -- is_immediate_charge: הורדה מיידית
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'is_immediate_charge'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN is_immediate_charge BOOLEAN DEFAULT FALSE;
    
    COMMENT ON COLUMN public.transactions.is_immediate_charge IS 
    'האם זו הורדה מיידית (לא חיוב חודשי)';
  END IF;
  
  -- is_cash_expense: הוצאה במזומן (לא נראית בבנק)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'is_cash_expense'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN is_cash_expense BOOLEAN DEFAULT FALSE;
    
    CREATE INDEX idx_transactions_cash_expense ON public.transactions(is_cash_expense) WHERE is_cash_expense = TRUE;
    
    COMMENT ON COLUMN public.transactions.is_cash_expense IS 
    'הוצאה במזומן - לא נראית בדוח בנק אבל חשובה לאומדן הוצאות';
  END IF;
  
  -- replaced_by_transaction_id: אם זו תנועה שהוחלפה
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'replaced_by_transaction_id'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN replaced_by_transaction_id UUID REFERENCES public.transactions(id);
    
    CREATE INDEX idx_transactions_replaced_by ON public.transactions(replaced_by_transaction_id);
    
    COMMENT ON COLUMN public.transactions.replaced_by_transaction_id IS 
    'אם זו תנועה שהוחלפה על ידי דוח בנק חדש';
  END IF;
  
  -- matching_status: סטטוס התאמה
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'matching_status'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN matching_status TEXT DEFAULT 'not_matched' 
    CHECK (matching_status IN ('not_matched', 'matched', 'pending_manual', 'pending_matching'));
    
    CREATE INDEX idx_transactions_matching_status ON public.transactions(matching_status);
    
    COMMENT ON COLUMN public.transactions.matching_status IS 
    'סטטוס התאמה: not_matched, matched, pending_manual, pending_matching';
  END IF;
  
END $$;

-- ============================================================================
-- SECTION 2: Update transaction_details table
-- ============================================================================

DO $$ 
BEGIN
  -- receipt_id: קישור לקבלה
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transaction_details' AND column_name = 'receipt_id'
  ) THEN
    ALTER TABLE public.transaction_details 
    ADD COLUMN receipt_id UUID REFERENCES public.receipts(id);
    
    CREATE INDEX idx_transaction_details_receipt ON public.transaction_details(receipt_id);
    
    COMMENT ON COLUMN public.transaction_details.receipt_id IS 
    'קישור לקבלה אם יש קבלה שמתאימה לפירוט זה';
  END IF;
  
  -- credit_statement_id: דוח אשראי שיצר את הפירוט
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transaction_details' AND column_name = 'credit_statement_id'
  ) THEN
    ALTER TABLE public.transaction_details 
    ADD COLUMN credit_statement_id UUID REFERENCES public.uploaded_statements(id);
    
    CREATE INDEX idx_transaction_details_credit_statement ON public.transaction_details(credit_statement_id);
    
    COMMENT ON COLUMN public.transaction_details.credit_statement_id IS 
    'דוח אשראי שיצר את הפירוט הזה';
  END IF;
  
  -- card_number_last4: מספר כרטיס מהדוח אשראי
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transaction_details' AND column_name = 'card_number_last4'
  ) THEN
    ALTER TABLE public.transaction_details 
    ADD COLUMN card_number_last4 TEXT;
    
    COMMENT ON COLUMN public.transaction_details.card_number_last4 IS 
    '4 ספרות אחרונות של כרטיס מהדוח אשראי - לעזר בהתאמה';
  END IF;
  
  -- detail_period_month: חודש הפירוט
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transaction_details' AND column_name = 'detail_period_month'
  ) THEN
    ALTER TABLE public.transaction_details 
    ADD COLUMN detail_period_month DATE;
    
    CREATE INDEX idx_transaction_details_period_month ON public.transaction_details(detail_period_month);
    
    COMMENT ON COLUMN public.transaction_details.detail_period_month IS 
    'חודש הפירוט - דוח אשראי של חודש X-1 מפרט הוצאות של חודש X-1';
  END IF;
  
  -- detailed_category: קטגוריה מפורטת
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transaction_details' AND column_name = 'detailed_category'
  ) THEN
    ALTER TABLE public.transaction_details 
    ADD COLUMN detailed_category TEXT;
    
    COMMENT ON COLUMN public.transaction_details.detailed_category IS 
    'קטגוריה מפורטת יותר מהפירוט';
  END IF;
  
  -- sub_category: תת-קטגוריה
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transaction_details' AND column_name = 'sub_category'
  ) THEN
    ALTER TABLE public.transaction_details 
    ADD COLUMN sub_category TEXT;
    
    COMMENT ON COLUMN public.transaction_details.sub_category IS 
    'תת-קטגוריה מפורטת';
  END IF;
  
  -- tags: תגיות
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transaction_details' AND column_name = 'tags'
  ) THEN
    ALTER TABLE public.transaction_details 
    ADD COLUMN tags TEXT[];
    
    COMMENT ON COLUMN public.transaction_details.tags IS 
    'תגיות לקטגוריזציה מפורטת';
  END IF;
  
  -- detailed_notes: הערות מפורטות
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transaction_details' AND column_name = 'detailed_notes'
  ) THEN
    ALTER TABLE public.transaction_details 
    ADD COLUMN detailed_notes TEXT;
    
    COMMENT ON COLUMN public.transaction_details.detailed_notes IS 
    'הערות מפורטות על הפירוט';
  END IF;
  
  -- item_count: מספר פריטים
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transaction_details' AND column_name = 'item_count'
  ) THEN
    ALTER TABLE public.transaction_details 
    ADD COLUMN item_count INTEGER;
    
    COMMENT ON COLUMN public.transaction_details.item_count IS 
    'מספר פריטים בפירוט זה';
  END IF;
  
  -- items: רשימת פריטים מפורטת
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transaction_details' AND column_name = 'items'
  ) THEN
    ALTER TABLE public.transaction_details 
    ADD COLUMN items JSONB;
    
    CREATE INDEX idx_transaction_details_items ON public.transaction_details USING GIN (items);
    
    COMMENT ON COLUMN public.transaction_details.items IS 
    'רשימת פריטים מפורטת בפורמט JSON';
  END IF;
  
END $$;

-- ============================================================================
-- SECTION 3: Update receipts table
-- ============================================================================

DO $$ 
BEGIN
  -- transaction_detail_id: קישור לפירוט אשראי
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts' AND column_name = 'transaction_detail_id'
  ) THEN
    ALTER TABLE public.receipts 
    ADD COLUMN transaction_detail_id UUID REFERENCES public.transaction_details(id);
    
    CREATE INDEX idx_receipts_transaction_detail ON public.receipts(transaction_detail_id);
    
    COMMENT ON COLUMN public.receipts.transaction_detail_id IS 
    'קישור לפירוט אשראי אם הקבלה מתאימה לפירוט';
  END IF;
  
  -- payment_method: אמצעי תשלום
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE public.receipts 
    ADD COLUMN payment_method TEXT CHECK (payment_method IN ('cash', 'credit', 'debit', 'digital_wallet', 'bank_transfer', 'check', 'other'));
    
    COMMENT ON COLUMN public.receipts.payment_method IS 
    'אמצעי תשלום: cash, credit, debit וכו';
  END IF;
  
  -- is_cash_expense: הוצאה במזומן
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts' AND column_name = 'is_cash_expense'
  ) THEN
    ALTER TABLE public.receipts 
    ADD COLUMN is_cash_expense BOOLEAN DEFAULT FALSE;
    
    CREATE INDEX idx_receipts_cash_expense ON public.receipts(is_cash_expense) WHERE is_cash_expense = TRUE;
    
    COMMENT ON COLUMN public.receipts.is_cash_expense IS 
    'הוצאה במזומן - לא נראית בדוח בנק אבל חשובה לאומדן הוצאות';
  END IF;
  
  -- awaiting_bank_statement: ממתין לדוח בנק
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts' AND column_name = 'awaiting_bank_statement'
  ) THEN
    ALTER TABLE public.receipts 
    ADD COLUMN awaiting_bank_statement BOOLEAN DEFAULT FALSE;
    
    COMMENT ON COLUMN public.receipts.awaiting_bank_statement IS 
    'אם הקבלה ממתינה לדוח בנק (אם אין תנועה בנק עדיין)';
  END IF;
  
END $$;

-- ============================================================================
-- SECTION 4: Update uploaded_statements table
-- ============================================================================

DO $$ 
BEGIN
  -- is_source_document: האם זה מסמך מקור
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'uploaded_statements' AND column_name = 'is_source_document'
  ) THEN
    ALTER TABLE public.uploaded_statements 
    ADD COLUMN is_source_document BOOLEAN DEFAULT FALSE;
    
    CREATE INDEX idx_uploaded_statements_is_source ON public.uploaded_statements(is_source_document) WHERE is_source_document = TRUE;
    
    COMMENT ON COLUMN public.uploaded_statements.is_source_document IS 
    'האם זה מסמך מקור (רק דוח בנק) - כל המסמכים האחרים הם פירוט';
  END IF;
  
  -- statement_month: חודש המסמך (חובה!)
  -- שינוי מ-TEXT ל-DATE אם צריך
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'uploaded_statements' AND column_name = 'statement_month' AND data_type = 'text'
  ) THEN
    -- נמיר את ה-TEXT ל-DATE
    ALTER TABLE public.uploaded_statements 
    ALTER COLUMN statement_month TYPE DATE USING 
      CASE 
        WHEN statement_month ~ '^\d{4}-\d{2}-\d{2}' THEN statement_month::DATE
        WHEN statement_month ~ '^\d{4}-\d{2}' THEN (statement_month || '-01')::DATE
        ELSE NULL
      END;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'uploaded_statements' AND column_name = 'statement_month'
  ) THEN
    ALTER TABLE public.uploaded_statements 
    ADD COLUMN statement_month DATE;
  END IF;
  
  -- הוספת NOT NULL constraint רק למסמכים חדשים (לא נכפה על קיימים)
  -- נעשה זאת ב-migration נפרד אחרי שכל המסמכים הקיימים יעודכנו
  
  CREATE INDEX IF NOT EXISTS idx_uploaded_statements_statement_month ON public.uploaded_statements(user_id, statement_month);
  
  COMMENT ON COLUMN public.uploaded_statements.statement_month IS 
  'חודש המסמך - חובה! המשתמש חייב לבחור את החודש בעת העלאה';
  
  -- parent_document_id: קישור למסמך מקור
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'uploaded_statements' AND column_name = 'parent_document_id'
  ) THEN
    ALTER TABLE public.uploaded_statements 
    ADD COLUMN parent_document_id UUID REFERENCES public.uploaded_statements(id);
    
    CREATE INDEX idx_uploaded_statements_parent ON public.uploaded_statements(parent_document_id);
    
    COMMENT ON COLUMN public.uploaded_statements.parent_document_id IS 
    'קישור למסמך מקור (דוח בנק) אם זה מסמך פירוט';
  END IF;
  
  -- replaces_document_id: אם מחליף מסמך ישן
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'uploaded_statements' AND column_name = 'replaces_document_id'
  ) THEN
    ALTER TABLE public.uploaded_statements 
    ADD COLUMN replaces_document_id UUID REFERENCES public.uploaded_statements(id);
    
    CREATE INDEX idx_uploaded_statements_replaces ON public.uploaded_statements(replaces_document_id);
    
    COMMENT ON COLUMN public.uploaded_statements.replaces_document_id IS 
    'אם זה מחליף מסמך ישן (כפילות)';
  END IF;
  
END $$;

-- ============================================================================
-- SECTION 5: Update pension_insurance table
-- ============================================================================

DO $$ 
BEGIN
  -- linked_payslip_id: קישור לתלוש משכורת
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pension_insurance' AND column_name = 'linked_payslip_id'
  ) THEN
    ALTER TABLE public.pension_insurance 
    ADD COLUMN linked_payslip_id UUID REFERENCES public.payslips(id);
    
    CREATE INDEX idx_pension_insurance_linked_payslip ON public.pension_insurance(linked_payslip_id);
    
    COMMENT ON COLUMN public.pension_insurance.linked_payslip_id IS 
    'קישור לתלוש משכורת - תשלומי פנסיה נראים רק בתלוש, לא בדוח בנק';
  END IF;
  
  -- linked_transaction_id: קישור לתנועת הפקדה (אם יש)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pension_insurance' AND column_name = 'linked_transaction_id'
  ) THEN
    ALTER TABLE public.pension_insurance 
    ADD COLUMN linked_transaction_id UUID REFERENCES public.transactions(id);
    
    CREATE INDEX idx_pension_insurance_linked_transaction ON public.pension_insurance(linked_transaction_id);
    
    COMMENT ON COLUMN public.pension_insurance.linked_transaction_id IS 
    'קישור לתנועת הפקדה פנסיה בדוח הבנק (אם יש) - יכול להיות NULL אם אין תנועה בנק';
  END IF;
  
END $$;

-- ============================================================================
-- SECTION 6: Create document_matching_rules table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.document_matching_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Rule configuration
  rule_type TEXT NOT NULL CHECK (rule_type IN ('amount_tolerance', 'date_range', 'vendor_match', 'card_match')),
  rule_config JSONB NOT NULL,
  
  -- Rule metadata
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_matching_rules_user ON public.document_matching_rules(user_id);
CREATE INDEX idx_document_matching_rules_active ON public.document_matching_rules(user_id, is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE public.document_matching_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own matching rules" 
ON public.document_matching_rules
USING (auth.uid() = user_id);

COMMENT ON TABLE public.document_matching_rules IS 
'כללי matching מותאמים אישית למשתמש - למשל: tolerance לסכום, טווח תאריכים וכו';

-- ============================================================================
-- SECTION 7: Create View for financial documents hierarchy
-- ============================================================================

CREATE OR REPLACE VIEW financial_documents_hierarchy AS
SELECT 
  -- Document info
  d.id as document_id,
  d.user_id,
  d.file_name,
  d.file_type,
  d.statement_month,
  d.is_source_document,
  d.parent_document_id,
  
  -- Transactions from source document
  t.id as transaction_id,
  t.type as transaction_type,
  t.amount as transaction_amount,
  t.statement_month as transaction_statement_month,
  t.is_source_transaction,
  t.card_number_last4,
  t.is_immediate_charge,
  
  -- Transaction details (from credit statements)
  td.id as detail_id,
  td.amount as detail_amount,
  td.vendor as detail_vendor,
  td.detail_period_month,
  td.card_number_last4 as detail_card_last4,
  
  -- Receipts
  r.id as receipt_id,
  r.amount as receipt_amount,
  r.payment_method,
  r.is_cash_expense,
  
  -- Hierarchy level
  CASE 
    WHEN d.is_source_document THEN 1
    WHEN d.parent_document_id IS NOT NULL THEN 2
    ELSE 2
  END as hierarchy_level
  
FROM uploaded_statements d
LEFT JOIN transactions t ON t.document_id = d.id OR t.linked_document_id = d.id
LEFT JOIN transaction_details td ON td.parent_transaction_id = t.id OR td.credit_statement_id = d.id
LEFT JOIN receipts r ON r.transaction_detail_id = td.id OR r.transaction_id = t.id
WHERE d.user_id = auth.uid();

COMMENT ON VIEW financial_documents_hierarchy IS 
'תצוגה היררכית של כל המסמכים הפיננסיים עם הקשרים ביניהם';

-- ============================================================================
-- SECTION 8: Helper Functions
-- ============================================================================

-- Function: Calculate matching confidence score
CREATE OR REPLACE FUNCTION calculate_matching_confidence(
  amount_match DECIMAL,
  date_match DECIMAL,
  vendor_match DECIMAL,
  card_match DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  -- Weighted average: amount 40%, date 30%, vendor 20%, card 10%
  RETURN (
    COALESCE(amount_match, 0) * 0.4 +
    COALESCE(date_match, 0) * 0.3 +
    COALESCE(vendor_match, 0) * 0.2 +
    COALESCE(card_match, 0) * 0.1
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_matching_confidence IS 
'מחשב confidence score להתאמה לפי משקלים: סכום 40%, תאריך 30%, vendor 20%, כרטיס 10%';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

