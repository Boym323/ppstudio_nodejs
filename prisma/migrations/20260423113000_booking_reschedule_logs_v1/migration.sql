ALTER TABLE "Booking"
ADD COLUMN "reminder24hQueuedAt" TIMESTAMP(3),
ADD COLUMN "rescheduleCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Booking_status_reminder24hQueuedAt_scheduledStartsAt_idx"
ON "Booking"("status", "reminder24hQueuedAt", "scheduledStartsAt");

CREATE TABLE "BookingRescheduleLog" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "oldStartAt" TIMESTAMP(3) NOT NULL,
  "oldEndAt" TIMESTAMP(3) NOT NULL,
  "newStartAt" TIMESTAMP(3) NOT NULL,
  "newEndAt" TIMESTAMP(3) NOT NULL,
  "changedByUserId" TEXT,
  "changedByClient" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingRescheduleLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BookingRescheduleLog"
ADD CONSTRAINT "BookingRescheduleLog_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingRescheduleLog"
ADD CONSTRAINT "BookingRescheduleLog_changedByUserId_fkey"
FOREIGN KEY ("changedByUserId") REFERENCES "AdminUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BookingRescheduleLog_bookingId_createdAt_idx"
ON "BookingRescheduleLog"("bookingId", "createdAt");

CREATE INDEX "BookingRescheduleLog_changedByUserId_createdAt_idx"
ON "BookingRescheduleLog"("changedByUserId", "createdAt");
