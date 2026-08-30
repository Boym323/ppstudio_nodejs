-- Booking communication generations fence claimed client e-mails against
-- contact/service/time mutations. The lease is a short-lived persisted fence,
-- not a transaction lock held across provider HTTP.
ALTER TABLE "Booking"
ADD COLUMN IF NOT EXISTS "communicationGeneration" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "clientDeliveryLeaseToken" TEXT,
ADD COLUMN IF NOT EXISTS "clientDeliveryLeaseExpiresAt" TIMESTAMP(3);

ALTER TABLE "EmailLog"
ADD COLUMN IF NOT EXISTS "communicationGeneration" INTEGER NOT NULL DEFAULT 1;

-- Logs created before fencing have no trustworthy generation. Keep them
-- retryable for inspection, but make the new worker system-skip them instead
-- of granting them a false current-generation authorization.
UPDATE "EmailLog"
SET "communicationGeneration" = 0
WHERE "bookingId" IS NOT NULL
  AND "status" IN ('PENDING', 'FAILED');

CREATE INDEX IF NOT EXISTS "Booking_clientDeliveryLeaseExpiresAt_idx"
  ON "Booking"("clientDeliveryLeaseExpiresAt");
