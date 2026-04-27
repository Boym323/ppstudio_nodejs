-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('VALUE', 'SERVICE');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PARTIALLY_REDEEMED', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "intendedVoucherCodeSnapshot" TEXT,
ADD COLUMN     "intendedVoucherId" TEXT,
ADD COLUMN     "intendedVoucherValidatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "VoucherType" NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "purchaserName" TEXT,
    "purchaserEmail" TEXT,
    "recipientName" TEXT,
    "message" TEXT,
    "originalValueCzk" INTEGER,
    "remainingValueCzk" INTEGER,
    "serviceId" TEXT,
    "serviceNameSnapshot" TEXT,
    "servicePriceSnapshotCzk" INTEGER,
    "serviceDurationSnapshot" INTEGER,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "internalNote" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherRedemption" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "bookingId" TEXT,
    "amountCzk" INTEGER,
    "serviceId" TEXT,
    "serviceNameSnapshot" TEXT,
    "note" TEXT,
    "redeemedByUserId" TEXT,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoucherRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "Voucher_code_idx" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "Voucher_status_validUntil_idx" ON "Voucher"("status", "validUntil");

-- CreateIndex
CREATE INDEX "Voucher_type_status_idx" ON "Voucher"("type", "status");

-- CreateIndex
CREATE INDEX "Voucher_serviceId_idx" ON "Voucher"("serviceId");

-- CreateIndex
CREATE INDEX "Voucher_createdByUserId_idx" ON "Voucher"("createdByUserId");

-- CreateIndex
CREATE INDEX "VoucherRedemption_voucherId_redeemedAt_idx" ON "VoucherRedemption"("voucherId", "redeemedAt");

-- CreateIndex
CREATE INDEX "VoucherRedemption_bookingId_idx" ON "VoucherRedemption"("bookingId");

-- CreateIndex
CREATE INDEX "VoucherRedemption_serviceId_idx" ON "VoucherRedemption"("serviceId");

-- CreateIndex
CREATE INDEX "VoucherRedemption_redeemedByUserId_redeemedAt_idx" ON "VoucherRedemption"("redeemedByUserId", "redeemedAt");

-- CreateIndex
CREATE INDEX "Booking_intendedVoucherId_idx" ON "Booking"("intendedVoucherId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_intendedVoucherId_fkey" FOREIGN KEY ("intendedVoucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherRedemption" ADD CONSTRAINT "VoucherRedemption_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherRedemption" ADD CONSTRAINT "VoucherRedemption_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherRedemption" ADD CONSTRAINT "VoucherRedemption_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherRedemption" ADD CONSTRAINT "VoucherRedemption_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
