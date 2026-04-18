-- Make slot restriction intent explicit.
CREATE TYPE "AvailabilitySlotServiceRestrictionMode" AS ENUM ('ANY', 'SELECTED');

ALTER TABLE "AvailabilitySlot"
ADD COLUMN "serviceRestrictionMode" "AvailabilitySlotServiceRestrictionMode" NOT NULL DEFAULT 'ANY';

UPDATE "AvailabilitySlot"
SET "serviceRestrictionMode" = 'SELECTED'
WHERE EXISTS (
    SELECT 1
    FROM "AvailabilitySlotService" AS ass
    WHERE ass."slotId" = "AvailabilitySlot"."id"
);

CREATE INDEX "AvailabilitySlot_serviceRestrictionMode_startsAt_idx"
ON "AvailabilitySlot"("serviceRestrictionMode", "startsAt");

-- Track reschedule chains for reporting and operations.
ALTER TABLE "Booking"
ADD COLUMN "rescheduledAt" TIMESTAMP(3),
ADD COLUMN "rescheduledFromBookingId" TEXT;

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_rescheduledFromBookingId_fkey"
FOREIGN KEY ("rescheduledFromBookingId") REFERENCES "Booking"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Booking_rescheduledFromBookingId_key"
ON "Booking"("rescheduledFromBookingId");

CREATE INDEX "Booking_source_createdAt_idx"
ON "Booking"("source", "createdAt");

CREATE INDEX "Booking_rescheduledAt_idx"
ON "Booking"("rescheduledAt");

-- Reject existing duplicate bookings of the same client into the same slot before enforcing uniqueness.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Booking"
        GROUP BY "slotId", "clientId"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot add Booking(slotId, clientId) uniqueness because duplicate bookings already exist.';
    END IF;
END $$;

CREATE UNIQUE INDEX "Booking_slotId_clientId_key"
ON "Booking"("slotId", "clientId");

-- Prevent overlapping active slots at the database level.
ALTER TABLE "AvailabilitySlot"
ADD CONSTRAINT "AvailabilitySlot_active_time_window_excl"
EXCLUDE USING GIST (
    tsrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE ("status" IN ('DRAFT', 'PUBLISHED'));
