-- ELL Reference Data: Currencies (ISO 4217)
-- Owner: ELIZA. Read by LiFTY, LEENA.
-- Ref: ELL_RULES.md v4 — R1, R9, ADR-016

CREATE TABLE IF NOT EXISTS core_currencies (
  code CHAR(3) PRIMARY KEY,
  name_en VARCHAR(50) NOT NULL,
  symbol VARCHAR(5),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO core_currencies (code, name_en, symbol) VALUES
  ('EUR', 'Euro', '€'),
  ('USD', 'US Dollar', '$'),
  ('TRY', 'Turkish Lira', '₺'),
  ('NGN', 'Nigerian Naira', '₦'),
  ('MAD', 'Moroccan Dirham', 'DH'),
  ('KES', 'Kenyan Shilling', 'KSh'),
  ('DZD', 'Algerian Dinar', 'DA'),
  ('GHS', 'Ghanaian Cedi', 'GH₵'),
  ('GBP', 'British Pound', '£'),
  ('CHF', 'Swiss Franc', 'CHF'),
  ('CNY', 'Chinese Yuan', '¥'),
  ('JPY', 'Japanese Yen', '¥'),
  ('AED', 'UAE Dirham', 'AED'),
  ('SAR', 'Saudi Riyal', 'SR'),
  ('EGP', 'Egyptian Pound', 'E£')
ON CONFLICT (code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  symbol = EXCLUDED.symbol,
  updated_at = NOW();
