-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "finalPriceCzk" INTEGER,
ADD COLUMN "priceAdjustmentReason" TEXT,
ADD COLUMN "priceAdjustedAt" TIMESTAMP(3),
ADD COLUMN "priceAdjustedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Booking_priceAdjustedByUserId_idx" ON "Booking"("priceAdjustedByUserId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_priceAdjustedByUserId_fkey" FOREIGN KEY ("priceAdjustedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
