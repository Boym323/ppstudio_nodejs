ALTER TABLE "Booking"
ADD COLUMN "reminder24hSentAt" TIMESTAMP(3);

CREATE INDEX "Booking_status_reminder24hSentAt_scheduledStartsAt_idx"
ON "Booking"("status", "reminder24hSentAt", "scheduledStartsAt");
