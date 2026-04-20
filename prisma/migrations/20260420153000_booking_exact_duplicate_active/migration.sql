-- Replace broad per-client-per-slot uniqueness with exact-interval duplicate protection for active bookings only.
DROP INDEX IF EXISTS "Booking_slotId_clientId_key";

CREATE UNIQUE INDEX "Booking_exact_duplicate_active_key"
ON "Booking" ("slotId", "clientId", "scheduledStartsAt", "scheduledEndsAt")
WHERE "status" IN ('PENDING', 'CONFIRMED');
