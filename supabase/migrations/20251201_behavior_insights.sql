-- ============================================================================
-- Migration: behavior_insights table
-- Purpose: שמירת תובנות מניתוח התנהגות (שלב 2)
-- Created: 2024-12-01
-- ============================================================================

-- יצירת טבלת behavior_insights אם לא קיימת
CREATE TABLE IF NOT EXISTS behavior_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- סוג התובנה
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'spending_spike',      -- עלייה בהוצאות
    'positive_change',     -- ירידה בהוצאות
    'category_trend',      -- מגמה בקטגוריה
    'merchant_habit',      -- הרגל אצל מרצ'נט
    'day_pattern',         -- דפוס יום בשבוע
    'subscription_found',  -- מנוי שזוהה
    'saving_opportunity',  -- הזדמנות לחיסכון
    'warning',             -- אזהרה כללית
    'tip'                  -- טיפ
  )),
  
  -- תוכן
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT DEFAULT '💡',
  
  -- עדיפות
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  
  -- פעולה מוצעת
  actionable BOOLEAN DEFAULT false,
  suggested_action TEXT,
  
  -- נתונים נוספים (JSON)
  data JSONB DEFAULT '{}',
  
  -- מעקב
  seen BOOLEAN DEFAULT false,
  seen_at TIMESTAMP WITH TIME ZONE,
  acted_upon BOOLEAN DEFAULT false,
  acted_at TIMESTAMP WITH TIME ZONE,
  
  -- זמנים
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_behavior_insights_user_id ON behavior_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_insights_type ON behavior_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_behavior_insights_priority ON behavior_insights(priority);
CREATE INDEX IF NOT EXISTS idx_behavior_insights_created ON behavior_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_insights_unseen ON behavior_insights(user_id, seen) WHERE seen = false;

-- RLS
ALTER TABLE behavior_insights ENABLE ROW LEVEL SECURITY;

-- מדיניות: משתמש רואה רק את התובנות שלו
DROP POLICY IF EXISTS "Users can view own insights" ON behavior_insights;
CREATE POLICY "Users can view own insights" ON behavior_insights
  FOR SELECT USING (auth.uid() = user_id);

-- מדיניות: המערכת יכולה להוסיף
DROP POLICY IF EXISTS "System can insert insights" ON behavior_insights;
CREATE POLICY "System can insert insights" ON behavior_insights
  FOR INSERT WITH CHECK (true);

-- מדיניות: משתמש יכול לעדכן (seen, acted_upon)
DROP POLICY IF EXISTS "Users can update own insights" ON behavior_insights;
CREATE POLICY "Users can update own insights" ON behavior_insights
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- טבלת user_patterns (אם לא קיימת)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'merchant',      -- מרצ'נט → קטגוריה
    'category',      -- קטגוריה נפוצה
    'amount_range',  -- טווח סכומים
    'day_of_week',   -- יום בשבוע
    'time_of_day',   -- שעה ביום
    'subscription'   -- מנוי
  )),
  
  pattern_key TEXT NOT NULL,
  pattern_value JSONB NOT NULL,
  
  confidence_score FLOAT DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  learned_from_count INTEGER DEFAULT 1,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  auto_apply BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, pattern_type, pattern_key)
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_user_patterns_user ON user_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_patterns_type ON user_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_user_patterns_auto ON user_patterns(user_id, auto_apply) WHERE auto_apply = true;

-- RLS
ALTER TABLE user_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own patterns" ON user_patterns;
CREATE POLICY "Users can view own patterns" ON user_patterns
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can manage patterns" ON user_patterns;
CREATE POLICY "System can manage patterns" ON user_patterns
  FOR ALL WITH CHECK (true);

-- ============================================================================
-- פונקציות עזר
-- ============================================================================

-- פונקציה לקבלת תובנות לא נקראות
CREATE OR REPLACE FUNCTION get_unread_insights(p_user_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (
  id UUID,
  insight_type TEXT,
  title TEXT,
  description TEXT,
  emoji TEXT,
  priority TEXT,
  actionable BOOLEAN,
  suggested_action TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bi.id,
    bi.insight_type,
    bi.title,
    bi.description,
    bi.emoji,
    bi.priority,
    bi.actionable,
    bi.suggested_action,
    bi.data,
    bi.created_at
  FROM behavior_insights bi
  WHERE bi.user_id = p_user_id
    AND bi.seen = false
    AND (bi.expires_at IS NULL OR bi.expires_at > NOW())
  ORDER BY 
    CASE bi.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
    bi.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- פונקציה לסימון תובנה כנקראה
CREATE OR REPLACE FUNCTION mark_insight_seen(p_insight_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE behavior_insights
  SET seen = true, seen_at = NOW()
  WHERE id = p_insight_id AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- פונקציה לספירת ימים בשלב behavior
CREATE OR REPLACE FUNCTION get_days_in_behavior_phase(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  phase_start TIMESTAMP WITH TIME ZONE;
  days_count INTEGER;
BEGIN
  SELECT phase_updated_at INTO phase_start
  FROM users
  WHERE id = p_user_id AND current_phase = 'behavior';
  
  IF phase_start IS NULL THEN
    RETURN 0;
  END IF;
  
  days_count := EXTRACT(DAY FROM (NOW() - phase_start));
  RETURN COALESCE(days_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- הוספת עמודות לטבלת users אם חסרות
-- ============================================================================

DO $$
BEGIN
  -- current_phase
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'current_phase') THEN
    ALTER TABLE users ADD COLUMN current_phase TEXT DEFAULT 'reflection';
  END IF;
  
  -- phase_updated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'phase_updated_at') THEN
    ALTER TABLE users ADD COLUMN phase_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  
  -- phi_score
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'phi_score') THEN
    ALTER TABLE users ADD COLUMN phi_score INTEGER CHECK (phi_score >= 0 AND phi_score <= 100);
  END IF;
END $$;

-- ============================================================================
-- סיום
-- ============================================================================

COMMENT ON TABLE behavior_insights IS 'תובנות מניתוח התנהגות משתמשים - שלב 2 של Phi';
COMMENT ON TABLE user_patterns IS 'דפוסים שנלמדו מהתנהגות משתמשים';

