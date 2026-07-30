CREATE TABLE "AvailabilityOperation" (
  "operationId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "weekKey" TEXT NOT NULL,
  "resultMessage" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AvailabilityOperation_pkey" PRIMARY KEY ("operationId")
);

CREATE INDEX "AvailabilityOperation_createdAt_idx" ON "AvailabilityOperation"("createdAt");
