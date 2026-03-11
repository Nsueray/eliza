-- Migration 007: Add nicknames column to users table
-- Stores comma-separated nicknames for personalized greetings

ALTER TABLE users ADD COLUMN IF NOT EXISTS nicknames TEXT;

-- Seed existing users
UPDATE users SET nicknames = 'baba,babacım,babiş,patron' WHERE role = 'ceo';
UPDATE users SET nicknames = 'elifcim,annecim' WHERE name ILIKE '%elif%';
