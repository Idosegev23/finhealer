-- Migration: מערכת התקדמות אוטומטית ביעדים
-- תאריך: 23 ינואר 2026
-- מטרה: קישור תנועות ליעדים + עדכון אוטומטי של current_amount

-- ============================================================================
-- 1. הוסף שדה goal_id לטבלת transactions
-- ============================================================================

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_goal_id ON transactions(goal_id);

COMMENT ON COLUMN transactions.goal_id IS 'קישור ליעד - להפקדות המיועדות ליעד מסוים';

-- ============================================================================
-- 2. Trigger לעדכון אוטומטי של current_amount ביעד
-- ============================================================================

CREATE OR REPLACE FUNCTION update_goal_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_old_amount NUMERIC := 0;
  v_new_amount NUMERIC := 0;
BEGIN
  -- אם זה INSERT או UPDATE שמוסיף goal_id חדש
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.goal_id IS DISTINCT FROM NEW.goal_id)) THEN
    
    -- רק אם goal_id מוגדר, זו הכנסה, והסטטוס confirmed
    IF NEW.goal_id IS NOT NULL 
       AND NEW.type = 'income' 
       AND NEW.status = 'confirmed' THEN
      
      v_new_amount := NEW.amount;
      
      -- הוסף ליעד
      UPDATE goals 
      SET 
        current_amount = current_amount + v_new_amount,
        updated_at = NOW()
      WHERE id = NEW.goal_id;
      
      RAISE NOTICE 'Added % to goal %', v_new_amount, NEW.goal_id;
    END IF;
    
    -- אם goal_id השתנה מיעד אחד לאחר, נצריך לחסר מהישן
    IF TG_OP = 'UPDATE' AND OLD.goal_id IS NOT NULL AND NEW.goal_id IS DISTINCT FROM OLD.goal_id THEN
      v_old_amount := OLD.amount;
      
      UPDATE goals 
      SET 
        current_amount = current_amount - v_old_amount,
        updated_at = NOW()
      WHERE id = OLD.goal_id;
      
      RAISE NOTICE 'Removed % from old goal %', v_old_amount, OLD.goal_id;
    END IF;
    
  END IF;
  
  -- אם זה UPDATE של amount או status
  IF TG_OP = 'UPDATE' AND NEW.goal_id IS NOT NULL THEN
    
    -- אם הסכום השתנה
    IF OLD.amount IS DISTINCT FROM NEW.amount AND NEW.status = 'confirmed' AND NEW.type = 'income' THEN
      v_old_amount := OLD.amount;
      v_new_amount := NEW.amount;
      
      UPDATE goals 
      SET 
        current_amount = current_amount - v_old_amount + v_new_amount,
        updated_at = NOW()
      WHERE id = NEW.goal_id;
      
      RAISE NOTICE 'Updated goal %: % -> %', NEW.goal_id, v_old_amount, v_new_amount;
    END IF;
    
    -- אם הסטטוס השתנה ל-confirmed
    IF OLD.status != 'confirmed' AND NEW.status = 'confirmed' AND NEW.type = 'income' THEN
      v_new_amount := NEW.amount;
      
      UPDATE goals 
      SET 
        current_amount = current_amount + v_new_amount,
        updated_at = NOW()
      WHERE id = NEW.goal_id;
      
      RAISE NOTICE 'Confirmed transaction: Added % to goal %', v_new_amount, NEW.goal_id;
    END IF;
    
    -- אם הסטטוס השתנה מ-confirmed לאחר
    IF OLD.status = 'confirmed' AND NEW.status != 'confirmed' AND OLD.type = 'income' THEN
      v_old_amount := OLD.amount;
      
      UPDATE goals 
      SET 
        current_amount = current_amount - v_old_amount,
        updated_at = NOW()
      WHERE id = NEW.goal_id;
      
      RAISE NOTICE 'Unconfirmed transaction: Removed % from goal %', v_old_amount, NEW.goal_id;
    END IF;
    
  END IF;
  
  -- אם זה DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.goal_id IS NOT NULL AND OLD.status = 'confirmed' AND OLD.type = 'income' THEN
      v_old_amount := OLD.amount;
      
      UPDATE goals 
      SET 
        current_amount = current_amount - v_old_amount,
        updated_at = NOW()
      WHERE id = OLD.goal_id;
      
      RAISE NOTICE 'Deleted transaction: Removed % from goal %', v_old_amount, OLD.goal_id;
    END IF;
    
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_transaction_goal_link ON transactions;

-- Create new trigger
CREATE TRIGGER on_transaction_goal_link
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_progress();

-- ============================================================================
-- 3. הוסף goal_id לטבלת savings_accounts
-- ============================================================================

ALTER TABLE savings_accounts 
ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_savings_accounts_goal_id ON savings_accounts(goal_id);

COMMENT ON COLUMN savings_accounts.goal_id IS 'קישור ליעד המקושר לחשבון חיסכון זה';

-- ============================================================================
-- 4. View לעדכוני יעדים אחרונים
-- ============================================================================

CREATE OR REPLACE VIEW goal_progress_log AS
SELECT 
  g.id as goal_id,
  g.name as goal_name,
  g.current_amount,
  g.target_amount,
  ROUND((g.current_amount * 100.0 / NULLIF(g.target_amount, 0))::numeric, 1) as progress_percent,
  t.id as transaction_id,
  t.amount as transaction_amount,
  t.description as transaction_description,
  t.created_at as transaction_date
FROM goals g
LEFT JOIN transactions t ON t.goal_id = g.id AND t.status = 'confirmed'
WHERE g.status = 'active'
ORDER BY g.id, t.created_at DESC;

COMMENT ON VIEW goal_progress_log IS 'לוג של כל העדכונים ליעדים דרך תנועות';

-- ============================================================================
-- 5. פונקציה לקבלת התקדמות יעד
-- ============================================================================

CREATE OR REPLACE FUNCTION get_goal_progress(p_goal_id UUID)
RETURNS TABLE (
  goal_id UUID,
  goal_name TEXT,
  target_amount NUMERIC,
  current_amount NUMERIC,
  progress_percent NUMERIC,
  remaining_amount NUMERIC,
  transactions_count INTEGER,
  last_deposit_date TIMESTAMPTZ,
  last_deposit_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.name,
    g.target_amount,
    g.current_amount,
    ROUND((g.current_amount * 100.0 / NULLIF(g.target_amount, 0))::numeric, 1),
    g.target_amount - g.current_amount,
    COUNT(t.id)::INTEGER,
    MAX(t.created_at),
    (SELECT t2.amount FROM transactions t2 
     WHERE t2.goal_id = g.id AND t2.status = 'confirmed' 
     ORDER BY t2.created_at DESC LIMIT 1)
  FROM goals g
  LEFT JOIN transactions t ON t.goal_id = g.id AND t.status = 'confirmed'
  WHERE g.id = p_goal_id
  GROUP BY g.id, g.name, g.target_amount, g.current_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_goal_progress IS 'מחזיר סיכום מלא של התקדמות יעד';

-- ============================================================================
-- Success message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Goals Progress System migration completed successfully!';
  RAISE NOTICE '   - Added goal_id to transactions table';
  RAISE NOTICE '   - Created update_goal_progress() trigger';
  RAISE NOTICE '   - Added goal_id to savings_accounts table';
  RAISE NOTICE '   - Created goal_progress_log view';
  RAISE NOTICE '   - Created get_goal_progress() function';
END $$;
