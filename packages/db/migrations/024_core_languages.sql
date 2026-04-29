-- ELL Reference Data: Languages (ISO 639-1)
-- Owner: ELIZA. Read by LiFTY, LEENA.
-- Ref: ELL_RULES.md v4 — R1, R9, ADR-016

CREATE TABLE IF NOT EXISTS core_languages (
  code CHAR(2) PRIMARY KEY,
  name_en VARCHAR(50) NOT NULL,
  name_native VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO core_languages (code, name_en, name_native) VALUES
  ('en', 'English', 'English'),
  ('tr', 'Turkish', 'Türkçe'),
  ('fr', 'French', 'Français'),
  ('ar', 'Arabic', 'العربية'),
  ('es', 'Spanish', 'Español'),
  ('de', 'German', 'Deutsch'),
  ('it', 'Italian', 'Italiano'),
  ('pt', 'Portuguese', 'Português'),
  ('zh', 'Chinese', '中文'),
  ('ja', 'Japanese', '日本語'),
  ('ru', 'Russian', 'Русский')
ON CONFLICT (code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_native = EXCLUDED.name_native,
  updated_at = NOW();
