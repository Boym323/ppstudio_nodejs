-- Preserve existing rows as NULL (legacy), while protecting creates from any
-- application path that might omit the marker after this migration.
BEGIN;
ALTER TABLE "Voucher" ADD COLUMN "renderPolicy" TEXT;
ALTER TABLE "Voucher" ALTER COLUMN "renderPolicy" SET DEFAULT 'STRICT_V1';
COMMIT;
