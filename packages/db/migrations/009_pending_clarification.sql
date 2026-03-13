-- Mini Clarification System: store pending clarification state per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_clarification JSONB;
