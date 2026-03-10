-- Add timestamps to contracts
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contracts_updated_at ON contracts;
CREATE TRIGGER contracts_updated_at
BEFORE UPDATE ON contracts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Sync log table
CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR(50),
  module VARCHAR(50),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  records_synced INTEGER,
  records_updated INTEGER,
  status VARCHAR(20),
  error_message TEXT
);
