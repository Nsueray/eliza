-- Migration 006: Message Logs table
-- Tracks all WhatsApp message exchanges with token usage and performance metrics

CREATE TABLE IF NOT EXISTS message_logs (
  id SERIAL PRIMARY KEY,
  user_phone VARCHAR(50),
  user_name VARCHAR(100),
  user_role VARCHAR(20),
  message_text TEXT,
  response_text TEXT,
  intent VARCHAR(50),
  tables_used TEXT[],
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  model_intent VARCHAR(50),
  model_answer VARCHAR(50),
  duration_ms INTEGER DEFAULT 0,
  is_command BOOLEAN DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_user_phone ON message_logs(user_phone);
CREATE INDEX IF NOT EXISTS idx_message_logs_intent ON message_logs(intent);
