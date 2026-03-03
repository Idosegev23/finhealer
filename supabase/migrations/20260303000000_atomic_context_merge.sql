-- Atomic JSONB merge for classification_context
-- Prevents race conditions when concurrent messages update different keys
CREATE OR REPLACE FUNCTION merge_classification_context(
  p_user_id UUID,
  p_update JSONB
) RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET classification_context = COALESCE(classification_context, '{}'::jsonb) || p_update
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
