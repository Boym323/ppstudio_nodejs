ALTER TABLE "SiteSettings" ADD COLUMN "autoLunchEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "AutoLunchDayOverride" (
    "dateKey" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutoLunchDayOverride_pkey" PRIMARY KEY ("dateKey")
);

CREATE INDEX "AutoLunchDayOverride_updatedByUserId_idx" ON "AutoLunchDayOverride"("updatedByUserId");

ALTER TABLE "AutoLunchDayOverride" ADD CONSTRAINT "AutoLunchDayOverride_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
