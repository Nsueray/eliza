-- Migration 017: Push Messages
-- Scheduled WhatsApp push notifications for users

-- Add push_settings JSONB to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_settings JSONB DEFAULT '{}';

-- Set default push settings for CEO (all enabled)
UPDATE users SET push_settings = '{
  "morning_brief": {"enabled": true, "time": "08:00"},
  "midday_pulse": {"enabled": true, "time": "13:00"},
  "daily_wrap": {"enabled": true, "time": "16:00"},
  "weekly_report": {"enabled": true, "time": "08:00"},
  "weekly_close": {"enabled": true, "time": "16:00"},
  "scope": "all"
}'::jsonb WHERE role = 'ceo' AND (push_settings IS NULL OR push_settings = '{}'::jsonb);

-- Push log table for deduplication and history
CREATE TABLE IF NOT EXISTS push_log (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_type TEXT NOT NULL,
  message_text TEXT,
  sent_via TEXT DEFAULT 'log',
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_log_user_id ON push_log(user_id);
CREATE INDEX IF NOT EXISTS idx_push_log_type_date ON push_log(push_type, created_at);
