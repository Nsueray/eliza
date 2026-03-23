-- Migration 018: User country + timezone for per-user push scheduling
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_country VARCHAR(50) DEFAULT 'Turkey';
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Istanbul';

-- Update existing users
UPDATE users SET user_country = 'Turkey', timezone = 'Europe/Istanbul'
WHERE user_country IS NULL OR user_country = 'Turkey';
