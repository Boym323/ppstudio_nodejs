-- Add manual booking metadata and replace role-based source enum with channel-based origin values.

ALTER TABLE "Booking"
ADD COLUMN "isManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "manualOverride" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Booking"
SET "isManual" = true
WHERE "source"::text IN ('OWNER_ADMIN', 'SALON_ADMIN');

ALTER TYPE "BookingSource" RENAME TO "BookingSource_old";

CREATE TYPE "BookingSource" AS ENUM ('WEB', 'PHONE', 'INSTAGRAM', 'IN_PERSON', 'OTHER');

ALTER TABLE "Booking"
ALTER COLUMN "source" DROP DEFAULT,
ALTER COLUMN "source" TYPE "BookingSource"
USING (
  CASE
    WHEN "source"::text = 'PUBLIC_WEB' THEN 'WEB'::"BookingSource"
    WHEN "source"::text = 'OWNER_ADMIN' THEN 'OTHER'::"BookingSource"
    WHEN "source"::text = 'SALON_ADMIN' THEN 'OTHER'::"BookingSource"
    ELSE 'OTHER'::"BookingSource"
  END
),
ALTER COLUMN "source" SET DEFAULT 'WEB';

DROP TYPE "BookingSource_old";
