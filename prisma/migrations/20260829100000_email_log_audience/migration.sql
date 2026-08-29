-- CreateEnum (the enum may already exist after a partially applied deployment).
DO $$
BEGIN
  CREATE TYPE "EmailAudience" AS ENUM ('CLIENT', 'ADMIN', 'EXTERNAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add the conservative default first so existing rows and rolling deployments remain valid.
ALTER TABLE "EmailLog"
ADD COLUMN IF NOT EXISTS "audience" "EmailAudience" NOT NULL DEFAULT 'EXTERNAL';

-- Only templates with an unambiguous recipient purpose are classified as client or admin.
UPDATE "EmailLog"
SET "audience" = 'ADMIN'::"EmailAudience"
WHERE "templateKey" IN (
  'admin-booking-notification-v1',
  'admin-booking-cancelled-v1',
  'admin-booking-rescheduled-v1'
);

UPDATE "EmailLog"
SET "audience" = 'CLIENT'::"EmailAudience"
WHERE "templateKey" IN (
  'booking-confirmation-v1',
  'booking-approved-v1',
  'booking-rejected-v1',
  'booking-cancelled-v1',
  'booking-rescheduled-v1',
  'booking-reminder-24h-v1'
);

-- voucher-sent-v1 and unknown/ambiguous historical records intentionally remain EXTERNAL.
