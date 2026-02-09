-- Migration: מערכת איחוד הלוואות
-- תאריך: 22 ינואר 2026
-- מטרה: טבלה למעקב אחר בקשות איחוד הלוואות ושליחת לידים לגדי

CREATE TABLE IF NOT EXISTS loan_consolidation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Loans in request
  loan_ids UUID[] NOT NULL,
  loans_count INTEGER NOT NULL,
  total_monthly_payment NUMERIC NOT NULL,
  total_balance NUMERIC NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending_documents' 
    CHECK (status IN (
      'pending_documents',
      'documents_received',
      'sent_to_advisor',
      'advisor_reviewing',
      'offer_sent',
      'accepted',
      'rejected',
      'cancelled'
    )),
  
  -- Documents
  documents_received INTEGER DEFAULT 0,
  documents_needed INTEGER NOT NULL,
  loan_documents JSONB DEFAULT '[]',
  
  -- Lead info for Gadi
  lead_sent_at TIMESTAMPTZ,
  lead_response TEXT,
  advisor_notes TEXT,
  
  -- Offer (if accepted)
  proposed_rate NUMERIC,
  proposed_monthly_payment NUMERIC,
  proposed_total_amount NUMERIC,
  estimated_savings NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consolidation_requests_user ON loan_consolidation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_requests_status ON loan_consolidation_requests(status);
CREATE INDEX IF NOT EXISTS idx_consolidation_requests_created_at ON loan_consolidation_requests(created_at DESC);

-- RLS
ALTER TABLE loan_consolidation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consolidation requests"
  ON loan_consolidation_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consolidation requests"
  ON loan_consolidation_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consolidation requests"
  ON loan_consolidation_requests FOR UPDATE
  USING (auth.uid() = user_id);

-- Admin policy
CREATE POLICY "Admins can view all consolidation requests"
  ON loan_consolidation_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update all consolidation requests"
  ON loan_consolidation_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_consolidation_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consolidation_request_updated_at
  BEFORE UPDATE ON loan_consolidation_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_consolidation_request_updated_at();

-- Comments
COMMENT ON TABLE loan_consolidation_requests IS 'בקשות לאיחוד הלוואות - מעקב מלא מזיהוי ועד שליחת ליד לגדי';
COMMENT ON COLUMN loan_consolidation_requests.loan_ids IS 'מערך של IDs של הלוואות בבקשה';
COMMENT ON COLUMN loan_consolidation_requests.status IS 'סטטוס: pending_documents, documents_received, sent_to_advisor, offer_sent, accepted, rejected, cancelled';
COMMENT ON COLUMN loan_consolidation_requests.loan_documents IS 'מסמכי הלוואות שהתקבלו: [{"filename": "...", "url": "...", "loan_id": "...", "uploaded_at": "..."}]';
COMMENT ON COLUMN loan_consolidation_requests.documents_received IS 'מספר מסמכים שהתקבלו מתוך הנדרשים';
COMMENT ON COLUMN loan_consolidation_requests.documents_needed IS 'מספר מסמכים נדרשים (לפי מספר ההלוואות)';
COMMENT ON COLUMN loan_consolidation_requests.lead_sent_at IS 'מתי נשלח הליד לגדי';
COMMENT ON COLUMN loan_consolidation_requests.advisor_notes IS 'הערות של גדי על הבקשה';
COMMENT ON COLUMN loan_consolidation_requests.proposed_rate IS 'ריבית מוצעת באיחוד';
COMMENT ON COLUMN loan_consolidation_requests.estimated_savings IS 'חיסכון חודשי משוער';
