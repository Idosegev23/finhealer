-- Add all 39 expense fields to user_financial_profile table
-- This migration adds detailed expense tracking fields

-- דיור (Housing)
ALTER TABLE user_financial_profile
ADD COLUMN IF NOT EXISTS rent_mortgage NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS building_maintenance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS property_tax NUMERIC DEFAULT 0;

-- ביטוחים (Insurance)
ALTER TABLE user_financial_profile
ADD COLUMN IF NOT EXISTS life_insurance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS health_insurance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS car_insurance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS home_insurance NUMERIC DEFAULT 0;

-- תקשורת (Communication)
ALTER TABLE user_financial_profile
ADD COLUMN IF NOT EXISTS cellular NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS internet NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tv_cable NUMERIC DEFAULT 0;

-- רכב ותחבורה (Vehicle & Transportation)
ALTER TABLE user_financial_profile
ADD COLUMN IF NOT EXISTS leasing NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS fuel NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS parking NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS public_transport NUMERIC DEFAULT 0;

-- ילדים וחינוך (Children & Education)
ALTER TABLE user_financial_profile
ADD COLUMN IF NOT EXISTS daycare NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS afterschool NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tuition NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS extracurricular NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS babysitter NUMERIC DEFAULT 0;

-- בריאות ורווחה (Health & Wellness)
ALTER TABLE user_financial_profile
ADD COLUMN IF NOT EXISTS gym NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS therapy NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS medication NUMERIC DEFAULT 0;

-- חיסכון (Savings)
ALTER TABLE user_financial_profile
ADD COLUMN IF NOT EXISTS pension_funds NUMERIC DEFAULT 0;

-- מנויים (Subscriptions)
ALTER TABLE user_financial_profile
ADD COLUMN IF NOT EXISTS streaming NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS digital_services NUMERIC DEFAULT 0;

-- חובה (Utilities)
ALTER TABLE user_financial_profile
ADD COLUMN IF NOT EXISTS electricity NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS water NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS gas NUMERIC DEFAULT 0;

-- אחר (Other)
ALTER TABLE user_financial_profile
ADD COLUMN IF NOT EXISTS other_fixed NUMERIC DEFAULT 0;

-- Add calculated fields
ALTER TABLE user_financial_profile
ADD COLUMN IF NOT EXISTS total_fixed_expenses NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_monthly_income NUMERIC DEFAULT 0;

-- Add current_account_balance if missing
ALTER TABLE user_financial_profile
ADD COLUMN IF NOT EXISTS current_account_balance NUMERIC DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN user_financial_profile.rent_mortgage IS 'שכר דירה או החזר משכנתא חודשי';
COMMENT ON COLUMN user_financial_profile.building_maintenance IS 'דמי ניהול/ועד בית';
COMMENT ON COLUMN user_financial_profile.property_tax IS 'ארנונה חודשית';
COMMENT ON COLUMN user_financial_profile.daycare IS 'מעון/גן ילדים';
COMMENT ON COLUMN user_financial_profile.afterschool IS 'צהרון';
COMMENT ON COLUMN user_financial_profile.extracurricular IS 'חוגים';
COMMENT ON COLUMN user_financial_profile.total_fixed_expenses IS 'סך כל ההוצאות הקבועות החודשיות';
COMMENT ON COLUMN user_financial_profile.total_monthly_income IS 'סך כל ההכנסות החודשיות';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_financial_profile_total_expenses
ON user_financial_profile(total_fixed_expenses);

-- Update existing records to calculate totals (if needed)
-- This will set total_fixed_expenses for existing records
UPDATE user_financial_profile
SET total_fixed_expenses = COALESCE(
  rent_mortgage + building_maintenance + property_tax +
  life_insurance + health_insurance + car_insurance + home_insurance +
  cellular + internet + tv_cable +
  leasing + fuel + parking + public_transport +
  daycare + afterschool + tuition + extracurricular + babysitter +
  gym + therapy + medication +
  pension_funds +
  streaming + digital_services +
  electricity + water + gas +
  other_fixed, 0
)
WHERE total_fixed_expenses = 0 OR total_fixed_expenses IS NULL;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_financial_profile TO authenticated;
