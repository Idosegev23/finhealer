-- Migration: Loan Application System
-- Creates tables for loan consolidation application process

-- Table: loan_applications
-- Stores loan application requests from users
CREATE TABLE IF NOT EXISTS loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Application details
  application_type TEXT NOT NULL CHECK (application_type IN ('regular', 'mortgage')),
  employment_type TEXT NOT NULL CHECK (employment_type IN ('employee', 'self_employed', 'business_owner', 'spouse_employee')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'in_review', 'approved', 'rejected')),
  
  -- Progress tracking
  completed_steps JSONB DEFAULT '[]'::jsonb,
  required_documents JSONB DEFAULT '[]'::jsonb,
  
  -- Applicant details (pre-filled from user data)
  applicant_name TEXT,
  applicant_id_number TEXT,
  applicant_phone TEXT,
  applicant_email TEXT,
  
  -- Spouse details (if applicable)
  spouse_name TEXT,
  spouse_id_number TEXT,
  spouse_employment_type TEXT,
  
  -- Business details (if business_owner)
  business_name TEXT,
  business_number TEXT,
  
  -- Loan details
  requested_amount DECIMAL(12, 2),
  requested_term_months INTEGER,
  purpose TEXT,
  
  -- Property details (for mortgage)
  property_address TEXT,
  property_value DECIMAL(12, 2),
  
  -- Notes from Gadi
  gadi_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
);

-- Table: loan_documents
-- Stores uploaded documents for loan applications
CREATE TABLE IF NOT EXISTS loan_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  
  -- Document details
  document_type TEXT NOT NULL,
  document_category TEXT NOT NULL CHECK (document_category IN ('identity', 'income', 'banking', 'property', 'business', 'other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Metadata
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_loan_applications_user_id ON loan_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_status ON loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_loan_documents_application_id ON loan_documents(application_id);

-- RLS Policies
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_documents ENABLE ROW LEVEL SECURITY;

-- Users can only see their own applications
CREATE POLICY "Users can view their own loan applications"
  ON loan_applications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own applications
CREATE POLICY "Users can create their own loan applications"
  ON loan_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own draft applications
CREATE POLICY "Users can update their own draft loan applications"
  ON loan_applications FOR UPDATE
  USING (auth.uid() = user_id AND status = 'draft');

-- Users can delete their own draft applications
CREATE POLICY "Users can delete their own draft loan applications"
  ON loan_applications FOR DELETE
  USING (auth.uid() = user_id AND status = 'draft');

-- Document policies
CREATE POLICY "Users can view documents for their applications"
  ON loan_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loan_applications
      WHERE loan_applications.id = loan_documents.application_id
      AND loan_applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload documents to their applications"
  ON loan_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loan_applications
      WHERE loan_applications.id = loan_documents.application_id
      AND loan_applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own unverified documents"
  ON loan_documents FOR DELETE
  USING (
    verified = FALSE AND
    EXISTS (
      SELECT 1 FROM loan_applications
      WHERE loan_applications.id = loan_documents.application_id
      AND loan_applications.user_id = auth.uid()
    )
  );

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_loan_application_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at
CREATE TRIGGER update_loan_application_timestamp
  BEFORE UPDATE ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_loan_application_timestamp();

-- View: User loan applications with document count
CREATE OR REPLACE VIEW user_loan_applications_summary AS
SELECT 
  la.*,
  COUNT(ld.id) as total_documents,
  COUNT(ld.id) FILTER (WHERE ld.verified = TRUE) as verified_documents
FROM loan_applications la
LEFT JOIN loan_documents ld ON la.id = ld.application_id
GROUP BY la.id;

COMMENT ON TABLE loan_applications IS 'Stores loan consolidation application requests';
COMMENT ON TABLE loan_documents IS 'Stores documents uploaded for loan applications';
COMMENT ON VIEW user_loan_applications_summary IS 'Summary view of loan applications with document counts';

