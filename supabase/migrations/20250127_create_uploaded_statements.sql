-- Migration: Create uploaded_statements table
-- תאריך: 2025-01-27
-- תיאור: טבלה לאחסון דוחות בנק/אשראי שהועלו

CREATE TABLE IF NOT EXISTS public.uploaded_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('bank_statement', 'credit_statement', 'other')),
  file_url TEXT NOT NULL,
  file_size INTEGER,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  transactions_extracted INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_uploaded_statements_user_id ON public.uploaded_statements(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_statements_status ON public.uploaded_statements(status);
CREATE INDEX IF NOT EXISTS idx_uploaded_statements_created_at ON public.uploaded_statements(created_at DESC);

-- RLS Policies
ALTER TABLE public.uploaded_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own statements"
  ON public.uploaded_statements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own statements"
  ON public.uploaded_statements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own statements"
  ON public.uploaded_statements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own statements"
  ON public.uploaded_statements FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger לעדכון updated_at
CREATE OR REPLACE FUNCTION update_uploaded_statements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER uploaded_statements_updated_at
  BEFORE UPDATE ON public.uploaded_statements
  FOR EACH ROW
  EXECUTE FUNCTION update_uploaded_statements_updated_at();

