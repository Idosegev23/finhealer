-- Migration: השלמת מערכת φ Goals
-- תאריך: 21 ינואר 2026
-- מטרה: הוספת שדות חדשים לטבלת goals + טבלת אבני דרך

-- שלב 1: שדות חדשים בטבלת goals
ALTER TABLE goals 
  ADD COLUMN IF NOT EXISTS goal_type TEXT,
  ADD COLUMN IF NOT EXISTS budget_source TEXT CHECK (budget_source IN ('income', 'bonus', 'sale', 'inheritance', 'other')),
  ADD COLUMN IF NOT EXISTS funding_notes TEXT,
  ADD COLUMN IF NOT EXISTS child_id UUID REFERENCES children(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS depends_on_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS goal_group TEXT,
  ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '[]'::jsonb;

-- Comment על השדות החדשים
COMMENT ON COLUMN goals.goal_type IS 'סוג יעד: emergency_fund, debt_payoff, savings_goal, vehicle, vacation, wedding, renovation, real_estate_investment, pension_increase, child_savings, family_savings, education, home_purchase, retirement, other';
COMMENT ON COLUMN goals.budget_source IS 'מקור התקציב: income (הכנסה שוטפת), bonus (בונוס), sale (מכירת נכס), inheritance (ירושה), other (אחר)';
COMMENT ON COLUMN goals.funding_notes IS 'הערות נוספות על מקור המימון';
COMMENT ON COLUMN goals.child_id IS 'קישור לילד ספציפי מטבלת children (אם רלוונטי)';
COMMENT ON COLUMN goals.depends_on_goal_id IS 'תלות ביעד אחר - יעד זה יתחיל רק אחרי השלמת יעד התלות';
COMMENT ON COLUMN goals.goal_group IS 'קיבוץ יעדים לוגי (ילדים, נדלן, רכבים וכו)';
COMMENT ON COLUMN goals.milestones IS 'אבני דרך שהושגו: [{"percent": 25, "reached_at": "2026-01-15", "celebrated": true}]';

-- שלב 2: טבלת אבני דרך (goal_milestones)
CREATE TABLE IF NOT EXISTS goal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  percent_reached INTEGER NOT NULL CHECK (percent_reached > 0 AND percent_reached <= 100),
  amount_reached NUMERIC NOT NULL CHECK (amount_reached >= 0),
  reached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  celebrated BOOLEAN DEFAULT false,
  celebration_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal_id ON goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_reached_at ON goal_milestones(reached_at DESC);
CREATE INDEX IF NOT EXISTS idx_goals_depends_on ON goals(depends_on_goal_id) WHERE depends_on_goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_child_id ON goals(child_id) WHERE child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_goal_group ON goals(goal_group) WHERE goal_group IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_goal_type ON goals(goal_type) WHERE goal_type IS NOT NULL;

-- Comment על הטבלה
COMMENT ON TABLE goal_milestones IS 'אבני דרך שהושגו ביעדים - 25%, 50%, 75%, 100%';
COMMENT ON COLUMN goal_milestones.percent_reached IS 'אחוז השגה (25, 50, 75, 100)';
COMMENT ON COLUMN goal_milestones.amount_reached IS 'סכום שהושג בנקודת אבן הדרך';
COMMENT ON COLUMN goal_milestones.celebrated IS 'האם נשלחה הודעת חגיגה למשתמש';
COMMENT ON COLUMN goal_milestones.celebration_sent_at IS 'מתי נשלחה הודעת החגיגה';

-- RLS Policies לטבלת goal_milestones
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goal milestones"
  ON goal_milestones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM goals 
      WHERE goals.id = goal_milestones.goal_id 
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own goal milestones"
  ON goal_milestones FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goals 
      WHERE goals.id = goal_milestones.goal_id 
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own goal milestones"
  ON goal_milestones FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM goals 
      WHERE goals.id = goal_milestones.goal_id 
      AND goals.user_id = auth.uid()
    )
  );

-- פונקציה עוזרת: בדיקת תלויות יעד
CREATE OR REPLACE FUNCTION check_goal_dependency_completion(goal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  dependency_id UUID;
  dependency_status TEXT;
BEGIN
  SELECT depends_on_goal_id INTO dependency_id
  FROM goals
  WHERE id = goal_id;
  
  -- אין תלות - אפשר להתחיל
  IF dependency_id IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- בדוק אם יעד התלות הושלם
  SELECT status INTO dependency_status
  FROM goals
  WHERE id = dependency_id;
  
  RETURN dependency_status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_goal_dependency_completion IS 'בודק אם יעד תלות הושלם - משמש לוולידציה';

-- פונקציה עוזרת: יצירת אבני דרך אוטומטית
CREATE OR REPLACE FUNCTION create_milestone_if_reached(
  p_goal_id UUID,
  p_current_amount NUMERIC,
  p_target_amount NUMERIC
)
RETURNS VOID AS $$
DECLARE
  current_percent INTEGER;
  milestone_percent INTEGER;
  milestone_exists BOOLEAN;
BEGIN
  -- חשב אחוז נוכחי
  IF p_target_amount > 0 THEN
    current_percent := FLOOR((p_current_amount / p_target_amount) * 100);
    
    -- בדוק אבני דרך: 25%, 50%, 75%, 100%
    FOREACH milestone_percent IN ARRAY ARRAY[25, 50, 75, 100] LOOP
      IF current_percent >= milestone_percent THEN
        -- בדוק אם כבר קיים
        SELECT EXISTS(
          SELECT 1 FROM goal_milestones 
          WHERE goal_id = p_goal_id 
          AND percent_reached = milestone_percent
        ) INTO milestone_exists;
        
        -- צור אם לא קיים
        IF NOT milestone_exists THEN
          INSERT INTO goal_milestones (
            goal_id, 
            percent_reached, 
            amount_reached,
            celebrated
          ) VALUES (
            p_goal_id, 
            milestone_percent,
            p_current_amount,
            false
          );
        END IF;
      END IF;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_milestone_if_reached IS 'יוצר אבני דרך אוטומטית כשיעד מגיע ל-25%, 50%, 75%, 100%';

-- Trigger: יצירת אבני דרך אוטומטית בעדכון current_amount
CREATE OR REPLACE FUNCTION trigger_create_milestones()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_milestone_if_reached(
    NEW.id,
    NEW.current_amount,
    NEW.target_amount
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_goal_amount_update ON goals;
CREATE TRIGGER on_goal_amount_update
  AFTER INSERT OR UPDATE OF current_amount ON goals
  FOR EACH ROW
  WHEN (NEW.current_amount > 0 AND NEW.target_amount > 0)
  EXECUTE FUNCTION trigger_create_milestones();

-- View: סיכום יעדים עם תלויות
CREATE OR REPLACE VIEW goals_with_dependencies AS
SELECT 
  g.*,
  dep.name as depends_on_goal_name,
  dep.status as depends_on_goal_status,
  dep.current_amount as depends_on_current_amount,
  dep.target_amount as depends_on_target_amount,
  CASE 
    WHEN g.depends_on_goal_id IS NULL THEN true
    WHEN dep.status = 'completed' THEN true
    ELSE false
  END as can_start,
  (SELECT COUNT(*) FROM goal_milestones WHERE goal_id = g.id) as milestones_reached,
  (SELECT json_agg(json_build_object(
    'percent', percent_reached,
    'amount', amount_reached,
    'reached_at', reached_at,
    'celebrated', celebrated
  ) ORDER BY percent_reached)
  FROM goal_milestones WHERE goal_id = g.id) as milestone_history
FROM goals g
LEFT JOIN goals dep ON g.depends_on_goal_id = dep.id;

COMMENT ON VIEW goals_with_dependencies IS 'תצוגה מורחבת של יעדים עם מידע על תלויות ואבני דרך';

-- עדכון נתוני הדגמה (אם יש)
UPDATE goals 
SET 
  goal_type = CASE 
    WHEN name ILIKE '%חירום%' THEN 'emergency_fund'
    WHEN name ILIKE '%מחשב%' THEN 'savings_goal'
    WHEN name ILIKE '%חופשה%' THEN 'vacation'
    WHEN name ILIKE '%רכב%' THEN 'vehicle'
    ELSE 'other'
  END,
  budget_source = 'income',
  goal_group = CASE
    WHEN name ILIKE '%רכב%' THEN 'רכבים'
    WHEN name ILIKE '%חופשה%' THEN 'בילויים'
    ELSE NULL
  END
WHERE goal_type IS NULL;
