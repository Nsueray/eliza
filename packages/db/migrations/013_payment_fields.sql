-- Migration 013: Payment fields, received payments, payment schedule, outstanding balances view
-- Sprint 1A of Finance Module

-- ═══════════════════════════════════════
-- 2a. contracts — new payment columns
-- ═══════════════════════════════════════
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS balance_eur DECIMAL(12,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS paid_eur DECIMAL(12,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS remaining_payment_eur DECIMAL(12,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payment_done BOOLEAN;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS validity TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS first_payment_eur DECIMAL(12,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS second_payment_eur DECIMAL(12,2);

-- ═══════════════════════════════════════
-- 2b. contract_payments — received payments (Zoho Received_Payment subform)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS contract_payments (
  id SERIAL PRIMARY KEY,
  contract_id INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  af_number TEXT NOT NULL,
  payment_date DATE,
  amount_eur DECIMAL(12,2),
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_payments_contract_id ON contract_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_af_number ON contract_payments(af_number);
CREATE INDEX IF NOT EXISTS idx_contract_payments_payment_date ON contract_payments(payment_date);

-- ═══════════════════════════════════════
-- 2c. contract_payment_schedule — planned payments
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS contract_payment_schedule (
  id SERIAL PRIMARY KEY,
  contract_id INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  af_number TEXT NOT NULL,
  installment_no INT,
  due_date DATE,
  planned_amount_eur DECIMAL(12,2),
  payment_type TEXT, -- deposit / installment / final
  note TEXT,
  source_field TEXT, -- which Zoho field this came from
  is_synthetic BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_payment_schedule_contract_id ON contract_payment_schedule(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_payment_schedule_af_number ON contract_payment_schedule(af_number);
CREATE INDEX IF NOT EXISTS idx_contract_payment_schedule_due_date ON contract_payment_schedule(due_date);

-- ═══════════════════════════════════════
-- 2d. outstanding_balances view
-- ═══════════════════════════════════════
CREATE OR REPLACE VIEW outstanding_balances AS
SELECT
  c.id, c.af_number, c.company_name, c.country,
  c.sales_agent, c.sales_type,
  e.name AS expo_name, e.country AS expo_country,
  e.start_date AS expo_start_date,
  c.contract_date,
  -- Finance fields (all EUR)
  c.revenue_eur AS contract_total_eur,
  COALESCE(c.paid_eur, 0) AS paid_eur,
  COALESCE(c.balance_eur, c.revenue_eur - COALESCE(c.paid_eur, 0)) AS balance_eur,
  c.due_date,
  c.payment_done,
  -- Calculated date fields
  CASE WHEN c.due_date < CURRENT_DATE AND COALESCE(c.balance_eur, 0) > 0 THEN true ELSE false END AS is_overdue,
  CASE WHEN c.due_date IS NOT NULL THEN GREATEST(c.due_date - CURRENT_DATE, 0) ELSE NULL END AS days_to_due,
  CASE WHEN c.due_date < CURRENT_DATE THEN CURRENT_DATE - c.due_date ELSE 0 END AS days_overdue,
  CASE WHEN e.start_date IS NOT NULL THEN GREATEST(e.start_date::date - CURRENT_DATE, 0) ELSE NULL END AS days_to_expo,
  -- Payment percentages
  CASE WHEN c.revenue_eur > 0 THEN ROUND((COALESCE(c.paid_eur, 0) / c.revenue_eur * 100)::numeric, 1) ELSE 0 END AS paid_percent,
  -- First and last payment dates
  (SELECT MIN(cp.payment_date) FROM contract_payments cp WHERE cp.contract_id = c.id) AS first_payment_date,
  (SELECT MAX(cp.payment_date) FROM contract_payments cp WHERE cp.contract_id = c.id) AS last_payment_date,
  -- Collection stage
  CASE
    WHEN c.payment_done = true THEN 'paid_complete'
    WHEN COALESCE(c.paid_eur, 0) = 0 AND COALESCE(c.first_payment_eur, 0) > 0 THEN 'deposit_missing'
    WHEN COALESCE(c.paid_eur, 0) = 0 THEN 'no_payment'
    WHEN c.due_date < CURRENT_DATE AND COALESCE(c.balance_eur, 0) > 0 THEN 'overdue'
    WHEN e.start_date IS NOT NULL AND (e.start_date::date - CURRENT_DATE) < 45 AND COALESCE(c.balance_eur, 0) > 0 THEN 'pre_event_balance_open'
    WHEN COALESCE(c.paid_eur, 0) > 0 AND COALESCE(c.balance_eur, 0) > 0 THEN 'partial_paid'
    ELSE 'ok'
  END AS collection_stage,
  -- Dual-axis risk score
  -- Axis 1: Collection risk (overdue + amount + payment status)
  (
    CASE WHEN COALESCE(c.paid_eur, 0) = 0 THEN 3 ELSE 0 END +
    CASE WHEN c.due_date < CURRENT_DATE THEN LEAST((CURRENT_DATE - c.due_date) / 15, 4) ELSE 0 END +
    CASE WHEN COALESCE(c.balance_eur, 0) > 10000 THEN 2 WHEN COALESCE(c.balance_eur, 0) > 5000 THEN 1 ELSE 0 END
  ) AS collection_risk_score,
  -- Axis 2: Event risk (proximity to event + contract size)
  (
    CASE WHEN e.start_date IS NOT NULL AND (e.start_date::date - CURRENT_DATE) < 30 THEN 4
         WHEN e.start_date IS NOT NULL AND (e.start_date::date - CURRENT_DATE) < 60 THEN 3
         WHEN e.start_date IS NOT NULL AND (e.start_date::date - CURRENT_DATE) < 90 THEN 2
         ELSE 0 END +
    CASE WHEN c.revenue_eur > 20000 THEN 2 WHEN c.revenue_eur > 10000 THEN 1 ELSE 0 END
  ) AS event_risk_score
FROM contracts c
JOIN expos e ON c.expo_id = e.id
WHERE c.status IN ('Valid', 'Transferred In')
  AND COALESCE(c.balance_eur, 0) > 0
  AND c.payment_done IS NOT TRUE;
