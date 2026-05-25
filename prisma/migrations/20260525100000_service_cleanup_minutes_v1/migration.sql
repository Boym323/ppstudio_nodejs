-- Add optional internal cleanup time after a service. The value is stored in minutes
-- and is not used by booking availability calculations yet.
ALTER TABLE "Service"
ADD COLUMN "cleanupMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Service"
ADD CONSTRAINT "Service_cleanupMinutes_nonnegative" CHECK ("cleanupMinutes" >= 0);
