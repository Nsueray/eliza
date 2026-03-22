-- Migration 016: Payment currency tracking
-- Add currency info to contract_payments so local currency amounts are preserved
-- alongside the EUR conversion.

-- Add amount_local and currency to contract_payments
ALTER TABLE contract_payments ADD COLUMN IF NOT EXISTS amount_local DECIMAL(12,2);
ALTER TABLE contract_payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'EUR';
