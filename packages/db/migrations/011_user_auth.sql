-- Migration 011: Dashboard authentication
-- Adds password_hash, last_login, dashboard_permissions to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_permissions JSONB DEFAULT '{}';

-- Set CEO initial password (eliza2026)
UPDATE users SET password_hash = '$2b$10$DoKelcKpaQ0mvOa5dq9H1e4l4co1QYcyHBPJPICeahed2naaxwfBG'
  WHERE role = 'ceo' AND password_hash IS NULL;

-- Set CEO default permissions (all access)
UPDATE users SET dashboard_permissions = '{
  "war_room": true,
  "expo_directory": true,
  "expo_detail": true,
  "sales": true,
  "logs": true,
  "intelligence": true,
  "system": true,
  "users": true,
  "settings": true
}'::jsonb WHERE role = 'ceo';

-- Set manager default permissions
UPDATE users SET dashboard_permissions = '{
  "war_room": true,
  "expo_directory": true,
  "expo_detail": true,
  "sales": true,
  "logs": false,
  "intelligence": false,
  "system": false,
  "users": false,
  "settings": false
}'::jsonb WHERE role = 'manager';

-- Set agent default permissions
UPDATE users SET dashboard_permissions = '{
  "war_room": false,
  "expo_directory": false,
  "expo_detail": false,
  "sales": true,
  "logs": false,
  "intelligence": false,
  "system": false,
  "users": false,
  "settings": false
}'::jsonb WHERE role = 'agent';
