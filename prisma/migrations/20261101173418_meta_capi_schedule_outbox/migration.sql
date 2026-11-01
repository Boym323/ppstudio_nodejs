-- CreateEnum
CREATE TYPE "MetaConversionEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "acquisitionMtmContent" TEXT,
ADD COLUMN     "acquisitionMtmPlacement" TEXT;

-- CreateTable
CREATE TABLE "MetaConversionEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "eventId" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "eventSourceUrl" TEXT NOT NULL,
    "userAgent" TEXT,
    "fbp" TEXT,
    "fbc" TEXT,
    "status" "MetaConversionEventStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "processingStartedAt" TIMESTAMP(3),
    "processingToken" TEXT,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaConversionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaConversionEvent_bookingId_key" ON "MetaConversionEvent"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaConversionEvent_eventId_key" ON "MetaConversionEvent"("eventId");

-- CreateIndex
CREATE INDEX "MetaConversionEvent_status_nextAttemptAt_createdAt_idx" ON "MetaConversionEvent"("status", "nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "MetaConversionEvent_status_processingStartedAt_idx" ON "MetaConversionEvent"("status", "processingStartedAt");

-- CreateIndex
CREATE INDEX "MetaConversionEvent_eventTime_idx" ON "MetaConversionEvent"("eventTime");

-- AddForeignKey
ALTER TABLE "MetaConversionEvent" ADD CONSTRAINT "MetaConversionEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
