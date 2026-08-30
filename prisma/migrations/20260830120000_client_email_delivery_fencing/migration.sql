-- Booking communication generations fence claimed client e-mails against
-- contact/service/time mutations. The lease is a short-lived persisted fence,
-- not a transaction lock held across provider HTTP.
ALTER TABLE "Booking"
ADD COLUMN IF NOT EXISTS "communicationGeneration" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "clientDeliveryLeaseToken" TEXT,
ADD COLUMN IF NOT EXISTS "clientDeliveryLeaseExpiresAt" TIMESTAMP(3);

ALTER TABLE "EmailLog"
ADD COLUMN IF NOT EXISTS "communicationGeneration" INTEGER NOT NULL DEFAULT 1;

-- Logs created before fencing have no trustworthy generation by default. Keep
-- them fail-closed, then selectively restore only rows whose canonical
-- payload proves the current booking identity, recipient, service, term and
-- lifecycle. A bookingId relation alone is deliberately insufficient.
UPDATE "EmailLog"
SET "communicationGeneration" = 0
WHERE "bookingId" IS NOT NULL
  AND "status" IN ('PENDING', 'FAILED');

UPDATE "EmailLog" AS email_log
SET "communicationGeneration" = booking."communicationGeneration"
FROM "Booking" AS booking
WHERE email_log."bookingId" = booking."id"
  AND email_log."audience" = 'CLIENT'::"EmailAudience"
  AND email_log."status" IN ('PENDING', 'FAILED')
  AND trim(email_log."recipientEmail") = trim(booking."clientEmailSnapshot")
  AND jsonb_typeof(email_log."payload") = 'object'
  AND email_log."payload"->>'bookingId' = booking."id"
  AND email_log."payload"->>'serviceId' = booking."serviceId"
  AND email_log."payload"->>'scheduledStartsAt' = to_char(
    booking."scheduledStartsAt",
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  )
  AND email_log."payload"->>'scheduledEndsAt' = to_char(
    booking."scheduledEndsAt",
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  )
  AND (
    (
      email_log."type" = 'BOOKING_RECEIVED'::"EmailLogType"
      AND email_log."templateKey" = 'booking-confirmation-v1'
      AND booking."status" = 'PENDING'::"BookingStatus"
    )
    OR (
      email_log."type" = 'BOOKING_CONFIRMED'::"EmailLogType"
      AND email_log."templateKey" = 'booking-approved-v1'
      AND booking."status" = 'CONFIRMED'::"BookingStatus"
    )
    OR (
      email_log."type" = 'BOOKING_REMINDER'::"EmailLogType"
      AND email_log."templateKey" = 'booking-reminder-24h-v1'
      AND booking."status" = 'CONFIRMED'::"BookingStatus"
      AND booking."reminder24hSentAt" IS NULL
    )
    OR (
      email_log."type" = 'BOOKING_CANCELLED'::"EmailLogType"
      AND email_log."templateKey" IN ('booking-cancelled-v1', 'booking-rejected-v1')
      AND booking."status" = 'CANCELLED'::"BookingStatus"
    )
    OR (
      email_log."type" = 'BOOKING_RESCHEDULED'::"EmailLogType"
      AND email_log."templateKey" = 'booking-rescheduled-v1'
      AND booking."status" IN ('PENDING'::"BookingStatus", 'CONFIRMED'::"BookingStatus")
    )
  );

CREATE INDEX IF NOT EXISTS "Booking_clientDeliveryLeaseExpiresAt_idx"
  ON "Booking"("clientDeliveryLeaseExpiresAt");
