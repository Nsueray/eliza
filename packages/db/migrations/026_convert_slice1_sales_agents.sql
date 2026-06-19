-- Migration 026: Convert Slice 1 — sales_agents (locked schema) + contract forward-compatible columns
--
-- ADDITIVE + ONE controlled rename. Scope:
--   1. Rename the legacy Zoho-string agent table (109 rows) → sales_agents_legacy.
--   2. Create the new locked sales_agents (UUID + user_id + agent_type). Empty until Slice 3 backfill.
--   3. Add forward-compatible columns to contracts (additive; existing integer FKs / company_name untouched).
--
-- COORDINATED CODE CHANGE (same slice): packages/messages/index.js resolveRecipient() is repointed
-- from `FROM sales_agents` → `FROM sales_agents_legacy` so the `.msg` recipient lookup keeps reading
-- the 109 legacy rows. Apply this migration BEFORE deploying that code change (so the legacy table
-- exists when the new code queries it).
--
-- gen_random_uuid() is a PostgreSQL 13+ core function (ELIZA runs PG18) — NO extension required.
--
-- Idempotent: re-running is safe (guarded rename + IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
--
-- APPLY (Suer, own terminal):
--   Dry-run : sed 's/^COMMIT;$/ROLLBACK;/' packages/db/migrations/026_convert_slice1_sales_agents.sql | psql "$DATABASE_URL"
--   Real run: psql "$DATABASE_URL" -f packages/db/migrations/026_convert_slice1_sales_agents.sql

BEGIN;

-- 1. Rename legacy agent table out of the way (guarded → idempotent).
DO $$
BEGIN
  IF to_regclass('public.sales_agents_legacy') IS NULL
     AND to_regclass('public.sales_agents') IS NOT NULL THEN
    ALTER TABLE sales_agents RENAME TO sales_agents_legacy;
  END IF;
END $$;

-- 2. New locked sales_agents (Convert target). Backfill of the 109 legacy rows is deferred to Slice 3
--    (string-match, same mechanism as company) — intentionally NOT done here.
CREATE TABLE IF NOT EXISTS sales_agents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID,                    -- soft-ref (no FK; ELIZA org is integer today)
  user_id            UUID UNIQUE,             -- locked B3: nullable + UNIQUE; soft-ref (no FK)
  agent_type         TEXT NOT NULL CHECK (agent_type IN ('internal', 'external_agency', 'external_freelance')),
  name               TEXT NOT NULL,
  office             TEXT,
  phone_number       TEXT,                    -- NOT unique (locked: only user_id is unique)
  preferred_language TEXT DEFAULT 'en',
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- 3. Contracts forward-compatible columns (additive only — do NOT touch existing integer FKs,
--    company_name TEXT, scan_link, or commission; those stay as-is / arrive in Slice 3).
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS sales_agent_id       UUID REFERENCES sales_agents(id),  -- in-ELIZA UUID↔UUID REAL FK
  ADD COLUMN IF NOT EXISTS sales_owner_user_id  UUID,        -- soft-ref (cross-DB LIFFY rep; no FK)
  ADD COLUMN IF NOT EXISTS company_id           UUID,        -- soft-ref (cross-DB LIFFY company; no FK)
  ADD COLUMN IF NOT EXISTS source_quote_id      UUID,        -- soft-ref (cross-DB LIFFY quote; no FK)
  ADD COLUMN IF NOT EXISTS converted_by_user_id UUID,        -- soft-ref (convert actor; no FK)
  ADD COLUMN IF NOT EXISTS converted_at         TIMESTAMPTZ;

COMMIT;

-- Verify (after real run):
--   SELECT COUNT(*) FROM sales_agents_legacy;  -- expect 109
--   SELECT COUNT(*) FROM sales_agents;          -- expect 0
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='contracts' AND column_name IN
--       ('sales_agent_id','sales_owner_user_id','company_id','source_quote_id','converted_by_user_id','converted_at');
