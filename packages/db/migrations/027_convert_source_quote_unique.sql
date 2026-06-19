-- Migration 027: Convert core — partial UNIQUE index on contracts.source_quote_id
--
-- Race-proof duplicate guard for the convert endpoint: at most one contract per source quote.
-- The endpoint also does a SELECT pre-check; this index makes it safe under concurrency
-- (two simultaneous converts of the same quote → one wins, the other hits 23505 → 409).
--
-- DEPENDS ON migration 026 (which adds the contracts.source_quote_id column). Apply 026 FIRST.
-- All existing contracts have source_quote_id = NULL (column added empty by 026, never written
-- until convert) → the partial index (WHERE source_quote_id IS NOT NULL) cannot conflict with
-- current data (3,536 rows, all NULL).
--
-- Idempotent: IF NOT EXISTS.
--
-- APPLY (Suer, own terminal):
--   Dry-run : sed 's/^COMMIT;$/ROLLBACK;/' packages/db/migrations/027_convert_source_quote_unique.sql | psql "$DATABASE_URL"
--   Real run: psql "$DATABASE_URL" -f packages/db/migrations/027_convert_source_quote_unique.sql

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_source_quote_id_unique
  ON contracts (source_quote_id) WHERE source_quote_id IS NOT NULL;

COMMIT;
