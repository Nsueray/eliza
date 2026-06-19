-- Migration 028: re-type contracts.converted_by_user_id from UUID → INTEGER.
--
-- WHY: migration 026 added converted_by_user_id as UUID (anticipating a future ELL unified
-- UUID identity). But ELIZA users.id is INTEGER today and contracts has NO native audit/owner
-- column (measured: only created_at/updated_at). To record the real convert actor now (not a
-- UUID-NULL placeholder), the column must be INTEGER.
--
-- SAFE: the column is empty — it was added by 026 and is only ever written by the convert
-- endpoint, which has not run in production. USING NULL discards (already-NULL) values, so there
-- is no data loss. (UUID→INTEGER has no real cast anyway.)
--
-- DEPENDS ON migration 026 (which creates the column). Apply 026 → 027 → 028 in order.
-- Idempotent: guarded so re-running after the column is already INTEGER is a no-op.
--
-- APPLY (Suer, own terminal):
--   Dry-run : sed 's/^COMMIT;$/ROLLBACK;/' packages/db/migrations/028_convert_audit_integer.sql | psql "$DATABASE_URL"
--   Real run: psql "$DATABASE_URL" -f packages/db/migrations/028_convert_audit_integer.sql

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts'
      AND column_name = 'converted_by_user_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE contracts ALTER COLUMN converted_by_user_id TYPE INTEGER USING NULL;
  END IF;
END $$;

COMMIT;
