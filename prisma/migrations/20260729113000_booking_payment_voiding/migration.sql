CREATE TYPE "BookingPaymentStatus" AS ENUM ('ACTIVE', 'VOIDED');

ALTER TABLE "BookingPayment"
  ADD COLUMN "status" "BookingPaymentStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedByUserId" TEXT,
  ADD COLUMN "voidReason" TEXT;

CREATE INDEX "BookingPayment_voidedByUserId_idx" ON "BookingPayment"("voidedByUserId");
CREATE INDEX "BookingPayment_bookingId_status_idx" ON "BookingPayment"("bookingId", "status");

ALTER TABLE "BookingPayment"
  ADD CONSTRAINT "BookingPayment_voidedByUserId_fkey"
  FOREIGN KEY ("voidedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
