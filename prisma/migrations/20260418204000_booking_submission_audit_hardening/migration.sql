CREATE TYPE "BookingSubmissionOutcome" AS ENUM ('SUCCESS', 'FAILED', 'BLOCKED');

CREATE TABLE "BookingSubmissionLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "clientId" TEXT,
    "serviceId" TEXT,
    "slotId" TEXT,
    "ipHash" TEXT,
    "emailHash" TEXT,
    "outcome" "BookingSubmissionOutcome" NOT NULL,
    "failureCode" TEXT,
    "failureReason" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSubmissionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingSubmissionLog_bookingId_createdAt_idx" ON "BookingSubmissionLog"("bookingId", "createdAt");
CREATE INDEX "BookingSubmissionLog_clientId_createdAt_idx" ON "BookingSubmissionLog"("clientId", "createdAt");
CREATE INDEX "BookingSubmissionLog_serviceId_createdAt_idx" ON "BookingSubmissionLog"("serviceId", "createdAt");
CREATE INDEX "BookingSubmissionLog_slotId_createdAt_idx" ON "BookingSubmissionLog"("slotId", "createdAt");
CREATE INDEX "BookingSubmissionLog_ipHash_createdAt_idx" ON "BookingSubmissionLog"("ipHash", "createdAt");
CREATE INDEX "BookingSubmissionLog_emailHash_createdAt_idx" ON "BookingSubmissionLog"("emailHash", "createdAt");
CREATE INDEX "BookingSubmissionLog_outcome_createdAt_idx" ON "BookingSubmissionLog"("outcome", "createdAt");

ALTER TABLE "BookingSubmissionLog" ADD CONSTRAINT "BookingSubmissionLog_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingSubmissionLog" ADD CONSTRAINT "BookingSubmissionLog_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingSubmissionLog" ADD CONSTRAINT "BookingSubmissionLog_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingSubmissionLog" ADD CONSTRAINT "BookingSubmissionLog_slotId_fkey"
FOREIGN KEY ("slotId") REFERENCES "AvailabilitySlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
