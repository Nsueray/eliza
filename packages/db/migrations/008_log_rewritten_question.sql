-- Add rewritten_question column to message_logs
-- Stores the question after conversationMemory rewrite (original stays in message_text)
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS rewritten_question TEXT;
