-- Add progress tracking fields to uploaded_statements
ALTER TABLE public.uploaded_statements
ADD COLUMN IF NOT EXISTS processing_stage text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS progress_percent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Add index for retry processing
CREATE INDEX IF NOT EXISTS idx_uploaded_statements_retry 
ON public.uploaded_statements(status, next_retry_at) 
WHERE status = 'pending' AND next_retry_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.uploaded_statements.processing_stage IS 'Current stage: pending, downloading, analyzing, saving, completed, error';
COMMENT ON COLUMN public.uploaded_statements.progress_percent IS 'Progress percentage (0-100)';
COMMENT ON COLUMN public.uploaded_statements.retry_count IS 'Number of retry attempts';
COMMENT ON COLUMN public.uploaded_statements.next_retry_at IS 'When to retry if status=pending';

