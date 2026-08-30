-- Keep active client self-service links aligned with the current booking term.
UPDATE "BookingActionToken" AS token
SET "expiresAt" = booking."scheduledStartsAt" + interval '2 hours'
FROM "Booking" AS booking
WHERE token."bookingId" = booking."id"
  AND token."type" IN ('RESCHEDULE', 'CANCEL')
  AND token."usedAt" IS NULL
  AND token."revokedAt" IS NULL
  AND token."expiresAt" > CURRENT_TIMESTAMP
  AND booking."status" IN ('PENDING', 'CONFIRMED')
  AND booking."scheduledStartsAt" > CURRENT_TIMESTAMP
  AND token."expiresAt" IS DISTINCT FROM booking."scheduledStartsAt" + interval '2 hours';
