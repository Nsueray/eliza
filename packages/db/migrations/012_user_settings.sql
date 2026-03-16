-- Migration 012: User settings (theme, accent, density, language, timezone)
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
