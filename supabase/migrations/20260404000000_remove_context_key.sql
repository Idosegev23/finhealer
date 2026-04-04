-- Remove a key from classification_context atomically
-- Uses JSONB - operator (no race condition)
CREATE OR REPLACE FUNCTION remove_classification_context_key(
  p_user_id UUID,
  p_key TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET classification_context =
    CASE
      WHEN classification_context - p_key = '{}'::jsonb THEN NULL
      ELSE classification_context - p_key
    END
  WHERE id = p_user_id
    AND classification_context IS NOT NULL
    AND classification_context ? p_key;
END;
$$;
