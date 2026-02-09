-- Migration: מערכת תחזית תזרים מזומנים
-- תאריך: 24 ינואר 2026
-- מטרה: View לתחזית תזרים עתידי + פונקציות עזר

-- ============================================================================
-- 1. View: ממוצעים חודשיים (בסיס לתחזית)
-- ============================================================================

CREATE OR REPLACE VIEW monthly_averages AS
SELECT 
  user_id,
  
  -- הכנסות
  COALESCE(AVG(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as avg_income,
  COALESCE(SUM(CASE WHEN type = 'income' AND income_category IN ('salary', 'business_income') THEN amount ELSE 0 END) / NULLIF(COUNT(DISTINCT DATE_TRUNC('month', tx_date)), 0), 0) as avg_fixed_income,
  
  -- הוצאות
  COALESCE(AVG(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as avg_expenses,
  COALESCE(SUM(CASE WHEN type = 'expense' AND category IN ('rent', 'utilities', 'insurance', 'subscriptions') THEN amount ELSE 0 END) / NULLIF(COUNT(DISTINCT DATE_TRUNC('month', tx_date)), 0), 0) as avg_fixed_expenses,
  COALESCE(SUM(CASE WHEN type = 'expense' AND category NOT IN ('rent', 'utilities', 'insurance', 'subscriptions') THEN amount ELSE 0 END) / NULLIF(COUNT(DISTINCT DATE_TRUNC('month', tx_date)), 0), 0) as avg_variable_expenses,
  
  -- מטא-דאטה
  COUNT(DISTINCT DATE_TRUNC('month', tx_date)) as months_of_data,
  MIN(tx_date) as first_transaction,
  MAX(tx_date) as last_transaction
  
FROM transactions
WHERE status = 'confirmed'
  AND tx_date >= (CURRENT_DATE - INTERVAL '6 months')
GROUP BY user_id;

COMMENT ON VIEW monthly_averages IS 'ממוצעים חודשיים להכנסות והוצאות - בסיס לתחזית תזרים';

-- ============================================================================
-- 2. View: תחזית תזרים 12 חודשים קדימה
-- ============================================================================

CREATE OR REPLACE VIEW cash_flow_projection AS
WITH 
-- חודשים עתידיים (0-12)
future_months AS (
  SELECT 
    generate_series(0, 11) as month_offset,
    DATE_TRUNC('month', CURRENT_DATE) + (generate_series(0, 11) * INTERVAL '1 month') as month_date
),
-- יתרה נוכחית (מחשבון הבנק או מתנועות)
current_balance AS (
  SELECT 
    user_id,
    COALESCE(
      (SELECT current_balance FROM bank_accounts WHERE bank_accounts.user_id = users.id ORDER BY updated_at DESC LIMIT 1),
      (SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) FROM transactions WHERE transactions.user_id = users.id AND status = 'confirmed')
    ) as balance
  FROM users
),
-- ממוצעים מה-view הקודם
averages AS (
  SELECT * FROM monthly_averages
),
-- תחזית הכנסה (אם קיימת מה-income_forecaster)
income_forecast AS (
  SELECT 
    user_id,
    month,
    forecasted_income
  FROM user_income_forecast
  WHERE month >= DATE_TRUNC('month', CURRENT_DATE)
    AND month < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '12 months'
)

SELECT 
  u.id as user_id,
  fm.month_date as month,
  fm.month_offset,
  
  -- הכנסות צפויות (תחזית אם קיימת, אחרת ממוצע)
  COALESCE(inf.forecasted_income, avg.avg_income, 0) as projected_income,
  
  -- הוצאות צפויות (קבועות + משתנות)
  COALESCE(avg.avg_fixed_expenses, 0) + COALESCE(avg.avg_variable_expenses, 0) as projected_expenses,
  COALESCE(avg.avg_fixed_expenses, 0) as projected_fixed_expenses,
  COALESCE(avg.avg_variable_expenses, 0) as projected_variable_expenses,
  
  -- תזרים נטו
  COALESCE(inf.forecasted_income, avg.avg_income, 0) - 
    (COALESCE(avg.avg_fixed_expenses, 0) + COALESCE(avg.avg_variable_expenses, 0)) as net_cash_flow,
  
  -- יתרה צפויה (מצטברת)
  COALESCE(cb.balance, 0) + 
    SUM(
      COALESCE(inf.forecasted_income, avg.avg_income, 0) - 
      (COALESCE(avg.avg_fixed_expenses, 0) + COALESCE(avg.avg_variable_expenses, 0))
    ) OVER (
      PARTITION BY u.id 
      ORDER BY fm.month_offset 
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as projected_balance,
  
  -- רמת ביטחון (לפי כמות נתונים היסטוריים)
  CASE 
    WHEN COALESCE(avg.months_of_data, 0) >= 6 THEN 90
    WHEN COALESCE(avg.months_of_data, 0) >= 3 THEN 70
    WHEN COALESCE(avg.months_of_data, 0) >= 1 THEN 50
    ELSE 30
  END as confidence_level

FROM users u
CROSS JOIN future_months fm
LEFT JOIN current_balance cb ON cb.user_id = u.id
LEFT JOIN averages avg ON avg.user_id = u.id
LEFT JOIN income_forecast inf ON inf.user_id = u.id AND inf.month = fm.month_date

WHERE u.onboarding_state IN ('monitoring', 'behavior', 'goals', 'budget')
ORDER BY u.id, fm.month_offset;

COMMENT ON VIEW cash_flow_projection IS 'תחזית תזרים מזומנים ל-12 חודשים קדימה - מבוסס על ממוצעים היסטוריים ותחזית הכנסה';

-- ============================================================================
-- 3. פונקציה: תחזית תזרים למשתמש
-- ============================================================================

CREATE OR REPLACE FUNCTION get_cash_flow_projection(
  p_user_id UUID,
  p_months INTEGER DEFAULT 12
)
RETURNS TABLE (
  month DATE,
  month_name TEXT,
  projected_income NUMERIC,
  projected_expenses NUMERIC,
  net_cash_flow NUMERIC,
  projected_balance NUMERIC,
  confidence_level INTEGER,
  is_negative BOOLEAN,
  warning_level TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cfp.month::DATE,
    TO_CHAR(cfp.month, 'FMMonth YYYY') as month_name,
    cfp.projected_income,
    cfp.projected_expenses,
    cfp.net_cash_flow,
    cfp.projected_balance,
    cfp.confidence_level,
    (cfp.projected_balance < 0) as is_negative,
    CASE 
      WHEN cfp.projected_balance < 0 THEN 'critical'
      WHEN cfp.projected_balance < cfp.projected_expenses * 0.5 THEN 'warning'
      WHEN cfp.projected_balance < cfp.projected_expenses THEN 'caution'
      ELSE 'healthy'
    END as warning_level
  FROM cash_flow_projection cfp
  WHERE cfp.user_id = p_user_id
    AND cfp.month_offset < p_months
  ORDER BY cfp.month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_cash_flow_projection IS 'מחזיר תחזית תזרים מפורטת למשתמש עם אינדיקטורים';

-- ============================================================================
-- 4. פונקציה: זיהוי חודשים עם יתרה שלילית
-- ============================================================================

CREATE OR REPLACE FUNCTION get_negative_cash_flow_months(
  p_user_id UUID,
  p_months_ahead INTEGER DEFAULT 3
)
RETURNS TABLE (
  month DATE,
  projected_balance NUMERIC,
  shortage_amount NUMERIC,
  month_offset INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cfp.month::DATE,
    cfp.projected_balance,
    ABS(cfp.projected_balance) as shortage_amount,
    cfp.month_offset
  FROM cash_flow_projection cfp
  WHERE cfp.user_id = p_user_id
    AND cfp.month_offset < p_months_ahead
    AND cfp.projected_balance < 0
  ORDER BY cfp.month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_negative_cash_flow_months IS 'מחזיר רשימת חודשים עם יתרה שלילית צפויה';

-- ============================================================================
-- 5. פונקציה: המלצות לשיפור תזרים
-- ============================================================================

CREATE OR REPLACE FUNCTION get_cash_flow_recommendations(
  p_user_id UUID
)
RETURNS TABLE (
  recommendation_type TEXT,
  recommendation_text TEXT,
  impact_amount NUMERIC,
  priority TEXT
) AS $$
DECLARE
  v_negative_months INTEGER;
  v_avg_expenses NUMERIC;
  v_avg_income NUMERIC;
  v_variable_expenses NUMERIC;
BEGIN
  -- ספירת חודשים שליליים
  SELECT COUNT(*) INTO v_negative_months
  FROM cash_flow_projection
  WHERE user_id = p_user_id
    AND month_offset < 6
    AND projected_balance < 0;
  
  -- שלוף ממוצעים
  SELECT avg_income, avg_expenses, avg_variable_expenses 
  INTO v_avg_income, v_avg_expenses, v_variable_expenses
  FROM monthly_averages
  WHERE user_id = p_user_id;
  
  -- אם יש חודשים שליליים - המלצות
  IF v_negative_months > 0 THEN
    -- המלצה 1: הגדלת הכנסה
    RETURN QUERY
    SELECT 
      'increase_income'::TEXT,
      'שקול להגדיל הכנסה דרך עבודה נוספת, העלאת שכר, או הכנסה פאסיבית'::TEXT,
      v_avg_expenses - v_avg_income,
      'high'::TEXT;
    
    -- המלצה 2: הפחתת הוצאות משתנות
    RETURN QUERY
    SELECT 
      'reduce_variable_expenses'::TEXT,
      format('נסה להפחית הוצאות משתנות ב-%s%% (חיסכון של %s ₪/חודש)', 
             ROUND((v_variable_expenses * 0.2 / v_avg_expenses) * 100),
             ROUND(v_variable_expenses * 0.2)),
      v_variable_expenses * 0.2,
      'high'::TEXT;
    
    -- המלצה 3: דחיית יעדים
    RETURN QUERY
    SELECT 
      'defer_goals'::TEXT,
      'שקול לדחות יעדים לא קריטיים לחודשים עם תזרים חיובי'::TEXT,
      (SELECT COALESCE(SUM(monthly_allocation), 0) FROM goals WHERE user_id = p_user_id AND status = 'active'),
      'medium'::TEXT;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_cash_flow_recommendations IS 'מחזיר המלצות מותאמות אישית לשיפור תזרים';

-- ============================================================================
-- Success message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Cash Flow Projection migration completed successfully!';
  RAISE NOTICE '   - Created monthly_averages view';
  RAISE NOTICE '   - Created cash_flow_projection view (12 months)';
  RAISE NOTICE '   - Created get_cash_flow_projection() function';
  RAISE NOTICE '   - Created get_negative_cash_flow_months() function';
  RAISE NOTICE '   - Created get_cash_flow_recommendations() function';
END $$;
