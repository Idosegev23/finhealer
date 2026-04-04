-- Delete all user data safely (handles FK constraints)
-- Called from /api/profile/delete-account
CREATE OR REPLACE FUNCTION delete_user_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Child tables first (FK order)
  DELETE FROM transaction_details WHERE transaction_id IN (
    SELECT id FROM transactions WHERE user_id = p_user_id
  );
  DELETE FROM budget_categories WHERE budget_id IN (
    SELECT id FROM budgets WHERE user_id = p_user_id
  );
  DELETE FROM transactions WHERE user_id = p_user_id;
  DELETE FROM loans WHERE user_id = p_user_id;
  DELETE FROM goals WHERE user_id = p_user_id;
  DELETE FROM budgets WHERE user_id = p_user_id;
  DELETE FROM savings_accounts WHERE user_id = p_user_id;
  DELETE FROM insurance WHERE user_id = p_user_id;
  DELETE FROM pension_insurance WHERE user_id = p_user_id;
  DELETE FROM bank_accounts WHERE user_id = p_user_id;
  DELETE FROM payslips WHERE user_id = p_user_id;
  DELETE FROM uploaded_statements WHERE user_id = p_user_id;
  DELETE FROM wa_messages WHERE user_id = p_user_id;
  DELETE FROM alerts WHERE user_id = p_user_id;
  DELETE FROM subscriptions WHERE user_id = p_user_id;
  DELETE FROM user_data_sections WHERE user_id = p_user_id;
  DELETE FROM user_financial_profile WHERE user_id = p_user_id;
  DELETE FROM user_category_rules WHERE user_id = p_user_id;
  DELETE FROM audit_logs WHERE user_id = p_user_id;
  DELETE FROM reminders WHERE user_id = p_user_id;
  DELETE FROM conversation_context WHERE user_id = p_user_id;
  DELETE FROM loan_consolidation_requests WHERE user_id = p_user_id;
END;
$$;
