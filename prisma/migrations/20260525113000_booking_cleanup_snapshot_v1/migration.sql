-- Snapshot cleanup timing values on booking so later service edits do not affect history.
ALTER TABLE "Booking"
ADD COLUMN "cleanupMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cleanupBlockMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "blockedUntil" TIMESTAMP(3);

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_cleanupMinutes_nonnegative" CHECK ("cleanupMinutes" >= 0),
ADD CONSTRAINT "Booking_cleanupBlockMinutes_nonnegative" CHECK ("cleanupBlockMinutes" >= 0);

-- Backfill legacy rows with default behavior (no cleanup block).
UPDATE "Booking"
SET "cleanupMinutes" = 0,
    "cleanupBlockMinutes" = 0,
    "blockedUntil" = "scheduledEndsAt"
WHERE "blockedUntil" IS NULL;
