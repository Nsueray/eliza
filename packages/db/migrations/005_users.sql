-- Migration 005: Multi-user system
-- Users + permissions tables

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  whatsapp_phone VARCHAR(20) UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'agent',
  office VARCHAR(50),
  sales_group VARCHAR(50),
  sales_agent_name VARCHAR(100),
  is_manager BOOLEAN DEFAULT false,
  language VARCHAR(5) DEFAULT 'tr',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  data_scope VARCHAR(20) DEFAULT 'own',
  visible_years INTEGER[] DEFAULT '{2025,2026}',
  can_see_expenses BOOLEAN DEFAULT false,
  can_take_notes BOOLEAN DEFAULT false,
  can_use_message_generator BOOLEAN DEFAULT false,
  can_see_financials BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CEO default user
INSERT INTO users (name, email, whatsapp_phone, role, office, sales_group, sales_agent_name, is_manager, language)
VALUES ('Nihat Suer AY', 'suer@elan-expo.com', '+905332095377', 'ceo', 'International', 'International', null, true, 'tr');

INSERT INTO user_permissions (user_id, data_scope, visible_years, can_see_expenses, can_take_notes, can_use_message_generator, can_see_financials)
VALUES (1, 'all', '{2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026}', true, true, true, true);
