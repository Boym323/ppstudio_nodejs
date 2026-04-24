CREATE TABLE "ServicePriceChangeLog" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "oldPriceFromCzk" INTEGER,
    "newPriceFromCzk" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePriceChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServicePriceChangeLog_serviceId_createdAt_idx" ON "ServicePriceChangeLog"("serviceId", "createdAt");
CREATE INDEX "ServicePriceChangeLog_changedByUserId_createdAt_idx" ON "ServicePriceChangeLog"("changedByUserId", "createdAt");

ALTER TABLE "ServicePriceChangeLog"
ADD CONSTRAINT "ServicePriceChangeLog_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServicePriceChangeLog"
ADD CONSTRAINT "ServicePriceChangeLog_changedByUserId_fkey"
FOREIGN KEY ("changedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
