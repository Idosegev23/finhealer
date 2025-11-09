-- הוספת שדות ישראליים למקורות הכנסה
-- תמיכה במע"מ, הכנסות משולבות, קצבאות, הכנסה מהון

ALTER TABLE income_sources 
  -- סטטוס מע"מ
  ADD COLUMN IF NOT EXISTS vat_status TEXT CHECK (vat_status IN ('licensed', 'exempt', 'not_applicable')) DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS includes_vat BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2),
  
  -- ניכוי במקור
  ADD COLUMN IF NOT EXISTS has_withholding_tax BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS withholding_tax_amount NUMERIC(10,2),
  
  -- הכנסה משולבת (היברידי)
  ADD COLUMN IF NOT EXISTS is_hybrid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hybrid_salary_part NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS hybrid_freelance_part NUMERIC(10,2),
  
  -- הכנסה מהון
  ADD COLUMN IF NOT EXISTS capital_gain_tax_paid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS capital_gain_tax_rate NUMERIC(5,2),
  
  -- קצבאות
  ADD COLUMN IF NOT EXISTS allowance_type TEXT,
  ADD COLUMN IF NOT EXISTS is_tax_exempt BOOLEAN DEFAULT FALSE,
  
  -- פירוט מדויק של ניכויים (JSON)
  ADD COLUMN IF NOT EXISTS detailed_breakdown JSONB;

-- הערות על השדות
COMMENT ON COLUMN income_sources.vat_status IS 'סטטוס מע״ם: licensed (עוסק מורשה), exempt (עוסק פטור), not_applicable (לא רלוונטי)';
COMMENT ON COLUMN income_sources.includes_vat IS 'האם הסכום כולל מע״ם 18%';
COMMENT ON COLUMN income_sources.vat_amount IS 'סכום מע״ם שצריך לדווח';
COMMENT ON COLUMN income_sources.has_withholding_tax IS 'האם יש ניכוי מס במקור (למשל בהכנסה מהון)';
COMMENT ON COLUMN income_sources.withholding_tax_amount IS 'סכום ניכוי מס במקור';
COMMENT ON COLUMN income_sources.is_hybrid IS 'האם הכנסה משולבת (שכיר + עצמאי)';
COMMENT ON COLUMN income_sources.hybrid_salary_part IS 'חלק שכיר בהכנסה משולבת';
COMMENT ON COLUMN income_sources.hybrid_freelance_part IS 'חלק עצמאי בהכנסה משולבת';
COMMENT ON COLUMN income_sources.capital_gain_tax_paid IS 'האם מס רווח הון כבר שולם';
COMMENT ON COLUMN income_sources.capital_gain_tax_rate IS 'שיעור מס רווח הון (בדרך כלל 25%)';
COMMENT ON COLUMN income_sources.allowance_type IS 'סוג קצבה: unemployment (אבטלה), disability (נכות), pension (פנסיה), other (אחר)';
COMMENT ON COLUMN income_sources.is_tax_exempt IS 'האם פטור ממס (קצבאות בדרך כלל פטורות)';
COMMENT ON COLUMN income_sources.detailed_breakdown IS 'פירוט מלא של חישובים: { incomeTax: {...}, nationalInsurance: {...}, healthTax: {...}, pension: {...}, studyFund: {...} }';

-- אינדקסים לשאילתות מהירות
CREATE INDEX IF NOT EXISTS idx_income_sources_vat_status ON income_sources(vat_status) WHERE vat_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_income_sources_is_hybrid ON income_sources(is_hybrid) WHERE is_hybrid = true;
CREATE INDEX IF NOT EXISTS idx_income_sources_allowance_type ON income_sources(allowance_type) WHERE allowance_type IS NOT NULL;

