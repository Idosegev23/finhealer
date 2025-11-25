-- WhatsApp AI System Database Schema
-- Creates tables for conversation management, learning, and patterns

-- ==========================================
-- CONVERSATION MANAGEMENT
-- ==========================================

-- Conversation history table
CREATE TABLE IF NOT EXISTS conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message_text TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'voice', 'image', 'document')),
  intent TEXT,
  entities JSONB DEFAULT '[]'::jsonb,
  context_state TEXT,
  gpt_response_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_history_user_id ON conversation_history(user_id);
CREATE INDEX idx_conversation_history_timestamp ON conversation_history(timestamp DESC);
CREATE INDEX idx_conversation_history_user_timestamp ON conversation_history(user_id, timestamp DESC);

-- Conversation context table (current state)
CREATE TABLE IF NOT EXISTS conversation_context (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_state TEXT NOT NULL DEFAULT 'idle',
  ongoing_task JSONB,
  task_progress INTEGER DEFAULT 0,
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  user_mood TEXT CHECK (user_mood IN ('engaged', 'tired', 'busy')),
  pending_questions JSONB DEFAULT '[]'::jsonb,
  waiting_for_document TEXT,
  previous_response_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_context_state ON conversation_context(current_state);
CREATE INDEX idx_conversation_context_last_interaction ON conversation_context(last_interaction DESC);

-- Pending tasks table
CREATE TABLE IF NOT EXISTS pending_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('classify_transactions', 'upload_document', 'set_goal', 'review_budget', 'onboarding')),
  task_data JSONB DEFAULT '{}'::jsonb,
  total_items INTEGER DEFAULT 0,
  completed_items INTEGER DEFAULT 0,
  paused_at TIMESTAMPTZ,
  reminder_scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_tasks_user_id ON pending_tasks(user_id);
CREATE INDEX idx_pending_tasks_type ON pending_tasks(task_type);

-- ==========================================
-- USER PREFERENCES
-- ==========================================

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  communication_style TEXT DEFAULT 'casual' CHECK (communication_style IN ('casual', 'formal')),
  reminder_frequency TEXT DEFAULT 'normal' CHECK (reminder_frequency IN ('minimal', 'normal', 'frequent')),
  preferred_reminder_time TIME DEFAULT '09:00:00',
  auto_categorize_threshold FLOAT DEFAULT 0.8,
  voice_messages_enabled BOOLEAN DEFAULT TRUE,
  gamification_enabled BOOLEAN DEFAULT TRUE,
  proactive_insights_enabled BOOLEAN DEFAULT TRUE,
  language TEXT DEFAULT 'he',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- LEARNING & PATTERNS
-- ==========================================

-- User patterns table (learning system)
CREATE TABLE IF NOT EXISTS user_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('merchant', 'category', 'amount_range', 'day_of_week', 'time_of_day', 'subscription')),
  pattern_key TEXT NOT NULL, -- e.g., "שופרסל" or "friday_night"
  pattern_value JSONB NOT NULL, -- category, typical amount, etc.
  confidence_score FLOAT DEFAULT 0.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  learned_from_count INTEGER DEFAULT 1,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  auto_apply BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pattern_type, pattern_key)
);

CREATE INDEX idx_user_patterns_user_id ON user_patterns(user_id);
CREATE INDEX idx_user_patterns_type ON user_patterns(pattern_type);
CREATE INDEX idx_user_patterns_confidence ON user_patterns(confidence_score DESC);
CREATE INDEX idx_user_patterns_user_type_key ON user_patterns(user_id, pattern_type, pattern_key);

-- Pattern corrections table (learning from mistakes)
CREATE TABLE IF NOT EXISTS pattern_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES user_patterns(id) ON DELETE CASCADE,
  original_value JSONB NOT NULL,
  corrected_value JSONB NOT NULL,
  correction_type TEXT NOT NULL CHECK (correction_type IN ('category', 'amount', 'merchant', 'description')),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pattern_corrections_user_id ON pattern_corrections(user_id);
CREATE INDEX idx_pattern_corrections_pattern_id ON pattern_corrections(pattern_id);

-- ==========================================
-- REMINDERS SYSTEM
-- ==========================================

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('follow_up', 'document_request', 'classification_continue', 'monthly_summary', 'goal_check', 'bill_payment')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  message TEXT NOT NULL,
  context_data JSONB DEFAULT '{}'::jsonb,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_scheduled ON reminders(scheduled_for) WHERE sent = FALSE;
CREATE INDEX idx_reminders_due ON reminders(user_id, scheduled_for) WHERE sent = FALSE;

-- ==========================================
-- UPDATES TO EXISTING TABLES
-- ==========================================

-- Add AI-related columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS learned_from_pattern BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS confidence_score FLOAT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN DEFAULT TRUE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ai_suggested_category TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'bank_import', 'ai_whatsapp', 'ocr'));

CREATE INDEX IF NOT EXISTS idx_transactions_requires_confirmation ON transactions(user_id, requires_confirmation) WHERE requires_confirmation = TRUE;

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Policies for conversation_history
CREATE POLICY "Users can view their own conversation history"
  ON conversation_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
  ON conversation_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies for conversation_context
CREATE POLICY "Users can view their own context"
  ON conversation_context FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own context"
  ON conversation_context FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own context"
  ON conversation_context FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies for pending_tasks
CREATE POLICY "Users can view their own tasks"
  ON pending_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own tasks"
  ON pending_tasks FOR ALL
  USING (auth.uid() = user_id);

-- Policies for user_preferences
CREATE POLICY "Users can view their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Policies for user_patterns
CREATE POLICY "Users can view their own patterns"
  ON user_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own patterns"
  ON user_patterns FOR ALL
  USING (auth.uid() = user_id);

-- Policies for pattern_corrections
CREATE POLICY "Users can view their own corrections"
  ON pattern_corrections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own corrections"
  ON pattern_corrections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies for reminders
CREATE POLICY "Users can view their own reminders"
  ON reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own reminders"
  ON reminders FOR ALL
  USING (auth.uid() = user_id);

-- ==========================================
-- FUNCTIONS & TRIGGERS
-- ==========================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_conversation_context_updated_at
  BEFORE UPDATE ON conversation_context
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pending_tasks_updated_at
  BEFORE UPDATE ON pending_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_patterns_updated_at
  BEFORE UPDATE ON user_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get user's spending patterns
CREATE OR REPLACE FUNCTION get_user_spending_patterns(p_user_id UUID)
RETURNS TABLE (
  pattern_type TEXT,
  pattern_key TEXT,
  pattern_value JSONB,
  confidence_score FLOAT,
  usage_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.pattern_type,
    up.pattern_key,
    up.pattern_value,
    up.confidence_score,
    up.learned_from_count
  FROM user_patterns up
  WHERE up.user_id = p_user_id
    AND up.confidence_score > 0.5
  ORDER BY up.confidence_score DESC, up.learned_from_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get conversation summary
CREATE OR REPLACE FUNCTION get_conversation_summary(p_user_id UUID, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  total_messages INTEGER,
  user_messages INTEGER,
  assistant_messages INTEGER,
  avg_response_time_seconds FLOAT,
  most_common_intent TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH message_stats AS (
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_count,
      SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_count
    FROM conversation_history
    WHERE user_id = p_user_id
      AND timestamp > NOW() - (p_days || ' days')::INTERVAL
  ),
  intent_stats AS (
    SELECT intent, COUNT(*) as count
    FROM conversation_history
    WHERE user_id = p_user_id
      AND role = 'user'
      AND intent IS NOT NULL
      AND timestamp > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY intent
    ORDER BY count DESC
    LIMIT 1
  )
  SELECT 
    ms.total::INTEGER,
    ms.user_count::INTEGER,
    ms.assistant_count::INTEGER,
    0::FLOAT as avg_response_time, -- TODO: Calculate from timestamps
    COALESCE(ist.intent, 'unknown') as most_common_intent
  FROM message_stats ms
  LEFT JOIN intent_stats ist ON TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- INITIAL DATA
-- ==========================================

-- Create default preferences for existing users
INSERT INTO user_preferences (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_preferences)
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE conversation_history IS 'Stores all WhatsApp conversation messages with intent and entity extraction';
COMMENT ON TABLE conversation_context IS 'Current conversation state for each user';
COMMENT ON TABLE user_patterns IS 'Learned patterns from user behavior for auto-categorization';
COMMENT ON TABLE reminders IS 'Scheduled reminders and follow-ups';
COMMENT ON TABLE user_preferences IS 'User preferences for AI behavior and communication style';

