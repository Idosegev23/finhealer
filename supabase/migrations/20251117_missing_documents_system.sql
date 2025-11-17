-- Missing Documents Tracking System
-- Created: 2025-11-17
-- Purpose: Track missing financial documents that users need to upload for complete financial picture

-- ============================================================================
-- Table: missing_documents
-- Tracks documents that the system identified as missing after analyzing bank statements
-- ============================================================================

CREATE TABLE IF NOT EXISTS missing_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Document identification
  document_type TEXT NOT NULL CHECK (document_type IN (
    'credit', 'payslip', 'mortgage', 'loan', 'insurance', 
    'pension', 'savings', 'investment'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'skipped')),
  
  -- Period information
  period_start DATE,
  period_end DATE,
  
  -- Additional identifiers
  card_last_4 TEXT, -- For credit card statements
  account_number TEXT, -- For bank/savings accounts
  
  -- Link to related transaction that triggered this request
  related_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  expected_amount DECIMAL(15, 2),
  
  -- Priority for display (higher = more recent/important)
  priority INTEGER DEFAULT 0,
  
  -- Metadata
  description TEXT, -- Human-readable description
  instructions TEXT, -- Instructions for user on what to upload
  
  -- Upload tracking
  uploaded_at TIMESTAMPTZ,
  uploaded_document_id UUID REFERENCES uploaded_statements(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_missing_documents_user_id ON missing_documents(user_id);
CREATE INDEX idx_missing_documents_status ON missing_documents(status);
CREATE INDEX idx_missing_documents_user_status ON missing_documents(user_id, status);
CREATE INDEX idx_missing_documents_priority ON missing_documents(priority DESC);
CREATE INDEX idx_missing_documents_related_tx ON missing_documents(related_transaction_id);

-- RLS Policies
ALTER TABLE missing_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own missing documents"
  ON missing_documents
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own missing documents"
  ON missing_documents
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert missing documents"
  ON missing_documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own missing documents"
  ON missing_documents
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Table: account_snapshots
-- Stores account balance snapshots from bank statements
-- ============================================================================

CREATE TABLE IF NOT EXISTS account_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Account identification
  account_number TEXT,
  account_name TEXT,
  bank_name TEXT,
  
  -- Balance information
  balance DECIMAL(15, 2) NOT NULL,
  snapshot_date DATE NOT NULL,
  
  -- Source tracking
  source_document_id UUID REFERENCES uploaded_statements(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one snapshot per account per date
  UNIQUE(user_id, account_number, snapshot_date)
);

-- Indexes for performance
CREATE INDEX idx_account_snapshots_user_id ON account_snapshots(user_id);
CREATE INDEX idx_account_snapshots_date ON account_snapshots(snapshot_date DESC);
CREATE INDEX idx_account_snapshots_user_date ON account_snapshots(user_id, snapshot_date DESC);
CREATE INDEX idx_account_snapshots_account ON account_snapshots(user_id, account_number, snapshot_date DESC);

-- RLS Policies
ALTER TABLE account_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own account snapshots"
  ON account_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert account snapshots"
  ON account_snapshots
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own account snapshots"
  ON account_snapshots
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own account snapshots"
  ON account_snapshots
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_missing_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for missing_documents
CREATE TRIGGER missing_documents_updated_at
  BEFORE UPDATE ON missing_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_missing_documents_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE missing_documents IS 'Tracks financial documents that users need to upload based on bank statement analysis';
COMMENT ON TABLE account_snapshots IS 'Stores account balance snapshots from uploaded bank statements';

COMMENT ON COLUMN missing_documents.document_type IS 'Type of document: credit, payslip, mortgage, loan, insurance, pension, savings, investment';
COMMENT ON COLUMN missing_documents.status IS 'Status: pending (not uploaded), uploaded, skipped (user chose to skip)';
COMMENT ON COLUMN missing_documents.card_last_4 IS 'Last 4 digits of credit card for credit statement requests';
COMMENT ON COLUMN missing_documents.priority IS 'Priority for display ordering (higher = more recent/important)';
COMMENT ON COLUMN missing_documents.related_transaction_id IS 'Transaction that triggered this document request (e.g., credit card charge)';

COMMENT ON COLUMN account_snapshots.snapshot_date IS 'Date of the balance snapshot (usually end date of bank statement)';
COMMENT ON COLUMN account_snapshots.balance IS 'Account balance at snapshot_date';

