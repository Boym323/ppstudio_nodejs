-- CreateEnum
CREATE TYPE "BookingAcquisitionSource" AS ENUM (
  'DIRECT',
  'FACEBOOK',
  'GOOGLE',
  'INSTAGRAM',
  'FIRMY_CZ',
  'OTHER'
);

-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "acquisitionSource" "BookingAcquisitionSource",
  ADD COLUMN "acquisitionReferrerHost" TEXT,
  ADD COLUMN "acquisitionUtmSource" TEXT,
  ADD COLUMN "acquisitionUtmMedium" TEXT,
  ADD COLUMN "acquisitionUtmCampaign" TEXT;

-- CreateIndex
CREATE INDEX "Booking_acquisitionSource_createdAt_idx"
  ON "Booking"("acquisitionSource", "createdAt");
