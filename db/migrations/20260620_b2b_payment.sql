-- =============================================================
-- 20260620_b2b_payment.sql
-- Adds B2B payment tracking columns to the Order table.
--
-- Tracks the lifecycle of a B2B order's payment independently of
-- the procurement workflow status (which the ops team still owns).
--   - paymentStatus : UNPAID | PENDING | PAID | FAILED | REFUNDED
--   - paymentMethod : PREPAID (Chapa) | CREDIT | BANK_TRANSFER | ...
--   - chapaPaymentId: Chapa transaction reference returned on verify
--
-- Uses `text` (app-enforced values) instead of a new enum type to
-- avoid ALTER TYPE migration risk on live databases. Idempotent
-- (IF NOT EXISTS) so re-runs are safe.
-- =============================================================

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentStatus"  text NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod"  text;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "chapaPaymentId" text;
