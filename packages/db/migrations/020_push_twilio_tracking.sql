-- Migration 020: Add Twilio message SID tracking to push_log
-- Captures Twilio SID for delivery status debugging

ALTER TABLE push_log ADD COLUMN IF NOT EXISTS twilio_sid TEXT;
ALTER TABLE push_log ADD COLUMN IF NOT EXISTS window_status TEXT DEFAULT 'open';
-- window_status: 'open' (24h active), 'expired' (no user msg in 24h), 'unknown'
