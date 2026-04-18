-- CreateEnum
CREATE TYPE "AvailabilitySlotStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('PUBLIC_WEB', 'OWNER_ADMIN', 'SALON_ADMIN');

-- CreateEnum
CREATE TYPE "BookingActorType" AS ENUM ('USER', 'CLIENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "BookingActionTokenType" AS ENUM ('CANCEL', 'RESCHEDULE');

-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailLogType" AS ENUM ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED', 'BOOKING_REMINDER', 'GENERIC');

-- Preserve existing users while renaming the lite role to SALON.
BEGIN;
CREATE TYPE "AdminRole_new" AS ENUM ('OWNER', 'SALON');
ALTER TABLE "AdminUser" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "AdminUser" ALTER COLUMN "role" TYPE TEXT USING ("role"::TEXT);
UPDATE "AdminUser" SET "role" = 'SALON' WHERE "role" = 'STAFF';
ALTER TABLE "AdminUser" ALTER COLUMN "role" TYPE "AdminRole_new" USING ("role"::"AdminRole_new");
ALTER TYPE "AdminRole" RENAME TO "AdminRole_old";
ALTER TYPE "AdminRole_new" RENAME TO "AdminRole";
DROP TYPE "AdminRole_old";
COMMIT;

-- Extend booking statuses without dropping existing booking rows.
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');
ALTER TABLE "BookingRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BookingRequest" ALTER COLUMN "status" TYPE TEXT USING ("status"::TEXT);
ALTER TABLE "BookingRequest" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::"BookingStatus_new");
ALTER TABLE "BookingRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "BookingStatus_old";
COMMIT;

-- Extend existing catalog and user tables.
ALTER TABLE "AdminUser" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "ServiceCategory" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Service" ADD COLUMN "description" TEXT;
ALTER TABLE "Service" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- New tables.
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "internalNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastBookedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AvailabilitySlotService" (
    "slotId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySlotService_pkey" PRIMARY KEY ("slotId", "serviceId")
);

CREATE TABLE "BookingStatusHistory" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "actorType" "BookingActorType" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingActionToken" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "BookingActionTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingActionToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "clientId" TEXT,
    "actionTokenId" TEXT,
    "type" "EmailLogType" NOT NULL,
    "status" "EmailLogStatus" NOT NULL DEFAULT 'PENDING',
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "payload" JSONB,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- Backfill slot-service restrictions from the legacy single-service relation.
INSERT INTO "AvailabilitySlotService" ("slotId", "serviceId", "createdAt", "updatedAt")
SELECT "id", "serviceId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "AvailabilitySlot"
WHERE "serviceId" IS NOT NULL;

-- Create clients from historic bookings before reshaping bookings.
INSERT INTO "Client" ("id", "fullName", "email", "phone", "createdAt", "updatedAt", "lastBookedAt")
SELECT
    'client_' || md5(lower(source."customerEmail")) AS "id",
    source."customerName" AS "fullName",
    lower(source."customerEmail") AS "email",
    source."customerPhone" AS "phone",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    latest."lastBookedAt"
FROM (
    SELECT DISTINCT ON (lower("customerEmail"))
        "customerEmail",
        "customerName",
        "customerPhone",
        "createdAt"
    FROM "BookingRequest"
    ORDER BY lower("customerEmail"), "createdAt" DESC
) AS source
JOIN (
    SELECT lower("customerEmail") AS "email", MAX("createdAt") AS "lastBookedAt"
    FROM "BookingRequest"
    GROUP BY lower("customerEmail")
) AS latest
    ON latest."email" = lower(source."customerEmail");

-- AvailabilitySlot becomes the primary manually managed availability entity.
ALTER TABLE "AvailabilitySlot" RENAME COLUMN "note" TO "publicNote";
ALTER TABLE "AvailabilitySlot" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "AvailabilitySlot" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "AvailabilitySlot" ADD COLUMN "internalNote" TEXT;
ALTER TABLE "AvailabilitySlot" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "AvailabilitySlot" ADD COLUMN "status" "AvailabilitySlotStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "AvailabilitySlot"
SET
    "status" = CASE WHEN "published" THEN 'PUBLISHED'::"AvailabilitySlotStatus" ELSE 'DRAFT'::"AvailabilitySlotStatus" END,
    "publishedAt" = CASE WHEN "published" THEN "createdAt" ELSE NULL END;

ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT "AvailabilitySlot_serviceId_fkey";
DROP INDEX "AvailabilitySlot_startsAt_published_idx";
DROP INDEX "AvailabilitySlot_serviceId_idx";
ALTER TABLE "AvailabilitySlot" DROP COLUMN "published";
ALTER TABLE "AvailabilitySlot" DROP COLUMN "serviceId";

-- Reshape bookings in place so existing requests survive as real bookings.
ALTER TABLE "BookingRequest" RENAME TO "Booking";
ALTER TABLE "Booking" RENAME COLUMN "customerName" TO "clientNameSnapshot";
ALTER TABLE "Booking" RENAME COLUMN "customerEmail" TO "clientEmailSnapshot";
ALTER TABLE "Booking" RENAME COLUMN "customerPhone" TO "clientPhoneSnapshot";
ALTER TABLE "Booking" RENAME COLUMN "note" TO "clientNote";

ALTER TABLE "Booking" DROP CONSTRAINT "BookingRequest_slotId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT "BookingRequest_serviceId_fkey";
DROP INDEX "BookingRequest_slotId_status_idx";
DROP INDEX "BookingRequest_customerEmail_idx";

ALTER TABLE "Booking"
    ADD COLUMN "clientId" TEXT,
    ADD COLUMN "source" "BookingSource" NOT NULL DEFAULT 'PUBLIC_WEB',
    ADD COLUMN "serviceNameSnapshot" TEXT,
    ADD COLUMN "serviceDurationMinutes" INTEGER,
    ADD COLUMN "servicePriceFromCzk" INTEGER,
    ADD COLUMN "scheduledStartsAt" TIMESTAMP(3),
    ADD COLUMN "scheduledEndsAt" TIMESTAMP(3),
    ADD COLUMN "internalNote" TEXT,
    ADD COLUMN "confirmedAt" TIMESTAMP(3),
    ADD COLUMN "cancelledAt" TIMESTAMP(3),
    ADD COLUMN "completedAt" TIMESTAMP(3),
    ADD COLUMN "createdByUserId" TEXT;

UPDATE "Booking" AS booking
SET
    "clientId" = 'client_' || md5(lower(booking."clientEmailSnapshot")),
    "clientEmailSnapshot" = lower(booking."clientEmailSnapshot"),
    "serviceId" = COALESCE(booking."serviceId", (
        SELECT legacy."serviceId"
        FROM "AvailabilitySlotService" AS legacy
        WHERE legacy."slotId" = slot."id"
        ORDER BY legacy."createdAt" ASC
        LIMIT 1
    )),
    "serviceNameSnapshot" = service."name",
    "serviceDurationMinutes" = service."durationMinutes",
    "servicePriceFromCzk" = service."priceFromCzk",
    "scheduledStartsAt" = slot."startsAt",
    "scheduledEndsAt" = slot."endsAt",
    "confirmedAt" = CASE WHEN booking."status" = 'CONFIRMED' THEN booking."updatedAt" ELSE NULL END,
    "cancelledAt" = CASE WHEN booking."status" = 'CANCELLED' THEN booking."updatedAt" ELSE NULL END,
    "completedAt" = CASE WHEN booking."status" = 'COMPLETED' THEN booking."updatedAt" ELSE NULL END
FROM "AvailabilitySlot" AS slot,
     "Service" AS service
WHERE slot."id" = booking."slotId"
  AND service."id" = COALESCE(booking."serviceId", (
      SELECT legacy."serviceId"
      FROM "AvailabilitySlotService" AS legacy
      WHERE legacy."slotId" = slot."id"
      ORDER BY legacy."createdAt" ASC
      LIMIT 1
  ));

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Booking"
        WHERE "clientId" IS NULL
           OR "serviceId" IS NULL
           OR "serviceNameSnapshot" IS NULL
           OR "serviceDurationMinutes" IS NULL
           OR "scheduledStartsAt" IS NULL
           OR "scheduledEndsAt" IS NULL
    ) THEN
        RAISE EXCEPTION 'Booking migration requires every legacy booking to resolve client, service and schedule snapshots.';
    END IF;
END $$;

ALTER TABLE "Booking" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "serviceId" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "serviceNameSnapshot" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "serviceDurationMinutes" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "scheduledStartsAt" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "scheduledEndsAt" SET NOT NULL;

INSERT INTO "BookingStatusHistory" ("id", "bookingId", "status", "actorType", "reason", "createdAt", "updatedAt")
SELECT
    'history_' || md5("id" || ':initial') AS "id",
    "id" AS "bookingId",
    "status",
    'SYSTEM'::"BookingActorType" AS "actorType",
    'Imported from bootstrap booking schema' AS "reason",
    "createdAt",
    "updatedAt"
FROM "Booking";

-- Indexes.
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");
CREATE INDEX "Client_phone_idx" ON "Client"("phone");
CREATE INDEX "Client_isActive_fullName_idx" ON "Client"("isActive", "fullName");

CREATE INDEX "ServiceCategory_isActive_sortOrder_idx" ON "ServiceCategory"("isActive", "sortOrder");
DROP INDEX "Service_categoryId_idx";
CREATE INDEX "Service_categoryId_isActive_sortOrder_idx" ON "Service"("categoryId", "isActive", "sortOrder");
CREATE INDEX "Service_isActive_sortOrder_idx" ON "Service"("isActive", "sortOrder");

CREATE INDEX "AvailabilitySlot_status_startsAt_idx" ON "AvailabilitySlot"("status", "startsAt");
CREATE INDEX "AvailabilitySlot_startsAt_endsAt_idx" ON "AvailabilitySlot"("startsAt", "endsAt");
CREATE INDEX "AvailabilitySlot_createdByUserId_idx" ON "AvailabilitySlot"("createdByUserId");
CREATE INDEX "AvailabilitySlotService_serviceId_slotId_idx" ON "AvailabilitySlotService"("serviceId", "slotId");

CREATE INDEX "Booking_slotId_status_idx" ON "Booking"("slotId", "status");
CREATE INDEX "Booking_clientId_createdAt_idx" ON "Booking"("clientId", "createdAt");
CREATE INDEX "Booking_serviceId_scheduledStartsAt_idx" ON "Booking"("serviceId", "scheduledStartsAt");
CREATE INDEX "Booking_status_scheduledStartsAt_idx" ON "Booking"("status", "scheduledStartsAt");
CREATE INDEX "Booking_createdByUserId_idx" ON "Booking"("createdByUserId");

CREATE INDEX "BookingStatusHistory_bookingId_createdAt_idx" ON "BookingStatusHistory"("bookingId", "createdAt");
CREATE INDEX "BookingStatusHistory_actorUserId_createdAt_idx" ON "BookingStatusHistory"("actorUserId", "createdAt");

CREATE UNIQUE INDEX "BookingActionToken_tokenHash_key" ON "BookingActionToken"("tokenHash");
CREATE INDEX "BookingActionToken_bookingId_type_expiresAt_idx" ON "BookingActionToken"("bookingId", "type", "expiresAt");
CREATE INDEX "BookingActionToken_expiresAt_idx" ON "BookingActionToken"("expiresAt");

CREATE INDEX "EmailLog_bookingId_createdAt_idx" ON "EmailLog"("bookingId", "createdAt");
CREATE INDEX "EmailLog_clientId_createdAt_idx" ON "EmailLog"("clientId", "createdAt");
CREATE INDEX "EmailLog_actionTokenId_createdAt_idx" ON "EmailLog"("actionTokenId", "createdAt");
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");
CREATE INDEX "EmailLog_providerMessageId_idx" ON "EmailLog"("providerMessageId");

CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");
CREATE INDEX "Setting_updatedByUserId_idx" ON "Setting"("updatedByUserId");

-- Foreign keys.
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AvailabilitySlotService" ADD CONSTRAINT "AvailabilitySlotService_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AvailabilitySlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilitySlotService" ADD CONSTRAINT "AvailabilitySlotService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AvailabilitySlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingActionToken" ADD CONSTRAINT "BookingActionToken_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_actionTokenId_fkey" FOREIGN KEY ("actionTokenId") REFERENCES "BookingActionToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Setting" ADD CONSTRAINT "Setting_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Database-level guards for obviously invalid records.
ALTER TABLE "Service" ADD CONSTRAINT "Service_durationMinutes_positive" CHECK ("durationMinutes" > 0);
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_capacity_positive" CHECK ("capacity" > 0);
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_time_order" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_schedule_time_order" CHECK ("scheduledEndsAt" > "scheduledStartsAt");
